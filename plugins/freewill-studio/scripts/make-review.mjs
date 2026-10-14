#!/usr/bin/env node
// 검수 · 분류 — 작업 폴더에 받은 컷(보내기 스크립트 --save-to 가 남긴 _목록.tsv)을 컷마다 테이크 나란히 놓고
// OK · 보류 · NG 와 메모를 고르는 HTML 을 만든다. 페이지에서 저장하면 다운로드 폴더에 JSON 이 생긴다.
// 그 저장본을 --apply 로 주면 파일을 <폴더>/OK/ · <폴더>/보류/ · _후보/<폴더>/ 로 옮기고 작업 폴더의 _컷목록.tsv 를 새로 쓴다.
// 지우는 일은 없다 — NG 도 _후보 로 옮기기만 한다. (지침 6단계 "작업 정리 — 검수와 분류")
//
//   node make-review.mjs <작업 폴더> [--title "작업 이름"]       → <작업 폴더>/_검수/검수.html (같은 자리에서 갱신)
//   node make-review.mjs <작업 폴더> --apply <저장본.json>       → 분류대로 옮김 · _컷목록.tsv · 검수.html 다시 · OK 카드 목록
//
// 프롬프트는 <작업 폴더>/05_프롬프트/*.json(보낸 jobs.json) 에서 작업 이름(name)으로 찾아 같이 보여 준다.
import fs from "node:fs";
import path from "node:path";

const USAGE = "쓰는 법: node make-review.mjs <작업 폴더> [--title \"작업 이름\"] | node make-review.mjs <작업 폴더> --apply <저장본.json>";
const argv = process.argv.slice(2);
let work = "", title = "", applyFile = "";
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--title") title = argv[++i] || "";
  else if (argv[i] === "--apply") applyFile = argv[++i] || "";
  else if (argv[i] === "-h" || argv[i] === "--help") { console.log(USAGE); process.exit(0); }
  else if (!work) work = argv[i];
}
if (!work || !fs.existsSync(work) || !fs.statSync(work).isDirectory()) { console.error(USAGE); process.exit(2); }
work = path.resolve(work);
title = title || path.basename(work);
const REVIEW_DIR = path.join(work, "_검수");
const PAGE = path.join(REVIEW_DIR, "검수.html");
const MASTER = path.join(work, "_컷목록.tsv");
const STATUSES = ["OK", "보류", "NG"];
const VIDEO = /\.(mp4|mov|m4v|webm)$/i;

// ---------- 읽기 ----------
const readText = (p) => fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "");
function readTsv(p) {
  const lines = readText(p).split(/\r?\n/).filter((l) => l.trim());
  const head = (lines.shift() || "").split("\t");
  return lines.map((l) => Object.fromEntries(l.split("\t").map((v, i) => [head[i] || `c${i}`, v])));
}

// 지금 그 파일이 어디 있는지 — 받은 자리(미정) · OK/ · 보류/ · _후보/<폴더>/ (NG)
function locate(folder, file) {
  const base = path.join(work, folder);
  const spots = [[path.join(base, file), ""], [path.join(base, "OK", file), "OK"], [path.join(base, "보류", file), "보류"],
    [path.join(work, "_후보", folder, file), "NG"]];
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

// 지난 분류의 메모 — _컷목록.tsv
function readMemos() {
  const takeMemo = new Map(), cutMemo = new Map();
  if (!fs.existsSync(MASTER)) return { takeMemo, cutMemo };
  for (const r of readTsv(MASTER)) {
    if (r["메모"]) takeMemo.set(`${r["폴더"]}/${path.basename(r["파일"] || "")}`, r["메모"]);
    if (r["컷 메모"]) cutMemo.set(`${r["폴더"]}/${r["컷"]}`, r["컷 메모"]);
  }
  return { takeMemo, cutMemo };
}

// ---------- 적용 ----------
function apply(saved) {
  const takes = scan();
  const byKey = new Map(takes.map((t) => [t.key, t]));
  const moved = [], okCards = [];
  for (const [key, d] of Object.entries(saved.takes || {})) {
    const t = byKey.get(key);
    if (!t) continue;
    const status = STATUSES.includes(d?.status) ? d.status : "";
    const target = status === "OK" ? path.join(work, t.folder, "OK", t.file)
      : status === "보류" ? path.join(work, t.folder, "보류", t.file)
      : status === "NG" ? path.join(work, "_후보", t.folder, t.file)
      : path.join(work, t.folder, t.file);
    if (path.resolve(target) !== path.resolve(t.abs)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      try { fs.renameSync(t.abs, target); } catch { fs.copyFileSync(t.abs, target); fs.rmSync(t.abs, { force: true }); }
      moved.push(`${status || "미정"} ← ${key}`);
      t.abs = target;
    }
    t.status = status;
    t.memo = String(d?.memo || "");
    if (status === "OK" && t.card) okCards.push(t.card);
  }
  const cutMemo = saved.cuts || {};
  const rel = (p) => path.relative(work, p).split(path.sep).join("/");
  const rows = takes.map((t) => [t.folder, t.cut, t.take, t.status || "미정", rel(t.abs), t.card, t.task, (t.memo ?? "").replace(/\s+/g, " "),
    String(cutMemo[`${t.folder}/${t.cut}`] || "").replace(/\s+/g, " ")].join("\t"));
  fs.writeFileSync(MASTER, `폴더\t컷\t테이크\t상태\t파일\t카드\ttask\t메모\t컷 메모\n${rows.join("\n")}\n`);
  return { moved, okCards, takes };
}

// ---------- 그리기 ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const relFromPage = (abs) => path.relative(REVIEW_DIR, abs).split(path.sep).map(encodeURIComponent).join("/");

function render() {
  const takes = scan();
  const prompts = readPrompts();
  const { takeMemo, cutMemo } = readMemos();
  const folders = [...new Set(takes.map((t) => t.folder))];
  const sections = folders.map((folder) => {
    const cuts = [...new Set(takes.filter((t) => t.folder === folder).map((t) => t.cut))];
    return `<section class="folder"><h2>${esc(folder)}</h2>${cuts.map((cut) => {
      const mine = takes.filter((t) => t.folder === folder && t.cut === cut).sort((a, b) => a.take.localeCompare(b.take));
      const p = prompts.get(cut);
      const ckey = `${folder}/${cut}`;
      return `<article class="cut" data-cut="${esc(ckey)}">
<div class="cut-head"><h3>${esc(cut)}</h3>${p ? `<span class="chip">${esc([p.model, p.mode].filter(Boolean).join(" · "))}</span>` : ""}<span class="chip">${mine.length}개</span></div>
<div class="takes">${mine.map((t) => `<div class="take" data-key="${esc(t.key)}" data-status="${esc(t.status)}">
${t.video ? `<video src="${relFromPage(t.abs)}" preload="metadata" muted playsinline></video>` : `<img src="${relFromPage(t.abs)}" alt="${esc(t.key)}" loading="lazy">`}
<div class="tf"><b>${esc(t.take || t.file)}</b><span class="seg">${STATUSES.map((s) => `<button type="button" data-s="${s}">${s}</button>`).join("")}</span></div>
<textarea class="memo" placeholder="이 테이크 메모">${esc(takeMemo.get(t.key) || "")}</textarea></div>`).join("")}</div>
<textarea class="cmemo" placeholder="이 컷 메모 — 무엇을 고칠지">${esc(cutMemo.get(ckey) || "")}</textarea>
${p ? `<details><summary>보낸 프롬프트</summary><pre>${esc(p.prompt)}</pre></details>` : ""}
</article>`;
    }).join("")}</section>`;
  }).join("");
  const data = JSON.stringify({ work: path.basename(work), title });
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} 검수</title><style>${CSS}</style></head><body>
<header><div class="bar"><h1>${esc(title)} 검수</h1><span class="count" id="count"></span>
<span class="filters">${["전체", "미정", ...STATUSES].map((f) => `<button type="button" data-f="${f}">${f}</button>`).join("")}</span>
<button type="button" id="play">OK 이어서 보기</button><span id="saved"></span><button type="button" id="save">저장 (Ctrl+S)</button></div></header>
<main><p class="intro">테이크마다 <b>OK</b>(쓸 것) · <b>보류</b>(다시 볼 것) · <b>NG</b>(안 쓸 것)를 고르고 메모를 적은 뒤 저장하면 다운로드 폴더에 JSON 이 생긴다.
에이전트가 그 저장본대로 파일을 OK/ · 보류/ · _후보/ 로 옮기고 앱 카드에 채택(★)을 켠다. 그림·영상을 누르면 크게 보인다(←/→, Esc).</p>
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
.take[data-status="OK"]{border-color:#1f8a4c}.take[data-status="보류"]{border-color:#c98a00}.take[data-status="NG"]{border-color:#c62828;opacity:.7}
.take img,.take video{display:block;width:100%;aspect-ratio:16/9;object-fit:contain;background:#111;cursor:zoom-in}
.tf{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;gap:8px}
.seg{display:inline-flex;border:1px solid #d5d9e0;border-radius:8px;overflow:hidden}
.seg button{border:0;background:#fff;padding:5px 12px;font:inherit;font-size:13px;cursor:pointer;border-right:1px solid #e3e6eb}.seg button:last-child{border-right:0}
.take[data-status="OK"] .seg [data-s="OK"]{background:#1f8a4c;color:#fff}.take[data-status="보류"] .seg [data-s="보류"]{background:#c98a00;color:#fff}
.take[data-status="NG"] .seg [data-s="NG"]{background:#c62828;color:#fff}
textarea{width:100%;border:1px solid #e3e6eb;border-radius:8px;padding:6px 10px;font:inherit;font-size:13px;resize:vertical;min-height:38px}
.take textarea{border-width:1px 0 0;border-radius:0}.cmemo{margin-top:10px}
details{margin-top:8px}summary{cursor:pointer;color:#5b616e;font-size:13px}pre{white-space:pre-wrap;background:#f3f5f8;border-radius:8px;padding:10px;font-size:12px}
.hide{display:none}
#lb{position:fixed;inset:0;background:#0b0c0ef2;display:none;z-index:9;flex-direction:column}#lb.on{display:flex}
#lb .stage{flex:1;display:flex;align-items:center;justify-content:center;padding:12px;min-height:0}#lb .stage>*{max-width:100%;max-height:100%}
#lb .cap{color:#e8eaee;text-align:center;padding:8px 0 16px}#lb .x{position:absolute;top:10px;right:14px;background:#ffffff22;color:#fff;border:1px solid #ffffff44;border-radius:8px;padding:6px 12px;cursor:pointer}
`;

const JS = `
var D=JSON.parse(document.getElementById('rv-data').textContent);var KEY='rv:'+D.work;
var S;try{S=JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){S=null}
if(!S){S={takes:{},cuts:{}};document.querySelectorAll('.take').forEach(function(t){S.takes[t.dataset.key]={status:t.dataset.status||'',memo:t.querySelector('.memo').value}});document.querySelectorAll('.cut').forEach(function(c){S.cuts[c.dataset.cut]=c.querySelector('.cmemo').value})}
function keep(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
var filter='전체';
function paint(){var n={OK:0,'보류':0,NG:0,'미정':0};
 document.querySelectorAll('.take').forEach(function(t){var d=S.takes[t.dataset.key]||{status:''};t.dataset.status=d.status||'';n[d.status||'미정']++;
  t.classList.toggle('hide',!(filter==='전체'||(filter==='미정'?!d.status:d.status===filter)))});
 document.querySelectorAll('.cut').forEach(function(c){c.classList.toggle('hide',!c.querySelector('.take:not(.hide)'))});
 document.getElementById('count').textContent='OK '+n.OK+' · 보류 '+n['보류']+' · NG '+n.NG+' · 미정 '+n['미정'];
 document.querySelectorAll('.filters button').forEach(function(b){b.classList.toggle('on',b.dataset.f===filter)})}
document.querySelectorAll('.take').forEach(function(t){var k=t.dataset.key;S.takes[k]=S.takes[k]||{status:t.dataset.status||'',memo:''};
 var m=t.querySelector('.memo');if(S.takes[k].memo)m.value=S.takes[k].memo;m.addEventListener('input',function(){S.takes[k].memo=m.value;keep()});
 t.querySelectorAll('.seg button').forEach(function(b){b.addEventListener('click',function(){S.takes[k].status=S.takes[k].status===b.dataset.s?'':b.dataset.s;keep();paint()})});
 var media=t.querySelector('img,video');media.addEventListener('click',function(){open(k)})});
document.querySelectorAll('.cut').forEach(function(c){var m=c.querySelector('.cmemo');if(S.cuts[c.dataset.cut])m.value=S.cuts[c.dataset.cut];m.addEventListener('input',function(){S.cuts[c.dataset.cut]=m.value;keep()})});
document.querySelectorAll('.filters button').forEach(function(b){b.addEventListener('click',function(){filter=b.dataset.f;paint()})});
function save(){var d=new Date(),z=function(x){return String(x).padStart(2,'0')};
 var out={page:'검수',work:D.work,saved_at:d.toISOString(),takes:S.takes,cuts:S.cuts};var a=document.createElement('a');
 a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,1)],{type:'application/json'}));
 a.download=D.work+'_검수_'+d.getFullYear()+z(d.getMonth()+1)+z(d.getDate())+'-'+z(d.getHours())+z(d.getMinutes())+'.json';document.body.appendChild(a);a.click();a.remove();
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
if (applyFile) {
  let saved;
  try { saved = JSON.parse(readText(applyFile)); } catch (e) { console.error(`저장본을 못 읽음 — ${e.message}`); process.exit(1); }
  if (saved.work && saved.work !== path.basename(work)) console.log(`참고: 저장본의 작업(${saved.work})과 폴더 이름(${path.basename(work)})이 다르다 — 파일 이름이 같은 것만 옮긴다`);
  const { moved, okCards, takes } = apply(saved);
  fs.mkdirSync(REVIEW_DIR, { recursive: true });
  const keepCopy = path.join(REVIEW_DIR, path.basename(applyFile));
  if (path.resolve(keepCopy) !== path.resolve(applyFile)) fs.copyFileSync(applyFile, keepCopy);
  render();
  const n = (s) => takes.filter((t) => (t.status || "") === s).length;
  console.log(`분류 적용 — OK ${n("OK")} · 보류 ${n("보류")} · NG ${n("NG")} · 미정 ${n("")} · 옮긴 파일 ${moved.length}개`);
  for (const m of moved) console.log(`  ${m}`);
  console.log(`_컷목록.tsv · 검수.html 을 새로 썼다: ${MASTER}`);
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
  const { takes, page } = render();
  console.log(`검수 페이지 — 컷 ${new Set(takes.map((t) => `${t.folder}/${t.cut}`)).size}개 · 테이크 ${takes.length}개 → ${page}`);
}
