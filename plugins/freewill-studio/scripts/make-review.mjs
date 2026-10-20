#!/usr/bin/env node
// 작업 페이지 — 작업 하나에 HTML 하나. <작업 폴더>/<작업 이름>.html 하나를 계속 고쳐 쓴다(사용자 10/20 "html 늘려 가면 피곤함 — 한 html 에서 목차").
// 목차: 한눈에(폴더마다 OK·보류·미정·새로) · 검수(컷마다 테이크 — OK·보류·탈락·메모) · 보낼 것(다음에 보낼 작업의 레퍼런스 그림) · 기록(회차마다 피드백) · 프롬프트.
// 검수는 로컬 서버 주소로 연다(--serve) — 저장을 누르면 그 자리에서 파일을 OK/·보류/·탈락/ 으로 옮기고 회차를 남긴다(JSON 내려받기 없음, 사용자 10/20).
// 서버는 작업마다 하나 — 이미 떠 있으면 그 주소를 다시 쓴다. 45분 동안 아무도 안 열면 스스로 꺼진다.
// 페이지를 파일로 열었을 때 서버가 떠 있으면 그 주소로 넘어가고, 꺼져 있으면 저장은 다운로드 폴더의 JSON 으로 받아 --apply 로 반영한다.
// 지우는 일은 없다 — 탈락도 탈락/ 으로 옮기기만 한다(예전 저장본의 "NG" 는 탈락으로 읽는다).
//
//   node make-review.mjs <작업 폴더> [--title "작업 이름"] [--force]   → <작업 폴더>/<작업 이름>.html 을 다시 쓴다
//   node make-review.mjs <작업 폴더> --serve                         → 저장되는 주소(작업마다 하나). 꺼져 있으면 띄울 명령 한 줄을 알려 준다
//                                                                    (이 스크립트는 다른 프로그램을 실행하지 않는다 — 커넥터 통신 검사)
//   node make-review.mjs <작업 폴더> --apply <저장본.json>              → (파일로 연 페이지의 저장본) 분류대로 옮김 · 회차 · 페이지 다시
//   node make-review.mjs [<작업 폴더>] --review on|off|status          → 검수를 켜고 끔(폴더를 주면 그 작업만, 안 주면 이 PC 사용자의 모든 작업)
//
// 폴더: 받은 결과는 종류별 폴더(01_에셋/인물 · 01_에셋/로케이션 · 01_에셋/프랍, 02_이미지, 03_영상_초안, 04_영상_본편 …)의
//       _목록.tsv(보내기 스크립트 --save-to 가 남김)로 찾는다. 검수 뒤에는 그 폴더 안이 OK/ · 보류/ · 탈락/ 으로 나뉜다.
// 보낼 것: 보내기 스크립트가 jobs.json 의 "work" 로 <작업 폴더>/_검수/보낼것.json 을 남기면 그 레퍼런스를 그림으로 보여 준다
//          (사용자 10/20 "돌리기 전에 어떤 레퍼런스 쓸 건지 시각적으로").
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const USAGE = "쓰는 법: node make-review.mjs <작업 폴더> [--title \"작업 이름\"] [--force] | <작업 폴더> --serve | " +
  "<작업 폴더> --apply <저장본.json> | [<작업 폴더>] --review on|off|status (폴더를 주면 그 작업만, 안 주면 이 PC 사용자의 모든 작업)";
const argv = process.argv.slice(2);
let work = "", title = "", applyFile = "", reviewArg = "", force = false, serve = false, child = false, childPort = 0;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--title") title = argv[++i] || "";
  else if (argv[i] === "--apply") applyFile = argv[++i] || "";
  else if (argv[i] === "--review") reviewArg = argv[++i] || "status";
  else if (argv[i] === "--force") force = true;
  else if (argv[i] === "--serve") serve = true;
  else if (argv[i] === "--server-child") child = true;
  else if (argv[i] === "--port") childPort = Number(argv[++i]) || 0;
  else if (argv[i] === "-h" || argv[i] === "--help") { console.log(USAGE); process.exit(0); }
  else if (!work) work = argv[i];
}
if (!(reviewArg && !work) && (!work || !fs.existsSync(work) || !fs.statSync(work).isDirectory())) { console.error(USAGE); process.exit(2); }
if (work) work = path.resolve(work);
const REVIEW_DIR = path.join(work, "_검수");
const MASTER = path.join(work, "_컷목록.tsv");
const ROUNDS = path.join(REVIEW_DIR, "회차.json");
const PLAN = path.join(REVIEW_DIR, "보낼것.json");
const SERVER_FILE = path.join(REVIEW_DIR, "서버.json");
const WORK_SETTINGS = path.join(work, "_작업설정.json");
const ME_SETTINGS = path.join(os.homedir(), ".freewill-studio", "settings.json");
const STATUSES = ["OK", "보류", "탈락"];
const VIDEO = /\.(mp4|mov|m4v|webm)$/i;
const MEDIA = /\.(png|jpe?g|webp|gif|mp4|mov|m4v|webm)$/i;
const IDLE_MS = 45 * 60 * 1000;

// 이 PC 의 검수 서버 주소 — 포트는 URL 이 숫자로만 받는다(글자를 이어 붙여 다른 곳을 가리키지 못하게)
function local(port, p = "") {
  const u = new URL("http://127.0.0.1:1/");
  u.port = String(port);
  return new URL(p, u).href;
}

// ---------- 읽기 ----------
const BOM = new RegExp("^" + String.fromCharCode(0xfeff));
const readText = (p) => fs.readFileSync(p, "utf8").replace(BOM, "");
const readJson = (p) => { try { return JSON.parse(readText(p)); } catch { return {}; } };
function readTsv(p) {
  const lines = readText(p).split(/\r?\n/).filter((l) => l.trim());
  const head = (lines.shift() || "").split("\t");
  return lines.map((l) => Object.fromEntries(l.split("\t").map((v, i) => [head[i] || `c${i}`, v])));
}
const rel = (p) => path.relative(work, p).split(path.sep).join("/");

// 작업 이름 = 페이지 파일 이름. 한 번 정하면 _작업설정.json 에 남겨 다음에도 같은 파일을 고친다.
function workTitle() {
  const saved = work ? readJson(WORK_SETTINGS).title : "";
  const t = (title || saved || path.basename(work || "")).replace(/[\\/:*?"<>|]/g, " ").trim() || "작업";
  if (work && title && title !== saved) fs.writeFileSync(WORK_SETTINGS, JSON.stringify({ ...readJson(WORK_SETTINGS), title: t }, null, 2));
  return t;
}

// 지금 그 파일이 어디 있는지 — 받은 자리(미정) · OK/ · 보류/ · 탈락/ (예전 판의 _후보/<폴더>/ 도 탈락으로 본다)
function locate(folder, file) {
  const base = path.join(work, folder);
  const spots = [[path.join(base, file), ""], [path.join(base, "OK", file), "OK"], [path.join(base, "보류", file), "보류"],
    [path.join(base, "탈락", file), "탈락"], [path.join(work, "_후보", folder, file), "탈락"]];
  const hit = spots.find(([p]) => fs.existsSync(p));
  return hit ? { abs: hit[0], status: hit[1] } : null;
}

// _목록.tsv 가 있는 폴더 — 01_에셋/인물 처럼 종류별 하위 폴더까지(OK/·보류/·탈락/ 과 _로 시작하는 폴더는 건너뜀)
function listFolders(dir = work, depth = 0, out = []) {
  if (depth > 4) return out;
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith("_") || d.name.startsWith(".") || STATUSES.includes(d.name)) continue;
    const p = path.join(dir, d.name);
    if (fs.existsSync(path.join(p, "_목록.tsv"))) out.push(rel(p));
    listFolders(p, depth + 1, out);
  }
  return out.sort();
}

function scan() {
  const takes = [];
  for (const folder of listFolders()) {
    const seen = new Set();
    for (const r of readTsv(path.join(work, folder, "_목록.tsv"))) {
      const file = r["파일"];
      if (!file || seen.has(file)) continue;
      seen.add(file);
      const where = locate(folder, file);
      if (!where) continue;   // 사람이 지웠거나 다른 데로 옮김
      takes.push({ key: `${folder}/${file}`, folder, cut: r["작업"] || file, take: r["테이크"] || "", card: r["카드"] || "", task: r["task"] || "",
        model: r["모델"] || "", file, abs: where.abs, status: where.status, video: VIDEO.test(file) });
    }
  }
  return takes;
}

// 폴더 이름을 사람 말로 — 01_에셋/인물 → 에셋 · 인물
const folderLabel = (f) => f.split("/").map((s) => s.replace(/^\d+_/, "").replace(/_/g, " ")).join(" · ");

// 보낸 jobs.json 들 — 작업 이름 → 프롬프트·설정
function readPrompts() {
  const map = new Map();
  const dir = path.join(work, "05_프롬프트");
  if (!fs.existsSync(dir)) return map;
  for (const f of fs.readdirSync(dir).filter((n) => /\.json$/i.test(n)).sort()) {
    try {
      const spec = JSON.parse(readText(path.join(dir, f)));
      for (const j of spec.jobs || []) {
        if (j?.name && j.prompt) map.set(j.name, { prompt: String(j.prompt), model: j.model ?? spec.defaults?.model ?? "", mode: j.mode ?? spec.defaults?.mode ?? "", file: f });
      }
    } catch {}
  }
  return map;
}

// 지난 검수 회차 — 저장할 때마다 하나씩 쌓인다. 회차 기록이 없던 예전 판은 _컷목록.tsv 를 1차로 읽는다.
// 회차 = { n, at, file(저장본 이름), keys(그때 있던 테이크), takes{키:{status, memo}}, cuts{컷:메모} }
function readRounds() {
  const r = readJson(ROUNDS);
  if (Array.isArray(r.rounds)) return r.rounds;
  if (!fs.existsSync(MASTER)) return [];
  const takes = {}, cuts = {}, keys = [];
  for (const row of readTsv(MASTER)) {
    const key = `${row["폴더"]}/${path.basename(row["파일"] || "")}`;
    keys.push(key);
    takes[key] = { status: row["상태"] === "미정" ? "" : row["상태"] || "", memo: row["메모"] || "" };
    if (row["컷 메모"]) cuts[`${row["폴더"]}/${row["컷"]}`] = row["컷 메모"];
  }
  return [{ n: 1, at: fs.statSync(MASTER).mtime.toISOString(), file: "_컷목록.tsv", keys, takes, cuts }];
}

// 검수를 할지 — 사용자가 "검수 빼" 라고 한 것을 기억한다. 작업 폴더의 _작업설정.json 이 먼저, 없으면 이 PC 사용자의
// ~/.freewill-studio/settings.json, 둘 다 없으면 켬.
function reviewSetting(w) {
  const here = w ? readJson(path.join(w, "_작업설정.json")).review : undefined;
  const mine = readJson(ME_SETTINGS).review;
  if (typeof here === "boolean") return { on: here, from: "이 작업 설정(_작업설정.json)" };
  if (typeof mine === "boolean") return { on: mine, from: "이 PC 사용자 설정(~/.freewill-studio/settings.json)" };
  return { on: true, from: "기본값" };
}
function setReview(w, on) {
  const file = w ? path.join(w, "_작업설정.json") : ME_SETTINGS;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...readJson(file), review: on, review_set_at: new Date().toISOString() }, null, 2));
  return file;
}

// ---------- 적용 ----------
// 열려 있는 파일(재생 중인 영상)이 있으면 Windows 는 옮기기를 막는다 — 잠깐씩 기다리며 다시, 끝내 안 되면 그대로 두고 알린다(복사본을 남기지 않는다)
function moveFile(from, to) {
  for (let i = 0; i < 6; i++) {
    try { fs.renameSync(from, to); return true; } catch (e) {
      if (e.code === "EXDEV") { fs.copyFileSync(from, to); fs.rmSync(from, { force: true }); return true; }
      const until = Date.now() + 150 * (i + 1);
      while (Date.now() < until) { /* 잠깐 */ }
    }
  }
  return false;
}

function apply(saved, savedName) {
  const takes = scan();
  const byKey = new Map(takes.map((t) => [t.key, t]));
  const moved = [], stuck = [], okCards = [], roundTakes = {};
  for (const [key, d] of Object.entries(saved.takes || {})) {
    const t = byKey.get(key);
    if (!t) continue;
    const raw = d?.status === "NG" ? "탈락" : d?.status;   // 예전 저장본
    const status = STATUSES.includes(raw) ? raw : "";
    const target = status ? path.join(work, t.folder, status, t.file) : path.join(work, t.folder, t.file);
    if (path.resolve(target) !== path.resolve(t.abs)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (moveFile(t.abs, target)) { moved.push(`${status || "미정"} ← ${key}`); t.abs = target; t.status = status; }
      else stuck.push(key);
    } else t.status = status;
    const memo = String(d?.memo || "").trim();
    if (status || memo) roundTakes[key] = { status: t.status, memo };
    if (t.status === "OK" && t.card) okCards.push(t.card);
  }
  // 이번 회차를 쌓는다 — 같은 저장본을 또 적용하면 회차는 늘리지 않는다(옮기기만 다시). 같은 저장본인지는 저장 시각으로
  const rounds = readRounds();
  const dup = rounds.find((r) => (saved.saved_at ? r.at === saved.saved_at : r.file === savedName));
  if (!dup) {
    const cuts = Object.fromEntries(Object.entries(saved.cuts || {}).map(([k, v]) => [k, String(v || "").trim()]).filter(([, v]) => v));
    rounds.push({ n: rounds.length + 1, at: saved.saved_at || new Date().toISOString(), file: savedName, keys: takes.map((t) => t.key), takes: roundTakes, cuts });
    fs.mkdirSync(REVIEW_DIR, { recursive: true });
    fs.writeFileSync(ROUNDS, JSON.stringify({ rounds }, null, 1));
  }
  // _컷목록.tsv 의 메모는 회차를 통틀어 가장 최근에 적은 것
  const latest = (pick) => [...rounds].reverse().map(pick).find(Boolean) || "";
  const rows = takes.map((t) => [t.folder, t.cut, t.take, t.status || "미정", rel(t.abs), t.card, t.task,
    latest((r) => r.takes?.[t.key]?.memo).replace(/\s+/g, " "), latest((r) => r.cuts?.[`${t.folder}/${t.cut}`]).replace(/\s+/g, " ")].join("\t"));
  fs.writeFileSync(MASTER, `폴더\t컷\t테이크\t상태\t파일\t카드\ttask\t메모\t컷 메모\n${rows.join("\n")}\n`);
  return { moved, stuck, okCards, takes, round: dup ? dup.n : rounds.length, dup: !!dup };
}

// OK 영상 카드 — 앱에서도 채택(★). 인자는 JSON 파일로(Windows PowerShell 은 명령줄의 큰따옴표를 깨뜨린다)
function starHints(okCards) {
  return okCards.map((id, i) => {
    const argFile = path.join(REVIEW_DIR, `_star_${i + 1}.json`);
    fs.writeFileSync(argFile, JSON.stringify({ id, on: true }));
    return `node send-to-seedance.mjs --do card.star "@${argFile}"`;
  });
}

// ---------- 그리기 ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const when = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? "" : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// 그림·영상 주소 — 서버로 열면 /f/…(작업 폴더 안) · /r/…(보낼 것의 바깥 레퍼런스), 파일로 열면 상대 경로 · file 주소
function mediaUrl(abs, served) {
  const inside = !path.relative(work, abs).startsWith("..") && !path.isAbsolute(path.relative(work, abs));
  if (served) return inside ? `/f/${rel(abs).split("/").map(encodeURIComponent).join("/")}` : `/r/${Buffer.from(abs).toString("base64url")}`;
  return inside ? rel(abs).split("/").map(encodeURIComponent).join("/") : pathToFileURL(abs).href;
}

// 보낼 것 — 엘리먼트 @{이름} 은 작업 폴더의 에셋(_목록.tsv 의 작업 이름이 같은 것, OK 먼저)으로 그림을 찾는다
function elementPicture(takes, name) {
  const mine = takes.filter((t) => t.cut === name && !t.video && t.status !== "탈락");
  return (mine.find((t) => t.status === "OK") || mine[0])?.abs || "";
}

function render(served) {
  const pageTitle = workTitle();
  const takes = scan();
  const prompts = readPrompts();
  const rounds = readRounds();
  const plan = readJson(PLAN);
  const round = rounds.length + 1;                       // 지금 하는 회차
  const before = new Set(rounds.length ? rounds[rounds.length - 1].keys || [] : []);
  const isNew = (t) => rounds.length > 0 && !before.has(t.key);
  const folders = [...new Set(takes.map((t) => t.folder))];
  const fid = (f) => `f${folders.indexOf(f)}`;

  // 한눈에 — 폴더마다 무엇이 몇 개, 지금 볼 것이 어디 있는지
  const counts = (list) => ({ OK: list.filter((t) => t.status === "OK").length, 보류: list.filter((t) => t.status === "보류").length,
    탈락: list.filter((t) => t.status === "탈락").length, 미정: list.filter((t) => !t.status).length, 새로: list.filter(isNew).length });
  const overview = folders.map((f) => {
    const c = counts(takes.filter((t) => t.folder === f));
    const todo = c.새로 + c.미정 + c.보류;
    return `<tr><td><a href="#${fid(f)}">${esc(folderLabel(f))}</a><span class="path">${esc(f)}</span></td><td class="ok">${c.OK}</td><td class="hold">${c.보류}</td>` +
      `<td>${c.미정}</td><td class="new">${c.새로 || ""}</td><td class="drop">${c.탈락}</td><td>${todo ? `<b>볼 것 ${todo}</b>` : "끝"}</td></tr>`;
  }).join("");

  // 검수 — 컷마다 테이크, 지난 피드백은 읽기 전용으로
  const takeHist = (key) => rounds.filter((r) => r.takes?.[key]?.memo).map((r) =>
    `<div class="hist"><b>${r.n}차 · ${esc(when(r.at))}</b> ${esc(r.takes[key].status || "미정")} — ${esc(r.takes[key].memo)}</div>`).join("");
  const cutHist = (ckey, mine) => rounds.filter((r) => r.cuts?.[ckey]).map((r) => {
    const after = mine.filter((t) => !(r.keys || []).includes(t.key)).map((t) => t.take || t.file);
    return `<div class="past"><b>${r.n}차 피드백 · ${esc(when(r.at))}</b> ${esc(r.cuts[ckey])} <span class="${after.length ? "done" : "todo"}">${
      after.length ? `→ 그 뒤 새 테이크 ${esc(after.join(" · "))}` : "→ 아직 새 테이크 없음"}</span></div>`;
  }).join("");
  const review = folders.map((folder) => {
    const cuts = [...new Set(takes.filter((t) => t.folder === folder).map((t) => t.cut))];
    return `<section class="folder" id="${fid(folder)}"><h3>${esc(folderLabel(folder))}<span class="path">${esc(folder)}</span></h3>${cuts.map((cut) => {
      const mine = takes.filter((t) => t.folder === folder && t.cut === cut).sort((a, b) => a.take.localeCompare(b.take));
      const p = prompts.get(cut);
      const ckey = `${folder}/${cut}`;
      const fresh = mine.filter(isNew).length;
      return `<article class="cut" data-cut="${esc(ckey)}">
<div class="cut-head"><h4>${esc(cut)}</h4>${p ? `<span class="chip">${esc([p.model, p.mode].filter(Boolean).join(" · "))}</span>` : ""}<span class="chip">${mine.length}개</span>${fresh ? `<span class="chip new">새 테이크 ${fresh}</span>` : ""}</div>
${cutHist(ckey, mine)}
<div class="takes">${mine.map((t) => `<div class="take" data-key="${esc(t.key)}" data-status="${esc(t.status)}" data-new="${isNew(t) ? 1 : ""}">
${t.video ? `<video src="${mediaUrl(t.abs, served)}" preload="metadata" muted playsinline></video>` : `<img src="${mediaUrl(t.abs, served)}" alt="${esc(t.key)}" loading="lazy">`}
<div class="tf"><b>${esc(t.take || t.file)}${isNew(t) ? `<span class="newb">새로</span>` : ""}</b><span class="seg">${STATUSES.map((s) => `<button type="button" data-s="${s}">${s}</button>`).join("")}</span></div>
${takeHist(t.key)}<textarea class="memo" placeholder="${round > 1 ? `${round}차 메모` : "이 테이크 메모"}"></textarea></div>`).join("")}</div>
<textarea class="cmemo" placeholder="${round > 1 ? `${round}차 컷 메모 — 이번에 고칠 것` : "이 컷 메모 — 무엇을 고칠지"}"></textarea>
${p ? `<details><summary>보낸 프롬프트</summary><pre>${esc(p.prompt)}</pre></details>` : ""}
</article>`;
    }).join("")}</section>`;
  }).join("");

  // 보낼 것 — 다음에 보낼 작업마다 레퍼런스 그림(파일 · 엘리먼트)
  const planJobs = Array.isArray(plan.jobs) ? plan.jobs : [];
  const planHtml = planJobs.length ? `<p class="intro">${esc(plan.app === "seedance" ? "시댄스" : "나노바나나")} · ${esc([plan.project || plan.tab, plan.billing].filter(Boolean).join(" · "))} · ${esc(when(plan.at))} — ` +
    `${plan.sent ? `<b>보냄</b>(${esc(when(plan.sentAt))})` : "<b>보내기 전</b> — 이 레퍼런스가 맞는지 보고 아니면 말해 달라"}</p>` + planJobs.map((j) => {
    const refs = (j.refs || []).map((r) => {
      const p = typeof r === "string" ? r : r.path;
      const role = typeof r === "string" ? "" : r.role || "";
      const ok = p && fs.existsSync(p);
      return `<figure class="ref">${ok ? (VIDEO.test(p) ? `<video src="${mediaUrl(path.resolve(p), served)}" preload="metadata" muted></video>` : `<img src="${mediaUrl(path.resolve(p), served)}" loading="lazy" alt="">`) : `<div class="miss">파일 없음</div>`}` +
        `<figcaption>${esc(role || path.basename(p || ""))}</figcaption></figure>`;
    }).join("");
    const els = (j.elements || []).map((n) => {
      const pic = elementPicture(takes, n);
      return `<figure class="ref el">${pic ? `<img src="${mediaUrl(pic, served)}" loading="lazy" alt="">` : `<div class="miss">앱 라이브러리</div>`}<figcaption>@{${esc(n)}}</figcaption></figure>`;
    }).join("");
    return `<article class="job"><div class="cut-head"><h4>${esc(j.name || "")}</h4><span class="chip">${esc([j.model, j.mode].filter(Boolean).join(" · "))}</span>` +
      `<span class="chip">레퍼런스 ${(j.refs || []).length + (j.elements || []).length}개</span></div>` +
      `<div class="refs">${refs + els || `<div class="none">레퍼런스 없음 — 글로만</div>`}</div>` +
      (j.prompt ? `<details><summary>프롬프트</summary><pre>${esc(j.prompt)}</pre></details>` : "") + `</article>`;
  }).join("") : `<p class="intro">보낼 작업이 없다 — 보내기 스크립트를 jobs.json 의 "work" 로 dry-run 하면 여기에 레퍼런스가 그림으로 뜬다.</p>`;

  // 기록 — 회차마다(최근 것 먼저)
  const logHtml = rounds.length ? [...rounds].reverse().map((r) => {
    const cutLines = Object.entries(r.cuts || {}).map(([k, v]) => `<li><b>${esc(k)}</b> — ${esc(v)}</li>`).join("");
    const takeLines = Object.entries(r.takes || {}).map(([k, v]) => `<li><span class="st st-${esc(v.status || "미정")}">${esc(v.status || "미정")}</span> ${esc(k)}${v.memo ? ` — ${esc(v.memo)}` : ""}</li>`).join("");
    return `<article class="round"><h4>${r.n}차 · ${esc(when(r.at))}</h4>${cutLines ? `<ul>${cutLines}</ul>` : ""}${takeLines ? `<ul class="takes-log">${takeLines}</ul>` : ""}</article>`;
  }).join("") : `<p class="intro">아직 검수 기록이 없다.</p>`;

  // 프롬프트 — 보낸 작업마다
  const promptHtml = prompts.size ? [...prompts.entries()].map(([name, p]) =>
    `<details class="pr"><summary><b>${esc(name)}</b> <span class="chip">${esc([p.model, p.mode].filter(Boolean).join(" · "))}</span> <span class="path">${esc(p.file)}</span></summary><pre>${esc(p.prompt)}</pre></details>`).join("")
    : `<p class="intro">05_프롬프트 에 보낸 jobs.json 이 없다.</p>`;

  const server = served ? null : readJson(SERVER_FILE);
  const data = JSON.stringify({ work: path.basename(work), title: pageTitle, round, filter: rounds.length ? "볼 것" : "전체", served: !!served,
    serverUrl: server?.port ? local(server.port) : "" });
  const nav = [["한눈에", "한눈에"], ["검수", "검수"], ["보낼것", "보낼 것"], ["기록", "기록"], ["프롬프트", "프롬프트"]]
    .map(([id, label]) => `<a href="#${id}">${label}</a>`).join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(pageTitle)}</title><style>${CSS}</style></head><body>
<header><div class="bar"><h1>${esc(pageTitle)}</h1><nav>${nav}</nav><span class="count" id="count"></span>
<span class="filters">${[...(rounds.length ? ["볼 것"] : []), "전체", ...(rounds.length ? ["새로"] : []), "미정", ...STATUSES].map((f) => `<button type="button" data-f="${f}">${f}</button>`).join("")}</span>
<button type="button" id="play">OK 이어서 보기</button><span id="saved"></span><button type="button" id="save">${served ? "저장" : "저장(파일)"} (Ctrl+S)</button></div></header>
<main>
<section id="한눈에"><h2>한눈에</h2><table class="ov"><thead><tr><th>폴더</th><th>OK</th><th>보류</th><th>미정</th><th>새로</th><th>탈락</th><th></th></tr></thead><tbody>${overview || `<tr><td colspan="7">받은 결과가 없다 — 보내기 스크립트 --save-to 로 이 작업 폴더의 종류별 폴더에 받는다.</td></tr>`}</tbody></table>
<p class="intro">${round}차 검수 — 테이크마다 <b>OK</b>(쓸 것) · <b>보류</b>(다시 볼 것) · <b>탈락</b>(안 쓸 것)을 고르고 메모를 적은 뒤 저장한다.
${served ? "저장하면 그 자리에서 파일이 폴더 안 OK/ · 보류/ · 탈락/ 으로 옮겨지고 기록에 남는다." : "이 페이지는 파일로 열려 있어 저장하면 다운로드 폴더에 JSON 이 생긴다 — 에이전트에게 '검수 페이지 열어 줘'라고 하면 바로 저장되는 주소로 열어 준다."}
${rounds.length ? ` 지난 ${rounds.length}회차의 메모는 컷 아래 <b>지난 피드백</b>으로 옮겨 두었고 입력칸은 이번 ${round}차 것만 적는다. 처음엔 <b>볼 것</b>(새로 · 미정 · 보류)만 보인다.` : ""}</p></section>
<section id="검수"><h2>검수</h2>${review || "<p class=\"intro\">받은 컷이 없다.</p>"}</section>
<section id="보낼것"><h2>보낼 것</h2>${planHtml}</section>
<section id="기록"><h2>기록</h2>${logHtml}</section>
<section id="프롬프트"><h2>프롬프트</h2>${promptHtml}</section>
</main>
<div id="lb"><button type="button" class="x">닫기</button><div class="stage"></div><div class="cap"></div></div>
<script type="application/json" id="rv-data">${data.replace(/</g, String.fromCharCode(92) + "u003c")}</script>
<script>${JS}</script></body></html>`;
}

// 파일 페이지 — <작업 폴더>/<작업 이름>.html 하나. 예전 판의 _검수/검수.html 은 지운다(같은 도구가 만든 것)
function writePage() {
  const html = render(false);
  const file = path.join(work, `${workTitle()}.html`);
  fs.writeFileSync(file, html);
  const old = path.join(REVIEW_DIR, "검수.html");
  if (fs.existsSync(old)) fs.rmSync(old, { force: true });
  return file;
}

const CSS = `
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f5f6f8;color:#16181d;font:15px/1.55 "Pretendard GOV","Pretendard","Malgun Gothic",system-ui,sans-serif;word-break:keep-all}
header{position:sticky;top:0;z-index:5;background:#fffffff2;border-bottom:1px solid #e3e6eb}
.bar{max-width:1500px;margin:0 auto;padding:10px 20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
h1{font-size:17px;margin:0}nav{display:flex;gap:10px}nav a{color:#2f4fb8;text-decoration:none;font-size:13px}.count{color:#5b616e;font-size:13px;flex:1}
.filters button,#play{border:1px solid #d5d9e0;background:#fff;border-radius:6px;padding:4px 10px;font:inherit;font-size:13px;cursor:pointer}
.filters button.on{background:#16181d;color:#fff;border-color:#16181d}
#save{background:#2f6fed;color:#fff;border:0;border-radius:6px;padding:8px 16px;font:inherit;font-weight:600;cursor:pointer}#saved{font-size:12px;color:#1f8a4c}
main{max-width:1500px;margin:0 auto;padding:16px 20px 60px}.intro{color:#5b616e;max-width:960px}
main>section{scroll-margin-top:64px;margin-bottom:28px}main>section>h2{font-size:18px;margin:18px 0 8px}
.ov{border-collapse:collapse;background:#fff;border:1px solid #e3e6eb;border-radius:6px;font-size:14px}.ov th,.ov td{padding:6px 12px;border-bottom:1px solid #eef0f3;text-align:right}
.ov th:first-child,.ov td:first-child{text-align:left}.ov a{color:#16181d;font-weight:600;text-decoration:none}.ok{color:#1f8a4c}.hold{color:#c98a00}.drop{color:#9aa0aa}.new{color:#2f6fed}
.path{color:#9aa0aa;font-size:12px;margin-left:8px;font-weight:400}
.folder h3{font-size:15px;margin:22px 0 8px;border-bottom:1px solid #e3e6eb;padding-bottom:4px;scroll-margin-top:64px}
.cut,.job,.round{background:#fff;border:1px solid #e3e6eb;border-radius:6px;padding:14px;margin:12px 0}
.cut-head{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.cut-head h4,.round h4{margin:0 0 8px;font-size:16px}
.chip{font-size:12px;color:#5b616e;background:#eef1f6;border-radius:999px;padding:1px 8px}.chip.new{background:#e6efff;color:#1f4fb8}
.newb{font-size:11px;font-weight:700;color:#fff;background:#2f6fed;border-radius:999px;padding:1px 7px;margin-left:6px}
.takes{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.take{border:2px solid #e3e6eb;border-radius:6px;overflow:hidden;background:#fafbfc}
.take[data-status="OK"]{border-color:#1f8a4c}.take[data-status="보류"]{border-color:#c98a00}.take[data-status="탈락"]{border-color:#c62828;opacity:.7}
.take img,.take video{display:block;width:100%;aspect-ratio:16/9;object-fit:contain;background:#111;cursor:zoom-in}
.tf{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;gap:8px}
.seg{display:inline-flex;border:1px solid #d5d9e0;border-radius:6px;overflow:hidden}
.seg button{border:0;background:#fff;padding:5px 12px;font:inherit;font-size:13px;cursor:pointer;border-right:1px solid #e3e6eb}.seg button:last-child{border-right:0}
.take[data-status="OK"] .seg [data-s="OK"]{background:#1f8a4c;color:#fff}.take[data-status="보류"] .seg [data-s="보류"]{background:#c98a00;color:#fff}
.take[data-status="탈락"] .seg [data-s="탈락"]{background:#c62828;color:#fff}
textarea{width:100%;border:1px solid #e3e6eb;border-radius:6px;padding:6px 10px;font:inherit;font-size:13px;resize:vertical;min-height:38px}
.take textarea{border-width:1px 0 0;border-radius:0}.cmemo{margin-top:10px}
details{margin-top:8px}summary{cursor:pointer;color:#5b616e;font-size:13px}pre{white-space:pre-wrap;background:#f3f5f8;border-radius:6px;padding:10px;font-size:12px}
.past{background:#f6f7f9;border-left:3px solid #9aa3b2;border-radius:6px;padding:6px 10px;margin:0 0 10px;font-size:13px;color:#3d434f}
.past b,.hist b{color:#16181d;font-weight:600}.past .done{color:#1f8a4c}.past .todo{color:#c98a00}
.hist{font-size:12px;color:#5b616e;padding:5px 10px;border-top:1px dashed #e3e6eb;background:#f6f7f9}
.refs{display:flex;gap:10px;flex-wrap:wrap}.ref{margin:0;width:180px}.ref img,.ref video{width:180px;height:120px;object-fit:contain;background:#111;border-radius:6px;display:block}
.ref figcaption{font-size:12px;color:#3d434f;margin-top:4px;word-break:break-all}.ref.el figcaption{color:#1f4fb8;font-weight:600}
.miss{width:180px;height:120px;border:1px dashed #c8ccd4;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#9aa0aa;font-size:12px}.none{color:#9aa0aa;font-size:13px}
.round ul{margin:4px 0 0;padding-left:18px;font-size:13px}.takes-log{color:#5b616e}.st{font-weight:600}.st-OK{color:#1f8a4c}.st-보류{color:#c98a00}.st-탈락{color:#c62828}
.pr{background:#fff;border:1px solid #e3e6eb;border-radius:6px;padding:8px 12px;margin:8px 0}
.hide{display:none}
#lb{position:fixed;inset:0;background:#0b0c0ef2;display:none;z-index:9;flex-direction:column}#lb.on{display:flex}
#lb .stage{flex:1;display:flex;align-items:center;justify-content:center;padding:12px;min-height:0}#lb .stage>*{max-width:100%;max-height:100%}
#lb .cap{color:#e8eaee;text-align:center;padding:8px 0 16px}#lb .x{position:absolute;top:10px;right:14px;background:#ffffff22;color:#fff;border:1px solid #ffffff44;border-radius:6px;padding:6px 12px;cursor:pointer}
@media (max-width:700px){.takes{grid-template-columns:1fr}.bar{gap:8px}}
`;

const JS = `
var D=JSON.parse(document.getElementById('rv-data').textContent);var KEY='rv:'+D.work+':'+D.round;
if(!D.served&&D.serverUrl){fetch(D.serverUrl+'api/ping',{mode:'no-cors'}).then(function(){location.replace(D.serverUrl)}).catch(function(){})}
var S;try{S=JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){S=null}
if(!S){S={takes:{},cuts:{}};document.querySelectorAll('.take').forEach(function(t){S.takes[t.dataset.key]={status:t.dataset.status||'',memo:''}})}
function keep(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
var filter=D.filter||'전체';
function want(t,d){if(filter==='전체')return true;if(filter==='볼 것')return t.dataset.new==='1'||!d.status||d.status==='보류';if(filter==='새로')return t.dataset.new==='1';if(filter==='미정')return !d.status;return d.status===filter}
function paint(){var n={OK:0,'보류':0,'탈락':0,'미정':0},fresh=0;
 document.querySelectorAll('.take').forEach(function(t){var d=S.takes[t.dataset.key]||{status:''};t.dataset.status=d.status||'';n[d.status||'미정']++;if(t.dataset.new==='1')fresh++;
  t.classList.toggle('hide',!want(t,d))});
 document.querySelectorAll('.cut').forEach(function(c){c.classList.toggle('hide',!c.querySelector('.take:not(.hide)'))});
 document.querySelectorAll('.folder').forEach(function(f){f.classList.toggle('hide',!f.querySelector('.cut:not(.hide)'))});
 document.getElementById('count').textContent=D.round+'차 · '+(D.round>1?'새로 '+fresh+' · ':'')+'OK '+n.OK+' · 보류 '+n['보류']+' · 탈락 '+n['탈락']+' · 미정 '+n['미정'];
 document.querySelectorAll('.filters button').forEach(function(b){b.classList.toggle('on',b.dataset.f===filter)})}
document.querySelectorAll('.take').forEach(function(t){var k=t.dataset.key;S.takes[k]=S.takes[k]||{status:t.dataset.status||'',memo:''};
 var m=t.querySelector('.memo');if(S.takes[k].memo)m.value=S.takes[k].memo;m.addEventListener('input',function(){S.takes[k].memo=m.value;keep()});
 t.querySelectorAll('.seg button').forEach(function(b){b.addEventListener('click',function(){S.takes[k].status=S.takes[k].status===b.dataset.s?'':b.dataset.s;keep();paint()})});
 var media=t.querySelector('img,video');media.addEventListener('click',function(){open(k)})});
document.querySelectorAll('.cut').forEach(function(c){var m=c.querySelector('.cmemo');if(S.cuts[c.dataset.cut])m.value=S.cuts[c.dataset.cut];m.addEventListener('input',function(){S.cuts[c.dataset.cut]=m.value;keep()})});
document.querySelectorAll('.filters button').forEach(function(b){b.addEventListener('click',function(){filter=b.dataset.f;paint()})});
var stamp=function(d){var z=function(x){return String(x).padStart(2,'0')};return d.getFullYear()+z(d.getMonth()+1)+z(d.getDate())+'-'+z(d.getHours())+z(d.getMinutes())+z(d.getSeconds())};
function save(){var d=new Date();var out={page:'검수',work:D.work,round:D.round,saved_at:d.toISOString(),takes:S.takes,cuts:S.cuts};var note=document.getElementById('saved');
 if(D.served){
  document.querySelectorAll('video').forEach(function(v){v.pause();v.removeAttribute('src');v.load()});
  note.textContent='저장하는 중…';
  fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json','X-Review':'1'},body:JSON.stringify(out)}).then(function(r){return r.json()}).then(function(j){
   if(!j.ok)throw new Error(j.error||'저장 실패');try{localStorage.removeItem(KEY)}catch(e){}
   note.textContent=j.round+'차 저장됨 — 옮긴 파일 '+j.moved+'개'+(j.stuck?' · 못 옮김 '+j.stuck+'개(열려 있음)':'');setTimeout(function(){location.reload()},900)
  }).catch(function(e){note.textContent='저장 실패 — '+e.message;note.style.color='#c62828'});return}
 var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,1)],{type:'application/json'}));
 a.download=D.work+'_검수_'+stamp(d)+'.json';document.body.appendChild(a);a.click();a.remove();
 note.textContent='다운로드에 저장함 — 에이전트에게 저장했다고 알려 주세요'}
document.getElementById('save').addEventListener('click',save);
document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save()}});
if(D.served)setInterval(function(){fetch('/api/ping').catch(function(){})},60000);
var lb=document.getElementById('lb'),stage=lb.querySelector('.stage'),cap=lb.querySelector('.cap'),list=[],cur=0,chain=false;
function visible(){return Array.prototype.slice.call(document.querySelectorAll('.take:not(.hide)')).map(function(t){return t.dataset.key})}
function show(i){cur=(i+list.length)%list.length;var t=document.querySelector('.take[data-key="'+CSS.escape(list[cur])+'"]');var src=t.querySelector('img,video').getAttribute('src');
 stage.innerHTML='';var el;if(t.querySelector('video')){el=document.createElement('video');el.controls=true;el.autoplay=true;el.src=src;el.onended=function(){if(chain&&cur<list.length-1)show(cur+1)}}else{el=document.createElement('img');el.src=src}
 stage.appendChild(el);cap.textContent=list[cur]+' · '+((S.takes[list[cur]]||{}).status||'미정');lb.classList.add('on')}
function open(k){chain=false;list=visible();show(Math.max(0,list.indexOf(k)))}
document.getElementById('play').addEventListener('click',function(){list=Object.keys(S.takes).filter(function(k){return S.takes[k].status==='OK'&&document.querySelector('.take[data-key="'+CSS.escape(k)+'"] video')});if(!list.length)return;chain=true;show(0)});
lb.querySelector('.x').addEventListener('click',function(){lb.classList.remove('on');stage.innerHTML=''});
document.addEventListener('keydown',function(e){if(!lb.classList.contains('on'))return;if(e.key==='Escape'){lb.classList.remove('on');stage.innerHTML=''}else if(e.key==='ArrowRight')show(cur+1);else if(e.key==='ArrowLeft')show(cur-1)});
paint();
`;

// ---------- 서버 ----------
const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm" };
const streams = new Set();

function sendFile(req, res, abs) {
  if (!abs || !MEDIA.test(abs) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) { res.writeHead(404); return res.end(); }
  const size = fs.statSync(abs).size;
  const type = TYPES[path.extname(abs).toLowerCase()] || "application/octet-stream";
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  let start = 0, end = size - 1, code = 200;
  if (m) {
    start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2] || 0));
    end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start > end || start >= size) { res.writeHead(416, { "Content-Range": `bytes */${size}` }); return res.end(); }
    code = 206;
  }
  res.writeHead(code, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": end - start + 1, "Cache-Control": "no-store",
    ...(code === 206 ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}) });
  const s = fs.createReadStream(abs, { start, end });
  streams.add(s);
  s.on("close", () => streams.delete(s));
  s.pipe(res);
}

function runServer(port) {
  let lastHit = Date.now();
  const srv = http.createServer((req, res) => {
    lastHit = Date.now();
    const host = String(req.headers.host || "");
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) { res.writeHead(403); return res.end(); }
    const u = new URL(req.url, "http://127.0.0.1:1");
    const json = (o, code = 200) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(o)); };
    try {
      if (req.method === "GET" && u.pathname === "/") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        return res.end(render(true));
      }
      if (req.method === "GET" && u.pathname === "/api/ping") return json({ ok: true, work: path.basename(work), title: workTitle(), pid: process.pid });
      if (req.method === "GET" && u.pathname.startsWith("/f/")) {
        const p = path.resolve(work, ...u.pathname.slice(3).split("/").map(decodeURIComponent));
        if (path.relative(work, p).startsWith("..") || path.isAbsolute(path.relative(work, p))) { res.writeHead(403); return res.end(); }
        return sendFile(req, res, p);
      }
      if (req.method === "GET" && u.pathname.startsWith("/r/")) {
        // 보낼 것의 바깥 레퍼런스 — 보낼것.json 에 적힌 파일만
        const p = Buffer.from(u.pathname.slice(3), "base64url").toString();
        const listed = (readJson(PLAN).jobs || []).some((j) => (j.refs || []).some((r) => path.resolve(typeof r === "string" ? r : r.path || "") === path.resolve(p)));
        if (!listed) { res.writeHead(403); return res.end(); }
        return sendFile(req, res, p);
      }
      if (req.method === "POST" && u.pathname === "/api/save") {
        // 다른 사이트가 몰래 보내지 못하게 — 이 페이지만 붙이는 머리글(브라우저는 다른 출처의 이 머리글을 막는다)
        if (req.headers["x-review"] !== "1") return json({ ok: false, error: "forbidden" }, 403);
        let body = "";
        req.on("data", (c) => { body += c; if (body.length > 5e6) req.destroy(); });
        req.on("end", () => {
          try {
            const saved = JSON.parse(body || "{}");
            for (const s of streams) s.destroy();   // 재생 중인 영상을 놓아야 옮길 수 있다
            const name = `저장_${String(saved.saved_at || new Date().toISOString()).replace(/[:.]/g, "-")}.json`;
            fs.mkdirSync(REVIEW_DIR, { recursive: true });
            fs.writeFileSync(path.join(REVIEW_DIR, name), JSON.stringify(saved, null, 1));
            const r = apply(saved, name);
            writePage();
            const stars = starHints(r.okCards);
            console.log(`${r.round}차 저장 — 옮긴 파일 ${r.moved.length}개${r.stuck.length ? ` · 못 옮김 ${r.stuck.length}개` : ""}`);
            json({ ok: true, round: r.round, moved: r.moved.length, stuck: r.stuck.length, stars });
          } catch (e) { json({ ok: false, error: e.message }, 500); }
        });
        return;
      }
      res.writeHead(404); res.end();
    } catch (e) { json({ ok: false, error: e.message }, 500); }
  });
  srv.listen(port, "127.0.0.1", () => {
    fs.mkdirSync(REVIEW_DIR, { recursive: true });
    fs.writeFileSync(SERVER_FILE, JSON.stringify({ port, pid: process.pid, started: new Date().toISOString() }, null, 2));
    writePage();
    console.log(`검수 서버 — ${local(port)}`);
  });
  srv.on("error", (e) => { console.error(`서버를 못 띄움 — ${e.message}`); process.exit(1); });
  const stop = () => {
    try { if (readJson(SERVER_FILE).pid === process.pid) fs.rmSync(SERVER_FILE, { force: true }); } catch {}
    process.exit(0);
  };
  setInterval(() => { if (Date.now() - lastHit > IDLE_MS) stop(); }, 60 * 1000).unref();
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

async function ping(port, ms = 1200) {
  try {
    const r = await fetch(local(port, "api/ping"), { signal: AbortSignal.timeout(ms) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
const portFree = (port) => new Promise((resolve) => {
  const s = http.createServer().once("error", () => resolve(false)).once("listening", () => s.close(() => resolve(true)));
  s.listen(port, "127.0.0.1");
});

// 작업마다 서버 하나 — 떠 있으면 그 주소. 아니면 작업 경로로 정해지는 포트(18600~18899)에서 빈 곳을 골라 띄울 명령을 돌려준다.
// 이 스크립트는 다른 프로그램을 실행하지 않는다(커넥터 통신 검사) — 띄우는 명령은 에이전트가 돌린다.
// Windows 는 explorer 를 거쳐 숨은 창으로 띄운다 — 에이전트 도구가 바로 띄운 프로세스는 그 대화가 끝날 때 같이 꺼진다(사내 메모 '두뇌 서버는 탐색기로').
async function serverPlan() {
  const was = readJson(SERVER_FILE);
  if (was.port && (await ping(was.port))?.work === path.basename(work)) return { port: was.port, live: true };
  const start = parseInt(crypto.createHash("sha1").update(work.toLowerCase()).digest("hex").slice(0, 6), 16) % 300;
  let port = 0;
  for (let i = 0; i < 300 && !port; i++) { const p = 18600 + ((start + i) % 300); if (await portFree(p)) port = p; }
  if (!port) throw new Error("빈 포트가 없다(18600~18899)");
  const args = [process.execPath, fileURLToPath(import.meta.url), work, "--server-child", "--port", String(port)];
  const direct = args.map((s) => `"${s}"`).join(" ");
  if (process.platform !== "win32") return { port, launch: `nohup ${direct} >/dev/null 2>&1 &`, direct };
  // 숨은 창으로 — VBScript 의 Run(…, 0). 한글 경로라 UTF-16(BOM) 으로 쓴다
  const vbs = path.join(os.tmpdir(), `freewill-review-${crypto.createHash("sha1").update(work).digest("hex").slice(0, 10)}.vbs`);
  const line = args.map((s) => `""${s}""`).join(" ");
  fs.writeFileSync(vbs, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(`CreateObject("WScript.Shell").Run "${line}", 0, False\r\n`, "utf16le")]));
  return { port, launch: `explorer.exe "${vbs}"`, direct };
}

// ---------- 실행 ----------
async function main() {
  if (reviewArg) {
    // "검수 빼" · "검수 다시 켜" — 한 번 들은 건 파일에 남겨 다음 대화·다른 에이전트도 따른다
    if (!["on", "off", "status"].includes(reviewArg)) { console.error(USAGE); process.exit(2); }
    if (reviewArg !== "status") {
      const file = setReview(work, reviewArg === "on");
      console.log(`검수 ${reviewArg === "on" ? "켬" : "끔"} — ${work ? "이 작업만" : "이 PC 사용자의 모든 작업"} (${file})`);
    }
    const s = reviewSetting(work);
    console.log(`지금: 검수 ${s.on ? "켜짐" : "꺼짐"} · ${s.from}${s.on ? "" : " — 결과는 폴더에 받기만 하고 검수 페이지·검수 회차는 만들지 않는다"}`);
    return;
  }
  if (child) return runServer(childPort);
  if (applyFile) {
    let saved;
    try { saved = JSON.parse(readText(applyFile)); } catch (e) { console.error(`저장본을 못 읽음 — ${e.message}`); process.exit(1); }
    if (saved.work && saved.work !== path.basename(work)) console.log(`참고: 저장본의 작업(${saved.work})과 폴더 이름(${path.basename(work)})이 다르다 — 파일 이름이 같은 것만 옮긴다`);
    const r = apply(saved, path.basename(applyFile));
    fs.mkdirSync(REVIEW_DIR, { recursive: true });
    const keepCopy = path.join(REVIEW_DIR, path.basename(applyFile));
    if (path.resolve(keepCopy) !== path.resolve(applyFile)) fs.copyFileSync(applyFile, keepCopy);
    const page = writePage();
    const n = (s) => r.takes.filter((t) => (t.status || "") === s).length;
    console.log(`${r.round}차 분류 적용${r.dup ? "(이미 적용한 저장본 — 회차는 그대로)" : ""} — OK ${n("OK")} · 보류 ${n("보류")} · 탈락 ${n("탈락")} · 미정 ${n("")} · 옮긴 파일 ${r.moved.length}개${r.stuck.length ? ` · 못 옮김 ${r.stuck.length}개(열려 있음)` : ""}`);
    for (const m of r.moved) console.log(`  ${m}`);
    console.log(`_컷목록.tsv · 작업 페이지를 새로 썼다(이번 메모는 다음 회차에 '지난 피드백'으로 보인다): ${page}`);
    const stars = starHints(r.okCards);
    if (stars.length) { console.log(`OK 카드 ${stars.length}개 — 앱에서 채택(★)을 켠다(과금 없음):`); for (const s of stars) console.log(`  ${s}`); }
    return;
  }
  const s = reviewSetting(work);
  if (!s.on && !force) {
    console.log(`검수가 꺼져 있다(${s.from}) — 페이지를 만들지 않는다. 결과는 폴더에 받은 그대로 둔다. 이번만 만들려면 --force, 다시 켜려면 --review on`);
    return;
  }
  const page = writePage();
  const takes = scan();
  const rounds = readRounds().length;
  const fresh = rounds ? takes.filter((t) => !new Set(readRounds()[rounds - 1].keys || []).has(t.key)).length : 0;
  const summary = `${rounds + 1}차 작업 페이지 — 컷 ${new Set(takes.map((t) => `${t.folder}/${t.cut}`)).size}개 · 테이크 ${takes.length}개` +
    `${rounds ? ` (새로 ${fresh}개 · 지난 피드백 ${rounds}회차는 읽기 전용으로)` : ""}`;
  if (!serve) {
    const was = readJson(SERVER_FILE);
    const live = was.port && (await ping(was.port))?.work === path.basename(work);
    console.log(`${summary} → ${page}${live ? `\n  검수 서버가 떠 있다 — 저장되는 주소: ${local(was.port)}` : ""}`);
    return;
  }
  const sv = await serverPlan();
  const url = local(sv.port);
  const opener = process.platform === "win32" ? `explorer.exe "${url}"` : `${process.platform === "darwin" ? "open" : "xdg-open"} "${url}"`;
  if (sv.live) {
    console.log(`${summary}\n  저장되는 주소(작업마다 하나 — 떠 있음): ${url}\n  열기: ${opener}\n  파일: ${page}`);
    return;
  }
  console.log(`${summary}\n  검수 서버가 꺼져 있다 — 아래 '띄우기'를 돌린 뒤 --serve 를 한 번 더 돌려 떠 있는지 확인하고 주소를 연다(사용자 PC 의 창은 뜨지 않는다)\n` +
    `  띄우기: ${sv.launch}\n  (그래도 안 뜨면 이 명령을 백그라운드로 — 이 대화가 끝나면 같이 꺼진다: ${sv.direct})\n` +
    `  주소(뜨면): ${url}\n  파일: ${page}`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
