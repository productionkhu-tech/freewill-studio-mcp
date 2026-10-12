#!/usr/bin/env node
// 공식 프롬프팅 스킬 동기화.
//
// sources.json 의 공식 스킬을 원본에서 받아 지난번에 반영한 것과 지문(해시)을 비교한다.
// 바뀌었으면 mode 에 따라 바로 반영(auto)하거나 검토 대기(review)로 둔다. 원본 목록에
// 새 스킬이 생겼는지도 같이 본다 — 시댄스 3 이 나오면 BytePlus 목록에 sd3-pe 같은 게
// 올라올 테니, 그걸 사람이 놓치지 않게 하는 게 이 스크립트의 절반이다.
//
// 받는 일은 skills CLI 에 맡긴다. 원본 형식(GitHub, well-known 주소)이 무엇이든 CLI 가
// 풀고 해시까지 계산해 준다. 여기서는 비교·검사·반영·기록만 한다.
//
// 2026-10-12 부터: 스킬을 내지 않는 회사(구글 나노바나나 등)는 공식 문서(docs)에서 프롬프트 절만 뽑아 같은 방식으로
// 반영하고, adopt=true 원본에 새 프롬프트 스킬이 올라오면 사람 손 없이 tracked 에 붙인다(앱 모델 ID 계열은 이름·설명으로
// 짐작). 끝에 official/VERSIONS.md 에 '앱 모델 → 가이드' 표를 새로 쓴다 — 커넥터가 이 표를 start 지침 4단계에 넣으므로
// 새 모델·새 가이드가 지침 수정 없이 연결된다.
//
//   node sync/sync.mjs                 평소 실행 (GitHub Actions 가 매일)
//   node sync/sync.mjs --accept a,b    검토 대기 중인 스킬을 사람이 보고 반영
//   node sync/sync.mjs --dry-run       받아서 비교만 하고 아무것도 안 바꿈

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SYNC_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SYNC_DIR, "..");
const PLUGIN_DIR = path.join(ROOT, "plugins", "freewill-studio");
const OFFICIAL_DIR = path.join(PLUGIN_DIR, "skills", "freewill-generate", "official");
const STAGING = path.join(SYNC_DIR, ".staging");
const LOCK_PATH = path.join(SYNC_DIR, "official.lock.json");
const CHANGELOG_PATH = path.join(SYNC_DIR, "CHANGELOG.md");
const ATTENTION_PATH = path.join(SYNC_DIR, "attention.md");
const PLUGIN_JSON = path.join(PLUGIN_DIR, ".claude-plugin", "plugin.json");
const MARKETPLACE_JSON = path.join(ROOT, ".claude-plugin", "marketplace.json");

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const acceptAt = args.indexOf("--accept");
const ACCEPT = new Set(acceptAt >= 0 ? (args[acceptAt + 1] || "").split(",").map((s) => s.trim()).filter(Boolean) : []);

const today = new Date().toISOString().slice(0, 10);
const sources = readJson(path.join(SYNC_DIR, "sources.json"));
const lock = fs.existsSync(LOCK_PATH) ? readJson(LOCK_PATH) : {};
lock.skills ??= {};   // 반영된 것: 해시·버전·날짜
lock.held ??= {};     // 검토 대기: 이미 알린 해시 (같은 걸 매일 다시 알리지 않게)
lock.known ??= {};    // 원본별로 지금까지 본 스킬 이름 (새 스킬 감지용)
lock.failing ??= {};  // 받기 실패: 이미 알린 오류 (복구되면 지움)

const changelog = [];   // 이번 실행에 반영된 것
const attention = [];   // 사람이 볼 것 (검토 대기, 새 스킬, 오류)
const log = (...m) => console.log(...m);

// ------------------------------------------------------------------ 받기

function npx(argv, cwd) {
  // Windows 의 npx 는 npx.cmd 라 shell 없이는 실행이 안 된다 (Node 20+ 보안 수정).
  const win = process.platform === "win32";
  const quoted = win ? argv.map((a) => (/[\s&|<>^]/.test(a) ? `"${a}"` : a)) : argv;
  const r = spawnSync(win ? "npx.cmd" : "npx", quoted, {
    cwd, encoding: "utf8", shell: win, timeout: 300_000,
    env: { ...process.env, CI: "1", DO_NOT_TRACK: "1" },
  });
  return { ok: r.status === 0, out: `${r.stdout || ""}${r.stderr || ""}`.slice(-2000) };
}

function fetchSkill(t) {
  const r = npx(["--yes", sources.skillsCli, "add", t.source, "--skill", t.skill, "-a", "claude-code", "--copy", "-y"], STAGING);
  const dir = path.join(STAGING, ".claude", "skills", t.skill);
  const stagingLock = path.join(STAGING, "skills-lock.json");
  const entry = fs.existsSync(stagingLock) ? readJson(stagingLock).skills?.[t.skill] : null;
  if (!r.ok || !entry || !fs.existsSync(path.join(dir, "SKILL.md"))) {
    throw new Error(`받기 실패 — ${r.out.split(/\r?\n/).filter(Boolean).slice(-3).join(" / ") || "출력 없음"}`);
  }
  // CLI 가 주는 computedHash 는 쓰지 않는다 — Windows 와 Linux 에서 값이 달라서(하위 폴더가 있는
  // 스킬만), 내용이 그대로인데도 GitHub Actions 에서 "바뀜"으로 잡혔다. 내용으로 직접 센다.
  return { dir, hash: contentHash(dir), digest: entry.wellKnownDigest || null, version: versionOf(dir) };
}

// 스킬을 내지 않는 회사의 공식 문서 — 필요한 절만 뽑아 GUIDE.md 로(언어별 코드 예시 탭·그림은 뺀다).
async function fetchDoc(d) {
  const res = await fetch(d.url, { headers: { "User-Agent": "freewill-sync" } });
  if (!res.ok) throw new Error(`문서 ${res.status}`);
  const body = extractSections(await res.text(), d.sections, d.drop);
  if (body.length < 500) throw new Error(`뽑은 내용이 ${body.length}자뿐 — 문서 구조(절 제목)가 바뀌었는지 확인`);
  const dir = path.join(STAGING, "docs", d.name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "GUIDE.md"),
    `<!-- 원본: ${d.url} · ${d.vendor} · ${d.license || "원본 라이선스를 따름"} — sync/sync.mjs 가 매일 받아 프롬프트 절만 뽑은 것. 손으로 고치지 말 것. -->\n\n${body}`);
  return { dir, hash: contentHash(dir), digest: null, version: null };
}

// "## 제목" 이 sections 중 하나로 시작하는 절만 남긴다. 그 안의 drop 제목(### Python 등) 아래는 다음 제목까지 버린다.
function extractSections(text, sections, drop) {
  const dropRe = drop ? new RegExp(`^#{2,4} (${drop})\\s*$`, "i") : null;
  const out = [];
  let on = false, skip = false;
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const h = line.match(/^(#{1,6}) (.*)$/);
    if (h && h[1].length === 2) { on = sections.some((s) => h[2].trim().startsWith(s)); skip = false; }
    if (!on) continue;
    if (h) { skip = !!dropRe?.test(line); if (skip) continue; }
    if (skip || line.includes("![")) continue;
    out.push(line);
  }
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

// 폴더 내용의 지문. 경로는 / 로 맞추고 텍스트 파일의 줄바꿈(Windows 체크아웃의 CRLF)은 LF 로 맞춘다.
// 파일 권한(실행 비트)은 보지 않는다. 어느 OS 에서 계산해도 같은 내용이면 같은 값이 나와야 한다.
function contentHash(dir) {
  if (!fs.existsSync(dir)) return null;
  const h = crypto.createHash("sha256");
  const files = walk(dir).map((f) => path.relative(dir, f).split(path.sep).join("/")).sort();
  for (const rel of files) {
    const buf = fs.readFileSync(path.join(dir, rel));
    // 텍스트인지는 확장자가 아니라 내용으로 본다 (git 과 같은 기준: 앞부분에 0 바이트가 없으면 텍스트).
    // 확장자 목록으로 했더니 .svg 가 빠져서 Windows 체크아웃의 CRLF 가 그대로 지문에 들어갔다.
    // latin1 은 바이트를 1:1 로 옮기므로 인코딩과 무관하게 CRLF 만 LF 로 바뀐다.
    const body = buf.subarray(0, 8000).includes(0)
      ? buf
      : Buffer.from(buf.toString("latin1").replace(/\r\n/g, "\n"), "latin1");
    h.update(rel).update("\0").update(body).update("\0");
  }
  return h.digest("hex");
}

// ------------------------------------------------------------------ 새 스킬 감지

async function listSource(w) {
  if (w.type === "well-known") {
    const base = w.source.replace(/\/+$/, "");
    for (const p of [".well-known/agent-skills/index.json", ".well-known/skills/index.json"]) {
      const res = await fetch(`${base}/${p}`);
      if (res.ok) {
        const j = await res.json();
        return (j.skills || []).map((s) => ({ name: s.name, description: s.description || "" }));
      }
    }
    throw new Error("well-known 목록 주소를 찾지 못함");
  }
  // 토큰 없이는 IP 당 시간 60회라 로컬에서 몇 번 돌리면 막힌다. Actions 는 GITHUB_TOKEN, 로컬은 GH_TOKEN.
  const headers = { "User-Agent": "freewill-sync", Accept: "application/vnd.github+json" };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com/repos/${w.source}/git/trees/HEAD?recursive=1`, { headers });
  if (!res.ok) throw new Error(`GitHub 목록 ${res.status}`);
  const j = await res.json();
  return j.tree
    .filter((e) => e.type === "blob" && /(^|\/)SKILL\.md$/.test(e.path) && e.path.includes("/"))
    .map((e) => ({ name: path.posix.basename(path.posix.dirname(e.path)), description: "" }));
}

async function discover() {
  const tracked = new Set(sources.tracked.map((t) => t.skill));
  for (const w of sources.watch) {
    let list;
    try {
      list = await listSource(w);
    } catch (e) {
      noteFailure(`목록:${w.source}`, `${w.source} 목록을 못 읽음 — ${e.message}`);
      continue;
    }
    clearFailure(`목록:${w.source}`);
    const names = [...new Set(list.map((s) => s.name))];
    const prev = lock.known[w.source];
    lock.known[w.source] = [...new Set([...(prev || []), ...names])].sort();
    if (!prev) continue; // 처음 보는 원본: 지금 있는 걸 기준으로만 잡는다
    const re = new RegExp(w.filter || ".", "i");
    const fresh = list.filter((s) => !prev.includes(s.name) && !tracked.has(s.name) && re.test(`${s.name} ${s.description}`));
    for (const s of fresh) {
      if (w.adopt) {
        // 공식 회사 원본 — 사람 손 없이 붙인다. 모델 계열을 못 짐작하면 표에 "모델 미지정" 으로 올라가 에이전트가 설명을 보고 고른다.
        const families = inferFamilies(s);
        sources.tracked.push({
          skill: s.name, vendor: vendorOf(w.source), source: w.source, mode: "auto", families, models: [],
          use: "전체", skip: "—", adoptedAt: today,
        });
        tracked.add(s.name);
        sourcesChanged = true;
        attention.push(`- 🆕 **${s.name}** — ${w.source} 에 새로 올라와 자동으로 연결함 (모델 계열: ${families.join(", ") || "짐작 못 함"})${s.description ? `\n  ${s.description}` : ""}\n  → 확인만: 계열이 틀리면 \`sync/sources.json\` 의 families 를 고친다`);
      } else {
        attention.push(`- 🆕 **${s.name}** — ${w.source} 에 새로 올라옴${s.description ? `: ${s.description}` : ""}\n  → 필요하면 \`sync/sources.json\` tracked 에 추가`);
      }
    }
    for (const t of sources.tracked.filter((t) => t.source === w.source && !names.includes(t.skill))) {
      noteFailure(`사라짐:${t.skill}`, `**${t.skill}** 이 ${w.source} 목록에서 사라짐 — 이름이 바뀌었거나 새 버전으로 대체됐는지 확인`);
    }
  }
}

// 새 스킬이 어느 앱 모델 계열용인지 이름·설명으로 짐작한다 (앱 모델 ID 에 들어갈 글자, 정규식).
function inferFamilies(s) {
  const t = `${s.name} ${s.description || ""}`;
  const out = new Set();
  const sd = t.match(/^sd(\d)(\d)?-pe\b/i) || t.match(/seedance[\s-]*(\d)(?:[.\s-](\d))?/i);
  if (sd) out.add(sd[2] ? `seedance-${sd[1]}-${sd[2]}` : `seedance-${sd[1]}`);
  if (/seedream/i.test(t)) out.add("seedream");
  if (/nano.?banana|gemini[^.]*\bimage/i.test(t)) out.add("gemini-.*image");
  if (/\bveo\b/i.test(t)) out.add("veo");
  if (/\bomni\b/i.test(t)) out.add("gemini-omni");
  if (/gpt.?image|imagegen/i.test(t)) out.add("gpt-image");
  if (/\bsora\b/i.test(t)) out.add("sora");
  if (/\bkling\b/i.test(t)) out.add("kling");
  return [...out];
}
function vendorOf(source) {
  if (/volces|byteplus/i.test(source)) return "BytePlus";
  if (/google/i.test(source)) return "Google";
  if (/openai/i.test(source)) return "OpenAI";
  if (/higgsfield/i.test(source)) return "Higgsfield";
  return source;
}

// ------------------------------------------------------------------ 검사

// 원본에 원래 있던 건 문제 삼지 않는다 (Higgsfield 는 처음부터 CLI 설치 명령이 들어 있다).
// 새로 생겼을 때만 자동 반영을 멈춘다.
const RISKY = [
  [/curl[^\n|]*\|\s*(ba|z)?sh/i, "curl … | sh (원격 스크립트 실행)"],
  [/iwr[^\n|]*\|\s*iex/i, "iwr … | iex (원격 스크립트 실행)"],
  [/Invoke-Expression/i, "Invoke-Expression"],
  [/ignore (all )?(previous|prior|above) instructions/i, "이전 지시를 무시하라는 문구"],
  [/rm\s+-rf\s+[~/]/, "rm -rf ~ 또는 /"],
];

function check(t, newDir, oldDir) {
  const problems = [];
  if (t.kind !== "doc") {
    const text = fs.readFileSync(path.join(newDir, "SKILL.md"), "utf8");
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const name = fm?.[1].match(/^name:\s*["']?([^"'\r\n]+?)["']?\s*$/m)?.[1];
    if (name !== t.skill) problems.push(`SKILL.md 의 name 이 다름 (${name || "없음"})`);
  }
  const hadOld = oldDir && fs.existsSync(oldDir);
  if (hadOld) {
    const ratio = dirSize(newDir) / Math.max(1, dirSize(oldDir));
    if (ratio < 0.5 || ratio > 3) problems.push(`크기가 ${ratio.toFixed(2)}배로 급변`);
  }
  const now = allText(newDir);
  const before = hadOld ? allText(oldDir) : "";
  for (const [re, label] of RISKY) if (re.test(now) && !re.test(before)) problems.push(`위험 문구가 새로 생김: ${label}`);
  return problems;
}

// ------------------------------------------------------------------ 반영

function apply(t, got, note) {
  const dest = path.join(OFFICIAL_DIR, t.skill);
  const before = snapshot(dest);
  if (!DRY) {
    fs.rmSync(dest, { recursive: true, force: true });
    copyDir(got.dir, dest);
  }
  const d = diffStats(before, DRY ? snapshot(got.dir) : snapshot(dest));
  const prev = lock.skills[t.skill];
  const from = prev ? `${prev.version || short(prev.hash)} → ` : "처음 반영 ";
  changelog.push(`- **${t.skill}** (${t.vendor}) ${from}${got.version || short(got.hash)} · 파일 ${d.files}개, +${d.add} −${d.del}줄${note ? ` · ${note}` : ""}`);
  lock.skills[t.skill] = {
    kind: t.kind || "skill", vendor: t.vendor, source: t.source, mode: t.mode, models: t.models, families: t.families || [],
    version: got.version, hash: got.hash, digest: got.digest, appliedAt: today,
  };
  delete lock.held[t.skill];
}

let sourcesChanged = false;

async function main() {
  fs.rmSync(STAGING, { recursive: true, force: true });
  fs.mkdirSync(STAGING, { recursive: true });

  await discover(); // 새 공식 스킬을 먼저 붙여서 같은 실행에서 받는다

  const items = [
    ...sources.tracked.map((t) => ({ t, get: () => fetchSkill(t) })),
    ...(sources.docs || []).map((d) => ({
      t: { skill: d.name, kind: "doc", vendor: d.vendor, source: d.url, mode: d.mode || "auto", models: [], families: d.families || [] },
      get: () => fetchDoc(d),
    })),
  ];
  for (const { t, get } of items) {
    let got;
    try {
      got = await get();
    } catch (e) {
      noteFailure(t.skill, `**${t.skill}** ${e.message}`);
      continue;
    }
    clearFailure(t.skill);
    const prev = lock.skills[t.skill];
    const accepted = ACCEPT.has(t.skill);
    // 기준은 기록(lock)이 아니라 플러그인에 실제로 들어 있는 내용이다. 같으면 할 일이 없다.
    if (!accepted && got.hash === contentHash(path.join(OFFICIAL_DIR, t.skill))) {
      if (prev && prev.hash !== got.hash) prev.hash = got.hash; // 지문 계산 방식이 바뀐 경우 조용히 맞춘다
      delete lock.held[t.skill];
      log(`  같음   ${t.skill} ${got.version || short(got.hash)}`);
      continue;
    }
    const problems = check(t, got.dir, path.join(OFFICIAL_DIR, t.skill));
    if (accepted) {
      apply(t, got, problems.length ? `검사 경고를 확인하고 수동 반영: ${problems.join(", ")}` : "수동 반영");
      log(`  반영   ${t.skill} (수동)`);
    } else if (t.mode === "auto" && !problems.length) {
      apply(t, got);
      log(`  반영   ${t.skill} ${got.version || short(got.hash)}`);
    } else {
      const why = t.mode === "auto" ? `자동 반영 멈춤 — ${problems.join(", ")}` : "검토 후 반영하는 원본";
      log(`  대기   ${t.skill} (${why})`);
      if (lock.held[t.skill] !== got.hash) {
        attention.push(`- ⏸ **${t.skill}** (${t.vendor}) ${prev ? `${prev.version || short(prev.hash)} → ` : ""}${got.version || short(got.hash)} — ${why}\n  → 확인 후 \`node sync/sync.mjs --accept ${t.skill}\``);
        lock.held[t.skill] = got.hash;
      }
    }
  }

  // 커넥터가 topic(official:<이름>/<파일>)을 만들 수 있게 반영된 것마다 파일 목록·종류·계열을 지금 기준으로 적어 둔다.
  const meta = new Map([
    ...sources.tracked.map((t) => [t.skill, { kind: "skill", families: t.families || [] }]),
    ...(sources.docs || []).map((d) => [d.name, { kind: "doc", families: d.families || [] }]),
  ]);
  for (const [name, v] of Object.entries(lock.skills)) {
    const dir = path.join(OFFICIAL_DIR, name);
    v.files = walk(dir).map((f) => path.relative(dir, f).split(path.sep).join("/")).filter((f) => f.endsWith(".md")).sort();
    Object.assign(v, meta.get(name) || {});
  }

  if (DRY) {
    log(`\n[dry-run] 반영 예정 ${changelog.length}건, 알림 ${attention.length}건 — 파일은 그대로 둠`);
    [...changelog, ...attention].forEach((l) => log(l));
    return;
  }

  if (changelog.length) {
    const head = fs.existsSync(CHANGELOG_PATH) ? fs.readFileSync(CHANGELOG_PATH, "utf8") : "# 공식 스킬 반영 기록\n\n자동 생성 파일 — `sync/sync.mjs` 가 씀.\n";
    const [title, ...sections] = head.split(/\n(?=## )/).map((s) => s.trimEnd());
    if (sections[0]?.startsWith(`## ${today}`)) sections[0] += `\n${changelog.join("\n")}`; // 같은 날은 한 칸에
    else sections.unshift(`## ${today}\n\n${changelog.join("\n")}`);
    fs.writeFileSync(CHANGELOG_PATH, `${[title, ...sections].join("\n\n")}\n`);
    bumpVersion();
  }
  writeJson(LOCK_PATH, lock);
  if (sourcesChanged) writeJson(path.join(SYNC_DIR, "sources.json"), sources);
  writeVersions();
  if (attention.length) {
    fs.writeFileSync(ATTENTION_PATH, `공식 프롬프팅 스킬 동기화(${today})에서 사람이 볼 것:\n\n${attention.join("\n")}\n`);
  } else {
    fs.rmSync(ATTENTION_PATH, { force: true });
  }
  log(`\n반영 ${changelog.length}건, 알림 ${attention.length}건`);
  [...changelog, ...attention].forEach((l) => log(l));
}

// ------------------------------------------------------------------ 도움 함수

function noteFailure(key, msg) {
  log(`  오류   ${msg}`);
  if (lock.failing[key] !== msg) attention.push(`- ⚠️ ${msg}`);
  lock.failing[key] = msg;
}
function clearFailure(key) { delete lock.failing[key]; }

function writeVersions() {
  // '앱 모델 → 가이드' 표. 커넥터가 start 지침 4단계에 그대로 넣는다(플러그인 사본에는 이 파일이 같이 들어간다).
  // 손으로 고칠 곳은 sources.json — 이 파일은 매일 새로 쓴다.
  const cell = (s) => String(s ?? "—").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  const fam = (fs_) => (fs_ || []).map((f) => `\`${f}\``).join(" · ");
  const ver = (name) => { const v = lock.skills[name]; return v ? `${v.version || short(v.hash)} · ${v.appliedAt}` : "아직 못 받음"; };
  const official = [
    ...sources.tracked.filter((t) => t.role !== "fallback").map((t) => ({ name: t.skill, kind: "공식 스킬", ...t })),
    ...(sources.docs || []).map((d) => ({ name: d.name, kind: "공식 문서", ...d })),
  ].filter((x) => lock.skills[x.name]);
  const covered = new Set(official.flatMap((x) => x.families || []));
  const rows = [
    ...official.filter((x) => (x.families || []).length).map((x) =>
      `| ${fam(x.families)} | \`official:${x.name}\` | ${cell(x.vendor)} ${x.kind} | ${cell(x.use)} | ${cell(x.skip)} | ${ver(x.name)} |`),
    ...(sources.routes || []).filter((r) => !r.families.some((f) => covered.has(f))).map((r) =>
      `| ${fam(r.families)} | ${r.guides.map((g) => `\`${g}\``).join(" + ")} | 공식 가이드 없음 (${cell(r.vendor)}) | ${cell(r.note)} | — | — |`),
  ];
  const unknown = official.filter((x) => !(x.families || []).length);
  const fallback = sources.tracked.find((t) => t.role === "fallback");
  const body = [
    "# 앱 모델 → 공식 프롬프트 가이드",
    "",
    "자동 생성 — 저장소의 `sync/sync.mjs` 가 매일 공식 원본(BytePlus·Google·OpenAI 스킬 목록과 문서)과 비교해 새로 쓴다.",
    "손으로 고치지 말 것(바꿀 것은 `sync/sources.json`). 공식 원본에 새 가이드가 올라오면 다음 동기화 때 이 표에 저절로 붙는다.",
    "",
    "앱 모델 ID 에 왼쪽 글자(정규식)가 들어가면 그 줄의 가이드를 `freewill_guide(\"<topic>\")` 로 받아 **끝까지(part 이어서)** 읽고",
    "그 방식대로 쓴다. 지침 4단계 \"앱에 맞춘 규칙\"(영어 본문·앱 표기·모드별 바인딩)이 가이드보다 먼저다.",
    "",
    "| 앱 모델 ID 에 이게 들어가면 | 가이드 (topic) | 만든 곳 | 쓰는 부분 | 건너뛰는 부분 | 버전 · 반영일 |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
    ...(unknown.length ? [
      "모델 계열을 못 짐작한 새 공식 가이드 — 설명을 보고 맞는 모델이면 쓴다:",
      "",
      ...unknown.map((x) => `- \`official:${x.name}\` (${x.vendor}) — ${ver(x.name)}`),
      "",
    ] : []),
    "**표에 없는 모델(새로 들어온 모델)** — ① 같은 회사·같은 계열의 가장 가까운 가이드(예: 새 시댄스 버전이면 가장 최근 시댄스 가이드)",
    fallback
      ? `② 힉스필드 \`official:${fallback.skill}/prompt-engineering\`(기본 원칙) · \`official:${fallback.skill}/model-catalog\`(모델별 성격) ③ 사용자에게 "이 모델 공식 가이드는 아직 연결 전" 이라고 한 줄 알린다.`
      : "② 사용자에게 \"이 모델 공식 가이드는 아직 연결 전\" 이라고 한 줄 알린다.",
    "",
  ].join("\n");
  fs.mkdirSync(OFFICIAL_DIR, { recursive: true });
  fs.writeFileSync(path.join(OFFICIAL_DIR, "VERSIONS.md"), body);
}

function bumpVersion() {
  // Codex·ChatGPT 용 매니페스트는 version 이 있어야 해서 공식 스킬이 바뀔 때마다 올린다.
  const codexJson = path.join(PLUGIN_DIR, ".codex-plugin", "plugin.json");
  if (fs.existsSync(codexJson)) {
    const cx = readJson(codexJson);
    const [x, y, z] = String(cx.version || "0.1.0").split(".").map((n) => parseInt(n, 10) || 0);
    cx.version = `${x}.${y}.${z + 1}`;
    writeJson(codexJson, cx);
    log(`  Codex 플러그인 버전 → ${cx.version}`);
  }
  // Claude 쪽은 version 을 비워 둬서 커밋마다 새 버전으로 잡힌다(커밋 SHA 기준) — 그럼 할 일이 없다.
  // 누가 version 을 박아 넣으면 그때부터는 올려 줘야 설치된 쪽이 새 버전을 받는다.
  const p = readJson(PLUGIN_JSON);
  if (!p.version) return;
  const [a, b, c] = String(p.version).split(".").map((n) => parseInt(n, 10) || 0);
  p.version = `${a}.${b}.${c + 1}`;
  writeJson(PLUGIN_JSON, p);
  if (fs.existsSync(MARKETPLACE_JSON)) {
    const m = readJson(MARKETPLACE_JSON);
    for (const pl of m.plugins || []) if (pl.name === p.name && pl.version) pl.version = p.version;
    writeJson(MARKETPLACE_JSON, m);
  }
  log(`  플러그인 버전 → ${p.version}`);
}

function versionOf(dir) {
  const text = fs.readFileSync(path.join(dir, "SKILL.md"), "utf8");
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] || "";
  return fm.match(/^\s*(?:skill_version|version):\s*["']?([0-9][\w.-]*)/m)?.[1] || null;
}

function copyDir(from, to) {
  // fs.cpSync 를 쓰지 않는다 — Windows 의 Node 25 에서 한글이 든 경로(…\기획 파일\…)로
  // 복사하면 아무 메시지 없이 프로세스가 죽었다(종료 코드 127). 파일 단위 복사는 멀쩡하다.
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
function dirSize(dir) { return walk(dir).reduce((n, f) => n + fs.statSync(f).size, 0); }
function allText(dir) {
  return walk(dir).filter((f) => /\.(md|txt|ya?ml|json|py|sh|js|ts)$/i.test(f)).map((f) => fs.readFileSync(f, "utf8")).join("\n");
}
function snapshot(dir) {
  const out = new Map();
  for (const f of walk(dir)) out.set(path.relative(dir, f), fs.readFileSync(f, "utf8").split(/\r?\n/));
  return out;
}
function diffStats(before, after) {
  // 줄 단위 대략치 — 몇 줄이 들고 났는지만 본다.
  let files = 0, add = 0, del = 0;
  for (const k of new Set([...before.keys(), ...after.keys()])) {
    const a = before.get(k) || [], b = after.get(k) || [];
    const count = (xs) => xs.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
    const ca = count(a), cb = count(b);
    let plus = 0, minus = 0;
    for (const [x, n] of cb) plus += Math.max(0, n - (ca.get(x) || 0));
    for (const [x, n] of ca) minus += Math.max(0, n - (cb.get(x) || 0));
    if (plus || minus) files++;
    add += plus; del += minus;
  }
  return { files, add, del };
}
function short(h) { return h ? `#${String(h).slice(0, 8)}` : "?"; }
function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8").replace(new RegExp("^" + String.fromCharCode(0xfeff)), "")); }
function writeJson(p, v) { fs.writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`); }

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
