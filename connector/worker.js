// 프리윌 스튜디오 MCP 원격 커넥터 — 입구.
//
// Higgsfield 처럼 주소 하나만 연결하면 설치도 업데이트도 필요 없게 하려는 것. 지침·공식 스킬·앱 스크립트를 GitHub
// 최신본으로 내려준다(mcp.js). 생성은 하지 않는다 — 앱에 작업을 넣는 일은 PC 에서 도는 에이전트가 받은 스크립트로 한다.
//
// 2026-10-08 부터 회사 구글 계정(ALLOWED_DOMAIN)으로 로그인해야 쓴다(OAuth — @cloudflare/workers-oauth-provider).
//   /mcp            로그인한 사람만 (MCP 본체, mcp.js — 선택 창 freewill_ask 는 ask.js, 답 기다리는 자리는 Durable Object AskRoom)
//   /authorize · /callback   구글 로그인 (auth.js)
//   /usage …        스크립트가 남기는 사용 기록·하루 한도 (usage.js, 스크립트의 로그인 표로 확인)
//   /admin …        관리자 화면 (ADMIN_EMAILS 만, 구글 로그인)
//   /token · /register · /.well-known/…   OAuth 공급자가 맡는다
//
// 비밀값: GOOGLE_CLIENT_SECRET · ADMIN_EMAILS (wrangler secret). 나머지는 wrangler.toml 의 vars.

import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { mcpHandler } from "./mcp.js";
import { adminLogin, adminUser, authorize, callback, originOf, page } from "./auth.js";
import { admin, usage } from "./usage.js";

export { AskRoom } from "./ask.js";

const REPO_URL = "https://github.com/productionkhu-tech/freewill-studio-mcp";

const defaultHandler = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    if (p === "/" || p === "") {
      return new Response(
        `프리윌 스튜디오 MCP 커넥터 — 연결 주소: ${originOf(request, env)}/mcp (회사 구글 계정으로 로그인)\n지침 원본: ${REPO_URL}\n`,
        { headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    }
    if (p === "/authorize") return authorize(request, env);
    if (p === "/callback") return callback(request, env);
    if (p === "/usage" || p.startsWith("/usage/")) return usage(request, env);
    if (p === "/admin" || p.startsWith("/admin/")) {
      const who = await adminUser(request, env);
      return who ? admin(request, env, who) : adminLogin(request, env);
    }
    return page(404, "없는 주소", "프리윌 스튜디오 MCP 커넥터에는 이런 주소가 없습니다.");
  },
};

// OAuth 공급자 설정은 공개 주소(PUBLIC_ORIGIN)로 정해진다 — 시험(wrangler dev)에서는 localhost 로 바꿔 띄운다.
const providers = new Map();
function providerFor(origin) {
  let p = providers.get(origin);
  if (!p) {
    p = new OAuthProvider({
      apiRoute: "/mcp",
      apiHandler: mcpHandler,
      defaultHandler,
      authorizeEndpoint: "/authorize",
      tokenEndpoint: "/token",
      clientRegistrationEndpoint: "/register",
      clientIdMetadataDocumentEnabled: true,
      refreshTokenTTL: 7 * 24 * 3600,   // 로그인 유지 7일 — 지나면 다시 구글 로그인
      resourceMetadata: {
        resource: `${origin}/mcp`,
        authorization_servers: [origin],
        bearer_methods_supported: ["header"],
        resource_name: "프리윌 스튜디오 MCP",
      },
    });
    providers.set(origin, p);
  }
  return p;
}

export default {
  fetch(request, env, ctx) {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.ALLOWED_DOMAIN) {
      return new Response("로그인 설정 전입니다 — 관리자가 구글 클라이언트를 넣으면 열립니다.", { status: 503 });
    }
    return providerFor(originOf(request, env)).fetch(request, env, ctx);
  },
};
