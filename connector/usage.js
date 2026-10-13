// MCP 로 보낸 생성의 사용 기록과 하루 한도, 관리자 화면.
//
// 스크립트(send-to-*)는 앱에 넣기 직전에 POST /usage 로 "누가·어느 PC·무슨 모델·몇 장" 을 남기고, 하루 한도가 남았는지
// 답을 받는다. 앱이 거절하면 /usage/settle 로 무른다. 프롬프트·그림은 받지 않는다. 날짜는 한국 시간.
//
// 하루 한도는 PC 한 대(PC 이름 + 윈도 사용자) 기준이다 — Claude·구글 계정 하나를 여러 사람이 같이 써도 PC 마다 따로 센다.
// 관리자가 계정에 상한을 정해 두면(limits) 그 계정으로 보낸 모든 PC 의 합계도 그 안이어야 한다.

import { page, readTicket } from "./auth.js";

export const LIMITS = { nanobanana: 1000, seedance: 200 };   // PC 한 대의 하루 기본 한도
const UNIT = { nanobanana: "장", seedance: "개" };
const WHAT = { nanobanana: "이미지", seedance: "영상" };
const UNIT_TOPIC = { nanobanana: "장은", seedance: "개는" };   // 받침에 맞춘 조사

const kstDay = (ms = Date.now()) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const text = (v, max = 200) => (v === undefined || v === null || v === "" ? null : String(v).slice(0, max));
const pcOf = (v) => text(v) || "";   // 기록의 pc · win_user 와 같은 값(없으면 "")

const BY_PC = "COALESCE(pc, '') = ? AND COALESCE(win_user, '') = ?";
const BY_ACCOUNT = "email = ?";
const TODAY = "day = ? AND app = ? AND status = 'sent'";
async function usedToday(env, by, keys, app) {
  const r = await env.USAGE_DB.prepare(`SELECT COALESCE(SUM(n), 0) AS n FROM usage WHERE ${by} AND ${TODAY}`).bind(...keys, kstDay(), app).first();
  return Number(r?.n || 0);
}

// 관리자가 정한 한도 — 기간 안이면 그 값, 아니면 null.
const inForce = (r) => (r && (!r.until || r.until >= kstDay()) ? Number(r.daily) : null);
// 이 PC 의 오늘 한도: 관리자 화면에서 그 PC 에 정한 것, 없으면 기본.
async function pcLimit(env, pc, user, app) {
  const r = await env.USAGE_DB.prepare("SELECT daily, until FROM pc_limits WHERE pc = ? AND win_user = ? AND app = ?").bind(pc, user, app).first();
  return inForce(r) ?? LIMITS[app];
}
// 계정 전체 상한: 관리자가 정한 계정만(없으면 null — 상한 없음).
async function accountCap(env, email, app) {
  return inForce(await env.USAGE_DB.prepare("SELECT daily, until FROM limits WHERE email = ? AND app = ?").bind(email, app).first());
}
// 남은 양이 더 적은 쪽(이 PC · 계정 전체)을 알려 준다.
async function quota(env, email, pc, user, app) {
  const q = { scope: "pc", used: await usedToday(env, BY_PC, [pc, user], app), limit: await pcLimit(env, pc, user, app) };
  const cap = await accountCap(env, email, app);
  if (cap === null) return q;
  const a = { scope: "account", used: await usedToday(env, BY_ACCOUNT, [email], app), limit: cap };
  return a.limit - a.used < q.limit - q.used ? a : q;
}

export async function usage(request, env) {
  const url = new URL(request.url);
  const t = await readTicket(env, request);
  if (!t) return json({ ok: false, error: "로그인 표가 없거나 만료됐습니다 — 스크립트를 커넥터(freewill_script)에서 다시 받을 것" }, 401);

  if (url.pathname === "/usage/me") {
    const pc = pcOf(url.searchParams.get("pc"));
    const user = pcOf(url.searchParams.get("user"));
    const apps = {};
    for (const app of Object.keys(LIMITS)) apps[app] = await quota(env, t.e, pc, user, app);
    return json({ ok: true, email: t.e, pc, user, day: kstDay(), apps });
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
  const pc = pcOf(b.pc);
  const user = pcOf(b.user);
  // 한도 확인과 기록을 한 문장으로 — 같은 PC 의 Claude·Codex 가 동시에 보내도, 계정 상한이 있어도 넘지 않는다.
  const limit = await pcLimit(env, pc, user, app);
  const cap = await accountCap(env, t.e, app);
  const id = crypto.randomUUID();
  const day = kstDay();
  const res = await env.USAGE_DB.prepare(
    `INSERT INTO usage (id, ts, day, email, name, pc, win_user, ip, app, kind, model, resolution, n, billing, project, job, status)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent'
      WHERE (SELECT COALESCE(SUM(n), 0) FROM usage WHERE ${BY_PC} AND ${TODAY}) + ? <= ?
        AND (? IS NULL OR (SELECT COALESCE(SUM(n), 0) FROM usage WHERE ${BY_ACCOUNT} AND ${TODAY}) + ? <= ?)`,
  ).bind(
    id, Date.now(), day, t.e, text(t.n), text(b.pc), text(b.user), text(request.headers.get("CF-Connecting-IP")),
    app, text(b.kind) || "generate", text(b.model), text(b.resolution), n, text(b.billing), text(b.project), text(b.job),
    pc, user, day, app, n, limit,
    cap, t.e, day, app, n, cap ?? 0,
  ).run();
  if (!res.meta?.changes) {
    const pcUsed = await usedToday(env, BY_PC, [pc, user], app);
    const accountUsed = cap === null ? 0 : await usedToday(env, BY_ACCOUNT, [t.e], app);
    const byAccount = cap !== null && accountUsed + n > cap;
    const where = pc ? `이 PC(${pc}${user ? ` · ${user}` : ""})` : "이 PC";
    const [used, max] = byAccount ? [accountUsed, cap] : [pcUsed, limit];
    return json({
      ok: false, used, limit: max, scope: byAccount ? "account" : "pc",
      error: max === 0
        ? `${byAccount ? `${t.e} 계정은` : `${where}는`} 관리자가 MCP ${WHAT[app]} 생성을 막아 두었다 — 관리자에게 물을 것`
        : `오늘 ${byAccount ? `${t.e} 계정(모든 PC 합계)이` : `${where}가`} MCP 로 보낸 ${WHAT[app]} ${used}${UNIT[app]} — ` +
          `${byAccount ? "계정" : "PC"} 하루 ${max}${UNIT[app]} 한도라 이번 ${n}${UNIT_TOPIC[app]} 보내지 않는다. ` +
          "개수를 줄이거나 내일 보내고, 급하면 앱에서 직접 만들게 하거나 관리자에게 한도를 늘려 달라고 할 것",
    }, 429);
  }
  const q = await quota(env, t.e, pc, user, app);
  return json({ ok: true, id, used: q.used, limit: q.limit, scope: q.scope });
}

// ---------------------------------------------------------------- 관리자 화면

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const kstTime = (ms) => new Date(ms + 9 * 3600e3).toISOString().slice(5, 16).replace("T", " ");
const back = (m) => new Response(null, { status: 303, headers: { Location: `/admin?msg=${encodeURIComponent(m)}` } });
const amount = (app, daily) => (daily === 0 ? "막음(0)" : `${daily}${UNIT[app]}`);
// "15장으로" · "250개(10-20까지)로" — 받침에 맞춘 조사
const amountTo = (app, daily, until) => {
  const a = amount(app, daily);
  return `${a}${until ? `(${until}까지)` : ""}${/[장)]$/.test(a) ? "으로" : "로"}`;
};
// PC 는 폼에서 "PC 이름|윈도 사용자" 한 값으로 오간다 — 둘 다 | 를 쓸 수 없는 이름이다.
const pcValue = (pc, user) => `${pc}|${user}`;
const pcText = (pc, user) => `${pc || "(PC 이름 없음)"}${user ? ` · ${user}` : ""}`;
function readPc(v) {
  const s = String(v ?? "");
  const i = s.indexOf("|");
  return i < 0 || s.length > 401 ? null : [s.slice(0, i), s.slice(i + 1)];
}

// 관리자 화면의 폼만 받는다 — 다른 사이트에서 보낸 요청은 거절(쿠키는 SameSite=Lax 이기도 하다).
function fromAdminPage(request, env) {
  const origin = request.headers.get("Origin");
  return !origin || origin === (env.PUBLIC_ORIGIN || new URL(request.url).origin);
}
// 폼의 하루 한도 · 기간 · 메모
function limitFields(f) {
  const daily = Math.round(Number(f.get("daily")));
  if (!(daily >= 0 && daily <= 100000)) return null;
  return { daily, until: isDay(f.get("until")) ? String(f.get("until")) : null, note: text(f.get("note")) };
}

// PC 에 사람 이름 붙이기 · PC 한도 저장·되돌리기
async function setPc(request, env, viewer) {
  if (!fromAdminPage(request, env)) return page(403, "다른 곳에서 온 요청", "관리자 화면에서 다시 해 주세요.");
  const f = await request.formData();
  const key = readPc(f.get("pc"));
  if (!key) return back("PC 를 골라 주세요.");
  const [pc, user] = key;
  const who = pcText(pc, user);
  const action = String(f.get("action") || "");
  if (action === "name") {
    const label = String(f.get("label") || "").trim().slice(0, 40);
    if (!label) {
      await env.USAGE_DB.prepare("DELETE FROM pc_names WHERE pc = ? AND win_user = ?").bind(pc, user).run();
      return back(`${who} 의 이름을 지웠다.`);
    }
    await env.USAGE_DB.prepare(
      `INSERT INTO pc_names (pc, win_user, label, set_by, set_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (pc, win_user) DO UPDATE SET label = excluded.label, set_by = excluded.set_by, set_at = excluded.set_at`,
    ).bind(pc, user, label, viewer, Date.now()).run();
    return back(`${who} 에 '${label}' 이름을 붙였다.`);
  }
  const app = String(f.get("app") || "");
  if (!LIMITS[app]) return back("앱을 골라 주세요.");
  if (action === "clear") {
    await env.USAGE_DB.prepare("DELETE FROM pc_limits WHERE pc = ? AND win_user = ? AND app = ?").bind(pc, user, app).run();
    return back(`${who} 의 ${WHAT[app]} 한도를 기본(${LIMITS[app]}${UNIT[app]})으로 되돌렸다.`);
  }
  const l = limitFields(f);
  if (!l) return back("하루 한도는 0 ~ 100,000 사이 숫자로 적어 주세요.");
  await env.USAGE_DB.prepare(
    `INSERT INTO pc_limits (pc, win_user, app, daily, until, note, set_by, set_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (pc, win_user, app) DO UPDATE SET daily = excluded.daily, until = excluded.until, note = excluded.note,
       set_by = excluded.set_by, set_at = excluded.set_at`,
  ).bind(pc, user, app, l.daily, l.until, l.note, viewer, Date.now()).run();
  return back(`${who} 의 ${WHAT[app]} 하루 한도를 ${amountTo(app, l.daily, l.until)} 정했다.`);
}

// 계정 전체 상한 저장·없애기
async function setAccountCap(request, env, viewer) {
  if (!fromAdminPage(request, env)) return page(403, "다른 곳에서 온 요청", "관리자 화면에서 다시 해 주세요.");
  const f = await request.formData();
  const email = String(f.get("email") || "").trim().toLowerCase();
  const app = String(f.get("app") || "");
  const domain = String(env.ALLOWED_DOMAIN || "").toLowerCase();
  if (!LIMITS[app]) return back("앱을 골라 주세요.");
  if (!/^[^@\s]+@[^@\s]+$/.test(email) || !email.endsWith(`@${domain}`)) return back(`회사 이메일(@${domain})을 적어 주세요.`);
  if (f.get("action") === "clear") {
    await env.USAGE_DB.prepare("DELETE FROM limits WHERE email = ? AND app = ?").bind(email, app).run();
    return back(`${email} 계정 전체 ${WHAT[app]} 상한을 없앴다 — PC별 한도만 센다.`);
  }
  const l = limitFields(f);
  if (!l) return back("하루 한도는 0 ~ 100,000 사이 숫자로 적어 주세요.");
  await env.USAGE_DB.prepare(
    `INSERT INTO limits (email, app, daily, until, note, set_by, set_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (email, app) DO UPDATE SET daily = excluded.daily, until = excluded.until, note = excluded.note,
       set_by = excluded.set_by, set_at = excluded.set_at`,
  ).bind(email, app, l.daily, l.until, l.note, viewer, Date.now()).run();
  return back(`${email} 계정 전체 ${WHAT[app]} 하루 상한을 ${amountTo(app, l.daily, l.until)} 정했다.`);
}

export async function admin(request, env, viewer) {
  const url = new URL(request.url);
  const today = kstDay();
  const to = isDay(url.searchParams.get("to")) ? url.searchParams.get("to") : today;
  const from = isDay(url.searchParams.get("from")) ? url.searchParams.get("from") : kstDay(Date.now() - 13 * 864e5);
  const all = async (sql, ...a) => (await env.USAGE_DB.prepare(sql).bind(...a).all()).results || [];

  if (url.pathname === "/admin/csv") {
    const rows = await all(
      `SELECT u.*, nm.label AS pc_name FROM usage u
         LEFT JOIN pc_names nm ON nm.pc = COALESCE(u.pc, '') AND nm.win_user = COALESCE(u.win_user, '')
        WHERE u.day BETWEEN ? AND ? ORDER BY u.ts`, from, to);
    const cols = ["day", "ts", "email", "name", "pc_name", "pc", "win_user", "ip", "app", "kind", "model", "resolution", "n", "billing", "project", "job", "status"];
    const cell = (v) => (/[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ""));
    const csv = String.fromCharCode(0xfeff) + [cols.join(","), ...rows.map((r) => cols.map((c) => cell(c === "ts" ? kstTime(r.ts) : r[c])).join(","))].join("\n");
    return new Response(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="freewill-usage_${from}_${to}.csv"`, "Cache-Control": "no-store" },
    });
  }
  if (url.pathname === "/admin/pc" && request.method === "POST") return setPc(request, env, viewer);
  if (url.pathname === "/admin/limits" && request.method === "POST") return setAccountCap(request, env, viewer);
  if (url.pathname !== "/admin") return page(404, "없는 화면", "관리자 화면은 /admin 입니다.");

  const msg = String(url.searchParams.get("msg") || "").slice(0, 200);
  // PC 목록 — 이 기간과 최근 90일에 보낸 PC, 이름·한도만 정해 둔 PC
  const since = [from, kstDay(Date.now() - 89 * 864e5)].sort()[0];
  const seen = await all(
    `SELECT COALESCE(pc, '') AS pc, COALESCE(win_user, '') AS win_user, GROUP_CONCAT(DISTINCT email) AS emails, MAX(ts) AS last,
            SUM(CASE WHEN day BETWEEN ? AND ? AND app = 'nanobanana' THEN n ELSE 0 END) AS img,
            SUM(CASE WHEN day BETWEEN ? AND ? AND app = 'seedance' THEN n ELSE 0 END) AS vid,
            SUM(CASE WHEN day = ? AND app = 'nanobanana' THEN n ELSE 0 END) AS img_today,
            SUM(CASE WHEN day = ? AND app = 'seedance' THEN n ELSE 0 END) AS vid_today
       FROM usage WHERE day >= ? AND status = 'sent'
      GROUP BY COALESCE(pc, ''), COALESCE(win_user, '') ORDER BY last DESC`, from, to, from, to, today, today, since);
  const names = await all("SELECT pc, win_user, label FROM pc_names");
  const pcLimits = await all("SELECT * FROM pc_limits ORDER BY pc, win_user, app");
  const caps = await all("SELECT * FROM limits ORDER BY email, app");
  const nameOf = new Map(names.map((r) => [pcValue(r.pc, r.win_user), r.label]));
  const pcs = [...seen];
  for (const r of [...names, ...pcLimits]) {
    if (!pcs.some((p) => p.pc === r.pc && p.win_user === r.win_user)) pcs.push({ pc: r.pc, win_user: r.win_user, emails: "", img: 0, vid: 0, img_today: 0, vid_today: 0, last: null });
  }
  const limitOf = (pc, user, app) => inForce(pcLimits.find((l) => l.pc === pc && l.win_user === user && l.app === app)) ?? LIMITS[app];
  const days = await all(
    `SELECT day, COALESCE(pc, '') AS pc, COALESCE(win_user, '') AS win_user, GROUP_CONCAT(DISTINCT email) AS emails,
            SUM(CASE WHEN app = 'nanobanana' THEN n ELSE 0 END) AS img,
            SUM(CASE WHEN app = 'seedance' THEN n ELSE 0 END) AS vid, COUNT(*) AS sends
       FROM usage WHERE day BETWEEN ? AND ? AND status = 'sent'
      GROUP BY day, COALESCE(pc, ''), COALESCE(win_user, '') ORDER BY day DESC, img + vid DESC`, from, to);
  const models = await all(
    `SELECT COALESCE(pc, '') AS pc, COALESCE(win_user, '') AS win_user, app, model, SUM(n) AS n, COUNT(*) AS sends
       FROM usage WHERE day BETWEEN ? AND ? AND status = 'sent'
      GROUP BY COALESCE(pc, ''), COALESCE(win_user, ''), app, model ORDER BY n DESC`, from, to);
  const recent = await all("SELECT * FROM usage WHERE day BETWEEN ? AND ? ORDER BY ts DESC LIMIT 300", from, to);

  const img = days.reduce((a, r) => a + r.img, 0);
  const vid = days.reduce((a, r) => a + r.vid, 0);
  const usedPcs = new Set(days.map((r) => pcValue(r.pc, r.win_user))).size;
  const num = (n) => Number(n || 0).toLocaleString("ko-KR");
  const who = (r) => `${esc(r.name || r.email)}<small>${esc(r.email)}</small>`;
  const accounts = (s) => esc(String(s || "").split(",").filter(Boolean).join(", "));
  // PC 칸: 붙인 이름(없으면 PC 이름), 아래 작게 PC 이름 · 윈도 사용자
  const pcCell = (pc, user) => {
    const name = nameOf.get(pcValue(pc, user));
    return `${esc(name || pc || "(PC 이름 없음)")}<small>${esc(name ? pcText(pc, user) : user)}</small>`;
  };
  const pcOption = (p) => {
    const name = nameOf.get(pcValue(p.pc, p.win_user));
    return `<option value="${esc(pcValue(p.pc, p.win_user))}">${esc(name ? `${name} — ${pcText(p.pc, p.win_user)}` : pcText(p.pc, p.win_user))}</option>`;
  };
  const todayCell = (used, limit, app) => (limit === 0 ? `<span class="warn">막음</span>` : `${num(used)} / ${num(limit)}${UNIT[app]}`);
  const limitCell = (l) => (l.daily === 0 ? "막음" : `${num(l.daily)}${UNIT[l.app] || ""}`);
  const setBy = (l) => `${esc(l.set_by || "")}<small>${l.set_at ? esc(kstTime(l.set_at)) : ""}</small>`;
  const appSelect = `<select name="app" aria-label="앱"><option value="nanobanana">이미지 (나노바나나)</option><option value="seedance">영상 (시댄스)</option></select>`;
  const limitInputs = `<input name="daily" type="number" min="0" max="100000" required placeholder="하루 한도" aria-label="하루 한도">
<input name="until" type="date" aria-label="이 날까지 (비우면 계속)" title="이 날까지 (비우면 계속)">
<input name="note" maxlength="200" placeholder="메모 (이유)" aria-label="메모">`;
  const none = `<p class="empty">이 기간에는 기록이 없습니다.</p>`;

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
.nform{flex-wrap:nowrap;gap:6px}.nform input{width:128px;padding:5px 8px;font-size:13px}button.small{padding:5px 10px;font-size:12px}.warn{color:var(--warn);font-weight:700}
@media (max-width:760px){.lform{grid-template-columns:1fr 1fr}}
</style></head><body><div class="wrap">
<header><div><h1>프리윌 스튜디오 MCP 사용 기록</h1><div class="sub">MCP 로 앱에 보낸 생성만 기록됩니다(앱에서 직접 만든 것은 각 앱의 집계). 한도는 PC(PC 이름 · 윈도 사용자) 기준 · 날짜는 한국 시간 · 보는 사람 ${esc(viewer)}</div></div>
<form method="get" action="/admin"><input type="date" name="from" value="${from}"> ~ <input type="date" name="to" value="${to}"><button>보기</button>
<a class="btn ghost" href="/admin/csv?from=${from}&to=${to}">CSV</a></form></header>
<div class="kpis"><div class="kpi"><b>${num(img)}장</b><span>나노바나나 이미지</span></div><div class="kpi"><b>${num(vid)}개</b><span>시댄스 영상</span></div>
<div class="kpi"><b>${num(usedPcs)}대</b><span>쓴 PC</span></div><div class="kpi"><b>하루 ${num(LIMITS.nanobanana)}장 · ${num(LIMITS.seedance)}개</b><span>PC 한 대 기본 한도 (아래에서 PC별로 조정)</span></div></div>
${msg ? `<div class="notice">${esc(msg)}</div>` : ""}
<section><h2>PC별 오늘 · 이름</h2>
<p class="hint">PC 한 대 = PC 이름 + 윈도 사용자. 사람 이름을 붙이면 모든 표에 그 이름으로 보인다 — 한 사람이 PC 여러 대를 쓰면 같은 이름을 붙인다. 이름을 비우고 저장하면 지운다. '연결 계정'은 그 PC 에서 커넥터에 로그인한 회사 구글 계정이다.</p>
${pcs.length ? `<div class="scroll"><table><thead><tr><th>PC</th><th>연결 계정</th><th class="n">오늘 이미지</th><th class="n">오늘 영상</th><th class="n">기간 이미지</th><th class="n">기간 영상</th><th>마지막</th><th>이름 붙이기</th></tr></thead><tbody>
${pcs.map((p) => `<tr><td>${pcCell(p.pc, p.win_user)}</td><td>${accounts(p.emails)}</td><td class="n">${todayCell(p.img_today, limitOf(p.pc, p.win_user, "nanobanana"), "nanobanana")}</td><td class="n">${todayCell(p.vid_today, limitOf(p.pc, p.win_user, "seedance"), "seedance")}</td><td class="n">${num(p.img)}</td><td class="n">${num(p.vid)}</td><td>${p.last ? esc(kstTime(p.last)) : "—"}</td>
<td><form class="nform" method="post" action="/admin/pc"><input type="hidden" name="pc" value="${esc(pcValue(p.pc, p.win_user))}"><input name="label" maxlength="40" value="${esc(nameOf.get(pcValue(p.pc, p.win_user)) || "")}" placeholder="사람 이름" aria-label="${esc(pcText(p.pc, p.win_user))} 이름"><button class="small" name="action" value="name">저장</button></form></td></tr>`).join("")}
</tbody></table></div>` : `<p class="empty">아직 MCP 로 보낸 PC 가 없다.</p>`}
</section>
<section><h2>PC별 한도 조정</h2>
<p class="hint">기본은 PC 한 대 하루 이미지 ${num(LIMITS.nanobanana)}장 · 영상 ${num(LIMITS.seedance)}개. 여기 적은 PC 만 다르게 적용된다. 0 이면 그 PC 는 MCP 로 보내지 못한다. 기간을 비우면 계속, 날짜를 넣으면 그날까지(한국 날짜).</p>
${pcs.length ? `<form class="lform" method="post" action="/admin/pc">
<select name="pc" required aria-label="PC">${pcs.map(pcOption).join("")}</select>
${appSelect}
${limitInputs}
<button name="action" value="set">저장</button>
</form>` : `<p class="empty">MCP 로 보낸 PC 가 생기면 여기서 고를 수 있다.</p>`}
${pcLimits.length ? `<div class="scroll"><table><thead><tr><th>PC</th><th>앱</th><th class="n">하루 한도</th><th>기간</th><th>메모</th><th>정한 사람 · 시각</th><th></th></tr></thead><tbody>
${pcLimits.map((l) => `<tr${l.until && l.until < today ? ' class="cancel"' : ""}><td>${pcCell(l.pc, l.win_user)}</td><td>${esc(WHAT[l.app] || l.app)}</td><td class="n">${limitCell(l)}</td><td>${l.until ? `${esc(l.until)}까지` : "계속"}</td><td>${esc(l.note || "")}</td><td>${setBy(l)}</td>
<td><form class="inline" method="post" action="/admin/pc"><input type="hidden" name="pc" value="${esc(pcValue(l.pc, l.win_user))}"><input type="hidden" name="app" value="${esc(l.app)}"><button class="link" name="action" value="clear">기본으로</button></form></td></tr>`).join("")}
</tbody></table></div>` : `<p class="empty">조정한 PC 가 없다 — 모두 기본 한도.</p>`}
</section>
<section><h2>계정 전체 상한 (선택)</h2>
<p class="hint">기본은 상한 없음 — PC별 한도만 센다. 여기 적은 계정(커넥터에 로그인한 회사 구글 계정)은 그 계정으로 보낸 모든 PC 의 합계가 이 안이어야 한다. 0 이면 그 계정은 MCP 로 보내지 못한다.</p>
<form class="lform" method="post" action="/admin/limits">
<input name="email" type="email" required placeholder="이름@${esc(env.ALLOWED_DOMAIN)}" aria-label="회사 이메일">
${appSelect}
${limitInputs}
<button name="action" value="set">저장</button>
</form>
${caps.length ? `<div class="scroll"><table><thead><tr><th>계정</th><th>앱</th><th class="n">하루 상한</th><th>기간</th><th>메모</th><th>정한 사람 · 시각</th><th></th></tr></thead><tbody>
${caps.map((l) => `<tr${l.until && l.until < today ? ' class="cancel"' : ""}><td>${esc(l.email)}</td><td>${esc(WHAT[l.app] || l.app)}</td><td class="n">${limitCell(l)}</td><td>${l.until ? `${esc(l.until)}까지` : "계속"}</td><td>${esc(l.note || "")}</td><td>${setBy(l)}</td>
<td><form class="inline" method="post" action="/admin/limits"><input type="hidden" name="email" value="${esc(l.email)}"><input type="hidden" name="app" value="${esc(l.app)}"><button class="link" name="action" value="clear">없애기</button></form></td></tr>`).join("")}
</tbody></table></div>` : `<p class="empty">상한을 정한 계정이 없다.</p>`}
</section>
<section><h2>날짜 · PC별</h2>${days.length ? `<div class="scroll"><table><thead><tr><th>날짜</th><th>PC</th><th>연결 계정</th><th class="n">이미지</th><th class="n">영상</th><th class="n">보낸 횟수</th></tr></thead><tbody>
${days.map((r) => `<tr><td>${esc(r.day)}</td><td>${pcCell(r.pc, r.win_user)}</td><td>${accounts(r.emails)}</td><td class="n">${num(r.img)}</td><td class="n">${num(r.vid)}</td><td class="n">${num(r.sends)}</td></tr>`).join("")}
</tbody></table></div>` : none}</section>
<section><h2>PC · 모델별 (기간 합계)</h2>${models.length ? `<div class="scroll"><table><thead><tr><th>PC</th><th>앱</th><th>모델</th><th class="n">개수</th><th class="n">보낸 횟수</th></tr></thead><tbody>
${models.map((r) => `<tr><td>${pcCell(r.pc, r.win_user)}</td><td>${esc(WHAT[r.app] || r.app)}</td><td>${esc(r.model || "(앱 설정)")}</td><td class="n">${num(r.n)}</td><td class="n">${num(r.sends)}</td></tr>`).join("")}
</tbody></table></div>` : none}</section>
<section><h2>최근 보낸 것 (최대 300건)</h2>${recent.length ? `<div class="scroll"><table><thead><tr><th>시간</th><th>PC</th><th>연결 계정</th><th>IP</th><th>앱</th><th>종류</th><th>모델</th><th>해상도</th><th class="n">개수</th><th>과금</th><th>프로젝트</th><th>작업</th></tr></thead><tbody>
${recent.map((r) => `<tr class="${r.status === "cancelled" ? "cancel" : ""}"><td>${esc(kstTime(r.ts))}</td><td>${pcCell(r.pc || "", r.win_user || "")}</td><td>${who(r)}</td><td>${esc(r.ip || "")}</td><td>${esc(WHAT[r.app] || r.app)}</td><td>${esc(r.kind || "")}</td><td>${esc(r.model || "(앱 설정)")}</td><td>${esc(r.resolution || "")}</td><td class="n">${num(r.n)}</td><td>${esc(r.billing || "")}</td><td>${esc(r.project || "")}</td><td>${esc(r.job || "")}</td></tr>`).join("")}
</tbody></table></div>` : none}</section>
</div></body></html>`;
  return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
