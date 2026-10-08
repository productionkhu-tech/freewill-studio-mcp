// 구글 로그인 — 회사 계정(ALLOWED_DOMAIN)만.
//
// 두 가지 로그인이 같은 구글 클라이언트와 같은 /callback 을 쓴다.
//   - MCP 연결: Claude·Codex 가 커넥터를 연결할 때(/authorize). 끝나면 OAuth 공급자가 그 앱에 토큰을 준다.
//   - 관리자 화면(/admin): ADMIN_EMAILS 에 있는 사람만. 끝나면 12시간짜리 세션 쿠키.
// 어느 쪽인지는 state 로 KV 에 10분 기억해 둔다(구글로 넘기는 state 는 무작위 id 뿐이라 바꿔치기할 수 없다).

import { AuthorizationError } from "@cloudflare/workers-oauth-provider";
import { fromB64urlText, seal, unseal } from "./seal.js";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const STATE_TTL = 600;
const ADMIN_HOURS = 12;
export const TICKET_HOURS = 12;

export const originOf = (request, env) => env.PUBLIC_ORIGIN || new URL(request.url).origin;
export const adminList = (env) => String(env.ADMIN_EMAILS || "").split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function page(status, title, message) {
  const body = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>body{font-family:"Pretendard","Malgun Gothic",sans-serif;background:#f3f5f8;color:#151a24;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}
main{background:#fff;border:1px solid #e2e6ec;border-radius:12px;padding:32px;max-width:480px}h1{font-size:20px;margin:0 0 12px}p{margin:0;line-height:1.6;color:#5c6574}</style></head>
<body><main><h1>${esc(title)}</h1><p>${esc(message)}</p></main></body></html>`;
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

async function toGoogle(request, env, flow) {
  const id = crypto.randomUUID();
  await env.OAUTH_KV.put(`freewill:state:${id}`, JSON.stringify(flow), { expirationTtl: STATE_TTL });
  const u = new URL(env.GOOGLE_AUTH_URL || GOOGLE_AUTH);
  u.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${originOf(request, env)}/callback`,
    response_type: "code",
    scope: "openid email profile",
    state: id,
    hd: env.ALLOWED_DOMAIN,
    prompt: "select_account",
  }).toString();
  return Response.redirect(u.toString(), 302);
}

// MCP 연결 시작 — 클라이언트·리디렉션 주소 검사는 OAuth 공급자가 한다.
export async function authorize(request, env) {
  let req;
  try {
    req = await env.OAUTH_PROVIDER.parseAuthRequest(request);
  } catch (e) {
    if (!(e instanceof AuthorizationError)) throw e;
    if (!e.redirectUri) return page(400, "연결 요청 오류", e.description);
    const r = new URL(e.redirectUri);
    r.searchParams.set("error", e.code);
    r.searchParams.set("error_description", e.description);
    if (e.state) r.searchParams.set("state", e.state);
    if (e.issuer) r.searchParams.set("iss", e.issuer);
    return Response.redirect(r.toString(), 302);
  }
  const client = await env.OAUTH_PROVIDER.lookupClient(req.clientId);
  if (!client) return page(400, "알 수 없는 앱", "이 연결을 요청한 앱을 찾지 못했습니다. 커넥터를 다시 연결해 주세요.");
  return toGoogle(request, env, { kind: "mcp", req, clientName: client.clientName || "" });
}

export const adminLogin = (request, env) => {
  const u = new URL(request.url);
  return toGoogle(request, env, { kind: "admin", back: u.pathname + u.search });
};

export async function callback(request, env) {
  const url = new URL(request.url);
  const id = url.searchParams.get("state") || "";
  const raw = id ? await env.OAUTH_KV.get(`freewill:state:${id}`) : null;
  if (!raw) return page(400, "로그인 시간이 지났습니다", "처음부터 다시 연결해 주세요.");
  await env.OAUTH_KV.delete(`freewill:state:${id}`);
  const flow = JSON.parse(raw);
  if (url.searchParams.get("error")) return page(403, "로그인이 취소됐습니다", "다시 연결해 주세요.");

  const user = await googleUser(request, env, url.searchParams.get("code"));
  if (!user.ok) return page(403, "로그인할 수 없는 계정입니다", user.why);

  if (flow.kind === "admin") {
    if (!adminList(env).includes(user.email)) return page(403, "관리자가 아닙니다", `${user.email} 은 관리자 목록에 없습니다.`);
    const cookie = await seal(env, "freewill-admin-v1", { e: user.email, x: Date.now() + ADMIN_HOURS * 3600e3 });
    const back = String(flow.back || "/admin").startsWith("/admin") ? flow.back : "/admin";
    return new Response(null, {
      status: 302,
      headers: {
        Location: back,
        "Set-Cookie": `fw_admin=${cookie}; Path=/admin; HttpOnly; Secure; SameSite=Lax; Max-Age=${ADMIN_HOURS * 3600}`,
      },
    });
  }

  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: flow.req,
    userId: user.email,
    metadata: { clientName: flow.clientName, email: user.email },
    scope: flow.req.scope || [],
    props: { email: user.email, name: user.name },
  });
  return Response.redirect(redirectTo, 302);
}

// 구글 토큰 주소에서 비밀값으로 직접 받은 id_token 이라 서명 대신 내용(받는 앱·발급자·만료·회사 도메인)을 확인한다.
async function googleUser(request, env, code) {
  if (!code) return { ok: false, why: "구글이 로그인 결과를 주지 않았습니다. 다시 시도해 주세요." };
  const r = await fetch(env.GOOGLE_TOKEN_URL || GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${originOf(request, env)}/callback`,
      grant_type: "authorization_code",
    }),
  });
  const t = await r.json().catch(() => ({}));
  if (!r.ok || !t.id_token) return { ok: false, why: "구글 로그인 확인에 실패했습니다. 다시 시도해 주세요." };
  let c = null;
  try { c = JSON.parse(fromB64urlText(String(t.id_token).split(".")[1])); } catch { c = null; }
  if (!c || c.aud !== env.GOOGLE_CLIENT_ID || !["accounts.google.com", "https://accounts.google.com"].includes(c.iss) || !(c.exp * 1000 > Date.now())) {
    return { ok: false, why: "구글 로그인 정보가 올바르지 않습니다. 다시 시도해 주세요." };
  }
  const domain = String(env.ALLOWED_DOMAIN || "").toLowerCase();
  const email = String(c.email || "").toLowerCase();
  if (!domain || c.email_verified !== true || c.hd !== domain || !email.endsWith(`@${domain}`)) {
    return { ok: false, why: `회사 계정(@${domain})으로만 쓸 수 있습니다. 로그인한 계정: ${email || "알 수 없음"}` };
  }
  return { ok: true, email, name: String(c.name || email.split("@")[0]) };
}

export async function adminUser(request, env) {
  const raw = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)fw_admin=([^;]+)/)?.[1];
  const s = raw ? await unseal(env, "freewill-admin-v1", raw) : null;
  return s && adminList(env).includes(s.e) ? s.e : null;
}

// 스크립트에 넣는 로그인 표 — 누가 받았는지와 만료 시각. 스크립트는 보낼 때마다 이 표로 사용 기록을 남긴다.
export const makeTicket = (env, props) =>
  seal(env, "freewill-ticket-v1", { e: props.email, n: props.name, x: Date.now() + TICKET_HOURS * 3600e3 });

export const readTicket = (env, request) =>
  unseal(env, "freewill-ticket-v1", (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""));
