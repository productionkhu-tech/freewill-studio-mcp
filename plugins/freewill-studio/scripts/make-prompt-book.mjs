#!/usr/bin/env node
// 프롬프트 북 만들기 — 컨펌된 이미지·영상 작업을 HTML 한 장으로 정리한다(인라인 CSS·JS, 바깥 연결 없음).
//
//   node make-prompt-book.mjs <book.json | 전에 만든 북.html> --out <저장할 경로.html> [--link]
//
// - 그림·영상은 HTML 옆 "<북 이름>_files" 폴더로 복사하고 상대 경로로 건다. 폴더째 옮기거나 압축해 넘겨도 열린다.
//   HTML 과 같은 폴더(또는 그 아래)에 이미 있는 파일은 복사하지 않는다. --link 는 복사 없이 원래 자리를 건다(이 PC 에서만 열림).
// - 같은 --out 으로 다시 돌리면 그 자리에서 갱신된다. 체크·언어·탭 선택은 브라우저에 남아 있어 컷 id 가 같으면 이어진다.
// - 북 안에 만든 데이터가 들어 있어서 book.json 이 없어도 북.html 을 입력으로 다시 만들 수 있다.
// - book.json 형식은 커넥터 지침 freewill_guide("prompt-book").
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import crypto from "node:crypto";

const USAGE = "쓰는 법: node make-prompt-book.mjs <book.json | 북.html> --out <저장할 경로.html> [--link]";
const argv = process.argv.slice(2);
let input = "";
let out = "";
let linkOnly = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--out") out = argv[++i] || "";
  else if (argv[i] === "--link") linkOnly = true;
  else if (argv[i] === "-h" || argv[i] === "--help") { console.log(USAGE); process.exit(0); }
  else if (!input) input = argv[i];
}
if (!input || !out) { console.error(USAGE); process.exit(2); }
if (!/\.html?$/i.test(out)) out += ".html";

const inAbs = path.resolve(input);
const inDir = path.dirname(inAbs);
const outAbs = path.resolve(out);
const outDir = path.dirname(outAbs);
const filesName = path.basename(outAbs).replace(/\.html?$/i, "") + "_files";
const filesDir = path.join(outDir, filesName);

// ---------- 읽기 ----------
function readInput(p) {
  let text = fs.readFileSync(p, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (/\.html?$/i.test(p)) {
    const m = text.match(/<script type="application\/octet-stream" id="pb-data">([A-Za-z0-9+/=]+)<\/script>/);
    if (!m) throw new Error("이 HTML 에는 북 데이터가 없다 — make-prompt-book 으로 만든 북만 입력으로 쓸 수 있다");
    return JSON.parse(Buffer.from(m[1], "base64").toString("utf8"));
  }
  return JSON.parse(text);
}

const S = (v) => (v === undefined || v === null ? "" : String(v)).trim();
const A = (v) => (Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v]);
const num = (v) => (v === "" || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));

function safeId(raw, used) {
  let id = S(raw).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!id || /^[0-9-]/.test(id)) id = "x" + (id || crypto.createHash("sha1").update(S(raw)).digest("hex").slice(0, 6));
  let k = id;
  for (let n = 2; used.has(k); n++) k = id + "-" + n;
  used.add(k);
  return k;
}

function normMedia(m, label) {
  if (!m) return null;
  if (typeof m === "string") m = { file: m };
  const file = S(m.file || m.path || m.src);
  if (!file) return null;
  return {
    file,
    pub: S(m.pub),
    poster: m.poster ? normMedia(m.poster) : null,
    label: S(m.label) || S(label),
    note: S(m.note),
    adopted: !!(m.adopted || m.picked),
    kind: S(m.kind),
  };
}

// 레퍼런스 가리키기: "이름" 또는 { "name": "이름", "as": "[Image 2]" }
function refItem(x) {
  if (!x) return null;
  if (typeof x === "string") return S(x) ? { name: S(x), as: "" } : null;
  const name = S(x.name || x.ref || x.id);
  return name ? { name, as: S(x.as) } : null;
}

// I2V 의 프레임(첫·끝 프레임 그림) — 그 그림을 만든 이미지 프롬프트·설정·테이크·채택
function normFrame(f) {
  if (!f) return null;
  return {
    role: S(f.role) || "프레임",
    title: S(f.title),
    prompt: S(f.prompt),
    prompt_ko: S(f.prompt_ko),
    settings: f.settings || null,
    refs: A(f.refs).map(refItem).filter(Boolean),
    results: A(f.results !== undefined ? f.results : f.images !== undefined ? f.images : f.image).map((r) => normMedia(r)).filter(Boolean),
    note: S(f.note),
    auto: !!f.auto,
  };
}

// 나노바나나가 저장한 PNG 에는 프롬프트(Prompt)·모델(Model)이 글자 청크로 들어 있다 — 압축 안 된 tEXt·iTXt 만 읽는다.
function pngText(file) {
  if (!/\.png$/i.test(file)) return {};
  let fd;
  try {
    fd = fs.openSync(file, "r");
    const size = fs.fstatSync(fd).size;
    const hdr = Buffer.alloc(8);
    fs.readSync(fd, hdr, 0, 8, 0);
    if (hdr.toString("latin1", 1, 4) !== "PNG") return {};
    const outp = {};
    let pos = 8;
    while (pos + 8 <= size) {
      fs.readSync(fd, hdr, 0, 8, pos);
      const len = hdr.readUInt32BE(0);
      const type = hdr.toString("latin1", 4, 8);
      if ((type === "tEXt" || type === "iTXt") && len < 4 * 1024 * 1024) {
        const d = Buffer.alloc(len);
        fs.readSync(fd, d, 0, len, pos + 8);
        const z = d.indexOf(0);
        const key = d.toString("latin1", 0, z);
        let val = "";
        if (type === "tEXt") val = d.toString("utf8", z + 1);
        else if (d[z + 1] === 0) {
          const l1 = d.indexOf(0, z + 3);
          const l2 = d.indexOf(0, l1 + 1);
          if (l1 >= 0 && l2 >= 0) val = d.toString("utf8", l2 + 1);
        }
        if (val && !(key in outp)) outp[key] = val;
      }
      if (type === "IEND") break;
      pos += 12 + len;
    }
    return outp;
  } catch {
    return {};
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch { /* 이미 닫힘 */ }
  }
}
const MODEL_NAME = [
  [/gpt-image-2\.5-sunburst/i, "GPT Image 2.5 선버스트"], [/gpt-image-2\.5-flare/i, "GPT Image 2.5 플레어"], [/gpt-image/i, "GPT Image"],
  [/gemini-3-pro-image/i, "Nano Banana Pro"], [/nano-banana-2\.1/i, "Nano Banana 2.1"], [/nano-banana|gemini.*image/i, "Nano Banana"],
  [/seedream-?5/i, "Seedream 5.0"], [/seedream/i, "Seedream"],
  [/seedance-2-5|seedance-2\.5/i, "Seedance 2.5"], [/seedance-2-0|seedance-2\.0/i, "Seedance 2.0"],
];
const prettyModel = (m) => { for (const [re, n] of MODEL_NAME) if (re.test(m)) return n; return m; };

function normStyle(s) {
  if (!s) return null;
  if (typeof s === "string") return { title: "공통 스타일", en: S(s), ko: "" };
  return { title: S(s.title) || "공통 스타일", en: S(s.en || s.prompt), ko: S(s.ko || s.prompt_ko) };
}

function normBook(src) {
  const book = {
    id: S(src.id) || S(src.title) || "book",
    title: S(src.title) || "프롬프트 북",
    subtitle: S(src.subtitle),
    notes: A(src.notes).map(S).filter(Boolean),
    style: normStyle(src.style),
    tabs: [],
  };
  const tabsIn = A(src.tabs).length ? A(src.tabs) : [{ title: book.title, refs: src.refs, cuts: src.cuts }];
  const tabIds = new Set();
  for (const t of tabsIn) {
    const tab = {
      id: safeId(t.id || t.title || "tab", tabIds),
      title: S(t.title) || "작업",
      sub: S(t.sub || t.subtitle),
      notes: A(t.notes).map(S).filter(Boolean),
      style: normStyle(t.style),
      refs: [],
      cuts: [],
    };
    const refIds = new Set();
    for (const r of A(t.refs)) {
      if (!r) continue;
      const name = S(r.name || r.id);
      tab.refs.push({
        id: safeId(r.id || name, refIds),
        key: S(r.id || name),
        name,
        category: S(r.category),
        element: !!r.element,
        model: S(r.model),
        role: S(r.role),
        note: S(r.note),
        prompt: S(r.prompt),
        prompt_ko: S(r.prompt_ko),
        images: A(r.images || r.image).map((x) => normMedia(x)).filter(Boolean),
        auto: !!r.auto,
      });
    }
    const cutIds = new Set();
    A(t.cuts).forEach((c, i) => {
      if (!c) return;
      const label = S(c.id) || "C" + String(i + 1).padStart(2, "0");
      tab.cuts.push({
        id: safeId(label, cutIds),
        label,
        title: S(c.title),
        summary: S(c.summary),
        group: S(c.group),
        settings: c.settings || null,
        duration: num(c.duration !== undefined ? c.duration : c.settings && c.settings.duration),
        flow: S(c.flow).toLowerCase(),
        refs: A(c.refs).map(refItem).filter(Boolean),
        frames: A(c.frames).map(normFrame).filter(Boolean),
        prompt: S(c.prompt),
        prompt_ko: S(c.prompt_ko),
        auto: !!c.auto,
        results: A(c.results).map((r) => normMedia(r)).filter(Boolean),
        finals: A(c.finals !== undefined ? c.finals : c.final).map((r) => normMedia(r, "본편")).filter(Boolean),
        notes: A(c.notes).map(S).filter(Boolean),
        memo: A(c.memo).map(S).filter(Boolean),
      });
    });
    book.tabs.push(tab);
  }
  return book;
}

// 프롬프트가 비어 있으면 그림 파일(PNG)에 들어 있는 것으로 채운다 — 이미지 한 장씩 만든 작업에서 기록이 없을 때.
const IMG_EXT = /\.(png|jpe?g|webp|gif|avif|bmp)$/i;
const VIDEO_EXT = /\.(mp4|mov|webm|m4v)$/i;
const absOf = (file) => (path.isAbsolute(file) ? file : path.resolve(inDir, file));
function fromPng(target, media, withSettings) {
  if (target.prompt) return;
  const pick = media.find((m) => m.adopted) || media[0];
  if (!pick) return;
  const meta = pngText(absOf(pick.file));
  const comment = S(meta.Comment);
  const p = S(meta.Prompt || meta.prompt || (comment.startsWith("Prompt: ") ? comment.slice(8) : ""));
  if (p) { target.prompt = p; target.auto = true; }
  if (meta.Model) {
    if (!withSettings) { if (!target.model) target.model = S(meta.Model); }
    else if (!target.settings) target.settings = { model: S(meta.Model) };
    else if (typeof target.settings === "object" && !Array.isArray(target.settings) && !target.settings.model) target.settings = { model: S(meta.Model), ...target.settings };
  }
}
function autofill(book) {
  for (const t of book.tabs) {
    for (const r of t.refs) fromPng(r, r.images, false);
    for (const c of t.cuts) {
      for (const f of c.frames) fromPng(f, f.results, true);
      const media = [...c.results, ...c.finals];
      if (media.length && media.every((m) => IMG_EXT.test(m.file))) fromPng(c, media, true);
    }
  }
}

// ---------- 그림·영상 ----------
const KIND = { png: "image", jpg: "image", jpeg: "image", webp: "image", gif: "image", avif: "image", bmp: "image",
  mp4: "video", webm: "video", mov: "video", m4v: "video", mp3: "audio", wav: "audio", m4a: "audio", ogg: "audio" };
const stats = { copied: 0, kept: 0, linked: 0, missing: [] };
const published = new Map();
const destNames = new Map();
const toHref = (rel) => rel.split(path.sep).map(encodeURIComponent).join("/");

function publish(m) {
  if (!m) return null;
  const kind = m.kind || KIND[path.extname(m.file).slice(1).toLowerCase()] || "file";
  let abs = path.isAbsolute(m.file) ? m.file : path.resolve(inDir, m.file);
  if (!fs.existsSync(abs) && m.pub) {
    const alt = path.resolve(inDir, m.pub);
    if (fs.existsSync(alt)) abs = alt;
  }
  const name = path.basename(abs);
  if (!fs.existsSync(abs)) {
    stats.missing.push(m.file);
    return { kind, name, href: "", missing: true, src: abs, pub: m.pub };
  }
  if (published.has(abs)) return published.get(abs);
  let res;
  if (linkOnly) {
    stats.linked++;
    res = { kind, name, href: url.pathToFileURL(abs).href, src: abs, pub: "" };
  } else {
    const rel = path.relative(outDir, abs);
    if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
      stats.kept++;
      res = { kind, name, href: toHref(rel), src: abs, pub: rel };
    } else {
      let dn = name;
      if (destNames.has(dn) && destNames.get(dn) !== abs) dn = crypto.createHash("sha1").update(abs).digest("hex").slice(0, 6) + "_" + name;
      destNames.set(dn, abs);
      const dest = path.join(filesDir, dn);
      const st = fs.statSync(abs);
      let same = false;
      try { const d = fs.statSync(dest); same = d.size === st.size && Math.abs(d.mtimeMs - st.mtimeMs) < 2000; } catch { same = false; }
      if (!same) {
        fs.mkdirSync(filesDir, { recursive: true });
        fs.copyFileSync(abs, dest);
        fs.utimesSync(dest, st.atime, st.mtime);
        stats.copied++;
      } else stats.kept++;
      const relp = path.join(filesName, dn);
      res = { kind, name, href: toHref(relp), src: abs, pub: relp };
    }
  }
  published.set(abs, res);
  return res;
}

// ---------- HTML ----------
const h = (s) => S(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const raw = (s) => (s === undefined || s === null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const SET_KO = { model: "모델", mode: "모드", ratio: "비율", aspect: "비율", resolution: "해상도", quality: "품질",
  duration: "길이", count: "개수", output_count: "개수", draft: "초안", audio: "오디오", generate_audio: "오디오", seed: "시드" };
function settingChips(s) {
  if (!s) return [];
  if (Array.isArray(s)) return s.map(S).filter(Boolean).map((t) => ({ t, k: "" }));
  if (typeof s !== "object") return [{ t: S(s), k: "" }];
  const outc = [];
  for (const [k, v] of Object.entries(s)) {
    if (v === null || v === undefined || v === "") continue;
    const label = SET_KO[k] || k;
    let t;
    if (v === true) t = label === "초안" ? "초안" : label + " 켬";
    else if (v === false) { if (label === "초안") continue; t = label + " 끔"; }
    else {
      t = S(v);
      if (k === "model") t = prettyModel(t);
      if (k === "duration" && /^\d+(\.\d+)?$/.test(t)) t += "초";
      if ((k === "count" || k === "output_count") && /^\d+$/.test(t)) t += "개";
    }
    outc.push({ t, k: label });
  }
  return outc;
}
const CAT_KO = { character: "인물", person: "인물", location: "장소", place: "장소", prop: "소품", object: "소품", style: "스타일", product: "제품",
  video: "영상", palette: "팔레트", image: "그림", reference: "참고", sheet: "시트", frame: "프레임" };
const FLOW_KO = { r2v: "레퍼런스→영상", i2v: "이미지→영상", t2v: "글→영상", v2v: "영상→영상", image: "이미지" };
const fmtSec = (s) => {
  if (s === null) return "";
  const r = Math.round(s * 10) / 10;
  if (r < 60) return r + "초";
  const m = Math.floor(r / 60), sec = Math.round((r - m * 60) * 10) / 10;
  return m + "분" + (sec ? " " + sec + "초" : "");
};
const pad2 = (n) => String(n).padStart(2, "0");
const now = new Date();
const madeAt = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

function mediaTile(m, cls, cap, groupLabel) {
  const p = publish(m);
  if (!p) return "";
  if (p.missing) return `<div class="m missing ${cls}"><span>파일 없음</span><small>${h(p.name)}</small></div>`;
  const poster = m.poster ? publish(m.poster) : null;
  const posterHref = poster && !poster.missing ? poster.href : "";
  const badge = cls.includes("final") ? `<b class="badge final">${h(m.label || "본편")}</b>` : m.adopted ? `<b class="badge pick">채택</b>` : "";
  const label = cls.includes("final") ? "" : h(m.label);
  const caption = [groupLabel, cls.includes("final") ? m.label || "본편" : m.label, m.adopted && !cls.includes("final") ? "채택" : ""].filter(Boolean).join(" · ");
  let visual;
  if (p.kind === "image") visual = `<img src="${p.href}" alt="" loading="lazy">`;
  else if (p.kind === "video") visual = posterHref
    ? `<img src="${posterHref}" alt="" loading="lazy"><span class="play" aria-hidden="true"></span>`
    : `<video src="${p.href}#t=0.1" preload="metadata" muted playsinline tabindex="-1"></video><span class="play" aria-hidden="true"></span>`;
  else visual = `<span class="file">${h(p.name)}</span>`;
  return `<button type="button" class="m ${cls}" data-lb data-kind="${p.kind}" data-src="${p.href}"${posterHref ? ` data-poster="${posterHref}"` : ""} data-cap="${h(caption)}" title="${h(p.name)}">${visual}<span class="cap">${badge}<span>${label || h(p.name)}</span></span>${m.note ? `<span class="mnote">${h(m.note)}</span>` : ""}</button>`;
}

function promptBlock(idBase, en, ko, title) {
  if (!en && !ko) return "";
  const long = (en.length > 900 || ko.length > 900 || en.split("\n").length > 16) ? `<button type="button" class="more" aria-expanded="false">전체 보기</button>` : "";
  const panes = [];
  if (en) panes.push(`<div class="pane en"><span class="tag">EN</span><pre>${raw(en)}</pre></div>`);
  if (ko) panes.push(`<div class="pane ko"><span class="tag">한글</span><pre>${raw(ko)}</pre></div>`);
  return `<div class="pr${en && ko ? " both" : ""}"><div class="pr-h"><span class="pr-t">${h(title || "프롬프트")}</span>` +
    (en ? `<button type="button" class="cp" data-copy="${idBase}-en">영문 복사</button>` : "") +
    (ko ? `<button type="button" class="cp" data-copy="${idBase}-ko">한글 복사</button>` : "") + long +
    `</div><div class="panes">${panes.join("")}</div>` +
    (en ? `<textarea class="src" id="${idBase}-en" readonly tabindex="-1" aria-hidden="true">${raw(en)}</textarea>` : "") +
    (ko ? `<textarea class="src" id="${idBase}-ko" readonly tabindex="-1" aria-hidden="true">${raw(ko)}</textarea>` : "") + `</div>`;
}

function renderTab(book, tab, multi) {
  const T = tab.id;
  const refByKey = new Map();
  for (const r of tab.refs) {
    refByKey.set(r.key.replace(/^@/, "").toLowerCase(), r);
    refByKey.set(r.name.replace(/^@/, "").toLowerCase(), r);
  }
  const refFor = (name) => refByKey.get(S(name).replace(/^@/, "").toLowerCase());
  const usedIn = new Map();
  for (const c of tab.cuts) {
    const rs = new Set([...c.refs, ...c.frames.flatMap((f) => f.refs)].map((x) => refFor(x.name)).filter(Boolean));
    for (const r of rs) { if (!usedIn.has(r.id)) usedIn.set(r.id, []); usedIn.get(r.id).push(c); }
  }
  // 엘리먼트(어셋 라이브러리)만 @이름, 그냥 파일 레퍼런스는 이름만 — as 가 있으면 앞에 [Image N] 같은 표기
  const refChip = (x) => {
    const r = refFor(x.name);
    const label = (x.as ? x.as + " " : "") + ((r ? r.element : x.name.startsWith("@")) ? "@" : "") + (r ? r.name : x.name).replace(/^@/, "");
    return r ? `<button type="button" class="chip ref" data-go="${T}-r-${r.id}">${h(label)}</button>` : `<span class="chip ref">${h(label)}</span>`;
  };
  const chipHtml = (x) => `<span class="chip"${x.k ? ` title="${h(x.k)}"` : ""}>${h(x.t)}</span>`;
  // 작업 흐름: 에셋→영상(R2V) · 이미지 한 장씩→영상(I2V) · 글→영상(T2V) · 영상 편집(V2V) · 이미지만
  const flowOf = (c) => {
    const media = [...c.results, ...c.finals];
    const hasVideo = media.some((m) => m.kind === "video" || VIDEO_EXT.test(m.file));
    const rs = c.refs.map((x) => refFor(x.name)).filter(Boolean);
    const main = FLOW_KO[c.flow] ? c.flow : c.frames.length ? "i2v" : media.length && !hasVideo ? "image" : c.refs.length ? "r2v" : hasVideo ? "t2v" : "";
    const tags = main ? [FLOW_KO[main]] : [];
    if (c.frames.length) tags.push(c.frames.map((f) => f.role).join(" · "));
    const els = rs.filter((r) => r.element).length;
    if (els) tags.push(`@엘리먼트 ${els}`);
    if (rs.some((r) => r.images.some((m) => VIDEO_EXT.test(m.file)) || /video|영상/i.test(r.category))) tags.push("영상 레퍼런스");
    return { main, tags };
  };
  const flowCount = {};
  for (const c of tab.cuts) { const f = flowOf(c).main; if (f) flowCount[f] = (flowCount[f] || 0) + 1; }
  const flowLine = Object.entries(flowCount).map(([k, n]) => `${FLOW_KO[k]} ${n}컷`).join(" · ");
  const toc = [];
  const body = [];
  const strip = [];

  // 개요
  const nRes = tab.cuts.reduce((a, c) => a + c.results.length, 0);
  const nPick = tab.cuts.reduce((a, c) => a + c.results.filter((r) => r.adopted).length, 0);
  const nFin = tab.cuts.reduce((a, c) => a + c.finals.length, 0);
  const durs = tab.cuts.filter((c) => c.duration);
  const total = durs.reduce((a, c) => a + c.duration, 0);
  const stats = [`컷 ${tab.cuts.length}`, nRes ? `결과 ${nRes}` : "", nPick ? `채택 ${nPick}` : "", nFin ? `본편 ${nFin}` : "",
    durs.length ? `생성 길이 합 ${fmtSec(total)}` : "", tab.refs.length ? `레퍼런스 ${tab.refs.length}` : ""].filter(Boolean);
  const notes = [...book.notes, ...tab.notes];
  let tl = "";
  if (durs.length >= 2) {
    let at = 0;
    tl = `<div class="tl" role="list" aria-label="컷 길이">` + durs.map((c) => {
      const seg = `<button type="button" role="listitem" class="tl-s" style="flex-grow:${c.duration}" data-go="${T}-c-${c.id}" title="${h(c.label)} ${h(c.title)} · ${fmtSec(at)}–${fmtSec(at + c.duration)}"><b>${h(c.label)}</b><span>${fmtSec(c.duration)}</span></button>`;
      at += c.duration;
      return seg;
    }).join("") + `</div>`;
  }
  body.push(`<section class="sec" id="${T}-overview" data-spy><h2>개요</h2>` +
    `<p class="stats">${stats.map(h).join(" · ")}</p>` +
    (flowLine ? `<p class="flowline"><span>작업 흐름</span>${h(flowLine)}</p>` : "") +
    (notes.length ? `<ul class="notes">${notes.map((n) => `<li>${h(n)}</li>`).join("")}</ul>` : "") + tl +
    `<p class="howto">컷 스트립을 누르면 그 컷으로, 끌면 훑어보기 · ←/→ 이전·다음 컷 · / 찾기 · 그림·영상을 누르면 크게 보기</p></section>`);
  toc.push(`<a href="#${T}-overview">개요</a>`);

  const style = tab.style || book.style;
  if (style && (style.en || style.ko)) {
    body.push(`<section class="sec" id="${T}-style" data-spy><h2>${h(style.title)}</h2><p class="small">모든 컷 프롬프트 앞에 같이 쓴 문장</p>${promptBlock(`${T}-style`, style.en, style.ko, style.title)}</section>`);
    toc.push(`<a href="#${T}-style">${h(style.title)}</a>`);
  }

  if (tab.refs.length) {
    const cards = tab.refs.map((r) => {
      const used = (usedIn.get(r.id) || []).map((c) => `<button type="button" class="chip go" data-go="${T}-c-${c.id}">${h(c.label)}</button>`).join("");
      const imgs = r.images.map((m, i) => mediaTile(m, i ? "sub" : "main", "", r.name)).join("");
      const cat = CAT_KO[r.category.toLowerCase()] || r.category;
      return `<article class="ref" id="${T}-r-${r.id}"><div class="ref-imgs">${imgs || `<div class="m missing main"><span>그림 없음</span></div>`}</div>` +
        `<div class="ref-b"><div class="ref-n"><span class="at">${h((r.element || r.name.startsWith("@") ? "@" : "") + r.name.replace(/^@/, ""))}</span>` +
        `${cat ? `<span class="cat">${h(cat)}</span>` : ""}${r.model ? `<span class="cat">${h(prettyModel(r.model))}</span>` : ""}</div>` +
        (r.role ? `<p class="ref-role">${h(r.role)}</p>` : "") +
        (used ? `<div class="ref-used"><span>쓰는 컷</span>${used}</div>` : "") +
        (r.note ? `<details class="memo"><summary>메모</summary><p>${h(r.note)}</p></details>` : "") +
        promptBlock(`${T}-r-${r.id}-p`, r.prompt, r.prompt_ko, r.auto ? "만든 프롬프트 · 그림 파일에서 읽음" : "만든 프롬프트") + `</div></article>`;
    }).join("");
    body.push(`<section class="sec" id="${T}-refs" data-spy><h2>레퍼런스 <span class="cnt">${tab.refs.length}</span></h2><div class="refs">${cards}</div></section>`);
    toc.push(`<a href="#${T}-refs">레퍼런스 <span class="cnt">${tab.refs.length}</span></a>`);
  }

  if (tab.cuts.length) {
    const parts = [];
    let group = null;
    let gi = 0;
    toc.push(`<a href="#${T}-cuts">컷 <span class="cnt">${tab.cuts.length}</span></a>`);
    for (const c of tab.cuts) {
      if (c.group && c.group !== group) {
        group = c.group; gi++;
        parts.push(`<h3 class="grp" id="${T}-g-${gi}" data-spy>${h(group)}</h3>`);
        toc.push(`<a class="g" href="#${T}-g-${gi}">${h(group)}</a>`);
      }
      const cid = `${T}-c-${c.id}`;
      const fl = flowOf(c);
      const chips = fl.tags.map((t) => `<span class="chip flow">${h(t)}</span>`).join("") + settingChips(c.settings).map(chipHtml).join("");
      const refs = c.refs.map(refChip).join("");
      const capBase = [c.label, c.title].filter(Boolean).join(" ");
      // I2V: 영상 앞 단계 — 첫·끝 프레임 그림과 그걸 만든 이미지 프롬프트
      const frames = c.frames.length ? `<div class="frames">` + c.frames.map((f, fi) => {
        const fchips = settingChips(f.settings).map(chipHtml).join("") + f.refs.map(refChip).join("");
        const tiles = f.results.map((m) => mediaTile(m, m.adopted ? "pick" : "", "", `${capBase} · ${f.role}`)).join("");
        return `<div class="frame"><div class="fr-h"><span class="fr-role">${h(f.role)}</span>${f.title ? `<span class="fr-t">${h(f.title)}</span>` : ""}</div>` +
          (fchips ? `<div class="chips">${fchips}</div>` : "") + (tiles ? `<div class="media">${tiles}</div>` : "") +
          promptBlock(`${cid}-f${fi}`, f.prompt, f.prompt_ko, f.auto ? "이미지 프롬프트 · 그림 파일에서 읽음" : "이미지 프롬프트") +
          (f.note ? `<p class="fr-note">${h(f.note)}</p>` : "") + `</div>`;
      }).join("") + `</div>` : "";
      const media = [...c.finals.map((m) => mediaTile(m, "final", "", capBase)), ...c.results.map((m) => mediaTile(m, m.adopted ? "pick" : "", "", capBase))].join("");
      const stage = c.frames.length && (media || c.prompt) ? `<div class="stage-h">영상</div>` : "";
      const text = [c.label, c.title, c.summary, c.group, c.prompt, c.prompt_ko, ...c.notes, ...c.refs.map((x) => x.name),
        ...c.frames.flatMap((f) => [f.role, f.title, f.prompt, f.prompt_ko])].join(" ").toLowerCase();
      parts.push(`<article class="cut" id="${cid}" data-spy data-text="${h(text)}">` +
        `<div class="cut-h"><input type="checkbox" class="done-cb" aria-label="${h(c.label)} 완료 표시" title="완료 표시 — 이 브라우저에 남음">` +
        `<span class="cid">${h(c.label)}</span><div class="cut-t"><h4>${h(c.title || c.label)}</h4>${c.summary ? `<p class="sum">${h(c.summary)}</p>` : ""}</div></div>` +
        (chips || refs ? `<div class="chips">${chips}${refs}</div>` : "") +
        frames + stage +
        (media ? `<div class="media">${media}</div>` : "") +
        promptBlock(`${cid}-p`, c.prompt, c.prompt_ko, c.frames.length ? "영상 프롬프트" : c.auto ? "프롬프트 · 그림 파일에서 읽음" : "프롬프트") +
        (c.notes.length ? `<ul class="cnotes">${c.notes.map((n) => `<li>${h(n)}</li>`).join("")}</ul>` : "") +
        (c.memo.length ? `<details class="memo"><summary>메모 ${c.memo.length}</summary>${c.memo.map((n) => `<p>${h(n)}</p>`).join("")}</details>` : "") +
        `</article>`);
      toc.push(`<a class="c" href="#${cid}">${h(c.label)}${c.title ? ` <span>${h(c.title)}</span>` : ""}</a>`);
      const thumb = [...c.finals, ...c.results.filter((r) => r.adopted), ...c.results][0];
      let img = "";
      if (thumb) {
        const pp = thumb.poster ? publish(thumb.poster) : null;
        const p = publish(thumb);
        const src = pp && !pp.missing ? pp.href : p && !p.missing && p.kind === "image" ? p.href : "";
        if (src) img = `<img src="${src}" alt="" loading="lazy" draggable="false">`;
        else if (p && !p.missing && p.kind === "video") img = `<video src="${p.href}#t=0.1" preload="metadata" muted playsinline tabindex="-1"></video>`;
      }
      if (!img) {
        const fr = c.frames.map((f) => f.results.find((m) => m.adopted) || f.results[0]).find(Boolean);
        const p = fr ? publish(fr) : null;
        if (p && !p.missing && p.kind === "image") img = `<img src="${p.href}" alt="" loading="lazy" draggable="false">`;
      }
      strip.push(`<button type="button" class="st${img ? "" : " ph"}" data-go="${cid}" title="${h(capBase)}">${img}<span class="n">${h(c.label)}</span><span class="t">${h(c.title)}</span></button>`);
    }
    body.push(`<section class="sec" id="${T}-cuts" data-spy><h2>컷 <span class="cnt">${tab.cuts.length}</span></h2>${parts.join("")}</section>`);
  }

  return {
    tabBtn: multi ? `<button type="button" class="tab" role="tab" data-tab="${T}" aria-controls="t-${T}" aria-selected="false" tabindex="-1"><b>${h(tab.title)}</b>${tab.sub ? `<span>${h(tab.sub)}</span>` : ""}</button>` : "",
    panel: `<section class="tabpanel" id="t-${T}" role="${multi ? "tabpanel" : "region"}" aria-label="${h(tab.title)}" hidden>${body.join("")}</section>`,
    toc: `<nav class="toc-list" data-tab="${T}" aria-label="${h(tab.title)} 목차" hidden>${toc.join("")}</nav>`,
    strip: tab.cuts.length >= 2 ? `<div class="strip" data-tab="${T}" role="toolbar" aria-label="컷 스트립 — 누르면 이동, 끌면 훑어보기" hidden>${strip.join("")}</div>` : "",
  };
}

const CSS = `
:root{--bg:#0f1012;--panel:#17181b;--panel2:#1d1f23;--panel3:#25272c;--line:#2d3037;--text:#ececef;--dim:#a4a7b1;--faint:#71747e;
--accent:#e2aa58;--accent-ink:#1b1306;--accent-soft:rgba(226,170,88,.15);--ok:#52d18d;--ok-ink:#06210f;--ok-soft:rgba(82,209,141,.15);--blue:#86a9ff;
--font:"Pretendard GOV","Pretendard","Pretendard Variable","Malgun Gothic","Apple SD Gothic Neo",system-ui,sans-serif;
--mono:"D2Coding","JetBrains Mono",Consolas,"SF Mono",Menlo,monospace;--hdr:150px;color-scheme:dark}
:root[data-theme=light]{--bg:#f5f5f2;--panel:#ffffff;--panel2:#f2f2ee;--panel3:#e9e9e4;--line:#d9d9d2;--text:#1b1c1f;--dim:#585b63;--faint:#878a92;
--accent:#9a5b08;--accent-ink:#ffffff;--accent-soft:rgba(154,91,8,.11);--ok:#137a45;--ok-ink:#ffffff;--ok-soft:rgba(19,122,69,.11);--blue:#2453e6;color-scheme:light}
*{box-sizing:border-box}
[hidden]{display:none!important}
html{scroll-behavior:auto}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font);font-size:15px;line-height:1.6;word-break:keep-all;overflow-wrap:break-word;-webkit-font-smoothing:antialiased}
button{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.skip{position:absolute;left:-999px;top:8px;z-index:99;background:var(--accent);color:var(--accent-ink);padding:6px 12px;border-radius:6px}
.skip:focus{left:8px}
header.top{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--bg) 93%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.top-in{max-width:1440px;margin:0 auto;padding:12px 24px 8px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.ttl{min-width:0;flex:1 1 360px}
h1{font-size:20px;line-height:1.3;margin:0;letter-spacing:-.01em}
.subt{color:var(--dim);font-size:12.5px;margin:2px 0 0}
.tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.tools input{background:var(--panel2);border:1px solid var(--line);color:var(--text);border-radius:8px;padding:6px 10px;width:170px;font:inherit;font-size:13px}
.qn{font-size:12px;color:var(--dim);min-width:2em}
.prog{font-size:12px;color:var(--dim);font-variant-numeric:tabular-nums}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.seg button,.tbtn{background:transparent;border:0;color:var(--dim);padding:6px 11px;font-size:12px;cursor:pointer}
.seg button[aria-pressed=true]{background:var(--accent);color:var(--accent-ink);font-weight:700}
.tbtn{border:1px solid var(--line);border-radius:8px}
.tbtn:hover,.seg button:hover{color:var(--text)}
#tocbtn{display:none}
.tabs{max-width:1440px;margin:0 auto;padding:2px 24px 0;display:flex;gap:6px;overflow-x:auto}
.tab{display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:7px 14px 6px;border:1px solid var(--line);border-bottom:0;border-radius:9px 9px 0 0;background:transparent;color:var(--dim);cursor:pointer;white-space:nowrap}
.tab b{font-size:14px}
.tab span{font-size:11px;opacity:.75}
.tab[aria-selected=true]{color:var(--text);border-color:var(--accent);box-shadow:inset 0 2px 0 var(--accent);background:var(--panel)}
.strip{max-width:1440px;margin:0 auto;padding:8px 24px 10px;display:flex;gap:8px;overflow-x:auto;scrollbar-width:thin;cursor:grab;user-select:none;-webkit-user-select:none;touch-action:pan-y}
.strip.drag{cursor:grabbing}
.st{flex:none;width:118px;padding:0;border:1px solid var(--line);border-radius:8px;background:var(--panel2);overflow:hidden;cursor:inherit;position:relative;text-align:left;color:var(--dim)}
.st img,.st video{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:#000;pointer-events:none}
.st.ph::before{content:"";display:block;aspect-ratio:16/9;background:var(--panel3)}
.st .n{position:absolute;left:6px;top:4px;font-size:11.5px;font-weight:800;color:#fff;text-shadow:0 1px 3px #000,0 0 6px #000}
.st .t{display:block;font-size:11px;padding:3px 7px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.st[aria-current=true]{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft);color:var(--text)}
.st.done .n::after{content:" ✓";color:var(--ok)}
.layout{max-width:1440px;margin:0 auto;padding:22px 24px 120px;display:grid;grid-template-columns:230px minmax(0,1fr);gap:30px}
.toc{position:sticky;top:calc(var(--hdr) + 14px);align-self:start;max-height:calc(100vh - var(--hdr) - 28px);overflow:auto;font-size:13px;padding-bottom:20px}
.toc a{display:block;padding:4px 10px;border-left:2px solid var(--line);color:var(--dim);text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.toc a:hover{color:var(--text)}
.toc a.g{margin-top:6px;padding-left:16px;font-weight:700;color:var(--text)}
.toc a.c{padding-left:26px;font-family:var(--mono);font-size:12px}
.toc a.c span{font-family:var(--font);color:var(--faint)}
.toc a.done{color:var(--ok)}
.toc a[aria-current=true]{color:var(--text);border-left-color:var(--accent);background:var(--accent-soft)}
.cnt{font-size:.8em;color:var(--faint);font-weight:400}
main{min-width:0}
.sec{scroll-margin-top:calc(var(--hdr) + 14px)}
h2{font-size:14px;letter-spacing:.06em;color:var(--accent);margin:34px 0 14px;padding-bottom:8px;border-bottom:1px solid var(--line)}
.sec:first-child h2{margin-top:4px}
.grp{font-size:16px;margin:30px 0 12px;padding:6px 0 6px 12px;border-left:3px solid var(--accent);scroll-margin-top:calc(var(--hdr) + 14px)}
.stats{margin:0 0 10px;color:var(--dim);font-variant-numeric:tabular-nums}
.notes{margin:0 0 14px;padding-left:20px;color:var(--text)}
.notes li{margin:3px 0}
.howto,.small{font-size:12.5px;color:var(--faint);margin:10px 0 0}
.tl{display:flex;gap:2px;margin:14px 0 4px;height:52px;border-radius:8px;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin}
.tl-s{flex-basis:0;min-width:46px;border:0;background:var(--panel3);color:var(--dim);cursor:pointer;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:4px 7px;overflow:hidden;text-align:left}
.tl-s:nth-child(odd){background:var(--panel2)}
.tl-s b{font-size:11.5px;color:var(--accent);font-family:var(--mono);white-space:nowrap}
.tl-s span{font-size:10.5px;white-space:nowrap}
.tl-s:hover{background:var(--accent-soft);color:var(--text)}
.refs{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.ref{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;scroll-margin-top:calc(var(--hdr) + 14px)}
.ref-imgs{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;background:var(--line)}
.ref-imgs .m{border:0;border-radius:0}
.ref-imgs .main{grid-column:1/-1}
.ref-imgs .main img{aspect-ratio:16/10;object-fit:cover;max-height:none}
.ref-imgs .sub img{aspect-ratio:1/1;object-fit:cover}
.ref-imgs .m .cap{display:none}
.ref-b{padding:12px 14px 14px;display:flex;flex-direction:column;gap:7px}
.ref-n{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.at{font-weight:700;color:var(--accent)}
.cat{font-size:11px;color:var(--dim);border:1px solid var(--line);border-radius:5px;padding:0 6px}
.ref-role{margin:0;color:var(--dim);font-size:13.5px}
.ref-used{display:flex;flex-wrap:wrap;gap:5px;align-items:center;font-size:12px;color:var(--faint)}
.ref-used>span{margin-right:2px}
.cut{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px 18px 18px;margin:0 0 16px;scroll-margin-top:calc(var(--hdr) + 14px)}
.cut.flash{animation:flash 1.4s ease-out}
@keyframes flash{0%{box-shadow:0 0 0 0 var(--accent);border-color:var(--accent)}100%{box-shadow:0 0 0 12px transparent}}
.cut-h{display:flex;gap:12px;align-items:flex-start}
.done-cb{width:19px;height:19px;margin:4px 0 0;accent-color:var(--ok);cursor:pointer;flex:none}
.cid{font-family:var(--mono);font-weight:800;color:var(--accent);font-size:15px;min-width:58px;padding-top:2px}
.cut-t{min-width:0;flex:1}
.cut-t h4{margin:0;font-size:17px;line-height:1.4}
.sum{margin:3px 0 0;color:var(--dim);font-size:14px}
.cut.done .cut-t h4{color:var(--dim);text-decoration:line-through;text-decoration-color:var(--faint)}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0 31px}
.chip{font-size:11.5px;color:var(--dim);background:var(--panel3);border:1px solid var(--line);border-radius:6px;padding:2px 8px;white-space:nowrap}
.chip.ref{color:var(--accent);background:transparent}
.chip.flow{color:var(--blue);background:transparent;border-color:var(--blue);font-weight:700}
.flowline{margin:-4px 0 12px;color:var(--text);font-size:14px}
.flowline span{color:var(--faint);margin-right:8px}
.frames{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin:14px 0 0 31px}
.frame{border:1px solid var(--line);border-radius:10px;padding:10px 12px 12px;background:var(--panel2);min-width:0}
.fr-h{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.fr-role{font-weight:800;color:var(--blue);font-size:13px;letter-spacing:.04em}
.fr-t{color:var(--dim);font-size:13px}
.frame .chips,.frame .media,.frame .pr{margin-left:0}
.frame .media{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.frame .pr{background:var(--panel)}
.fr-note{margin:8px 0 0;font-size:12.5px;color:var(--faint)}
.stage-h{display:flex;align-items:center;gap:10px;margin:18px 0 0 31px;font-size:12px;font-weight:700;letter-spacing:.1em;color:var(--faint)}
.stage-h::before{content:"↓";color:var(--blue);font-size:14px}
.stage-h::after{content:"";flex:1;height:1px;background:var(--line)}
button.chip{cursor:pointer}
button.chip:hover{border-color:var(--accent);color:var(--text)}
.media{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;margin:14px 0 0 31px}
.m{position:relative;display:flex;flex-direction:column;padding:0;border:1px solid var(--line);border-radius:9px;overflow:hidden;background:#000;cursor:zoom-in;text-align:left}
.m img,.m video{width:100%;height:auto;display:block;aspect-ratio:16/9;object-fit:contain;background:#000}
.m .cap{display:flex;gap:6px;align-items:center;font-size:11.5px;padding:5px 8px;background:var(--panel2);color:var(--dim);white-space:nowrap;overflow:hidden}
.m .cap span{overflow:hidden;text-overflow:ellipsis}
.m .mnote{font-size:11.5px;padding:0 8px 6px;background:var(--panel2);color:var(--faint);white-space:normal}
.m.pick{border-color:var(--ok)}
.m.final{border-color:var(--accent)}
.m:hover{border-color:var(--text)}
.m.missing{cursor:default;align-items:center;justify-content:center;min-height:110px;background:var(--panel2);border-style:dashed;color:var(--faint);font-size:12px}
.m .file{padding:24px 10px;color:var(--dim);font-size:12px}
.badge{font-size:10.5px;font-weight:800;border-radius:4px;padding:1px 6px;flex:none}
.badge.pick{background:var(--ok);color:var(--ok-ink)}
.badge.final{background:var(--accent);color:var(--accent-ink)}
.play{position:absolute;left:50%;top:calc(50% - 14px);width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(0,0,0,.55);border:2px solid rgba(255,255,255,.85);pointer-events:none}
.play::after{content:"";position:absolute;left:16px;top:11px;border-left:14px solid #fff;border-top:9px solid transparent;border-bottom:9px solid transparent}
.pr{margin:14px 0 0 31px;border:1px solid var(--line);border-radius:9px;overflow:hidden;background:var(--panel2);position:relative}
.ref .pr{margin:4px 0 0}
.sec>.pr{margin-left:0}
.pr-h{display:flex;align-items:center;gap:8px;padding:6px 10px 6px 14px;border-bottom:1px solid var(--line);font-size:12px;color:var(--dim)}
.pr-t{margin-right:auto;letter-spacing:.04em}
.cp,.more{background:transparent;border:1px solid var(--line);border-radius:6px;padding:3px 10px;font-size:11.5px;color:var(--accent);cursor:pointer;white-space:nowrap}
.more{color:var(--dim)}
.cp:hover,.more:hover{border-color:var(--accent)}
.cp.ok{color:var(--ok);border-color:var(--ok)}
.panes{display:grid;grid-template-columns:1fr}
.pr.both .panes{grid-template-columns:1fr 1fr}
.pane{min-width:0;position:relative}
.pr.both .pane+.pane{border-left:1px solid var(--line)}
.tag{display:block;font-size:10px;font-weight:700;letter-spacing:.14em;color:var(--faint);padding:7px 14px 0}
.pane pre{margin:0;padding:4px 14px 14px;font-family:var(--mono);font-size:12.5px;line-height:1.65;white-space:pre-wrap;word-break:break-word;max-height:320px;overflow:auto}
.pane.ko pre{font-family:var(--font);font-size:13.5px}
.pr.open .pane pre{max-height:none}
body[data-lang=en] .pane.ko,body[data-lang=en] .cp[data-copy$="-ko"]{display:none}
body[data-lang=ko] .pane.en,body[data-lang=ko] .cp[data-copy$="-en"]{display:none}
body[data-lang=en] .pr.both .panes,body[data-lang=ko] .pr.both .panes{grid-template-columns:1fr}
body[data-lang=en] .pr.both .pane+.pane,body[data-lang=ko] .pr.both .pane+.pane{border-left:0}
.src{position:absolute;left:-9999px;top:0;width:1px;height:1px;opacity:0}
.cnotes{margin:12px 0 0 31px;padding:9px 14px 9px 30px;border-left:3px solid var(--accent);background:var(--panel2);border-radius:0 8px 8px 0;font-size:13.5px;color:var(--dim)}
.memo{margin:10px 0 0 31px;font-size:13px;color:var(--dim)}
.ref .memo{margin:0}
.memo summary{cursor:pointer;color:var(--blue);font-size:12.5px}
.memo p{margin:6px 0 0;white-space:pre-wrap}
.lb{position:fixed;inset:0;z-index:80;background:rgba(5,5,7,.92);display:grid;grid-template-rows:auto minmax(0,1fr)}
.lb[hidden]{display:none}
.lb-top{display:flex;align-items:center;gap:14px;padding:10px 16px;color:#e6e6ea;font-size:13px}
.lb-cap{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lb-i{color:#9a9aa3;font-variant-numeric:tabular-nums}
.lb-x{background:transparent;border:1px solid #555;color:#eee;border-radius:7px;padding:5px 12px;cursor:pointer}
.lb-stage{display:flex;align-items:center;justify-content:center;padding:0 70px 20px;min-height:0}
.lb-stage img,.lb-stage video{max-width:100%;max-height:100%;object-fit:contain;box-shadow:0 10px 40px rgba(0,0,0,.6)}
.lb-stage a{color:#eee}
.lb-nav{position:absolute;top:50%;width:48px;height:72px;margin-top:-36px;border:0;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;font-size:30px;cursor:pointer}
.lb-nav:hover{background:rgba(255,255,255,.18)}
.lb-nav.prev{left:12px}
.lb-nav.next{right:12px}
body.lb-on{overflow:hidden}
.totop{position:fixed;right:18px;bottom:20px;z-index:40;background:var(--panel2);color:var(--accent);border:1px solid var(--accent);border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .2s}
.totop.show{opacity:1;pointer-events:auto}
footer{max-width:1440px;margin:0 auto;padding:0 24px 40px;color:var(--faint);font-size:12px}
@media (max-width:1100px){
  .layout{grid-template-columns:minmax(0,1fr)}
  #tocbtn{display:inline-block}
  .toc{display:none;position:fixed;left:0;top:var(--hdr);bottom:0;z-index:50;width:min(300px,86vw);max-height:none;background:var(--panel);border-right:1px solid var(--line);padding:14px 10px 30px;box-shadow:10px 0 30px rgba(0,0,0,.35)}
  .toc.open{display:block}
}
@media (max-width:720px){
  .top-in,.strip,.tabs,.layout,footer{padding-left:16px;padding-right:16px}
  .top-in{gap:8px 10px;padding-top:8px}
  .ttl{flex:1 1 160px}
  h1{font-size:17px}
  .subt{display:none}
  .tools{width:100%}
  .tools input{flex:1;min-width:0;width:auto}
  .strip{padding-top:6px;padding-bottom:8px}
  .st{width:92px}
  .st .t{display:none}
  .pr.both .panes{grid-template-columns:1fr}
  .pr.both .pane+.pane{border-left:0;border-top:1px solid var(--line)}
  .chips,.media,.pr,.cnotes,.memo,.frames,.stage-h{margin-left:0}
  .frames{grid-template-columns:1fr}
  .lb-stage{padding:0 8px 16px}
  .lb-nav{display:none}
}
@media (prefers-reduced-motion:reduce){.cut.flash{animation:none}.totop{transition:none}}
`;

const JS = `
(function(){
var D=document,R=D.documentElement,B=D.body,BOOK=B.getAttribute('data-book')||'book';
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function store(k,v){try{if(v===undefined)return localStorage.getItem('pb:'+BOOK+':'+k);localStorage.setItem('pb:'+BOOK+':'+k,v);}catch(e){return null;}}
function $(s,el){return (el||D).querySelector(s);}
function $$(s,el){return Array.prototype.slice.call((el||D).querySelectorAll(s));}
var hdr=$('header.top'),tab=null,scrubbing=false,toc=$('#toc'),tocBtn=$('#tocbtn');
function hh(){return hdr?hdr.offsetHeight:0;}
function setHdr(){R.style.setProperty('--hdr',hh()+'px');}

var themeBtn=$('#theme');
function setTheme(t){R.setAttribute('data-theme',t);if(themeBtn){themeBtn.textContent=t==='light'?'어둡게':'밝게';}store('theme',t);}
setTheme(store('theme')||'dark');
if(themeBtn)themeBtn.addEventListener('click',function(){setTheme(R.getAttribute('data-theme')==='light'?'dark':'light');});

var langBtns=$$('.seg [data-lang]');
function setLang(l){B.setAttribute('data-lang',l);langBtns.forEach(function(b){b.setAttribute('aria-pressed',b.getAttribute('data-lang')===l?'true':'false');});store('lang',l);}
if(langBtns.length){setLang(store('lang')||'both');langBtns.forEach(function(b){b.addEventListener('click',function(){setLang(b.getAttribute('data-lang'));});});}

function panel(){return D.getElementById('t-'+tab);}
function setTab(id,keep){
  var p=D.getElementById('t-'+id);if(!p)return;tab=id;
  $$('.tabpanel').forEach(function(x){x.hidden=x!==p;});
  $$('.tab').forEach(function(b){var on=b.getAttribute('data-tab')===id;b.setAttribute('aria-selected',on?'true':'false');b.tabIndex=on?0:-1;});
  $$('.strip').forEach(function(s){s.hidden=s.getAttribute('data-tab')!==id;});
  $$('.toc-list').forEach(function(n){n.hidden=n.getAttribute('data-tab')!==id;});
  store('tab',id);setHdr();progress();search();if(!keep)window.scrollTo(0,0);spy();
}
$$('.tab').forEach(function(b,i,all){
  b.addEventListener('click',function(){setTab(b.getAttribute('data-tab'));});
  b.addEventListener('keydown',function(e){if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;e.preventDefault();e.stopPropagation();
    var n=all[(i+(e.key==='ArrowRight'?1:all.length-1))%all.length];n.focus();setTab(n.getAttribute('data-tab'));});
});
function closeToc(){if(toc&&toc.classList.contains('open')){toc.classList.remove('open');if(tocBtn)tocBtn.setAttribute('aria-expanded','false');}}
if(tocBtn)tocBtn.addEventListener('click',function(){var o=!toc.classList.contains('open');toc.classList.toggle('open',o);tocBtn.setAttribute('aria-expanded',o?'true':'false');});

function go(id,smooth){
  var el=D.getElementById(id);if(!el)return;
  var tp=el.closest('.tabpanel');if(tp&&tp.hidden)setTab(tp.id.slice(2),true);
  var far=Math.abs(el.getBoundingClientRect().top-hh())>window.innerHeight*2.5;
  el.scrollIntoView({behavior:smooth&&!reduce&&!far?'smooth':'auto',block:'start'});
  if(el.classList.contains('cut')){el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');}
  closeToc();
}
D.addEventListener('click',function(e){
  var a=e.target.closest('a[href^="#"]');
  if(a){var id=a.getAttribute('href').slice(1);if(D.getElementById(id)){e.preventDefault();go(id,true);}return;}
  var g=e.target.closest('[data-go]');
  if(g&&!g.classList.contains('st'))go(g.getAttribute('data-go'),true);
  var mo=e.target.closest('.more');
  if(mo){var pr=mo.closest('.pr'),o=pr.classList.toggle('open');mo.textContent=o?'접기':'전체 보기';mo.setAttribute('aria-expanded',o?'true':'false');}
  var cb=e.target.closest('[data-copy]');
  if(cb)copy(cb);
});

function copy(b){
  var src=D.getElementById(b.getAttribute('data-copy'));if(!src)return;
  var label=b.getAttribute('data-label')||b.textContent;b.setAttribute('data-label',label);
  function ok(){b.classList.add('ok');b.textContent='복사됨';setTimeout(function(){b.classList.remove('ok');b.textContent=label;},1400);}
  function fb(){try{src.select();D.execCommand('copy');ok();}catch(er){b.textContent='복사 안 됨';}}
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(src.value).then(ok,fb);else fb();
}

function mark(id){
  var strip=$('.strip[data-tab="'+tab+'"]');if(!strip)return;
  $$('.st',strip).forEach(function(s){
    var on=s.getAttribute('data-go')===id;s.setAttribute('aria-current',on?'true':'false');
    if(on&&!scrubbing){var sr=strip.getBoundingClientRect(),r=s.getBoundingClientRect();
      if(r.left<sr.left+24||r.right>sr.right-24)strip.scrollLeft+=(r.left-sr.left)-(sr.width-r.width)/2;}
  });
}
var queued=false;
function spy(){
  queued=false;var p=panel();if(!p)return;
  var line=hh()+40,cur=null,items=$$('[data-spy]',p);
  for(var i=0;i<items.length;i++){var el=items[i];if(el.offsetParent===null)continue;if(el.getBoundingClientRect().top<=line)cur=el;else break;}
  if(!cur){for(var k=0;k<items.length;k++)if(items[k].offsetParent!==null){cur=items[k];break;}}
  var atEnd=window.innerHeight+window.scrollY>=D.documentElement.scrollHeight-4;
  if(atEnd){for(var z=items.length-1;z>=0;z--)if(items[z].offsetParent!==null&&items[z].getBoundingClientRect().top<window.innerHeight*0.6){cur=items[z];break;}}
  var nav=$('.toc-list[data-tab="'+tab+'"]');
  if(nav){var curA=null;$$('a',nav).forEach(function(a){var on=!!cur&&a.getAttribute('href')==='#'+cur.id;a.setAttribute('aria-current',on?'true':'false');if(on)curA=a;});
    if(curA&&toc&&!toc.classList.contains('open')){var tr=toc.getBoundingClientRect(),ar=curA.getBoundingClientRect();if(ar.top<tr.top||ar.bottom>tr.bottom)toc.scrollTop+=ar.top-tr.top-tr.height/3;}}
  var cc=null;$$('.cut',p).forEach(function(c){if(cc||c.hidden)return;var r=c.getBoundingClientRect();if(r.top<=line&&r.bottom>line)cc=c;});
  if(atEnd&&cur&&cur.classList.contains('cut'))cc=cur;
  mark(cc?cc.id:null);
  var tt=$('#totop');if(tt)tt.classList.toggle('show',window.scrollY>600);
}
window.addEventListener('scroll',function(){if(!queued){queued=true;requestAnimationFrame(spy);}},{passive:true});
window.addEventListener('resize',function(){setHdr();spy();});

$$('.strip').forEach(function(strip){
  var down=false,drag=false,x0=0,last=null,suppress=false;
  strip.addEventListener('pointerdown',function(e){if(e.button!==0)return;down=true;drag=false;x0=e.clientX;last=null;});
  strip.addEventListener('pointermove',function(e){
    if(!down)return;
    if(!drag&&Math.abs(e.clientX-x0)>6){drag=true;scrubbing=true;strip.classList.add('drag');try{strip.setPointerCapture(e.pointerId);}catch(er){}}
    if(!drag)return;
    var r=strip.getBoundingClientRect();
    if(e.clientX<r.left+48)strip.scrollLeft-=16;else if(e.clientX>r.right-48)strip.scrollLeft+=16;
    var el=D.elementFromPoint(Math.max(r.left+2,Math.min(r.right-2,e.clientX)),r.top+r.height/2);
    var it=el&&el.closest?el.closest('.st'):null;
    if(it&&it!==last&&!it.hidden){last=it;go(it.getAttribute('data-go'),false);mark(it.getAttribute('data-go'));}
  });
  function end(){if(drag)suppress=true;down=false;drag=false;scrubbing=false;strip.classList.remove('drag');}
  strip.addEventListener('pointerup',end);strip.addEventListener('pointercancel',end);
  strip.addEventListener('click',function(e){if(suppress){suppress=false;e.preventDefault();return;}var it=e.target.closest('.st');if(it)go(it.getAttribute('data-go'),true);});
  strip.addEventListener('wheel',function(e){if(Math.abs(e.deltaY)>Math.abs(e.deltaX)&&strip.scrollWidth>strip.clientWidth){strip.scrollLeft+=e.deltaY;e.preventDefault();}},{passive:false});
});

var q=$('#q'),qn=$('#qn');
function search(){
  var p=panel();if(!p||!q)return;
  var v=q.value.trim().toLowerCase(),n=0,tot=0;
  $$('.cut',p).forEach(function(c){tot++;var hit=!v||(c.getAttribute('data-text')||'').indexOf(v)>=0;c.hidden=!hit;if(hit)n++;
    var st=$('.st[data-go="'+c.id+'"]');if(st)st.hidden=!hit;var a=$('.toc-list a[href="#'+c.id+'"]');if(a)a.hidden=!hit;});
  $$('.grp',p).forEach(function(g){var any=false,el=g.nextElementSibling;while(el&&!el.classList.contains('grp')){if(el.classList.contains('cut')&&!el.hidden)any=true;el=el.nextElementSibling;}
    g.hidden=!any;var ga=$('.toc-list a[href="#'+g.id+'"]');if(ga)ga.hidden=!any;});
  if(qn)qn.textContent=v?n+'/'+tot:'';
}
if(q){q.addEventListener('input',function(){search();spy();});q.addEventListener('keydown',function(e){if(e.key==='Escape'){q.value='';search();spy();q.blur();}});}

function progress(){
  var p=panel(),pg=$('#prog');if(!p||!pg)return;
  var all=$$('.cut',p),done=all.filter(function(c){return c.classList.contains('done');}).length;
  pg.textContent=all.length?'완료 '+done+'/'+all.length:'';
}
$$('.cut .done-cb').forEach(function(cb){
  var cut=cb.closest('.cut'),k='done:'+cut.id;
  function apply(on){cut.classList.toggle('done',on);var st=$('.st[data-go="'+cut.id+'"]');if(st)st.classList.toggle('done',on);
    var a=$('.toc-list a[href="#'+cut.id+'"]');if(a)a.classList.toggle('done',on);}
  cb.checked=store(k)==='1';apply(cb.checked);
  cb.addEventListener('change',function(){store(k,cb.checked?'1':'0');apply(cb.checked);progress();});
});

var lb=$('#lb'),stage=$('#lbstage'),cap=$('#lbcap'),cnt=$('#lbi'),list=[],at=0,back=null;
function lbOn(){return lb&&!lb.hidden;}
function show(i){
  at=(i+list.length)%list.length;var it=list[at],kind=it.getAttribute('data-kind'),src=it.getAttribute('data-src'),el;
  var old=stage.querySelector('video');if(old)old.pause();stage.innerHTML='';
  if(kind==='video'){el=D.createElement('video');el.controls=true;el.autoplay=true;el.playsInline=true;var po=it.getAttribute('data-poster');if(po)el.poster=po;el.src=src;}
  else if(kind==='image'){el=D.createElement('img');el.alt=it.getAttribute('data-cap')||'';el.src=src;}
  else{el=D.createElement('a');el.textContent='파일 열기';el.href=src;el.target='_blank';}
  stage.appendChild(el);cap.textContent=it.getAttribute('data-cap')||'';cnt.textContent=(at+1)+' / '+list.length;
}
function openLb(b){var p=b.closest('.cut,.ref')||b.closest('.tabpanel')||D;list=$$('[data-lb]',p).filter(function(x){return !x.closest('[hidden]');});
  if(!list.length)return;back=b;lb.hidden=false;B.classList.add('lb-on');show(Math.max(0,list.indexOf(b)));$('#lbx').focus();}
function closeLb(){var v=stage.querySelector('video');if(v)v.pause();stage.innerHTML='';lb.hidden=true;B.classList.remove('lb-on');if(back)back.focus();}
D.addEventListener('click',function(e){var b=e.target.closest('[data-lb]');if(b&&lb){e.preventDefault();openLb(b);}});
if(lb){
  $('#lbx').addEventListener('click',closeLb);
  $('#lbprev').addEventListener('click',function(){show(at-1);});
  $('#lbnext').addEventListener('click',function(){show(at+1);});
  lb.addEventListener('click',function(e){if(e.target===lb||e.target===stage)closeLb();});
}

D.addEventListener('keydown',function(e){
  if(lbOn()){if(e.key==='Escape')closeLb();else if(e.key==='ArrowLeft')show(at-1);else if(e.key==='ArrowRight')show(at+1);else if(e.key==='Tab'){e.preventDefault();$('#lbx').focus();}return;}
  if(e.key==='Escape'){closeToc();return;}
  var t=e.target,typing=t&&(t.tagName==='INPUT'&&t.type!=='checkbox'||t.tagName==='TEXTAREA'||t.isContentEditable);
  if(e.key==='/'&&!typing){if(q){e.preventDefault();q.focus();q.select();}return;}
  if(typing||e.altKey||e.ctrlKey||e.metaKey)return;
  if(t&&t.classList&&t.classList.contains('tab'))return;
  var fwd=e.key==='ArrowRight'||e.key==='j',bwd=e.key==='ArrowLeft'||e.key==='k';
  if(!fwd&&!bwd)return;
  var p=panel();if(!p)return;var cuts=$$('.cut',p).filter(function(c){return !c.hidden;});if(!cuts.length)return;
  var line=hh()+41,idx=-1;for(var i=0;i<cuts.length;i++)if(cuts[i].getBoundingClientRect().top<=line)idx=i;
  var nx=fwd?idx+1:idx-1;if(nx<0)nx=0;if(nx>=cuts.length)nx=cuts.length-1;
  e.preventDefault();go(cuts[nx].id,true);
});

var tt=$('#totop');if(tt)tt.addEventListener('click',function(){window.scrollTo({top:0,behavior:reduce?'auto':'smooth'});});

var firstTab=$('.tab')?$('.tab').getAttribute('data-tab'):($('.tabpanel')?$('.tabpanel').id.slice(2):null);
var hash=location.hash.slice(1),target=hash?D.getElementById(hash):null,saved=store('tab');
var start=target&&target.closest('.tabpanel')?target.closest('.tabpanel').id.slice(2):(saved&&D.getElementById('t-'+saved)?saved:firstTab);
if(start)setTab(start,true);
if(target)go(hash,false);
setHdr();setTimeout(function(){setHdr();spy();},300);
})();
`;

function render(book) {
  const multi = book.tabs.length > 1;
  const parts = book.tabs.map((t) => renderTab(book, t, multi));
  const hasKo = book.tabs.some((t) => t.cuts.some((c) => c.prompt && c.prompt_ko) || t.refs.some((r) => r.prompt && r.prompt_ko)) ||
    !!(book.style && book.style.en && book.style.ko);
  const data = Buffer.from(JSON.stringify(dataForRebuild(book)), "utf8").toString("base64");
  return `<!DOCTYPE html>
<html lang="ko" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="generator" content="freewill-studio make-prompt-book">
<title>${h(book.title)} · 프롬프트 북</title>
<style>${CSS}</style>
</head>
<body data-book="${h(crypto.createHash("sha1").update(book.id).digest("hex").slice(0, 10))}" data-lang="both">
<a class="skip" href="#main">본문으로</a>
<header class="top">
  <div class="top-in">
    <button type="button" class="tbtn" id="tocbtn" aria-controls="toc" aria-expanded="false">목차</button>
    <div class="ttl"><h1>${h(book.title)}</h1><p class="subt">${[book.subtitle, "프롬프트 북", madeAt].filter(Boolean).map(h).join(" · ")}</p></div>
    <div class="tools">
      <input type="search" id="q" placeholder="컷 찾기  /" aria-label="컷 찾기"><span class="qn" id="qn" aria-live="polite"></span>
      <span class="prog" id="prog"></span>
      ${hasKo ? `<div class="seg" role="group" aria-label="프롬프트 언어"><button type="button" data-lang="both">한·영</button><button type="button" data-lang="en">EN</button><button type="button" data-lang="ko">한글</button></div>` : ""}
      <button type="button" class="tbtn" id="theme">밝게</button>
    </div>
  </div>
  ${multi ? `<nav class="tabs" role="tablist" aria-label="편">${parts.map((p) => p.tabBtn).join("")}</nav>` : ""}
  ${parts.map((p) => p.strip).join("")}
</header>
<div class="layout">
  <aside class="toc" id="toc" aria-label="목차">${parts.map((p) => p.toc).join("")}</aside>
  <main id="main" tabindex="-1">${parts.map((p) => p.panel).join("")}</main>
</div>
<footer>프리윌 스튜디오 MCP · 프롬프트 북 · 고칠 곳은 대화창에 말하면 이 북이 그 자리에서 갱신됨</footer>
<button type="button" class="totop" id="totop">맨 위로</button>
<div class="lb" id="lb" hidden role="dialog" aria-modal="true" aria-label="크게 보기">
  <div class="lb-top"><span class="lb-cap" id="lbcap"></span><span class="lb-i" id="lbi"></span><button type="button" class="lb-x" id="lbx">닫기</button></div>
  <div class="lb-stage" id="lbstage"></div>
  <button type="button" class="lb-nav prev" id="lbprev" aria-label="이전">‹</button>
  <button type="button" class="lb-nav next" id="lbnext" aria-label="다음">›</button>
</div>
<script type="application/octet-stream" id="pb-data">${data}</script>
<script>${JS}</script>
</body>
</html>
`;
}

// 다시 만들 때 쓰는 데이터 — 그림·영상은 원래 자리(file)와 북에 건 자리(pub)를 같이 남긴다.
function dataForRebuild(book) {
  const m = (x) => {
    if (!x) return null;
    const p = published.get(path.isAbsolute(x.file) ? x.file : path.resolve(inDir, x.file));
    const abs = p ? p.src : path.isAbsolute(x.file) ? x.file : path.resolve(inDir, x.file);
    return { file: abs, pub: p && p.pub ? path.relative(outDir, path.resolve(outDir, p.pub)) : x.pub, poster: m(x.poster), label: x.label, note: x.note, adopted: x.adopted, kind: x.kind };
  };
  return {
    id: book.id, title: book.title, subtitle: book.subtitle, notes: book.notes, style: book.style,
    tabs: book.tabs.map((t) => ({
      id: t.id, title: t.title, sub: t.sub, notes: t.notes, style: t.style,
      refs: t.refs.map((r) => ({ id: r.key, name: r.name, category: r.category, element: r.element, model: r.model, role: r.role, note: r.note,
        prompt: r.prompt, prompt_ko: r.prompt_ko, auto: r.auto, images: r.images.map(m) })),
      cuts: t.cuts.map((c) => ({ id: c.label, title: c.title, summary: c.summary, group: c.group, flow: c.flow, settings: c.settings, duration: c.duration, refs: c.refs,
        frames: c.frames.map((f) => ({ role: f.role, title: f.title, prompt: f.prompt, prompt_ko: f.prompt_ko, settings: f.settings, refs: f.refs, results: f.results.map(m), note: f.note, auto: f.auto })),
        prompt: c.prompt, prompt_ko: c.prompt_ko, auto: c.auto, results: c.results.map(m), finals: c.finals.map(m), notes: c.notes, memo: c.memo })),
    })),
  };
}

// ---------- 실행 ----------
let src;
try { src = readInput(inAbs); } catch (e) { console.error(`읽지 못함: ${inAbs} — ${e.message}`); process.exit(1); }
const book = normBook(src);
autofill(book);
if (!book.tabs.some((t) => t.cuts.length || t.refs.length)) { console.error("컷도 레퍼런스도 없다 — book.json 의 cuts(또는 tabs[].cuts)를 채울 것"); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });
const html = render(book);
fs.writeFileSync(outAbs, html, "utf8");
const nCuts = book.tabs.reduce((a, t) => a + t.cuts.length, 0);
console.log(`북 저장: ${outAbs}`);
console.log(`탭 ${book.tabs.length} · 컷 ${nCuts} · 그림·영상 복사 ${stats.copied} · 그대로 ${stats.kept}${linkOnly ? ` · 원래 자리 ${stats.linked}` : ""}${stats.copied ? ` (→ ${filesName})` : ""}`);
if (stats.missing.length) console.log(`없는 파일 ${stats.missing.length}개 — 북에는 "파일 없음"으로 표시됨: ${[...new Set(stats.missing)].slice(0, 8).join(", ")}${stats.missing.length > 8 ? " …" : ""}`);
