#!/usr/bin/env node
// 실행 중인 나노바나나 앱으로 생성 작업을 보낸다 — 앱 자체의 주소로, 앱이 평소대로 만들고 기록한다.
//
// 앱 코드를 따로 불러와 생성하면(헤드리스) 앱 화면은 아무것도 모른다. 이 스크립트는 앱 자체의 주소로 보낸다.
// 그래서 앱 탭에 진행 표시가 뜨고, 완성되면 그 탭 갤러리에 들어오고, 과금도 앱이 평소대로 기록한다.
//
// 앱 v2026-10-2001 부터(앱이 /api/projects 의 agent_pid 로 알린다): 보낼 탭(pid)과 그 작업의 프롬프트·설정·레퍼런스를
// 한 요청에 실어 보낸다 — 화면의 탭도, 그 탭의 입력칸도 바뀌지 않는다(사용자 10/20 "탭 이동 없이"). 결과는 묶음 id 로 찾는다.
// 그 전 앱: 탭을 지정할 수 없어 정한 탭이 화면에 떠 있을 때 그 탭 입력칸에 넣고 Generate → 입력칸을 원래대로 돌려놓는다
// (탭이 화면에 없으면 사람이 누를 때까지 기다린다). 앱은 작업마다 그 순간의 설정을 스냅샷으로 저장해 각자 제 설정으로 생성된다.
//
// 팀·프로젝트(과금)는 사람이 고른다 — 에이전트가 짐작해 넣지 않는다. 확인 안 된 탭이면 보내지 않고 명단을 내주고, 사용자가 대화에서 고른 값만
// --set-billing 으로 그 탭에 넣는다(사용자 11/4). 앱에서 고르겠다면 탭 옆 "!" · 우클릭(탭을 안 옮기고 고른다).
//
// 읽기에 /api/status 와 /api/events 는 절대 쓰지 않는다 — status 는 읽는 순간 앱의 '창 닫기
// 요청' 신호를 지우고, events 는 꺼내 가는 큐라 앱 화면의 팝업을 가로챈다. 진행 상황은
// /api/projects 의 탭 요약으로 본다.
//
// 로그인과 사용 기록: 작업마다 앱에 넣기 직전에 프리윌 스튜디오 MCP 커넥터에 "누가·어느 PC·무슨 모델·몇 장" 을 남기고
// 하루 한도를 묻는다 — 표(사용 기록용 토큰)가 없거나 커넥터에 닿지 않으면 보내지 않는다. 프롬프트·그림은 보내지 않는다.
// 표는 이 스크립트가 커넥터에서 직접 받아 사용자 폴더에 둔다(12시간): 없으면 "표 승인 필요 — 요청 번호" 를 내고 멈춤 →
// 에이전트가 freewill_ticket(요청 번호) → 같은 명령을 다시 실행하면 받아 간다. 표가 대화에 나오지 않게(아래 loadTicket).
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
//   node send-to-nanobanana.mjs jobs.json --again=a,b
//                                                    24시간 안에 이미 보낸 a · b 를 또 보냄 — 사용자에게 물은 뒤에만(돈이 든다), 또 만들 작업만 이름으로.
//                                                    없으면 이미 보낸 것은 건너뛰고(새 앱은 안 끝난 것을 이어서 지켜보고 놓는다), 앱에 들어갔는지
//                                                    모르는 작업은 보내지 않는다 — 끊긴 뒤 같은 명령을 다시 실행해도 두 번 과금되지 않게
//   node send-to-nanobanana.mjs jobs.json --keep     (옛 앱) 탭 입력값을 되돌리지 않음
//   node send-to-nanobanana.mjs --tab "K" jobs.json  K 탭으로 보냄(jobs.json 의 "tab" 과 같다 — 둘이 다르면 멈춘다). 새 앱은 화면을 안 바꾸고 바로,
//                                                    옛 앱은 K 가 화면에 없으면 사람이 K 를 누를 때까지 기다렸다 이어서 넣는다
//   node send-to-nanobanana.mjs --create-tab "K"     (새 앱, 사용자가 "만들어"라고 했을 때만) 화면을 안 바꾸고 K 탭을 만든다 —
//                                                    새 탭은 과금이 비어 있다. 내주는 명단에서 사용자가 고른다
//   node send-to-nanobanana.mjs --choices            탭 · 팀 · 프로젝트 명단과 묻는 법 — 사용자에게 줄 선택지. 아무것도 안 바꾼다
//   node send-to-nanobanana.mjs --set-billing --tab "K" --team "팀 이름" --project "프로젝트 이름"
//                                                    (새 앱, 사용자가 대화에서 고른 값만) K 탭 과금을 넣는다 — 명단 이름 그대로만 받고, 화면 탭은 안 바뀐다.
//                                                    이미 다른 과금이 골라진 탭은 사용자가 바꾸라고 했을 때만 --change
//
// jobs.json:
//   {
//     "guide": "지침 버전 (freewill_guide(\"start\") 맨 위의 값) — 지침이 바뀌었으면 스크립트가 다시 읽으라고 멈춘다",
//     "tab": "보낼 탭 이름 — 사용자가 이 작업용으로 만들어 둔 탭(팀·프로젝트가 골라져 있어야 한다). 탭이 둘 이상이면 꼭 적는다(비우면 멈춘다).
//             과금은 탭에 달려 있어 한 파일은 한 탭 — 프로젝트(탭)가 여럿이면 탭마다 파일 하나(작업 줄에 tab · billing 을 적으면 멈춘다)",
//     "billing": "확인 카드에 보여 준 과금 — dry-run 의 '과금 TA팀 · [26P47]…' 이름 그대로(팀까지). 보낼 때 꼭 적는다. 그 탭 과금과 다르거나 보내는 도중 바뀌면 멈춘다",
//     "work": "작업 폴더(사용자가 알려 준 프로젝트 폴더) — dry-run 이 <작업 폴더>/_검수/보낼것.json 에 레퍼런스를 남겨 작업 페이지의
//              '보낼 것'에 그림으로 뜨고, 끝나면 결과를 씬·컷 폴더에 놓는다(지켜보기를 켜지 않아도 기다렸다 놓는다)",
//     "code": "프로젝트 코드(예: ABC) — 파일 이름 맨 앞. 한 번 적으면 _작업설정.json 에 남는다",
//     작업마다 "scene": "S010", "cut": "C0010" → <작업>\S010\C0010\ABC_S010_C0010_I001.png (번호는 그 컷에서 이어서)
//              또는 "asset": "인물|로케이션|프랍|참고" → <작업>\01_에셋\인물\<작업 이름>_A.png
//              "version": "A"(A/B안 — 목록에 남김), "covers": "C0010~C0040"(한 장이 여러 컷을 덮으면)
//     "defaults": { "model": "gpt-image-2.6-sunburst", "resolution": "4K", "aspect": "16:9",
//                   "quality": "max", "count": 1 },
//     "complexity": GPT Image 2.6 전용(low · medium · high) — 렌더링 전에 얼마나 계획할지. 요금은 같고 비우면 그 탭 값(기본 high). 다른 모델에 적으면 앱이 거절한다
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
const opt = (f) => { const i = args.indexOf(f); if (i >= 0) return args[i + 1]; const e = args.find((a) => a.startsWith(`${f}=`)); return e ? e.slice(f.length + 1) : null; };
const file = args.find((a, i) => !a.startsWith("--") && !["--tab", "--save-to", "--create-tab", "--team", "--project"].includes(args[i - 1]));
const CREATE_TAB = opt("--create-tab");
const CHOICES = flag("--choices");
const SET_BILLING = flag("--set-billing");
const SAVE_TO = opt("--save-to");
const WATCH = flag("--watch") || Boolean(SAVE_TO);
const KEEP = flag("--keep");
const DRY = flag("--dry-run"); // 앱 연결·탭·팀/프로젝트만 확인하고 아무것도 보내지 않음 (비용 0)
const TAB = opt("--tab");
const SETTING_KEYS = ["model", "aspect", "resolution", "quality", "count", "custom_w", "custom_h", "openai_bg_transparent", "complexity"];
// 연결 거부가 아닌 연결 실패는 실행 환경(Codex 샌드박스 등)이 네트워크를 막은 것일 수 있다.
const BLOCKED = "이 실행 환경이 네트워크를 막고 있다(예: Codex 샌드박스 — network_access 꺼짐). 앱이 켜져 있어도 이렇게 나온다. 네트워크가 허용된 상태(샌드박스 밖, 실행 승인)로 이 명령을 다시 실행할 것";
const MAX_IN_FLIGHT = 10;   // 앱 전체에서 동시에 진행 중인 이미지

// 커넥터 — 사용 기록과 하루 한도.
const FREEWILL = "https://freewill-mcp.production-khu.workers.dev";
// 옛 방식(원문에 박힌 표) — 시험에서만 쓴다. 지금 커넥터는 비워 두고 받는 사람만 아래에 채운다(두 줄 모양을 바꾸지 말 것).
const FREEWILL_TICKET = "";
const FREEWILL_ACCOUNT = "";
// 지침 버전 — 커넥터가 내려줄 때 채운다(이 줄 모양도 바꾸지 말 것). jobs.json 의 "guide" 와 다르면 이 대화가 읽은 지침이
// 옛것이다 → 보내지 않고 다시 읽게 한다(앱 설명서 버전과 같은 방식). 비어 있으면(커넥터에서 받은 게 아니면) 보지 않는다.
const FREEWILL_GUIDE = "";
const GUIDE_STALE = (had) => `지침이 바뀌었다 (이 대화가 읽은 지침 ${had || "버전 없음"} → 지금 ${FREEWILL_GUIDE}) — ` +
  `freewill_guide("start") 를 다시 받아 읽고 바뀐 규칙대로 프롬프트·확인 카드를 고친 뒤, jobs.json 에 "guide": "${FREEWILL_GUIDE}" 를 ` +
  "적어 다시 실행할 것. 프롬프트·설정이 달라졌으면 확인 카드부터 다시. 사용자에게 지침 버전 얘기는 하지 않는다";
// 이 스크립트를 받은 뒤 지침이 바뀜 — 커넥터가 사용 기록 답에 지금 버전을 알려 준다(스크립트는 만료되지 않으니 이걸로 옛 스크립트를 걸러 낸다)
const SCRIPT_OLD = (now) => `이 스크립트를 받은 뒤 지침이 바뀌었다(스크립트 ${FREEWILL_GUIDE} → 지금 ${now}) — freewill_guide("start") 를 다시 받아 읽고 ` +
  `freewill_script("send-to-nanobanana") 로 스크립트도 새로 받아, 바뀐 규칙대로 프롬프트·확인 카드를 고친 뒤 jobs.json 에 "guide": "${now}" 를 적어 다시 실행할 것. ` +
  "사용자에게 지침 버전 얘기는 하지 않는다";

let token = "";
const log = (...m) => console.log(...m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 보낸 기록(사용자 11/2 "나노바나나도 똑같이") — 끊긴 대화가 같은 명령을 다시 돌리거나 앱을 다시 켜도 같은 그림을 또 만들지 않게
// 작업마다 사용자 폴더에 남긴다: 앱에 넣기 직전 '보내는 중' → 묶음 id 와 '보냄' → 결과까지 봤으면 '끝'.
// 24시간 안에 같은 것(탭·프롬프트·설정·레퍼런스·놓을 곳 — 이름은 안 본다)을 다시 보내면 보냄·끝은 건너뛰고(새 앱은 안 끝난 것을
// 이어서 지켜보고 놓는다), 앱에 들어갔는지 모르는 것은 멈춘다. 다 실패·취소된 묶음(그림 0장)은 기록에서 빼서 다시 보낼 수 있다.
// 일부러 또 만들 때만 --again=<작업 이름,…> — 돈이 드니 사용자에게 물은 뒤, 또 만들 작업만 이름으로. 이름 없는 --again 은 받지 않는다
// (파일 안의 이미 보낸 작업까지 또 나가므로 — 11/2 검수).
const AGAIN_ARG = args.find((a) => a === "--again" || a.startsWith("--again="));
const AGAIN = new Set((AGAIN_ARG || "").slice(8).split(",").map((s) => s.trim()).filter(Boolean));
const RUN_AT = Date.now();
const LEDGER = path.join(os.homedir(), ".freewill-studio", "nanobanana-sent.json");
// 기록 파일은 여러 실행(Claude · Codex · 백그라운드)이 같이 쓴다 — 잠금 안에서 읽고 고치고 쓴다. 깨진 파일은 빈 기록으로 보지 않는다(보내지 않음).
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function ledgerLocked(fn) {
  const lock = `${LEDGER}.lock`;
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  for (const t0 = Date.now(); ;) {
    // 윈도는 다른 실행이 잠금을 지우는 순간 EPERM 등을 준다 — 기다렸다 다시
    try { fs.writeFileSync(lock, String(process.pid), { flag: "wx" }); break; } catch (e) { if (!["EEXIST", "EPERM", "EACCES", "EBUSY"].includes(e.code)) throw e; }
    try { if (Date.now() - fs.statSync(lock).mtimeMs > 10000) fs.rmSync(lock, { force: true }); } catch {}   // 주인이 죽은 잠금
    if (Date.now() - t0 > 30000) throw new Error("보낸 기록 잠금을 30초 동안 못 얻음");
    sleepSync(30 + Math.random() * 70);
  }
  try { return fn(); } finally { try { fs.rmSync(lock, { force: true }); } catch {} }
}
function readLedger() {
  let text;
  for (let i = 0; ; i++) {   // 백신 · 다른 실행이 잠깐 잡고 있으면 조금 기다렸다 다시 읽는다
    try { text = fs.readFileSync(LEDGER, "utf8"); break; } catch (e) {
      if (e.code === "ENOENT") return [];
      if (i >= 4) throw new Stop(`보낸 기록 파일을 못 읽음(${e.code}) — 두 번 과금될 수 있어 보내지 않는다. 잠시 뒤 다시 실행할 것`);
      sleepSync(100);
    }
  }
  let l = null;
  try { l = JSON.parse(text); } catch {}
  if (!Array.isArray(l)) {
    throw new Stop(`보낸 기록 파일이 깨졌다(${LEDGER}) — 두 번 과금될 수 있어 보내지 않는다. 그 파일을 지우지 말 것(지우면 24시간 안에 보낸 것을 또 보낼 수 있다). ` +
      `사용자에게 알리고, 마지막 정상본(${LEDGER}.bak)으로 바꿔 놓을지 정하게 할 것 — 그 사이 보낸 것이 빠졌을 수 있으니 앱 갤러리를 먼저 확인`);
  }
  return l.filter((x) => Date.now() - x.at < 24 * 3600e3);
}
function writeLedger(fn) {
  ledgerLocked(() => {
    const next = JSON.stringify(fn(readLedger()));
    const tmp = `${LEDGER}.${process.pid}.${crypto.randomUUID().slice(0, 8)}.tmp`;
    try {
      fs.writeFileSync(tmp, next);
      fs.renameSync(tmp, LEDGER);
    } catch (e) { try { fs.rmSync(tmp, { force: true }); } catch {} throw e; }
    try { fs.writeFileSync(`${LEDGER}.bak`, next); } catch {}   // 마지막 정상본 — 못 써도 보내기는 막지 않는다
  });
}
// 넣기 전 기록 — 남겼는지 다시 읽어 확인한 뒤에만 보낸다(못 남긴 채 보내면 다시 실행할 때 또 나간다)
const ledgerAdd = (e) => {
  const rid = crypto.randomUUID();
  try {
    writeLedger((l) => [...l, { rid, at: Date.now(), ...e }]);
    if (!readLedger().some((x) => x.rid === rid)) throw new Error("남긴 줄이 없다");
  } catch (err) { throw err instanceof Stop ? err : new Stop(`보낸 기록을 못 남겨 보내지 않는다 — ${err.message}`); }
  return rid;
};
// 보낸 뒤 고치기 — patch 가 null 이면 기록에서 뺀다(확실히 안 만들어짐 — 다시 보내도 된다). 못 고쳐도 이미 보냈으니 알리기만
const ledgerSet = (rid, patch) => {
  try { writeLedger((l) => (patch ? l.map((x) => (x.rid === rid ? { ...x, ...patch } : x)) : l.filter((x) => x.rid !== rid))); }
  catch (e) { log(`  참고: 보낸 기록을 못 고침 — ${e.message}`); }
};
// 작업의 마지막 기록 — 11/2 낮 판 기록(같은 작업이 같은 키로 여러 줄)은 몇 번째인지로 짝짓는다(11/4 뒤엔 없어도 됨)
const lastOf = (j) => { const l = readLedger(); return l.filter((x) => x.key === j.key).pop() || l.filter((x) => x.key === j.legacy)[j.nth - 1]; };
// 이번 실행이 시작된 뒤 남은 그 작업의 기록 — 같은 명령을 동시에 돌린 다른 실행이 넣은 것(그 전 줄은 분류에서 이미 봤다)
const sentSince = (j) => readLedger().filter((x) => x.key === j.key && x.at >= RUN_AT).pop();
const sentWhen = (e) => new Date(e.at).toLocaleString("ko-KR", { hour12: false });

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
      // 윈도는 다른 실행이 잠금을 지우는 순간 EPERM 등을 준다 — 기다렸다 다시(탭마다 동시에 보낼 때)
      if (!["EEXIST", "EPERM", "EACCES", "EBUSY"].includes(e.code)) throw e;
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

// 표 — 대화에 나오지 않게 이 스크립트가 커넥터에서 직접 받아 사용자 폴더에 둔다(10/22 대화 속 표를 Claude 자동 권한 검사가
// '자격 증명 유출'로 막음). 없거나 만료면 요청 번호를 내고 멈춤 → 에이전트가 freewill_ticket(요청 번호)로 승인 → 같은 명령을
// 다시 실행하면 받아 간다. 요청 번호는 이 PC 에만 있는 비밀값의 지문이라 번호만으로는 표를 못 받는다.
const TICKET_FILE = path.join(os.homedir(), ".freewill-studio", "ticket.json");
const TICKET_ASK = path.join(os.homedir(), ".freewill-studio", "ticket-ask.json");
let TICKET = FREEWILL_TICKET;
const ticketBody = (t) => {
  try { return JSON.parse(Buffer.from(String(t).split(".")[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); } catch { return null; }
};
// 표 안의 이름·만료만 읽는다(서명은 커넥터가 확인한다). 없거나 만료면 null.
function ticketOwner() {
  const t = TICKET ? ticketBody(TICKET) : null;
  return t && t.x > Date.now() ? t : null;
}
const readTicketFile = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8").replace(/^[^{]*/, "")); } catch { return null; } };
const writeTicketFile = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o), { mode: 0o600 }); };
const askLine = (code) => `표 승인 필요 — freewill_ticket 도구를 request "${code.match(/.{4}/g).join("-")}" 로 부른 뒤 같은 명령을 다시 실행할 것. ` +
  "사용자에게 묻지 않는다 — 표는 이 스크립트가 커넥터에서 직접 받아 이 PC 에 둔다(대화·명령줄에 옮겨 적지 않는다). " +
  "이 대화에 freewill_ticket 이 안 보이면(그 도구가 생기기 전에 시작한 대화) 도구 검색으로 찾아보고, 없으면 freewill_script 를 " +
  `name 은 아무거나, approve: "${code.match(/.{4}/g).join("-")}" 로 불러도 같다 — 새 대화 · 작업 카드를 만들지 않는다`;
// 표가 있으면 null, 없으면 할 일(요청 번호 안내)을 돌려준다.
async function loadTicket() {
  if (ticketOwner()) return null;
  if (!FREEWILL_ACCOUNT) return NO_TICKET;
  const saved = readTicketFile(TICKET_FILE);
  const st = saved?.ticket ? ticketBody(saved.ticket) : null;
  if (st && saved.account === FREEWILL_ACCOUNT && st.x > Date.now() + 5 * 60 * 1000) { TICKET = saved.ticket; return null; }
  const ask = readTicketFile(TICKET_ASK);
  if (ask?.v && ask.code && Date.now() - ask.at < 10 * 60 * 1000) {
    let r;
    try {
      r = await fetch(`${FREEWILL}/ticket/claim`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verifier: ask.v }), signal: AbortSignal.timeout(15000) });
    } catch {
      throw new Error(`사용 기록 서버(프리윌 스튜디오 MCP)에 닿지 않아 보내지 않는다 — 인터넷 연결을 확인하거나, ${BLOCKED}`);
    }
    const j = await r.json().catch(() => null);
    if (j?.ok && j.ticket) {
      writeTicketFile(TICKET_FILE, { ticket: j.ticket, account: FREEWILL_ACCOUNT, saved: new Date().toISOString() });
      try { fs.rmSync(TICKET_ASK, { force: true }); } catch {}
      TICKET = j.ticket;
      return null;
    }
    if (r.status !== 404) return j?.error || `사용 기록 서버가 지금 답하지 않는다(HTTP ${r.status}) — 잠시 뒤 다시`;
    return askLine(ask.code);   // 아직 승인 전 — 같은 번호
  }
  const v = crypto.randomBytes(32).toString("hex");
  const code = crypto.createHash("sha256").update(v).digest("hex").slice(0, 16);
  writeTicketFile(TICKET_ASK, { v, code, at: Date.now() });
  return askLine(code);
}
// 표가 없고 커넥터에서 받은 스크립트도 아니면(플러그인에 깔린 사본 등) 사람이 커넥터에 로그인해야 한다.
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
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${TICKET}` },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(`사용 기록 서버(프리윌 스튜디오 MCP)에 닿지 않아 보내지 않는다 — 인터넷 연결을 확인하거나, ${BLOCKED}`);
  }
  if (r.status === 401 && TICKET !== FREEWILL_TICKET) { try { fs.rmSync(TICKET_FILE, { force: true }); } catch {} }   // 다음 실행이 새로 받게
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
// 보낸 jobs.json 원문을 작업 폴더 05_프롬프트 에 남긴다 — 프롬프트 북 · 작업 페이지가 결과를 만든 프롬프트를 여기서 찾는다(목록의 판 지문).
// 읽을 때 잡아 둔 원문 그대로(보내는 사이 파일을 고쳐도), 같은 원문이 이미 있으면 두지 않고, 이름이 겹치면 시각을 붙인다.
// jobs 파일이 05_프롬프트 안에 있어도 따로 남긴다 — 제자리에서 고쳐 다시 보내면 앞 판이 사라지므로(11/2 검수). 작업마다 넣은 뒤 · 이어 받을 때 부른다
let JOBS_TEXT = "";
function keepJobs(work, jobsFile) {
  try {
    const pd = path.join(work, "05_프롬프트");
    fs.mkdirSync(pd, { recursive: true });
    const self = path.resolve(jobsFile);
    // 같은 원문 찾기 — 못 읽는 것(폴더 · 잠긴 파일)은 건너뛴다
    const same = (n) => { try { return fs.readFileSync(path.join(pd, n), "utf8") === JOBS_TEXT; } catch { return false; } };
    if (fs.readdirSync(pd).some((n) => /\.json$/i.test(n) && path.resolve(pd, n) !== self && same(n))) return;
    const stem = path.parse(jobsFile).name, stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
    let to = path.join(pd, `${stem}.json`);
    for (let n = 1; fs.existsSync(to); n++) to = path.join(pd, `${stem}_${stamp}${n > 1 ? `_${n}` : ""}.json`);
    fs.writeFileSync(to, JOBS_TEXT);
  } catch (e) { log(`  참고: 보낸 jobs.json 을 05_프롬프트 에 못 남김 — ${e.message}`); }
}
function writePlan(spec, plan, { sent = false, jobsFile = "" } = {}) {
  if (!spec.work) return;
  const work = path.resolve(String(spec.work));
  if (!fs.existsSync(work)) { log(`  참고: 작업 폴더가 없다(${work}) — 보낼 것을 남기지 않았다`); return; }
  try {
    const dir = path.join(work, "_검수");
    fs.mkdirSync(dir, { recursive: true });
    const now = new Date().toISOString();
    fs.writeFileSync(path.join(dir, "보낼것.json"), JSON.stringify({ ...plan, at: now, sent, ...(sent ? { sentAt: now } : {}) }, null, 1));
    if (sent && jobsFile) keepJobs(work, jobsFile);
    log(`  작업 페이지 '보낼 것'${sent ? "을 보냄으로 바꿨다(jobs.json 은 05_프롬프트 에)" : "에 레퍼런스를 올렸다 — 페이지에서 그림으로 보여 준 뒤 확인 카드로"}: ${path.join(dir, "보낼것.json")}`);
  } catch (e) { log(`  참고: 보낼 것을 못 남김 — ${e.message}`); }
}

// ---------- 작업 폴더에 놓기 (사용자 10/21 "씬 폴더 → 컷 폴더, OK 는 컷 폴더 바로 아래, 보류는 보류 폴더, 탈락은 버림") ----------
// 씬·컷: <작업>\S010\C0010\<코드>_S010_C0010_I001.png — 그 컷에서 번호를 이어 붙인다(다시 만든 것 · A/B안도 이어서, 어느 안인지는 목록에).
// 에셋: <작업>\01_에셋\<인물|로케이션|프랍|참고>\<작업 이름>_A.png. 검수 뒤 OK 는 그 자리, 보류는 그 안 보류\, 탈락은 지운다(앱 원본은 앱에 남는다).
// 어느 파일이 어디서 왔는지는 <작업>\_검수\목록.tsv 한 곳에 — 컷 폴더에는 전달할 파일만 둔다.
// 시댄스와 같은 목록에 쓴다 — 칸도 같게. 프롬프트 = 그 그림을 만든 판의 지문(같은 작업 이름으로 고쳐 다시 보내도 북이 판마다 맞는 프롬프트를 붙이게, 11/2)
const LIST_HEAD = ["폴더", "파일", "작업", "테이크", "모델", "원본", "카드", "task", "씬", "컷", "범위", "안", "해상도", "받은 시각", "받기", "프롬프트"];
// 판 지문 — 프롬프트 글(공백 정리) · 주요 설정 · 레퍼런스 파일 이름. 보내기 스크립트 둘과 make-review 가 같은 식으로 센다(jobs.json 원문 기준)
const PRINT_KEYS = ["model", "mode", "ratio", "aspect", "duration", "resolution", "quality"];
const takePrint = (spec, j) => crypto.createHash("sha256").update(JSON.stringify([
  String(j.prompt ?? "").replace(/\s+/g, " ").trim(),
  ...PRINT_KEYS.map((k) => String(j[k] ?? spec.defaults?.[k] ?? "")),
  (j.refs || []).map((r) => path.basename(String(typeof r === "string" ? r : r?.path || "")).toLowerCase()),
])).digest("hex").slice(0, 12);
const BOM = new RegExp("^" + String.fromCharCode(0xfeff));
const ASSET_KINDS = ["인물", "로케이션", "프랍", "참고"];
const readJsonSafe = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8").replace(new RegExp("^" + String.fromCharCode(0xfeff)), "")); } catch { return {}; } };
const workCode = (spec, work) => String(spec.code || readJsonSafe(path.join(work, "_작업설정.json")).code || "").trim();
// 이 작업의 결과가 놓일 곳 — { rel, prefix?, scene, cut, range, version } 또는 고칠 점(문자열)
function placeOf(spec, j, work) {
  const d = spec.defaults || {};
  const scene = String(j.scene ?? d.scene ?? "").trim(), cut = String(j.cut ?? d.cut ?? "").trim();
  const asset = String(j.asset ?? d.asset ?? "").trim();
  const version = String(j.version ?? d.version ?? "").trim();
  if (scene || cut) {
    const code = workCode(spec, work);
    if (!/^[A-Za-z0-9]+$/.test(code)) return "프로젝트 코드가 없다 — jobs.json \"code\"(예: \"ABC\")를 적을 것(한 번 적으면 _작업설정.json 에 남는다)";
    if (!/^S\d{3}$/.test(scene) || !/^C\d{4}$/.test(cut)) return `씬·컷은 "S010" · "C0010" 꼴로(지금 "${scene}" · "${cut}")`;
    return { rel: `${scene}/${cut}`, prefix: `${code}_${scene}_${cut}_`, scene, cut, range: String(j.covers ?? "").trim(), version };
  }
  if (asset) {
    if (!ASSET_KINDS.includes(asset)) return `asset 은 ${ASSET_KINDS.join(" · ")} 중 하나(지금 "${asset}")`;
    return { rel: `01_에셋/${asset}`, asset, version };
  }
  return `둘 자리가 없다 — 작업마다 "scene"·"cut"(예: "S010" · "C0010") 또는 "asset"(${ASSET_KINDS.join(" · ")})을 적을 것. 애매하면 사용자에게 묻는다`;
}
function readWorkList(work) {
  const p = path.join(work, "_검수", "목록.tsv");
  if (!fs.existsSync(p)) return [];
  const lines = fs.readFileSync(p, "utf8").replace(BOM, "").split(/\r?\n/).filter((l) => l.trim());
  const head = (lines.shift() || "").split("\t");
  return lines.map((l) => Object.fromEntries(l.split("\t").map((v, i) => [head[i] || `c${i}`, v])));
}
function appendWorkList(work, rows) {
  if (!rows.length) return;
  fs.mkdirSync(path.join(work, "_검수"), { recursive: true });
  const p = path.join(work, "_검수", "목록.tsv");
  const clean = (v) => String(v ?? "").replace(/[\t\r\n]+/g, " ");
  // 머리줄은 make-review 처럼 찾고(BOM · 앞 빈 줄 건너뜀), 있던 칸 + 모자란 칸을 뒤에 — 예전 줄은 늘어난 칸을 빈칸으로 읽는다.
  // 머리줄을 고쳐야 하면(칸이 늘거나 BOM · 앞 빈 줄) 다시 쓰고, 끝 줄바꿈이 없으면 붙인 뒤 잇는다
  const raw = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  const lines = raw.replace(BOM, "").split("\n");
  const hi = lines.findIndex((l) => l.trim());
  const old = hi < 0 ? [] : lines[hi].replace(/\r$/, "").split("\t");
  const head = [...old, ...LIST_HEAD.filter((h) => !old.includes(h))];
  const body = `${rows.map((r) => head.map((h) => clean(r[h])).join("\t")).join("\n")}\n`;
  if (hi < 0) return fs.writeFileSync(p, `${head.join("\t")}\n${body}`);
  if (head.length > old.length || hi > 0 || BOM.test(raw)) fs.writeFileSync(p, [head.join("\t"), ...lines.slice(hi + 1)].join("\n"));
  fs.appendFileSync(p, `${raw.endsWith("\n") ? "" : "\n"}${body}`);
}
// 그 컷에서 다음 번호 — 목록(지운 탈락까지)과 폴더(보류 포함)를 다 본다
function nextNumber(work, pl, kind) {
  const re = new RegExp(`^${pl.prefix}${kind}(\\d{3})`);
  let max = 0;
  for (const r of readWorkList(work)) { const m = re.exec(r["파일"] || ""); if (m) max = Math.max(max, Number(m[1])); }
  for (const d of [path.join(work, pl.rel), path.join(work, pl.rel, "보류")]) {
    if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) { const m = re.exec(f); if (m) max = Math.max(max, Number(m[1])); }
  }
  return max + 1;
}
// 놓을 파일 이름 — 씬·컷은 <코드>_S010_C0010_I001(+_480 같은 꼬리), 에셋은 작업 이름 + 다음 글자(A, B …)
function placeName(work, pl, kind, ext, jobName, suffix = "") {
  if (pl.prefix) return `${pl.prefix}${kind}${String(nextNumber(work, pl, kind)).padStart(3, "0")}${suffix}${ext}`;
  const base = String(jobName || "job").replace(/[\\/:*?"<>|]+/g, "_").trim();
  for (let t = 0; ; t++) {
    const name = `${base}_${t < 26 ? String.fromCharCode(65 + t) : `Z${t - 25}`}${suffix}${ext}`;
    if (![path.join(work, pl.rel, name), path.join(work, pl.rel, "보류", name)].some((p) => fs.existsSync(p))) return name;
  }
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

// 앱이 켜져 있는지, 보안 토큰
async function connect() {
  let html = "";
  let netCode = "";
  try { html = await (await fetch(`${NB}/`, { signal: AbortSignal.timeout(3000) })).text(); }
  catch (e) { netCode = e?.cause?.code || (e?.name === "TimeoutError" ? "시간 초과" : e?.name || "오류"); }
  token = html.match(/<meta name="nb-csrf" content="([^"]+)"/)?.[1] || "";
  if (!token && netCode && netCode !== "ECONNREFUSED") fail(`나노바나나에 연결 못 함 (${netCode}) — ${BLOCKED}`);
  if (!token) fail("나노바나나가 꺼져 있다 — 앱을 켜 달라고 할 것");
}
const isDirect = (pr) => pr?.agent_pid === true || (pr?.features || []).includes("agent_pid");
// 확인 카드·출력에는 앱 화면 그대로 "팀 · 프로젝트 이름" — id(ta팀 / PJ-…)는 사람이 모르고, 다른 프로젝트 id 와 헷갈린다
// (사용자 10/20 "프로젝트를 사용자 입장이랑 다르게 말하네" — PJ-… 로 말해 KBS 과금을 KIXX 로 착각할 뻔). 목록을 못 읽으면 id 그대로.
async function billingName(b) {
  let cat = null;
  try { cat = await get("/api/billing/catalog"); } catch {}
  const team = cat?.teams?.find((x) => x.id === b.team_id)?.name || b.team_id;
  const proj = cat?.projects?.find((x) => x.id === b.project_id)?.name || b.project_id;
  return `${team} · ${proj}`;
}

// 앱의 팀·프로젝트 창과 같은 명단. 이름이 없으면 그 창처럼 id 를 쓴다.
const nameOf = (x) => String(x?.name || x?.id || "");
const sameName = (s) => String(s ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
// 같은 이름이 둘일 때만 id 를 보여 준다 — 평소에 사람이 보는 건 이름이다
const numbered = (list) => list.map((x, i) => `  ${i + 1}) ${nameOf(x)}${list.filter((y) => nameOf(y) === nameOf(x)).length > 1 ? ` (id ${x.id})` : ""}`);
async function readCatalog() {
  let c = null;
  try { c = await get("/api/billing/catalog"); } catch {}
  return c?.ok && c.teams?.length && c.projects?.length ? c : null;
}
const OLD_APP = "이 나노바나나는 탭을 지정해 과금을 넣을 수 없다(v2026-10-2001 전) — 사용자에게 앱에서 그 탭을 열고 팀·프로젝트를 골라 달라고 할 것(앱을 껐다 켜면 새 버전이 깔린다)";
// 사용자에게 줄 선택지 — 보내기가 멈출 때도 --choices 에서도 같은 글이라, 어느 에이전트든 다른 문서 없이 그대로 묻는다
async function billingChoices(tabName) {
  const c = await readCatalog();
  const inApp = `탭 줄의 ${tabName ? `"${tabName}"` : "그 탭"} 옆 "!"(또는 탭 우클릭 "팀·프로젝트…")`;
  if (!c) return `과금 명단을 못 읽었다 — 사용자에게 나노바나나 ${inApp}로 골라 달라고 할 것. 탭을 옮기지 않아도 된다`;
  return [
    ...(c.warning ? [`참고: ${c.warning}`] : []),
    `팀 ${c.teams.length}개:`, ...numbered(c.teams),
    `프로젝트 ${c.projects.length}개:`, ...numbered(c.projects),
    "사용자에게 물을 것 — 과금은 사람이 고른다:",
    "  - 미리 고른 값 · 추천 없이 묻는다. 지난번 값이나 탭 · 폴더 이름으로 짐작해 넣지 않는다(비용이 그 프로젝트로 기록된다).",
    "  - 선택지가 버튼에 들어가면 버튼으로(Claude AskUserQuestion 4개 · Codex freewill_ask 6개까지, default 없이), 넘으면 위 번호 목록을 대화에 그대로 보여 주고 번호나 이름으로 받는다. 답이 애매하면 다시 묻는다.",
    `  - 답을 받으면 이 스크립트에 --set-billing --tab "${tabName || "탭 이름"}" --team "팀 이름" --project "프로젝트 이름" (명단 이름 그대로) — 화면 탭은 안 바뀐다.`,
    `  - 사용자가 앱에서 고르겠다고 하면 ${inApp}. 탭을 옮기지 않아도 된다.`,
    "  - 프로젝트(탭)가 여럿이면 탭마다 따로 묻는다 — 한 답을 여러 탭에 넣지 않는다(사용자가 \"다 같은 걸로\"라고 했을 때만). 보낼 때는 탭마다 jobs.json 한 파일(맨 위에 tab · billing), 확인 카드는 탭마다 한 줄, dry-run · 보내기도 파일마다 따로.",
  ].join("\n");
}

// 사용자가 "만들어"라고 한 탭을 화면을 안 바꾸고 만든다(새 앱만). 새 탭은 과금이 비어 있으니 명단을 같이 내준다.
async function createTab(name) {
  if (!name) fail("--create-tab 에 탭 이름을 줄 것");
  await connect();
  const pr = await get("/api/projects");
  if (!isDirect(pr)) fail("이 나노바나나는 탭을 화면 안 바꾸고 만들 수 없다(v2026-10-2001 전) — 사용자에게 앱에서 + 로 만들어 달라고 할 것(앱을 껐다 켜면 새 버전이 깔린다)");
  if ((pr.projects || []).some((p) => p.name === name)) { log(`"${name}" 탭이 이미 있다 — 만들지 않았다`); return; }
  const r = await post("/api/projects/new", { title: name, activate: false });
  if (!r.ok) fail(`탭을 못 만듦: ${r.error || r.raw || "알 수 없음"}`);
  log(`"${name}" 탭을 만들었다(${r.pid}) — 화면 탭은 그대로. 새 탭은 과금이 비어 있다.\n${await billingChoices(name)}`);
}

async function showChoices() {
  await connect();
  const pr = await get("/api/projects");
  const tabs = pr?.projects || [];
  const c = await readCatalog();
  const label = (id, list) => nameOf(list?.find((x) => x.id === id)) || id;
  log(`나노바나나 탭 ${tabs.length}개 (지금 화면 "${tabs.find((t) => t.pid === pr?.active)?.name ?? "?"}"):`);
  tabs.forEach((t, i) => log(`  ${i + 1}) ${t.name} — ${t.billing_team_id && t.billing_project_id ? `과금 ${label(t.billing_team_id, c?.teams)} · ${label(t.billing_project_id, c?.projects)}` : "과금 안 골라짐"}`));
  log(`이 작업을 둘 탭을 물을 때 "새 탭 만들기"도 넣는다 — 고르면 --create-tab "이름", 있는 탭이면 jobs.json "tab" 에 이름 그대로.`);
  log(isDirect(pr) ? await billingChoices("") : OLD_APP);
}

// 사용자가 대화에서 고른 팀·프로젝트를 그 탭에 넣는다(사용자 11/4 — 앱의 "!" 창과 같은 기능, 화면 탭은 그대로). 고르는 건 사람이다:
// 명단 이름 그대로만 받고 비슷한 이름으로 짐작하지 않으며, 이미 다른 과금이 골라진 탭은 --change 없이 안 바꾼다.
function pickOne(list, want, what, flagName) {
  const w = sameName(want);
  if (!w) fail(`${flagName} 에 사용자가 고른 ${what} 이름을 줄 것`);
  const hit = list.filter((x) => x.id === w || sameName(nameOf(x)) === w);
  if (hit.length > 1) fail(`"${w}" 라는 ${what}이(가) ${hit.length}개다 — 사용자에게 어느 쪽인지 묻고 ${flagName} 에 id 를 줄 것(${hit.map((x) => x.id).join(" · ")})`);
  if (!hit.length) fail(`"${w}" 는 명단에 없는 ${what} — 넣지 않았다. 짐작하지 말고 사용자가 고른 것을 명단 이름 그대로 줄 것:\n${numbered(list).join("\n")}`);
  return hit[0];
}
async function setBilling() {
  await connect();
  const pr = await get("/api/projects");
  if (!isDirect(pr)) fail(OLD_APP);
  const tabs = pr.projects || [];
  const names = tabs.map((p) => `"${p.name}"`).join(", ");
  const want = String(TAB || "").trim();
  if (!want) fail(`--tab 에 넣을 탭 이름을 줄 것(지금 탭: ${names})`);
  const same = tabs.filter((p) => p.name === want);
  if (!same.length) fail(`나노바나나에 "${want}" 탭이 없다(지금 탭: ${names}) — 넣지 않았다`);
  if (same.length > 1) fail(`나노바나나에 "${want}" 탭이 ${same.length}개다 — 넣지 않았다. 어느 탭인지 사용자에게 물을 것(탭 이름을 바꿔 구분)`);
  const tab = same[0];
  const c = await readCatalog();
  if (!c) fail(`과금 명단을 못 읽어 넣지 않았다 — 사용자에게 나노바나나 탭 줄의 "${tab.name}" 옆 "!" 로 골라 달라고 할 것`);
  const team = pickOne(c.teams, opt("--team"), "팀", "--team");
  const proj = pickOne(c.projects, opt("--project"), "프로젝트", "--project");
  const label = `${nameOf(team)} · ${nameOf(proj)}`;
  const stateUrl = `/api/billing/state?pid=${encodeURIComponent(tab.pid)}`;
  const now = await get(stateUrl);
  if (now?.ok === false) fail(`"${tab.name}" 탭 과금을 못 읽음(${now.error || "알 수 없음"}) — 넣지 않았다`);
  const next = `이 탭의 jobs.json 맨 위에 "tab": "${tab.name}", "billing": "${label}" 를 그대로 적고 dry-run 부터 다시 돌릴 것(프로젝트가 여럿이면 탭마다 파일 하나)`;
  if (now?.confirmed && now.team_id === team.id && now.project_id === proj.id) { log(`"${tab.name}" 탭은 이미 과금 ${label} 다 — 바꾸지 않았다. ${next}`); return; }
  const before = now?.confirmed && now.team_id && now.project_id ? await billingName(now) : "";
  if (before && !flag("--change")) fail(`"${tab.name}" 탭은 이미 과금 "${before}" 로 골라져 있다 — 넣지 않았다. 사용자가 "${label}" 로 바꾸라고 했을 때만 --change 를 붙일 것`);
  const r = await post("/api/billing/set", { pid: tab.pid, team_id: team.id, project_id: proj.id });
  if (!r?.ok) fail(r?.error === "no_such_tab" ? `"${tab.name}" 탭이 그사이 닫혔다 — 사용자에게 물을 것` : `과금을 못 넣음: ${r?.error || r?.raw || "알 수 없음"}`);
  const after = await get(stateUrl);
  if (!(after?.confirmed && after.team_id === team.id && after.project_id === proj.id)) fail(`"${tab.name}" 탭 과금을 넣었는데 확인이 안 된다 — 보내지 말고 사용자에게 탭 옆 "!" 를 봐 달라고 할 것`);
  log(`"${tab.name}" 탭 과금을 ${before ? `"${before}" 에서 ` : ""}${label} 로 넣었다 — 화면 탭은 그대로. ${next}`);
}

async function main() {
  if (CREATE_TAB !== null) return createTab(String(CREATE_TAB || "").trim());
  if (CHOICES) return showChoices();
  if (SET_BILLING) return setBilling();
  if (!file) fail("작업 파일(jobs.json)을 주세요");
  let spec;
  try { JOBS_TEXT = fs.readFileSync(file, "utf8"); spec = JSON.parse(JOBS_TEXT.replace(BOM, "")); } catch (e) { fail(`작업 파일을 못 읽음 — ${e.message}`); }
  const defaults = spec.defaults || {};
  const jobs = (spec.jobs || []).filter((j) => j && String(j.prompt || "").trim());
  if (!jobs.length) fail("보낼 작업이 없음 (prompt 가 빈 작업은 뺀다)");
  // 과금은 탭에 달린다 — 한 파일은 한 탭(사용자 11/4 "프로젝트마다 과금과 팀이 달라도 안 꼬이게"). 다른 자리에 적은 탭 · 과금은 아무도 안 읽어, 그대로 보내면 엉뚱한 탭으로 기록된다.
  const WHO = ["team", "team_id", "project", "project_id"];
  const stray = [
    ...WHO.filter((k) => spec[k] !== undefined).map((k) => `맨 위 "${k}"`),
    ...["tab", "billing", ...WHO].filter((k) => defaults[k] !== undefined).map((k) => `defaults 의 "${k}"`),
    ...(spec.jobs || []).flatMap((j) => ["tab", "billing", ...WHO].filter((k) => j?.[k] !== undefined).map((k) => `${j.name || "(이름 없음)"} 의 "${k}"`)),
  ];
  if (stray.length) fail(`탭 · 과금을 적은 자리가 틀렸다(${stray.join(", ")}) — 보내지 않았다. 과금은 탭에 달려 있어 한 jobs.json 은 탭 하나다: 맨 위에 "tab" 과 "billing" 만 적고, 프로젝트(탭)가 여럿이면 탭마다 파일을 나눌 것`);
  if (FREEWILL_GUIDE && spec.guide !== FREEWILL_GUIDE) fail(GUIDE_STALE(spec.guide));
  // refs 는 {"path","why"} — why 는 그 그림에서 가져올 것과 같이 끌려올 수 있는 것을 어떻게 막는지 한 줄(사용자 10/20 "생각 없이 넣지 말고")
  for (const j of jobs) {
    const list = (j.refs || []).map((r) => (typeof r === "string" ? { path: r } : r || {}));
    j.refs = list.map((r) => r.path);
    j.refWhy = list.map((r) => String(r.why ?? "").trim());
    for (const fp of j.refs) if (!fp || !fs.existsSync(fp)) fail(`레퍼런스 파일이 없음: ${fp}`);
  }
  // 작업 폴더(사용자가 알려 준 프로젝트 폴더) — 결과를 씬·컷(또는 에셋 종류) 폴더에 놓는다. 자리를 못 정한 작업이 있으면 보내기 전에 멈춘다.
  const WORKDIR = spec.work ? path.resolve(String(spec.work)) : "";
  if (WORKDIR && path.resolve(path.dirname(file)).toLowerCase() === path.join(WORKDIR, "05_프롬프트").toLowerCase()) {
    log("  참고: jobs.json 은 05_프롬프트 밖에 둘 것 — 이 폴더의 .json 은 모두 보낸 프롬프트로 읽혀, 보내지 않은 초안도 작업 페이지 · 북에 섞인다");
  }
  if (WORKDIR) {
    if (!fs.existsSync(WORKDIR)) fail(`작업 폴더가 없다: ${WORKDIR} — 사용자가 알려 준 프로젝트 폴더인지 확인할 것`);
    const probs = jobs.map((j) => [j, placeOf(spec, j, WORKDIR)]).filter(([, p]) => typeof p === "string");
    if (probs.length) fail(`결과를 놓을 자리를 정할 것 (작업 폴더 ${WORKDIR}):\n${probs.map(([j, p]) => `  - ${j.name || "(이름 없음)"}: ${p}`).join("\n")}`);
    const setFile = path.join(WORKDIR, "_작업설정.json");
    if (spec.code && readJsonSafe(setFile).code !== String(spec.code).trim()) {
      fs.writeFileSync(setFile, JSON.stringify({ ...readJsonSafe(setFile), code: String(spec.code).trim() }, null, 2));
    }
  }
  const noWhy = jobs.flatMap((j) => j.refs.filter((_, i) => !j.refWhy[i]).map((fp) => `${j.name || "(이름 없음)"}: ${path.basename(fp)}`));
  if (noWhy.length) fail(`레퍼런스마다 넣는 이유(why)를 적을 것 — refs 를 {"path","why"} 로: 그 그림에서 가져올 것(얼굴·옷·공간·소품·구도)과 ` +
    `같이 끌려올 수 있는 것(다른 인물·글자·구도·그림체·조명)을 어떻게 막는지 한 줄. 이유를 못 쓰면 빼고 글로 쓴다(image-prompting 2절)\n` +
    noWhy.map((x) => `  - ${x}`).join("\n"));

  // 1) 앱이 켜져 있는지, 보안 토큰
  await connect();

  // 2) 어느 탭으로 들어가는지, 팀·프로젝트가 골라져 있는지.
  if (TAB && spec.tab && String(TAB) !== String(spec.tab)) fail(`--tab "${TAB}" 와 jobs.json 의 "tab" "${spec.tab}" 이 다르다 — 보내지 않았다. 어느 탭인지 확인하고 하나로 맞출 것`);
  const want = TAB || String(spec.tab || "");
  const pr0 = await get("/api/projects");
  const tabs0 = pr0?.projects || [];
  if (!want && tabs0.length > 1) {
    fail(`jobs.json 에 "tab" 이 없는데 앱에 탭이 ${tabs0.length}개다(${tabs0.map((p) => `"${p.name}"`).join(", ")}) — 보내지 않았다. 화면 탭으로 보내면 엉뚱한 과금으로 기록될 수 있다. ` +
      `--choices 로 어느 탭인지 물어 "tab" 에 적을 것`);
  }
  // 새 앱(v2026-10-2001~, agent_pid): 탭을 pid 로 지정해 보낸다 — 화면 탭도 그 탭 입력칸도 안 바뀐다(사용자 10/20 "탭 이동 없이")
  const direct = isDirect(pr0);
  let tab = tabs0.find((p) => p.pid === pr0?.active) || null;
  if (!tab) fail("지금 탭을 알 수 없음");
  const screenTab = tab.name;
  let billing = null;
  if (direct) {
    if (want) {
      const same = tabs0.filter((p) => p.name === want);
      if (!same.length) {
        fail(`나노바나나에 "${want}" 탭이 없다(지금 탭: ${tabs0.map((p) => `"${p.name}"`).join(", ")}) — 이름을 확인하거나, 사용자에게 ` +
          `그 탭을 만들어 달라고 할 것. 사용자가 "만들어"라고 하면 --create-tab "${want}" 로 만든다(화면은 안 바뀐다)`);
      }
      if (same.length > 1) fail(`나노바나나에 "${want}" 탭이 ${same.length}개다 — 어느 탭인지 사용자에게 물을 것(탭 이름을 바꿔 구분)`);
      tab = same[0];
    } else {
      log(`  참고: jobs.json 에 "tab" 이 없어 지금 화면 탭 "${tab.name}" 으로 보낸다 — 이 작업용 탭이 따로 있으면 "tab" 에 적을 것`);
    }
    billing = await get(`/api/billing/state?pid=${encodeURIComponent(tab.pid)}`);
    if (!(billing?.ok !== false && billing?.confirmed && billing.team_id && billing.project_id)) {
      fail(`"${tab.name}" 탭의 팀·프로젝트가 확인되지 않아 보내지 않았다(앱을 다시 켜면 탭마다 한 번 다시 확인한다).\n${await billingChoices(tab.name)}`);
    }
  } else if (want && tab.name !== want) {
    // 옛 앱: 생성(/api/generate)·레퍼런스 기능이 화면에 떠 있는 탭에만 들어간다 — 탭을 지정하는 칸이 없다. 탭 전환 API 는 있지만
    // 앱 화면은 바깥에서 바뀐 걸 모른다(사람이 누를 때만 화면을 다시 그린다). 몰래 바꾸면 화면엔 옛 탭이 보이는데 그 상태로 친 글·넣은
    // 그림이 다른 탭으로 들어간다. 그래서 바꾸지 않고, 정한 탭이 화면에 없으면 사람이 누를 때까지 기다린다.
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
  if (!direct) {
    billing = billing || await get("/api/billing/state");
    if (!(billing?.project_id && billing.confirmed !== false)) fail(`"${tab.name}" 탭에 팀·프로젝트가 안 골라져 있다 — 앱에서 먼저 고르게 할 것`);
  }
  const billLabel = await billingName(billing);
  // 확인 카드에 보여 준 과금(jobs.json "billing" — dry-run 의 "과금 …" 이름)과 지금 그 탭 과금이 다르면 보내지 않는다.
  // 카드와 보내기 사이에 사람이 탭 과금을 바꾸면 카드와 다른 곳으로 기록된다(10/20 석영 탭이 그사이 KBS → USA_CPT 로 바뀐 일).
  // 프로젝트 id 만으로는 대조하지 않는다 — 같은 프로젝트를 팀만 달리 고른 탭이 있을 수 있다(11/4).
  if (spec.billing && sameName(spec.billing) !== sameName(billLabel)) {
    fail(`"${tab.name}" 탭의 과금이 지금 "${billLabel}" — 확인 카드의 "${spec.billing}" 와 다르다. 보내지 않는다 — 사용자에게 어느 쪽이 맞는지 묻고 카드를 다시`);
  }
  if (!spec.billing && !DRY) fail(`jobs.json 에 "billing" 이 없다 — 보내지 않았다. 확인 카드에 보여 준 이 탭 과금을 그대로 적을 것: "billing": "${billLabel}"`);
  log(`탭 "${tab.name}" · 과금 ${billLabel} 로 ${jobs.length}건 ${DRY ? "보낼 예정 (dry-run — 아무것도 안 보냄)" : "보냄"}` +
    `${direct && tab.name !== screenTab ? ` — 화면 탭("${screenTab}")은 그대로 둔다` : ""}`);
  if (DRY && !direct && tab.name !== screenTab) {
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
  // 비운 설정 칸은 보낼 탭의 지금 값을 따른다(새 앱은 그 탭 값을 읽기만 하고 쓰지 않는다)
  const base = await get(direct ? `/api/settings?pid=${encodeURIComponent(tab.pid)}` : "/api/settings");
  const notes = jobs.flatMap((j) => imageNotes(j, j.aspect ?? defaults.aspect ?? base.aspect).map((n) => `${j.name || "(이름 없음)"}: ${n}`));
  if (notes.length) log(`  확인할 것 (references/image-prompting.md · prompt-logic.md · 맞는 경우면 그대로 둔다):\n${notes.map((n) => `  - ${n}`).join("\n")}`);
  const countOf = (j) => Math.max(1, Math.round(Number(j.count ?? defaults.count ?? base.count) || 1));
  const big = jobs.find((j) => countOf(j) > MAX_IN_FLIGHT);
  if (big) fail(`한 작업은 ${MAX_IN_FLIGHT}장까지 — "${big.name || ""}" 은 ${countOf(big)}장. 작업을 나눠서 적을 것`);

  // 보낸 기록 — 24시간 안에 같은 것을 보냈으면 다시 보내지 않는다(끊긴 대화가 다시 실행 · 앱을 다시 켬). 새 앱은 안 끝난 것을 이어서 지켜보고 놓는다.
  // 키 = 탭 · 프롬프트(공백 정리) · 설정(글자로) · 레퍼런스(절대 경로) · 작업 폴더 자리. 이름과 --save-to 는 안 본다(받는 곳만 바꿔 다시 실행해도 이어 받기).
  // 같은 것을 일부러 여럿 적었으면 몇 번째인지(#2 …)로 가른다 — 다시 실행해도 같은 순서끼리 짝지어진다
  jobs.forEach((j, i) => { j.name ||= `job_${i + 1}`; });
  // 작업 이름이 겹치면 보내지 않는다 — 보낸 기록 · --again · 결과 파일이 이름으로 가린다(겹치면 --again=이름 이 이미 보낸 것까지 또 보냄, 11/2 재검수)
  const dupNames = [...new Set(jobs.map((j) => j.name).filter((n, i, a) => a.indexOf(n) !== i))];
  if (dupNames.length) fail(`작업 이름이 겹친다: ${dupNames.join(", ")} — 작업마다 다른 이름으로(같은 장면을 일부러 여럿이면 이름 끝에 _2 처럼)`);
  if (AGAIN_ARG) {
    if (!AGAIN.size) fail("--again 은 또 만들 작업 이름과 같이: --again=이름,이름 — 사용자에게 물은 뒤 그 작업만(이름 없이 쓰면 이미 보낸 것까지 또 나간다)");
    const unknown = [...AGAIN].filter((n) => !jobs.some((j) => j.name === n));
    if (unknown.length) fail(`--again 의 작업 이름이 jobs.json 에 없다: ${unknown.join(", ")}`);
  }
  const win = (p) => (process.platform === "win32" ? p.toLowerCase() : p);
  const placeRel = (j) => (WORKDIR ? placeOf(spec, j, WORKDIR).rel : "");
  const hash = (v) => crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 24);
  // complexity 는 적었을 때만 키에 넣는다 — 안 적은 작업의 키가 그대로여야 이 업데이트 전에 보낸 것을 또 보내지 않는다
  const keyed = (j) => SETTING_KEYS.filter((k) => k !== "complexity" || (j[k] ?? defaults[k]) != null);
  const seen = {};
  for (const j of jobs) {
    const key = hash([tab.name, String(j.prompt).replace(/\s+/g, " ").trim(),
      keyed(j).map((k) => { const v = j[k] ?? defaults[k]; return v === undefined || v === null ? null : String(v); }),
      j.refs.map((p) => win(path.resolve(p))), WORKDIR, placeRel(j)]);
    j.nth = seen[key] = (seen[key] || 0) + 1;
    j.key = `${key}#${j.nth}`;
    j.legacy = hash([tab.name, String(j.prompt), keyed(j).map((k) => j[k] ?? defaults[k] ?? null), j.refs.map((p) => path.resolve(p)), WORKDIR, placeRel(j) || SAVE_TO || ""]);
  }
  const encPid = encodeURIComponent(tab.pid);
  // 전에 보낸 묶음이 지금 어떤지 — "끝" · "보냄"(만드는 중이거나 아직 안 놓음) · "다시"(그림 0장으로 끝남) · "멈춤"(사람이 앱에서 멈춤) · "모름" · "옛"(묶음 id 없는 옛 앱)
  const stateOf = async (e) => {
    if (!e.id) return e.state === "보냄" || e.state === "끝" ? "옛" : "모름";
    const b = await get(`/api/batch?pid=${encPid}&batch_id=${encodeURIComponent(e.id)}`);
    if (b?.ok) return !b.finished ? "보냄" : !b.done ? (b.cancelled ? "멈춤" : "다시") : e.state === "끝" ? "끝" : "보냄";
    // 앱을 다시 켜 집계가 사라졌으면 갤러리의 batch_id 로 — 그림이 있으면 만든 것, 없으면 들어갔는지 모른다
    const items = (await get(`/api/gallery?pid=${encPid}&strict=1&batch_id=${encodeURIComponent(e.id)}`))?.items || [];
    return e.state === "끝" ? "끝" : items.length ? "보냄" : "모름";
  };
  const toSend = [], resumed = [], already = [], unsure = [];
  for (const j of jobs) {
    const e = AGAIN.has(j.name) ? null : lastOf(j);
    if (!e) { toSend.push(j); continue; }
    const st = await stateOf(e);
    if (st === "다시") { if (!DRY) ledgerSet(e.rid, null); toSend.push(j); continue; }
    if (st === "모름") { unsure.push(j.name); continue; }
    if (st === "멈춤") {
      if (!DRY) ledgerSet(e.rid, { state: "끝", note: "앱에서 멈춤" });
      already.push(`${j.name} — ${sentWhen(e)} 에 보냈는데 앱에서 멈춘 묶음(그림 0장)`);
      continue;
    }
    if (st === "보냄" && e.state !== "보냄" && !DRY) ledgerSet(e.rid, { state: "보냄" });   // 앱이 받은 걸 확인 — '모름'으로 굳지 않게
    if (st === "보냄" && direct && (WATCH || WORKDIR)) { resumed.push({ j, id: e.id, model: j.model ?? defaults.model ?? base.model, rid: e.rid }); continue; }
    already.push(`${j.name} — ${sentWhen(e)} 에 보냄 · ${st === "끝" ? (WORKDIR ? "작업 폴더에 놓았다" : "끝났다") : `"${tab.name}" 탭 갤러리에서 볼 것`}`);
  }
  if (already.length) log(`  이미 보냄 — 다시 보내지 않는다(같은 것을 또 만들려면 사용자에게 물은 뒤 --again=작업 이름):\n${already.map((x) => `    ${x}`).join("\n")}`);
  if (resumed.length) log(`  이미 보냄 — 이어서 지켜보고 놓는다: ${resumed.map((x) => x.j.name).join(", ")}`);
  if (already.length || resumed.length || unsure.length) log(`  보낼 것 ${toSend.length}건 · 이어 받기 ${resumed.length}건 · 건너뜀 ${already.length + unsure.length}건`);
  if (unsure.length) {
    // 그 작업만 보내지 않는다 — 나머지는 보내고, 끝나면 실패 코드로 알린다
    const msg = `앱에 들어갔는지 모르는 작업은 보내지 않는다(다시 보내면 두 번 과금될 수 있다): ${unsure.join(", ")}\n` +
      `  사용자에게 나노바나나 "${tab.name}" 탭 갤러리에 그 그림이 생겼는지(만드는 중인지) 봐 달라고 할 것. 있으면 다시 보내지 않는다 — 없으면 사용자 확인 뒤 --again=${unsure.join(",")}`;
    if (!DRY && !toSend.length && !resumed.length) fail(msg);
    log(`  주의: ${msg}`);
    if (!DRY) {
      process.exitCode = 1;
      process.on("exit", () => console.error(`확인할 것 — 앱에 들어갔는지 모르는 작업(보내지 않음): ${unsure.join(", ")} · 위 '주의' 참고`));
    }
  }
  if (!DRY && !toSend.length && !resumed.length) {
    log("보낼 것 없음 — 모두 24시간 안에 이미 보냈다(결과는 앱 갤러리 · 작업 폴더에). 같은 것을 또 만들려면 사용자에게 물은 뒤 --again=작업 이름");
    return;
  }
  if (WORKDIR && resumed.length && !DRY) keepJobs(WORKDIR, file);

  const total = toSend.reduce((a, j) => a + countOf(j), 0);
  const need = await loadTicket();   // 표가 없으면 요청 번호 — dry-run 은 알려만 주고(카드 전에 승인해 두면 바로 보낸다) 보내기는 멈춘다
  const owner = ticketOwner();
  let quota = need === NO_TICKET ? "로그인 표 없음 — 보낼 때는 커넥터에서 받은 스크립트로" : "표 승인 전(아래)";
  if (owner) {
    // 하루 한도는 PC(PC 이름 + 윈도 사용자) 기준 — 관리자가 계정 전체 상한을 걸어 두면 더 빡빡한 쪽이 온다(scope)
    const host = os.hostname();
    const me = await usageApi("GET", `/usage/me?pc=${encodeURIComponent(host)}&user=${encodeURIComponent(os.userInfo().username)}&device=${encodeURIComponent(device())}`);
    if (me.http === 401 || me.http === 403) fail(me.error || NO_TICKET);   // 403 = 관리자가 막은 계정
    if (FREEWILL_GUIDE && me.guide && me.guide !== FREEWILL_GUIDE) fail(SCRIPT_OLD(me.guide));
    const q = me.apps?.nanobanana;
    if (!q) fail(me.error || `사용 기록 서버가 답하지 않는다 (${me.http}) — 잠시 뒤 다시`);
    if (q.limit === 0) fail(`${q.scope === "account" ? `${owner.e} 계정은` : `이 PC(${host})는`} 관리자가 MCP 이미지 생성을 막아 두었다 — 관리자에게 물을 것`);
    if (q.used + total > q.limit) {
      fail(`오늘 ${q.scope === "account" ? `${owner.e} 계정(모든 PC 합계)이` : `이 PC(${host})가`} MCP 로 보낸 이미지 ${q.used}장 — ` +
        `하루 ${q.limit}장 한도라 이번 ${total}장은 보내지 않는다. 장수를 줄이거나 내일 보내고, 급하면 앱에서 직접 만들게 할 것`);
    }
    quota = `${owner.e} · ${host} · 오늘 남은 한도 ${q.limit - q.used}장`;
  } else if (!DRY) {
    fail(need || NO_TICKET);
  }
  log(`  이번 ${total}장 · ${quota} · 지금 앱에서 진행 중 ${await inFlight()}장 ` +
    `(동시 ${MAX_IN_FLIGHT}장까지 — 넘으면 앞의 것이 끝나야 다음 작업을 넣는다)`);
  if (!owner && need && need !== NO_TICKET) log(`  ${need}`);
  // 작업 페이지의 '보낼 것' — 작업마다 모델·레퍼런스(그림으로 뜬다)
  const planOf = () => ({ app: "nanobanana", tab: tab.name, billing: billLabel,
    jobs: jobs.map((j) => ({ name: j.name || "", model: j.model ?? defaults.model ?? base.model, mode: `${j.resolution ?? defaults.resolution ?? base.resolution} · ${j.aspect ?? defaults.aspect ?? base.aspect}`,
      prompt: String(j.prompt), refs: j.refs.map((p, k) => ({ path: path.resolve(p), why: j.refWhy[k] })),
      ...(WORKDIR ? { place: placeOf(spec, j, WORKDIR).rel } : {}) })) });
  if (DRY) {
    const cxNote = (m, c) => (/^gpt-image-2\.6/.test(m) && c ? ` · complexity ${c}` : "");   // 2.6 전용 — 확인 카드에 옮긴다
    log(direct ? `  "${tab.name}" 탭 설정(jobs.json 에 비운 칸은 이 값): ${base.model} · ${base.resolution} · ${base.aspect} · ×${base.count}${cxNote(base.model, base.complexity)}`
      : tab.name === screenTab ? `  지금 탭 설정: ${base.model} · ${base.resolution} · ${base.aspect} · ×${base.count}`
      : `  설정: jobs.json 에 적은 값이 들어가고, 비운 칸은 "${tab.name}" 탭에 정해 둔 값을 따른다(아래 비운 칸은 지금 화면 탭 값으로 보여 줌)`);
    for (const [i, j] of toSend.entries()) {
      const m = j.model ?? defaults.model ?? base.model, r = j.resolution ?? defaults.resolution ?? base.resolution;
      log(`  ${i + 1}. ${j.name || ""} · ${m} ${r} ×${countOf(j)}${cxNote(m, j.complexity ?? defaults.complexity ?? base.complexity)} · 레퍼런스 ${j.refs.length}장`);
      j.refs.forEach((p, k) => log(`     [Image ${k + 1}] ${path.basename(p)} — ${j.refWhy[k]}`));   // 확인 카드에 그대로 옮긴다
      if (WORKDIR) {
        const pl = placeOf(spec, j, WORKDIR);
        log(`     → 놓을 곳 ${pl.rel}/${placeName(WORKDIR, pl, "I", ".png", j.name)}${countOf(j) > 1 ? ` 부터 ${countOf(j)}장` : ""}${pl.range ? ` · 범위 ${pl.range}` : ""}${pl.version ? ` · ${pl.version}안` : ""}`);
      }
    }
    writePlan(spec, planOf(), {});
    return;
  }

  // 4) 작업마다 — 같은 PC 의 다른 보내기(예: Claude 와 Codex 가 동시에)와 겹치지 않게 PC 잠금 안에서 한 작업씩 넣는다.
  //    그래서 동시 10장 한도를 둘이 같이 지킨다.
  //    새 앱: [자리 확인 → 기록 → 탭 pid 와 그 작업의 값을 한 요청으로] — 화면 탭·입력칸은 건드리지 않는다. 결과는 묶음 id 로.
  //    옛 앱: [자리·탭 확인 → 기록 → 입력칸 담아 두기 → 레퍼런스·설정·프롬프트 → Generate → 입력칸 되돌리기] — 서로의 입력칸을
  //    덮지 않고, 작업 사이에는 탭이 늘 사람 것이다.
  const enc = encodeURIComponent(tab.pid);
  const galleryBefore = direct ? null : new Set(((await get(`/api/gallery?pid=${enc}`))?.items || []).map((i) => i.filepath));
  const directError = (gr, j, i) => {
    const who = j.name || `job_${i + 1}`;
    if (gr.needs_billing) return `"${tab.name}" 탭의 팀·프로젝트를 앱이 다시 골라 달라고 한다(${gr.error || ""}) — 이 스크립트 --choices 로 명단을 받아 사용자에게 물을 것`;
    if (gr.error === "no_such_tab") return `"${tab.name}" 탭이 그사이 닫혔다 — 사용자에게 물을 것`;
    if (gr.error === "bad_complexity") return `${who}: complexity 는 GPT Image 2.6 전용이다(low · medium · high) — ${gr.model} 이면 빼고, 2.6 이면 값을 고칠 것`;
    if (/^bad_/.test(String(gr.error || ""))) return `${who}: ${gr.model} 에 안 맞는 ${gr.field} — 고를 수 있는 값: ${(gr.allowed || []).join(", ")}`;
    if (gr.error === "unknown_model" && /^gpt-image-2\.6/.test(gr.model)) return `${who}: 이 PC 나노바나나에 ${gr.model} 이 없다(v2026-11-0501 전) — 앱을 껐다 켜면 새 버전이 깔린다. 사용자에게 알리고, 급하면 물은 뒤 2.5 로`;
    if (gr.error === "unknown_model") return `${who}: 앱이 모르는 모델 ${gr.model} — read-local-apps 가 보여 준 모델 id 로`;
    if (gr.error === "ref_limit") return `${who}: 이 모델은 레퍼런스 ${gr.limit}장까지(${gr.given}장 보냄)`;
    if (gr.error === "ref_unreadable") return `${who}: 레퍼런스 ${gr.index}번을 앱이 못 읽음 — ${gr.path}`;
    if (gr.error === "ref_duplicate") return `${who}: 레퍼런스 ${gr.index}번이 ${gr.same_as}번과 같은 그림 — 하나만`;
    return `Generate 실패 (${who}): ${gr.error || gr.raw || "알 수 없음"}`;
  };
  // 넣기 직전에 그 탭 · 그 과금이 그대로인지 다시 본다 — 앞 작업을 기다리는 사이 과금이 바뀌거나 앱을 다시 켜면(pid 가 다른 탭이 될 수 있다)
  // 확인 카드 · 사용 기록과 앱 과금이 어긋난다(11/4 시험: 30장이 옛 과금 10 · 새 과금 20 으로 갈렸는데 사용 기록은 전부 옛 과금).
  async function checkTabUnchanged() {
    const now = await get(`/api/billing/state?pid=${enc}`);
    const again = "나머지는 보내지 않는다 — 사용자에게 물은 뒤 dry-run 부터 다시(이미 보낸 것은 다시 안 나간다)";
    if (now?.ok === false || (now?.tab !== undefined && now.tab !== tab.name)) throw new Error(`"${tab.name}" 탭이 보내는 사이 닫혔거나 앱이 다시 켜졌다. ${again}`);
    if (!now?.confirmed) throw new Error(`"${tab.name}" 탭의 팀·프로젝트 확인이 보내는 사이 풀렸다. --choices 로 명단을 받아 다시 고르게 할 것. ${again}`);
    if (now.team_id === billing.team_id && now.project_id === billing.project_id) return;
    // 시트 이관으로 앱이 옛 id 를 새 id 로 바꾼 것이면 같은 과금이다
    if (now.team_id === billing.team_id && (await readCatalog())?.aliases?.[billing.project_id] === now.project_id) return;
    throw new Error(`"${tab.name}" 탭 과금이 보내는 사이 "${billLabel}" 에서 "${await billingName(now)}" 로 바뀌었다. ${again}`);
  }
  // 새 앱 — 탭(pid)과 그 작업의 프롬프트·설정·레퍼런스를 한 요청으로. 장수(count)는 늘 보낸다(한도·기록과 맞춘다).
  // 잠금 안에서 기록을 다시 본다 — 분류한 뒤 같은 명령을 동시에 돌린 다른 실행이 이 작업을 넣었으면 건너뛴다
  const otherSent = sentSince;
  async function sendDirect(j, i, need) {
    if ((await inFlight()) + need > MAX_IN_FLIGHT) return false;
    await checkTabUnchanged();
    const other = otherSent(j);
    if (other) return { skip: other };
    const model = j.model ?? defaults.model ?? base.model;
    const resolution = j.resolution ?? defaults.resolution ?? base.resolution;
    const rsv = await usageApi("POST", "/usage", {
      app: "nanobanana", n: need, model, resolution, job: j.name || `job_${i + 1}`,
      billing: `${billing.team_id} / ${billing.project_id}`, project: tab.name, pc: os.hostname(), user: os.userInfo().username, device: device(),
    });
    if (!rsv.ok) throw new Error(rsv.error || `사용 기록을 남기지 못함 (${rsv.http})`);
    const settings = { count: need };
    for (const k of SETTING_KEYS) {
      const v = j[k] ?? defaults[k];
      if (k !== "count" && v !== undefined && v !== null && v !== "") settings[k] = v;
    }
    const body = { pid: tab.pid, prompt: String(j.prompt), settings, ref_paths: j.refs.map((p) => path.resolve(p)) };
    // 넣기 직전에 남긴다 — 앱 답을 못 받고 끊기면 다음 실행은 '모름'으로 멈춘다. 못 남기면 보내지 않는다
    let rid;
    try { rid = ledgerAdd({ key: j.key, name: j.name, tab: tab.name, state: "보내는 중" }); }
    catch (e) { await usageApi("POST", "/usage/settle", { id: rsv.id, n: 0 }).catch(() => {}); throw e; }
    let gr = { ok: false }, answered = false;
    try {
      for (let attempt = 0; attempt < 12; attempt++) {
        answered = false;
        gr = await post("/api/generate", body);
        answered = true;
        if (gr.ok || !/Queue full|Stopping previous batch/i.test(String(gr.error || ""))) break;
        await sleep(5000); // 큐가 차 있으면 자리가 날 때까지 기다린다
      }
    } finally {
      if (!gr.ok) await usageApi("POST", "/usage/settle", { id: rsv.id, n: 0 }).catch(() => {});
      ledgerSet(rid, gr.ok ? { id: gr.batch_id || "", state: "보냄" } : answered ? null : { state: "모름", note: "앱 답을 못 받음" });
    }
    if (!gr.ok) throw new Error(directError(gr, j, i));
    return { model, resolution, rsv, batch_id: gr.batch_id, rid };
  }
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
    const other = otherSent(j);
    if (other) return { skip: other };
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
    let gr = { ok: false }, rid = "", answered = false;
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
      rid = ledgerAdd({ key: j.key, name: j.name, tab: tab.name, state: "보내는 중" });
      for (let attempt = 0; attempt < 12; attempt++) {
        answered = false;
        gr = await post("/api/generate", {});
        answered = true;
        const e = String(gr.error || "");
        if (gr.ok || !/Queue full|Stopping previous batch/i.test(e)) break;
        await sleep(5000); // 큐가 차 있으면 자리가 날 때까지 기다린다
      }
    } finally {
      if (!gr.ok) await usageApi("POST", "/usage/settle", { id: rsv.id, n: 0 }).catch(() => {});
      // 옛 앱은 묶음 id 가 없다 — 보냈다는 것만 남긴다(다시 실행하면 건너뛰기만)
      if (rid) ledgerSet(rid, gr.ok ? { state: "보냄" } : answered ? null : { state: "모름", note: "앱 답을 못 받음" });
      if (!KEEP) await restoreTab(snap, refsTouched);
    }
    if (gr.needs_billing) throw new Error("앱이 팀·프로젝트를 다시 골라 달라고 함");
    if (!gr.ok) throw new Error(`Generate 실패 (${j.name || i + 1}): ${gr.error || gr.raw || "알 수 없음"}`);
    return { model, resolution, rsv, rid };
  }

  let sent = 0;
  const sentJobs = resumed.map((b) => b.j);   // 지켜보고 놓을 작업 — 전에 보내 놓고 끊긴 것(새 앱)부터
  const batches = resumed.map((b, k) => ({ ...b, k }));   // 새 앱 — 작업마다 묶음 id
  try {
    for (const [i, j] of toSend.entries()) {
      const need = countOf(j);
      let done = false;
      while (!done) {
        await waitForRoom(need);
        if (!direct) await waitForTab(tab);
        done = await withSendLock("nanobanana", () => (direct ? sendDirect(j, i, need) : sendOne(j, i, need)));
      }
      if (done.skip) { log(`  건너뜀 ${j.name} — 다른 실행이 ${sentWhen(done.skip)} 에 넣었다(같은 명령을 동시에 돌림)`); continue; }
      if (WORKDIR) keepJobs(WORKDIR, file);
      if (direct) batches.push({ j, k: sentJobs.length, id: done.batch_id, model: done.model, rid: done.rid });
      sentJobs.push(j);
      sent++;
      log(`  보냄 ${sent}/${toSend.length} ${j.name} · ${done.model} ${done.resolution} ×${need} · 오늘 ${done.rsv.used}/${done.rsv.limit}장`);
      await sleep(250);
    }
  } catch (e) {
    console.error(`멈춤: ${e.message}`);
    if (sent < toSend.length) {
      console.error(`  ${sent}/${toSend.length}건까지 들어감 · 안 보낸 작업: ${toSend.slice(sent).map((j) => j.name).join(", ")}`);
    }
    process.exitCode = 1;
  }
  if (sent && !KEEP && !direct) log(`  "${tab.name}" 탭 입력칸은 작업마다 원래대로 돌려놓았다`);
  if (sent && direct) log(`  "${tab.name}" 탭으로 보냈다 — 화면 탭("${screenTab}")과 그 탭의 입력칸은 그대로`);
  if (!sentJobs.length) return;
  if (sent) writePlan(spec, planOf(), { sent: true, jobsFile: file });
  // 결과까지 본 묶음은 '끝'(다시 실행해도 건너뜀) · 그림 0장으로 끝난 것은 기록에서 뺀다(다시 보낼 수 있게) · 안 끝난 것은 그대로(다시 실행하면 이어서)
  const markDone = () => {
    for (const b of batches) {
      if (b.res?.finished) ledgerSet(b.rid, b.res.done ? { state: "끝" } : b.res.cancelled ? { state: "끝", note: "앱에서 멈춤" } : null);
      else if (b.lost && groups[b.k]?.length) ledgerSet(b.rid, { state: "끝" });
    }
  };

  // 6) 지켜보기
  if (!WATCH && !WORKDIR) {
    log(`앱 "${tab.name}" 탭에 ${sent}건 분량이 진행 중일 것. 끝나면 그 탭 갤러리에 들어온다.`);
    return;
  }
  let groups = [], other = [], last = "";   // groups[k] = 그 작업의 그림 [{ filepath, model }]
  const deadline = Date.now() + 60 * 60 * 1000;
  if (direct) {
    // 새 앱 — 묶음마다 /api/batch(완료·실패·취소·끝남). 앱을 다시 켜 집계가 사라졌으면 갤러리의 batch_id 로 찾는다.
    while (Date.now() < deadline) {
      let all = true, done = 0, failed = 0, count = 0;
      for (const b of batches) {
        const r = await get(`/api/batch?pid=${enc}&batch_id=${encodeURIComponent(b.id)}`);
        if (!r?.ok) { b.lost = true; continue; }
        b.res = r;
        done += r.done; failed += r.failed + r.cancelled; count += r.count;
        if (!r.finished) all = false;
      }
      const line = `  진행 ${done}/${count}${failed ? ` · 실패·취소 ${failed}` : ""}`;
      if (line !== last) { log(line); last = line; }
      if (all) break;
      await sleep(4000);
    }
    for (const b of batches) {
      let files = b.res?.images;
      if (!files) files = ((await get(`/api/gallery?pid=${enc}&strict=1&batch_id=${encodeURIComponent(b.id)}`))?.items || []).map((x) => x.filepath);
      groups[b.k] = (files || []).map((filepath) => ({ filepath, model: b.model }));
      for (const e of b.res?.errors || []) log(`  ${b.j.name || `job_${b.k + 1}`} 실패 이유: ${e}`);
    }
  } else {
    // 옛 앱 — 탭 요약만 읽고, 새로 들어온 그림을 프롬프트·모델로 작업에 나눈다
    while (Date.now() < deadline) {
      const pr = await get("/api/projects");
      const t = pr?.projects?.find((p) => p.pid === tab.pid);
      if (!t) break;
      const line = `  진행 ${t.done}/${t.total}${t.failed ? ` · 실패 ${t.failed}` : ""} · 남음 ${t.outstanding}`;
      if (line !== last) { log(line); last = line; }
      if (!t.generating && !t.outstanding) break;
      await sleep(4000);
    }
    const after = (await get(`/api/gallery?pid=${enc}`))?.items || [];
    const fresh = after.filter((i) => !galleryBefore.has(i.filepath));
    // 모델이 같은 작업이 여럿이면 파일 이름만으로는 어느 작업 것인지 모른다. 같은 프롬프트를 모델만 바꿔 보낸 작업은 모델로 가른다.
    const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
    const jobOf = (i) => {
      const same = sentJobs.filter((j) => norm(j.prompt) === norm(i.prompt));
      return same.length > 1 ? same.find((j) => (j.model ?? defaults.model ?? base.model) === i.model) || same[0] : same[0];
    };
    groups = sentJobs.map((j) => fresh.filter((i) => jobOf(i) === j));
    other = fresh.filter((i) => !jobOf(i));
  }
  log(`새로 들어온 이미지 ${groups.reduce((a, g) => a + (g?.length || 0), 0)}장 — 작업별:`);
  for (const [k, j] of sentJobs.entries()) {
    log(`  ${j.name || `job_${k + 1}`} — ${(groups[k] || []).length}/${countOf(j)}장`);
    for (const i of groups[k] || []) log(`    ${i.filepath}`);
  }
  if (other.length) {
    log(`  어느 작업인지 모름 ${other.length}장 — 그사이 사람이 이 탭에서 만든 것일 수 있다`);
    for (const i of other) log(`    ${i.filepath}`);
  }

  // 작업 폴더 — 씬·컷(또는 에셋 종류) 폴더에 이름 규칙대로 복사한다. 앱 저장 폴더의 원본은 그대로 둔다(옮기면 앱 갤러리에서 사라진다).
  if (WORKDIR) {
    const rows = [];
    const have = new Set(readWorkList(WORKDIR).map((x) => x["원본"]).filter(Boolean));   // 끊긴 뒤 이어서 놓을 때 이미 놓은 그림은 건너뛴다
    for (const [k, j] of sentJobs.entries()) {
      const pl = placeOf(spec, j, WORKDIR);   // 보내기 전에 확인했다
      const dir = path.join(WORKDIR, pl.rel);
      fs.mkdirSync(dir, { recursive: true });   // 씬 · 컷 폴더 — 있으면 그대로
      for (const [t, i] of (groups[k] || []).entries()) {
        if (have.has(i.filepath)) continue;
        if (!fs.existsSync(i.filepath)) { log(`  못 옮김 — 원본이 없음: ${i.filepath}`); continue; }
        const name = placeName(WORKDIR, pl, "I", path.extname(i.filepath) || ".png", j.name);
        fs.copyFileSync(i.filepath, path.join(dir, name));
        have.add(i.filepath);   // 같은 실행에서 같은 그림을 두 번 놓지 않게
        rows.push({ 폴더: pl.rel, 파일: name, 작업: j.name || `job_${k + 1}`, 테이크: String.fromCharCode(65 + t), 모델: i.model || "", 원본: i.filepath,
          씬: pl.scene || "", 컷: pl.cut || "", 범위: pl.range || "", 안: pl.version || "", "받은 시각": new Date().toISOString(), 프롬프트: takePrint(spec, j) });
        log(`  ${pl.rel}/${name}`);
      }
    }
    appendWorkList(WORKDIR, rows);
    log(rows.length ? `그림 ${rows.length}장을 작업 폴더에 놓았다(앱 원본은 그대로) · 목록 _검수/목록.tsv — 검수 뒤 OK 는 그 자리, 보류는 보류 폴더, 탈락은 지운다`
      : "놓은 그림 없음");
    markDone();
    return;
  }
  // --save-to(작업 폴더 없이): 그 폴더로 복사한다 — <작업 이름>_A.png, _B … 같은 이름이 있으면 _2. 어느 파일이 어디서 왔는지는 _목록.tsv 에.
  if (SAVE_TO) {
    const safe = (s) => String(s || "job").replace(/[\\/:*?"<>|]+/g, "_").trim();
    fs.mkdirSync(SAVE_TO, { recursive: true });
    const rows = [];
    const list = path.join(SAVE_TO, "_목록.tsv");
    const have = new Set((fs.existsSync(list) ? fs.readFileSync(list, "utf8") : "").split("\n").map((l) => l.split("\t")[3]).filter(Boolean));
    for (const [k, j] of sentJobs.entries()) {
      for (const [t, i] of (groups[k] || []).entries()) {
        if (have.has(i.filepath)) continue;   // 끊긴 뒤 이어서 — 이미 복사한 그림
        if (!fs.existsSync(i.filepath)) { log(`  못 옮김 — 원본이 없음: ${i.filepath}`); continue; }
        const name = safe(j.name || `job_${k + 1}`), take = String.fromCharCode(65 + t), ext = path.extname(i.filepath) || ".png";
        let dest = path.join(SAVE_TO, `${name}_${take}${ext}`);
        for (let n = 2; fs.existsSync(dest); n++) dest = path.join(SAVE_TO, `${name}_${take}_${n}${ext}`);
        fs.copyFileSync(i.filepath, dest);
        rows.push([j.name || `job_${k + 1}`, take, i.model || "", i.filepath, path.basename(dest)].join("\t"));
      }
    }
    if (rows.length) fs.appendFileSync(list, `${fs.existsSync(list) ? "" : "작업\t테이크\t모델\t원본\t파일\n"}${rows.join("\n")}\n`);
    log(rows.length ? `그림 ${rows.length}장을 ${SAVE_TO} 로 복사했다(앱 원본은 그대로) · 목록 _목록.tsv` : "복사한 그림 없음");
  }
  markDone();
}

main().catch((e) => {
  console.error(`멈춤: ${e.message}`);
  process.exitCode = 1;
});
