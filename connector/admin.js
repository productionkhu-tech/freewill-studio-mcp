// 관리자 화면 — 탭 다섯: 개요(그래프) · 사람·PC · 기록(거르기·정렬·쪽 나누기) · 모델 · 한도.
//
// 화면은 서버에서 그린다. 그래프도 여기서 SVG 로 그린다 — 관리자 화면에 남의 스크립트를 싣지 않는다.
// 표 머리 눌러 정렬하기 · 표 안 검색만 맨 아래 작은 인라인 스크립트가 한다. 기록 탭은 사람이 많아져도 되게 서버에서 거르고 쪽으로 나눈다.
// 사람 = 관리자가 장치에 붙인 이름(같은 이름이면 PC 여러 대를 합쳐 본다), 이름이 없으면 PC 이름 · 윈도 사용자.

import { page } from "./auth.js";
import { LIMITS, UNIT, WHAT, inForce, kstDay, text } from "./usage.js";
import { logEvent } from "./events.js";

const TABS = [["overview", "개요"], ["devices", "사람 · PC"], ["accounts", "계정"], ["records", "기록"], ["models", "모델"], ["limits", "한도"]];
const KIND = { blocked_device: "막힌 PC 가 보내기 시도", late_settle: "늦게 무르기 시도", device_reset: "장치 ID 를 새로 만듦", blocked_login: "막힌 계정이 연결 시도", blocked_usage: "막힌 계정이 보내기 시도" };
const APPS = ["nanobanana", "seedance"];
const PAGE_SIZES = [20, 50, 100, 200];   // 기록 탭 N개씩
const PALETTE = ["#2453e6", "#0f9d8a", "#e0892b", "#9b51e0", "#d64545", "#3a8fd6"];
const OTHER = "#b8bfca";
const SORTS = { ts: "id", n: "n", app: "app", model: "model", email: "email", ip: "ip", pc: "pc", job: "job" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const num = (n) => Number(n || 0).toLocaleString("ko-KR");
const kstTime = (ms) => new Date(ms + 9 * 3600e3).toISOString().slice(5, 16).replace("T", " ");
const addDays = (day, k) => new Date(Date.parse(`${day}T00:00:00Z`) + k * 864e5).toISOString().slice(0, 10);
const spanDays = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5) + 1;
const mondayOf = (day) => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));
const qs = (o) => `?${new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString()}`;
const modelName = (m) => m || "(앱 설정)";
const amount = (app, daily) => (daily === 0 ? "막음(0)" : `${daily}${UNIT[app]}`);
// "15장으로" · "250개(10-20까지)로" — 받침에 맞춘 조사
const amountTo = (app, daily, until) => {
  const a = amount(app, daily);
  return `${a}${until ? `(${until}까지)` : ""}${/[장)]$/.test(a) ? "으로" : "로"}`;
};
// 한국 날짜 범위 → ts 범위(기록 탭 · CSV 가 시간 색인을 쓴다)
const tsRange = (from, to) => [Date.parse(`${from}T00:00:00+09:00`), Date.parse(`${to}T00:00:00+09:00`) + 864e5];
const devName = (d) => (d ? `${d.pc || "(PC 이름 없음)"}${d.win_user ? ` · ${d.win_user}` : ""}` : "(모르는 장치)");

// ---------------------------------------------------------------- 입구

export async function admin(request, env, viewer) {
  const url = new URL(request.url);
  if (url.pathname === "/admin/device" && request.method === "POST") return setDevice(request, env, viewer);
  if (url.pathname === "/admin/limits" && request.method === "POST") return setAccountCap(request, env, viewer);
  if (url.pathname === "/admin/account" && request.method === "POST") return setAccount(request, env, viewer);

  const sp = url.searchParams;
  const today = kstDay();
  let to = isDay(sp.get("to")) ? sp.get("to") : today;
  let from = isDay(sp.get("from")) ? sp.get("from") : addDays(to, -13);
  if (from > to) [from, to] = [to, from];
  const db = env.USAGE_DB;
  const all = async (sql, ...a) => (await db.prepare(sql).bind(...a).all()).results || [];
  const devices = await all("SELECT * FROM devices ORDER BY last_ts DESC");
  const dev = new Map(devices.map((d) => [d.id, d]));
  const ctx = { env, db, all, sp, from, to, today, viewer, devices, dev };
  ctx.person = (id) => dev.get(id)?.label || devName(dev.get(id));

  if (url.pathname === "/admin/csv") return csv(ctx);
  if (url.pathname !== "/admin") return page(404, "없는 화면", "관리자 화면은 /admin 입니다.");
  const tab = TABS.some(([k]) => k === sp.get("tab")) ? sp.get("tab") : "overview";
  const body = await { overview, devices: devicesTab, accounts: accountsTab, records, models, limits: limitsTab }[tab](ctx);
  return new Response(shell(ctx, tab, body), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

// ---------------------------------------------------------------- 폼 (관리자 화면에서만)

const back = (m, tab) => new Response(null, { status: 303, headers: { Location: `/admin${qs({ tab, msg: m })}` } });
const done = async (env, viewer, kind, m, tab) => { await logEvent(env, `admin.${kind}`, { email: viewer, detail: m }); return back(m, tab); };
const tabOf = (f, fallback) => (TABS.some(([k]) => k === f.get("tab")) ? String(f.get("tab")) : fallback);
function fromAdminPage(request, env) {
  const origin = request.headers.get("Origin");
  return !origin || origin === (env.PUBLIC_ORIGIN || new URL(request.url).origin);
}
function limitFields(f) {
  const daily = Math.round(Number(f.get("daily")));
  if (!(daily >= 0 && daily <= 100000)) return null;
  return { daily, until: isDay(f.get("until")) ? String(f.get("until")) : null, note: text(f.get("note")) };
}

// 장치에 사람 이름 붙이기 · 장치 한도 저장·되돌리기
async function setDevice(request, env, viewer) {
  if (!fromAdminPage(request, env)) return page(403, "다른 곳에서 온 요청", "관리자 화면에서 다시 해 주세요.");
  const f = await request.formData();
  const db = env.USAGE_DB;
  const action = String(f.get("action") || "");
  const tab = tabOf(f, ["name", "block", "unblock"].includes(action) ? "devices" : "limits");
  const d = await db.prepare("SELECT * FROM devices WHERE id = ?").bind(String(f.get("device") || "")).first();
  if (!d) return back("PC 를 골라 주세요.", tab);
  const who = devName(d);
  if (action === "name") {
    const label = String(f.get("label") || "").trim().slice(0, 40);
    await db.prepare("UPDATE devices SET label = ?, label_by = ?, label_at = ? WHERE id = ?").bind(label || null, viewer, Date.now(), d.id).run();
    return done(env, viewer, "name", label ? `${who} 에 '${label}' 이름을 붙였다.` : `${who} 의 이름을 지웠다.`, tab);
  }
  // PC 막기 = 두 앱 모두 하루 한도 0(어느 계정으로도 못 보냄). 풀기 = 두 앱 모두 기본 한도로.
  if (action === "block" || action === "unblock") {
    await db.batch(Object.keys(LIMITS).map((app) => (action === "block"
      ? db.prepare(`INSERT INTO device_limits (device, app, daily, until, note, set_by, set_at) VALUES (?, ?, 0, NULL, 'PC 막음', ?, ?)
          ON CONFLICT (device, app) DO UPDATE SET daily = 0, until = NULL, note = 'PC 막음', set_by = excluded.set_by, set_at = excluded.set_at`).bind(d.id, app, viewer, Date.now())
      : db.prepare("DELETE FROM device_limits WHERE device = ? AND app = ?").bind(d.id, app))));
    return done(env, viewer, action === "block" ? "device_block" : "device_unblock",
      action === "block" ? `${who} — PC 를 막았다. 이 PC 에서는 어느 계정으로도 MCP 로 보내지 못한다.` : `${who} — PC 막기를 풀었다(기본 한도).`, tab);
  }
  const app = String(f.get("app") || "");
  if (!LIMITS[app]) return back("앱을 골라 주세요.", tab);
  if (action === "clear") {
    await db.prepare("DELETE FROM device_limits WHERE device = ? AND app = ?").bind(d.id, app).run();
    return done(env, viewer, "device_limit", `${who} 의 ${WHAT[app]} 한도를 기본(${LIMITS[app]}${UNIT[app]})으로 되돌렸다.`, tab);
  }
  const l = limitFields(f);
  if (!l) return back("하루 한도는 0 ~ 100,000 사이 숫자로 적어 주세요.", tab);
  await db.prepare(
    `INSERT INTO device_limits (device, app, daily, until, note, set_by, set_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (device, app) DO UPDATE SET daily = excluded.daily, until = excluded.until, note = excluded.note,
       set_by = excluded.set_by, set_at = excluded.set_at`,
  ).bind(d.id, app, l.daily, l.until, l.note, viewer, Date.now()).run();
  return done(env, viewer, "device_limit", `${who} 의 ${WHAT[app]} 하루 한도를 ${amountTo(app, l.daily, l.until)} 정했다.`, tab);
}

// 계정 전체 상한 저장·없애기
async function setAccountCap(request, env, viewer) {
  if (!fromAdminPage(request, env)) return page(403, "다른 곳에서 온 요청", "관리자 화면에서 다시 해 주세요.");
  const f = await request.formData();
  const tab = tabOf(f, "limits");
  const email = String(f.get("email") || "").trim().toLowerCase();
  const app = String(f.get("app") || "");
  const domain = String(env.ALLOWED_DOMAIN || "").toLowerCase();
  if (!LIMITS[app]) return back("앱을 골라 주세요.", tab);
  if (!/^[^@\s]+@[^@\s]+$/.test(email) || !email.endsWith(`@${domain}`)) return back(`회사 이메일(@${domain})을 적어 주세요.`, tab);
  if (f.get("action") === "clear") {
    await env.USAGE_DB.prepare("DELETE FROM limits WHERE email = ? AND app = ?").bind(email, app).run();
    return done(env, viewer, "account_cap", `${email} 계정 전체 ${WHAT[app]} 상한을 없앴다 — PC별 한도만 센다.`, tab);
  }
  const l = limitFields(f);
  if (!l) return back("하루 한도는 0 ~ 100,000 사이 숫자로 적어 주세요.", tab);
  await env.USAGE_DB.prepare(
    `INSERT INTO limits (email, app, daily, until, note, set_by, set_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (email, app) DO UPDATE SET daily = excluded.daily, until = excluded.until, note = excluded.note,
       set_by = excluded.set_by, set_at = excluded.set_at`,
  ).bind(email, app, l.daily, l.until, l.note, viewer, Date.now()).run();
  return done(env, viewer, "account_cap", `${email} 계정 전체 ${WHAT[app]} 하루 상한을 ${amountTo(app, l.daily, l.until)} 정했다.`, tab);
}

// 계정: 커넥터 연결 끊기(다시 로그인하면 또 씀) · 막기(연결을 끊고 다시 연결·보내기도 못 함) · 풀기
async function setAccount(request, env, viewer) {
  if (!fromAdminPage(request, env)) return page(403, "다른 곳에서 온 요청", "관리자 화면에서 다시 해 주세요.");
  const f = await request.formData();
  const email = String(f.get("email") || "").trim().toLowerCase();
  const domain = String(env.ALLOWED_DOMAIN || "").toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(email) || !email.endsWith(`@${domain}`)) return back(`회사 이메일(@${domain})을 적어 주세요.`, "accounts");
  const revokeAll = async () => {
    let n = 0;
    try {
      const r = await env.OAUTH_PROVIDER.listUserGrants(email, { limit: 100 });
      for (const g of r.items || []) { await env.OAUTH_PROVIDER.revokeGrant(g.id, email); n++; }
    } catch {}
    return n;
  };
  const action = String(f.get("action") || "");
  if (action === "revoke") {
    const n = await revokeAll();
    return done(env, viewer, "revoke", `${email} 의 커넥터 연결 ${n}개를 끊었다 — 다시 로그인하면 또 쓸 수 있다.`, "accounts");
  }
  if (action === "block") {
    await env.USAGE_DB.prepare(
      `INSERT INTO accounts (email, blocked, blocked_by, blocked_at) VALUES (?, 1, ?, ?)
       ON CONFLICT (email) DO UPDATE SET blocked = 1, blocked_by = excluded.blocked_by, blocked_at = excluded.blocked_at`,
    ).bind(email, viewer, Date.now()).run();
    const n = await revokeAll();
    return done(env, viewer, "block", `${email} 을 막았다 — 연결 ${n}개를 끊었고, 다시 연결하거나 보내지 못한다.`, "accounts");
  }
  if (action === "unblock") {
    await env.USAGE_DB.prepare("UPDATE accounts SET blocked = 0, blocked_by = ?, blocked_at = ? WHERE email = ?").bind(viewer, Date.now(), email).run();
    return done(env, viewer, "unblock", `${email} 을 풀었다 — 다시 연결해서 쓸 수 있다.`, "accounts");
  }
  return back("할 일을 골라 주세요.", "accounts");
}

// ---------------------------------------------------------------- 기록 거르기 (기록 탭 · CSV 공통)

function filtersOf(sp) {
  const who = String(sp.get("who") || "");
  return {
    who: /^[dp]:/.test(who) ? who.slice(0, 120) : "",
    app: APPS.includes(sp.get("app")) ? sp.get("app") : "",
    model: String(sp.get("model") || "").slice(0, 120),
    status: ["sent", "cancelled"].includes(sp.get("status")) ? sp.get("status") : "",
    q: String(sp.get("q") || "").trim().slice(0, 80),
    // '정렬' 고르기(order = "n:desc")가 있으면 그것, 아니면 표 머리 링크의 sort · dir
    ...(() => {
      const [os, od] = String(sp.get("order") || "").split(":");
      const sort = SORTS[os] ? os : SORTS[sp.get("sort")] ? sp.get("sort") : "ts";
      const dir = (SORTS[os] ? od : sp.get("dir")) === "asc" ? "asc" : "desc";
      return { sort, dir };
    })(),
    size: PAGE_SIZES.includes(Number(sp.get("size"))) ? Number(sp.get("size")) : 50,
    page: Math.max(1, Math.min(100000, Math.round(Number(sp.get("page")) || 1))),
  };
}
// 기간 → 원본 id 범위 — 원본에는 색인이 없어서(쓰기를 아끼려고) 하루 요약 표가 기억하는 그날의 첫 · 끝 id 로 범위를 잡는다.
async function idRangeOf(ctx) {
  const r = await ctx.db.prepare("SELECT MIN(first_id) AS a, MAX(last_id) AS b FROM usage_daily WHERE day BETWEEN ? AND ?").bind(ctx.from, ctx.to).first();
  return r && r.a !== null && r.a !== undefined ? [Number(r.a), Number(r.b)] : [0, -1];
}
function whereOf(ctx, f, range) {
  const where = ["id BETWEEN ? AND ?", "ts >= ? AND ts < ?"];
  const binds = [...range, ...tsRange(ctx.from, ctx.to)];
  if (f.who.startsWith("d:")) { where.push("device = ?"); binds.push(f.who.slice(2)); }
  if (f.who.startsWith("p:")) { where.push("device IN (SELECT id FROM devices WHERE label = ?)"); binds.push(f.who.slice(2)); }
  if (f.app) { where.push("app = ?"); binds.push(f.app); }
  if (f.model === "~") where.push("(model IS NULL OR model = '')");
  else if (f.model) { where.push("model = ?"); binds.push(f.model); }
  if (f.status) { where.push("status = ?"); binds.push(f.status); }
  if (f.q) {
    where.push("(job LIKE ? OR project LIKE ? OR billing LIKE ? OR ip LIKE ? OR email LIKE ? OR pc LIKE ? OR win_user LIKE ? OR model LIKE ?)");
    binds.push(...Array(8).fill(`%${f.q}%`));
  }
  return { where: where.join(" AND "), binds };
}

async function csv(ctx) {
  const f = filtersOf(ctx.sp);
  const { where, binds } = whereOf(ctx, f, await idRangeOf(ctx));
  const rows = await ctx.all(`SELECT * FROM usage WHERE ${where} ORDER BY id LIMIT 50000`, ...binds);
  const cols = ["day", "ts", "person", "email", "name", "pc", "win_user", "device", "ip", "app", "kind", "model", "resolution", "n", "billing", "project", "job", "status"];
  const cell = (v) => (/[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ""));
  const value = (r, c) => (c === "ts" ? kstTime(r.ts) : c === "person" ? ctx.dev.get(r.device)?.label || "" : r[c]);
  const body = String.fromCharCode(0xfeff) + [cols.join(","), ...rows.map((r) => cols.map((c) => cell(value(r, c))).join(","))].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="freewill-usage_${ctx.from}_${ctx.to}.csv"`, "Cache-Control": "no-store" },
  });
}

// ---------------------------------------------------------------- 그래프 (SVG · HTML)

const niceMax = (v) => {
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return Math.max(2, (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p);
};

// 날짜(또는 주)별 막대 — 사람마다 색을 쌓는다. 막대에 마우스를 올리면 그 사람 값, 위에는 합계.
function columnChart(buckets, series, unit, labelOf, title) {
  const W = 760, H = 230, L = 44, R = 8, T = 16, B = 28;
  const totals = buckets.map((k) => series.reduce((a, s) => a + (s.values.get(k) || 0), 0));
  if (!totals.some(Boolean)) return `<p class="empty">이 기간에는 ${esc(title)} 기록이 없다.</p>`;
  const max = niceMax(Math.max(...totals));
  const ih = H - T - B;
  const step = (W - L - R) / buckets.length;
  const bw = Math.max(2, Math.min(34, step * 0.72));
  const y = (v) => T + ih - (v / max) * ih;
  const every = Math.ceil(buckets.length / 12);
  let svg = "";
  for (const g of [0, max / 2, max]) {
    svg += `<line x1="${L}" x2="${W - R}" y1="${y(g).toFixed(1)}" y2="${y(g).toFixed(1)}" class="grid"/><text x="${L - 6}" y="${(y(g) + 4).toFixed(1)}" class="ax" text-anchor="end">${num(g)}</text>`;
  }
  buckets.forEach((k, i) => {
    const x = L + i * step + (step - bw) / 2;
    let acc = 0;
    for (const s of series) {
      const v = s.values.get(k) || 0;
      if (!v) continue;
      const h = (v / max) * ih;
      svg += `<rect x="${x.toFixed(1)}" y="${(y(acc) - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, 0.8).toFixed(1)}" fill="${s.color}"><title>${esc(labelOf(k))} · ${esc(s.name)} ${num(v)}${unit}</title></rect>`;
      acc += v;
    }
    if (totals[i] && bw >= 16) svg += `<text x="${(x + bw / 2).toFixed(1)}" y="${(y(totals[i]) - 4).toFixed(1)}" class="val" text-anchor="middle">${num(totals[i])}</text>`;
    if (i % every === 0) svg += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 9}" class="ax" text-anchor="middle">${esc(labelOf(k))}</text>`;
  });
  const legend = series.map((s) => ({ ...s, total: [...s.values.values()].reduce((a, v) => a + v, 0) })).filter((s) => s.total).sort((a, b) => b.total - a.total);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(title)} — 막대마다 마우스를 올리면 사람별 값"><desc>${esc(title)}</desc>${svg}</svg>
<ul class="legend">${legend.map((s) => `<li><i style="background:${s.color}"></i>${esc(s.name)} <b>${num(s.total)}${unit}</b></li>`).join("")}</ul>`;
}

// 가로 막대 순위 — 값 큰 순, 값은 막대 옆에 글로.
function barList(items, unit, more = "", cls = "", step = 0) {
  if (!items.length) return `<p class="empty">이 기간에는 기록이 없다.</p>`;
  const max = Math.max(...items.map((i) => i.n), 1);
  return `<ol class="bars ${cls}"${step ? ` data-step="${step}"` : ""}>${items.map((i, k) => `<li><span class="no">${k + 1}</span><span class="bl" title="${esc(i.name)}">${esc(i.name)}${i.sub ? `<small>${esc(i.sub)}</small>` : ""}</span><span class="bt"><span class="bf" style="width:${((i.n / max) * 100).toFixed(1)}%;background:${i.color || "var(--accent)"}"></span></span><span class="bv">${num(i.n)}${unit}</span></li>`).join("")}</ol>${more || ""}`;
}

// 오늘 쓴 양 / 한도 — 숫자와 막대(80% 넘으면 주황, 다 차면 빨강)
function meter(used, limit, app) {
  if (limit === 0) return `<span class="warn">막음</span>`;
  const r = Math.min(1, used / limit);
  return `<span class="meter"><span class="mt"><span class="mf${r >= 1 ? " full" : r >= 0.8 ? " near" : ""}" style="width:${(r * 100).toFixed(1)}%"></span></span>${num(used)} / ${num(limit)}${UNIT[app]}</span>`;
}

// ---------------------------------------------------------------- 탭: 개요

async function overview(ctx) {
  const { all, from, to, today } = ctx;
  const rows = await all(
    `SELECT day, device, app, SUM(n) AS n, SUM(sends) AS sends FROM usage_daily
      WHERE day BETWEEN ? AND ? GROUP BY day, device, app HAVING SUM(sends) > 0`, from, to);
  const todayRows = await all("SELECT device, app, SUM(n) AS n FROM usage_daily WHERE day = ? GROUP BY device, app HAVING SUM(sends) > 0", today);
  const modelRows = await all(
    `SELECT app, model, SUM(n) AS n FROM usage_daily
      WHERE day BETWEEN ? AND ? GROUP BY app, model HAVING SUM(sends) > 0 ORDER BY n DESC`, from, to);
  const devLimits = await all("SELECT * FROM device_limits");

  const sumApp = (list, app) => list.filter((r) => r.app === app).reduce((a, r) => a + r.n, 0);
  const people = new Map();   // 사람 → { img, vid, sends, devices }
  for (const r of rows) {
    const p = ctx.person(r.device);
    const o = people.get(p) || { img: 0, vid: 0, sends: 0, devices: new Set() };
    o[r.app === "nanobanana" ? "img" : "vid"] += r.n;
    o.sends += r.sends;
    o.devices.add(r.device);
    people.set(p, o);
  }
  const ranked = [...people.entries()].sort((a, b) => b[1].sends - a[1].sends);
  const color = new Map(ranked.slice(0, PALETTE.length).map(([p], i) => [p, PALETTE[i]]));

  // 62일이 넘으면 주 단위로 묶는다
  const weekly = spanDays(from, to) > 62;
  const bucketOf = (day) => (weekly ? mondayOf(day) : day);
  const buckets = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (!buckets.includes(bucketOf(d))) buckets.push(bucketOf(d));
  const labelOf = (k) => (weekly ? `${k.slice(5)}주` : k.slice(5));
  const seriesFor = (app) => {
    const by = new Map();
    for (const r of rows.filter((x) => x.app === app)) {
      const p = color.has(ctx.person(r.device)) ? ctx.person(r.device) : "기타";
      const m = by.get(p) || new Map();
      m.set(bucketOf(r.day), (m.get(bucketOf(r.day)) || 0) + r.n);
      by.set(p, m);
    }
    return [...color.keys(), "기타"].filter((p) => by.has(p)).map((p) => ({ name: p, color: color.get(p) || OTHER, values: by.get(p) }));
  };
  const rank = (key, unit) => {
    const items = ranked.filter(([, o]) => o[key]).sort((a, b) => b[1][key] - a[1][key])
      .map(([p, o]) => ({ name: p, sub: o.devices.size > 1 ? `PC ${o.devices.size}대` : "", n: o[key], color: color.get(p) || OTHER }));
    return barList(items.slice(0, 100), unit, "", "", 5);
  };
  const limitOf = (device, app) => inForce(devLimits.find((l) => l.device === device && l.app === app)) ?? LIMITS[app];
  const near = todayRows.map((r) => ({ ...r, limit: limitOf(r.device, r.app) }))
    .filter((r) => r.limit === 0 || r.n >= r.limit * 0.8).sort((a, b) => b.n / (b.limit || 1) - a.n / (a.limit || 1));
  const img = sumApp(rows, "nanobanana");
  const vid = sumApp(rows, "seedance");
  const sends = rows.reduce((a, r) => a + r.sends, 0);
  const usedDevices = new Set(rows.map((r) => r.device)).size;
  const modelBars = (app) => barList(modelRows.filter((r) => r.app === app).map((r) => ({ name: modelName(r.model), n: r.n })), UNIT[app], "", "wide", 5);

  return `<div class="kpis">
<div class="kpi"><span>나노바나나 이미지</span><b>${num(img)}장</b><em>오늘 ${num(sumApp(todayRows, "nanobanana"))}장</em></div>
<div class="kpi"><span>시댄스 영상</span><b>${num(vid)}개</b><em>오늘 ${num(sumApp(todayRows, "seedance"))}개</em></div>
<div class="kpi"><span>보낸 횟수</span><b>${num(sends)}번</b><em>${num(spanDays(from, to))}일 동안</em></div>
<div class="kpi"><span>쓴 사람 · PC</span><b>${num(people.size)}명</b><em>PC ${num(usedDevices)}대</em></div></div>
<section><h2>${weekly ? "주별" : "일별"} 이미지</h2>${columnChart(buckets, seriesFor("nanobanana"), "장", labelOf, "이미지")}</section>
<section><h2>${weekly ? "주별" : "일별"} 영상</h2>${columnChart(buckets, seriesFor("seedance"), "개", labelOf, "영상")}</section>
<div class="grid2">
<section><h2>사람별 이미지</h2>${rank("img", "장")}</section>
<section><h2>사람별 영상</h2>${rank("vid", "개")}</section>
<section><h2>모델별 이미지</h2>${modelBars("nanobanana")}</section>
<section><h2>모델별 영상</h2>${modelBars("seedance")}</section>
</div>
<section><h2>오늘 한도에 가까운 PC</h2>${near.length ? `<div class="scroll"><table class="sortable" id="neartable" data-size="10"><thead><tr><th class="rn">#</th><th>사람</th><th>PC</th><th>앱</th><th>오늘 / 한도</th></tr></thead><tbody>
${near.map((r) => `<tr><td class="rn"></td><td>${esc(ctx.person(r.device))}</td><td>${esc(devName(ctx.dev.get(r.device)))}</td><td>${esc(WHAT[r.app])}</td><td>${meter(r.n, r.limit, r.app)}</td></tr>`).join("")}
</tbody></table></div>` : `<p class="empty">오늘 한도의 80% 를 넘긴 PC 가 없다.</p>`}</section>
${await watchList(ctx)}`;
}

// 살펴볼 것 — 한도를 피하려는 움직임일 수 있는 것들(이 기간). 사건 기록(events) + 기록에서 바로 보이는 것.
async function watchList(ctx) {
  const { all, from, to } = ctx;
  const startTs = Date.parse(`${from}T00:00:00+09:00`);
  const endTs = Date.parse(`${to}T00:00:00+09:00`) + 864e5;
  const events = await all("SELECT * FROM events WHERE ts >= ? AND ts < ? AND kind NOT LIKE 'admin.%' ORDER BY ts DESC LIMIT 100", startTs, endTs);
  const cancels = await all("SELECT device, SUM(cancels) AS c, SUM(sends) + SUM(cancels) AS t FROM usage_daily WHERE day BETWEEN ? AND ? GROUP BY device", from, to);
  const who = (device, email) => (device ? `${ctx.person(device)}${ctx.dev.get(device)?.label ? ` · ${devName(ctx.dev.get(device))}` : ""}` : email || "");
  const items = events.map((e) => ({ ts: e.ts, kind: KIND[e.kind] || e.kind, who: who(e.device, e.email), detail: [e.detail, e.device ? e.email : ""].filter(Boolean).join(" · ") }));
  for (const d of ctx.devices) {
    if (d.first_ts >= startTs && d.first_ts < endTs && !String(d.id).startsWith("pc:")) items.push({ ts: d.first_ts, kind: "새 PC", who: who(d.id), detail: devName(d) });
    if (d.pc_names) items.push({ ts: null, kind: "PC 이름이 바뀐 적 있음", who: who(d.id), detail: `전 이름: ${d.pc_names}` });
  }
  for (const c of cancels) if (c.c >= 3 && c.c * 5 >= c.t) items.push({ ts: null, kind: "무른 기록이 많음", who: who(c.device), detail: `${c.t}건 중 ${c.c}건 무름` });
  const byPc = new Map();
  for (const d of ctx.devices) if (d.pc) byPc.set(d.pc, [...(byPc.get(d.pc) || []), d]);
  for (const [pc, list] of byPc) {
    const users = [...new Set(list.map((d) => d.win_user))];
    if (users.length > 1) items.push({ ts: null, kind: "같은 PC 이름에 윈도 사용자 여럿", who: pc, detail: users.join(", ") });
  }
  return `<section><h2>살펴볼 것 (${num(items.length)})</h2>
<p class="hint">한도를 피하려는 움직임일 수 있는 것들 — 늦게 무르기(만들고 나서 무르기), 장치 ID 새로 만들기, 새 PC · 새 윈도 사용자, 막힌 계정의 시도. 대부분은 평범한 일이라 사람을 보고 판단한다.</p>
${items.length ? `<div class="scroll"><table class="sortable" id="watchtable" data-size="10" data-search="무엇 · 누구 · 내용 검색"><thead><tr><th class="rn">#</th><th data-k="n" data-pick data-desc="최근 순" data-asc="오래된 순">언제</th><th data-k="t" data-pick>무엇</th><th data-k="t" data-pick>누구 · PC</th><th>내용</th></tr></thead><tbody>
${items.slice(0, 300).map((i) => `<tr><td class="rn"></td><td data-v="${i.ts || 0}">${i.ts ? esc(kstTime(i.ts)) : "—"}</td><td>${esc(i.kind)}</td><td>${esc(i.who)}</td><td>${esc(i.detail || "")}</td></tr>`).join("")}
</tbody></table></div>` : `<p class="empty">살펴볼 것이 없다.</p>`}</section>`;
}

// ---------------------------------------------------------------- 탭: 계정

async function accountsTab(ctx) {
  const { all, from, to, env } = ctx;
  const accts = await all("SELECT * FROM accounts");
  const used = await all(
    `SELECT email, COUNT(DISTINCT device) AS devices,
            SUM(CASE WHEN app = 'nanobanana' THEN n ELSE 0 END) AS img,
            SUM(CASE WHEN app = 'seedance' THEN n ELSE 0 END) AS vid
       FROM usage_daily WHERE day BETWEEN ? AND ? GROUP BY email HAVING SUM(sends) + SUM(cancels) > 0`, from, to);
  const caps = await all("SELECT * FROM limits");
  const A = new Map(accts.map((a) => [a.email, a]));
  const U = new Map(used.map((u) => [u.email, u]));
  const emails = [...new Set([...accts.map((a) => a.email), ...used.map((u) => u.email), ...caps.map((c) => c.email)])];
  const capText = (e) => caps.filter((c) => c.email === e && inForce(c) !== null).map((c) => `${WHAT[c.app]} ${c.daily === 0 ? "막음" : `${num(c.daily)}${UNIT[c.app]}`}`).join(" · ") || "—";
  const order = emails.map((e) => ({ e, a: A.get(e) || {}, u: U.get(e) || {} }))
    .sort((x, y) => (y.a.blocked || 0) - (x.a.blocked || 0) || Math.max(y.a.last_use || 0, y.a.last_login || 0) - Math.max(x.a.last_use || 0, x.a.last_login || 0));
  const confirmText = (m) => ` onsubmit="return confirm('${esc(m)}')"`;
  const rows = order.map(({ e, a, u }) => {
    const actions = [
      a.last_login && !a.blocked ? `<form class="inline" method="post" action="/admin/account"${confirmText(`${e} 의 커넥터 연결을 모두 끊을까요? 다시 로그인하면 또 쓸 수 있어요.`)}><input type="hidden" name="email" value="${esc(e)}"><button class="link" name="action" value="revoke">연결 끊기</button></form>` : "",
      a.blocked
        ? `<form class="inline" method="post" action="/admin/account"><input type="hidden" name="email" value="${esc(e)}"><button class="link ok" name="action" value="unblock">풀기</button></form>`
        : `<form class="inline" method="post" action="/admin/account"${confirmText(`${e} 을 막을까요? 연결이 모두 끊기고, 다시 연결하거나 보내지 못해요.`)}><input type="hidden" name="email" value="${esc(e)}"><button class="link" name="action" value="block">막기</button></form>`,
    ].filter(Boolean).join(" · ");
    return `<tr><td class="rn"></td><td data-v="${esc(a.name || e)}">${esc(a.name || e.split("@")[0])}<small>${esc(e)}</small></td>
<td data-v="${a.last_login || 0}">${a.last_login ? esc(kstTime(a.last_login)) : "—"}<small>${a.logins ? `${num(a.logins)}번 연결` : ""}</small></td>
<td>${esc(a.clients || "—")}</td><td class="n" data-v="${u.img || 0}">${num(u.img)}</td><td class="n" data-v="${u.vid || 0}">${num(u.vid)}</td><td class="n" data-v="${u.devices || 0}">${num(u.devices)}</td>
<td data-v="${a.last_use || 0}">${a.last_use ? esc(kstTime(a.last_use)) : "—"}</td><td>${esc(capText(e))}</td>
<td data-v="${a.blocked ? 1 : 0}">${a.blocked ? `<span class="warn">막힘</span><small>${esc(a.blocked_by || "")} ${a.blocked_at ? esc(kstTime(a.blocked_at)) : ""}</small>` : "쓰는 중"}</td><td>${actions}</td></tr>`;
  });
  return `<section><h2>계정 (${num(emails.length)})</h2>
<p class="hint">커넥터에 로그인한 회사 구글 계정. '연결한 앱'은 로그인에 쓴 앱(Claude · ChatGPT · Codex 등, 로그인은 7일 유지). <b>연결 끊기</b>는 지금 연결만 끊고 다시 로그인하면 또 쓴다. <b>막기</b>는 연결을 끊고 다시 연결도, 이미 받은 스크립트로 보내기도 못 하게 한다(퇴사 · 계정 유출 때). 기간 이미지 · 영상 · PC 는 위 기간 기준.</p>
<form class="lform acc" method="post" action="/admin/account"${confirmText("이 계정을 막을까요?")}><input name="email" type="email" required placeholder="미리 막을 계정 — 이름@${esc(env.ALLOWED_DOMAIN)}" aria-label="막을 회사 이메일"><button name="action" value="block">막기</button></form>
${rows.length ? `<div class="scroll"><table class="sortable" id="accttable" data-size="10" data-search="이름 · 이메일 · 앱 검색"><thead><tr><th class="rn">#</th><th data-k="t" data-pick>계정</th><th data-k="n" data-pick data-desc="최근 연결 순" data-asc="오래된 연결 순">마지막 연결</th><th>연결한 앱</th><th data-k="n" class="n" data-pick>기간 이미지</th><th data-k="n" class="n" data-pick>기간 영상</th><th data-k="n" class="n">PC</th><th data-k="n" data-pick data-desc="최근 사용 순" data-asc="오래된 사용 순">마지막 사용</th><th>계정 상한</th><th data-k="n">상태</th><th></th></tr></thead><tbody>${rows.join("")}</tbody></table></div>` : `<p class="empty">아직 연결한 계정이 없다.</p>`}</section>`;
}

// ---------------------------------------------------------------- 탭: 사람 · PC

async function devicesTab(ctx) {
  const { all, from, to, today } = ctx;
  const stats = await all(
    `SELECT device,
            SUM(CASE WHEN app = 'nanobanana' THEN n ELSE 0 END) AS img,
            SUM(CASE WHEN app = 'seedance' THEN n ELSE 0 END) AS vid,
            SUM(sends) AS sends, GROUP_CONCAT(DISTINCT email) AS emails
       FROM usage_daily WHERE day BETWEEN ? AND ? GROUP BY device`, from, to);
  const todays = await all(
    `SELECT device, SUM(CASE WHEN app = 'nanobanana' THEN n ELSE 0 END) AS img_today, SUM(CASE WHEN app = 'seedance' THEN n ELSE 0 END) AS vid_today
       FROM usage_daily WHERE day = ? GROUP BY device`, today);
  const ipRows = await all("SELECT device, GROUP_CONCAT(ip, ', ') AS ips, COUNT(*) AS c FROM device_ips GROUP BY device");
  const ipsOf = new Map(ipRows.map((r) => [r.device, String(r.ips || "").split(", ").filter(Boolean)]));
  const devLimits = await all("SELECT * FROM device_limits");
  const st = new Map(stats.map((s) => [s.device, s]));
  for (const x of todays) st.set(x.device, { ...(st.get(x.device) || {}), ...x });
  const limitOf = (device, app) => inForce(devLimits.find((l) => l.device === device && l.app === app)) ?? LIMITS[app];
  if (!ctx.devices.length) return `<section><p class="empty">아직 MCP 로 보낸 PC 가 없다.</p></section>`;
  const rows = ctx.devices.map((d) => {
    const s = st.get(d.id) || {};
    const emails = String(s.emails || "").split(",").filter(Boolean).join(", ");
    const ips = ipsOf.get(d.id) || [];
    const li = limitOf(d.id, "nanobanana");
    const lv = limitOf(d.id, "seedance");
    return `<tr><td class="rn"></td>
<td data-v="${esc(d.label || "")}"><form class="nform" method="post" action="/admin/device"><input type="hidden" name="tab" value="devices"><input type="hidden" name="device" value="${esc(d.id)}"><input name="label" maxlength="40" value="${esc(d.label || "")}" placeholder="사람 이름" aria-label="${esc(devName(d))} 사람 이름"><button class="small" name="action" value="name">저장</button></form></td>
<td data-v="${esc(d.pc || "")}"><a href="${qs({ tab: "records", from, to, who: `d:${d.id}` })}" title="이 PC 기록 보기">${esc(d.pc || "(PC 이름 없음)")}</a><small>${esc([d.win_user, d.pc_names ? `전 이름: ${d.pc_names}` : ""].filter(Boolean).join(" · "))}</small></td>
<td>${esc(emails)}</td><td>${esc(d.ip || "")}${ips.length > 1 ? `<small title="${esc(ips.join(", "))}">쓴 IP ${ips.length}개</small>` : ""}</td>
<td data-v="${Number(s.img_today || 0) / (li || 1)}">${meter(Number(s.img_today || 0), li, "nanobanana")}</td>
<td data-v="${Number(s.vid_today || 0) / (lv || 1)}">${meter(Number(s.vid_today || 0), lv, "seedance")}</td>
<td class="n" data-v="${Number(s.img || 0)}">${num(s.img)}</td><td class="n" data-v="${Number(s.vid || 0)}">${num(s.vid)}</td>
<td data-v="${d.last_ts || 0}">${d.last_ts ? esc(kstTime(d.last_ts)) : "—"}</td>
<td data-v="${li === 0 && lv === 0 ? 1 : 0}">${li === 0 && lv === 0
    ? `<span class="warn">막힘</span> <form class="inline" method="post" action="/admin/device"><input type="hidden" name="tab" value="devices"><input type="hidden" name="device" value="${esc(d.id)}"><button class="link ok" name="action" value="unblock">풀기</button></form>`
    : `<form class="inline" method="post" action="/admin/device" onsubmit="return confirm('${esc(`${devName(d)} 를 막을까요? 이 PC 에서는 어느 계정으로도 보내지 못해요.`)}')"><input type="hidden" name="tab" value="devices"><input type="hidden" name="device" value="${esc(d.id)}"><button class="link" name="action" value="block">막기</button></form>`}</td></tr>`;
  });
  return `<section><h2>사람 · PC (${num(ctx.devices.length)}대)</h2>
<p class="hint">한 줄 = PC 한 대의 윈도 사용자. 사람 이름을 붙이면 모든 탭에 그 이름으로 보이고, 같은 이름의 PC 는 개요·모델 탭에서 합쳐진다. 이름을 비우고 저장하면 지운다. PC 이름을 바꿔도 같은 줄로 이어지고 '전 이름'이 남는다. PC 이름을 누르면 그 PC 의 기록만 본다. <b>막기</b>는 그 PC 에서 어느 계정으로도 보내지 못하게 한다(두 앱 모두 한도 0). IP 는 마지막으로 보낸 곳의 공인 IP — 사무실은 모두 같을 수 있고 집 · VPN 이면 바뀐다(한도 · 막기는 IP 와 상관없다). 표 머리를 누르거나 '정렬'에서 고른다.</p>
<div class="scroll"><table class="sortable" id="devtable" data-size="10" data-search="이름 · PC · 계정 · IP 검색"><thead><tr><th class="rn">#</th>
<th data-k="t" data-pick>사람</th><th data-k="t" data-pick>PC · 윈도 사용자</th><th data-k="t">연결 계정</th><th data-k="t">최근 IP</th>
<th data-k="n">오늘 이미지</th><th data-k="n">오늘 영상</th><th data-k="n" class="n" data-pick>기간 이미지</th><th data-k="n" class="n" data-pick>기간 영상</th><th data-k="n" aria-sort="descending" data-pick data-desc="최근 사용 순" data-asc="오래된 사용 순">마지막 사용</th><th data-k="n">막기</th>
</tr></thead><tbody>${rows.join("")}</tbody></table></div></section>`;
}

// ---------------------------------------------------------------- 탭: 기록

// 기록 탭 맨 위 합계 — 검색어가 없으면 하루 요약 표로(몇 줄), 있으면 원본을 2만 건까지만 센다.
async function recordTotals(ctx, f, where, binds) {
  if (f.q) {
    const r = await ctx.db.prepare(`SELECT COUNT(*) AS c,
        COALESCE(SUM(CASE WHEN status = 'sent' AND app = 'nanobanana' THEN n ELSE 0 END), 0) AS img,
        COALESCE(SUM(CASE WHEN status = 'sent' AND app = 'seedance' THEN n ELSE 0 END), 0) AS vid
        FROM (SELECT status, app, n FROM usage WHERE ${where} LIMIT 20001)`).bind(...binds).first();
    return { ...r, capped: Number(r?.c || 0) > 20000 };
  }
  const w = ["day BETWEEN ? AND ?"];
  const b = [ctx.from, ctx.to];
  if (f.who.startsWith("d:")) { w.push("device = ?"); b.push(f.who.slice(2)); }
  if (f.who.startsWith("p:")) { w.push("device IN (SELECT id FROM devices WHERE label = ?)"); b.push(f.who.slice(2)); }
  if (f.app) { w.push("app = ?"); b.push(f.app); }
  if (f.model === "~") w.push("model = ''");
  else if (f.model) { w.push("model = ?"); b.push(f.model); }
  const count = f.status === "sent" ? "sends" : f.status === "cancelled" ? "cancels" : "sends + cancels";
  const none = f.status === "cancelled";
  const r = await ctx.db.prepare(`SELECT COALESCE(SUM(${count}), 0) AS c,
      COALESCE(SUM(CASE WHEN app = 'nanobanana' THEN n ELSE 0 END), 0) AS img,
      COALESCE(SUM(CASE WHEN app = 'seedance' THEN n ELSE 0 END), 0) AS vid FROM usage_daily WHERE ${w.join(" AND ")}`).bind(...b).first();
  return { c: r?.c, img: none ? 0 : r?.img, vid: none ? 0 : r?.vid, capped: false };
}

async function records(ctx) {
  const { db, all, from, to } = ctx;
  const f = filtersOf(ctx.sp);
  const { where, binds } = whereOf(ctx, f, await idRangeOf(ctx));
  const total = await recordTotals(ctx, f, where, binds);
  const pages = Math.max(1, Math.ceil(Number(total?.c || 0) / f.size));
  const pageNo = Math.min(f.page, pages);
  const list = await all(`SELECT * FROM usage WHERE ${where} ORDER BY ${SORTS[f.sort]} ${f.dir === "asc" ? "ASC" : "DESC"}, id DESC LIMIT ? OFFSET ?`,
    ...binds, f.size, (pageNo - 1) * f.size);
  const models = await all("SELECT DISTINCT app, model FROM usage_daily WHERE day BETWEEN ? AND ? ORDER BY app, model", from, to);
  const keep = { tab: "records", from, to, who: f.who, app: f.app, model: f.model, status: f.status, q: f.q, size: f.size === 50 ? "" : f.size };
  const labels = [...new Set(ctx.devices.map((d) => d.label).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
  const opt = (v, label, cur) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(label)}</option>`;
  const sortLink = (key, label, cls = "") => {
    const on = f.sort === key;
    const dir = on && f.dir === "desc" ? "asc" : "desc";
    return `<th class="${cls}"${on ? ` aria-sort="${f.dir === "asc" ? "ascending" : "descending"}"` : ""}><a href="${qs({ ...keep, sort: key, dir })}">${label}${on ? (f.dir === "asc" ? " ▲" : " ▼") : ""}</a></th>`;
  };
  const chip = (v, label) => `<a class="chip${f.app === v ? " on" : ""}" href="${qs({ ...keep, app: v, page: "" })}">${label}</a>`;
  const pageLink = (p, label = p) => (p === pageNo ? `<span class="on">${label}</span>` : `<a href="${qs({ ...keep, sort: f.sort, dir: f.dir, page: p })}">${label}</a>`);
  const around = [...new Set([1, pageNo - 2, pageNo - 1, pageNo, pageNo + 1, pageNo + 2, pages])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const pager = pages > 1 ? `<nav class="pager" aria-label="쪽">${pageNo > 1 ? pageLink(pageNo - 1, "‹ 이전") : ""}${around.map((p, i) => `${i && p - around[i - 1] > 1 ? "<em>…</em>" : ""}${pageLink(p)}`).join("")}${pageNo < pages ? pageLink(pageNo + 1, "다음 ›") : ""}</nav>` : "";
  return `<section><h2>기록</h2>
<form class="filters" method="get" action="/admin"><input type="hidden" name="tab" value="records"><input type="hidden" name="from" value="${from}"><input type="hidden" name="to" value="${to}"><input type="hidden" name="app" value="${esc(f.app)}">
<label>사람 · PC<select name="who"><option value="">전체</option>${labels.length ? `<optgroup label="사람">${labels.map((l) => opt(`p:${l}`, l, f.who)).join("")}</optgroup>` : ""}<optgroup label="PC">${ctx.devices.map((d) => opt(`d:${d.id}`, d.label ? `${d.label} — ${devName(d)}` : devName(d), f.who)).join("")}</optgroup></select></label>
<label>모델<select name="model"><option value="">전체</option>${models.map((m) => opt(m.model || "~", `${WHAT[m.app] || m.app} · ${modelName(m.model)}`, f.model)).join("")}</select></label>
<label>상태<select name="status">${opt("", "전체", f.status)}${opt("sent", "보냄", f.status)}${opt("cancelled", "무름(앱이 거절)", f.status)}</select></label>
<label>검색<input type="search" name="q" value="${esc(f.q)}" placeholder="작업 · 프로젝트 · 과금 · IP · 계정"></label>
<label>정렬<select name="order">${[["ts:desc", "최근 순"], ["ts:asc", "오래된 순"], ["n:desc", "개수 많은 순"], ["pc:asc", "PC 이름순"], ["email:asc", "계정순"], ["model:asc", "모델순"], ["job:asc", "작업 이름순"]].map(([v, l]) => opt(v, l, `${f.sort}:${f.dir}`)).join("")}</select></label>
<label>보기<select name="size">${PAGE_SIZES.map((n) => opt(String(n), `${n}개씩`, String(f.size))).join("")}</select></label>
<button>거르기</button>${f.who || f.model || f.status || f.q || f.app ? `<a class="btn ghost" href="${qs({ tab: "records", from, to })}">모두 지우기</a>` : ""}</form>
<div class="chips">${chip("", "전체")}${chip("nanobanana", "이미지")}${chip("seedance", "영상")}<span class="sum">${num(total?.c)}건${total?.capped ? " 이상" : ""} · 이미지 ${num(total?.img)}장 · 영상 ${num(total?.vid)}개</span>
<a class="btn ghost" href="/admin/csv${qs({ from, to, who: f.who, app: f.app, model: f.model, status: f.status, q: f.q })}">이 조건으로 CSV</a></div>
${list.length ? `<div class="scroll"><table><thead><tr><th class="rn">#</th>${sortLink("ts", "시간")}<th>사람</th>${sortLink("pc", "PC")}${sortLink("email", "연결 계정")}${sortLink("ip", "IP")}${sortLink("app", "앱")}${sortLink("model", "모델")}<th>해상도</th>${sortLink("n", "개수", "n")}<th>과금</th><th>프로젝트</th>${sortLink("job", "작업")}</tr></thead><tbody>
${list.map((r, i) => `<tr class="${r.status === "cancelled" ? "cancel" : ""}"><td class="rn">${(pageNo - 1) * f.size + i + 1}</td><td>${esc(kstTime(r.ts))}</td><td>${esc(ctx.person(r.device))}</td><td>${esc(r.pc || "")}<small>${esc(r.win_user || "")}</small></td><td>${esc(r.email)}</td><td>${esc(r.ip || "")}</td><td>${esc(WHAT[r.app] || r.app)}</td><td>${esc(modelName(r.model))}</td><td>${esc(r.resolution || "")}</td><td class="n">${num(r.n)}</td><td>${esc(r.billing || "")}</td><td>${esc(r.project || "")}</td><td>${esc(r.job || "")}</td></tr>`).join("")}
</tbody></table></div>${pager}` : `<p class="empty">조건에 맞는 기록이 없다.</p>`}</section>`;
}

// ---------------------------------------------------------------- 탭: 모델

async function models(ctx) {
  const { all, from, to } = ctx;
  const rows = await all(
    `SELECT device, app, model, SUM(n) AS n FROM usage_daily
      WHERE day BETWEEN ? AND ? GROUP BY device, app, model HAVING SUM(n) > 0`, from, to);
  const block = (app) => {
    const list = rows.filter((r) => r.app === app);
    if (!list.length) return `<section><h2>${WHAT[app]}</h2><p class="empty">이 기간에는 기록이 없다.</p></section>`;
    const totals = new Map();
    const people = new Map();
    for (const r of list) {
      totals.set(r.model, (totals.get(r.model) || 0) + r.n);
      const p = ctx.person(r.device);
      const m = people.get(p) || new Map();
      m.set(r.model, (m.get(r.model) || 0) + r.n);
      people.set(p, m);
    }
    const cols = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
    const sum = (m) => [...m.values()].reduce((a, v) => a + v, 0);
    const body = [...people.entries()].sort((a, b) => sum(b[1]) - sum(a[1])).map(([p, m]) =>
      `<tr><td class="rn"></td><td>${esc(p)}</td>${cols.map((c) => `<td class="n" data-v="${m.get(c) || 0}">${m.get(c) ? num(m.get(c)) : "<span class=\"dim\">·</span>"}</td>`).join("")}<td class="n" data-v="${sum(m)}"><b>${num(sum(m))}</b></td></tr>`).join("");
    return `<section><h2>${WHAT[app]} — 모델별</h2>${barList(cols.map((c) => ({ name: modelName(c), n: totals.get(c) })), UNIT[app], "", "wide")}
<h3>사람 × 모델 (${UNIT[app]})</h3><div class="scroll"><table class="sortable" id="models-${app}" data-size="10" data-search="사람 검색"><thead><tr><th class="rn">#</th><th data-k="t" data-pick>사람</th>${cols.map((c) => `<th data-k="n" class="n">${esc(modelName(c))}</th>`).join("")}<th data-k="n" class="n" aria-sort="descending" data-pick>합계</th></tr></thead>
<tbody>${body}</tbody><tfoot><tr><td></td><td>합계</td>${cols.map((c) => `<td class="n">${num(totals.get(c))}</td>`).join("")}<td class="n"><b>${num([...totals.values()].reduce((a, v) => a + v, 0))}</b></td></tr></tfoot></table></div></section>`;
  };
  return block("nanobanana") + block("seedance");
}

// ---------------------------------------------------------------- 탭: 한도

async function limitsTab(ctx) {
  const { all, today } = ctx;
  const devLimits = await all("SELECT * FROM device_limits ORDER BY set_at DESC");
  const caps = await all("SELECT * FROM limits ORDER BY email, app");
  const adminLog = await all("SELECT * FROM events WHERE kind LIKE 'admin.%' ORDER BY ts DESC LIMIT 500");
  const appSelect = `<select name="app" aria-label="앱"><option value="nanobanana">이미지 (나노바나나)</option><option value="seedance">영상 (시댄스)</option></select>`;
  const limitInputs = `<input name="daily" type="number" min="0" max="100000" required placeholder="하루 한도" aria-label="하루 한도">
<input name="until" type="date" aria-label="이 날까지 (비우면 계속)" title="이 날까지 (비우면 계속)">
<input name="note" maxlength="200" placeholder="메모 (이유)" aria-label="메모">`;
  const limitCell = (l) => (l.daily === 0 ? "막음" : `${num(l.daily)}${UNIT[l.app] || ""}`);
  const setBy = (l) => `${esc(l.set_by || "")}<small>${l.set_at ? esc(kstTime(l.set_at)) : ""}</small>`;
  const devOptions = ctx.devices.map((d) => `<option value="${esc(d.id)}">${esc(d.label ? `${d.label} — ${devName(d)}` : devName(d))}</option>`).join("");
  return `<section><h2>PC별 한도</h2>
<p class="hint">기본은 PC 한 대 하루 이미지 ${num(LIMITS.nanobanana)}장 · 영상 ${num(LIMITS.seedance)}개. 여기 적은 PC 만 다르게 적용된다. 0 이면 그 PC 는 MCP 로 보내지 못한다. 기간을 비우면 계속, 날짜를 넣으면 그날까지(한국 날짜).</p>
${ctx.devices.length ? `<form class="lform" method="post" action="/admin/device"><input type="hidden" name="tab" value="limits">
<select name="device" required aria-label="PC">${devOptions}</select>${appSelect}${limitInputs}<button name="action" value="set">저장</button></form>` : `<p class="empty">MCP 로 보낸 PC 가 생기면 여기서 고를 수 있다.</p>`}
${devLimits.length ? `<div class="scroll"><table><thead><tr><th class="rn">#</th><th>사람</th><th>PC</th><th>앱</th><th class="n">하루 한도</th><th>기간</th><th>메모</th><th>정한 사람 · 시각</th><th></th></tr></thead><tbody>
${devLimits.map((l, i) => `<tr${l.until && l.until < today ? ' class="cancel"' : ""}><td class="rn">${i + 1}</td><td>${esc(ctx.person(l.device))}</td><td>${esc(devName(ctx.dev.get(l.device)))}</td><td>${esc(WHAT[l.app] || l.app)}</td><td class="n">${limitCell(l)}</td><td>${l.until ? `${esc(l.until)}까지` : "계속"}</td><td>${esc(l.note || "")}</td><td>${setBy(l)}</td>
<td><form class="inline" method="post" action="/admin/device"><input type="hidden" name="tab" value="limits"><input type="hidden" name="device" value="${esc(l.device)}"><input type="hidden" name="app" value="${esc(l.app)}"><button class="link" name="action" value="clear">기본으로</button></form></td></tr>`).join("")}
</tbody></table></div>` : `<p class="empty">조정한 PC 가 없다 — 모두 기본 한도.</p>`}</section>
<section><h2>계정 전체 상한 (선택)</h2>
<p class="hint">기본은 상한 없음 — PC별 한도만 센다. 여기 적은 계정(커넥터에 로그인한 회사 구글 계정)은 그 계정으로 보낸 모든 PC 의 합계가 이 안이어야 한다. 0 이면 그 계정은 MCP 로 보내지 못한다.</p>
<form class="lform" method="post" action="/admin/limits"><input type="hidden" name="tab" value="limits">
<input name="email" type="email" required placeholder="이름@${esc(ctx.env.ALLOWED_DOMAIN)}" aria-label="회사 이메일">${appSelect}${limitInputs}<button name="action" value="set">저장</button></form>
${caps.length ? `<div class="scroll"><table><thead><tr><th class="rn">#</th><th>계정</th><th>앱</th><th class="n">하루 상한</th><th>기간</th><th>메모</th><th>정한 사람 · 시각</th><th></th></tr></thead><tbody>
${caps.map((l, i) => `<tr${l.until && l.until < today ? ' class="cancel"' : ""}><td class="rn">${i + 1}</td><td>${esc(l.email)}</td><td>${esc(WHAT[l.app] || l.app)}</td><td class="n">${limitCell(l)}</td><td>${l.until ? `${esc(l.until)}까지` : "계속"}</td><td>${esc(l.note || "")}</td><td>${setBy(l)}</td>
<td><form class="inline" method="post" action="/admin/limits"><input type="hidden" name="tab" value="limits"><input type="hidden" name="email" value="${esc(l.email)}"><input type="hidden" name="app" value="${esc(l.app)}"><button class="link" name="action" value="clear">없애기</button></form></td></tr>`).join("")}
</tbody></table></div>` : `<p class="empty">상한을 정한 계정이 없다.</p>`}</section>
<section><h2>관리 기록 (최근 500)</h2>${adminLog.length ? `<div class="scroll"><table class="sortable" id="logtable" data-size="10" data-search="관리자 · 한 일 검색"><thead><tr><th class="rn">#</th><th data-k="n" data-pick data-desc="최근 순" data-asc="오래된 순">시각</th><th data-k="t" data-pick>관리자</th><th>한 일</th></tr></thead><tbody>
${adminLog.map((e) => `<tr><td class="rn"></td><td data-v="${e.ts}">${esc(kstTime(e.ts))}</td><td>${esc(e.email || "")}</td><td>${esc(e.detail || "")}</td></tr>`).join("")}
</tbody></table></div>` : `<p class="empty">아직 바꾼 것이 없다.</p>`}</section>`;
}

// ---------------------------------------------------------------- 틀

function shell(ctx, tab, body) {
  const { from, to, today, sp } = ctx;
  const msg = String(sp.get("msg") || "").slice(0, 300);
  const keep = tab === "records" ? filtersOf(sp) : {};
  const presets = [["오늘", today, today], ["7일", addDays(today, -6), today], ["14일", addDays(today, -13), today], ["30일", addDays(today, -29), today], ["이번 달", `${today.slice(0, 8)}01`, today]];
  const hidden = ["who", "app", "model", "status", "q"].filter((k) => keep[k]).map((k) => `<input type="hidden" name="${k}" value="${esc(keep[k])}">`).join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>프리윌 스튜디오 MCP 사용 기록</title>
<style>
:root{--ink:#151a24;--slate:#5c6574;--line:#e2e6ec;--surface:#f3f5f8;--bg:#fff;--accent:#2453e6;--accent-soft:#e8edfd;--warn:#c2410c;--near:#e0892b;--full:#d64545}
*{box-sizing:border-box}body{margin:0;font-family:"Pretendard","Malgun Gothic",sans-serif;color:var(--ink);background:var(--surface);word-break:keep-all;font-size:14px}
a{color:var(--accent)}.wrap{max-width:1240px;margin:0 auto;padding:28px 16px 64px;display:flex;flex-direction:column;gap:20px}
header{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:16px}
h1{font-size:24px;margin:0}h2{font-size:17px;margin:0 0 12px}h3{font-size:14px;margin:20px 0 8px;color:var(--slate)}.sub{color:var(--slate);font-size:13px;margin-top:4px}
form{display:flex;gap:8px;align-items:center;flex-wrap:wrap}input,select{font:inherit;padding:7px 9px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);min-height:36px}
button,.btn{font:inherit;font-weight:700;padding:8px 14px;border-radius:8px;border:0;background:var(--accent);color:#fff;text-decoration:none;cursor:pointer;min-height:36px;display:inline-flex;align-items:center}
.btn.ghost{background:var(--bg);color:var(--ink);border:1px solid var(--line)}button:focus-visible,a:focus-visible,th:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.range{display:flex;flex-direction:column;gap:8px;align-items:flex-end}.presets{display:flex;gap:6px;flex-wrap:wrap}.presets a{font-size:13px;padding:4px 10px;border:1px solid var(--line);border-radius:999px;background:var(--bg);text-decoration:none;color:var(--ink)}
.tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);overflow-x:auto}.tabs a{padding:10px 16px;text-decoration:none;color:var(--slate);font-weight:600;border-bottom:3px solid transparent;white-space:nowrap}.tabs a[aria-current]{color:var(--ink);border-bottom-color:var(--accent)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.kpi{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:4px}.kpi span{color:var(--slate);font-size:13px}.kpi b{font-size:28px;font-variant-numeric:tabular-nums}.kpi em{font-style:normal;color:var(--slate);font-size:13px}
section{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:20px}.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr));gap:20px}.grid2 section{margin:0}
.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap;vertical-align:middle}
th{color:var(--slate);font-weight:600;background:var(--bg);position:sticky;top:0}th a{color:inherit;text-decoration:none}th.n,td.n{text-align:right;font-variant-numeric:tabular-nums}td small{display:block;color:var(--slate);font-size:11px}
table.sortable th[data-k]{cursor:pointer;user-select:none}table.sortable th[aria-sort=ascending]::after{content:" ▲"}table.sortable th[aria-sort=descending]::after{content:" ▼"}
tfoot td{font-weight:700;border-top:2px solid var(--line)}tbody tr:hover{background:#f8f9fb}tr.cancel td{color:#9aa1ad;text-decoration:line-through}.dim{color:#c3c8d1}
.empty{color:var(--slate)}.hint{color:var(--slate);font-size:13px;margin:-4px 0 12px;line-height:1.6}.notice{background:var(--accent-soft);border:1px solid #c9d4f7;border-radius:10px;padding:12px 16px}
.chart{width:100%;height:auto;display:block}.chart .grid{stroke:var(--line)}.chart .ax{fill:var(--slate);font-size:11px}.chart .val{fill:var(--ink);font-size:10px;font-weight:600}
.legend{list-style:none;padding:0;margin:10px 0 0;display:flex;flex-wrap:wrap;gap:6px 16px;font-size:13px}.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px}.legend b{font-variant-numeric:tabular-nums}
.bars{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px}.bars li{display:grid;grid-template-columns:22px minmax(110px,30%) 1fr auto;gap:10px;align-items:center}.bars .no{color:var(--slate);font-size:12px;text-align:right;font-variant-numeric:tabular-nums}.bl{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bl small{display:block;color:var(--slate);font-size:11px}.bars.wide li{grid-template-columns:22px minmax(140px,44%) 1fr auto}
.bt{background:var(--surface);border-radius:4px;height:14px;overflow:hidden}.bf{display:block;height:100%;border-radius:4px}.bv{font-variant-numeric:tabular-nums;font-weight:600}.more{display:inline-block;margin-top:10px;font-size:13px}
.meter{display:inline-flex;align-items:center;gap:8px;font-variant-numeric:tabular-nums}.mt{width:48px;height:6px;background:var(--surface);border-radius:3px;overflow:hidden}.mf{display:block;height:100%;background:var(--accent)}.mf.near{background:var(--near)}.mf.full{background:var(--full)}.warn{color:var(--warn);font-weight:700}
.toolbar{margin-bottom:12px}.toolbar input{width:min(100%,320px)}.filters{margin-bottom:12px;align-items:end}.filters label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--slate)}.filters select{max-width:260px}
.chips{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}.chip{padding:5px 12px;border:1px solid var(--line);border-radius:999px;text-decoration:none;color:var(--ink);background:var(--bg)}.chip.on{background:var(--accent);border-color:var(--accent);color:#fff}.chips .sum{color:var(--slate);margin-left:4px;flex:1}
.pager{display:flex;gap:4px;justify-content:center;margin-top:14px;flex-wrap:wrap}.pager a,.pager span{padding:6px 11px;border:1px solid var(--line);border-radius:8px;text-decoration:none;color:var(--ink);min-width:36px;text-align:center}.pager span.on{background:var(--accent);color:#fff;border-color:var(--accent)}.pager em{padding:6px 4px;color:var(--slate);font-style:normal}
.lform{display:grid;grid-template-columns:2fr 1.2fr 1fr 1fr 2fr auto;gap:8px;margin-bottom:16px}.lform.acc{grid-template-columns:minmax(0,420px) auto;justify-content:start}.link.ok{color:var(--accent)}.lform input,.lform select{min-width:0}.inline{display:inline}.link{background:none;border:0;color:var(--warn);font:inherit;font-weight:700;cursor:pointer;padding:0;min-height:0}
#devtable th,#devtable td{padding:8px 7px}th.rn,td.rn{width:1%;text-align:right;color:var(--slate);font-variant-numeric:tabular-nums;padding-right:4px}.tbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}.tbar input[type=search]{width:min(100%,260px)}.tbar .count{color:var(--slate);margin-left:auto;font-size:13px}.pager button{background:var(--bg);color:var(--ink);border:1px solid var(--line);font-weight:500;min-width:36px;min-height:32px;padding:5px 10px;justify-content:center}.pager button.on{background:var(--accent);color:#fff;border-color:var(--accent)}.morebtn{background:var(--bg);color:var(--ink);border:1px solid var(--line);font-weight:600;margin-top:10px;min-height:32px;padding:5px 12px}.nform{flex-wrap:nowrap;gap:6px}.nform input{width:92px;padding:5px 8px;font-size:13px;min-height:32px}button.small{padding:5px 10px;font-size:12px;min-height:32px}
@media (max-width:760px){.lform{grid-template-columns:1fr 1fr}.range{align-items:stretch}.bars li,.bars.wide li{grid-template-columns:20px minmax(90px,38%) 1fr auto}}
</style></head><body><div class="wrap">
<header><div><h1>프리윌 스튜디오 MCP 사용 기록</h1><div class="sub">MCP 로 앱에 보낸 생성만 기록된다(앱에서 직접 만든 것은 각 앱의 집계). 한도는 PC 기준 · 날짜는 한국 시간 · 보는 사람 ${esc(ctx.viewer)}</div></div>
<div class="range"><form method="get" action="/admin"><input type="hidden" name="tab" value="${tab}">${hidden}<input type="date" name="from" value="${from}" aria-label="시작 날짜"> ~ <input type="date" name="to" value="${to}" aria-label="끝 날짜"><button>보기</button></form>
<div class="presets">${presets.map(([l, a, b]) => `<a href="${qs({ tab, from: a, to: b, who: keep.who, app: keep.app, model: keep.model, status: keep.status, q: keep.q })}">${l}</a>`).join("")}</div></div></header>
<nav class="tabs" aria-label="화면">${TABS.map(([k, l]) => `<a href="${qs({ tab: k, from, to })}"${k === tab ? ' aria-current="page"' : ""}>${l}</a>`).join("")}</nav>
${msg ? `<div class="notice" role="status">${esc(msg)}</div>` : ""}
${body}
</div>
<script>
const keep = { get: (k) => { try { return JSON.parse(localStorage.getItem("fw-admin:" + k) || "null"); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem("fw-admin:" + k, JSON.stringify(v)); } catch (e) {} } };
const make = (tag, props) => Object.assign(document.createElement(tag), props || {});
for (const t of document.querySelectorAll("table.sortable")) {
  const tbody = t.tBodies[0];
  const heads = [...t.tHead.rows[0].cells];
  const numbered = heads[0] && heads[0].classList.contains("rn");
  let order = [...tbody.rows];
  const saved = (t.id && keep.get(t.id)) || {};
  let size = t.dataset.size ? Number(saved.size !== undefined ? saved.size : t.dataset.size) : 0;   // 0 = 전체
  let page = 1;
  let q = "";
  const valueOf = (r, i, isNum) => { const c = r.cells[i]; const v = c.dataset.v !== undefined ? c.dataset.v : c.textContent.trim(); return isNum ? Number(v) || 0 : v; };
  const bar = make("div", { className: "tbar" });
  const count = make("span", { className: "count" });
  const pager = make("nav", { className: "pager" });
  pager.setAttribute("aria-label", "쪽");
  const box = t.closest(".scroll") || t;
  const sortBy = (i, dir, save) => {
    const th = heads[i];
    const isNum = th.dataset.k === "n";
    heads.forEach((h) => h.removeAttribute("aria-sort"));
    th.setAttribute("aria-sort", dir);
    order.sort((a, b) => { const x = valueOf(a, i, isNum), y = valueOf(b, i, isNum); const c = isNum ? x - y : String(x).localeCompare(String(y), "ko"); return dir === "ascending" ? c : -c; });
    for (const r of order) tbody.appendChild(r);
    if (sel) sel.value = i + ":" + dir;
    if (save && t.id) keep.set(t.id, Object.assign(keep.get(t.id) || {}, { sort: i, dir: dir }));
    page = 1;
    render();
  };
  // 정렬 고르기 — 자주 쓰는 열(data-pick)만
  const picks = heads.map((h, i) => [h, i]).filter(([h]) => h.dataset.k && h.dataset.pick !== undefined);
  let sel = null;
  if (picks.length) {
    sel = make("select");
    sel.setAttribute("aria-label", "정렬");
    sel.append(make("option", { value: "", textContent: "정렬 고르기" }));
    for (const [h, i] of picks) {
      const name = h.textContent.replace(/[▲▼]/g, "").trim();
      const isNum = h.dataset.k === "n";
      const opts = [[i + ":descending", h.dataset.desc || (isNum ? name + " 많은 순" : name + " 역순")], [i + ":ascending", h.dataset.asc || (isNum ? name + " 적은 순" : name + " 가나다순")]];
      for (const [v, l] of isNum ? opts : opts.reverse()) sel.append(make("option", { value: v, textContent: l }));   // 글자 열은 가나다순이 먼저
    }
    sel.addEventListener("change", () => { if (sel.value) { const [i, d] = sel.value.split(":"); sortBy(Number(i), d, true); } });
  }
  if (t.dataset.search) {
    const s = make("input", { type: "search", placeholder: t.dataset.search });
    s.setAttribute("aria-label", t.dataset.search);
    s.addEventListener("input", () => { q = s.value.trim().toLowerCase(); page = 1; render(); });
    bar.append(s);
  }
  if (sel) bar.append(sel);
  if (t.dataset.size) {
    const ss = make("select");
    ss.setAttribute("aria-label", "한 쪽에 보일 개수");
    for (const n of [5, 10, 20, 50, 0]) ss.append(make("option", { value: String(n), textContent: n ? n + "개씩" : "전체" }));
    ss.value = String(size);
    ss.addEventListener("change", () => { size = Number(ss.value); page = 1; if (t.id) keep.set(t.id, Object.assign(keep.get(t.id) || {}, { size: size })); render(); });
    bar.append(ss);
  }
  bar.append(count);
  if (bar.children.length > 1 || t.dataset.size) { box.before(bar); box.after(pager); }
  const matches = (r) => !q || r.textContent.toLowerCase().includes(q) || ((r.querySelector("input[name=label]") || {}).value || "").toLowerCase().includes(q);
  function render() {
    const rows = order.filter(matches);
    const per = size || rows.length || 1;
    const pages = Math.max(1, Math.ceil(rows.length / per));
    if (page > pages) page = pages;
    const start = (page - 1) * per;
    for (const r of order) r.hidden = true;
    rows.slice(start, start + per).forEach((r, k) => { r.hidden = false; if (numbered) r.cells[0].textContent = String(start + k + 1); });
    count.textContent = rows.length ? (start + 1) + "–" + Math.min(start + per, rows.length) + " / " + rows.length + "개" : "0개";
    pager.replaceChildren();
    if (pages > 1) {
      const btn = (p, label) => { const b = make("button", { type: "button", textContent: label || String(p) }); if (p === page) b.className = "on"; b.addEventListener("click", () => { page = p; render(); }); return b; };
      if (page > 1) pager.append(btn(page - 1, "‹ 이전"));
      const near = [...new Set([1, page - 2, page - 1, page, page + 1, page + 2, pages])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
      near.forEach((p, k) => { if (k && p - near[k - 1] > 1) pager.append(make("em", { textContent: "…" })); pager.append(btn(p)); });
      if (page < pages) pager.append(btn(page + 1, "다음 ›"));
    }
  }
  for (const [h, i] of heads.map((h, i) => [h, i]).filter(([h]) => h.dataset.k)) {
    h.tabIndex = 0;
    const go = () => { const cur = h.getAttribute("aria-sort"); const isNum = h.dataset.k === "n"; sortBy(i, cur ? (cur === "descending" ? "ascending" : "descending") : isNum ? "descending" : "ascending", true); };
    h.addEventListener("click", go);
    h.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  }
  if (saved.sort !== undefined && heads[saved.sort] && heads[saved.sort].dataset.k) sortBy(saved.sort, saved.dir, false); else render();
}
// 순위 막대: 처음 N개, '더 보기'로 N개씩
for (const ol of document.querySelectorAll("ol.bars[data-step]")) {
  const step = Number(ol.dataset.step);
  const items = [...ol.children];
  if (items.length <= step) continue;
  let shown = step;
  const more = make("button", { type: "button", className: "morebtn" });
  const show = () => { items.forEach((li, k) => { li.hidden = k >= shown; }); more.textContent = shown < items.length ? "더 보기 (" + Math.min(step, items.length - shown) + "개 · 전체 " + items.length + ")" : "접기"; };
  more.addEventListener("click", () => { shown = shown < items.length ? shown + step : step; show(); });
  ol.after(more);
  show();
}
</script></body></html>`;
}
