// 서명 — 스크립트에 넣는 '로그인 표'와 관리자 화면 세션에 쓴다.
// 키는 GOOGLE_CLIENT_SECRET 에서 용도별로 뽑는다. 비밀값을 하나만 관리하면 되고, 그걸 바꾸면 표·세션이 모두 무효가 된다.

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64url(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(s) {
  const t = String(s).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t + "===".slice((t.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export const fromB64urlText = (s) => dec.decode(fromB64url(s));

async function keyFor(env, purpose) {
  const base = await crypto.subtle.importKey("raw", enc.encode(env.GOOGLE_CLIENT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const derived = await crypto.subtle.sign("HMAC", base, enc.encode(purpose));
  return crypto.subtle.importKey("raw", derived, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

// obj 에는 만료 시각 x(ms)가 꼭 있어야 한다.
export async function seal(env, purpose, obj) {
  const body = b64url(enc.encode(JSON.stringify(obj)));
  const sig = b64url(await crypto.subtle.sign("HMAC", await keyFor(env, purpose), enc.encode(body)));
  return `${body}.${sig}`;
}

// 서명이 맞고 만료 전이면 내용, 아니면 null.
export async function unseal(env, purpose, token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  let ok = false;
  try { ok = await crypto.subtle.verify("HMAC", await keyFor(env, purpose), fromB64url(sig), enc.encode(body)); } catch { ok = false; }
  if (!ok) return null;
  let obj = null;
  try { obj = JSON.parse(fromB64urlText(body)); } catch { return null; }
  return obj && typeof obj.x === "number" && obj.x > Date.now() ? obj : null;
}
