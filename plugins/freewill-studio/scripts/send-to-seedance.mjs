#!/usr/bin/env node
// 실행 중인 시댄스 앱으로 영상 생성 요청을 보낸다 — 사람이 전송 버튼을 누르는 것과 같은 경로.
//
// 시댄스(26.10.302~) 서버의 '에이전트 작업함'에 요청을 넣으면, 앱 화면이 2초 안에 받아서 작성 칸을 잠깐 빌려
// 설정·레퍼런스·프롬프트를 넣고 전송 버튼과 같은 함수로 보낸 뒤, 작성 칸을 원래대로 돌려놓는다. 그래서 앱에
// 생성 중 카드가 뜨고, 권한 검사·크레딧 집계·영상 보관이 평소대로 된다. 레퍼런스 검사도 드래그와 같다.
//
// 진행은 /api/agent/* 로만 본다. /api/byteplus/tasks/<id> 는 부르지 않는다 — 그 조회는 성공을 처음 본 순간
// 크레딧 보고·영상 보관을 하고 기록을 지운다(앱 화면이 하는 일이다).
//
//   node send-to-seedance.mjs jobs.json --dry-run   앱 상태만 확인(프로젝트·과금·작성 칸) — 아무것도 안 보냄
//   node send-to-seedance.mjs jobs.json             보내기 — 앱이 받아서 보낼 때까지 하나씩
//   node send-to-seedance.mjs jobs.json --watch     보내고 영상이 다 끝날 때까지 지켜봄
//   node send-to-seedance.mjs --status <id> [<id>]  보낸 요청의 지금 상태
//
// jobs.json:
//   {
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
// 설정 키: model mode omniTask ratio duration resolution output_count(1~3) generate_audio return_last_frame draft
//          output_format. 안 준 값은 앱의 지금 설정을 따른다(모델·모드를 바꾸면 그 조합의 기본값). 레퍼런스 순서가
//          프롬프트의 [Image N]·[Video N]·[Audio N] 번호다(종류별로 센다). 첫·끝 프레임은 role 로 정한다.

import fs from "node:fs";
import path from "node:path";

const SD = process.env.FREEWILL_SD_URL || "http://127.0.0.1:3000";
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const DRY = flag("--dry-run");
const WATCH = flag("--watch");
const STATUS = flag("--status");
const positional = args.filter((a) => !a.startsWith("--"));
const SETTING_KEYS = ["model", "mode", "omniTask", "ratio", "duration", "resolution", "output_count",
  "generate_audio", "return_last_frame", "draft", "output_format"];

const log = (...m) => console.log(...m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(method, p, body, ms = 10000) {
  const r = await fetch(`${SD}${p}`, {
    method, headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(ms),
  });
  const text = await r.text();
  try { return { http: r.status, ...JSON.parse(text) }; } catch { return { http: r.status, raw: text.slice(0, 200) }; }
}
const get = (p) => req("GET", p);
const post = (p, b) => req("POST", p, b);

function fail(msg) {
  console.error(`멈춤: ${msg}`);
  process.exit(1);
}

async function appStatus() {
  let s;
  try { s = await get("/api/agent/status"); } catch { fail("시댄스가 꺼져 있다 — 앱을 켜 달라고 할 것"); }
  // 작업함이 없는 옛 버전은 이 주소에 화면(HTML)이나 404 를 준다.
  if (!s || s.ok !== true) fail("이 PC 의 시댄스는 에이전트 연결 전 버전이다 — 앱을 껐다 켜서 업데이트(26.10.302 이상)해 달라고 할 것");
  return s;
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
  if (STATUS) {
    if (!positional.length) fail("--status 뒤에 요청 id 를 주세요");
    await appStatus();
    return showStatus(positional);
  }
  const file = positional[0];
  if (!file) fail("작업 파일(jobs.json)을 주세요");
  let spec;
  try { spec = JSON.parse(fs.readFileSync(file, "utf8").replace(new RegExp("^" + String.fromCharCode(0xfeff)), "")); } catch (e) { fail(`작업 파일을 못 읽음 — ${e.message}`); }
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

  // 1) 앱 상태 — 켜져 있는지, 프로젝트·과금이 골라져 있는지, 작성 칸이 있는지
  const s = await appStatus();
  if (!s.screenAlive) fail("시댄스 서버는 켜져 있지만 앱 화면이 응답하지 않는다 — 앱 창이 열려 있는지 확인해 달라고 할 것");
  if (!s.project) fail("앱에 열린 프로젝트가 없다 — 앱에서 프로젝트(사이드바)를 열어 달라고 할 것");
  if (!s.billing) fail(`"${s.project}" 에 과금 프로젝트가 안 골라져 있다 — 앱 설정 패널 맨 위 "프로젝트" 드롭다운에서 고르게 할 것`);
  if (spec.project && spec.project !== s.project) fail(`앱에 열린 프로젝트는 "${s.project}" — 확인한 "${spec.project}" 와 다르다. 사용자에게 확인할 것`);
  if (spec.billing && spec.billing !== s.billing) fail(`앱의 과금 프로젝트는 "${s.billing}" — 확인한 "${spec.billing}" 와 다르다. 사용자에게 확인할 것`);
  const project = spec.project || s.project;
  const billing = spec.billing || s.billing;
  log(`프로젝트 "${project}" · 과금 "${billing}" 로 ${jobs.length}건 ${DRY ? "보낼 예정 (dry-run — 아무것도 안 보냄)" : "보냄"}`);
  if (s.composer === false) log("  참고: 앱이 갤러리 화면이다 — 채팅 화면으로 돌아와야 받는다");
  if (s.pending) log(`  참고: 앱이 아직 받지 않은 요청이 ${s.pending}건 있다`);

  const settingsOf = (j) => {
    const out = {};
    for (const k of SETTING_KEYS) { const v = j[k] ?? defaults[k]; if (v !== undefined && v !== null) out[k] = v; }
    return out;
  };
  if (DRY) {
    for (const [i, j] of jobs.entries()) {
      const st = settingsOf(j);
      log(`  ${i + 1}. ${j.name || ""} · ${Object.entries(st).map(([k, v]) => `${k}=${v}`).join(" ") || "(앱 지금 설정 그대로)"} · 레퍼런스 ${j.refs.length}개`);
    }
    return;
  }

  // 2) 하나씩 넣고, 앱이 보낼 때까지 기다린다. 하나라도 실패하면 거기서 멈춘다 — 같은 실수를 나머지에 반복하지 않게.
  const sent = [];
  for (const [i, j] of jobs.entries()) {
    const r = await post("/api/agent/jobs", {
      name: j.name || `job_${i + 1}`, prompt: String(j.prompt), project, billing,
      settings: settingsOf(j), refs: j.refs,
    });
    if (r.http !== 200 || !r.id) {
      console.error(`멈춤: 요청을 못 넣음 (${j.name || i + 1}): ${r.error || r.raw || r.http}`);
      process.exitCode = 1;
      break;
    }
    const res = await waitTaken(r.id);
    if (res.status === "failed") {
      console.error(`멈춤: ${j.name || i + 1} 실패 — ${res.error || "이유 없음"}`);
      if (jobs.length - i - 1 > 0) console.error(`  나머지 ${jobs.length - i - 1}건은 보내지 않았다`);
      process.exitCode = 1;
      break;
    }
    sent.push({ id: r.id, name: j.name || `job_${i + 1}` });
    const cards = res.messages || [];
    log(`  보냄 ${sent.length}/${jobs.length} ${j.name || ""} — 카드 ${cards.length}개${cards.some((c) => c.status === "failed") ? ` (실패 ${cards.filter((c) => c.status === "failed").length})` : ""} · id ${r.id}`);
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

main().catch((e) => fail(e.message));
