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
//   node send-to-nanobanana.mjs jobs.json --watch    보내고 끝날 때까지 지켜본 뒤 새 파일 목록(작업별)
//   node send-to-nanobanana.mjs jobs.json --save-to <폴더>
//                                                    지켜본 뒤 새 그림을 그 폴더로 복사(<작업 이름>_A.png · _목록.tsv) —
//                                                    앱 저장 폴더의 원본은 그대로 둔다(옮기면 앱 갤러리에서 사라진다)
//   node send-to-nanobanana.mjs jobs.json --keep     탭 입력값을 되돌리지 않음
//   node send-to-nanobanana.mjs --tab "K" jobs.json  K 탭으로 보냄(jobs.json 의 "tab" 과 같다) — 앱의 생성 기능은 화면에 떠 있는
//                                                    탭에만 들어가서, K 가 화면에 없으면 사람이 K 를 누를 때까지 기다렸다 이어서 넣는다
//
// jobs.json:
//   {
//     "guide": "지침 버전 (freewill_guide(\"start\") 맨 위의 값) — 지침이 바뀌었으면 스크립트가 다시 읽으라고 멈춘다",
//     "tab": "보낼 탭 이름 — 사용자가 이 작업용으로 만들어 둔 탭(팀·프로젝트가 골라져 있어야 한다). 비우면 지금 화면의 탭",
//     "work": "작업 폴더 — 있으면 dry-run 이 <작업 폴더>/_검수/보낼것.json 에 레퍼런스를 남겨 작업 페이지의 '보낼 것'에 그림으로 뜬다",
//     "defaults": { "model": "gpt-image-2.5-sunburst", "resolution": "4K", "aspect": "16:9",
//                   "quality": "max", "count": 1 },
//     "jobs": [
//       { "name": "char_01", "prompt": "...", "refs": [{ "path": "C:/path/a.png", "why": "her face and hair only — the outfit comes from the text" }] },
//       { "name": "loc_01", "prompt": "...", "model": "seedream-5-0-pro-260628", "resolution": "2K" }
//     ]
//   }
// 프롬프트 본문은 영어(그림에 넣을 글자만 따옴표 안에 그 언어로) — 한국어 본문이면 보내지 않는다. 일부러면 "prompt_language": "ko".

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const NB = process.env.FREEWILL_NB_URL || "http://127.0.0.1:5656";
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const file = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--tab" && args[i - 1] !== "--save-to");
const SAVE_TO = opt("--save-to");
const WATCH = flag("--watch") || Boolean(SAVE_TO);
const KEEP = flag("--keep");
const DRY = flag("--dry-run"); // 앱 연결·탭·팀/프로젝트만 확인하고 아무것도 보내지 않음 (비용 0)
const TAB = opt("--tab");
const SETTING_KEYS = ["model", "aspect", "resolution", "quality", "count", "custom_w", "custom_h", "openai_bg_transparent"];
// 연결 거부가 아닌 연결 실패는 실행 환경(Codex 샌드박스 등)이 네트워크를 막은 것일 수 있다.
const BLOCKED = "이 실행 환경이 네트워크를 막고 있다(예: Codex 샌드박스 — network_access 꺼짐). 앱이 켜져 있어도 이렇게 나온다. 네트워크가 허용된 상태(샌드박스 밖, 실행 승인)로 이 명령을 다시 실행할 것";
const MAX_IN_FLIGHT = 10;   // 앱 전체에서 동시에 진행 중인 이미지

// 커넥터 — 사용 기록과 하루 한도. 표는 커넥터가 내려줄 때 채운다(이 줄의 모양을 바꾸지 말 것).
const FREEWILL = "https://freewill-mcp.production-khu.workers.dev";
const FREEWILL_TICKET = "";
// 지침 버전 — 커넥터가 내려줄 때 채운다(이 줄 모양도 바꾸지 말 것). jobs.json 의 "guide" 와 다르면 이 대화가 읽은 지침이
// 옛것이다 → 보내지 않고 다시 읽게 한다(앱 설명서 버전과 같은 방식). 비어 있으면(커넥터에서 받은 게 아니면) 보지 않는다.
const FREEWILL_GUIDE = "";
const GUIDE_STALE = (had) => `지침이 바뀌었다 (이 대화가 읽은 지침 ${had || "버전 없음"} → 지금 ${FREEWILL_GUIDE}) — ` +
  `freewill_guide("start") 를 다시 받아 읽고 바뀐 규칙대로 프롬프트·확인 카드를 고친 뒤, jobs.json 에 "guide": "${FREEWILL_GUIDE}" 를 ` +
  "적어 다시 실행할 것. 프롬프트·설정이 달라졌으면 확인 카드부터 다시. 사용자에게 지침 버전 얘기는 하지 않는다";

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
// 표가 없으면(플러그인에 깔린 사본처럼 커넥터를 거치지 않음) 사람이 커넥터에 로그인해야 하고, 만료면 다시 받기만 하면 된다.
const NO_TICKET = !FREEWILL_TICKET
  ? "이 스크립트는 프리윌 스튜디오 MCP 커넥터에서 받은 것이 아니라(플러그인에 깔린 사본 등) 앱으로 보낼 수 없다. " +
    "freewill_script 도구가 있으면 freewill_script(\"send-to-nanobanana\") 로 받아 그 원문을 실행할 것. " +
    "도구가 없으면 커넥터 로그인 전이다 — 지침(SKILL.md)의 '로그인' 대로 에이전트가 로그인을 시작할 것 " +
    "(사람은 브라우저에서 회사 구글 계정만 고른다, 사용자에게 터미널 명령을 시키지 않는다). " +
    "나노바나나·시댄스 앱에는 로그인할 곳이 없으니 앱 안의 버튼·키를 지어내 안내하지 말 것"
  : "받은 지 12시간이 지난 스크립트다 — freewill_script(\"send-to-nanobanana\") 로 다시 받아 실행할 것(사용자가 할 일은 없다)";

// 이 PC(이 윈도 사용자)의 장치 ID — PC 이름을 바꿔도 하루 한도·기록이 이어지게 사용자 폴더에 한 번 만들어 둔다. 못 쓰면 "".
let deviceCache;
function device() {
  if (deviceCache !== undefined) return deviceCache;
  const file = path.join(os.homedir(), ".freewill-studio", "device.json");
  const read = () => {
    try {
      const id = JSON.parse(fs.readFileSync(file, "utf8").replace(/^[^{]*/, "")).id;   // PowerShell 이 쓴 BOM 은 버린다
      return /^[A-Za-z0-9-]{8,64}$/.test(id) ? id : "";
    } catch {
      return "";
    }
  };
  deviceCache = read();
  if (deviceCache) return deviceCache;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ id: crypto.randomUUID(), created: new Date().toISOString() }), { flag: "wx" });
  } catch {}   // 같이 돈 다른 실행이 먼저 만들었거나 쓸 수 없는 곳 — 다시 읽는다
  return (deviceCache = read());
}

async function usageApi(method, p, body) {
  let r;
  try {
    r = await fetch(`${FREEWILL}${p}`, {
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${FREEWILL_TICKET}` },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(`사용 기록 서버(프리윌 스튜디오 MCP)에 닿지 않아 보내지 않는다 — 인터넷 연결을 확인하거나, ${BLOCKED}`);
  }
  const j = await r.json().catch(() => null);
  // JSON 이 아닌 답 = 커넥터까지 못 감(클라우드플레어가 대신 답함). 기록이 안 남으니 보내지 않는다.
  if (!j) {
    return { http: r.status, ok: false, error: r.status === 429
      ? "클라우드플레어 무료 하루 한도(계정 전체 요청 10만 번)에 걸려 사용 기록을 남길 수 없다 — 한국 시간 오전 9시에 풀린다. 그때까지 MCP 로는 보내지 않는다(급하면 앱에서 직접)"
      : `사용 기록 서버가 지금 답하지 않는다(HTTP ${r.status}) — 잠시 뒤 다시. 기록이 안 남으니 보내지 않는다` };
  }
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

// Generate 는 지금 띄운 탭에 들어간다. 정한 탭이 화면에 없으면(처음부터, 또는 기다리는 사이 사람이 다른 탭으로 갔으면) 누를 때까지 기다린다.
async function waitForTab(tab, limitMs = 30 * 60 * 1000) {
  const started = Date.now();
  let hinted = false;
  for (;;) {
    const now = await activeTab();
    if (now?.pid === tab.pid) return;
    if (!hinted) {
      log(`  기다리는 중 — 앱에서 "${tab.name}" 탭을 누르면(화면에 띄우면) 바로 이어서 넣는다(지금 화면 "${now?.name ?? "?"}")`);
      hinted = true;
    }
    if (Date.now() - started > limitMs) throw new Error(`"${tab.name}" 탭이 ${Math.round(limitMs / 60000)}분 동안 화면에 뜨지 않음 — 그 사이 넣지 않은 작업은 보내지 않았다`);
    await sleep(2000);
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

// 작업 페이지(make-review)의 '보낼 것' — 보내기 전에 레퍼런스를 그림으로 본다(사용자 10/20 "돌리기 전에 어떤 레퍼런스 쓸 건지 시각적으로").
// jobs.json 에 "work"(작업 폴더)가 있을 때만. 보낸 뒤에는 '보냄'으로 바꾸고, 보낸 jobs.json 을 그 작업 폴더의 05_프롬프트 에 남긴다.
function writePlan(spec, plan, { sent = false, jobsFile = "" } = {}) {
  if (!spec.work) return;
  const work = path.resolve(String(spec.work));
  if (!fs.existsSync(work)) { log(`  참고: 작업 폴더가 없다(${work}) — 보낼 것을 남기지 않았다`); return; }
  try {
    const dir = path.join(work, "_검수");
    fs.mkdirSync(dir, { recursive: true });
    const now = new Date().toISOString();
    fs.writeFileSync(path.join(dir, "보낼것.json"), JSON.stringify({ ...plan, at: now, sent, ...(sent ? { sentAt: now } : {}) }, null, 1));
    if (sent && jobsFile) {
      const pd = path.join(work, "05_프롬프트");
      fs.mkdirSync(pd, { recursive: true });
      const to = path.join(pd, path.basename(jobsFile));
      if (path.resolve(to) !== path.resolve(jobsFile)) fs.copyFileSync(jobsFile, to);
    }
    log(`  작업 페이지 '보낼 것'${sent ? "을 보냄으로 바꿨다(jobs.json 은 05_프롬프트 에)" : "에 레퍼런스를 올렸다 — 페이지에서 그림으로 보여 준 뒤 확인 카드로"}: ${path.join(dir, "보낼것.json")}`);
  } catch (e) { log(`  참고: 보낼 것을 못 남김 — ${e.message}`); }
}

// 이미지 프롬프트에서 글로 짚을 수 있는 것(references/image-prompting.md · prompt-logic.md) — 막지 않고 "확인할 것"으로 보여 준다.
// 사용자의 잘 쓴 프롬프트(외주 프롬프트북 시트·스틸)에 대 보고 괜히 걸리던 것은 뺐다 — '8K' 디테일 묘사, 액션 스틸의 motion blur
function imageNotes(j, aspect) {
  const p = String(j.prompt).replace(/"[^"\n]*"|“[^”\n]*”/g, "");
  const notes = [];
  // 비율은 설정이 정한다 — 본문에 적은 비율이 이 작업의 비율 설정과 다르거나 서로 다르면 모순
  const ratios = [...new Set(p.match(/\b(?:16:9|9:16|21:9|9:21|4:3|3:4|1:1|3:2|2:3|4:5|5:4)\b/g) || [])];
  const fixed = /^\d+:\d+$/.test(String(aspect || "")) ? String(aspect) : "";
  if (ratios.length > 1 || (fixed && ratios.length && !ratios.includes(fixed))) {
    notes.push(`본문의 비율(${ratios.join(", ")})이 ${fixed && !ratios.includes(fixed) ? `설정 ${fixed} 와` : "서로"} 다르다 — 비율은 설정이 정한다. 본문에서 지우거나 설정과 맞춘다`);
  }
  // 빈 수식어만 — 'hyperrealistic photographic detail — pores …' 처럼 바로 디테일을 붙이는 말은 사용자 프롬프트북도 쓴다
  const slop = [...new Set((p.match(/\b(?:masterpiece|best quality|award[- ]winning|trending on artstation|stunning|breathtaking)\b/gi) || []).map((w) => w.toLowerCase()))];
  if (slop.length) notes.push(`효과 없는 말(${slop.join(", ")}) — 지우고 재질·빛·렌즈로 쓴다(image-prompting 4절)`);
  // 시트처럼 칸이 나뉜 그림은 칸마다 샷 크기가 달라서 빼고 본다
  if (!/\b(?:panels?|sheet|grid|side by side|split)\b/i.test(p) && /\b(?:extreme close-?up|close-?up|ECU|MCU|CU|macro)\b/i.test(p) &&
      /\b(?:feet|foot|shoes?|sneakers|boots|full[- ](?:body|length|figure)|head to (?:toe|shoes?))\b/i.test(p)) {
    notes.push("클로즈업인데 발·신발·전신이 같이 있다 — 한 화면에 함께 안 들어온다(prompt-logic 1절). 샷 크기를 바꾸거나 하나를 뺀다");
  }
  const moved = [...p.matchAll(/\b(?:crash zoom|whip pan|dolly[- ](?:in|out)|push[- ]in)\b/gi)]
    .some((m) => !/\b(?:no|never|not|nothing|nor|without|rather than|instead of)\b[^.;:]{0,30}$/i.test(p.slice(Math.max(0, m.index - 40), m.index)));
  if (moved) notes.push("스틸에 카메라 무빙 말(crash zoom · whip pan · dolly · push-in) — 스틸은 한 순간이다. 첫 프레임용이면 그 순간의 구도로 쓴다(prompt-logic 3절)");
  return notes;
}

async function main() {
  if (!file) fail("작업 파일(jobs.json)을 주세요");
  let spec;
  try { spec = JSON.parse(fs.readFileSync(file, "utf8").replace(new RegExp("^" + String.fromCharCode(0xfeff)), "")); } catch (e) { fail(`작업 파일을 못 읽음 — ${e.message}`); }
  const defaults = spec.defaults || {};
  const jobs = (spec.jobs || []).filter((j) => j && String(j.prompt || "").trim());
  if (!jobs.length) fail("보낼 작업이 없음 (prompt 가 빈 작업은 뺀다)");
  if (FREEWILL_GUIDE && spec.guide !== FREEWILL_GUIDE) fail(GUIDE_STALE(spec.guide));
  // refs 는 {"path","why"} — why 는 그 그림에서 가져올 것과 같이 끌려올 수 있는 것을 어떻게 막는지 한 줄(사용자 10/20 "생각 없이 넣지 말고")
  for (const j of jobs) {
    const list = (j.refs || []).map((r) => (typeof r === "string" ? { path: r } : r || {}));
    j.refs = list.map((r) => r.path);
    j.refWhy = list.map((r) => String(r.why ?? "").trim());
    for (const fp of j.refs) if (!fp || !fs.existsSync(fp)) fail(`레퍼런스 파일이 없음: ${fp}`);
  }
  const noWhy = jobs.flatMap((j) => j.refs.filter((_, i) => !j.refWhy[i]).map((fp) => `${j.name || "(이름 없음)"}: ${path.basename(fp)}`));
  if (noWhy.length) fail(`레퍼런스마다 넣는 이유(why)를 적을 것 — refs 를 {"path","why"} 로: 그 그림에서 가져올 것(얼굴·옷·공간·소품·구도)과 ` +
    `같이 끌려올 수 있는 것(다른 인물·글자·구도·그림체·조명)을 어떻게 막는지 한 줄. 이유를 못 쓰면 빼고 글로 쓴다(image-prompting 2절)\n` +
    noWhy.map((x) => `  - ${x}`).join("\n"));

  // 1) 앱이 켜져 있는지, 보안 토큰
  let html = "";
  let netCode = "";
  try { html = await (await fetch(`${NB}/`, { signal: AbortSignal.timeout(3000) })).text(); }
  catch (e) { netCode = e?.cause?.code || (e?.name === "TimeoutError" ? "시간 초과" : e?.name || "오류"); }
  token = html.match(/<meta name="nb-csrf" content="([^"]+)"/)?.[1] || "";
  if (!token && netCode && netCode !== "ECONNREFUSED") fail(`나노바나나에 연결 못 함 (${netCode}) — ${BLOCKED}`);
  if (!token) fail("나노바나나가 꺼져 있다 — 앱을 켜 달라고 할 것");

  // 2) 어느 탭으로 들어가는지, 팀·프로젝트가 골라져 있는지.
  // 앱의 생성(/api/generate)·레퍼런스 기능은 화면에 떠 있는 탭에만 들어간다 — 탭을 지정하는 칸이 없다. 탭 전환 API 는 있지만
  // 앱 화면은 바깥에서 바뀐 걸 모른다(사람이 누를 때만 화면을 다시 그린다). 몰래 바꾸면 화면엔 옛 탭이 보이는데 그 상태로 친 글·넣은
  // 그림이 다른 탭으로 들어간다. 그래서 바꾸지 않고, 정한 탭(jobs.json "tab" · --tab)이 화면에 없으면 사람이 누를 때까지 기다린다
  // (10/15 사용자 "탭을 항상 클릭해 줘야 하는 이유는?" — 앱이 탭을 지정해 생성하게 바뀌면 이 기다림도 없앤다).
  const want = TAB || String(spec.tab || "");
  let tab = await activeTab();
  if (!tab) fail("지금 탭을 알 수 없음");
  const screenTab = tab.name;
  let billing = null;
  if (want && tab.name !== want) {
    const tabs = (await get("/api/projects"))?.projects || [];
    const target = tabs.find((p) => p.name === want);
    if (!target) fail(`나노바나나에 "${want}" 탭이 없다(지금 탭: ${tabs.map((p) => `"${p.name}"`).join(", ")}) — 이름을 확인하거나 앱에서 만들어 달라고 할 것`);
    if (!(target.billing_team_id && target.billing_project_id)) fail(`"${want}" 탭에 팀·프로젝트가 안 골라져 있다 — 앱에서 그 탭을 열고 고르게 할 것`);
    if (DRY) {
      billing = { team_id: target.billing_team_id, project_id: target.billing_project_id };
      tab = target;
    } else {
      log(`"${want}" 탭이 화면에 떠 있어야 넣을 수 있다(앱의 생성 기능은 화면에 떠 있는 탭에만 들어간다) — 지금 화면은 "${screenTab}" 탭`);
      await waitForTab(target, 10 * 60 * 1000);
      tab = await activeTab();
    }
  }
  billing = billing || await get("/api/billing/state");
  if (!(billing?.project_id && billing.confirmed !== false)) fail(`"${tab.name}" 탭에 팀·프로젝트가 안 골라져 있다 — 앱에서 먼저 고르게 할 것`);
  log(`탭 "${tab.name}" · ${billing.team_id} / ${billing.project_id} 로 ${jobs.length}건 ${DRY ? "보낼 예정 (dry-run — 아무것도 안 보냄)" : "보냄"}`);
  if (DRY && tab.name !== screenTab) {
    log(`  참고: 지금 화면은 "${screenTab}" 탭 — 보낼 때 "${tab.name}" 탭이 화면에 없으면 사용자에게 그 탭을 한 번 눌러 달라고 하고 기다린다(누르면 바로 이어서 넣는다)`);
  }
  // 프롬프트 본문은 영어 — 따옴표 안(그림 속 글자)만 그 언어로. 일부러 한국어면 "prompt_language": "ko" (시댄스와 같은 규칙)
  const korean = jobs.filter((j) => (j.prompt_language ?? defaults.prompt_language) !== "ko" &&
    /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(String(j.prompt).replace(/"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’|「[^」\n]*」|『[^』\n]*』/g, "")));
  if (korean.length) {
    fail(`프롬프트를 고칠 것 (지침 4단계 '앱에 맞춘 규칙'): ${korean.map((j) => j.name || "(이름 없음)").join(", ")} — ` +
      "본문이 한국어다. 영어로 쓴다(그림에 넣을 글자만 따옴표 안에 그 언어로). 사용자용 한국어 요약은 확인 카드에");
  }

  // 3) 이번에 넣을 장수와 한도 — 하루 한도에 걸리면 하나도 보내지 않는다
  const base = await get("/api/settings");
  const notes = jobs.flatMap((j) => imageNotes(j, j.aspect ?? defaults.aspect ?? base.aspect).map((n) => `${j.name || "(이름 없음)"}: ${n}`));
  if (notes.length) log(`  확인할 것 (references/image-prompting.md · prompt-logic.md · 맞는 경우면 그대로 둔다):\n${notes.map((n) => `  - ${n}`).join("\n")}`);
  const countOf = (j) => Math.max(1, Math.round(Number(j.count ?? defaults.count ?? base.count) || 1));
  const big = jobs.find((j) => countOf(j) > MAX_IN_FLIGHT);
  if (big) fail(`한 작업은 ${MAX_IN_FLIGHT}장까지 — "${big.name || ""}" 은 ${countOf(big)}장. 작업을 나눠서 적을 것`);
  const total = jobs.reduce((a, j) => a + countOf(j), 0);
  const owner = ticketOwner();
  let quota = "로그인 표 없음 — 보낼 때는 커넥터에서 다시 받은 스크립트로";
  if (owner) {
    // 하루 한도는 PC(PC 이름 + 윈도 사용자) 기준 — 관리자가 계정 전체 상한을 걸어 두면 더 빡빡한 쪽이 온다(scope)
    const host = os.hostname();
    const me = await usageApi("GET", `/usage/me?pc=${encodeURIComponent(host)}&user=${encodeURIComponent(os.userInfo().username)}&device=${encodeURIComponent(device())}`);
    if (me.http === 401 || me.http === 403) fail(me.error || NO_TICKET);   // 403 = 관리자가 막은 계정
    const q = me.apps?.nanobanana;
    if (!q) fail(me.error || `사용 기록 서버가 답하지 않는다 (${me.http}) — 잠시 뒤 다시`);
    if (q.limit === 0) fail(`${q.scope === "account" ? `${owner.e} 계정은` : `이 PC(${host})는`} 관리자가 MCP 이미지 생성을 막아 두었다 — 관리자에게 물을 것`);
    if (q.used + total > q.limit) {
      fail(`오늘 ${q.scope === "account" ? `${owner.e} 계정(모든 PC 합계)이` : `이 PC(${host})가`} MCP 로 보낸 이미지 ${q.used}장 — ` +
        `하루 ${q.limit}장 한도라 이번 ${total}장은 보내지 않는다. 장수를 줄이거나 내일 보내고, 급하면 앱에서 직접 만들게 할 것`);
    }
    quota = `${owner.e} · ${host} · 오늘 남은 한도 ${q.limit - q.used}장`;
  } else if (!DRY) {
    fail(NO_TICKET);
  }
  log(`  이번 ${total}장 · ${quota} · 지금 앱에서 진행 중 ${await inFlight()}장 ` +
    `(동시 ${MAX_IN_FLIGHT}장까지 — 넘으면 앞의 것이 끝나야 다음 작업을 넣는다)`);
  // 작업 페이지의 '보낼 것' — 작업마다 모델·레퍼런스(그림으로 뜬다)
  const planOf = () => ({ app: "nanobanana", tab: tab.name, billing: `${billing.team_id} / ${billing.project_id}`,
    jobs: jobs.map((j) => ({ name: j.name || "", model: j.model ?? defaults.model ?? base.model, mode: `${j.resolution ?? defaults.resolution ?? base.resolution} · ${j.aspect ?? defaults.aspect ?? base.aspect}`,
      prompt: String(j.prompt), refs: j.refs.map((p, k) => ({ path: path.resolve(p), why: j.refWhy[k] })) })) });
  if (DRY) {
    log(tab.name === screenTab ? `  지금 탭 설정: ${base.model} · ${base.resolution} · ${base.aspect} · ×${base.count}`
      : `  설정: jobs.json 에 적은 값이 들어가고, 비운 칸은 "${tab.name}" 탭에 정해 둔 값을 따른다(아래 비운 칸은 지금 화면 탭 값으로 보여 줌)`);
    for (const [i, j] of jobs.entries()) {
      const m = j.model ?? defaults.model ?? base.model, r = j.resolution ?? defaults.resolution ?? base.resolution;
      log(`  ${i + 1}. ${j.name || ""} · ${m} ${r} ×${countOf(j)} · 레퍼런스 ${j.refs.length}장`);
      j.refs.forEach((p, k) => log(`     [Image ${k + 1}] ${path.basename(p)} — ${j.refWhy[k]}`));   // 확인 카드에 그대로 옮긴다
    }
    writePlan(spec, planOf(), {});
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
      billing: `${billing.team_id} / ${billing.project_id}`, project: tab.name, pc: os.hostname(), user: os.userInfo().username, device: device(),
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
  writePlan(spec, planOf(), { sent: true, jobsFile: file });

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
  // 작업별로 나눠 적는다 — 갤러리는 그림마다 프롬프트·모델을 갖고 있다. 모델이 같은 작업이 여럿이면 파일 이름만으로는
  // 어느 작업 것인지 모른다. 같은 프롬프트를 모델만 바꿔 보낸 작업은 모델로 가른다.
  const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const sentJobs = jobs.slice(0, sent);
  const jobOf = (i) => {
    const same = sentJobs.filter((j) => norm(j.prompt) === norm(i.prompt));
    return same.length > 1 ? same.find((j) => (j.model ?? defaults.model ?? base.model) === i.model) || same[0] : same[0];
  };
  log(`새로 들어온 이미지 ${fresh.length}장 — 작업별:`);
  for (const [k, j] of sentJobs.entries()) {
    const mine = fresh.filter((i) => jobOf(i) === j);
    log(`  ${j.name || `job_${k + 1}`} — ${mine.length}/${countOf(j)}장`);
    for (const i of mine) log(`    ${i.filepath}`);
  }
  const other = fresh.filter((i) => !jobOf(i));
  if (other.length) {
    log(`  어느 작업인지 모름 ${other.length}장 — 그사이 사람이 이 탭에서 만든 것일 수 있다`);
    for (const i of other) log(`    ${i.filepath}`);
  }

  // --save-to: 작업 폴더로 복사한다(지침 6단계 "정리") — <작업 이름>_A.png, _B … 같은 이름이 있으면 _2. 앱 저장 폴더의 원본은 그대로
  // 둔다(옮기면 앱 갤러리에서 사라진다). 어느 파일이 어디서 왔는지는 _목록.tsv 에.
  if (SAVE_TO) {
    const safe = (s) => String(s || "job").replace(/[\\/:*?"<>|]+/g, "_").trim();
    fs.mkdirSync(SAVE_TO, { recursive: true });
    const rows = [];
    for (const [k, j] of sentJobs.entries()) {
      for (const [t, i] of fresh.filter((x) => jobOf(x) === j).entries()) {
        if (!fs.existsSync(i.filepath)) { log(`  못 옮김 — 원본이 없음: ${i.filepath}`); continue; }
        const name = safe(j.name || `job_${k + 1}`), take = String.fromCharCode(65 + t), ext = path.extname(i.filepath) || ".png";
        let dest = path.join(SAVE_TO, `${name}_${take}${ext}`);
        for (let n = 2; fs.existsSync(dest); n++) dest = path.join(SAVE_TO, `${name}_${take}_${n}${ext}`);
        fs.copyFileSync(i.filepath, dest);
        rows.push([j.name || `job_${k + 1}`, take, i.model || "", i.filepath, path.basename(dest)].join("\t"));
      }
    }
    const list = path.join(SAVE_TO, "_목록.tsv");
    if (rows.length) fs.appendFileSync(list, `${fs.existsSync(list) ? "" : "작업\t테이크\t모델\t원본\t파일\n"}${rows.join("\n")}\n`);
    log(rows.length ? `그림 ${rows.length}장을 ${SAVE_TO} 로 복사했다(앱 원본은 그대로) · 목록 _목록.tsv` : "복사한 그림 없음");
  }
}

main().catch((e) => {
  console.error(`멈춤: ${e.message}`);
  process.exitCode = 1;
});
