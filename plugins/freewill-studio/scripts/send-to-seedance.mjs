#!/usr/bin/env node
// 실행 중인 시댄스 앱으로 영상 생성 요청을 보낸다 — 사람이 전송 버튼을 누르는 것과 같은 경로.
//
// 시댄스(26.10.304~) 서버의 '에이전트 작업함'에 요청을 넣으면, 앱 화면이 2초 안에 받아서 작성 칸을 잠깐 빌려
// 설정·레퍼런스·프롬프트를 넣고 전송 버튼과 같은 함수로 보낸 뒤, 작성 칸을 원래대로 돌려놓는다. 그래서 앱에
// 생성 중 카드가 뜨고, 권한 검사·크레딧 집계·영상 보관이 평소대로 된다. 레퍼런스 검사도 드래그와 같다.
//
// 무엇을 보낼 수 있는지는 앱이 직접 낸 **사용 설명서**가 정답이다(--manual). 앱이 업데이트되면 설명서도 바뀌고,
// 예전 설명서 버전으로 보내면 앱이 "업데이트됐으니 다시 읽어" 로 돌려보낸다 — 이 스크립트는 그때 새 설명서를
// 보여 주고 멈춘다. 설정 키도 설명서에서 읽으므로 앱에 새 설정이 생기면 그대로 넘어간다.
//
// 진행은 /api/agent/* 로만 본다. /api/byteplus/tasks/<id> 는 부르지 않는다 — 그 조회는 성공을 처음 본 순간
// 크레딧 보고·영상 보관을 하고 기록을 지운다(앱 화면이 하는 일이다).
//
// 로그인과 사용 기록: 프리윌 스튜디오 MCP 커넥터(회사 구글 계정 로그인)가 이 스크립트를 내려줄 때 받는 사람의 표를
// FREEWILL_TICKET 에 넣는다(12시간). 요청마다 앱에 넣기 직전에 커넥터에 "누가·어느 PC·무슨 모델·몇 개" 를 남기고
// 하루 한도를 묻는다 — 표가 없거나 만료됐거나 커넥터에 닿지 않으면 보내지 않는다. 프롬프트·그림은 보내지 않는다.
//
// 한도 (MCP 로 보내는 것 — 대량 생성을 생각 없이 돌리는 걸 막는다. 앱에서 직접 만드는 건 막지 않는다):
//   - 열린 프로젝트에서 동시에 진행 중인(대기 포함) 영상 3개까지 — 앱의 한 번 최대 개수와 같다. 넘으면 앞의 것이
//     끝날 때까지 기다렸다가 다음 요청을 넣는다. 과금되는 명령(card.final · card.regenerate)도 같다.
//   - 한 사람 하루 200개(커넥터가 센다). 넘으면 보내지 않고 멈춘다.
//
//   node send-to-seedance.mjs --manual              앱의 사용 설명서와 그 버전 (처음 한 번, 그리고 앱이 바뀌었다고 할 때)
//   node send-to-seedance.mjs jobs.json --dry-run   앱 상태만 확인(설명서 버전·프로젝트·과금·권한) — 아무것도 안 보냄
//   node send-to-seedance.mjs jobs.json             보내기 — 앱이 받아서 보낼 때까지 하나씩
//   node send-to-seedance.mjs jobs.json --watch     보내고 영상이 다 끝날 때까지 지켜봄
//   node send-to-seedance.mjs --status <id> [<id>]  보낸 요청의 지금 상태
//   node send-to-seedance.mjs --do <명령> [JSON 인자 | @인자파일.json]
//                                                   앱 기능 명령(26.10.305~) — 프로젝트 · 어셋 라이브러리 · 카드 ·
//                                                   과금 목록. 명령 목록은 설명서에. 결과는 JSON 으로 출력한다.
//                                                   설명서 버전은 --manual 로 읽을 때 기억해 둔 것을 쓴다.
//
// jobs.json:
//   {
//     "manual": "읽은 설명서 버전 (--manual 이 알려 준 값 그대로) — 앱이 바뀌었으면 앱이 받지 않는다",
//     "project": "앱 사이드바에 열린 프로젝트 이름 (확인 카드에 보여 준 것 — 다르면 앱이 안 보냄, 생략하면 지금 값)",
//     "billing": "과금 프로젝트 이름 (확인 카드에 보여 준 것 — 다르면 앱이 안 보냄, 생략하면 지금 값)",
//     "defaults": { "model": "dreamina-seedance-2-5-260628", "mode": "multimodal_reference",
//                   "ratio": "16:9", "duration": 10, "resolution": "720p", "draft": true,
//                   "output_count": 1, "generate_audio": true },
//     "jobs": [
//       { "name": "cut_01", "prompt": "[Image 1] 의 인물이 ...", "refs": ["C:/path/a.png"] },
//       { "name": "cut_02", "prompt": "...", "mode": "image_to_video_first_last",
//         "refs": [{ "path": "C:/a.png", "role": "first_frame" }, { "path": "C:/b.png", "role": "last_frame" }] }
//     ]
//   }
// 설정 키와 값의 범위는 설명서에. 안 준 값은 앱의 지금 설정을 따른다(모델·모드를 바꾸면 그 조합의 기본값).
// 레퍼런스 순서가 프롬프트의 [Image N]·[Video N]·[Audio N] 번호다(종류별로 센다). 첫·끝 프레임은 role 로 정한다.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SD = process.env.FREEWILL_SD_URL || "http://127.0.0.1:3000";
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const DRY = flag("--dry-run");
const WATCH = flag("--watch");
const STATUS = flag("--status");
const MANUAL = flag("--manual");
const DO = flag("--do");
const positional = args.filter((a) => !a.startsWith("--"));
// --manual 로 읽은 설명서 버전을 기억해 두는 곳(--do 가 쓴다). 앱 주소마다 따로 — 시험 서버와 섞이지 않게.
const STATE_FILE = path.join(os.tmpdir(), `freewill-seedance-manual-${SD.replace(/[^a-z0-9]+/gi, "_")}.json`);
const rememberManual = (version) => { try { fs.writeFileSync(STATE_FILE, JSON.stringify({ version, at: Date.now() })); } catch {} };
const rememberedManual = () => { try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")).version || null; } catch { return null; } };
const readJsonArg = (raw) => {
  const txt = raw.startsWith("@") ? fs.readFileSync(raw.slice(1), "utf8") : raw;
  return JSON.parse(txt.replace(new RegExp("^" + String.fromCharCode(0xfeff)), ""));
};

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

// 연결 거부가 아닌 연결 실패는 실행 환경(Codex 샌드박스 등)이 네트워크를 막은 것일 수 있다.
const BLOCKED = "이 실행 환경이 네트워크를 막고 있다(예: Codex 샌드박스 — network_access 꺼짐). 앱이 켜져 있어도 이렇게 나온다. 네트워크가 허용된 상태(샌드박스 밖, 실행 승인)로 이 명령을 다시 실행할 것";
const MAX_IN_FLIGHT = 3;   // 열린 프로젝트에서 동시에 진행 중인(대기 포함) 영상
const DONE = new Set(["succeeded", "failed", "cancelled", "canceled", "expired"]);
// 과금되는 명령과 만들 수 있는 영상 수(재생성은 원래 보낸 개수를 따르므로 최대로 잡는다).
const COSTLY = { "card.final": 1, "card.regenerate": MAX_IN_FLIGHT };

// 커넥터 — 사용 기록과 하루 한도. 표는 커넥터가 내려줄 때 채운다(이 줄의 모양을 바꾸지 말 것).
const FREEWILL = "https://freewill-mcp.production-khu.workers.dev";
const FREEWILL_TICKET = "";

// 표 안의 이름·만료만 읽는다(서명은 커넥터가 확인한다). 없거나 만료면 null.
function ticketOwner() {
  if (!FREEWILL_TICKET) return null;
  try {
    const b = FREEWILL_TICKET.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    const t = JSON.parse(Buffer.from(b, "base64").toString("utf8"));
    return t.x > Date.now() ? t : null;
  } catch { return null; }
}
// 표가 없으면(플러그인에 깔린 사본처럼 커넥터를 거치지 않음) 사람이 커넥터에 로그인해야 하고, 만료면 다시 받기만 하면 된다.
const NO_TICKET = !FREEWILL_TICKET
  ? "이 스크립트는 프리윌 스튜디오 MCP 커넥터에서 받은 것이 아니라(플러그인에 깔린 사본 등) 앱으로 보낼 수 없다. " +
    "freewill_script 도구가 있으면 freewill_script(\"send-to-seedance\") 로 받아 그 원문을 실행할 것. " +
    "도구가 없으면 커넥터 로그인 전이다 — 지침(SKILL.md)의 '로그인' 대로 에이전트가 로그인을 시작할 것 " +
    "(사람은 브라우저에서 회사 구글 계정만 고른다, 사용자에게 터미널 명령을 시키지 않는다). " +
    "나노바나나·시댄스 앱에는 로그인할 곳이 없으니 앱 안의 버튼·키를 지어내 안내하지 말 것"
  : "받은 지 12시간이 지난 스크립트다 — freewill_script(\"send-to-seedance\") 로 다시 받아 실행할 것(사용자가 할 일은 없다)";

async function usageApi(method, p, body) {
  let r;
  try {
    r = await fetch(`${FREEWILL}${p}`, {
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${FREEWILL_TICKET}` },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Stop(`사용 기록 서버(프리윌 스튜디오 MCP)에 닿지 않아 보내지 않는다 — 인터넷 연결을 확인하거나, ${BLOCKED}`);
  }
  const j = await r.json().catch(() => ({}));
  return { http: r.status, ...j };
}

// 앱에 넣기 전에 기록을 남기고 한도를 묻는다. 거절이면 멈춘다. 돌려주는 settle(n) 로 실제 개수를 맞추거나(0 이면 무름).
async function reserve(n, meta) {
  if (!ticketOwner()) fail(NO_TICKET);
  const r = await usageApi("POST", "/usage", { app: "seedance", n, pc: os.hostname(), user: os.userInfo().username, ...meta });
  if (!r.ok) fail(r.error || `사용 기록을 남기지 못함 (${r.http})`);
  return { ...r, settle: (actual) => (actual === n ? Promise.resolve() : usageApi("POST", "/usage/settle", { id: r.id, n: actual }).catch(() => {})) };
}

async function req(method, p, body, ms = 10000) {
  const r = await fetch(`${SD}${p}`, {
    method, headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(ms),
  });
  const text = await r.text();
  try { return { http: r.status, ...JSON.parse(text) }; } catch { return { http: r.status, raw: text.slice(0, 200) }; }
}
const get = (p) => req("GET", p);
const post = (p, b, ms) => req("POST", p, b, ms);

// 멈출 때는 던져서 main 끝에서 정리한다. process.exit() 를 바로 부르면 윈도의 Node 가 fetch 연결을 닫는 중에
// 죽는다(libuv assertion, exit 127) — 에이전트에게는 엉뚱한 오류로 보인다.
class Stop extends Error { constructor(msg, quiet = false) { super(msg); this.quiet = quiet; } }
function fail(msg) {
  throw new Stop(msg);
}

async function appStatus(manual) {
  let s;
  try { s = await get(`/api/agent/status${manual ? `?manual=${encodeURIComponent(manual)}` : ""}`); }
  catch (e) {
    const code = e?.cause?.code || (e?.name === "TimeoutError" ? "시간 초과" : e?.name || "오류");
    fail(code === "ECONNREFUSED" ? "시댄스가 꺼져 있다 — 앱을 켜 달라고 할 것" : `시댄스에 연결 못 함 (${code}) — ${BLOCKED}`);
  }
  // 작업함이 없는 옛 버전은 이 주소에 화면(HTML)이나 404 를 준다.
  if (!s || s.ok !== true) fail("이 PC 의 시댄스는 에이전트 연결 전 버전이다 — 앱을 껐다 켜서 업데이트(26.10.304 이상)해 달라고 할 것");
  return s;
}

async function readManual() {
  const m = await get("/api/agent/manual");
  if (m.http !== 200 || !m.version) fail(m.error || "앱이 설명서를 주지 않는다 — 앱 창이 열려 있는지 확인해 달라고 할 것");
  return m;
}

// 앱이 업데이트됐다 — 새 설명서를 통째로 보여 주고 멈춘다. 에이전트는 이걸 기준으로 확인 카드를 다시 보여 준 뒤
// jobs.json 의 manual 을 새 버전으로 바꿔 다시 보낸다.
async function staleStop(notice) {
  const m = await readManual();
  rememberManual(m.version);   // 새 설명서를 지금 보여 줬으니 --do 는 이 버전으로
  console.error(`멈춤: ${notice}`);
  log("", "──── 새 설명서 ────", "", m.text);
  log(`새 설명서 버전: ${m.version}`);
  log("이 설명서로 설정·확인 카드를 다시 정리해 사용자에게 보여 주고, jobs.json 의 \"manual\" 을 위 버전으로 바꿔 다시 보낼 것.");
  throw new Stop("", true);
}

// 앱 기능 명령 — 결과가 올 때까지 기다린다(서버가 60초 붙들고, 더 걸리면 이어서 묻는다).
async function runCommand(name, cargs) {
  const manual = rememberedManual();
  if (!manual) fail("설명서를 먼저 읽을 것 — node send-to-seedance.mjs --manual (그때 버전을 기억해 둔다)");
  const s = await appStatus(manual);
  if (!s.screenAlive) fail("시댄스 서버는 켜져 있지만 앱 화면이 응답하지 않는다 — 앱 창이 열려 있는지 확인해 달라고 할 것");
  if (s.manualStale) await staleStop(s.notice || "앱이 업데이트됐다");
  return sendCommand(manual, name, cargs);
}

async function sendCommand(manual, name, cargs) {
  let r = await post("/api/agent/commands", { manual, command: name, args: cargs, wait: 60 }, 75000);
  if (r.http === 409 && r.stale) await staleStop(r.error);
  if (r.http !== 200 || !r.id) fail(r.error || r.raw || `HTTP ${r.http}`);
  while (r.status === "pending" || r.status === "taken") {
    await sleep(2000);
    r = await get(`/api/agent/commands/${encodeURIComponent(r.id)}`);
    if (r.http !== 200) fail(r.error || "명령이 사라짐(앱을 다시 켰나?)");
  }
  if (r.status === "failed") fail(`${name} 실패 — ${r.error || "이유 없음"}`);
  return r.result;
}

// 열린 프로젝트에서 아직 안 끝난(대기·생성 중) 영상 — 카드 하나가 영상 하나다. 명령이 없는 앱(26.10.304)이면
// 이번에 보낸 요청의 카드만 센다.
async function inFlight(manual, project, ownIds = []) {
  try {
    const r = await sendCommand(manual, "cards.list", { project, limit: 100 });
    return (r?.cards || []).filter((c) => !DONE.has(c.status)).length;
  } catch (e) {
    if (e instanceof Stop && e.quiet) throw e;   // 앱이 업데이트됨 — 새 설명서를 이미 보여 줬다
    let n = 0;
    for (const id of ownIds) {
      const j = await get(`/api/agent/jobs/${encodeURIComponent(id)}`);
      n += (j.messages || []).filter((c) => !DONE.has(c.status)).length;
    }
    return n;
  }
}

async function waitForRoom(manual, project, need, ownIds) {
  let last = -1, changedAt = Date.now();
  for (;;) {
    const n = await inFlight(manual, project, ownIds);
    if (n + need <= MAX_IN_FLIGHT) return;
    if (n !== last) {
      log(`  기다리는 중 — "${project}" 에서 진행 중인 영상 ${n}개(동시 ${MAX_IN_FLIGHT}개 한도). 끝나는 대로 이어서 보낸다`);
      last = n;
      changedAt = Date.now();
    }
    if (Date.now() - changedAt > 45 * 60 * 1000) fail(`진행 중인 영상이 45분째 ${n}개 그대로 — 앱 화면을 확인해 달라고 할 것`);
    await sleep(10000);
  }
}

// 오늘 한도 — 표가 없으면(받은 스크립트가 아니면) dry-run 만 되고 보내기는 멈춘다.
async function quota(n, what) {
  const owner = ticketOwner();
  if (!owner) {
    if (!DRY) fail(NO_TICKET);
    return "로그인 표 없음 — 보낼 때는 커넥터에서 다시 받은 스크립트로";
  }
  const me = await usageApi("GET", "/usage/me");
  if (me.http === 401) fail(me.error || NO_TICKET);
  const q = me.apps?.seedance;
  if (!q) fail(`사용 기록 서버가 답하지 않는다 (${me.http}) — 잠시 뒤 다시`);
  if (q.used + n > q.limit) {
    fail(`오늘 ${owner.e} 계정이 MCP 로 보낸 영상 ${q.used}개 — 하루 ${q.limit}개 한도라 이번 요청(${what})은 보내지 않는다. ` +
      "개수를 줄이거나 내일 보내고, 급하면 앱에서 직접 하게 할 것");
  }
  return `${owner.e} · 오늘 남은 한도 ${q.limit - q.used}개`;
}

const cardLine = (c) => `${c.status}${c.taskId ? ` · ${c.taskId}` : ""}${c.error ? ` · ${c.error}` : ""}${c.videoUrl ? `\n      ${c.videoUrl}` : ""}`;

async function showStatus(ids) {
  for (const id of ids) {
    const j = await get(`/api/agent/jobs/${encodeURIComponent(id)}`);
    if (j.http !== 200) { log(`${id}: ${j.error || j.raw || "없음"}`); continue; }
    log(`${j.name || id} — ${j.status}${j.project ? ` · ${j.project}` : ""}${j.error ? `\n  ${j.error}` : ""}`);
    for (const c of j.messages || []) log(`    카드 ${cardLine(c)}`);
  }
}

// 화면이 받아서 보낼 때까지(sent) 또는 실패할 때까지. 서버는 10분 안에 못 받은 요청을 스스로 닫는다.
async function waitTaken(id) {
  let hinted = false;
  const started = Date.now();
  for (;;) {
    const j = await get(`/api/agent/jobs/${encodeURIComponent(id)}`);
    if (j.http !== 200) return { status: "failed", error: j.error || "요청이 사라짐(앱을 다시 켰나?)" };
    if (j.status !== "pending" && j.status !== "taken") return j;
    if (!hinted && Date.now() - started > 8000) {
      const s = await appStatus();
      const why = !s.screenAlive ? "앱 화면이 응답하지 않음(창이 닫혔거나 멈춤)"
        : s.composer === false ? "앱이 갤러리 화면(채팅 화면으로 돌아오면 받음)"
        : s.generating ? "앱이 다른 생성을 보내는 중"
        : "앱에서 입력 중이거나 앞 요청을 보내는 중";
      log(`  기다리는 중 — ${why}. 10분 안에 못 받으면 취소된다.`);
      hinted = true;
    }
    await sleep(1500);
  }
}

async function main() {
  if (MANUAL) {
    await appStatus();
    const m = await readManual();
    rememberManual(m.version);
    log(m.text);
    log(`설명서 버전: ${m.version} — jobs.json 의 "manual" 에 이 값을 그대로 적는다(--do 는 알아서 쓴다).`);
    return;
  }
  if (DO) {
    const [name, raw] = positional;
    if (!name) fail("--do 뒤에 명령 이름을 주세요 (설명서의 '명령' 목록)");
    let cargs = {};
    if (raw) { try { cargs = readJsonArg(raw); } catch (e) { fail(`인자 JSON 을 못 읽음 — ${e.message}`); } }
    // 과금되는 명령도 하루 한도와 동시 진행 한도를 지킨다.
    const need = COSTLY[name] || 0;
    let rsv = null;
    if (need) {
      const manual = rememberedManual();
      if (!manual) fail("설명서를 먼저 읽을 것 — node send-to-seedance.mjs --manual (그때 버전을 기억해 둔다)");
      await quota(need, name);
      const s = await appStatus(manual);
      if (s.project) await waitForRoom(manual, s.project, need, []);
      rsv = await reserve(need, { kind: name, project: s.project, billing: s.billing, job: String(cargs?.id || "") });
    }
    let result;
    try {
      result = await runCommand(name, cargs);
    } catch (e) {
      if (rsv) await rsv.settle(0);
      throw e;
    }
    if (rsv) await rsv.settle(Array.isArray(result?.cards) ? result.cards.length : 1);
    log(JSON.stringify(result, null, 2));
    return;
  }
  if (STATUS) {
    if (!positional.length) fail("--status 뒤에 요청 id 를 주세요");
    await appStatus();
    return showStatus(positional);
  }
  const file = positional[0];
  if (!file) fail("작업 파일(jobs.json)을 주세요");
  let spec;
  try { spec = JSON.parse(fs.readFileSync(file, "utf8").replace(new RegExp("^" + String.fromCharCode(0xfeff)), "")); } catch (e) { fail(`작업 파일을 못 읽음 — ${e.message}`); }
  if (!spec.manual) fail("jobs.json 에 \"manual\"(읽은 설명서 버전)이 없다 — 먼저 --manual 로 앱의 설명서를 읽고 그 버전을 적을 것");
  const defaults = spec.defaults || {};
  const jobs = (spec.jobs || []).filter((j) => j && String(j.prompt || "").trim());
  if (!jobs.length) fail("보낼 작업이 없음 (prompt 가 빈 작업은 뺀다)");
  for (const j of jobs) {
    j.refs = (j.refs || []).map((r) => (typeof r === "string" ? { path: r } : r));
    for (const r of j.refs) {
      if (!r?.path || !fs.existsSync(r.path) || !fs.statSync(r.path).isFile()) fail(`레퍼런스 파일이 없음: ${r?.path}`);
      r.path = path.resolve(r.path);   // 앱 서버는 자기 폴더 기준으로 읽으므로 절대 경로로
    }
  }

  // 1) 앱 상태 — 설명서가 그대로인지, 켜져 있는지, 프로젝트·과금이 골라져 있는지, 작성 칸이 있는지
  const s = await appStatus(spec.manual);
  if (!s.screenAlive) fail("시댄스 서버는 켜져 있지만 앱 화면이 응답하지 않는다 — 앱 창이 열려 있는지 확인해 달라고 할 것");
  if (s.manualStale) await staleStop(s.notice || "앱이 업데이트됐다");
  if (!s.project) fail("앱에 열린 프로젝트가 없다 — 앱에서 프로젝트(사이드바)를 열어 달라고 할 것");
  if (!s.billing) fail(`"${s.project}" 에 과금 프로젝트가 안 골라져 있다 — 앱 설정 패널 맨 위 "프로젝트" 드롭다운에서 고르게 할 것`);
  if (spec.project && spec.project !== s.project) fail(`앱에 열린 프로젝트는 "${s.project}" — 확인한 "${spec.project}" 와 다르다. 사용자에게 확인할 것`);
  if (spec.billing && spec.billing !== s.billing) fail(`앱의 과금 프로젝트는 "${s.billing}" — 확인한 "${spec.billing}" 와 다르다. 사용자에게 확인할 것`);
  const project = spec.project || s.project;
  const billing = spec.billing || s.billing;
  log(`프로젝트 "${project}" · 과금 "${billing}" 로 ${jobs.length}건 ${DRY ? "보낼 예정 (dry-run — 아무것도 안 보냄)" : "보냄"} · 설명서 ${spec.manual}`);
  if (Array.isArray(s.allowedModels)) log(`  이 과금 프로젝트로 쓸 수 있는 모델: ${s.allowedModels.join(", ") || "(없음)"}${s.fourK ? " · 4K 가능" : ""}`);
  if (s.composer === false) log("  참고: 앱이 갤러리 화면이다 — 채팅 화면으로 돌아와야 받는다");
  if (s.pending) log(`  참고: 앱이 아직 받지 않은 요청이 ${s.pending}건 있다`);

  // 설정 키는 설명서에서 읽는다 — 앱에 새 설정이 생기면 그대로 넘어간다.
  const manual = await readManual();
  const keys = Object.keys(manual.manual?.settings || {});
  if (!keys.length) fail("설명서에 설정 키가 없다 — 앱을 다시 켜 볼 것");
  const settingsOf = (j) => {
    const out = {};
    for (const k of keys) { const v = j[k] ?? defaults[k]; if (v !== undefined && v !== null) out[k] = v; }
    return out;
  };
  const unknown = [...new Set(jobs.flatMap((j) => Object.keys({ ...defaults, ...j })).filter((k) =>
    !keys.includes(k) && !["name", "prompt", "refs"].includes(k)))];
  if (unknown.length) log(`  참고: 설명서에 없는 키는 보내지 않는다 — ${unknown.join(", ")}`);
  for (const j of jobs) {
    const model = j.model ?? defaults.model;
    if (model && Array.isArray(s.allowedModels) && !s.allowedModels.includes(model)) {
      log(`  주의: ${j.name || ""} 의 모델 ${model} 은 이 과금 프로젝트에 권한이 없다 — 앱이 막는다. 다른 모델을 사용자에게 물을 것`);
    }
  }

  // 한도 — 하루 한도에 걸리면 하나도 보내지 않는다. output_count 를 안 적으면 앱 설정을 따르니 최대로 잡는다.
  const videosOf = (j) => {
    const n = Number(settingsOf(j).output_count);
    return n >= 1 ? Math.min(Math.round(n), MAX_IN_FLIGHT) : MAX_IN_FLIGHT;
  };
  if (jobs.some((j) => !(Number(settingsOf(j).output_count) >= 1))) {
    log(`  참고: output_count 를 안 적은 작업은 앱 설정을 따르므로 ${MAX_IN_FLIGHT}개로 잡고 센다(적어 두면 더 빨리 보낼 수 있다)`);
  }
  const total = jobs.reduce((a, j) => a + videosOf(j), 0);
  const q = await quota(total, `최대 ${total}개`);
  log(`  이번 최대 ${total}개 · ${q} · 지금 "${project}" 에서 진행 중 ` +
    `${await inFlight(spec.manual, project)}개 (동시 ${MAX_IN_FLIGHT}개까지 — 넘으면 앞의 것이 끝나야 다음을 보낸다)`);
  if (DRY) {
    for (const [i, j] of jobs.entries()) {
      const st = settingsOf(j);
      log(`  ${i + 1}. ${j.name || ""} · ${Object.entries(st).map(([k, v]) => `${k}=${v}`).join(" ") || "(앱 지금 설정 그대로)"} · 레퍼런스 ${j.refs.length}개`);
    }
    return;
  }

  // 2) 하나씩 — 자리가 나면 넣고, 앱이 보낼 때까지 기다린다. 하나라도 실패하면 거기서 멈춘다(같은 실수를 반복하지 않게).
  //    [자리 확인 → 기록 → 넣기 → 앱이 받을 때까지] 는 PC 잠금 안에서 — 같은 PC 의 다른 보내기와 동시 3개 한도를 같이 지킨다.
  const sent = [];
  const unsent = (from) => jobs.slice(from).map((j, k) => j.name || `job_${from + k + 1}`).join(", ");
  for (const [i, j] of jobs.entries()) {
    const need = videosOf(j);
    const st = settingsOf(j);
    let out = null;
    while (!out) {
      await waitForRoom(spec.manual, project, need, sent.map((x) => x.id));
      out = await withSendLock("seedance", async () => {
        if ((await inFlight(spec.manual, project, sent.map((x) => x.id))) + need > MAX_IN_FLIGHT) return null;
        let rsv;
        try {
          rsv = await reserve(need, {
            kind: "generate", model: st.model, resolution: st.draft ? "480p 초안" : st.resolution, project, billing, job: j.name || `job_${i + 1}`,
          });
        } catch (e) {
          if (e instanceof Stop && !e.quiet) return { error: e.message };
          throw e;
        }
        const r = await post("/api/agent/jobs", {
          manual: spec.manual, name: j.name || `job_${i + 1}`, prompt: String(j.prompt), project, billing,
          settings: st, refs: j.refs,
        });
        if (r.http === 409 && r.stale) { await rsv.settle(0); return { stale: r.error }; }
        if (r.http !== 200 || !r.id) {
          await rsv.settle(0);
          return { error: `요청을 못 넣음 (${j.name || i + 1}): ${r.error || r.raw || r.http}` };
        }
        const res = await waitTaken(r.id);
        const cards = res.messages || [];
        await rsv.settle(res.status === "failed" ? cards.length : (cards.length || need));
        return { r, res, cards, rsv };
      });
    }
    if (out.stale) {
      if (sent.length) log(`  (그 전까지 ${sent.length}건은 보냈다: ${sent.map((x) => x.name).join(", ")})`);
      await staleStop(out.stale);
    }
    if (out.error) {
      console.error(`멈춤: ${out.error}`);
      console.error(`  ${sent.length}/${jobs.length}건까지 보냄 · 안 보낸 작업: ${unsent(i)}`);
      process.exitCode = 1;
      break;
    }
    const { r, res, cards, rsv } = out;
    if (res.status === "failed") {
      console.error(`멈춤: ${j.name || i + 1} 실패 — ${res.error || "이유 없음"}`);
      if (jobs.length - i - 1 > 0) console.error(`  안 보낸 작업: ${unsent(i + 1)}`);
      process.exitCode = 1;
      break;
    }
    sent.push({ id: r.id, name: j.name || `job_${i + 1}` });
    log(`  보냄 ${sent.length}/${jobs.length} ${j.name || ""} — 카드 ${cards.length}개${cards.some((c) => c.status === "failed") ? ` (실패 ${cards.filter((c) => c.status === "failed").length})` : ""} · id ${r.id}` +
      ` · 오늘 ${rsv.used - need + (cards.length || need)}/${rsv.limit}개`);
    for (const c of cards) if (c.status === "failed") log(`    카드 ${cardLine(c)}`);
  }
  if (!sent.length) return;

  // 3) 지켜보기 — 카드 상태만 읽는다(앱 화면이 올려 준 것)
  if (!WATCH) {
    log(`앱에 생성 중 카드가 떠 있을 것. 나중에 상태: node send-to-seedance.mjs --status ${sent.map((x) => x.id).join(" ")}`);
    return;
  }
  const deadline = Date.now() + 90 * 60 * 1000;
  const last = new Map();
  let open = sent.map((x) => x.id);
  while (open.length && Date.now() < deadline) {
    for (const id of [...open]) {
      const j = await get(`/api/agent/jobs/${encodeURIComponent(id)}`);
      if (j.http !== 200) { open = open.filter((x) => x !== id); continue; }
      const cards = j.messages || [];
      const line = cards.map((c) => c.status).join(", ");
      if (last.get(id) !== line) { log(`  ${j.name}: ${line || j.status}`); last.set(id, line); }
      if (j.status === "done" || j.status === "failed") open = open.filter((x) => x !== id);
    }
    if (open.length) await sleep(5000);
  }
  if (open.length) log(`아직 안 끝난 요청 ${open.length}건 — 앱 화면에서 계속 진행된다`);
  await showStatus(sent.map((x) => x.id));
}

main().catch((e) => {
  if (!(e instanceof Stop && e.quiet)) console.error(`멈춤: ${e.message}`);
  process.exitCode = 1;
});
