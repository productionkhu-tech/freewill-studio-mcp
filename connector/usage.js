// MCP 로 보낸 생성의 사용 기록과 하루 한도, 관리자 화면.
//
// 스크립트(send-to-*)는 앱에 넣기 직전에 POST /usage 로 "누가·어느 PC·무슨 모델·몇 장" 을 남기고, 하루 한도가 남았는지
// 답을 받는다. 앱이 거절하면 /usage/settle 로 무른다. 프롬프트·그림은 받지 않는다. 날짜는 한국 시간.

import { page, readTicket } from "./auth.js";

export const LIMITS = { nanobanana: 1000, seedance: 200 };
const UNIT = { nanobanana: "장", seedance: "개" };
const WHAT = { nanobanana: "이미지", seedance: "영상" };
const UNIT_TOPIC = { nanobanana: "장은", seedance: "개는" };   // 받침에 맞춘 조사

const kstDay = (ms = Date.now()) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const text = (v, max = 200) => (v === undefined || v === null || v === "" ? null : String(v).slice(0, max));

async function usedToday(env, email, app) {
  const r = await env.USAGE_DB.prepare("SELECT COALESCE(SUM(n), 0) AS n FROM usage WHERE email = ? AND day = ? AND app = ? AND status = 'sent'")
    .bind(email, kstDay(), app).first();
  return Number(r?.n || 0);
}

export async function usage(request, env) {
  const url = new URL(request.url);
  const t = await readTicket(env, request);
  if (!t) return json({ ok: false, error: "로그인 표가 없거나 만료됐습니다 — 스크립트를 커넥터(freewill_script)에서 다시 받을 것" }, 401);

  if (url.pathname === "/usage/me") {
    const apps = {};
    for (const app of Object.keys(LIMITS)) apps[app] = { used: await usedToday(env, t.e, app), limit: LIMITS[app] };
    return json({ ok: true, email: t.e, day: kstDay(), apps });
  }
  if (request.method !== "POST") return json({ ok: false, error: "POST 로 보낼 것" }, 405);
  const b = await request.json().catch(() => ({}));

  // 앱이 받은 실제 개수로 맞추거나(n), 앱이 거절했으면 무른다(n = 0).
  if (url.pathname === "/usage/settle") {
    const n = Math.round(Number(b.n));
    if (n >= 1) await env.USAGE_DB.prepare("UPDATE usage SET n = ? WHERE id = ? AND email = ? AND n >= ?").bind(n, text(b.id), t.e, n).run();
    else await env.USAGE_DB.prepare("UPDATE usage SET status = 'cancelled' WHERE id = ? AND email = ?").bind(text(b.id), t.e).run();
    return json({ ok: true });
  }
  if (url.pathname !== "/usage") return json({ ok: false, error: "모르는 주소" }, 404);

  const app = String(b.app || "");
  const n = Math.round(Number(b.n));
  if (!LIMITS[app] || !(n >= 1 && n <= 10)) return json({ ok: false, error: "app 이나 n 이 올바르지 않음" }, 400);
  const used = await usedToday(env, t.e, app);
  if (used + n > LIMITS[app]) {
    return json({
      ok: false, used, limit: LIMITS[app],
      error: `오늘 ${t.e} 계정이 MCP 로 보낸 ${WHAT[app]} ${used}${UNIT[app]} — 하루 ${LIMITS[app]}${UNIT[app]} 한도라 이번 ${n}${UNIT_TOPIC[app]} 보내지 않는다. ` +
        "개수를 줄이거나 내일 보내고, 급하면 앱에서 직접 만들게 할 것",
    }, 429);
  }
  const id = crypto.randomUUID();
  await env.USAGE_DB.prepare(
    `INSERT INTO usage (id, ts, day, email, name, pc, win_user, ip, app, kind, model, resolution, n, billing, project, job, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent')`,
  ).bind(
    id, Date.now(), kstDay(), t.e, text(t.n), text(b.pc), text(b.user), text(request.headers.get("CF-Connecting-IP")),
    app, text(b.kind) || "generate", text(b.model), text(b.resolution), n, text(b.billing), text(b.project), text(b.job),
  ).run();
  return json({ ok: true, id, used: used + n, limit: LIMITS[app] });
}

// ---------------------------------------------------------------- 관리자 화면

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const kstTime = (ms) => new Date(ms + 9 * 3600e3).toISOString().slice(5, 16).replace("T", " ");

export async function admin(request, env, viewer) {
  const url = new URL(request.url);
  const to = isDay(url.searchParams.get("to")) ? url.searchParams.get("to") : kstDay();
  const from = isDay(url.searchParams.get("from")) ? url.searchParams.get("from") : kstDay(Date.now() - 13 * 864e5);
  const all = async (sql, ...a) => (await env.USAGE_DB.prepare(sql).bind(...a).all()).results || [];

  if (url.pathname === "/admin/csv") {
    const rows = await all("SELECT * FROM usage WHERE day BETWEEN ? AND ? ORDER BY ts", from, to);
    const cols = ["day", "ts", "email", "name", "pc", "win_user", "ip", "app", "kind", "model", "resolution", "n", "billing", "project", "job", "status"];
    const cell = (v) => (/[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ""));
    const csv = String.fromCharCode(0xfeff) + [cols.join(","), ...rows.map((r) => cols.map((c) => cell(c === "ts" ? kstTime(r.ts) : r[c])).join(","))].join("\n");
    return new Response(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="freewill-usage_${from}_${to}.csv"`, "Cache-Control": "no-store" },
    });
  }
  if (url.pathname !== "/admin") return page(404, "없는 화면", "관리자 화면은 /admin 입니다.");

  const days = await all(
    `SELECT day, email, MAX(name) AS name,
            SUM(CASE WHEN app = 'nanobanana' THEN n ELSE 0 END) AS img,
            SUM(CASE WHEN app = 'seedance' THEN n ELSE 0 END) AS vid,
            COUNT(*) AS sends, GROUP_CONCAT(DISTINCT pc) AS pcs
       FROM usage WHERE day BETWEEN ? AND ? AND status = 'sent'
      GROUP BY day, email ORDER BY day DESC, img + vid DESC`, from, to);
  const models = await all(
    `SELECT email, MAX(name) AS name, app, model, SUM(n) AS n, COUNT(*) AS sends
       FROM usage WHERE day BETWEEN ? AND ? AND status = 'sent'
      GROUP BY email, app, model ORDER BY n DESC`, from, to);
  const recent = await all("SELECT * FROM usage WHERE day BETWEEN ? AND ? ORDER BY ts DESC LIMIT 300", from, to);

  const img = days.reduce((a, r) => a + r.img, 0);
  const vid = days.reduce((a, r) => a + r.vid, 0);
  const people = new Set(days.map((r) => r.email)).size;
  const who = (r) => `${esc(r.name || r.email)}<small>${esc(r.email)}</small>`;
  const num = (n) => Number(n || 0).toLocaleString("ko-KR");

  const body = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>프리윌 스튜디오 MCP 사용 기록</title>
<style>
:root{--ink:#151a24;--slate:#5c6574;--line:#e2e6ec;--surface:#f3f5f8;--bg:#fff;--accent:#2453e6;--warn:#c2410c}
*{box-sizing:border-box}body{margin:0;font-family:"Pretendard","Malgun Gothic",sans-serif;color:var(--ink);background:var(--surface);word-break:keep-all}
.wrap{max-width:1200px;margin:0 auto;padding:32px 16px 64px;display:flex;flex-direction:column;gap:24px}
header{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:16px}
h1{font-size:24px;margin:0}h2{font-size:17px;margin:0 0 12px}.sub{color:var(--slate);font-size:13px;margin-top:4px}
form{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:14px}input{font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:8px}
button,.btn{font:inherit;font-weight:700;padding:7px 14px;border-radius:8px;border:0;background:var(--accent);color:#fff;text-decoration:none;cursor:pointer}
.btn.ghost{background:var(--bg);color:var(--ink);border:1px solid var(--line)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
.kpi{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:16px}.kpi b{display:block;font-size:26px;font-variant-numeric:tabular-nums}.kpi span{color:var(--slate);font-size:13px}
section{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:20px}.scroll{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
th{color:var(--slate);font-weight:600}td.n{text-align:right;font-variant-numeric:tabular-nums}td small{display:block;color:var(--slate);font-size:11px}
tr.cancel td{color:#9aa1ad;text-decoration:line-through}.empty{color:var(--slate);font-size:14px}
</style></head><body><div class="wrap">
<header><div><h1>프리윌 스튜디오 MCP 사용 기록</h1><div class="sub">MCP 로 앱에 보낸 생성만 기록됩니다(앱에서 직접 만든 것은 각 앱의 집계). 날짜는 한국 시간 · 보는 사람 ${esc(viewer)}</div></div>
<form method="get" action="/admin"><input type="date" name="from" value="${from}"> ~ <input type="date" name="to" value="${to}"><button>보기</button>
<a class="btn ghost" href="/admin/csv?from=${from}&to=${to}">CSV</a></form></header>
<div class="kpis"><div class="kpi"><b>${num(img)}장</b><span>나노바나나 이미지</span></div><div class="kpi"><b>${num(vid)}개</b><span>시댄스 영상</span></div>
<div class="kpi"><b>${num(people)}명</b><span>쓴 사람</span></div><div class="kpi"><b>하루 ${LIMITS.nanobanana}장 · ${LIMITS.seedance}개</b><span>한 사람 한도</span></div></div>
<section><h2>날짜 · 사람별</h2>${days.length ? `<div class="scroll"><table><thead><tr><th>날짜</th><th>사람</th><th>이미지</th><th>영상</th><th>보낸 횟수</th><th>PC</th></tr></thead><tbody>
${days.map((r) => `<tr><td>${esc(r.day)}</td><td>${who(r)}</td><td class="n">${num(r.img)}</td><td class="n">${num(r.vid)}</td><td class="n">${num(r.sends)}</td><td>${esc(r.pcs || "")}</td></tr>`).join("")}
</tbody></table></div>` : `<p class="empty">이 기간에는 기록이 없습니다.</p>`}</section>
<section><h2>사람 · 모델별 (기간 합계)</h2>${models.length ? `<div class="scroll"><table><thead><tr><th>사람</th><th>앱</th><th>모델</th><th>개수</th><th>보낸 횟수</th></tr></thead><tbody>
${models.map((r) => `<tr><td>${who(r)}</td><td>${esc(WHAT[r.app] || r.app)}</td><td>${esc(r.model || "(앱 설정)")}</td><td class="n">${num(r.n)}</td><td class="n">${num(r.sends)}</td></tr>`).join("")}
</tbody></table></div>` : `<p class="empty">이 기간에는 기록이 없습니다.</p>`}</section>
<section><h2>최근 보낸 것 (최대 300건)</h2>${recent.length ? `<div class="scroll"><table><thead><tr><th>시간</th><th>사람</th><th>PC · 윈도우 사용자</th><th>IP</th><th>앱</th><th>종류</th><th>모델</th><th>해상도</th><th>개수</th><th>과금</th><th>프로젝트</th><th>작업</th></tr></thead><tbody>
${recent.map((r) => `<tr class="${r.status === "cancelled" ? "cancel" : ""}"><td>${esc(kstTime(r.ts))}</td><td>${who(r)}</td><td>${esc(r.pc || "")}<small>${esc(r.win_user || "")}</small></td><td>${esc(r.ip || "")}</td><td>${esc(WHAT[r.app] || r.app)}</td><td>${esc(r.kind || "")}</td><td>${esc(r.model || "(앱 설정)")}</td><td>${esc(r.resolution || "")}</td><td class="n">${num(r.n)}</td><td>${esc(r.billing || "")}</td><td>${esc(r.project || "")}</td><td>${esc(r.job || "")}</td></tr>`).join("")}
</tbody></table></div>` : `<p class="empty">이 기간에는 기록이 없습니다.</p>`}</section>
</div></body></html>`;
  return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
