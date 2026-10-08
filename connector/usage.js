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

// 그 사람의 오늘 한도 — 관리자 화면에서 정한 게 있고 기간 안이면 그것, 아니면 기본.
async function limitFor(env, email, app) {
  const r = await env.USAGE_DB.prepare("SELECT daily, until FROM limits WHERE email = ? AND app = ?").bind(email, app).first();
  return r && (!r.until || r.until >= kstDay()) ? Number(r.daily) : LIMITS[app];
}

export async function usage(request, env) {
  const url = new URL(request.url);
  const t = await readTicket(env, request);
  if (!t) return json({ ok: false, error: "로그인 표가 없거나 만료됐습니다 — 스크립트를 커넥터(freewill_script)에서 다시 받을 것" }, 401);

  if (url.pathname === "/usage/me") {
    const apps = {};
    for (const app of Object.keys(LIMITS)) apps[app] = { used: await usedToday(env, t.e, app), limit: await limitFor(env, t.e, app) };
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
  // 한도 확인과 기록을 한 문장으로 — Claude 와 Codex 처럼 같은 계정의 두 보내기가 동시에 들어와도 한도를 넘지 않는다.
  const limit = await limitFor(env, t.e, app);
  const id = crypto.randomUUID();
  const day = kstDay();
  const res = await env.USAGE_DB.prepare(
    `INSERT INTO usage (id, ts, day, email, name, pc, win_user, ip, app, kind, model, resolution, n, billing, project, job, status)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent'
      WHERE (SELECT COALESCE(SUM(n), 0) FROM usage WHERE email = ? AND day = ? AND app = ? AND status = 'sent') + ? <= ?`,
  ).bind(
    id, Date.now(), day, t.e, text(t.n), text(b.pc), text(b.user), text(request.headers.get("CF-Connecting-IP")),
    app, text(b.kind) || "generate", text(b.model), text(b.resolution), n, text(b.billing), text(b.project), text(b.job),
    t.e, day, app, n, limit,
  ).run();
  const used = await usedToday(env, t.e, app);
  if (!res.meta?.changes) {
    return json({
      ok: false, used, limit,
      error: limit === 0
        ? `${t.e} 계정은 관리자가 MCP ${WHAT[app]} 생성을 막아 두었다 — 관리자에게 물을 것`
        : `오늘 ${t.e} 계정이 MCP 로 보낸 ${WHAT[app]} ${used}${UNIT[app]} — 하루 ${limit}${UNIT[app]} 한도라 이번 ${n}${UNIT_TOPIC[app]} 보내지 않는다. ` +
          "개수를 줄이거나 내일 보내고, 급하면 앱에서 직접 만들게 하거나 관리자에게 한도를 늘려 달라고 할 것",
    }, 429);
  }
  return json({ ok: true, id, used, limit });
}

// ---------------------------------------------------------------- 관리자 화면

// 사람별 한도 저장·되돌리기 (관리자 화면의 폼). 다른 사이트에서 보낸 요청은 거절한다(쿠키는 SameSite=Lax 이기도 하다).
async function setLimit(request, env, viewer) {
  const self = env.PUBLIC_ORIGIN || new URL(request.url).origin;
  const origin = request.headers.get("Origin");
  if (origin && origin !== self) return page(403, "다른 곳에서 온 요청", "관리자 화면에서 다시 해 주세요.");
  const back = (m) => new Response(null, { status: 303, headers: { Location: `/admin?msg=${encodeURIComponent(m)}` } });
  const f = await request.formData();
  const email = String(f.get("email") || "").trim().toLowerCase();
  const app = String(f.get("app") || "");
  const domain = String(env.ALLOWED_DOMAIN || "").toLowerCase();
  if (!LIMITS[app]) return back("앱을 골라 주세요.");
  if (!/^[^@\s]+@[^@\s]+$/.test(email) || !email.endsWith(`@${domain}`)) return back(`회사 이메일(@${domain})을 적어 주세요.`);
  if (f.get("action") === "clear") {
    await env.USAGE_DB.prepare("DELETE FROM limits WHERE email = ? AND app = ?").bind(email, app).run();
    return back(`${email} 의 ${WHAT[app]} 한도를 기본(${LIMITS[app]}${UNIT[app]})으로 되돌렸다.`);
  }
  const daily = Math.round(Number(f.get("daily")));
  if (!(daily >= 0 && daily <= 100000)) return back("하루 한도는 0 ~ 100,000 사이 숫자로 적어 주세요.");
  const until = isDay(f.get("until")) ? String(f.get("until")) : null;
  await env.USAGE_DB.prepare(
    `INSERT INTO limits (email, app, daily, until, note, set_by, set_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (email, app) DO UPDATE SET daily = excluded.daily, until = excluded.until, note = excluded.note,
       set_by = excluded.set_by, set_at = excluded.set_at`,
  ).bind(email, app, daily, until, text(f.get("note")), viewer, Date.now()).run();
  return back(`${email} 의 ${WHAT[app]} 하루 한도를 ${daily === 0 ? "막음(0)" : `${daily}${UNIT[app]}`}${until ? `, ${until}까지` : ""}로 정했다.`);
}

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
  if (url.pathname === "/admin/limits" && request.method === "POST") return setLimit(request, env, viewer);
  if (url.pathname !== "/admin") return page(404, "없는 화면", "관리자 화면은 /admin 입니다.");

  const limits = await all("SELECT * FROM limits ORDER BY email, app");
  const msg = String(url.searchParams.get("msg") || "").slice(0, 200);
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
th{color:var(--slate);font-weight:600}th.n{text-align:right}td.n{text-align:right;font-variant-numeric:tabular-nums}td small{display:block;color:var(--slate);font-size:11px}
tr.cancel td{color:#9aa1ad;text-decoration:line-through}.empty{color:var(--slate);font-size:14px}
.notice{background:#e8edfd;border:1px solid #c9d4f7;border-radius:10px;padding:12px 16px;font-size:14px}
.lform{display:grid;grid-template-columns:2fr 1.2fr 1fr 1fr 2fr auto;gap:8px;margin-bottom:16px}.lform input,.lform select{font:inherit;padding:7px 8px;border:1px solid var(--line);border-radius:8px;min-width:0}
.hint{color:var(--slate);font-size:13px;margin:-4px 0 12px}.inline{display:inline}.link{background:none;border:0;color:var(--warn);font:inherit;font-weight:700;cursor:pointer;padding:0}
@media (max-width:760px){.lform{grid-template-columns:1fr 1fr}}
</style></head><body><div class="wrap">
<header><div><h1>프리윌 스튜디오 MCP 사용 기록</h1><div class="sub">MCP 로 앱에 보낸 생성만 기록됩니다(앱에서 직접 만든 것은 각 앱의 집계). 날짜는 한국 시간 · 보는 사람 ${esc(viewer)}</div></div>
<form method="get" action="/admin"><input type="date" name="from" value="${from}"> ~ <input type="date" name="to" value="${to}"><button>보기</button>
<a class="btn ghost" href="/admin/csv?from=${from}&to=${to}">CSV</a></form></header>
<div class="kpis"><div class="kpi"><b>${num(img)}장</b><span>나노바나나 이미지</span></div><div class="kpi"><b>${num(vid)}개</b><span>시댄스 영상</span></div>
<div class="kpi"><b>${num(people)}명</b><span>쓴 사람</span></div><div class="kpi"><b>하루 ${num(LIMITS.nanobanana)}장 · ${num(LIMITS.seedance)}개</b><span>한 사람 기본 한도 (아래에서 사람별로 조정)</span></div></div>
${msg ? `<div class="notice">${esc(msg)}</div>` : ""}
<section><h2>사람별 한도 조정</h2>
<p class="hint">기본은 한 사람 하루 이미지 ${num(LIMITS.nanobanana)}장 · 영상 ${num(LIMITS.seedance)}개. 여기 적은 사람만 다르게 적용된다. 0 이면 그 사람은 MCP 로 보내지 못한다. 기간을 비우면 계속, 날짜를 넣으면 그날까지(한국 날짜).</p>
<form class="lform" method="post" action="/admin/limits">
<input name="email" type="email" required placeholder="이름@${esc(env.ALLOWED_DOMAIN)}" aria-label="회사 이메일">
<select name="app" aria-label="앱"><option value="nanobanana">이미지 (나노바나나)</option><option value="seedance">영상 (시댄스)</option></select>
<input name="daily" type="number" min="0" max="100000" required placeholder="하루 한도" aria-label="하루 한도">
<input name="until" type="date" aria-label="이 날까지 (비우면 계속)" title="이 날까지 (비우면 계속)">
<input name="note" maxlength="200" placeholder="메모 (이유)" aria-label="메모">
<button name="action" value="set">저장</button>
</form>
${limits.length ? `<div class="scroll"><table><thead><tr><th>사람</th><th>앱</th><th class="n">하루 한도</th><th>기간</th><th>메모</th><th>정한 사람 · 시각</th><th></th></tr></thead><tbody>
${limits.map((l) => `<tr${l.until && l.until < kstDay() ? ' class="cancel"' : ""}><td>${esc(l.email)}</td><td>${esc(WHAT[l.app] || l.app)}</td><td class="n">${l.daily === 0 ? "막음" : `${num(l.daily)}${UNIT[l.app] || ""}`}</td><td>${l.until ? `${esc(l.until)}까지` : "계속"}</td><td>${esc(l.note || "")}</td><td>${esc(l.set_by || "")}<small>${l.set_at ? esc(kstTime(l.set_at)) : ""}</small></td>
<td><form class="inline" method="post" action="/admin/limits"><input type="hidden" name="email" value="${esc(l.email)}"><input type="hidden" name="app" value="${esc(l.app)}"><button class="link" name="action" value="clear">기본으로</button></form></td></tr>`).join("")}
</tbody></table></div>` : `<p class="empty">조정한 사람이 없다 — 모두 기본 한도.</p>`}
</section>
<section><h2>날짜 · 사람별</h2>${days.length ? `<div class="scroll"><table><thead><tr><th>날짜</th><th>사람</th><th class="n">이미지</th><th class="n">영상</th><th class="n">보낸 횟수</th><th>PC</th></tr></thead><tbody>
${days.map((r) => `<tr><td>${esc(r.day)}</td><td>${who(r)}</td><td class="n">${num(r.img)}</td><td class="n">${num(r.vid)}</td><td class="n">${num(r.sends)}</td><td>${esc(r.pcs || "")}</td></tr>`).join("")}
</tbody></table></div>` : `<p class="empty">이 기간에는 기록이 없습니다.</p>`}</section>
<section><h2>사람 · 모델별 (기간 합계)</h2>${models.length ? `<div class="scroll"><table><thead><tr><th>사람</th><th>앱</th><th>모델</th><th class="n">개수</th><th class="n">보낸 횟수</th></tr></thead><tbody>
${models.map((r) => `<tr><td>${who(r)}</td><td>${esc(WHAT[r.app] || r.app)}</td><td>${esc(r.model || "(앱 설정)")}</td><td class="n">${num(r.n)}</td><td class="n">${num(r.sends)}</td></tr>`).join("")}
</tbody></table></div>` : `<p class="empty">이 기간에는 기록이 없습니다.</p>`}</section>
<section><h2>최근 보낸 것 (최대 300건)</h2>${recent.length ? `<div class="scroll"><table><thead><tr><th>시간</th><th>사람</th><th>PC · 윈도우 사용자</th><th>IP</th><th>앱</th><th>종류</th><th>모델</th><th>해상도</th><th class="n">개수</th><th>과금</th><th>프로젝트</th><th>작업</th></tr></thead><tbody>
${recent.map((r) => `<tr class="${r.status === "cancelled" ? "cancel" : ""}"><td>${esc(kstTime(r.ts))}</td><td>${who(r)}</td><td>${esc(r.pc || "")}<small>${esc(r.win_user || "")}</small></td><td>${esc(r.ip || "")}</td><td>${esc(WHAT[r.app] || r.app)}</td><td>${esc(r.kind || "")}</td><td>${esc(r.model || "(앱 설정)")}</td><td>${esc(r.resolution || "")}</td><td class="n">${num(r.n)}</td><td>${esc(r.billing || "")}</td><td>${esc(r.project || "")}</td><td>${esc(r.job || "")}</td></tr>`).join("")}
</tbody></table></div>` : `<p class="empty">이 기간에는 기록이 없습니다.</p>`}</section>
</div></body></html>`;
  return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
