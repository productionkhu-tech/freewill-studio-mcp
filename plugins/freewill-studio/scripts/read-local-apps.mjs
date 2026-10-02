#!/usr/bin/env node
// 이 PC 에 깔린 나노바나나·시댄스에서 "지금 이 앱의" 규칙을 읽어 온다.
//
// 저장소가 아니라 로컬 앱을 보는 이유: 생성은 이 PC 의 앱이 한다. 저장소에 새 기능이 올라가
// 있어도 이 PC 가 아직 업데이트 전이면 그 기능은 없다. 그래서 규칙은 항상 로컬 앱에서 읽고,
// 저장소(GitHub 릴리즈)는 "업데이트가 있다"고 알려줄 때만 쓴다.
//
// 읽기만 한다. 나노바나나의 /api/status 와 /api/events 는 절대 부르지 않는다 — status 는 읽는
// 순간 앱의 '창 닫기 요청' 신호를 지우고, events 는 꺼내 가는 큐라 앱 화면의 팝업을 가로챈다.
//
//   node read-local-apps.mjs              두 앱 다
//   node read-local-apps.mjs nanobanana   나노바나나만
//   node read-local-apps.mjs seedance     시댄스만

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const which = process.argv[2] || "all";
// 주소를 바꾸는 환경변수는 시험용이다 (가짜 서버로 읽기 부분을 확인할 때).
const NB = process.env.FREEWILL_NB_URL || "http://127.0.0.1:5656";
const SD = process.env.FREEWILL_SD_URL || "http://127.0.0.1:3000";

// ------------------------------------------------------------------ 나노바나나

async function nanobanana() {
  const out = ["## 나노바나나 (이미지)"];
  const [ver, latest] = await Promise.all([getJson(`${NB}/api/version`, 1500), latestRelease("productionkhu-tech/freewill-nanobanana")]);
  if (!ver) {
    out.push("- **꺼져 있음** — 이 PC 앱의 규칙·설정을 읽으려면 나노바나나를 켜 달라고 할 것. 그 전까지는 `references/app-rules.md` 스냅샷.");
    if (latest) out.push(`- 최신 릴리즈: ${latest}`);
    return out;
  }
  out.push(`- 실행 중 · 이 PC 버전 **${ver.version}**${releaseNote(ver.version, latest)}`);

  const [billing, projects, settings, js] = await Promise.all([
    getJson(`${NB}/api/billing/state`, 1500),
    getJson(`${NB}/api/projects`, 1500),
    getJson(`${NB}/api/settings`, 1500),
    getText(`${NB}/static/app.js`, 4000),
  ]);
  const tab = projects?.projects?.find((p) => p.pid === projects.active);
  if (tab) out.push(`- 지금 탭: "${tab.name}"${tab.generating ? ` (생성 중 ${tab.done}/${tab.total})` : ""}`);
  if (billing) {
    out.push(billing.confirmed && billing.project_id
      ? `- 팀·프로젝트: **${billing.team_id} / ${billing.project_id}** (사람이 앱에서 고른 것)`
      : "- 팀·프로젝트: **선택 안 됨** → 보내기 전에 앱에서 팀·프로젝트를 골라 달라고 할 것");
  }
  if (settings) {
    const s = settings;
    out.push(`- 지금 설정: 모델 \`${s.model}\` · 해상도 ${s.resolution} · 비율 ${s.aspect}` +
      `${s.quality ? ` · 품질 ${s.quality}` : ""} · 장수 ${s.count} · 레퍼런스 상한 ${s.ref_limit ?? "?"}` +
      `${s.openai_bg_transparent ? " · 투명 배경" : ""}`);
    if (s.output_dir) out.push(`- 저장 폴더: ${s.output_dir}`);
  }
  const specs = js ? cutAfter(js, "MODEL_SPECS", "{", "}") : null;
  if (specs) out.push("", "### 모델 사양 — 앱 화면 코드 `MODEL_SPECS` 원문", "```js", `MODEL_SPECS = ${specs}`, "```");
  else out.push("- 모델 사양을 앱 화면 코드에서 찾지 못함 → 스냅샷을 쓰고 앱 화면으로 확인");
  return out;
}

// ------------------------------------------------------------------ 시댄스

async function seedance() {
  const out = ["## 시댄스 (영상)"];
  const res = seedanceResources();
  const version = res ? asarVersion(path.join(res, "app.asar")) : null;
  const [team, latest] = await Promise.all([getJson(`${SD}/api/team`, 1500), latestRelease("productionkhu-tech/freewill-seedance")]);

  if (!res && !team) {
    out.push("- **설치돼 있지 않거나 찾지 못함** — 사용자에게 시댄스 설치 여부를 확인할 것.");
    if (latest) out.push(`- 최신 릴리즈: ${latest}`);
    return out;
  }
  out.push(`- ${team ? "실행 중" : "꺼져 있음 (설치 파일에서 읽음)"} · 이 PC 버전 **${version || "?"}**${releaseNote(version, latest)}`);
  if (team?.known) out.push(`- 팀: ${team.team}`);
  out.push("- 프로젝트는 앱 화면에서 고른다. 프로젝트마다 쓸 수 있는 모델이 다르고, 권한 없는 모델은 앱이 막는다.");
  // 자동 보내기(에이전트 작업함, 26.10.304~). 켜져 있으면 지금 화면 상태까지, 꺼져 있으면 버전으로만 판단한다.
  const agent = team ? await getJson(`${SD}/api/agent/status`, 1500) : null;
  if (agent?.ok) {
    const where = !agent.screenAlive ? "앱 화면이 응답하지 않음(창이 닫혔나?)"
      : !agent.project ? "열린 프로젝트 없음"
      : `프로젝트 "${agent.project}" · 과금 ${agent.billing ? `"${agent.billing}"` : "**선택 안 됨 — 앱에서 먼저 고르게 할 것**"}${agent.composer === false ? " · 갤러리 화면" : ""}`;
    out.push(`- 자동 보내기: **가능** (send-to-seedance) — ${where}`);
    if (Array.isArray(agent.allowedModels)) out.push(`- 이 과금 프로젝트로 쓸 수 있는 모델: ${agent.allowedModels.join(", ") || "(없음)"}${agent.fourK ? " · 4K 가능" : ""}`);
    // 앱이 직접 낸 사용 설명서가 있으면 그게 정답이다 — 화면 코드를 긁어 올 필요가 없다.
    const manual = await getJson(`${SD}/api/agent/manual`, 3000);
    if (manual?.ok && manual.text) {
      const running = manual.manual?.appVersion;
      if (running && version && running !== version) out.push(`- 지금 떠 있는 앱은 **${running}** — 설치 파일(${version})과 다르다(업데이트 직후이거나 개발 실행). 아래 설명서가 지금 앱 기준이다.`);
      out.push(`- 앱 사용 설명서 버전 **${manual.version}** — 보낼 때 jobs.json 의 "manual" 에 그대로 적는다(앱이 바뀌면 앱이 다시 읽으라고 돌려보낸다).`);
      out.push("", "### 앱이 낸 사용 설명서", "", manual.text.replace(/^# .*\n/, ""));
      return out;
    }
  } else if (version && compareVersions(version, "26.10.304") >= 0) {
    out.push(`- 자동 보내기: 이 버전은 가능 (send-to-seedance) — ${team ? "작업함 응답 없음, 앱을 다시 켜 볼 것" : "보내려면 앱을 켜야 한다"}`);
  } else {
    out.push("- 자동 보내기: **안 됨** — 26.10.304 이상 필요(앱을 껐다 켜면 업데이트). 그 전엔 설정·프롬프트를 정리해 옮겨 적게 한다.");
  }

  // 화면 코드: 켜져 있으면 앱이 서빙하는 것, 아니면 설치 폴더의 것. 같은 파일이다.
  let bundle = null;
  if (team) {
    const html = await getText(`${SD}/`, 2000);
    const src = html?.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
    if (src) bundle = await getText(`${SD}${src}`, 8000);
  }
  if (!bundle && res) {
    const dir = path.join(res, "dist", "assets");
    const f = fs.existsSync(dir) && fs.readdirSync(dir).filter((n) => /^index-.*\.js$/.test(n))
      .map((n) => path.join(dir, n)).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
    if (f) bundle = fs.readFileSync(f, "utf8");
  }
  const rules = bundle ? seedanceRules(decodeEscapes(bundle)) : null;
  if (!rules?.length) {
    out.push("- 모델 규칙을 화면 코드에서 찾지 못함 → 스냅샷을 쓰고 앱 화면으로 확인");
    return out;
  }
  out.push("", "### 모델 규칙 — 앱 화면 코드에서 잘라 온 원문 (압축된 코드라 이름이 짧다)");
  for (const [title, code] of rules) out.push("", `**${title}**`, "```js", code, "```");
  return out;
}

function seedanceRules(src) {
  const parts = [];
  // 모델 목록: 'dreamina-seedance-' 모델들이 든 배열. 압축된 변수 이름은 빌드마다 바뀌므로
  // 이름이 아니라 내용으로 찾는다.
  const anchor = src.indexOf('id:"dreamina-seedance-');
  if (anchor < 0) return parts;
  const open = src.lastIndexOf("[", anchor);
  const list = cut(src, open, "[", "]");
  if (!list) return parts;
  const name = src.slice(Math.max(0, open - 40), open).match(/([A-Za-z_$][\w$]*)\s*=\s*$/)?.[1];
  parts.push(["모델 목록", `${name || "models"}=${list}`]);

  // 목록 안에서 펼쳐 쓰는 값 (...kA 같은 것 — Seedance 2.5 사양이 여기 있었다)
  for (const id of new Set([...list.matchAll(/\.\.\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]))) {
    const def = findDef(src, id);
    if (def) parts.push([`${id} — 목록이 펼쳐 쓰는 값`, `${id}=${def}`]);
  }

  // 목록을 읽어서 기본값을 정하는 함수들 (길이 범위, 해상도, 레퍼런스 상한 등)
  if (name) {
    const fns = new Set();
    let i = -1;
    while ((i = src.indexOf(`${name}.find(`, i + 1)) >= 0 && fns.size < 25) {
      const f = src.lastIndexOf("function ", i);
      if (f < 0 || i - f > 600) continue;
      const brace = src.indexOf("{", f);
      const body = cut(src, brace, "{", "}", 1200);
      // 가까이 있는 엉뚱한 함수(화면 컴포넌트, 날짜 표시 등)는 버린다 — 몸통 안에서 목록을 읽어야 한다
      if (body && body.includes(`${name}.find(`)) fns.add(src.slice(f, brace) + body);
    }
    if (fns.size) parts.push(["목록을 읽는 함수 (기본값·범위)", [...fns].join("\n")]);
  }

  const ratio = src.indexOf('"adaptive","21:9"');
  if (ratio >= 0) parts.push(["비율 선택지", cut(src, src.lastIndexOf("[", ratio), "[", "]")]);
  const modes = src.indexOf('text_to_video:"');
  if (modes >= 0) parts.push(["모드 이름", cut(src, src.lastIndexOf("{", modes), "{", "}")]);
  const count = src.match(/"Output Count"[\s\S]{0,600}?type:"range",min:"(\d+)",max:"(\d+)"/);
  if (count) parts.push(["한 번에 만드는 개수 (Output Count)", `min ${count[1]}, max ${count[2]}`]);
  return parts.filter(([, code]) => code);
}

function seedanceResources() {
  const candidates = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs", "Freewill Seedance 2.0", "resources"),
    "/Applications/Freewill Seedance 2.0.app/Contents/Resources",
    path.join(os.homedir(), "Applications", "Freewill Seedance 2.0.app", "Contents", "Resources"),
  ].filter(Boolean);
  return candidates.find((d) => fs.existsSync(path.join(d, "app.asar"))) || null;
}

function asarVersion(file) {
  // app.asar 머리말(JSON)에서 package.json 위치를 찾아 version 만 읽는다. 75MB 를 통째로 읽지 않는다.
  let fd;
  try {
    fd = fs.openSync(file, "r");
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    const headerSize = head.readUInt32LE(4);
    const jsonLen = head.readUInt32LE(12);
    const json = Buffer.alloc(jsonLen);
    fs.readSync(fd, json, 0, jsonLen, 16);
    const entry = JSON.parse(json.toString("utf8")).files?.["package.json"];
    if (!entry) return null;
    if (entry.unpacked) return JSON.parse(fs.readFileSync(`${file}.unpacked/package.json`, "utf8")).version || null;
    const buf = Buffer.alloc(entry.size);
    fs.readSync(fd, buf, 0, entry.size, 8 + headerSize + Number(entry.offset));
    return JSON.parse(buf.toString("utf8")).version || null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

// ------------------------------------------------------------------ 공통

async function latestRelease(repo) {
  // GitHub API 는 쓰지 않는다 — 로그인 없이 IP 당 시간 60회라, 사무실처럼 한 IP 를 여럿이 쓰면
  // 금방 막힌다. releases/latest 페이지가 최신 태그로 넘겨 주는 주소만 본다. 한 시간은 기억해 둔다.
  const cacheFile = path.join(os.tmpdir(), "freewill-studio-releases.json");
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cacheFile, "utf8")); } catch {}
  const hit = cache[repo];
  if (hit && Date.now() - hit.at < 3600_000) return hit.tag;
  let tag = null;
  try {
    const r = await fetch(`https://github.com/${repo}/releases/latest`, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(4000) });
    tag = decodeURIComponent(r.headers.get("location")?.match(/\/releases\/tag\/([^/?#]+)/)?.[1] || "") || null;
  } catch {}
  if (tag) {
    cache[repo] = { tag, at: Date.now() };
    try { fs.writeFileSync(cacheFile, JSON.stringify(cache)); } catch {}
  }
  return tag;
}

function releaseNote(local, latest) {
  if (!local || !latest) return "";
  const cmp = compareVersions(local, latest);
  if (cmp < 0) return ` — ⬆ 최신 릴리즈 **${latest}** 가 있다. 이 PC 는 아직 업데이트 전이라 그 기능은 없다. 규칙은 이 PC 버전 기준으로 쓴다 (새 기능이 필요하면 앱을 다시 켜서 업데이트).`;
  return " (최신)";
}

function compareVersions(a, b) {
  const na = String(a).match(/\d+/g)?.map(Number) || [];
  const nb = String(b).match(/\d+/g)?.map(Number) || [];
  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    const d = (na[i] || 0) - (nb[i] || 0);
    if (d) return d;
  }
  return 0;
}

async function getText(url, ms, headers = {}) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(ms) });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  }
}
async function getJson(url, ms, headers) {
  const t = await getText(url, ms, headers);
  try { return t ? JSON.parse(t) : null; } catch { return null; }
}

function cutAfter(src, marker, open, close) {
  const at = src.indexOf(marker);
  if (at < 0) return null;
  const start = src.indexOf(open, at);
  return start < 0 ? null : cut(src, start, open, close);
}

// 여는 괄호에서 짝이 맞는 닫는 괄호까지. 문자열·주석 안의 괄호는 세지 않는다.
// (주석을 안 건너뛰면 "the user's choice" 같은 작은따옴표를 문자열 시작으로 착각해 끝을 지나친다.)
function cut(src, start, open, close, max = 30000) {
  if (start < 0 || src[start] !== open) return null;
  let depth = 0, q = null;
  for (let i = start; i < src.length && i - start < max; i++) {
    const c = src[i];
    if (q) {
      if (c === "\\") i++;
      else if (c === q) q = null;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") { const nl = src.indexOf("\n", i); i = nl < 0 ? src.length : nl; continue; }
    if (c === "/" && src[i + 1] === "*") { const end = src.indexOf("*/", i + 2); i = end < 0 ? src.length : end + 1; continue; }
    if (c === '"' || c === "'" || c === "`") q = c;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return src.slice(start, i + 1);
  }
  return null;
}

function findDef(src, id) {
  const m = new RegExp(`[,;\\s(]${id.replace(/[$]/g, "[$]")}=([\\[{])`).exec(src);
  if (!m) return null;
  const at = m.index + m[0].length - 1;
  return cut(src, at, m[1], m[1] === "[" ? "]" : "}");
}

function decodeEscapes(s) {
  // 압축된 코드는 한글을 이스케이프로 적는다. 원문 그대로 보이게 푼다.
  // (이 줄을 정규식 리터럴로 쓰지 않는 이유: 도구가 그 이스케이프를 글자로 바꿔 버린 적이 있다.)
  const re = new RegExp(`${String.fromCharCode(92)}u([0-9a-fA-F]{4})`, "g");
  return s.replace(re, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

// ------------------------------------------------------------------

const now = new Date();
const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
const sections = [];
if (which === "all" || which === "nanobanana") sections.push(await nanobanana());
if (which === "all" || which === "seedance") sections.push(await seedance());
console.log([`# 이 PC 의 앱 (${stamp} 읽음)`, "", ...sections.map((s) => s.join("\n")).join("\n\n").split("\n")].join("\n"));
