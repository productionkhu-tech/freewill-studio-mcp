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

let token = "";
const log = (...m) => console.log(...m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

function fail(msg) {
  console.error(`멈춤: ${msg}`);
  process.exit(1);
}

async function activeTab() {
  const pr = await get("/api/projects");
  return pr?.projects?.find((p) => p.pid === pr.active) || null;
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

  // 3) 원래 입력값 보관 (다 넣은 뒤 되돌린다)
  const before = await get("/api/settings");
  if (DRY) {
    log(`  지금 탭 설정: ${before.model} · ${before.resolution} · ${before.aspect} · ×${before.count}`);
    for (const [i, j] of jobs.entries()) {
      const m = j.model ?? defaults.model ?? before.model, r = j.resolution ?? defaults.resolution ?? before.resolution;
      log(`  ${i + 1}. ${j.name || ""} · ${m} ${r} ×${j.count ?? defaults.count ?? before.count} · 레퍼런스 ${(j.refs || []).length}장`);
    }
    return;
  }
  const refsBefore = (await get("/api/refs"))?.refs || [];
  const galleryBefore = new Set(((await get(`/api/gallery?pid=${encodeURIComponent(tab.pid)}`))?.items || []).map((i) => i.filepath));
  const tabHadRefs = refsBefore.some((r) => !r.empty);
  let refsTouched = false;

  // 4) 작업마다: 레퍼런스 → 설정·프롬프트 → Generate
  let sent = 0;
  try {
    for (const [i, j] of jobs.entries()) {
      const now = await activeTab();
      if (now?.pid !== tab.pid) throw new Error(`보내는 중에 탭이 바뀜 ("${now?.name}") — ${sent}건까지 들어감`);

      const refs = j.refs || [];
      if (refs.length || tabHadRefs || refsTouched) {
        const err = await setRefs(refs);
        refsTouched = true;
        if (err) throw new Error(err);
      }
      const s = { pid: tab.pid, fixed_prompt: "", prompt_sections: [String(j.prompt)] };
      for (const k of SETTING_KEYS) {
        const v = j[k] ?? defaults[k];
        if (v !== undefined && v !== null) s[k] = v;
      }
      const sr = await post("/api/settings", s);
      if (!sr.ok) throw new Error(`설정을 못 넣음: ${sr.error || sr.raw || "알 수 없음"}`);

      let gr;
      for (let attempt = 0; attempt < 12; attempt++) {
        gr = await post("/api/generate", {});
        const e = String(gr.error || "");
        if (gr.ok || !/Queue full|Stopping previous batch/i.test(e)) break;
        await sleep(5000); // 큐가 차 있으면 자리가 날 때까지 기다린다
      }
      if (gr.needs_billing) throw new Error("앱이 팀·프로젝트를 다시 골라 달라고 함");
      if (!gr.ok) throw new Error(`Generate 실패 (${j.name || i + 1}): ${gr.error || gr.raw || "알 수 없음"}`);
      sent++;
      log(`  보냄 ${sent}/${jobs.length} ${j.name || ""} · ${s.model || before.model} ${s.resolution || before.resolution} ×${s.count || before.count}`);
      await sleep(250);
    }
  } catch (e) {
    console.error(`멈춤: ${e.message}`);
    process.exitCode = 1;
  }

  // 5) 탭 입력값 되돌리기 — 들어간 작업은 각자 설정을 저장해 둬서 영향 없다
  if (!KEEP) {
    const restore = { pid: tab.pid, fixed_prompt: before.fixed_prompt ?? "", prompt_sections: before.prompt_sections ?? [] };
    for (const k of SETTING_KEYS) if (before[k] !== undefined) restore[k] = before[k];
    await post("/api/settings", restore);
    if (refsTouched) {
      await post("/api/refs/clear", { preserve_pinned: false });
      const keep = refsBefore.filter((r) => !r.empty && r.path);
      for (const r of keep) await post("/api/refs/add-path", { filepath: r.path });
      if (refsBefore.some((r) => r.empty)) log("  참고: 탭의 레퍼런스는 되돌렸지만 비어 있던 칸(번호 구멍)은 메워졌다");
      if (refsBefore.some((r) => r.pinned)) log("  참고: 고정(핀)해 둔 레퍼런스는 다시 고정해야 한다");
    }
    log(`  "${tab.name}" 탭 입력값을 원래대로 돌려놓음`);
  }
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

main().catch((e) => fail(e.message));
