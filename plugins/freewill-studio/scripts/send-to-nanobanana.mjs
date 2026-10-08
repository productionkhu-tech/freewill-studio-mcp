#!/usr/bin/env node
// 실행 중인 나노바나나 앱으로 생성 작업을 보낸다 — 사람이 Generate 를 누르는 것과 같은 경로.
//
// 앱 코드를 따로 불러와 생성하면(헤드리스) 앱 화면은 아무것도 모른다. 이 스크립트는 앱 자체의
// 주소로 지금 화면에 띄운 탭에 프롬프트·설정·레퍼런스를 넣고 Generate 를 누른다. 그래서
// 앱에 스켈레톤이 뜨고, 완성되면 갤러리에 들어오고, 과금도 앱이 평소대로 기록한다.
//
// 앱은 작업마다 그 순간의 설정을 따로 저장해 두므로(스냅샷), 여러 작업을 연달아 넣어도 각자
// 제 설정으로 생성된다. 다 넣고 나면 탭 입력값을 원래대로 돌려놓는다.
//
// 읽기에 /api/status 와 /api/events 는 절대 쓰지 않는다 — status 는 읽는 순간 앱의 '창 닫기
// 요청' 신호를 지우고, events 는 꺼내 가는 큐라 앱 화면의 팝업을 가로챈다. 진행 상황은
// /api/projects 의 탭 요약으로 본다.
//
// 로그인과 사용 기록: 프리윌 스튜디오 MCP 커넥터(회사 구글 계정 로그인)가 이 스크립트를 내려줄 때 받는 사람의 표를
// FREEWILL_TICKET 에 넣는다(12시간). 작업마다 앱에 넣기 직전에 커넥터에 "누가·어느 PC·무슨 모델·몇 장" 을 남기고
// 하루 한도를 묻는다 — 표가 없거나 만료됐거나 커넥터에 닿지 않으면 보내지 않는다. 프롬프트·그림은 보내지 않는다.
//
// 한도 (MCP 로 보내는 것 — 대량 생성을 생각 없이 돌리는 걸 막는다. 앱에서 직접 만드는 건 막지 않는다):
//   - 앱 전체에서 동시에 진행 중인 이미지 10장까지(사람이 Generate 한 번에 넣는 최대와 같다). 넘으면 앞의 것이
//     끝날 때까지 기다렸다가 다음 작업을 넣는다. 기다리는 동안 탭 입력칸은 사람 것으로 돌려 둔다.
//   - 한 사람 하루 1000장(커넥터가 센다). 넘으면 아무것도 보내지 않고 멈춘다.
//
//   node send-to-nanobanana.mjs jobs.json            보내기
//   node send-to-nanobanana.mjs jobs.json --watch    보내고 끝날 때까지 지켜본 뒤 새 파일 목록
//   node send-to-nanobanana.mjs jobs.json --keep     탭 입력값을 되돌리지 않음
//   node send-to-nanobanana.mjs --tab "K" jobs.json  지금 탭 이름이 K 일 때만 보냄
//
// jobs.json:
//   {
//     "defaults": { "model": "gpt-image-2.5-sunburst", "resolution": "4K", "aspect": "16:9",
//                   "quality": "max", "count": 1 },
//     "jobs": [
//       { "name": "char_01", "prompt": "...", "refs": ["C:/path/a.png"] },
//       { "name": "loc_01", "prompt": "...", "model": "seedream-5-0-pro-260628", "resolution": "2K" }
//     ]
//   }

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const NB = process.env.FREEWILL_NB_URL || "http://127.0.0.1:5656";
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const file = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--tab");
const WATCH = flag("--watch");
const KEEP = flag("--keep");
const DRY = flag("--dry-run"); // 앱 연결·탭·팀/프로젝트만 확인하고 아무것도 보내지 않음 (비용 0)
const TAB = opt("--tab");
const SETTING_KEYS = ["model", "aspect", "resolution", "quality", "count", "custom_w", "custom_h", "openai_bg_transparent"];
const MAX_IN_FLIGHT = 10;   // 앱 전체에서 동시에 진행 중인 이미지

// 커넥터 — 사용 기록과 하루 한도. 표는 커넥터가 내려줄 때 채운다(이 줄의 모양을 바꾸지 말 것).
const FREEWILL = "https://freewill-mcp.production-khu.workers.dev";
const FREEWILL_TICKET = "";

let token = "";
const log = (...m) => console.log(...m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 같은 PC 에서 보내기가 둘 이상 겹칠 때(예: Claude 와 Codex 가 동시에) "자리 확인 → 한 작업 넣기" 를 한 번에 하나만 하게 하는
// 잠금. 그래야 동시 진행 한도를 둘이 같이 지킨다. 주인이 죽었거나(프로세스 없음) 15분 넘게 쥐고 있으면 풀어 준다.
async function withSendLock(name, fn) {
  const file = path.join(os.tmpdir(), `freewill-${name}-send.lock`);
  const mine = JSON.stringify({ pid: process.pid, at: Date.now(), r: Math.random() });
  for (;;) {
    try {
      fs.writeFileSync(file, mine, { flag: "wx" });
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
    let stale = false;
    try {
      const h = JSON.parse(fs.readFileSync(file, "utf8"));
      if (Date.now() - h.at > 15 * 60 * 1000) stale = true;
      else { try { process.kill(h.pid, 0); } catch (k) { stale = k.code === "ESRCH"; } }
    } catch {
      try { stale = Date.now() - fs.statSync(file).mtimeMs > 5000; } catch { stale = false; }   // 막 만들어지는 중이면 기다린다
    }
    if (stale) { try { fs.rmSync(file, { force: true }); } catch {} continue; }
    await sleep(300 + Math.random() * 400);
  }
  try {
    return await fn();
  } finally {
    try { if (fs.readFileSync(file, "utf8") === mine) fs.rmSync(file, { force: true }); } catch {}
  }
}

// 표 안의 이름·만료만 읽는다(서명은 커넥터가 확인한다). 없거나 만료면 null.
function ticketOwner() {
  if (!FREEWILL_TICKET) return null;
  try {
    const b = FREEWILL_TICKET.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    const t = JSON.parse(Buffer.from(b, "base64").toString("utf8"));
    return t.x > Date.now() ? t : null;
  } catch { return null; }
}
const NO_TICKET = "이 스크립트에는 유효한 로그인 표가 없다(커넥터를 거치지 않았거나 12시간이 지남) — " +
  "freewill_script(\"send-to-nanobanana\") 로 다시 받아서 실행할 것";

async function usageApi(method, p, body) {
  let r;
  try {
    r = await fetch(`${FREEWILL}${p}`, {
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${FREEWILL_TICKET}` },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("사용 기록 서버(프리윌 스튜디오 MCP)에 닿지 않아 보내지 않는다 — 인터넷 연결을 확인할 것");
  }
  const j = await r.json().catch(() => ({}));
  return { http: r.status, ...j };
}

async function req(method, path, body, ms = 15000) {
  const headers = { "Content-Type": "application/json" };
  if (method !== "GET") headers["X-NB-Token"] = token;
  const r = await fetch(`${NB}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(ms),
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { ok: r.ok, raw: text.slice(0, 200) }; }
}
const get = (p) => req("GET", p);
const post = (p, b = {}) => req("POST", p, b);

// 멈출 때는 던져서 main 끝에서 정리한다. process.exit() 를 바로 부르면 윈도의 Node 가 fetch 연결을 닫는 중에
// 죽는 일이 있다(libuv assertion, exit 127) — 에이전트에게는 엉뚱한 오류로 보인다.
class Stop extends Error {}
function fail(msg) {
  throw new Stop(msg);
}

async function activeTab() {
  const pr = await get("/api/projects");
  return pr?.projects?.find((p) => p.pid === pr.active) || null;
}

// 앱 전체(모든 탭)에서 아직 안 끝난 이미지 — 탭 요약의 outstanding 을 더한다.
async function inFlight() {
  const pr = await get("/api/projects");
  return (pr?.projects || []).reduce((a, p) => a + (Number(p.outstanding) || 0), 0);
}

async function waitForRoom(need) {
  let last = -1, changedAt = Date.now();
  for (;;) {
    const n = await inFlight();
    if (n + need <= MAX_IN_FLIGHT) return;
    if (n !== last) {
      log(`  기다리는 중 — 앱에서 진행 중 ${n}장(동시 ${MAX_IN_FLIGHT}장 한도). 끝나는 대로 다음 작업을 넣는다`);
      last = n;
      changedAt = Date.now();
    }
    if (Date.now() - changedAt > 30 * 60 * 1000) throw new Error(`앱에서 진행 중인 이미지가 30분째 ${n}장 그대로 — 앱 화면을 확인해 달라고 할 것`);
    await sleep(3000);
  }
}

// Generate 는 지금 띄운 탭에 들어간다. 기다리는 사이 사람이 다른 탭으로 갔으면 돌아올 때까지 기다린다.
async function waitForTab(tab) {
  const started = Date.now();
  let hinted = false;
  for (;;) {
    const now = await activeTab();
    if (now?.pid === tab.pid) return;
    if (!hinted) {
      log(`  기다리는 중 — 앱에서 "${tab.name}" 탭으로 돌아오면 이어서 넣는다(지금 "${now?.name ?? "?"}")`);
      hinted = true;
    }
    if (Date.now() - started > 30 * 60 * 1000) throw new Error(`"${tab.name}" 탭으로 30분 동안 돌아오지 않음`);
    await sleep(3000);
  }
}

async function setRefs(paths) {
  await post("/api/refs/clear", { preserve_pinned: false });
  for (const fp of paths) {
    const r = await post("/api/refs/add-path", { filepath: fp });
    if (!r.ok) return `레퍼런스를 못 넣음 (${fp}): ${r.error || "알 수 없음"}`;
  }
  return null;
}

async function main() {
  if (!file) fail("작업 파일(jobs.json)을 주세요");
  let spec;
  try { spec = JSON.parse(fs.readFileSync(file, "utf8").replace(new RegExp("^" + String.fromCharCode(0xfeff)), "")); } catch (e) { fail(`작업 파일을 못 읽음 — ${e.message}`); }
  const defaults = spec.defaults || {};
  const jobs = (spec.jobs || []).filter((j) => j && String(j.prompt || "").trim());
  if (!jobs.length) fail("보낼 작업이 없음 (prompt 가 빈 작업은 뺀다)");
  for (const j of jobs) for (const fp of j.refs || []) if (!fs.existsSync(fp)) fail(`레퍼런스 파일이 없음: ${fp}`);

  // 1) 앱이 켜져 있는지, 보안 토큰
  let html = "";
  try { html = await (await fetch(`${NB}/`, { signal: AbortSignal.timeout(3000) })).text(); } catch {}
  token = html.match(/<meta name="nb-csrf" content="([^"]+)"/)?.[1] || "";
  if (!token) fail("나노바나나가 꺼져 있다 — 앱을 켜 달라고 할 것");

  // 2) 어느 탭으로 들어가는지, 팀·프로젝트가 골라져 있는지
  const tab = await activeTab();
  if (!tab) fail("지금 탭을 알 수 없음");
  if (TAB && tab.name !== TAB) fail(`지금 탭은 "${tab.name}" — "${TAB}" 탭을 띄워 달라고 할 것`);
  const billing = await get("/api/billing/state");
  if (!(billing?.confirmed && billing.project_id)) fail(`"${tab.name}" 탭에 팀·프로젝트가 안 골라져 있다 — 앱에서 먼저 고르게 할 것`);
  log(`탭 "${tab.name}" · ${billing.team_id} / ${billing.project_id} 로 ${jobs.length}건 ${DRY ? "보낼 예정 (dry-run — 아무것도 안 보냄)" : "보냄"}`);

  // 3) 이번에 넣을 장수와 한도 — 하루 한도에 걸리면 하나도 보내지 않는다
  const base = await get("/api/settings");
  const countOf = (j) => Math.max(1, Math.round(Number(j.count ?? defaults.count ?? base.count) || 1));
  const big = jobs.find((j) => countOf(j) > MAX_IN_FLIGHT);
  if (big) fail(`한 작업은 ${MAX_IN_FLIGHT}장까지 — "${big.name || ""}" 은 ${countOf(big)}장. 작업을 나눠서 적을 것`);
  const total = jobs.reduce((a, j) => a + countOf(j), 0);
  const owner = ticketOwner();
  let quota = "로그인 표 없음 — 보낼 때는 커넥터에서 다시 받은 스크립트로";
  if (owner) {
    const me = await usageApi("GET", "/usage/me");
    if (me.http === 401) fail(me.error || NO_TICKET);
    const q = me.apps?.nanobanana;
    if (!q) fail(`사용 기록 서버가 답하지 않는다 (${me.http}) — 잠시 뒤 다시`);
    if (q.used + total > q.limit) {
      fail(`오늘 ${owner.e} 계정이 MCP 로 보낸 이미지 ${q.used}장 — 하루 ${q.limit}장 한도라 이번 ${total}장은 보내지 않는다. ` +
        "장수를 줄이거나 내일 보내고, 급하면 앱에서 직접 만들게 할 것");
    }
    quota = `${owner.e} · 오늘 남은 한도 ${q.limit - q.used}장`;
  } else if (!DRY) {
    fail(NO_TICKET);
  }
  log(`  이번 ${total}장 · ${quota} · 지금 앱에서 진행 중 ${await inFlight()}장 ` +
    `(동시 ${MAX_IN_FLIGHT}장까지 — 넘으면 앞의 것이 끝나야 다음 작업을 넣는다)`);
  if (DRY) {
    log(`  지금 탭 설정: ${base.model} · ${base.resolution} · ${base.aspect} · ×${base.count}`);
    for (const [i, j] of jobs.entries()) {
      const m = j.model ?? defaults.model ?? base.model, r = j.resolution ?? defaults.resolution ?? base.resolution;
      log(`  ${i + 1}. ${j.name || ""} · ${m} ${r} ×${countOf(j)} · 레퍼런스 ${(j.refs || []).length}장`);
    }
    return;
  }

  // 4) 작업마다 — 같은 PC 의 다른 보내기(예: Claude 와 Codex 가 동시에)와 겹치지 않게 PC 잠금 안에서
  //    [자리·탭 확인 → 기록 → 입력칸 담아 두기 → 레퍼런스·설정·프롬프트 → Generate → 입력칸 되돌리기] 를 한 번에 한다.
  //    그래서 동시 10장 한도를 둘이 같이 지키고, 서로의 입력칸을 덮지 않으며, 작업 사이에는 탭이 늘 사람 것이다.
  const galleryBefore = new Set(((await get(`/api/gallery?pid=${encodeURIComponent(tab.pid)}`))?.items || []).map((i) => i.filepath));
  let refNoted = false;
  const restoreTab = async (snap, refsTouched) => {
    const before = snap.settings;
    const restore = { pid: tab.pid, fixed_prompt: before.fixed_prompt ?? "", prompt_sections: before.prompt_sections ?? [] };
    for (const k of SETTING_KEYS) if (before[k] !== undefined) restore[k] = before[k];
    await post("/api/settings", restore);
    if (!refsTouched) return;
    await post("/api/refs/clear", { preserve_pinned: false });
    for (const r of snap.refs.filter((r) => !r.empty && r.path)) await post("/api/refs/add-path", { filepath: r.path });
    if (!refNoted && snap.refs.some((r) => r.empty || r.pinned)) {
      log("  참고: 탭의 레퍼런스는 되돌렸지만 비어 있던 칸(번호 구멍)은 메워지고, 고정(핀)은 다시 걸어야 한다");
      refNoted = true;
    }
  };

  // 한 작업 넣기(잠금 안). 그사이 자리가 찼거나 탭이 바뀌었으면 false — 잠금을 풀고 다시 기다린다.
  async function sendOne(j, i, need) {
    if ((await inFlight()) + need > MAX_IN_FLIGHT) return false;
    if ((await activeTab())?.pid !== tab.pid) return false;
    const snap = { settings: await get("/api/settings"), refs: (await get("/api/refs"))?.refs || [] };
    const model = j.model ?? defaults.model ?? snap.settings.model;
    const resolution = j.resolution ?? defaults.resolution ?? snap.settings.resolution;
    // 사용 기록 + 하루 한도 — 앱에 넣기 전에. 앱이 안 받으면 아래에서 무른다.
    const rsv = await usageApi("POST", "/usage", {
      app: "nanobanana", n: need, model, resolution, job: j.name || `job_${i + 1}`,
      billing: `${billing.team_id} / ${billing.project_id}`, project: tab.name, pc: os.hostname(), user: os.userInfo().username,
    });
    if (!rsv.ok) throw new Error(rsv.error || `사용 기록을 남기지 못함 (${rsv.http})`);
    const refs = j.refs || [];
    const refsTouched = refs.length > 0 || snap.refs.some((r) => !r.empty);
    let gr = { ok: false };
    try {
      if (refsTouched) {
        const err = await setRefs(refs);
        if (err) throw new Error(err);
      }
      const s = { pid: tab.pid, fixed_prompt: "", prompt_sections: [String(j.prompt)] };
      for (const k of SETTING_KEYS) {
        const v = j[k] ?? defaults[k];
        if (v !== undefined && v !== null) s[k] = v;
      }
      const sr = await post("/api/settings", s);
      if (!sr.ok) throw new Error(`설정을 못 넣음: ${sr.error || sr.raw || "알 수 없음"}`);
      for (let attempt = 0; attempt < 12; attempt++) {
        gr = await post("/api/generate", {});
        const e = String(gr.error || "");
        if (gr.ok || !/Queue full|Stopping previous batch/i.test(e)) break;
        await sleep(5000); // 큐가 차 있으면 자리가 날 때까지 기다린다
      }
    } finally {
      if (!gr.ok) await usageApi("POST", "/usage/settle", { id: rsv.id, n: 0 }).catch(() => {});
      if (!KEEP) await restoreTab(snap, refsTouched);
    }
    if (gr.needs_billing) throw new Error("앱이 팀·프로젝트를 다시 골라 달라고 함");
    if (!gr.ok) throw new Error(`Generate 실패 (${j.name || i + 1}): ${gr.error || gr.raw || "알 수 없음"}`);
    return { model, resolution, rsv };
  }

  let sent = 0;
  try {
    for (const [i, j] of jobs.entries()) {
      const need = countOf(j);
      let done = false;
      while (!done) {
        await waitForRoom(need);
        await waitForTab(tab);
        done = await withSendLock("nanobanana", () => sendOne(j, i, need));
      }
      sent++;
      log(`  보냄 ${sent}/${jobs.length} ${j.name || ""} · ${done.model} ${done.resolution} ×${need} · 오늘 ${done.rsv.used}/${done.rsv.limit}장`);
      await sleep(250);
    }
  } catch (e) {
    console.error(`멈춤: ${e.message}`);
    if (sent < jobs.length) {
      console.error(`  ${sent}/${jobs.length}건까지 들어감 · 안 보낸 작업: ${jobs.slice(sent).map((j, k) => j.name || `job_${sent + k + 1}`).join(", ")}`);
    }
    process.exitCode = 1;
  }
  if (sent && !KEEP) log(`  "${tab.name}" 탭 입력칸은 작업마다 원래대로 돌려놓았다`);
  if (!sent) return;

  // 6) 지켜보기 — 탭 요약만 읽는다
  if (!WATCH) {
    log(`앱에 스켈레톤이 ${sent}건 분량으로 떠 있을 것. 끝나면 갤러리에 들어온다.`);
    return;
  }
  let last = "";
  const deadline = Date.now() + 60 * 60 * 1000;
  while (Date.now() < deadline) {
    const pr = await get("/api/projects");
    const t = pr?.projects?.find((p) => p.pid === tab.pid);
    if (!t) break;
    const line = `  진행 ${t.done}/${t.total}${t.failed ? ` · 실패 ${t.failed}` : ""} · 남음 ${t.outstanding}`;
    if (line !== last) { log(line); last = line; }
    if (!t.generating && !t.outstanding) break;
    await sleep(4000);
  }
  const after = (await get(`/api/gallery?pid=${encodeURIComponent(tab.pid)}`))?.items || [];
  const fresh = after.filter((i) => !galleryBefore.has(i.filepath));
  log(`새로 들어온 이미지 ${fresh.length}장:`);
  for (const i of fresh) log(`  ${i.filepath}`);
}

main().catch((e) => {
  console.error(`멈춤: ${e.message}`);
  process.exitCode = 1;
});
