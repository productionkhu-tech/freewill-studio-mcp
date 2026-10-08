// MCP 본체 — 로그인한 사람만 들어온다(worker.js 의 OAuth 공급자가 /mcp 를 지킨다). ctx.props = { email, name }.
//
// 하는 일은 그대로다: GitHub 저장소(productionkhu-tech/freewill-studio-mcp)의 최신 지침·공식 프롬프팅 스킬·앱 다루는
// 스크립트를 내려준다. 생성은 하지 않는다 — 앱에 작업을 넣는 일은 PC 에서 도는 에이전트가 여기서 받은 스크립트로 한다.
// 스크립트를 내려줄 때는 (1) 통신 검사(script-check.mjs)를 거치고 (2) 받는 사람의 로그인 표를 넣는다 — 스크립트는
// 보낼 때마다 그 표로 사용 기록을 남기고 하루 한도를 묻는다.
//
// MCP Streamable HTTP, 상태 없음: POST /mcp 로 JSON-RPC 를 받아 JSON 으로 답한다.

import { checkScript } from "./script-check.mjs";
import { makeTicket, TICKET_HOURS } from "./auth.js";

const RAW = "https://raw.githubusercontent.com/productionkhu-tech/freewill-studio-mcp/main";
const PLUGIN = "plugins/freewill-studio";
const SKILL = `${PLUGIN}/skills/freewill-generate`;
const REPO_URL = "https://github.com/productionkhu-tech/freewill-studio-mcp";

// topic → 저장소 경로. 지침(SKILL.md) 안에 적힌 상대 경로를 이 이름으로 바꿔 받는다.
const GUIDES = {
  start: `${SKILL}/SKILL.md`,
  interview: `${SKILL}/references/interview.md`,
  "house-rules": `${SKILL}/references/house-rules.md`,
  "app-rules": `${SKILL}/references/app-rules.md`,
  "read-apps-without-node": `${SKILL}/references/read-apps-without-node.md`,
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
};

const INSTRUCTIONS = [
  "프리윌 스튜디오 MCP — 프리윌루전 사내 나노바나나(이미지)·시댄스(영상) 생성 도우미.",
  "이미지·영상을 만들거나 그 프롬프트를 쓰고 다듬는 일을 맡으면, 먼저 freewill_guide(topic=\"start\") 를 불러 그 절차를 그대로 따른다.",
  "지침 안의 파일 경로는 freewill_guide·freewill_script 로 받는다. 사용자가 개인 스킬을 지정하면 그걸 써도 되지만,",
  "팀·프로젝트는 사람이 앱에서 고르고, 보내기 전 확인 카드를 받고, 생성은 사용자가 띄워 둔 앱으로 보낸다는 규칙은 그대로다.",
].join(" ");

const START_PREAMBLE = `> **원격 커넥터로 받은 지침이다** (GitHub 최신본, ${REPO_URL}).
> 지침 안의 파일 경로는 커넥터 도구로 받는다:
> - \`references/interview.md\` → \`freewill_guide("interview")\` · \`references/house-rules.md\` → \`"house-rules"\` ·
>   \`references/app-rules.md\` → \`"app-rules"\` · \`references/read-apps-without-node.md\` → \`"read-apps-without-node"\` ·
>   \`official/VERSIONS.md\` → \`"versions"\`
> - \`official/<이름>/SKILL.md\` → \`freewill_guide("official:<이름>")\` — 예: \`"official:sd25-pe"\`
> - \`official/imagegen/references/prompting.md\` → \`"official:imagegen/prompting"\`, \`sample-prompts.md\` → \`"official:imagegen/sample-prompts"\`
> - \`<플러그인 폴더>/scripts/<이름>.mjs\` → \`freewill_script("<이름>")\` 로 받아 **임시 폴더에 .mjs 로 저장한 뒤** \`node\` 로 실행한다.
>   받은 스크립트에는 로그인한 사람의 표가 들어 있어 ${TICKET_HOURS}시간 동안 쓸 수 있다 — 만료됐다고 나오면 다시 받는다.
>   PC 에서 명령을 돌릴 수 없는 곳(claude.ai 웹·Cowork·ChatGPT 웹)에서는 앱을 직접 다루지 못한다 — 프롬프트와 설정만 정리해 준다.

`;

const TOOLS = [
  {
    name: "freewill_guide",
    title: "프리윌 스튜디오 지침",
    description:
      "나노바나나·시댄스 생성/프롬프트 작업 지침과 모델별 공식 프롬프팅 스킬(BytePlus·Google·OpenAI·Higgsfield)을 GitHub 최신본으로 받는다. " +
      "처음에는 topic=\"start\" 를 받아 그 절차를 따른다.",
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
      "send-to-nanobanana(띄워 둔 나노바나나로 생성 보내기), send-to-seedance(띄워 둔 시댄스로 영상 생성 보내기, 앱 26.10.304~). " +
      "PC 에서 명령을 돌릴 수 있을 때만 쓸모 있다: 받은 원문을 임시 폴더에 " +
      ".mjs 로 저장해 node 로 실행. node 가 없으면 freewill_guide(\"read-apps-without-node\") 의 PowerShell 절차.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", enum: Object.keys(SCRIPTS), description: "받을 스크립트" } },
      required: ["name"],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

async function fromRepo(path) {
  const r = await fetch(`${RAW}/${path}`, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!r.ok) throw new Error(`저장소에서 ${path} 를 못 받음 (${r.status})`);
  return r.text();
}

const stripFrontmatter = (s) => s.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");

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
    const path = GUIDES[topic];
    if (!path) return toolError(`모르는 topic: ${topic}. 쓸 수 있는 것: ${Object.keys(GUIDES).join(", ")}`);
    const raw = await fromRepo(path);
    const text = topic === "start" ? START_PREAMBLE + stripFrontmatter(raw) : raw;
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
    const ready = code.replace(/^const FREEWILL_TICKET = "";$/m, `const FREEWILL_TICKET = "${ticket}";`);
    return toolText(
      `아래 원문을 임시 폴더에 \`${key}.mjs\` 로 저장한 뒤 \`node <저장한 경로> ...\` 로 실행한다. 사용법은 원문 머리말.\n` +
        `${props?.email || "로그인한 사람"} 의 표가 들어 있어 ${TICKET_HOURS}시간 동안 쓸 수 있다(만료되면 다시 받는다).\n\n` +
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
      case "tools/list":
        result = { tools: TOOLS };
        break;
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
    if (request.method === "GET") return new Response("SSE 스트림은 없다 — POST 로 보낼 것", { status: 405, headers: { Allow: "POST" } });
    if (request.method === "DELETE") return new Response(null, { status: 204 });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    let payload;
    try { payload = await request.json(); } catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400); }

    if (Array.isArray(payload)) {
      const out = (await Promise.all(payload.map((m) => handle(m, env, props)))).filter(Boolean);
      return out.length ? json(out) : new Response(null, { status: 202 });
    }
    const out = await handle(payload, env, props);
    return out ? json(out) : new Response(null, { status: 202 });
  },
};
