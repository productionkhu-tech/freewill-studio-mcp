// MCP 본체 — 로그인한 사람만 들어온다(worker.js 의 OAuth 공급자가 /mcp 를 지킨다). ctx.props = { email, name }.
//
// 하는 일은 그대로다: GitHub 저장소(productionkhu-tech/freewill-studio-mcp)의 최신 지침·공식 프롬프팅 스킬·앱 다루는
// 스크립트를 내려준다. 생성은 하지 않는다 — 앱에 작업을 넣는 일은 PC 에서 도는 에이전트가 여기서 받은 스크립트로 한다.
// 스크립트를 내려줄 때는 (1) 통신 검사(script-check.mjs)를 거치고 (2) 받는 사람의 로그인 표를 넣는다 — 스크립트는
// 보낼 때마다 그 표로 사용 기록을 남기고 하루 한도를 묻는다.
//
// MCP Streamable HTTP, 상태 없음: POST /mcp 로 JSON-RPC 를 받아 JSON 으로 답한다. 예외 하나 — freewill_ask(선택 창)는
// 사용자의 답을 기다려야 해서 SSE 로 답한다(ask.js).

import { checkScript } from "./script-check.mjs";
import { makeTicket, TICKET_HOURS } from "./auth.js";
import { ASK_TOOL, askResponse, deliverAnswer, isAnswer } from "./ask.js";
import { pickSections } from "./sections.js";
import { extractDoc } from "./docs.js";

const RAW = "https://raw.githubusercontent.com/productionkhu-tech/freewill-studio-mcp/main";
const PLUGIN = "plugins/freewill-studio";
const SKILL = `${PLUGIN}/skills/freewill-generate`;
const REPO_URL = "https://github.com/productionkhu-tech/freewill-studio-mcp";

// topic → 저장소 경로. 전체 지침은 GUIDE.md(플러그인의 SKILL.md 는 "여기서 최신본을 받으라" 는 시작점뿐) — 지침 안의 상대 경로를 이 이름으로 바꿔 받는다.
// 공식 가이드(official:…)는 아래가 기본이고, 실제로는 guideMap() 이 sync 의 official.lock.json 으로 그때그때 늘린다.
const GUIDES = {
  start: `${SKILL}/GUIDE.md`,
  interview: `${SKILL}/references/interview.md`,
  "house-rules": `${SKILL}/references/house-rules.md`,
  "app-rules": `${SKILL}/references/app-rules.md`,
  "read-apps-without-node": `${SKILL}/references/read-apps-without-node.md`,
  "prompt-book": `${SKILL}/references/prompt-book.md`,
  assets: `${SKILL}/references/assets.md`,
  "seedance-prompting": `${SKILL}/references/seedance-prompting.md`,
  "prompt-logic": `${SKILL}/references/prompt-logic.md`,
  "seedance-quality": `${SKILL}/references/seedance-quality.md`,
  "image-prompting": `${SKILL}/references/image-prompting.md`,
  "work-folder": `${SKILL}/references/work-folder.md`,
  versions: `${SKILL}/official/VERSIONS.md`,
  "official:sd25-pe": `${SKILL}/official/sd25-pe/SKILL.md`,
  "official:sd2-pe": `${SKILL}/official/sd2-pe/SKILL.md`,
  "official:gemini-omni-flash-api": `${SKILL}/official/gemini-omni-flash-api/SKILL.md`,
  "official:imagegen": `${SKILL}/official/imagegen/SKILL.md`,
  "official:imagegen/prompting": `${SKILL}/official/imagegen/references/prompting.md`,
  "official:imagegen/sample-prompts": `${SKILL}/official/imagegen/references/sample-prompts.md`,
  "official:higgsfield-generate": `${SKILL}/official/higgsfield-generate/SKILL.md`,
  "official:higgsfield-generate/prompt-engineering": `${SKILL}/official/higgsfield-generate/references/prompt-engineering.md`,
};
const SCRIPTS = {
  "read-local-apps": `${PLUGIN}/scripts/read-local-apps.mjs`,
  "send-to-nanobanana": `${PLUGIN}/scripts/send-to-nanobanana.mjs`,
  "send-to-seedance": `${PLUGIN}/scripts/send-to-seedance.mjs`,
  "make-prompt-book": `${PLUGIN}/scripts/make-prompt-book.mjs`,
  "make-review": `${PLUGIN}/scripts/make-review.mjs`,
};

const INSTRUCTIONS = [
  "프리윌 스튜디오 MCP — 프리윌루전 사내 나노바나나(이미지)·시댄스(영상) 생성 도우미.",
  "이미지·영상을 만들거나 그 프롬프트를 쓰고 다듬는 일을 맡으면, 먼저 freewill_guide(topic=\"start\") 를 불러 그 절차를 그대로 따른다.",
  "지침 안의 파일 경로는 freewill_guide·freewill_script 로 받는다. 지침의 프롬프트 쓰는 법은 사용자가 아무 말 안 했을 때의 기본값이다 —",
  "사용자가 개인 스킬·자기 프롬프트·다른 형식을 주면 그걸 따른다. 그래도 팀·프로젝트는 사람이 앱에서 고르고, 보내기 전 확인 카드를 받고,",
  "생성은 사용자가 띄워 둔 앱으로 보낸다는 규칙은 그대로다.",
  "질문 도구(AskUserQuestion 등)가 없는 클라이언트(Codex)는 확인 카드·선택지 질문의 답을 freewill_ask 선택 창으로 받는다.",
].join(" ");

const START_PREAMBLE = `> **원격 커넥터로 받은 지침이다** (GitHub 최신본, ${REPO_URL}).
> 지침 안의 파일 경로는 커넥터 도구로 받는다:
> - \`references/interview.md\` → \`freewill_guide("interview")\` · \`references/house-rules.md\` → \`"house-rules"\` ·
>   \`references/app-rules.md\` → \`"app-rules"\` · \`references/read-apps-without-node.md\` → \`"read-apps-without-node"\` ·
>   \`references/prompt-book.md\` → \`"prompt-book"\` · \`references/assets.md\` → \`"assets"\` ·
>   \`references/seedance-prompting.md\` → \`"seedance-prompting"\` · \`references/seedance-quality.md\` → \`"seedance-quality"\` ·
>   \`references/image-prompting.md\` → \`"image-prompting"\` · \`references/work-folder.md\` → \`"work-folder"\` · \`references/prompt-logic.md\` → \`"prompt-logic"\` · \`official/VERSIONS.md\` → \`"versions"\`
> - \`official/<이름>/SKILL.md\`·\`GUIDE.md\` → \`freewill_guide("official:<이름>")\` — 예: \`"official:sd25-pe"\`, \`"official:nano-banana"\`
> - \`official/<이름>/references/<파일>.md\` → \`"official:<이름>/<파일>"\` — 예: \`"official:imagegen/prompting"\`, \`"official:higgsfield-generate/model-catalog"\`
> - \`<플러그인 폴더>/scripts/<이름>.mjs\` → \`freewill_script("<이름>")\` 로 받아 **임시 폴더에 .mjs 로 저장한 뒤** \`node\` 로 실행한다.
>   받은 스크립트에는 로그인한 사람의 표가 들어 있어 ${TICKET_HOURS}시간 동안 쓸 수 있다 — 만료됐다고 나오면 다시 받는다.
>   **Codex 는 이 스크립트들을 네트워크 허용(샌드박스 밖)으로 실행 승인을 받아 돌린다** — 샌드박스 안에서는 앱(127.0.0.1)·커넥터에
>   닿지 못해 "연결 못 함" 이 나온다(앱이 꺼진 게 아니다).
>   PC 에서 명령을 돌릴 수 없는 곳(claude.ai 웹·Cowork·ChatGPT 웹)에서는 앱을 직접 다루지 못한다 — 프롬프트와 설정만 정리해 준다.
> - 질문 도구(AskUserQuestion 등)가 없으면(Codex) 3단계 질문·5단계 확인 카드의 답을 \`freewill_ask\` 선택 창으로 받는다.

`;

const TOOLS = [
  {
    name: "freewill_guide",
    title: "프리윌 스튜디오 지침",
    description:
      "나노바나나·시댄스 생성/프롬프트 작업 지침과 모델별 공식 프롬프트 가이드(BytePlus·Google·OpenAI 공식 스킬·문서, 없으면 Higgsfield)를 " +
      "GitHub 최신본으로 받는다. 처음에는 topic=\"start\" 를 받아 그 절차를 따른다 — 어느 모델에 어느 가이드인지는 start 4단계 표.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", enum: Object.keys(GUIDES), description: "받을 지침" },
        part: { type: "integer", minimum: 1, description: "긴 문서는 나눠서 준다. 응답 끝에 다음 part 번호가 적혀 있으면 이어서 받는다 (기본 1)" },
      },
      required: ["topic"],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "freewill_script",
    title: "프리윌 스튜디오 앱 스크립트",
    description:
      "이 PC 의 나노바나나·시댄스를 다루는 스크립트 원문을 받는다 — read-local-apps(앱 버전·모델 규칙·지금 설정 읽기), " +
      "send-to-nanobanana(띄워 둔 나노바나나로 생성 보내기), send-to-seedance(띄워 둔 시댄스로 영상 생성 보내기, 앱 26.10.304~), " +
      "make-prompt-book(컨펌된 결과를 HTML 프롬프트 북으로 정리 — 형식은 freewill_guide(\"prompt-book\")), " +
      "make-review(작업 페이지 — 작업마다 HTML 하나·목차, --serve 로 검수 저장이 바로 되는 주소, 보낼 것 레퍼런스 미리보기, OK·보류·탈락 폴더 분류). " +
      "PC 에서 명령을 돌릴 수 있을 때만 쓸모 있다: 받은 원문을 임시 폴더에 " +
      ".mjs 로 저장해 node 로 실행. node 가 없으면 freewill_guide(\"read-apps-without-node\") 의 PowerShell 절차.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", enum: Object.keys(SCRIPTS), description: "받을 스크립트" } },
      required: ["name"],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  ASK_TOOL,
];

const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

// 시험(wrangler dev)에서는 REPO_RAW 로 이 PC 의 저장소 파일을 읽게 할 수 있다 — 올리기 전에 지침·표를 확인하려고.
let rawBase = RAW;
async function fromRepo(path) {
  const r = await fetch(`${rawBase}/${path}`, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!r.ok) throw new Error(`저장소에서 ${path} 를 못 받음 (${r.status})`);
  return r.text();
}

const stripFrontmatter = (s) => s.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");

// 공식 가이드 topic 을 sync 가 쓰는 official.lock.json 에서 만든다 — 새 공식 스킬·문서가 붙으면 커넥터를 다시 배포하지
// 않아도 official:<이름>(본문) · official:<이름>/<references 파일> 로 받을 수 있다. 못 읽으면 기본(GUIDES)만.
async function guideMap() {
  const map = { ...GUIDES };
  try {
    const [lock, src] = await Promise.all(["sync/official.lock.json", "sync/sources.json"].map(async (p) => JSON.parse(await fromRepo(p))));
    for (const [name, v] of Object.entries(lock.skills || {})) {
      // 저장소에 복사하지 않는 공식 문서(OpenAI·BytePlus) — 원문 주소에서 바로 받아 뽑는다
      const def = v.live && (src.docs || []).find((d) => d.name === name);
      if (def) { map[`official:${name}`] = { live: true, def }; continue; }
      const main = v.kind === "doc" ? "GUIDE.md" : "SKILL.md";
      map[`official:${name}`] = `${SKILL}/official/${name}/${main}`;
      for (const f of v.files || []) {
        if (f !== main) map[`official:${name}/${f.replace(/^references\//, "").replace(/\.md$/, "")}`] = `${SKILL}/official/${name}/${f}`;
      }
    }
    // 긴 공식 스킬은 앱 mode 별로 필요한 절만 — official:<스킬>/<mode> (sources.json 의 modes)
    for (const t of src.tracked || []) {
      const common = t.modes?._common || [];
      for (const [mode, titles] of Object.entries(t.modes || {})) {
        if (mode === "_common") continue;
        map[`official:${t.skill}/${mode}`] = { path: `${SKILL}/official/${t.skill}/SKILL.md`, skill: t.skill, mode, titles: [...common, ...titles] };
      }
    }
  } catch { /* 기본 목록으로 */ }
  return map;
}

// 원문에서 바로 받는 공식 문서 — sync 와 같은 방식(docs.js)으로 프롬프트 가이드 부분만. 원문은 한 시간 캐시.
async function liveDoc(def) {
  const r = await fetch(def.url, { headers: { "User-Agent": "freewill-mcp" }, cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!r.ok) throw new Error(`${def.vendor} 문서를 못 받음 (${r.status}) — ${def.url}`);
  return `> ${def.vendor} 공식 문서(${def.url})에서 커넥터가 방금 받아 프롬프트 가이드 부분만 뽑은 것.\n\n${extractDoc(await r.text(), def)}`;
}

// official:<스킬>/<mode> — 공통 원칙 + 그 모드 템플릿만. 원본에서 절을 못 찾으면 전체를 읽으라고 덧붙인다.
async function modeGuide(entry) {
  const { text, missing } = pickSections(stripFrontmatter(await fromRepo(entry.path)), entry.titles);
  return `> 공식 \`${entry.skill}\` 중 \`${entry.mode}\` 모드에 필요한 절만 골라 낸 것(공통 원칙 + 그 모드 템플릿). 전체는 \`official:${entry.skill}\`.` +
    (missing.length ? `\n> 원본에서 못 찾은 절: ${missing.join(", ")} — 원본이 바뀐 것이니 이번엔 전체(\`official:${entry.skill}\`)를 읽는다.` : "") +
    `\n\n${text}\n`;
}

// start 4단계의 자리표를 '앱 모델 → 공식 가이드' 표(official/VERSIONS.md, sync 가 매일 새로 씀)로 바꾼다.
// 커뮤니티 표의 하위 topic 줄줄이(한 칸에 2천 자 가까이)는 "외 N개" 로 접는다 — start 가 한 번에 받는 크기(PART_CHARS)
// 안에 들게. 하위 topic 은 도구의 topic 목록과 freewill_guide("versions") 에 그대로 있다.
const MODEL_GUIDES = /<!-- MODEL_GUIDES:[^>]*-->/;
function foldSubtopics(table) {
  return table.replace(/^\| (`official:[^`]+`)(.*?) \| /gm, (whole, first, rest) => {
    const more = (rest.match(/`official:/g) || []).length;
    return more ? `| ${first} 외 ${more}개(versions) | ` : whole;
  });
}
async function withModelGuides(text) {
  if (!MODEL_GUIDES.test(text)) return text;
  const table = foldSubtopics((await fromRepo(GUIDES.versions)).replace(/^# .*\r?\n+/, "").trim());
  return text.replace(MODEL_GUIDES, () => table);
}

// 지침 버전 — 보내기 전에 지켜야 할 지침(start · house-rules · interview · app-rules)의 내용 지문. start 맨 위에 적어 주고
// 보내기 스크립트에도 넣어 준다. 대화가 읽은 지침이 옛것이면(jobs.json 의 guide 가 다르면) 스크립트가 보내지 않고 다시
// 읽게 한다 — 에이전트는 처음 읽은 지침을 기억하고 다시 받을지는 제 판단이라, 이미 하던 대화가 낡은 규칙으로 보내지 않게.
// 쓰는 법이 바뀌면 오래 쓴 대화도 다시 읽게 — 시댄스 형식·논리 점검·에셋 틀도 지문에 넣는다
const VERSIONED = ["start", "house-rules", "interview", "app-rules", "versions", "seedance-prompting", "seedance-quality", "image-prompting", "work-folder", "prompt-logic", "assets"];
async function guideVersion() {
  const texts = await Promise.all(VERSIONED.map((t) => fromRepo(GUIDES[t])));
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texts.join(String.fromCharCode(0))));
  return [...new Uint8Array(hash)].slice(0, 5).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const versionLine = (v) =>
  `> - **지침 버전 \`${v}\`** — 앱으로 보내는 jobs.json 에 \`"guide": "${v}"\` 를 적는다. 보내기 스크립트가 "지침이 바뀌었다" 고\n` +
  `>   하면 이 지침(start)을 다시 받아 읽고 바뀐 규칙대로 고친다 — 사용자에게 지침 버전 얘기는 하지 않는다.\n`;

// 한 번에 내려주는 최대 글자 수. 시댄스 2.5 공식 스킬이 9만 자가 넘어서, 통째로 주면 클라이언트의
// 도구 응답 한도(Claude Code 기본 약 2.5만 토큰)에 걸린다. 줄 단위로 끊어 part 로 나눠 준다.
const PART_CHARS = 36000;

function paginate(text, part) {
  if (text.length <= PART_CHARS) return { body: text, total: 1 };
  const parts = [];
  let buf = "";
  for (const line of text.split("\n")) {
    if (buf.length + line.length + 1 > PART_CHARS && buf) { parts.push(buf); buf = ""; }
    buf += (buf ? "\n" : "") + line;
  }
  if (buf) parts.push(buf);
  const i = Math.min(Math.max(1, part | 0 || 1), parts.length);
  return { body: parts[i - 1], total: parts.length, index: i };
}

async function callTool(name, args, env, props) {
  if (name === "freewill_guide") {
    const topic = String(args?.topic || "");
    const map = await guideMap();
    const entry = map[topic];
    if (!entry) return toolError(`모르는 topic: ${topic}. 쓸 수 있는 것: ${Object.keys(map).join(", ")}`);
    let text;
    if (entry.live) text = await liveDoc(entry.def);
    else if (typeof entry === "object") text = await modeGuide(entry);
    else if (topic === "start") {
      text = `${START_PREAMBLE.trimEnd()}\n${versionLine(await guideVersion())}\n${await withModelGuides(stripFrontmatter(await fromRepo(entry)))}`;
    } else text = await fromRepo(entry);
    const p = paginate(text, args?.part);
    if (p.total === 1) return toolText(p.body);
    const tail = p.index < p.total
      ? `\n\n---\n(${p.index}/${p.total} 부분 — 이어서 freewill_guide(topic="${topic}", part=${p.index + 1}) 를 받아 끝까지 읽는다)`
      : `\n\n---\n(${p.index}/${p.total} 부분 — 끝)`;
    return toolText(p.body + tail);
  }
  if (name === "freewill_script") {
    const key = String(args?.name || "");
    const path = SCRIPTS[key];
    if (!path) return toolError(`모르는 스크립트: ${key}. 쓸 수 있는 것: ${Object.keys(SCRIPTS).join(", ")}`);
    const code = await fromRepo(path);
    const problems = checkScript(code);
    if (problems.length) {
      return toolError(
        `${key} 스크립트가 통신 검사에 걸려 내려주지 않습니다. 실행하지 말고 관리자에게 이 내용을 알려 주세요.\n` +
          problems.map((p) => `- ${p}`).join("\n"),
      );
    }
    const ticket = await makeTicket(env, props);
    const ready = code
      .replace(/^const FREEWILL_TICKET = "";$/m, `const FREEWILL_TICKET = "${ticket}";`)
      .replace(/^const FREEWILL_GUIDE = "";$/m, `const FREEWILL_GUIDE = "${await guideVersion()}";`);
    return toolText(
      `아래 js 코드 블록 안의 코드만 임시 폴더에 \`${key}.mjs\` 로 저장한 뒤 \`node <저장한 경로> ...\` 로 실행한다(이 안내 문장은 빼고). 사용법은 원문 머리말.\n` +
        `Codex 는 네트워크 허용(샌드박스 밖)으로 실행 승인을 받아 돌린다 — 샌드박스 안에서는 앱·커넥터에 닿지 못한다.\n` +
        `${props?.email || "로그인한 사람"} 의 표가 들어 있어 ${TICKET_HOURS}시간 동안 쓸 수 있다(만료되면 다시 받는다). ` +
        `표를 명령줄·다른 파일로 옮겨 적지 말고 통째로 저장한다 — 옮겨 적으면 자동 권한 검사가 자격 증명 유출로 막는다.\n\n` +
        "```js\n" + ready + "\n```",
    );
  }
  return toolError(`모르는 도구: ${name}`);
}

const toolText = (text) => ({ content: [{ type: "text", text }] });
const toolError = (text) => ({ content: [{ type: "text", text }], isError: true });

async function handle(msg, env, props) {
  const { id, method, params } = msg || {};
  const isNotification = id === undefined || id === null;
  try {
    let result;
    switch (method) {
      case "initialize": {
        const asked = params?.protocolVersion;
        result = {
          protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "freewill", title: "프리윌 스튜디오 MCP", version: "0.2.0" },
          instructions: INSTRUCTIONS,
        };
        break;
      }
      case "ping":
        result = {};
        break;
      case "tools/list": {
        // topic 목록은 지금 붙어 있는 공식 가이드까지 — 새 대화부터 보인다(이미 하던 대화도 이름을 알면 받을 수 있다)
        const topics = Object.keys(await guideMap());
        result = {
          tools: TOOLS.map((t) => t.name !== "freewill_guide" ? t : {
            ...t,
            inputSchema: { ...t.inputSchema, properties: { ...t.inputSchema.properties, topic: { ...t.inputSchema.properties.topic, enum: topics } } },
          }),
        };
        break;
      }
      case "tools/call":
        result = await callTool(params?.name, params?.arguments, env, props);
        break;
      default:
        if (isNotification) return null; // notifications/initialized 등은 답하지 않는다
        return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
    }
    return isNotification ? null : { jsonrpc: "2.0", id, result };
  } catch (e) {
    if (method === "tools/call") return { jsonrpc: "2.0", id, result: toolError(String(e.message || e)) };
    return isNotification ? null : { jsonrpc: "2.0", id, error: { code: -32603, message: String(e.message || e) } };
  }
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

export const mcpHandler = {
  async fetch(request, env, ctx) {
    const props = ctx?.props || {};
    rawBase = env.REPO_RAW || RAW;
    if (request.method === "GET") return new Response("SSE 스트림은 없다 — POST 로 보낼 것", { status: 405, headers: { Allow: "POST" } });
    if (request.method === "DELETE") return new Response(null, { status: 204 });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    let payload;
    try { payload = await request.json(); } catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400); }

    // 클라이언트가 보낸 JSON-RPC 응답 = freewill_ask 선택 창의 답 — 기다리는 도구 호출로 넘긴다(ask.js)
    if (isAnswer(payload)) {
      await deliverAnswer(payload, env, props);
      return new Response(null, { status: 202 });
    }
    if (Array.isArray(payload)) {
      await Promise.all(payload.filter(isAnswer).map((m) => deliverAnswer(m, env, props)));
      const out = (await Promise.all(payload.filter((m) => !isAnswer(m)).map((m) => handle(m, env, props)))).filter(Boolean);
      return out.length ? json(out) : new Response(null, { status: 202 });
    }
    // freewill_ask 는 사용자의 답을 기다려야 해서 SSE 로 답한다
    if (payload?.method === "tools/call" && payload?.params?.name === ASK_TOOL.name) {
      return askResponse(request, { id: payload.id, args: payload.params.arguments, env, props, ctx });
    }
    const out = await handle(payload, env, props);
    return out ? json(out) : new Response(null, { status: 202 });
  },
};
