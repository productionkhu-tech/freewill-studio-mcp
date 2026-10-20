#!/usr/bin/env node
// 실행 중인 시댄스 앱으로 영상 생성 요청을 보낸다 — 사람이 전송 버튼을 누르는 것과 같은 경로.
//
// 시댄스(26.10.304~) 서버의 '에이전트 작업함'에 요청을 넣으면, 앱 화면이 2초 안에 받아서 작성 칸을 잠깐 빌려
// 설정·레퍼런스·프롬프트를 넣고 전송 버튼과 같은 함수로 보낸 뒤, 작성 칸을 원래대로 돌려놓는다. 그래서 앱에
// 생성 중 카드가 뜨고, 권한 검사·크레딧 집계·영상 보관이 평소대로 된다. 레퍼런스 검사도 드래그와 같다.
//
// 무엇을 보낼 수 있는지는 앱이 직접 낸 **사용 설명서**가 정답이다(--manual). 앱이 업데이트되면 설명서도 바뀌고,
// 예전 설명서 버전으로 보내면 앱이 "업데이트됐으니 다시 읽어" 로 돌려보낸다 — 이 스크립트는 그때 새 설명서를
// 보여 주고 멈춘다. 설정 키도 설명서에서 읽으므로 앱에 새 설정이 생기면 그대로 넘어간다.
//
// 진행은 /api/agent/* 로만 본다. /api/byteplus/tasks/<id> 는 부르지 않는다 — 그 조회는 성공을 처음 본 순간
// 크레딧 보고·영상 보관을 하고 기록을 지운다(앱 화면이 하는 일이다).
//
// 로그인과 사용 기록: 프리윌 스튜디오 MCP 커넥터(회사 구글 계정 로그인)가 이 스크립트를 내려줄 때 받는 사람의 표를
// FREEWILL_TICKET 에 넣는다(12시간). 요청마다 앱에 넣기 직전에 커넥터에 "누가·어느 PC·무슨 모델·몇 개" 를 남기고
// 하루 한도를 묻는다 — 표가 없거나 만료됐거나 커넥터에 닿지 않으면 보내지 않는다. 프롬프트·그림은 보내지 않는다.
//
// 한도 (MCP 로 보내는 것 — 대량 생성을 생각 없이 돌리는 걸 막는다. 앱에서 직접 만드는 건 막지 않는다):
//   - 열린 프로젝트에서 동시에 진행 중인(대기 포함) 영상 3개까지 — 앱의 한 번 최대 개수와 같다. 넘으면 앞의 것이
//     끝날 때까지 기다렸다가 다음 요청을 넣는다. 과금되는 명령(card.final · card.regenerate)도 같다.
//   - 한 사람 하루 200개(커넥터가 센다). 넘으면 보내지 않고 멈춘다.
//
//   node send-to-seedance.mjs --manual              앱의 사용 설명서와 그 버전 (처음 한 번, 그리고 앱이 바뀌었다고 할 때)
//   node send-to-seedance.mjs jobs.json --dry-run   앱 상태만 확인(설명서 버전·프로젝트·과금·권한) — 아무것도 안 보냄
//   node send-to-seedance.mjs jobs.json             보내기 — 앱이 받아서 보낼 때까지 하나씩
//   node send-to-seedance.mjs jobs.json --watch     보내고 영상이 다 끝날 때까지 지켜봄
//   node send-to-seedance.mjs jobs.json --save-to <폴더>
//                                                   지켜보다 끝난 영상을 받아 그 폴더로 옮김(<작업 이름>_A.mp4 · _목록.tsv)
//   node send-to-seedance.mjs --status <id> [<id>]  보낸 요청의 지금 상태
//   node send-to-seedance.mjs --do <명령> [JSON 인자 | @인자파일.json]
//                                                   앱 기능 명령(26.10.305~) — 프로젝트 · 어셋 라이브러리 · 카드 ·
//                                                   과금 목록. 명령 목록은 설명서에. 결과는 JSON 으로 출력한다.
//                                                   설명서 버전은 --manual 로 읽을 때 기억해 둔 것을 쓴다.
//
// jobs.json:
//   {
//     "guide": "지침 버전 (freewill_guide(\"start\") 맨 위의 값) — 지침이 바뀌었으면 스크립트가 다시 읽으라고 멈춘다",
//     "manual": "읽은 설명서 버전 (--manual 이 알려 준 값 그대로) — 앱이 바뀌었으면 앱이 받지 않는다",
//     "project": "보낼 사이드바 프로젝트 이름 (사용자가 이 작업용으로 만들어 둔 것 — 안 열려 있으면 스크립트가 연다(project.open,
//                 사이드바 클릭과 같음, dry-run 도). 생략하면 지금 열린 것)",
//     "billing": "과금 프로젝트 이름 (확인 카드에 보여 준 것 — 앱 전체에 하나, 앱을 켤 때마다 사람이 고른다. 다르면 안 보냄, 생략하면 지금 값)",
//     "work": "작업 폴더 (있으면 dry-run 이 <작업 폴더>/_검수/보낼것.json 에 레퍼런스를 남겨 작업 페이지의 '보낼 것'에 그림으로 뜬다,
//              보낸 뒤엔 jobs.json 을 05_프롬프트 에 남긴다)",
//     "defaults": { "model": "dreamina-seedance-2-5-260628", "mode": "multimodal_reference",
//                   "ratio": "16:9", "duration": 10, "resolution": "720p", "draft": true,
//                   "output_count": 1, "generate_audio": true, "output_format": "mov" },
//     "jobs": [
//       { "name": "cut_01", "prompt": "The woman in [Image 1] walks ...", "refs": ["C:/path/a.png"] },
//       { "name": "cut_02", "prompt": "...", "mode": "image_to_video_first_last",
//         "refs": [{ "path": "C:/a.png", "role": "first_frame" }, { "path": "C:/b.png", "role": "last_frame" }] }
//     ]
//   }
// 설정 키와 값의 범위는 설명서에. 안 준 값은 앱의 지금 설정을 따른다(모델·모드를 바꾸면 그 조합의 기본값).
// 레퍼런스 순서가 프롬프트의 [Image N]·[Video N]·[Audio N] 번호다(종류별로 센다). 첫·끝 프레임은 role 로 정한다.
// 프롬프트는 보내기 전에 점검한다(lintPrompt) — 본문은 영어, 앱 표기 [Image N], 첫·끝 프레임 모드엔 [Image N] 없음.
// 일부러 한국어 프롬프트로 보내려면 작업(또는 defaults)에 "prompt_language": "ko".
// 사용자가 개인 스킬·자기 프롬프트·다른 형식을 정했으면 "user_format": true — 사내 쓰는 법 점검(끝 프레임·대사 없음 문장·
// 구도를 그림에 맡기기 등)은 막지 않고 "확인할 것"으로만 보여 준다. 앱이 실패하는 것(표기·바인딩·레퍼런스 수·소수 초)은 그래도 멈춘다.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const SD = process.env.FREEWILL_SD_URL || "http://127.0.0.1:3000";
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const DRY = flag("--dry-run");
// --save-to <폴더>: 끝난 영상을 받아(card.download) 다운로드 폴더에서 그 폴더로 옮긴다 — <작업 이름>_A.mp4 … (지침 6단계 "정리")
const saveAt = args.indexOf("--save-to");
const SAVE_TO = saveAt >= 0 ? args[saveAt + 1] || null : null;
const WATCH = flag("--watch") || Boolean(SAVE_TO);
const STATUS = flag("--status");
const MANUAL = flag("--manual");
const DO = flag("--do");
const positional = args.filter((a, i) => !a.startsWith("--") && !(saveAt >= 0 && i === saveAt + 1));
// --manual 로 읽은 설명서 버전을 기억해 두는 곳(--do 가 쓴다). 앱 주소마다 따로 — 시험 서버와 섞이지 않게.
const STATE_FILE = path.join(os.tmpdir(), `freewill-seedance-manual-${SD.replace(/[^a-z0-9]+/gi, "_")}.json`);
const rememberManual = (version) => { try { fs.writeFileSync(STATE_FILE, JSON.stringify({ version, at: Date.now() })); } catch {} };
const rememberedManual = () => { try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")).version || null; } catch { return null; } };
const readJsonArg = (raw) => {
  const txt = raw.startsWith("@") ? fs.readFileSync(raw.slice(1), "utf8") : raw;
  return JSON.parse(txt.replace(new RegExp("^" + String.fromCharCode(0xfeff)), ""));
};

const log = (...m) => console.log(...m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 프롬프트 점검 — 앱 표기·모드와 어긋나는 쓰기를 글로 돌려준다(10/8: GPT 가 한국어 본문, 첫 프레임 모드에 [Image 1]).
// 따옴표 안(대사·화면 글자)은 한국어여도 된다. 첫·끝 프레임은 앱이 role 로 묶고 알약(바인딩 표시)으로 안 바꾼다.
const KINDS = { Image: /\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif)$/i, Video: /\.(mp4|mov|m4v|webm)$/i, Audio: /\.(wav|mp3)$/i };
const FRAME_MODES = ["image_to_video_first", "image_to_video_first_last"];
// 타임코드 구간 — "0–2s", "2 to 5s", "0:00 to 0:03" → [[0, 2], [2, 5], [0, 3]]
function timecodes(s) {
  const out = [];
  for (const m of s.matchAll(/\b(\d{1,2})\s*s?\s*(?:–|—|-|to)\s*(\d{1,2})\s*s(?:ec(?:ond)?s?)?\b/gi)) out.push([+m[1], +m[2]]);
  for (const m of s.matchAll(/\b(\d{1,2}):(\d{2})\s*(?:–|—|-|to)\s*(\d{1,2}):(\d{2})\b/g)) out.push([+m[1] * 60 + +m[2], +m[3] * 60 + +m[4]]);
  return out;
}
// 사내 블록 형식(references/seedance-prompting.md)의 블록 — 대문자만으로 된 줄이 제목이다
function blocksOf(p) {
  const out = {};
  let cur = null;
  for (const line of String(p).split("\n")) {
    const h = line.trim();
    if (/^[A-Z][A-Z /&]{2,38}$/.test(h)) { cur = h.replace(/\s+/g, " "); out[cur] = ""; }
    else if (cur) out[cur] += line + "\n";
  }
  return out;
}
// 레퍼런스→영상에서 구도를 그림(파일 [Image N] 이든 엘리먼트 @{이름} 이든)에 맡기는 문장(10/14 "matching the camera position of [Image 1]") — 그림은 생김새·재질·빛만 맡는다
const FRAMING_FROM_IMAGE = /\b(?:camera (?:position|placement|angle|height|setup)|framing|composition|viewpoint|point of view|vantage)\s+(?:of|from|in|as in|shown in|seen in)\s+(?:\[Image \d+\]|@\{[^}\n]+\})|\bmatch(?:es|ing)?\s+(?:the\s+)?(?:camera|framing|composition|view|angle)\b[^.\n]{0,40}(?:\[Image \d+\]|@\{[^}\n]+\})|\b(?:close to|as in|like) the (?:view|angle|framing|composition|shot) of (?:\[Image \d+\]|@\{[^}\n]+\})/i;
function lintPrompt(j, { mode, omniTask, lang, model, duration }) {
  const p = String(j.prompt);
  // hard = 앱·BytePlus 가 실패하거나 바인딩이 깨지는 것(사용자 형식이어도 멈춤) · house = 사내 쓰는 법 점검(user_format 이면 확인할 것으로만)
  const out = [];
  const house = [];
  const bare = p.replace(/"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’|「[^」\n]*」|『[^』\n]*』/g, "");
  // 대사 표시 { } 안(엘리먼트 @{이름} 은 빼고)도 그 언어 그대로 둔다 — She whispers {괜찮아} in Korean.
  if (lang !== "ko" && /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(bare.replace(/(^|[^@])\{[^{}\n]*\}/g, "$1"))) {
    out.push("본문이 한국어다 — 영어로 쓴다(대사·화면 글자만 따옴표나 대사 표시 { } 안에 그 언어로). 사용자용 한국어 요약은 확인 카드에");
  }
  if (/@(?:Image|Video|Audio) ?\d/i.test(p)) out.push("@Image1 은 공식 스킬의 표기다 — 앱에서는 [Image 1] · [Video 1] · [Audio 1] (대괄호, 띄어 씀)");
  const marks = [...p.matchAll(/\[(Image|Video|Audio) (\d+)\]/g)];
  if (omniTask === "edit" || omniTask === "extend") {
    if (marks.length) out.push(`Omni ${omniTask} 는 앱이 [Video N] 같은 표시를 지우고 보낸다 — "the source video" 처럼 말로 쓴다`);
  } else if (FRAME_MODES.includes(mode) || omniTask === "image_to_video" || j.refs.some((r) => r.role === "first_frame" || r.role === "last_frame")) {
    if (marks.length) out.push("첫·끝 프레임 모드는 그림을 refs 의 role 로 묶는다 — [Image N] 을 쓰지 말고 그 장면에서 무엇이 일어나는지만 쓴다(앱이 프레임은 알약으로 안 바꿔 글자로 남는다)");
  } else {
    const have = { Image: 0, Video: 0, Audio: 0 };
    for (const r of j.refs) for (const k of Object.keys(KINDS)) if (KINDS[k].test(r.path)) have[k]++;
    for (const [m, k, n] of marks) if (Number(n) > have[k]) out.push(`${m} — 넘긴 레퍼런스 중 ${k} 는 ${have[k]}개뿐이다`);
    if ((mode === "multimodal_reference" || omniTask === "reference_to_video") && j.refs.length && !marks.length) {
      out.push("레퍼런스→영상인데 [Image N] 이 없다 — 레퍼런스마다 맡을 역할을 [Image 1] 처럼 적어 묶는다(앱이 알약으로 바인딩한다)");
    }
  }
  if (/seedance/.test(model || "")) {
    // 앱 설명서: 본문에 소수 길이 지시를 쓰면 BytePlus 가 내부 오류로 실패한다
    const dec = bare.match(/\b\d+\.\d+\s*(?:s|secs?|seconds?)\b/i);
    if (dec) out.push(`소수 초("${dec[0]}")가 있다 — BytePlus 가 실패시킨다. 타임코드는 정수 초(0–2s, 2–5s)로, 짧은 사이는 말로(half a second)`);
    const end = Math.max(0, ...timecodes(bare).map(([, b]) => b));
    if (duration > 0 && end > duration) house.push(`타임코드가 ${end}초까지 간다 — 길이는 ${duration}초다. 0초부터 ${duration}초 안에서 빈틈없이 나눈다`);
    const lean = mode === "multimodal_reference" && bare.match(FRAMING_FROM_IMAGE);
    if (lean) {
      house.push(`구도를 레퍼런스 그림에 맡겼다("${lean[0].slice(0, 60)}") — 레퍼런스→영상에서 그림은 생김새·재질·빛만 맡는다. ` +
        "카메라 자리·화각·거리는 글로 쓰고(seedance-prompting 2절), 그림 구도 그대로가 필요하면 첫 프레임 모드로");
    }
  }
  // 시댄스 2.5 공식 템플릿(sd25-pe) 기준 — 10/12 알파젠 10케이스를 코드 틀로 찍어내 끝 상태·대사 없음 제약이 빠지고 틀 문구가 남았던 것
  if (/seedance-2-5/.test(model || "") && lang !== "ko") {
    // 공식 목표 문장 = "Generate <core event>. The core subject is <subject>, and the principal event is <summary>."
    const goal = p.match(/【Generation Goal】([\s\S]*?)(?=【|$)/)?.[1] || "";
    if (/\b(event|events|action|sequence|script) below\b|\bthe referenced (subjects?|assets?|characters?)\b/i.test(goal)) {
      house.push("【Generation Goal】 이 '레퍼런스 주체'·'아래 사건'만 가리킨다 — 공식 템플릿대로 핵심 주체와 주된 사건을 목표 문장에 직접 쓴다");
    }
    const ev = p.match(/【Event Script】([\s\S]*?)(?=【|$)/);
    if (ev && !/\bat the end\b/i.test(ev[1])) {
      house.push("【Event Script】 에 끝 상태가 없다 — 공식 템플릿대로 At the start … / Principal event … / At the end …(끝의 위치·자세·상태)");
    }
    const blocks = blocksOf(p);
    if ("ACTION" in blocks && !("FINAL FRAME" in blocks) && !/\bat the end\b|\b(?:shot|take|clip|video) ends\b|\b(?:last|final) frame\b/i.test(p)) {
      house.push("끝 상태가 없다 — ACTION 다음에 FINAL FRAME 블록(마지막 프레임에 누가·무엇이 어디에, 무엇이 멈춰 있고 무엇이 움직이는지)");
    }
    // 대사 표시는 { } — 엘리먼트 멘션 @{이름} 은 대사가 아니다
    const talks = /(^|[^@])\{[^}\n]+\}|\b(says|said|asks|whispers|shouts|speaks|replies|calls out|sings)\b/i.test(p);
    if (!talks && !(/\bno (dialogue|narration|speech|voice-?over)\b/i.test(p) && /\b(subtitles?|on-screen text|captions?)\b/i.test(p))) {
      house.push("대사 없는 장면 제약이 없다 — 공식대로 'No dialogue or narration; mouths stay naturally closed. No subtitles or on-screen text.' 를 넣는다");
    }
    if (/<(subject|summary|placeholder|relationship|fixed features|observable state|final visual state|initial state|starting state|main event)\b[^>]*>/i.test(p)) {
      house.push("템플릿 자리표(<subject> 등)가 남았다 — 그 장면의 구체 내용으로 바꾼다");
    }
    for (const line of p.split("\n")) {
      const use = line.match(/use only ([^;.]*)/i)?.[1] || "";
      if (/\b[a-z]+ or [a-z]+\b/i.test(use)) {
        house.push(`'use only' 목록에 'A or B' 같은 틀 문구가 남았다 — 이 그림에서 쓸 것만 구체적으로: "${use.trim().slice(0, 70)}"`);
        break;
      }
    }
    for (const line of p.split("\n")) {
      if (/use only/i.test(line) && /\b(views|sheet|turnaround|jointly define)\b/i.test(line) && !/\b(backdrop|background|panel|layout)\b/i.test(line)) {
        house.push("인물 시트 레퍼런스에 제외 문구가 없다 — 같은 줄에 \"do not use the sheet's gray backdrop or panel layout\"");
        break;
      }
    }
  }
  return { hard: [...new Set(out)], house: [...new Set(house)] };
}

// 논리 점검(references/prompt-logic.md) 중 글로 짚을 수 있는 것 — 막지 않고 "확인할 것"으로 보여 준다
// (발에서 얼굴로 틸트업하는 컷, 박자 맞춘 빠른 편집처럼 맞는 경우가 있다).
function logicNotes(j, { model, duration, ratio }) {
  if (!/seedance/.test(model || "")) return [];
  const p = String(j.prompt).replace(/"[^"\n]*"/g, "");
  const notes = [];
  // 레퍼런스 줄(시트의 '전신 칸' 같은 말)은 빼고 컷마다 본다
  const refBlock = blocksOf(p)["ACTIVE REFERENCES"] || "";
  const body = (refBlock ? p.replace(refBlock, "") : p).split("\n").filter((l) => !/\[(?:Image|Video|Audio) \d+\]|@\{/.test(l)).join("\n");
  // 블록(머리 줄)마다, 그 안에서 컷 표시마다 나눠 본다 — 모순은 한 컷 안에서만이다. 컷 표시는 줄 첫머리든 문장 중간이든
  // CUT 2 · SHOT 2 · Segment 2(사용자 프롬프트북 말투) · HARD CUT · 0–2s. 사용자 프롬프트북 126컷에 대 보고 블록·문장 중간 컷을 나눴다
  const cutMark = /(?=\b(?:CUT|SHOT|Shot|Cut|Segment|SEGMENT)\s*\d+\b|\b(?:HARD|SMASH|MATCH|INSERT|WHIP|REVERSE) CUT\b|\b\d+(?:\.\d+)?\s*s?\s*(?:–|-|to)\s*\d+(?:\.\d+)?\s*s\b)/;
  for (const s of body.split(/\n(?=[A-Z][A-Z /&]{2,38}(?:\n|$))/).flatMap((b) => b.split(cutMark))) {
    if (/\b(?:extreme close-?up|close-?up|ECU|MCU|CU|macro)\b/i.test(s) && /\b(?:face|eyes?|lips|mouth|expression)\b/i.test(s) &&
        /\b(?:feet|foot|shoes?|sneakers|boots|full[- ]body|full[- ]length (?:shot|view|figure|portrait)|full figure|head to (?:toe|shoes?))\b/i.test(s)) {
      notes.push("클로즈업이라고 쓴 컷에 얼굴과 발·신발·전신이 같이 있다 — 한 화면에 함께 안 들어온다. 둘 다 필요하면 카메라 움직임(틸트업·푸시인)이나 컷으로 나누고 그 움직임을 적는다");
    }
    if (/\b(?:extreme wide|wide shot|establishing shot|EWS)\b/i.test(s) && /\b(?:pores?|eyelash(?:es)?|catch-?lights?|irises?|freckles?)\b/i.test(s)) {
      notes.push("와이드라고 쓴 컷에 모공·속눈썹 같은 세부가 있다 — 그 거리에선 보이지 않는다");
    }
  }
  const nums = new Set([...p.matchAll(/\b(?:CUT|SHOT|Shot|Segment|SEGMENT)\s*(\d+)\b/g)].map((m) => m[1]));
  const hard = (p.match(/\b(?:HARD|SMASH|MATCH|INSERT|WHIP|REVERSE) CUT\b/g) || []).length;
  const cuts = Math.max(nums.size, hard ? hard + 1 : 0);
  if (duration > 0 && cuts >= 2 && duration / cuts < 2) {
    notes.push(`${duration}초에 컷 ${cuts}개 — 컷마다 2초가 안 된다. 4–5초면 사건 하나·컷 2개까지(seedance-prompting 5절). 박자 맞춘 빠른 편집이면 그대로`);
  }
  // 컷이 둘 이상인데 화면 방향(축) 문장이 하나도 없으면 컷마다 좌우가 뒤집히기 쉽다 — 180° · 30° 는 기본(사용자 10/14, seedance-quality 5절)
  const sides = /\bscreen[- ]?(?:left|right)\b|\bframe[- ](?:left|right)\b|\b(?:left|right)[- ](?:third|half|edge|side) of (?:the )?frame\b|\b(?:left|right) third\b|\bcamera[- ](?:left|right)\b|\bx ?\d{1,3} ?%|\baxis\b|\bline of action\b|\b180\b/i;
  if (cuts >= 2 && !sides.test(p.replace(/(^|[^@])\{[^{}\n]*\}/g, "$1"))) {
    notes.push(`컷이 ${cuts}개인데 화면 방향 문장이 없다 — 축(두 사람을 잇는 선이나 움직이는 방향)과 카메라가 선의 어느 쪽인지, 컷마다 누가 화면 왼쪽 · 오른쪽이고 어느 쪽을 보는지 적는다(seedance-quality 5절 · 180°)`);
  }
  const tc = timecodes(p);
  if (duration > 0 && tc.length && Math.max(...tc.map(([, b]) => b)) < duration) {
    notes.push(`타임코드가 ${Math.max(...tc.map(([, b]) => b))}초에서 끝난다 — 길이 ${duration}초의 남은 시간은 모델이 지어낸다. 끝까지 나누거나 FINAL FRAME 에 머무는 시간을 적는다`);
  }
  // 커뮤니티 품질 규칙(references/seedance-quality.md) 중 글로 짚을 수 있는 것 — 대사 { } 와 따옴표 안 글자는 빼고 본다.
  // 사용자의 잘 쓴 프롬프트(외주 프롬프트북 126컷)에 대 보고 괜히 걸리던 것은 뺐다 — 렌즈의 'fast prime', 'no zoom' 같은 잠금,
  // '8K capture detail' 같은 디테일 묘사, 잠금 문장의 부정형(never moves on its bracket)
  const prose = p.replace(/(^|[^@])\{[^{}\n]*\}/g, "$1");
  const fast = prose.match(/\b(?:walk|run|sprint|drive|move|rush|race|speed|charge|dash|swerve|spin|turn|swing|fly|chase|ride|climb|fall)(?:s|es|ed|ing)?\b(?:\s+\w+){0,2}?\s+(?:fast|quickly|rapidly)\b|\b(?:fast|quickly|rapidly)[- ]moving\b/i);
  if (fast && !/\d\s*(?:km\/h|m\/s|mph)\b/i.test(prose)) {
    notes.push(`"${fast[0]}" — 움직임의 빠르기는 km/h·m/s 나 보폭·접촉으로 쓴다(복잡한 움직임에서 'fast' 가 화면을 가장 많이 흔든다는 관찰 — seedance-quality 1절 7)`);
  }
  // 빈 수식어만 — 'hyperrealistic photographic detail — pores …' 처럼 바로 디테일을 붙이는 말은 사용자 프롬프트북도 쓴다
  const slop = [...new Set((prose.match(/\b(?:cinematic|epic|stunning|breathtaking|masterpiece|award[- ]winning|best quality)\b/gi) || []).map((w) => w.toLowerCase()))];
  if (slop.length) notes.push(`그림이 안 되는 말(${slop.join(", ")}) — 지우고 보이는 것(빛의 방향·렌즈·재질·동작)으로 바꾼다(seedance-quality 1절 8)`);
  // 비율은 설정이 정한다 — 본문에 적은 비율이 이 작업의 비율 설정과 다르거나 서로 다르면 모순
  const ratios = [...new Set(prose.match(/\b(?:16:9|9:16|21:9|9:21|4:3|3:4|1:1|2\.39:1|2\.35:1)\b/g) || [])];
  const fixed = /^\d+(?:\.\d+)?:\d+$/.test(String(ratio || "")) ? String(ratio) : "";
  if (ratios.length > 1 || (fixed && ratios.length && !ratios.includes(fixed))) {
    notes.push(`본문의 비율(${ratios.join(", ")})이 ${fixed && !ratios.includes(fixed) ? `설정 ${fixed} 와` : "서로"} 다르다 — 비율은 설정이 정한다. 본문에서 지우거나 설정과 맞춘다`);
  }
  // 'zoom' 은 화각이 바뀌는 것 — 'no zoom', 'never by a zoom' 같은 잠금은 그대로 둔다
  const zoomed = [...prose.matchAll(/(?<!crash |dolly |snap )\bzoom(?:s|ed|ing)?\b/gi)]
    .some((m) => !/\b(?:no|never|not|nothing|nor|without|rather than|instead of)\b[^.;:]{0,30}$/i.test(prose.slice(Math.max(0, m.index - 40), m.index)));
  if (zoomed) {
    notes.push("'zoom' 은 화각이 바뀌는 것 — OPTICS 의 화각 고정과 부딪힌다. 카메라가 다가가는 거면 push in·dolly in, 정말 줌이면 OPTICS 에 시작·끝 화각을 적는다(seedance-quality 4절)");
  }
  // 짧은 대사 + 긴 원테이크 = 남는 시간을 지어낸 웅얼거림으로 채운다(커뮤니티 측정, 시댄스 2.0 영어). 한국어는 세 글자를 한 단어로 어림한다
  const lines = [...String(j.prompt).matchAll(/(?:^|[^@])\{([^{}\n]+)\}/g)].map((m) => m[1]);
  if (lines.length && cuts <= 1 && duration >= 4 && !/\bsilen(?:t|ce)\b/i.test(prose)) {
    const words = lines.reduce((a, l) => a + (/[가-힣]/.test(l) ? Math.ceil((l.match(/[가-힣]/g) || []).length / 3) : l.split(/\s+/).filter((w) => /\w/.test(w)).length), 0);
    if (words <= 6) notes.push(`대사가 ${words}단어 남짓인데 한 컷 ${duration}초다 — 남는 시간을 지어낸 웅얼거림으로 채우기 쉽다. 대사를 늘리거나, 길이를 줄이거나, 말 뒤 침묵을 행동으로 적는다(seedance-quality 3절)`);
  }
  return [...new Set(notes)];
}

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
      if (e.code !== "EEXIST") throw e;
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

// 연결 거부가 아닌 연결 실패는 실행 환경(Codex 샌드박스 등)이 네트워크를 막은 것일 수 있다.
const BLOCKED = "이 실행 환경이 네트워크를 막고 있다(예: Codex 샌드박스 — network_access 꺼짐). 앱이 켜져 있어도 이렇게 나온다. 네트워크가 허용된 상태(샌드박스 밖, 실행 승인)로 이 명령을 다시 실행할 것";
const MAX_IN_FLIGHT = 3;   // 열린 프로젝트에서 동시에 진행 중인(대기 포함) 영상
const DONE = new Set(["succeeded", "failed", "cancelled", "canceled", "expired"]);
// 과금되는 명령과 만들 수 있는 영상 수(재생성은 원래 보낸 개수를 따르므로 최대로 잡는다).
const COSTLY = { "card.final": 1, "card.regenerate": MAX_IN_FLIGHT };

// 커넥터 — 사용 기록과 하루 한도. 표는 커넥터가 내려줄 때 채운다(이 줄의 모양을 바꾸지 말 것).
const FREEWILL = "https://freewill-mcp.production-khu.workers.dev";
const FREEWILL_TICKET = "";
// 지침 버전 — 커넥터가 내려줄 때 채운다(이 줄 모양도 바꾸지 말 것). jobs.json 의 "guide" 와 다르면 이 대화가 읽은 지침이
// 옛것이다 → 보내지 않고 다시 읽게 한다(앱 설명서 버전과 같은 방식). 비어 있으면(커넥터에서 받은 게 아니면) 보지 않는다.
const FREEWILL_GUIDE = "";
const GUIDE_STALE = (had) => `지침이 바뀌었다 (이 대화가 읽은 지침 ${had || "버전 없음"} → 지금 ${FREEWILL_GUIDE}) — ` +
  `freewill_guide("start") 를 다시 받아 읽고 바뀐 규칙대로 프롬프트·확인 카드를 고친 뒤, jobs.json 에 "guide": "${FREEWILL_GUIDE}" 를 ` +
  "적어 다시 실행할 것. 프롬프트·설정이 달라졌으면 확인 카드부터 다시. 사용자에게 지침 버전 얘기는 하지 않는다";

// 표 안의 이름·만료만 읽는다(서명은 커넥터가 확인한다). 없거나 만료면 null.
function ticketOwner() {
  if (!FREEWILL_TICKET) return null;
  try {
    const b = FREEWILL_TICKET.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    const t = JSON.parse(Buffer.from(b, "base64").toString("utf8"));
    return t.x > Date.now() ? t : null;
  } catch { return null; }
}
// 표가 없으면(플러그인에 깔린 사본처럼 커넥터를 거치지 않음) 사람이 커넥터에 로그인해야 하고, 만료면 다시 받기만 하면 된다.
const NO_TICKET = !FREEWILL_TICKET
  ? "이 스크립트는 프리윌 스튜디오 MCP 커넥터에서 받은 것이 아니라(플러그인에 깔린 사본 등) 앱으로 보낼 수 없다. " +
    "freewill_script 도구가 있으면 freewill_script(\"send-to-seedance\") 로 받아 그 원문을 실행할 것. " +
    "도구가 없으면 커넥터 로그인 전이다 — 지침(SKILL.md)의 '로그인' 대로 에이전트가 로그인을 시작할 것 " +
    "(사람은 브라우저에서 회사 구글 계정만 고른다, 사용자에게 터미널 명령을 시키지 않는다). " +
    "나노바나나·시댄스 앱에는 로그인할 곳이 없으니 앱 안의 버튼·키를 지어내 안내하지 말 것"
  : "받은 지 12시간이 지난 스크립트다 — freewill_script(\"send-to-seedance\") 로 다시 받아 실행할 것(사용자가 할 일은 없다)";

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
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${FREEWILL_TICKET}` },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Stop(`사용 기록 서버(프리윌 스튜디오 MCP)에 닿지 않아 보내지 않는다 — 인터넷 연결을 확인하거나, ${BLOCKED}`);
  }
  const j = await r.json().catch(() => null);
  // JSON 이 아닌 답 = 커넥터까지 못 감(클라우드플레어가 대신 답함). 기록이 안 남으니 보내지 않는다.
  if (!j) {
    return { http: r.status, ok: false, error: r.status === 429
      ? "클라우드플레어 무료 하루 한도(계정 전체 요청 10만 번)에 걸려 사용 기록을 남길 수 없다 — 한국 시간 오전 9시에 풀린다. 그때까지 MCP 로는 보내지 않는다(급하면 앱에서 직접)"
      : `사용 기록 서버가 지금 답하지 않는다(HTTP ${r.status}) — 잠시 뒤 다시. 기록이 안 남으니 보내지 않는다` };
  }
  return { http: r.status, ...j };
}

// 앱에 넣기 전에 기록을 남기고 한도를 묻는다. 거절이면 멈춘다. 돌려주는 settle(n) 로 실제 개수를 맞추거나(0 이면 무름).
async function reserve(n, meta) {
  if (!ticketOwner()) fail(NO_TICKET);
  const r = await usageApi("POST", "/usage", { app: "seedance", n, pc: os.hostname(), user: os.userInfo().username, device: device(), ...meta });
  if (!r.ok) fail(r.error || `사용 기록을 남기지 못함 (${r.http})`);
  return { ...r, settle: (actual) => (actual === n ? Promise.resolve() : usageApi("POST", "/usage/settle", { id: r.id, n: actual }).catch(() => {})) };
}

async function req(method, p, body, ms = 10000) {
  const r = await fetch(`${SD}${p}`, {
    method, headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(ms),
  });
  const text = await r.text();
  try { return { http: r.status, ...JSON.parse(text) }; } catch { return { http: r.status, raw: text.slice(0, 200) }; }
}
const get = (p) => req("GET", p);
const post = (p, b, ms) => req("POST", p, b, ms);

// 멈출 때는 던져서 main 끝에서 정리한다. process.exit() 를 바로 부르면 윈도의 Node 가 fetch 연결을 닫는 중에
// 죽는다(libuv assertion, exit 127) — 에이전트에게는 엉뚱한 오류로 보인다.
class Stop extends Error { constructor(msg, quiet = false) { super(msg); this.quiet = quiet; } }
function fail(msg) {
  throw new Stop(msg);
}

async function appStatus(manual) {
  let s;
  try { s = await get(`/api/agent/status${manual ? `?manual=${encodeURIComponent(manual)}` : ""}`); }
  catch (e) {
    const code = e?.cause?.code || (e?.name === "TimeoutError" ? "시간 초과" : e?.name || "오류");
    fail(code === "ECONNREFUSED" ? "시댄스가 꺼져 있다 — 앱을 켜 달라고 할 것" : `시댄스에 연결 못 함 (${code}) — ${BLOCKED}`);
  }
  // 작업함이 없는 옛 버전은 이 주소에 화면(HTML)이나 404 를 준다.
  if (!s || s.ok !== true) fail("이 PC 의 시댄스는 에이전트 연결 전 버전이다 — 앱을 껐다 켜서 업데이트(26.10.304 이상)해 달라고 할 것");
  return s;
}

async function readManual() {
  const m = await get("/api/agent/manual");
  if (m.http !== 200 || !m.version) fail(m.error || "앱이 설명서를 주지 않는다 — 앱 창이 열려 있는지 확인해 달라고 할 것");
  return m;
}

// 앱이 업데이트됐다 — 새 설명서를 통째로 보여 주고 멈춘다. 에이전트는 이걸 기준으로 확인 카드를 다시 보여 준 뒤
// jobs.json 의 manual 을 새 버전으로 바꿔 다시 보낸다.
async function staleStop(notice) {
  const m = await readManual();
  rememberManual(m.version);   // 새 설명서를 지금 보여 줬으니 --do 는 이 버전으로
  console.error(`멈춤: ${notice}`);
  log("", "──── 새 설명서 ────", "", m.text);
  log(`새 설명서 버전: ${m.version}`);
  log("이 설명서로 설정·확인 카드를 다시 정리해 사용자에게 보여 주고, jobs.json 의 \"manual\" 을 위 버전으로 바꿔 다시 보낼 것.");
  throw new Stop("", true);
}

// 앱 기능 명령 — 결과가 올 때까지 기다린다(서버가 60초 붙들고, 더 걸리면 이어서 묻는다).
async function runCommand(name, cargs) {
  const manual = rememberedManual();
  if (!manual) fail("설명서를 먼저 읽을 것 — node send-to-seedance.mjs --manual (그때 버전을 기억해 둔다)");
  const s = await appStatus(manual);
  if (!s.screenAlive) fail("시댄스 서버는 켜져 있지만 앱 화면이 응답하지 않는다 — 앱 창이 열려 있는지 확인해 달라고 할 것");
  if (s.manualStale) await staleStop(s.notice || "앱이 업데이트됐다");
  return sendCommand(manual, name, cargs);
}

async function sendCommand(manual, name, cargs) {
  let r = await post("/api/agent/commands", { manual, command: name, args: cargs, wait: 60 }, 75000);
  if (r.http === 409 && r.stale) await staleStop(r.error);
  if (r.http !== 200 || !r.id) fail(r.error || r.raw || `HTTP ${r.http}`);
  while (r.status === "pending" || r.status === "taken") {
    await sleep(2000);
    r = await get(`/api/agent/commands/${encodeURIComponent(r.id)}`);
    if (r.http !== 200) fail(r.error || "명령이 사라짐(앱을 다시 켰나?)");
  }
  if (r.status === "failed") fail(`${name} 실패 — ${r.error || "이유 없음"}`);
  return r.result;
}

// 열린 프로젝트에서 아직 안 끝난(대기·생성 중) 영상 — 카드 하나가 영상 하나다. 명령이 없는 앱(26.10.304)이면
// 이번에 보낸 요청의 카드만 센다.
async function inFlight(manual, project, ownIds = []) {
  try {
    const r = await sendCommand(manual, "cards.list", { project, limit: 100 });
    return (r?.cards || []).filter((c) => !DONE.has(c.status)).length;
  } catch (e) {
    if (e instanceof Stop && e.quiet) throw e;   // 앱이 업데이트됨 — 새 설명서를 이미 보여 줬다
    let n = 0;
    for (const id of ownIds) {
      const j = await get(`/api/agent/jobs/${encodeURIComponent(id)}`);
      n += (j.messages || []).filter((c) => !DONE.has(c.status)).length;
    }
    return n;
  }
}

async function waitForRoom(manual, project, need, ownIds) {
  let last = -1, changedAt = Date.now();
  for (;;) {
    const n = await inFlight(manual, project, ownIds);
    if (n + need <= MAX_IN_FLIGHT) return;
    if (n !== last) {
      log(`  기다리는 중 — "${project}" 에서 진행 중인 영상 ${n}개(동시 ${MAX_IN_FLIGHT}개 한도). 끝나는 대로 이어서 보낸다`);
      last = n;
      changedAt = Date.now();
    }
    if (Date.now() - changedAt > 45 * 60 * 1000) fail(`진행 중인 영상이 45분째 ${n}개 그대로 — 앱 화면을 확인해 달라고 할 것`);
    await sleep(10000);
  }
}

// 오늘 한도 — 표가 없으면(받은 스크립트가 아니면) dry-run 만 되고 보내기는 멈춘다.
async function quota(n, what) {
  const owner = ticketOwner();
  if (!owner) {
    if (!DRY) fail(NO_TICKET);
    return "로그인 표 없음 — 보낼 때는 커넥터에서 다시 받은 스크립트로";
  }
  // 하루 한도는 PC(PC 이름 + 윈도 사용자) 기준 — 관리자가 계정 전체 상한을 걸어 두면 더 빡빡한 쪽이 온다(scope)
  const host = os.hostname();
  const me = await usageApi("GET", `/usage/me?pc=${encodeURIComponent(host)}&user=${encodeURIComponent(os.userInfo().username)}&device=${encodeURIComponent(device())}`);
  if (me.http === 401 || me.http === 403) fail(me.error || NO_TICKET);   // 403 = 관리자가 막은 계정
  const q = me.apps?.seedance;
  if (!q) fail(me.error || `사용 기록 서버가 답하지 않는다 (${me.http}) — 잠시 뒤 다시`);
  if (q.limit === 0) fail(`${q.scope === "account" ? `${owner.e} 계정은` : `이 PC(${host})는`} 관리자가 MCP 영상 생성을 막아 두었다 — 관리자에게 물을 것`);
  if (q.used + n > q.limit) {
    fail(`오늘 ${q.scope === "account" ? `${owner.e} 계정(모든 PC 합계)이` : `이 PC(${host})가`} MCP 로 보낸 영상 ${q.used}개 — ` +
      `하루 ${q.limit}개 한도라 이번 요청(${what})은 보내지 않는다. 개수를 줄이거나 내일 보내고, 급하면 앱에서 직접 하게 할 것`);
  }
  return `${owner.e} · ${host} · 오늘 남은 한도 ${q.limit - q.used}개`;
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

// 작업 페이지(make-review)의 '보낼 것' — 보내기 전에 레퍼런스를 그림으로 본다(사용자 10/20 "돌리기 전에 어떤 레퍼런스 쓸 건지 시각적으로").
// jobs.json 에 "work"(작업 폴더)가 있을 때만. 보낸 뒤에는 '보냄'으로 바꾸고, 보낸 jobs.json 을 그 작업 폴더의 05_프롬프트 에 남긴다.
function writePlan(spec, plan, { sent = false, jobsFile = "" } = {}) {
  if (!spec.work) return;
  const work = path.resolve(String(spec.work));
  if (!fs.existsSync(work)) { log(`  참고: 작업 폴더가 없다(${work}) — 보낼 것을 남기지 않았다`); return; }
  try {
    const dir = path.join(work, "_검수");
    fs.mkdirSync(dir, { recursive: true });
    const now = new Date().toISOString();
    fs.writeFileSync(path.join(dir, "보낼것.json"), JSON.stringify({ ...plan, at: now, sent, ...(sent ? { sentAt: now } : {}) }, null, 1));
    if (sent && jobsFile) {
      const pd = path.join(work, "05_프롬프트");
      fs.mkdirSync(pd, { recursive: true });
      const to = path.join(pd, path.basename(jobsFile));
      if (path.resolve(to) !== path.resolve(jobsFile)) fs.copyFileSync(jobsFile, to);
    }
    log(`  작업 페이지 '보낼 것'${sent ? "을 보냄으로 바꿨다(jobs.json 은 05_프롬프트 에)" : "에 레퍼런스를 올렸다 — 페이지에서 그림으로 보여 준 뒤 확인 카드로"}: ${path.join(dir, "보낼것.json")}`);
  } catch (e) { log(`  참고: 보낼 것을 못 남김 — ${e.message}`); }
}

async function main() {
  if (MANUAL) {
    await appStatus();
    const m = await readManual();
    rememberManual(m.version);
    log(m.text);
    log(`설명서 버전: ${m.version} — jobs.json 의 "manual" 에 이 값을 그대로 적는다(--do 는 알아서 쓴다).`);
    return;
  }
  if (DO) {
    const [name, raw] = positional;
    if (!name) fail("--do 뒤에 명령 이름을 주세요 (설명서의 '명령' 목록)");
    let cargs = {};
    if (raw) { try { cargs = readJsonArg(raw); } catch (e) { fail(`인자 JSON 을 못 읽음 — ${e.message}`); } }
    // 과금되는 명령도 하루 한도와 동시 진행 한도를 지킨다.
    const need = COSTLY[name] || 0;
    let rsv = null;
    if (need) {
      const manual = rememberedManual();
      if (!manual) fail("설명서를 먼저 읽을 것 — node send-to-seedance.mjs --manual (그때 버전을 기억해 둔다)");
      await quota(need, name);
      const s = await appStatus(manual);
      if (s.project) await waitForRoom(manual, s.project, need, []);
      rsv = await reserve(need, { kind: name, project: s.project, billing: s.billing, job: String(cargs?.id || "") });
    }
    let result;
    try {
      result = await runCommand(name, cargs);
    } catch (e) {
      if (rsv) await rsv.settle(0);
      throw e;
    }
    if (rsv) await rsv.settle(Array.isArray(result?.cards) ? result.cards.length : 1);
    log(JSON.stringify(result, null, 2));
    return;
  }
  if (STATUS) {
    if (!positional.length) fail("--status 뒤에 요청 id 를 주세요");
    await appStatus();
    return showStatus(positional);
  }
  const file = positional[0];
  if (!file) fail("작업 파일(jobs.json)을 주세요");
  let spec;
  try { spec = JSON.parse(fs.readFileSync(file, "utf8").replace(new RegExp("^" + String.fromCharCode(0xfeff)), "")); } catch (e) { fail(`작업 파일을 못 읽음 — ${e.message}`); }
  if (!spec.manual) fail("jobs.json 에 \"manual\"(읽은 설명서 버전)이 없다 — 먼저 --manual 로 앱의 설명서를 읽고 그 버전을 적을 것");
  if (FREEWILL_GUIDE && spec.guide !== FREEWILL_GUIDE) fail(GUIDE_STALE(spec.guide));
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

  // 1) 앱 상태 — 설명서가 그대로인지, 켜져 있는지, 프로젝트·과금이 골라져 있는지, 작성 칸이 있는지
  let s = await appStatus(spec.manual);
  if (!s.screenAlive) fail("시댄스 서버는 켜져 있지만 앱 화면이 응답하지 않는다 — 앱 창이 열려 있는지 확인해 달라고 할 것");
  if (s.manualStale) await staleStop(s.notice || "앱이 업데이트됐다");
  // 사용자가 이 작업용으로 만들어 둔 프로젝트(jobs.json "project")가 안 열려 있으면 연다 — 사이드바 클릭과 같은 앱 명령(project.open).
  // 과금 프로젝트는 앱 전체에 하나다(앱을 켤 때마다 고르고 저장되지 않는다) — 연 뒤에도 확인 카드의 과금(billing)과 같은지 본다.
  // (10/15 사용자 "프로젝트 세팅이랑 과금 다 정해 주고 탭도 만들어 줬는데 항상 클릭해 줘야 하는 이유는?")
  if (spec.project && spec.project !== s.project) {
    const before = s.project || "없음";
    let names = null;
    try {
      const pl = await sendCommand(spec.manual, "projects.list", {});
      names = (Array.isArray(pl) ? pl : pl?.projects || []).map((p) => p.name);
    } catch (e) {
      if (e instanceof Stop && e.quiet) throw e;   // 앱이 업데이트됨 — 새 설명서를 이미 보여 줬다
      fail(`앱에 열린 프로젝트는 "${before}" — 확인한 "${spec.project}" 와 다르다. 프로젝트를 열어 주는 명령을 못 썼다(${e.message}) — ` +
        `앱이 26.10.305 전이면 사용자가 앱에서 "${spec.project}" 를 열게 할 것`);
    }
    if (!names.includes(spec.project)) fail(`시댄스 사이드바에 "${spec.project}" 프로젝트가 없다 — 이름을 사이드바 그대로 적거나, 새로 만들지 사용자에게 물을 것(지침 6단계 작업 정리)`);
    await sendCommand(spec.manual, "project.open", { project: spec.project });
    s = await appStatus(spec.manual);
    if (s.project !== spec.project) fail(`"${spec.project}" 를 열지 못했다(지금 "${s.project || "없음"}") — 앱 화면을 확인해 달라고 할 것`);
    log(`시댄스에서 "${spec.project}" 프로젝트를 열었다 — 사이드바 클릭과 같음(그전 화면 "${before}")`);
  }
  if (!s.project) fail("앱에 열린 프로젝트가 없다 — jobs.json 에 \"project\"(사이드바 이름)를 적으면 스크립트가 연다. 모르면 사용자에게 물을 것");
  if (!s.billing) fail(`시댄스에 과금 프로젝트가 안 골라져 있다 — 사용자에게 앱 설정 패널 맨 위 "프로젝트" 드롭다운에서 골라 달라고 할 것(앱을 켤 때마다 다시 고른다 — 에이전트가 고르지 않는다)`);
  if (spec.billing && spec.billing !== s.billing) fail(`"${s.project}" 의 과금 프로젝트는 "${s.billing}" — 확인한 "${spec.billing}" 와 다르다. 사용자에게 확인할 것`);
  const project = spec.project || s.project;
  const billing = spec.billing || s.billing;
  log(`프로젝트 "${project}" · 과금 "${billing}" 로 ${jobs.length}건 ${DRY ? "보낼 예정 (dry-run — 아무것도 안 보냄)" : "보냄"} · 설명서 ${spec.manual}`);
  if (Array.isArray(s.allowedModels)) log(`  이 과금 프로젝트로 쓸 수 있는 모델: ${s.allowedModels.join(", ") || "(없음)"}${s.fourK ? " · 4K 가능" : ""}`);
  if (s.composer === false) log("  참고: 앱이 갤러리 화면이다 — 채팅 화면으로 돌아와야 받는다");
  if (s.pending) log(`  참고: 앱이 아직 받지 않은 요청이 ${s.pending}건 있다`);

  // 설정 키는 설명서에서 읽는다 — 앱에 새 설정이 생기면 그대로 넘어간다.
  const manual = await readManual();
  const keys = Object.keys(manual.manual?.settings || {});
  if (!keys.length) fail("설명서에 설정 키가 없다 — 앱을 다시 켜 볼 것");
  const settingsOf = (j) => {
    const out = {};
    for (const k of keys) { const v = j[k] ?? defaults[k]; if (v !== undefined && v !== null) out[k] = v; }
    return out;
  };
  const unknown = [...new Set(jobs.flatMap((j) => Object.keys({ ...defaults, ...j })).filter((k) =>
    !keys.includes(k) && !["name", "prompt", "refs", "prompt_language", "user_format"].includes(k)))];
  if (unknown.length) log(`  참고: 설명서에 없는 키는 보내지 않는다 — ${unknown.join(", ")}`);
  for (const j of jobs) {
    const model = j.model ?? defaults.model;
    if (model && Array.isArray(s.allowedModels) && !s.allowedModels.includes(model)) {
      log(`  주의: ${j.name || ""} 의 모델 ${model} 은 이 과금 프로젝트에 권한이 없다 — 앱이 막는다. 다른 모델을 사용자에게 물을 것`);
    }
  }
  // dry-run 에서 먼저 걸리게 — 확인 카드 전에 고친다
  // 사용자가 개인 스킬·자기 프롬프트·다른 형식을 주면(지침 0절) "user_format": true — 사내 쓰는 법 점검은 막지 않고 확인할 것으로만.
  // 앱·BytePlus 가 실패하는 것(표기·바인딩·레퍼런스 수·소수 초)은 그래도 멈춘다.
  const userFormat = (j) => Boolean(j.user_format ?? defaults.user_format);
  const nameOf = (j) => j.name || "(이름 없음)";
  const lints = jobs.map((j) => lintPrompt(j, { mode: j.mode ?? defaults.mode, omniTask: j.omniTask ?? defaults.omniTask, lang: j.prompt_language ?? defaults.prompt_language, model: j.model ?? defaults.model, duration: Number(j.duration ?? defaults.duration) }));
  const problems = jobs.flatMap((j, i) => [...lints[i].hard, ...(userFormat(j) ? [] : lints[i].house)].map((p) => `${nameOf(j)}: ${p}`));
  // 여러 작업을 코드 틀로 찍어내면 목표 문장이 같아진다 — 프롬프트가 통째로 같은(일부러 다시 보내는) 경우와 사용자 형식은 빼고
  const goals = jobs.filter((j) => !userFormat(j)).map((j) => ({ p: String(j.prompt), g: (String(j.prompt).match(/【Generation Goal】([\s\S]*?)(?=【|$)/)?.[1] ?? blocksOf(j.prompt)["SCENE CONTEXT"] ?? "").trim() }));
  const same = goals.filter((x, i) => x.g && goals.some((y, k) => k !== i && y.g === x.g && y.p !== x.p));
  if (same.length) problems.push(`여러 작업의 목표 문장(【Generation Goal】·SCENE CONTEXT)이 똑같다(${same.length}건) — 장면마다 주 대상·주 사건을 그 장면 내용으로 쓴다(공통 문장을 끼워 넣지 않는다)`);
  // 시댄스 2.5 출력 형식 — 안 적으면 앱의 지금 설정(사람이 mp4 로 바꿔 뒀을 수 있다)을 따른다. 사용자가 mp4 라고 하지 않았으면 mov(편집용)
  // (사용자 10/20 "mp4 뽑으라고 미리 말하지 않는 이상 mov — 이 부분은 물어봐야지") — 작업을 시작할 때 한 번 묻고 defaults 에 적는다
  if (keys.includes("output_format")) {
    for (const j of jobs.filter((x) => /seedance-2-5/.test(x.model ?? defaults.model ?? "") && settingsOf(x).output_format === undefined)) {
      const msg = "output_format 이 없다 — 앱의 지금 설정을 따르게 된다. 시댄스 2.5 는 mov(편집용 · 앱 기본)가 기본이고 사용자가 mp4 라고 했을 때만 mp4 — 작업을 시작할 때 한 번 물어 defaults 에 적는다(지침 3단계)";
      if (userFormat(j)) log(`  확인: ${nameOf(j)} — ${msg}`);
      else problems.push(`${nameOf(j)}: ${msg}`);
    }
  }
  if (jobs.some(userFormat)) log(`  사용자 형식(user_format) ${jobs.filter(userFormat).length}건 — 사내 쓰는 법 점검은 막지 않고 아래 "확인할 것"으로만 보여 준다`);

  // 어셋 라이브러리 — 인물·장소·소품은 엘리먼트 @{이름} 이 기본(지침 6단계 시댄스 0). 지금 프로젝트에 연결된 컬렉션의 엘리먼트를
  // 보여 주고, 프롬프트의 @{이름} 이 거기 있는지 보내기 전에 본다(없으면 앱이 보낼 때 막는다). 프로젝트 하나에 컬렉션은 하나.
  const elementModes = ["multimodal_reference", "edit_video"];
  const modeOf = (j) => j.mode ?? defaults.mode;
  const mentions = (j) => [...new Set([...String(j.prompt).matchAll(/@\{([^}\n]+)\}/g)].map((m) => m[1].trim()))];
  const seedanceJob = (j) => /seedance/.test(j.model ?? defaults.model ?? "");
  let library = null;
  if (jobs.some((j) => seedanceJob(j) && (elementModes.includes(modeOf(j)) || mentions(j).length))) {
    try {
      const raw = await sendCommand(spec.manual, "collections.list", {});
      const bound = (Array.isArray(raw) ? raw : raw?.collections || []).filter((c) => (c.boundTo || []).includes(project));
      library = new Map(bound.flatMap((c) => (c.elements || []).map((e) => [e.name, { ...e, collection: c.name }])));
      log(library.size
        ? `  "${project}" 에 연결된 컬렉션 「${bound.map((c) => c.name).join("」「")}」의 엘리먼트 ${library.size}개: ${[...library.values()].map((e) => `@{${e.name}}`).join(" ")}`
        : `  "${project}" 에 연결된 엘리먼트 없음 — 다시 쓸 인물·장소·소품은 collection.create → elements.add → collection.bind 뒤 @{이름} 으로(지침 6단계 시댄스 0)`);
    } catch (e) {
      log(`  참고: 어셋 라이브러리를 못 읽음 — ${e.message} (앱 26.10.305 이상이면 --do collections.list)`);
    }
  }
  for (const j of jobs) {
    const names = mentions(j);
    if (names.length && seedanceJob(j) && !elementModes.includes(modeOf(j))) {
      problems.push(`${nameOf(j)}: 엘리먼트 @{${names[0]}} 는 레퍼런스→영상·영상 편집 모드에서만 된다 — 이 모드에선 그림 파일(refs)로`);
    }
    if (library) for (const n of names.filter((n) => !library.has(n))) {
      problems.push(`${nameOf(j)}: @{${n}} 가 "${project}" 에 연결된 컬렉션에 없다 — 이름을 고치거나 elements.add 로 등록(연결된 게 없으면 collection.bind)`);
    }
  }
  const notes = jobs.flatMap((j, i) => [
    ...logicNotes(j, { model: j.model ?? defaults.model, duration: Number(j.duration ?? defaults.duration), ratio: j.ratio ?? defaults.ratio }),
    ...(userFormat(j) ? lints[i].house.map((h) => `(사내 형식 기준) ${h}`) : []),
    ...(seedanceJob(j) && modeOf(j) === "multimodal_reference" && j.refs.some((r) => !r.role && KINDS.Image.test(r.path))
      ? [`그림 파일 ${j.refs.filter((r) => !r.role && KINDS.Image.test(r.path)).length}장을 [Image N] 으로 붙였다 — 다시 쓸 인물·장소·소품이면 어셋 라이브러리 엘리먼트로 등록해 @{이름} 으로 부른다(지침 6단계 시댄스 0)`]
      : []),
  ].map((n) => `${nameOf(j)}: ${n}`));
  const noteText = notes.length ? `\n  확인할 것 (논리 점검 — references/prompt-logic.md · seedance-quality.md · 맞는 경우면 그대로 둔다):\n${notes.map((n) => `  - ${n}`).join("\n")}` : "";
  if (problems.length) fail(`프롬프트를 고칠 것 (지침 4단계 '앱에 맞춘 규칙'):\n${problems.map((p) => `  - ${p}`).join("\n")}${noteText}`);
  if (noteText) log(noteText.slice(1));

  // 한도 — 하루 한도에 걸리면 하나도 보내지 않는다. output_count 를 안 적으면 앱 설정을 따르니 최대로 잡는다.
  const videosOf = (j) => {
    const n = Number(settingsOf(j).output_count);
    return n >= 1 ? Math.min(Math.round(n), MAX_IN_FLIGHT) : MAX_IN_FLIGHT;
  };
  if (jobs.some((j) => !(Number(settingsOf(j).output_count) >= 1))) {
    log(`  참고: output_count 를 안 적은 작업은 앱 설정을 따르므로 ${MAX_IN_FLIGHT}개로 잡고 센다(적어 두면 더 빨리 보낼 수 있다)`);
  }
  const total = jobs.reduce((a, j) => a + videosOf(j), 0);
  const q = await quota(total, `최대 ${total}개`);
  log(`  이번 최대 ${total}개 · ${q} · 지금 "${project}" 에서 진행 중 ` +
    `${await inFlight(spec.manual, project)}개 (동시 ${MAX_IN_FLIGHT}개까지 — 넘으면 앞의 것이 끝나야 다음을 보낸다)`);
  const planJobs = jobs.map((j) => ({ name: j.name || "", model: settingsOf(j).model ?? "", mode: settingsOf(j).mode ?? "", prompt: String(j.prompt),
    refs: j.refs, elements: mentions(j), settings: settingsOf(j) }));
  if (DRY) {
    for (const [i, j] of jobs.entries()) {
      const st = settingsOf(j);
      log(`  ${i + 1}. ${j.name || ""} · ${Object.entries(st).map(([k, v]) => `${k}=${v}`).join(" ") || "(앱 지금 설정 그대로)"} · 레퍼런스 ${j.refs.length}개` +
        `${mentions(j).length ? ` · 엘리먼트 ${mentions(j).map((n) => `@{${n}}`).join(" ")}` : ""}`);
    }
    writePlan(spec, { app: "seedance", project, billing, jobs: planJobs });
    return;
  }

  // 2) 하나씩 — 자리가 나면 넣고, 앱이 보낼 때까지 기다린다. 하나라도 실패하면 거기서 멈춘다(같은 실수를 반복하지 않게).
  //    [자리 확인 → 기록 → 넣기 → 앱이 받을 때까지] 는 PC 잠금 안에서 — 같은 PC 의 다른 보내기와 동시 3개 한도를 같이 지킨다.
  const sent = [];
  const unsent = (from) => jobs.slice(from).map((j, k) => j.name || `job_${from + k + 1}`).join(", ");
  for (const [i, j] of jobs.entries()) {
    const need = videosOf(j);
    const st = settingsOf(j);
    let out = null;
    while (!out) {
      await waitForRoom(spec.manual, project, need, sent.map((x) => x.id));
      out = await withSendLock("seedance", async () => {
        if ((await inFlight(spec.manual, project, sent.map((x) => x.id))) + need > MAX_IN_FLIGHT) return null;
        let rsv;
        try {
          rsv = await reserve(need, {
            kind: "generate", model: st.model, resolution: st.draft ? "480p 초안" : st.resolution, project, billing, job: j.name || `job_${i + 1}`,
          });
        } catch (e) {
          if (e instanceof Stop && !e.quiet) return { error: e.message };
          throw e;
        }
        const r = await post("/api/agent/jobs", {
          manual: spec.manual, name: j.name || `job_${i + 1}`, prompt: String(j.prompt), project, billing,
          settings: st, refs: j.refs,
        });
        if (r.http === 409 && r.stale) { await rsv.settle(0); return { stale: r.error }; }
        if (r.http !== 200 || !r.id) {
          await rsv.settle(0);
          return { error: `요청을 못 넣음 (${j.name || i + 1}): ${r.error || r.raw || r.http}` };
        }
        const res = await waitTaken(r.id);
        const cards = res.messages || [];
        await rsv.settle(res.status === "failed" ? cards.length : (cards.length || need));
        return { r, res, cards, rsv };
      });
    }
    if (out.stale) {
      if (sent.length) log(`  (그 전까지 ${sent.length}건은 보냈다: ${sent.map((x) => x.name).join(", ")})`);
      await staleStop(out.stale);
    }
    if (out.error) {
      console.error(`멈춤: ${out.error}`);
      console.error(`  ${sent.length}/${jobs.length}건까지 보냄 · 안 보낸 작업: ${unsent(i)}`);
      process.exitCode = 1;
      break;
    }
    const { r, res, cards, rsv } = out;
    if (res.status === "failed") {
      console.error(`멈춤: ${j.name || i + 1} 실패 — ${res.error || "이유 없음"}`);
      if (jobs.length - i - 1 > 0) console.error(`  안 보낸 작업: ${unsent(i + 1)}`);
      process.exitCode = 1;
      break;
    }
    sent.push({ id: r.id, name: j.name || `job_${i + 1}` });
    log(`  보냄 ${sent.length}/${jobs.length} ${j.name || ""} — 카드 ${cards.length}개${cards.some((c) => c.status === "failed") ? ` (실패 ${cards.filter((c) => c.status === "failed").length})` : ""} · id ${r.id}` +
      ` · 오늘 ${rsv.used - need + (cards.length || need)}/${rsv.limit}개`);
    for (const c of cards) if (c.status === "failed") log(`    카드 ${cardLine(c)}`);
  }
  if (!sent.length) return;
  writePlan(spec, { app: "seedance", project, billing, jobs: planJobs }, { sent: true, jobsFile: file });

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
  if (SAVE_TO) await saveResults(sent, spec.manual);
}

// 끝난 카드를 받아(card.download — 앱이 다운로드 폴더에 저장한다) 작업 폴더로 옮긴다: <작업 이름>_A.mp4, _B … 같은 이름이 있으면 _2.
// 어느 카드가 어느 파일인지는 그 폴더의 _목록.tsv 에 남긴다(프롬프트 북·검수 페이지가 읽는다).
const safeName = (s) => String(s || "job").replace(/[\\/:*?"<>|]+/g, "_").trim();
async function saveResults(sent, manual) {
  fs.mkdirSync(SAVE_TO, { recursive: true });
  const rows = [];
  for (const x of sent) {
    const j = await get(`/api/agent/jobs/${encodeURIComponent(x.id)}`);
    const done = (j.messages || []).filter((c) => c.status === "succeeded");
    for (const [k, c] of done.entries()) {
      let r;
      try { r = await sendCommand(manual, "card.download", { id: c.id }); }
      catch (e) { log(`  못 받음 ${x.name} · 카드 ${c.id} — ${e.message}`); continue; }
      const src = r?.path || r?.file || r?.saved;
      if (!src || !fs.existsSync(src)) { log(`  못 받음 ${x.name} · 카드 ${c.id} — 앱이 저장 경로를 안 줬다`); continue; }
      const take = String.fromCharCode(65 + k);
      const ext = path.extname(src) || ".mp4";
      let dest = path.join(SAVE_TO, `${safeName(x.name)}_${take}${ext}`);
      for (let n = 2; fs.existsSync(dest); n++) dest = path.join(SAVE_TO, `${safeName(x.name)}_${take}_${n}${ext}`);
      try { fs.renameSync(src, dest); } catch { fs.copyFileSync(src, dest); fs.rmSync(src, { force: true }); }
      rows.push([x.name, take, c.id, c.taskId || "", path.basename(dest)].join("\t"));
      log(`  저장 ${dest}`);
    }
  }
  const list = path.join(SAVE_TO, "_목록.tsv");
  if (rows.length) fs.appendFileSync(list, `${fs.existsSync(list) ? "" : "작업\t테이크\t카드\ttask\t파일\n"}${rows.join("\n")}\n`);
  log(rows.length ? `영상 ${rows.length}개를 ${SAVE_TO} 로 옮겼다(다운로드 폴더에는 안 남김) · 목록 _목록.tsv` : "옮긴 영상 없음 — 끝난 카드가 없거나 받지 못했다");
}

main().catch((e) => {
  if (!(e instanceof Stop && e.quiet)) console.error(`멈춤: ${e.message}`);
  process.exitCode = 1;
});
