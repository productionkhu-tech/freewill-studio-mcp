// 앱 코드에서 사내 고정 문서(references/app-rules.md)의 모델 표를 만든다 — 나노바나나 static/app.js 의 MODEL_SPECS ·
// SOTA_MODELS, 시댄스 src/store.ts 의 MODELS. sync.mjs 가 매일 불러 표시(<!-- AUTO:이름 --> … <!-- /AUTO:이름 -->) 사이를
// 다시 쓴다. 앱에 모델이 들어오면 그날 고정 문서도 따라간다(사용자 11/17 "이게 왜 자동으로 안 됐던 거임?" — 그 전엔
// 손으로 옮겨 적은 사본이라 시드림 5.5 · 시댄스 2.5 Flash · Omni 1.2 가 들어온 뒤에도 옛 표 그대로였다).
// 코드를 실행하지 않고 글로만 읽는다. 앱 코드 모양이 바뀌어 못 읽으면 예외를 던진다 — sync 가 알림으로 돌린다.

const cell = (s) => String(s ?? "—").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
// 앱 글에 든 달러 가격은 빼고 옮긴다 — 에이전트가 출력 · 확인 카드에 가격을 옮기지 않게(사용자 11/6 "달러 가격 금지")
const noPrice = (s) => String(s ?? "").replace(/\s*\([^()]*\$\d[^()]*\)/g, "").replace(/[^.。]*\$\d[^.。]*[.。]?\s*/g, "").trim();
const tick = (s) => `\`${s}\``;

// 문자열 · 주석을 건너뛰며 open 위치의 괄호와 짝인 닫는 괄호 위치
export function matchClose(t, open) {
  const close = { "{": "}", "[": "]", "(": ")" }, stack = [];
  for (let i = open; i < t.length; i++) {
    const c = t[i];
    if (c === "/" && t[i + 1] === "/") { i = t.indexOf("\n", i); if (i < 0) return -1; continue; }
    if (c === "/" && t[i + 1] === "*") { i = t.indexOf("*/", i + 2) + 1; if (i <= 0) return -1; continue; }
    if (c === "'" || c === '"' || c === "`") { for (i++; i < t.length && t[i] !== c; i++) if (t[i] === "\\") i++; continue; }
    if (close[c]) stack.push(close[c]);
    else if (c === "}" || c === "]" || c === ")") { if (stack.pop() !== c) return -1; if (!stack.length) return i; }
  }
  return -1;
}

// 값 하나가 끝나는 곳(맨 위의 , 또는 닫는 괄호). TS 의 `as Partial<Record<A, B>>` 같은 타입 표기 안 쉼표는 건너뛴다.
function valueEnd(t, i) {
  let inType = false, angle = 0;
  for (; i < t.length; i++) {
    const c = t[i];
    const as = !inType && /^\s+as\s/.exec(t.slice(i, i + 6));
    if (as) { inType = true; i += as[0].length - 1; continue; }
    if (inType && c === "<") { angle++; continue; }
    if (inType && c === ">") { angle--; continue; }
    if (angle > 0) continue;
    if (c === "/" && t[i + 1] === "/") { const n = t.indexOf("\n", i); if (n < 0) return t.length; i = n; continue; }
    if (c === "'" || c === '"' || c === "`") { for (i++; i < t.length && t[i] !== c; i++) if (t[i] === "\\") i++; continue; }
    if (c === "{" || c === "[" || c === "(") { i = matchClose(t, i); if (i < 0) return t.length; continue; }
    if (c === "," || c === "}" || c === "]") return i;
  }
  return i;
}

// 객체 글 "{ ... }" 의 맨 위 칸만 { 이름: 값 글 }, 펼침(...이름)은 spreads
export function topFields(obj) {
  const fields = {}, spreads = [];
  for (let i = 1; i < obj.length - 1;) {
    const c = obj[i];
    if (/[\s,]/.test(c)) { i++; continue; }
    if (c === "/" && obj[i + 1] === "/") { const n = obj.indexOf("\n", i); if (n < 0) break; i = n; continue; }
    if (c === "/" && obj[i + 1] === "*") { i = obj.indexOf("*/", i + 2) + 2; if (i < 2) break; continue; }
    if (obj.startsWith("...", i)) { const m = obj.slice(i + 3).match(/^[\w$.]+/); if (!m) break; spreads.push(m[0]); i += 3 + m[0].length; continue; }
    const k = obj.slice(i).match(/^(?:(["'])([^"']+)\1|([A-Za-z_$][\w$]*))\s*:\s*/);
    if (!k) break;
    i += k[0].length;
    const end = valueEnd(obj, i);
    fields[k[2] ?? k[3]] = obj.slice(i, end).trim();
    i = end;
  }
  return { fields, spreads };
}

// 배열 글 "[ ... ]" 맨 위의 객체들
function topObjects(arr) {
  const out = [];
  for (let i = 1; i < arr.length - 1; i++) {
    const c = arr[i];
    if (c === "/" && arr[i + 1] === "/") { i = arr.indexOf("\n", i); if (i < 0) break; continue; }
    if (c === "/" && arr[i + 1] === "*") { i = arr.indexOf("*/", i + 2) + 1; continue; }
    if (c === "{") { const e = matchClose(arr, i); if (e < 0) break; out.push(arr.slice(i, e + 1)); i = e; }
  }
  return out;
}

const strs = (v) => [...String(v ?? "").matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)].map((m) => (m[1] ?? m[2]).replace(/\\(.)/g, "$1"));
const str = (v) => (v === undefined ? undefined : strs(v)[0]);
const firstBracket = (v) => { const a = String(v ?? "").indexOf("["); if (a < 0) return ""; const e = matchClose(v, a); return e < 0 ? "" : v.slice(a, e + 1); };
const arr = (v) => strs(firstBracket(v));
const nums = (v) => [...firstBracket(v).matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
const num = (v) => (v === undefined || !/^-?\d/.test(v) ? undefined : Number(v));
const bool = (v) => v === "true";

// ---------------------------------------------------------------- 계열 SOTA — read-local-apps.mjs 와 같은 규칙
// 앱이 별표(SOTA_MODELS)를 단 모델이 먼저, 없으면 이름으로: 등급 표시 없는 것 · Pro 급끼리는 버전 먼저, 빠른 것 · 가벼운 것은 등급 먼저.
const FAMILIES = [["GPT Image", /^gpt-image/], ["Seedream", /seedream/], ["Seedance", /seedance/], ["Gemini Omni", /omni/], ["Nano Banana", /^gemini-.*image|nano-banana/]];
const familyOf = (id) => FAMILIES.find(([, re]) => re.test(id))?.[0] || id.split("-")[0];
const tierOf = (id) => (/(^|-)(lite|mini)(-|$)/.test(id) ? 0 : /(^|-)(flare|flash|fast|turbo)(-|$)/.test(id) ? 1 : /(^|-)(sunburst|pro|ultra)(-|$)/.test(id) ? 3 : 2);
const verNum = (id) => { const m = id.match(/(?<!\d)(\d{1,2})(?:[.-](\d{1,2})(?!\d))?(?!\d)/); return m ? Number(m[1]) + Number(m[2] || 0) / 100 : 0; };
const rankOf = (id) => (tierOf(id) >= 2 ? [1, verNum(id), tierOf(id)] : [0, tierOf(id), verNum(id)]);
const bestOf = (ids) => [...ids].sort((a, b) => { const x = rankOf(a), y = rankOf(b); return y[0] - x[0] || y[1] - x[1] || y[2] - x[2]; })[0];
export function sotaParts(ids, pinned = []) {
  const fams = new Map();
  for (const id of ids) fams.set(familyOf(id), [...(fams.get(familyOf(id)) || []), id]);
  return [...fams].map(([name, list]) => {
    const top = list.find((x) => pinned.includes(x)) || bestOf(list);
    const fast = tierOf(top) > 1 ? list.filter((x) => tierOf(x) === 1) : [], light = list.filter((x) => tierOf(x) === 0 && x !== top);
    const more = [fast.length ? `빠른 것 ${tick(bestOf(fast))}` : "", light.length ? `가장 가벼운 것 ${tick(bestOf(light))}` : ""].filter(Boolean);
    return `${name} ${tick(top)}${more.length ? `(${more.join(" · ")})` : ""}`;
  });
}

// ---------------------------------------------------------------- 나노바나나
export function readNanobanana(js) {
  const at = js.indexOf("{", js.indexOf("MODEL_SPECS"));
  const end = matchClose(js, at);
  if (at < 0 || end < 0) throw new Error("MODEL_SPECS 를 못 찾음");
  const models = Object.entries(topFields(js.slice(at, end + 1)).fields).map(([id, body]) => ({ id, ...topFields(body).fields }));
  if (!models.length) throw new Error("MODEL_SPECS 에 모델이 없음");
  const pinned = strs(js.match(/SOTA_MODELS\s*=\s*(\[[^\]]*\])/)?.[1]);
  return { models, pinned };
}

export function nanobananaTable({ models, pinned }) {
  const rows = models.map((m) => {
    const res = arr(m.resolutions), q = m.showQuality === "false" ? [] : arr(m.qualities);
    const def = (list, d) => (list.length ? `${list.join(" / ")}${str(d) ? ` (${str(d)})` : ""}` : "—");
    const extra = [
      bool(m.showBackground) ? "배경(투명)" : "",
      arr(m.complexities).length ? `complexity ${arr(m.complexities).join(" / ")}` : "",
      arr(m.formats).filter((f) => f !== "png").map((f) => f.toUpperCase()).join(" · "),
    ].filter(Boolean).join(", ");
    const ref = num(m.refLimit);
    return `| ${tick(m.id)}${pinned.includes(m.id) ? " ★" : ""} | ${cell(def(res, m.defaultResolution))} | ${cell(def(q, m.defaultQuality))} | ${ref === undefined ? "—" : ref ? `최대 ${ref}장` : "없음"} | ${cell(extra || "—")} | ${cell(noPrice(str(m.hint)) || "—")} |`;
  });
  const byAspects = new Map();
  for (const m of models) {
    const a = arr(m.aspects).join(", ");
    if (a) byAspects.set(a, [...(byAspects.get(a) || []), m.id]);
  }
  return [
    "★ = 앱이 고른 계열 SOTA(모델 메뉴 별표). 괄호 = 앱 화면의 시작값. 앱 설명은 앱 코드의 글 그대로.",
    "",
    "| 모델 ID | 해상도 (기본) | 품질 (기본) | 레퍼런스 | 그 밖 | 앱 설명 |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
    "비율:",
    "",
    ...[...byAspects].map(([a, ids]) => `- ${ids.map(tick).join(" · ")}: ${a}`),
  ].join("\n");
}

// ---------------------------------------------------------------- 시댄스
// 칸이 비어 있을 때 앱이 쓰는 값 — 앱의 modelDurationRange · modelImageMax · modelVideoMax · modelAudioMax · modelResolutions 그대로.
// 앱에서 이 규칙이 바뀌면 표가 틀리므로, 같은 글이 앱 코드에 그대로 있는지 먼저 본다(없으면 예외 → 알림).
const SEEDANCE_DEFAULT_RULES = [
  /\?\.imgMax \?\? 9;/, /\?\.vidMax \?\? 3;/, /\?\.audMax \?\? 3;/,
  /=== 'gemini' \? \[3, 10\] : \[4, 15\];/,
  /=== 'gemini'\) return \['720p'\];/,
  /includes\('fast'\) \|\| model\.includes\('mini'\)\) return \['480p', '720p'\];/,
  /return \['480p', '720p', '1080p', '4k'\];/,
];
export function readSeedance(ts) {
  const missing = SEEDANCE_DEFAULT_RULES.filter((re) => !re.test(ts));
  if (missing.length) throw new Error(`앱의 모델 기본값 규칙이 바뀜(${missing.length}곳) — sync/app-tables.js 의 기본값을 앱 store.ts 와 맞출 것`);
  const head = ts.indexOf("export const MODELS");
  const open = ts.indexOf("= [", head) + 2;
  const close = matchClose(ts, open);
  if (head < 0 || close < 0) throw new Error("MODELS 를 못 찾음");
  const constFields = (name) => {
    const at = ts.indexOf(`const ${name} = {`);
    if (at < 0) throw new Error(`펼친 값 ${name} 을 못 찾음`);
    const o = ts.indexOf("{", at);
    return topFields(ts.slice(o, matchClose(ts, o) + 1)).fields;
  };
  const models = topObjects(ts.slice(open, close + 1)).map((o) => {
    const { fields, spreads } = topFields(o);
    return Object.assign({}, ...spreads.map(constFields), fields);
  }).filter((m) => str(m.id) && !bool(m.retired));
  if (!models.length) throw new Error("MODELS 에 모델이 없음");
  return models.map((m) => {
    const id = str(m.id), gemini = str(m.provider) === "gemini";
    const res = arr(m.res).length ? arr(m.res) : gemini ? ["720p"] : /fast|mini/.test(id) ? ["480p", "720p"] : ["480p", "720p", "1080p", "4k"];
    const dur = nums(m.dur).length === 2 ? nums(m.dur) : gemini ? [3, 10] : [4, 15];
    return {
      id, name: str(m.name), res, dur, draft: bool(m.draftMode),
      img: num(m.imgMax) ?? 9, vid: num(m.vidMax) ?? 3, aud: num(m.audMax) ?? 3,
      guide: str(m.guide), notes: strs(firstBracket(m.notes)).map(noPrice).filter(Boolean),
    };
  });
}

export function seedanceTable(models) {
  return [
    "| 모델 ID | 이름 | 길이 | 해상도 | 초안 | 레퍼런스 상한 (이미지/영상/오디오) | 공식 가이드 |",
    "|---|---|---|---|---|---|---|",
    ...models.map((m) => `| ${tick(m.id)} | ${cell(m.name)} | ${m.dur[0]}~${m.dur[1]}초 | ${m.res.join(" / ")} | ${m.draft ? "있음(480p → 본편)" : "—"} | ${m.img} / ${m.vid} / ${m.aud} | ${m.guide ? tick(`official:${m.guide}`) : "—"} |`),
    "",
    "앱이 모델마다 적어 둔 사용법(앱 코드 `notes` 그대로):",
    "",
    ...models.filter((m) => m.notes.length).map((m) => `- ${tick(m.id)} — ${m.notes.join(" ")}`),
  ].join("\n");
}

// ---------------------------------------------------------------- 문서에 끼우기
// app-rules.md 글과 두 앱 코드(못 받은 앱은 빼고)로 새 글을 만든다. SOTA 줄은 두 앱을 다 받았을 때만 다시 쓴다.
export function renderAppRules(text, { nanobanana, seedance }) {
  const nb = nanobanana ? readNanobanana(nanobanana) : null, sd = seedance ? readSeedance(seedance) : null;
  if (nb) text = replaceBlock(text, "nanobanana-models", nanobananaTable(nb));
  if (sd) text = replaceBlock(text, "seedance-models", seedanceTable(sd));
  if (nb && sd) text = replaceBlock(text, "sota", [...sotaParts(nb.models.map((m) => m.id), nb.pinned), ...sotaParts(sd.map((m) => m.id))].join(" · "));
  return text;
}

export function replaceBlock(text, name, content) {
  const re = new RegExp(`(<!-- AUTO:${name}\\b[^>]*-->)[\\s\\S]*?(<!-- /AUTO:${name} -->)`);
  if (!re.test(text)) throw new Error(`app-rules.md 에 AUTO:${name} 표시가 없음`);
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  return text.replace(re, (_, a, b) => [a, ...content.split("\n"), b].join(nl));
}
