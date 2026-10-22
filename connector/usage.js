// MCP 로 보낸 생성의 사용 기록과 하루 한도. 관리자 화면은 admin.js.
//
// 스크립트(send-to-*)는 앱에 넣기 직전에 POST /usage 로 "누가·어느 PC·무슨 모델·몇 장" 을 남기고, 하루 한도가 남았는지
// 답을 받는다. 앱이 거절하면 /usage/settle 로 무른다. 프롬프트·그림은 받지 않는다. 날짜는 한국 시간.
//
// 하루 한도는 장치(PC 한 대의 윈도 사용자) 기준이다. 장치 ID 는 스크립트가 사용자 폴더(~/.freewill-studio/device.json)에 한 번
// 만들어 두는 값이라 PC 이름을 바꿔도 기록·한도·붙인 이름이 이어진다. 장치 ID 를 안 보내는 옛 스크립트·PowerShell 은
// "pc:<PC 이름>|<윈도 사용자>" 로 센다 — 같은 PC 이름·사용자의 장치가 처음 ID 를 보내 오면 그 기록을 그 장치로 합친다.
// 관리자가 계정에 상한을 정해 두면(limits) 그 계정으로 보낸 모든 장치의 합계도 그 안이어야 한다.

import { readTicket } from "./auth.js";
import { logEvent } from "./events.js";

export const LIMITS = { nanobanana: 1000, seedance: 200 };   // 장치 한 대의 하루 기본 한도
export const UNIT = { nanobanana: "장", seedance: "개" };
export const WHAT = { nanobanana: "이미지", seedance: "영상" };
const UNIT_TOPIC = { nanobanana: "장은", seedance: "개는" };   // 받침에 맞춘 조사

export const kstDay = (ms = Date.now()) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
export const text = (v, max = 200) => (v === undefined || v === null || v === "" ? null : String(v).slice(0, max));
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const pcOf = (v) => text(v) || "";   // 기록의 pc · win_user 와 같은 값(없으면 "")
export const legacyId = (pc, user) => `pc:${pc}|${user}`;
const DEVICE_ID = /^[A-Za-z0-9-]{8,64}$/;

// 관리자가 정한 한도 — 기간 안이면 그 값, 아니면 null.
export const inForce = (r) => (r && (!r.until || r.until >= kstDay()) ? Number(r.daily) : null);

// 오늘 보낸 양은 하루 요약 표(usage_daily — 트리거가 맞춤)에서 — 기록이 하루 수만 건이어도 몇 줄만 읽는다. col = device | email.
const SUM_TODAY = (col) => `COALESCE((SELECT SUM(n) FROM usage_daily WHERE day = ? AND ${col} = ? AND app = ?), 0)`;
async function usedToday(env, col, key, app) {
  const r = await env.USAGE_DB.prepare(`SELECT ${SUM_TODAY(col)} AS n`).bind(kstDay(), key, app).first();
  return Number(r?.n || 0);
}
const QUIET_MS = 10 * 60e3;   // 장치 · 계정의 '마지막 사용'은 바뀐 게 없으면 10분에 한 번만 쓴다(무료 D1 쓰기 아끼기)
// 이 장치의 오늘 한도: 관리자 화면에서 정한 것, 없으면 기본.
async function deviceLimit(env, device, app) {
  const r = await env.USAGE_DB.prepare("SELECT daily, until FROM device_limits WHERE device = ? AND app = ?").bind(device, app).first();
  return inForce(r) ?? LIMITS[app];
}
// 계정 전체 상한: 관리자가 정한 계정만(없으면 null — 상한 없음).
async function accountCap(env, email, app) {
  return inForce(await env.USAGE_DB.prepare("SELECT daily, until FROM limits WHERE email = ? AND app = ?").bind(email, app).first());
}
// 남은 양이 더 적은 쪽(이 장치 · 계정 전체)을 알려 준다.
async function quota(env, email, device, app) {
  const q = { scope: "pc", used: await usedToday(env, "device", device, app), limit: await deviceLimit(env, device, app) };
  const cap = await accountCap(env, email, app);
  if (cap === null) return q;
  const a = { scope: "account", used: await usedToday(env, "email", email, app), limit: cap };
  return a.limit - a.used < q.limit - q.used ? a : q;
}

// 이 요청의 장치. 장치 ID 가 없으면 같은 PC 이름·윈도 사용자로 마지막에 본 장치, 그것도 없으면 이름으로 만든 ID.
// write = false(한도 조회)면 별칭·사건을 남기지 않고 묶을 장치만 알려 준다.
async function resolveDevice(env, b, email, write = true) {
  const db = env.USAGE_DB;
  const pc = pcOf(b.pc);
  const user = pcOf(b.user);
  const sameName = () => db.prepare("SELECT id FROM devices WHERE pc = ? AND win_user = ? AND id NOT LIKE 'pc:%' ORDER BY last_ts DESC LIMIT 1").bind(pc, user).first();
  const sent = String(b.device || "");
  if (DEVICE_ID.test(sent)) {
    const alias = await db.prepare("SELECT device FROM device_alias WHERE alias = ?").bind(sent).first();
    if (alias) return { id: alias.device, pc, user, real: true };
    // device.json 을 지워 ID 를 새로 만들어도 같은 PC 이름·윈도 사용자의 장치가 있으면 그 장치로 센다(하루 한도 초기화 막기)
    if (pc && !(await db.prepare("SELECT 1 AS k FROM devices WHERE id = ?").bind(sent).first())) {
      const same = await sameName();
      if (same && !write) return { id: same.id, pc, user, real: true };
      if (same) {
        await db.prepare("INSERT OR IGNORE INTO device_alias (alias, device, ts) VALUES (?, ?, ?)").bind(sent, same.id, Date.now()).run();
        await logEvent(env, "device_reset", { email, device: same.id, detail: `${pc} · ${user} 가 새 장치 ID 로 보냄 — 원래 장치로 묶음` });
        return { id: same.id, pc, user, real: true };
      }
    }
    return { id: sent, pc, user, real: true };
  }
  return { id: (await sameName())?.id || legacyId(pc, user), pc, user, real: false };
}

// 관리자가 막은 계정이면 그 사유 응답, 아니면 null
async function blocked(env, email, where) {
  const a = await env.USAGE_DB.prepare("SELECT blocked FROM accounts WHERE email = ?").bind(email).first();
  if (!a?.blocked) return null;
  await logEvent(env, "blocked_usage", { email, detail: where });
  return json({ ok: false, error: `${email} 계정은 관리자가 프리윌 스튜디오 MCP 사용을 막아 두었다 — 관리자에게 물을 것` }, 403);
}

// 무르기·줄이기는 앱이 요청을 받는 동안만(시댄스는 받기까지 최대 10분) — 그 뒤에는 '만들고 나서 무르기'라 받지 않는다
const settleMs = (env) => Number(env.SETTLE_MINUTES || 30) * 60e3;

// 장치 목록을 갱신한다 — 처음 보는 장치면 만들고, 같은 PC 이름·사용자로 센 옛 기록(pc:…)이 있으면 이 장치로 합친다
// (붙인 이름·한도·IP 도 옮긴다). PC 이름이 바뀌면 이전 이름을 남긴다. 바뀐 게 없으면 10분에 한 번만 쓴다.
async function touchDevice(env, d, ip) {
  const db = env.USAGE_DB;
  const now = Date.now();
  const seenIp = ip ? [db.prepare("INSERT INTO device_ips (device, ip, first_ts, last_ts) VALUES (?, ?, ?, ?) ON CONFLICT (device, ip) DO UPDATE SET last_ts = excluded.last_ts").bind(d.id, ip, now, now)] : [];
  const cur = await db.prepare("SELECT pc, win_user, pc_names, ip, last_ts FROM devices WHERE id = ?").bind(d.id).first();
  if (cur) {
    const old = cur.pc && cur.pc !== d.pc ? cur.pc : null;
    if (!old && cur.win_user === d.user && (!ip || cur.ip === ip) && now - Number(cur.last_ts || 0) < QUIET_MS) return;
    const names = [...new Set([...String(cur.pc_names || "").split(", ").filter(Boolean), ...(old ? [old] : [])])].slice(-10).join(", ") || null;
    await db.batch([
      db.prepare("UPDATE devices SET pc = ?, win_user = ?, pc_names = ?, ip = COALESCE(?, ip), last_ts = ? WHERE id = ?").bind(d.pc, d.user, names, ip, now, d.id),
      ...seenIp,
    ]);
    return;
  }
  const stmts = [db.prepare("INSERT OR IGNORE INTO devices (id, pc, win_user, ip, first_ts, last_ts) VALUES (?, ?, ?, ?, ?, ?)").bind(d.id, d.pc, d.user, ip, now, now)];
  const old = legacyId(d.pc, d.user);
  if (d.real) {
    stmts.push(
      db.prepare("UPDATE usage SET device = ? WHERE device = ?").bind(d.id, old),
      db.prepare("INSERT OR IGNORE INTO device_ips (device, ip, first_ts, last_ts) SELECT ?, ip, first_ts, last_ts FROM device_ips WHERE device = ?").bind(d.id, old),
      db.prepare("DELETE FROM device_ips WHERE device = ?").bind(old),
      db.prepare(
        `UPDATE devices SET label = COALESCE((SELECT label FROM devices WHERE id = ?), label),
                            label_by = COALESCE((SELECT label_by FROM devices WHERE id = ?), label_by),
                            label_at = COALESCE((SELECT label_at FROM devices WHERE id = ?), label_at),
                            first_ts = MIN(first_ts, COALESCE((SELECT first_ts FROM devices WHERE id = ?), first_ts))
          WHERE id = ?`).bind(old, old, old, old, d.id),
      db.prepare("INSERT OR IGNORE INTO device_limits (device, app, daily, until, note, set_by, set_at) SELECT ?, app, daily, until, note, set_by, set_at FROM device_limits WHERE device = ?").bind(d.id, old),
      db.prepare("DELETE FROM device_limits WHERE device = ?").bind(old),
      db.prepare("DELETE FROM devices WHERE id = ?").bind(old),
    );
  }
  await db.batch([...stmts, ...seenIp]);
}

// 계정의 '마지막 사용' — 10분에 한 번만(연결 기록이 없던 계정이면 이때 만든다)
function touchAccount(env, t) {
  const now = Date.now();
  return env.USAGE_DB.prepare(
    `INSERT INTO accounts (email, name, last_use) VALUES (?, ?, ?)
     ON CONFLICT (email) DO UPDATE SET last_use = excluded.last_use WHERE accounts.last_use IS NULL OR accounts.last_use < ?`,
  ).bind(t.e, text(t.n), now, now - QUIET_MS).run();
}

// DB 가 기록을 못 받으면(클라우드플레어 무료 하루 한도 · 장애) 워커가 죽은 것처럼 보이지 않게 이유를 돌려준다.
// 스크립트는 기록이 안 남으면 앱에 보내지 않으므로 기록 없이 만들어지는 것은 없다.
export async function usage(request, env) {
  try {
    return await handleUsage(request, env);
  } catch (e) {
    console.error("usage", e?.message || e);
    return json({ ok: false, error: "사용 기록 DB 가 지금 기록을 받지 못한다 — 클라우드플레어 무료 하루 한도일 수 있다(한국 시간 오전 9시에 풀림). " +
      "기록이 안 남으니 MCP 로는 보내지 않는다. 급하면 앱에서 직접 만들게 할 것" }, 503);
  }
}

async function handleUsage(request, env) {
  const url = new URL(request.url);
  const t = await readTicket(env, request);
  if (!t) return json({ ok: false, error: "로그인 표가 없거나 만료됐습니다 — 같은 명령을 다시 실행하면 스크립트가 새 요청 번호를 낸다(freewill_ticket 으로 승인). 옛 스크립트면 freewill_script 로 다시 받을 것" }, 401);

  const stop = await blocked(env, t.e, url.pathname);
  if (stop) return stop;

  if (url.pathname === "/usage/me") {
    const q = url.searchParams;
    const d = await resolveDevice(env, { pc: q.get("pc"), user: q.get("user"), device: q.get("device") }, t.e, false);
    // 처음 보는 장치면 아직 합치기 전이라 이름으로 센 옛 기록을 본다
    const known = await env.USAGE_DB.prepare("SELECT 1 AS k FROM devices WHERE id = ?").bind(d.id).first();
    const id = d.real && !known ? legacyId(d.pc, d.user) : d.id;
    const apps = {};
    for (const app of Object.keys(LIMITS)) apps[app] = await quota(env, t.e, id, app);
    return json({ ok: true, email: t.e, device: d.id, pc: d.pc, user: d.user, day: kstDay(), apps });
  }
  if (request.method !== "POST") return json({ ok: false, error: "POST 로 보낼 것" }, 405);
  const b = await request.json().catch(() => ({}));

  // 앱이 받은 실제 개수로 맞추거나(n), 앱이 거절했으면 무른다(n = 0).
  if (url.pathname === "/usage/settle") {
    const db = env.USAGE_DB;
    const n = Math.round(Number(b.n));
    const rid = Math.round(Number(b.id));   // 원본 id(정수, 넣은 순서)
    const since = Date.now() - settleMs(env);
    const res = n >= 1
      ? await db.prepare("UPDATE usage SET n = ? WHERE id = ? AND email = ? AND n >= ? AND ts >= ?").bind(n, rid, t.e, n, since).run()
      : await db.prepare("UPDATE usage SET status = 'cancelled' WHERE id = ? AND email = ? AND ts >= ?").bind(rid, t.e, since).run();
    if (!res.meta?.changes) {
      const row = await db.prepare("SELECT ts, device FROM usage WHERE id = ? AND email = ?").bind(rid, t.e).first();
      if (row && row.ts < since) {
        await logEvent(env, "late_settle", { email: t.e, device: row.device, detail: `${Math.round((Date.now() - row.ts) / 60e3)}분 지난 기록을 ${n >= 1 ? `${n}개로 줄이려` : "무르려"} 함` });
        return json({ ok: false, error: `${Math.round(settleMs(env) / 60e3)}분이 지난 기록은 무르거나 줄일 수 없다` }, 409);
      }
    }
    return json({ ok: true });
  }
  if (url.pathname !== "/usage") return json({ ok: false, error: "모르는 주소" }, 404);

  const app = String(b.app || "");
  const n = Math.round(Number(b.n));
  if (!LIMITS[app] || !(n >= 1 && n <= 10)) return json({ ok: false, error: "app 이나 n 이 올바르지 않음" }, 400);
  const ip = text(request.headers.get("CF-Connecting-IP"));
  const d = await resolveDevice(env, b, t.e);
  await touchDevice(env, d, ip);
  await touchAccount(env, t);
  // 한도 확인과 기록을 한 문장으로 — 같은 PC 의 Claude·Codex 가 동시에 보내도, 계정 상한이 있어도 넘지 않는다.
  const limit = await deviceLimit(env, d.id, app);
  const cap = await accountCap(env, t.e, app);
  const day = kstDay();
  const res = await env.USAGE_DB.prepare(
    `INSERT INTO usage (ts, day, email, name, pc, win_user, device, ip, app, kind, model, resolution, n, billing, project, job, status)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent'
      WHERE ${SUM_TODAY("device")} + ? <= ?
        AND (? IS NULL OR ${SUM_TODAY("email")} + ? <= ?)`,
  ).bind(
    Date.now(), day, t.e, text(t.n), text(b.pc), text(b.user), d.id, ip,
    app, text(b.kind) || "generate", text(b.model), text(b.resolution), n, text(b.billing), text(b.project), text(b.job),
    day, d.id, app, n, limit,
    cap, day, t.e, app, n, cap ?? 0,
  ).run();
  if (!res.meta?.changes) {
    const deviceUsed = await usedToday(env, "device", d.id, app);
    const accountUsed = cap === null ? 0 : await usedToday(env, "email", t.e, app);
    const byAccount = cap !== null && accountUsed + n > cap;
    const where = d.pc ? `이 PC(${d.pc}${d.user ? ` · ${d.user}` : ""})` : "이 PC";
    const [used, max] = byAccount ? [accountUsed, cap] : [deviceUsed, limit];
    if (max === 0 && !byAccount) await logEvent(env, "blocked_device", { email: t.e, device: d.id, detail: `${WHAT[app]} ${n}${UNIT[app]}` });
    return json({
      ok: false, used, limit: max, scope: byAccount ? "account" : "pc",
      error: max === 0
        ? `${byAccount ? `${t.e} 계정은` : `${where}는`} 관리자가 MCP ${WHAT[app]} 생성을 막아 두었다 — 관리자에게 물을 것`
        : `오늘 ${byAccount ? `${t.e} 계정(모든 PC 합계)이` : `${where}가`} MCP 로 보낸 ${WHAT[app]} ${used}${UNIT[app]} — ` +
          `${byAccount ? "계정" : "PC"} 하루 ${max}${UNIT[app]} 한도라 이번 ${n}${UNIT_TOPIC[app]} 보내지 않는다. ` +
          "개수를 줄이거나 내일 보내고, 급하면 앱에서 직접 만들게 하거나 관리자에게 한도를 늘려 달라고 할 것",
    }, 429);
  }
  const q = await quota(env, t.e, d.id, app);
  return json({ ok: true, id: res.meta.last_row_id, device: d.id, used: q.used, limit: q.limit, scope: q.scope });
}
