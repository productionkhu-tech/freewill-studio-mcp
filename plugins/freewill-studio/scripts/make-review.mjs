#!/usr/bin/env node
// 검수 · 분류 — 작업 폴더에 받은 컷(보내기 스크립트 --save-to 가 남긴 _목록.tsv)을 컷마다 테이크 나란히 놓고
// OK · 보류 · 탈락 과 메모를 고르는 HTML 을 만든다. 페이지에서 저장하면 다운로드 폴더에 JSON 이 생긴다.
// 그 저장본을 --apply 로 주면 파일을 <폴더>/OK/ · <폴더>/보류/ · <폴더>/탈락/ 으로 옮기고 작업 폴더의 _컷목록.tsv 를 새로 쓴다.
// 지우는 일은 없다 — 탈락도 탈락/ 으로 옮기기만 한다(예전 저장본의 "NG" 는 탈락으로 읽는다). (지침 6단계 "작업 정리 — 검수와 분류")
//
//   node make-review.mjs <작업 폴더> [--title "작업 이름"] [--force] → <작업 폴더>/_검수/검수.html (같은 자리에서 갱신)
//   node make-review.mjs <작업 폴더> --apply <저장본.json>       → 분류대로 옮김 · _컷목록.tsv · 회차 기록 · 검수.html 다시 · OK 카드 목록
//   node make-review.mjs [<작업 폴더>] --review on|off|status   → 검수를 켜고 끔(폴더를 주면 그 작업만, 안 주면 이 PC 사용자의 모든 작업)
//
// 회차: --apply 할 때마다 _검수/회차.json 에 한 회차씩 쌓는다. 페이지를 다시 만들면 지난 회차의 메모는 '지난 피드백'(회차·시각·그 뒤 새 테이크)으로
// 옮겨 보여 주고 입력칸은 비워 둔다 — 반영한 피드백이 입력칸에 계속 남아 있지 않게(사용자 10/14). 지난 회차 뒤에 받은 테이크에는 '새로' 표시.
// 검수 끔: 사용자가 "검수 빼" 라고 하면 --review off 로 기억한다 — 그 뒤로는 페이지를 만들지 않는다(이번만 만들려면 --force).
// 프롬프트는 <작업 폴더>/05_프롬프트/*.json(보낸 jobs.json) 에서 작업 이름(name)으로 찾아 같이 보여 준다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const USAGE = "쓰는 법: node make-review.mjs <작업 폴더> [--title \"작업 이름\"] [--force] | node make-review.mjs <작업 폴더> --apply <저장본.json>" +
  " | node make-review.mjs [<작업 폴더>] --review on|off|status (폴더를 주면 그 작업만, 안 주면 이 PC 사용자의 모든 작업)";
const argv = process.argv.slice(2);
let work = "", title = "", applyFile = "", reviewArg = "", force = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--title") title = argv[++i] || "";
  else if (argv[i] === "--apply") applyFile = argv[++i] || "";
  else if (argv[i] === "--review") reviewArg = argv[++i] || "status";
  else if (argv[i] === "--force") force = true;
  else if (argv[i] === "-h" || argv[i] === "--help") { console.log(USAGE); process.exit(0); }
  else if (!work) work = argv[i];
}
if (!(reviewArg && !work) && (!work || !fs.existsSync(work) || !fs.statSync(work).isDirectory())) { console.error(USAGE); process.exit(2); }
if (work) work = path.resolve(work);
title = title || path.basename(work || "");
const REVIEW_DIR = path.join(work, "_검수");
const PAGE = path.join(REVIEW_DIR, "검수.html");
const MASTER = path.join(work, "_컷목록.tsv");
const ROUNDS = path.join(REVIEW_DIR, "회차.json");
const ME_SETTINGS = path.join(os.homedir(), ".freewill-studio", "settings.json");
const STATUSES = ["OK", "보류", "탈락"];
const VIDEO = /\.(mp4|mov|m4v|webm)$/i;

// ---------- 읽기 ----------
const readText = (p) => fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "");
function readTsv(p) {
  const lines = readText(p).split(/\r?\n/).filter((l) => l.trim());
  const head = (lines.shift() || "").split("\t");
  return lines.map((l) => Object.fromEntries(l.split("\t").map((v, i) => [head[i] || `c${i}`, v])));
}

// 지금 그 파일이 어디 있는지 — 받은 자리(미정) · OK/ · 보류/ · 탈락/ (예전 판의 _후보/<폴더>/ 도 탈락으로 본다)
function locate(folder, file) {
  const base = path.join(work, folder);
  const spots = [[path.join(base, file), ""], [path.join(base, "OK", file), "OK"], [path.join(base, "보류", file), "보류"],
    [path.join(base, "탈락", file), "탈락"], [path.join(work, "_후보", folder, file), "탈락"]];
  const hit = spots.find(([p]) => fs.existsSync(p));
  return hit ? { abs: hit[0], status: hit[1] } : null;
}

function scan() {
  const takes = [];
  for (const folder of fs.readdirSync(work, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith("_")).map((d) => d.name).sort()) {
    const list = path.join(work, folder, "_목록.tsv");
    if (!fs.existsSync(list)) continue;
    const seen = new Set();
    for (const r of readTsv(list)) {
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

// 보낸 jobs.json 들 — 작업 이름 → 프롬프트·설정
function readPrompts() {
  const map = new Map();
  const dir = path.join(work, "05_프롬프트");
  if (!fs.existsSync(dir)) return map;
  for (const f of fs.readdirSync(dir).filter((n) => /\.json$/i.test(n))) {
    try {
      const spec = JSON.parse(readText(path.join(dir, f)));
      for (const j of spec.jobs || []) {
        if (j?.name && j.prompt) map.set(j.name, { prompt: String(j.prompt), model: j.model ?? spec.defaults?.model ?? "", mode: j.mode ?? spec.defaults?.mode ?? "" });
      }
    } catch {}
  }
  return map;
}

const readJson = (p) => { try { return JSON.parse(readText(p)); } catch { return {}; } };

// 지난 검수 회차 — --apply 할 때마다 하나씩 쌓인다. 회차 기록이 없던 예전 판은 _컷목록.tsv 를 1차로 읽는다.
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
function apply(saved, savedName) {
  const takes = scan();
  const byKey = new Map(takes.map((t) => [t.key, t]));
  const moved = [], okCards = [], roundTakes = {};
  for (const [key, d] of Object.entries(saved.takes || {})) {
    const t = byKey.get(key);
    if (!t) continue;
    const raw = d?.status === "NG" ? "탈락" : d?.status;   // 예전 저장본
    const status = STATUSES.includes(raw) ? raw : "";
    const target = status === "OK" ? path.join(work, t.folder, "OK", t.file)
      : status === "보류" ? path.join(work, t.folder, "보류", t.file)
      : status === "탈락" ? path.join(work, t.folder, "탈락", t.file)
      : path.join(work, t.folder, t.file);
    if (path.resolve(target) !== path.resolve(t.abs)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      try { fs.renameSync(t.abs, target); } catch { fs.copyFileSync(t.abs, target); fs.rmSync(t.abs, { force: true }); }
      moved.push(`${status || "미정"} ← ${key}`);
      t.abs = target;
    }
    t.status = status;
    const memo = String(d?.memo || "").trim();
    if (status || memo) roundTakes[key] = { status, memo };
    if (status === "OK" && t.card) okCards.push(t.card);
  }
  // 이번 회차를 쌓는다 — 같은 저장본을 또 적용하면 회차는 늘리지 않는다(옮기기만 다시). 같은 저장본인지는 저장 시각으로
  // (같은 분에 두 번 저장하면 파일 이름이 겹칠 수 있다 — 10/14 시험에서 겹쳤다)
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
  const rel = (p) => path.relative(work, p).split(path.sep).join("/");
  const rows = takes.map((t) => [t.folder, t.cut, t.take, t.status || "미정", rel(t.abs), t.card, t.task,
    latest((r) => r.takes?.[t.key]?.memo).replace(/\s+/g, " "), latest((r) => r.cuts?.[`${t.folder}/${t.cut}`]).replace(/\s+/g, " ")].join("\t"));
  fs.writeFileSync(MASTER, `폴더\t컷\t테이크\t상태\t파일\t카드\ttask\t메모\t컷 메모\n${rows.join("\n")}\n`);
  return { moved, okCards, takes, round: dup ? dup.n : rounds.length, dup: !!dup };
}

// ---------- 그리기 ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const relFromPage = (abs) => path.relative(REVIEW_DIR, abs).split(path.sep).map(encodeURIComponent).join("/");

function render() {
  const takes = scan();
  const prompts = readPrompts();
  const rounds = readRounds();
  const round = rounds.length + 1;                       // 지금 하는 회차
  const before = new Set(rounds.length ? rounds[rounds.length - 1].keys || [] : []);
  const isNew = (t) => rounds.length > 0 && !before.has(t.key);
  const when = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? "" : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  // 지난 피드백 — 입력칸이 아니라 읽기 전용으로. 컷 메모는 그 뒤에 새 테이크가 왔는지까지
  const takeHist = (key) => rounds.filter((r) => r.takes?.[key]?.memo).map((r) =>
    `<div class="hist"><b>${r.n}차 · ${esc(when(r.at))}</b> ${esc(r.takes[key].status || "미정")} — ${esc(r.takes[key].memo)}</div>`).join("");
  const cutHist = (ckey, mine) => rounds.filter((r) => r.cuts?.[ckey]).map((r) => {
    const after = mine.filter((t) => !(r.keys || []).includes(t.key)).map((t) => t.take || t.file);
    return `<div class="past"><b>${r.n}차 피드백 · ${esc(when(r.at))}</b> ${esc(r.cuts[ckey])} <span class="${after.length ? "done" : "todo"}">${
      after.length ? `→ 그 뒤 새 테이크 ${esc(after.join(" · "))}` : "→ 아직 새 테이크 없음"}</span></div>`;
  }).join("");
  const folders = [...new Set(takes.map((t) => t.folder))];
  const sections = folders.map((folder) => {
    const cuts = [...new Set(takes.filter((t) => t.folder === folder).map((t) => t.cut))];
    return `<section class="folder"><h2>${esc(folder)}</h2>${cuts.map((cut) => {
      const mine = takes.filter((t) => t.folder === folder && t.cut === cut).sort((a, b) => a.take.localeCompare(b.take));
      const p = prompts.get(cut);
      const ckey = `${folder}/${cut}`;
      const fresh = mine.filter(isNew).length;
      return `<article class="cut" data-cut="${esc(ckey)}">
<div class="cut-head"><h3>${esc(cut)}</h3>${p ? `<span class="chip">${esc([p.model, p.mode].filter(Boolean).join(" · "))}</span>` : ""}<span class="chip">${mine.length}개</span>${fresh ? `<span class="chip new">새 테이크 ${fresh}</span>` : ""}</div>
${cutHist(ckey, mine)}
<div class="takes">${mine.map((t) => `<div class="take" data-key="${esc(t.key)}" data-status="${esc(t.status)}" data-new="${isNew(t) ? 1 : ""}">
${t.video ? `<video src="${relFromPage(t.abs)}" preload="metadata" muted playsinline></video>` : `<img src="${relFromPage(t.abs)}" alt="${esc(t.key)}" loading="lazy">`}
<div class="tf"><b>${esc(t.take || t.file)}${isNew(t) ? `<span class="newb">새로</span>` : ""}</b><span class="seg">${STATUSES.map((s) => `<button type="button" data-s="${s}">${s}</button>`).join("")}</span></div>
${takeHist(t.key)}<textarea class="memo" placeholder="${round > 1 ? `${round}차 메모` : "이 테이크 메모"}"></textarea></div>`).join("")}</div>
<textarea class="cmemo" placeholder="${round > 1 ? `${round}차 컷 메모 — 이번에 고칠 것` : "이 컷 메모 — 무엇을 고칠지"}"></textarea>
${p ? `<details><summary>보낸 프롬프트</summary><pre>${esc(p.prompt)}</pre></details>` : ""}
</article>`;
    }).join("")}</section>`;
  }).join("");
  // 2차부터는 '볼 것'(새로 · 미정 · 보류)만 먼저 — 이미 OK·탈락으로 끝난 건 거르기로 본다
  const data = JSON.stringify({ work: path.basename(work), title, round, filter: rounds.length ? "볼 것" : "전체" });
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} 검수</title><style>${CSS}</style></head><body>
<header><div class="bar"><h1>${esc(title)} ${round}차 검수</h1><span class="count" id="count"></span>
<span class="filters">${[...(rounds.length ? ["볼 것"] : []), "전체", ...(rounds.length ? ["새로"] : []), "미정", ...STATUSES].map((f) => `<button type="button" data-f="${f}">${f}</button>`).join("")}</span>
<button type="button" id="play">OK 이어서 보기</button><span id="saved"></span><button type="button" id="save">저장 (Ctrl+S)</button></div></header>
<main><p class="intro">테이크마다 <b>OK</b>(쓸 것) · <b>보류</b>(다시 볼 것) · <b>탈락</b>(안 쓸 것)을 고르고 메모를 적은 뒤 저장하면 다운로드 폴더에 JSON 이 생긴다.
에이전트가 그 저장본대로 파일을 OK/ · 보류/ · 탈락/ 으로 옮기고 앱 카드에 채택(★)을 켠다. 그림·영상을 누르면 크게 보인다(←/→, Esc).${rounds.length ? `<br>
지난 ${rounds.length}회차의 메모는 컷·테이크 아래 <b>지난 피드백</b>으로 옮겨 두었다(그 뒤 새 테이크가 왔는지도). 입력칸은 이번 ${round}차에 고칠 것만 적는다.
처음엔 <b>볼 것</b>(새로 · 미정 · 보류)만 보인다 — 전체는 '전체'.` : ""}</p>
${sections || "<p>받은 컷이 없다 — 보내기 스크립트 --save-to 로 이 폴더에 받은 뒤 다시 만든다.</p>"}</main>
<div id="lb"><button type="button" class="x">닫기</button><div class="stage"></div><div class="cap"></div></div>
<script type="application/json" id="rv-data">${data.replace(/</g, "\\u003c")}</script>
<script>${JS}</script></body></html>`;
  fs.mkdirSync(REVIEW_DIR, { recursive: true });
  fs.writeFileSync(PAGE, html);
  return { takes, page: PAGE };
}

const CSS = `
*{box-sizing:border-box}body{margin:0;background:#f5f6f8;color:#16181d;font:15px/1.55 "Pretendard GOV","Pretendard","Malgun Gothic",system-ui,sans-serif;word-break:keep-all}
header{position:sticky;top:0;z-index:5;background:#fffffff2;border-bottom:1px solid #e3e6eb}
.bar{max-width:1500px;margin:0 auto;padding:10px 20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
h1{font-size:17px;margin:0}.count{color:#5b616e;font-size:13px;flex:1}
.filters button,#play{border:1px solid #d5d9e0;background:#fff;border-radius:6px;padding:4px 10px;font:inherit;font-size:13px;cursor:pointer}
.filters button.on{background:#16181d;color:#fff;border-color:#16181d}
#save{background:#2f6fed;color:#fff;border:0;border-radius:8px;padding:8px 16px;font:inherit;font-weight:600;cursor:pointer}#saved{font-size:12px;color:#1f8a4c}
main{max-width:1500px;margin:0 auto;padding:16px 20px 60px}.intro{color:#5b616e;max-width:900px}
.folder h2{font-size:15px;color:#5b616e;margin:28px 0 8px;border-bottom:1px solid #e3e6eb;padding-bottom:4px}
.cut{background:#fff;border:1px solid #e3e6eb;border-radius:12px;padding:14px;margin:12px 0}
.cut-head{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.cut-head h3{margin:0 0 8px;font-size:16px}
.chip{font-size:12px;color:#5b616e;background:#eef1f6;border-radius:999px;padding:1px 8px}
.takes{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.take{border:2px solid #e3e6eb;border-radius:10px;overflow:hidden;background:#fafbfc}
.take[data-status="OK"]{border-color:#1f8a4c}.take[data-status="보류"]{border-color:#c98a00}.take[data-status="탈락"]{border-color:#c62828;opacity:.7}
.take img,.take video{display:block;width:100%;aspect-ratio:16/9;object-fit:contain;background:#111;cursor:zoom-in}
.tf{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;gap:8px}
.seg{display:inline-flex;border:1px solid #d5d9e0;border-radius:8px;overflow:hidden}
.seg button{border:0;background:#fff;padding:5px 12px;font:inherit;font-size:13px;cursor:pointer;border-right:1px solid #e3e6eb}.seg button:last-child{border-right:0}
.take[data-status="OK"] .seg [data-s="OK"]{background:#1f8a4c;color:#fff}.take[data-status="보류"] .seg [data-s="보류"]{background:#c98a00;color:#fff}
.take[data-status="탈락"] .seg [data-s="탈락"]{background:#c62828;color:#fff}
textarea{width:100%;border:1px solid #e3e6eb;border-radius:8px;padding:6px 10px;font:inherit;font-size:13px;resize:vertical;min-height:38px}
.take textarea{border-width:1px 0 0;border-radius:0}.cmemo{margin-top:10px}
details{margin-top:8px}summary{cursor:pointer;color:#5b616e;font-size:13px}pre{white-space:pre-wrap;background:#f3f5f8;border-radius:8px;padding:10px;font-size:12px}
.hide{display:none}
.chip.new{background:#e6efff;color:#1f4fb8}.newb{font-size:11px;font-weight:700;color:#fff;background:#2f6fed;border-radius:999px;padding:1px 7px;margin-left:6px}
.past{background:#f6f7f9;border-left:3px solid #9aa3b2;border-radius:6px;padding:6px 10px;margin:0 0 10px;font-size:13px;color:#3d434f}
.past b,.hist b{color:#16181d;font-weight:600}.past .done{color:#1f8a4c}.past .todo{color:#c98a00}
.hist{font-size:12px;color:#5b616e;padding:5px 10px;border-top:1px dashed #e3e6eb;background:#f6f7f9}
#lb{position:fixed;inset:0;background:#0b0c0ef2;display:none;z-index:9;flex-direction:column}#lb.on{display:flex}
#lb .stage{flex:1;display:flex;align-items:center;justify-content:center;padding:12px;min-height:0}#lb .stage>*{max-width:100%;max-height:100%}
#lb .cap{color:#e8eaee;text-align:center;padding:8px 0 16px}#lb .x{position:absolute;top:10px;right:14px;background:#ffffff22;color:#fff;border:1px solid #ffffff44;border-radius:8px;padding:6px 12px;cursor:pointer}
`;

const JS = `
var D=JSON.parse(document.getElementById('rv-data').textContent);var KEY='rv:'+D.work+':'+D.round;
var S;try{S=JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){S=null}
if(!S){S={takes:{},cuts:{}};document.querySelectorAll('.take').forEach(function(t){S.takes[t.dataset.key]={status:t.dataset.status||'',memo:t.querySelector('.memo').value}});document.querySelectorAll('.cut').forEach(function(c){S.cuts[c.dataset.cut]=c.querySelector('.cmemo').value})}
function keep(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
var filter=D.filter||'전체';
function want(t,d){if(filter==='전체')return true;if(filter==='볼 것')return t.dataset.new==='1'||!d.status||d.status==='보류';if(filter==='새로')return t.dataset.new==='1';if(filter==='미정')return !d.status;return d.status===filter}
function paint(){var n={OK:0,'보류':0,'탈락':0,'미정':0},fresh=0;
 document.querySelectorAll('.take').forEach(function(t){var d=S.takes[t.dataset.key]||{status:''};t.dataset.status=d.status||'';n[d.status||'미정']++;if(t.dataset.new==='1')fresh++;
  t.classList.toggle('hide',!want(t,d))});
 document.querySelectorAll('.cut').forEach(function(c){c.classList.toggle('hide',!c.querySelector('.take:not(.hide)'))});
 document.querySelectorAll('.folder').forEach(function(f){f.classList.toggle('hide',!f.querySelector('.cut:not(.hide)'))});
 document.getElementById('count').textContent=(D.round>1?'새로 '+fresh+' · ':'')+'OK '+n.OK+' · 보류 '+n['보류']+' · 탈락 '+n['탈락']+' · 미정 '+n['미정'];
 document.querySelectorAll('.filters button').forEach(function(b){b.classList.toggle('on',b.dataset.f===filter)})}
document.querySelectorAll('.take').forEach(function(t){var k=t.dataset.key;S.takes[k]=S.takes[k]||{status:t.dataset.status||'',memo:''};
 var m=t.querySelector('.memo');if(S.takes[k].memo)m.value=S.takes[k].memo;m.addEventListener('input',function(){S.takes[k].memo=m.value;keep()});
 t.querySelectorAll('.seg button').forEach(function(b){b.addEventListener('click',function(){S.takes[k].status=S.takes[k].status===b.dataset.s?'':b.dataset.s;keep();paint()})});
 var media=t.querySelector('img,video');media.addEventListener('click',function(){open(k)})});
document.querySelectorAll('.cut').forEach(function(c){var m=c.querySelector('.cmemo');if(S.cuts[c.dataset.cut])m.value=S.cuts[c.dataset.cut];m.addEventListener('input',function(){S.cuts[c.dataset.cut]=m.value;keep()})});
document.querySelectorAll('.filters button').forEach(function(b){b.addEventListener('click',function(){filter=b.dataset.f;paint()})});
function save(){var d=new Date(),z=function(x){return String(x).padStart(2,'0')};
 var out={page:'검수',work:D.work,round:D.round,saved_at:d.toISOString(),takes:S.takes,cuts:S.cuts};var a=document.createElement('a');
 a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,1)],{type:'application/json'}));
 a.download=D.work+'_검수_'+d.getFullYear()+z(d.getMonth()+1)+z(d.getDate())+'-'+z(d.getHours())+z(d.getMinutes())+z(d.getSeconds())+'.json';document.body.appendChild(a);a.click();a.remove();
 document.getElementById('saved').textContent='저장함 '+z(d.getHours())+':'+z(d.getMinutes())}
document.getElementById('save').addEventListener('click',save);
document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save()}});
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

// ---------- 실행 ----------
if (reviewArg) {
  // "검수 빼" · "검수 다시 켜" — 한 번 들은 건 파일에 남겨 다음 대화·다른 에이전트도 따른다
  if (!["on", "off", "status"].includes(reviewArg)) { console.error(USAGE); process.exit(2); }
  if (reviewArg !== "status") {
    const file = setReview(work, reviewArg === "on");
    console.log(`검수 ${reviewArg === "on" ? "켬" : "끔"} — ${work ? "이 작업만" : "이 PC 사용자의 모든 작업"} (${file})`);
  }
  const s = reviewSetting(work);
  console.log(`지금: 검수 ${s.on ? "켜짐" : "꺼짐"} · ${s.from}${s.on ? "" : " — 결과는 폴더에 받기만 하고 검수 페이지·검수 회차는 만들지 않는다"}`);
} else if (applyFile) {
  let saved;
  try { saved = JSON.parse(readText(applyFile)); } catch (e) { console.error(`저장본을 못 읽음 — ${e.message}`); process.exit(1); }
  if (saved.work && saved.work !== path.basename(work)) console.log(`참고: 저장본의 작업(${saved.work})과 폴더 이름(${path.basename(work)})이 다르다 — 파일 이름이 같은 것만 옮긴다`);
  const { moved, okCards, takes, round, dup } = apply(saved, path.basename(applyFile));
  fs.mkdirSync(REVIEW_DIR, { recursive: true });
  const keepCopy = path.join(REVIEW_DIR, path.basename(applyFile));
  if (path.resolve(keepCopy) !== path.resolve(applyFile)) fs.copyFileSync(applyFile, keepCopy);
  render();
  const n = (s) => takes.filter((t) => (t.status || "") === s).length;
  console.log(`${round}차 분류 적용${dup ? "(이미 적용한 저장본 — 회차는 그대로)" : ""} — OK ${n("OK")} · 보류 ${n("보류")} · 탈락 ${n("탈락")} · 미정 ${n("")} · 옮긴 파일 ${moved.length}개`);
  for (const m of moved) console.log(`  ${m}`);
  console.log(`_컷목록.tsv · 검수.html 을 새로 썼다(이번 메모는 다음 페이지에서 '지난 피드백'으로 보인다): ${MASTER}`);
  if (okCards.length) {
    // 인자는 JSON 파일로 넘긴다 — Windows PowerShell 은 명령줄의 큰따옴표를 깨뜨린다. 카드마다 파일 하나.
    console.log(`OK 카드 ${okCards.length}개 — 앱에서 채택(★)을 켠다(과금 없음):`);
    okCards.forEach((id, i) => {
      const argFile = path.join(REVIEW_DIR, `_star_${i + 1}.json`);
      fs.writeFileSync(argFile, JSON.stringify({ id, on: true }));
      console.log(`  node send-to-seedance.mjs --do card.star "@${argFile}"`);
    });
  }
} else {
  const s = reviewSetting(work);
  if (!s.on && !force) {
    console.log(`검수가 꺼져 있다(${s.from}) — 페이지를 만들지 않는다. 결과는 폴더에 받은 그대로 둔다. 이번만 만들려면 --force, 다시 켜려면 --review on`);
    process.exit(0);
  }
  const { takes, page } = render();
  const rounds = readRounds().length;
  const fresh = rounds ? takes.filter((t) => !new Set(readRounds()[rounds - 1].keys || []).has(t.key)).length : 0;
  console.log(`${rounds + 1}차 검수 페이지 — 컷 ${new Set(takes.map((t) => `${t.folder}/${t.cut}`)).size}개 · 테이크 ${takes.length}개${rounds ? ` (새로 ${fresh}개 · 지난 피드백 ${rounds}회차는 읽기 전용으로)` : ""} → ${page}`);
}
