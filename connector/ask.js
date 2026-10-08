// 대화 중 사용자에게 선택 창을 띄우는 freewill_ask — MCP elicitation(서버가 클라이언트에 입력을 청함).
//
// Codex 일반 모드에는 Claude 의 AskUserQuestion 같은 선택지 도구가 없어서, 확인 카드·질문에 사용자가 "예" 를 글로 쳐야
// 했다(10/8). Codex 는 MCP elicitation 폼을 앱 화면에 선택지 + 제출 버튼으로 띄운다. 입력 칸이 있는 폼은 '나 대신 승인'
// (자동 검토)이 대신 답하지 않고 사람에게 간다 — 그래서 선택지 칸을 꼭 하나 이상 둔다(빈 폼은 전체 액세스에서 저절로 수락됨).
//
// 흐름(Streamable HTTP): 도구 호출 POST 에 SSE 로 답하면서 ① elicitation/create 요청을 먼저 흘리고, 클라이언트가 고른 답을
// ② 별도 POST(JSON-RPC 응답)로 보내오면 ③ 도구 결과를 같은 SSE 로 마저 보내고 닫는다. ①·③ 과 ② 는 다른 워커 인스턴스에
// 떨어질 수 있어서, 둘이 만나는 자리를 Durable Object(AskRoom — 질문 하나에 방 하나)로 둔다.

const WAIT_MS = 5 * 60 * 1000;      // 이만큼 답이 없으면 창을 버리고 "대화로 물어라" 를 돌려준다
const PING_MS = 15 * 1000;          // 기다리는 동안 SSE 가 끊기지 않게
const ID_PREFIX = "fw-ask-";

export const ASK_TOOL = {
  name: "freewill_ask",
  title: "선택 창으로 묻기",
  description:
    "확인 카드(\"이대로 생성할까요?\")나 선택지 질문을 사용자 화면에 선택 창(버튼)으로 띄우고, 고른 답을 돌려받는다. " +
    "질문 도구가 없는 클라이언트(Codex 등)용 — Claude 는 자체 AskUserQuestion 을 쓴다. 질문 1~4개, 질문마다 선택지 2~6개" +
    "(multi 면 여러 개 고르기). " +
    "창을 못 띄우면 그렇다고 돌려주니, 그때는 같은 질문을 대화로 묻는다.",
  inputSchema: {
    type: "object",
    properties: {
      message: { type: "string", description: "창 위에 보일 글 — 확인 카드 요약 또는 질문 설명" },
      questions: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "질문 — 예: \"이대로 생성할까요?\"" },
            options: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6, description: "선택지 글 그대로 — 예: [\"생성\", \"고치기\", \"취소\"]" },
            default: { type: "string", description: "미리 골라 둘 선택지 (선택, 하나 고르기일 때)" },
            multi: { type: "boolean", description: "여러 개 고르기 — 예: 후보 중 생성할 것들 (선택)" },
          },
          required: ["title", "options"],
        },
      },
      note: { type: "string", description: "자유 입력 칸 제목 (선택) — 예: \"고칠 점\". 비우면 칸 없음" },
    },
    required: ["message", "questions"],
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
};

const NO_FORM =
  "이 대화에서는 선택 창을 띄울 수 없다(클라이언트가 지원하지 않음) — 같은 질문을 대화로(번호 선택지) 묻고 답을 받는다.";

// 도구 인자 → elicitation 폼. 칸 이름은 q1~q4 · 메모 q9(Codex 가 칸을 이름순으로 정렬해 그리므로 메모가 맨 아래로),
// 돌려줄 때 질문 제목으로 되돌린다.
export function askForm(args) {
  const message = String(args?.message || "").trim();
  const questions = Array.isArray(args?.questions) ? args.questions : [];
  if (!message) throw new Error("message 가 비었다");
  if (questions.length < 1 || questions.length > 4) throw new Error("questions 는 1~4개");
  const properties = {};
  const titles = {};
  questions.forEach((q, i) => {
    const title = String(q?.title || "").trim();
    const options = (Array.isArray(q?.options) ? q.options : []).map((o) => String(o).trim()).filter(Boolean);
    if (!title) throw new Error(`${i + 1}번 질문의 title 이 비었다`);
    if (options.length < 2 || options.length > 6) throw new Error(`"${title}" 의 선택지는 2~6개`);
    if (new Set(options).size !== options.length) throw new Error(`"${title}" 의 선택지가 겹친다`);
    const key = `q${i + 1}`;
    properties[key] = q?.multi === true
      ? { type: "array", title, items: { type: "string", enum: options }, minItems: 1 }
      : { type: "string", title, enum: options, ...(options.includes(q?.default) ? { default: q.default } : {}) };
    titles[key] = title;
  });
  const note = String(args?.note || "").trim();
  if (note) { properties.q9 = { type: "string", title: note, maxLength: 2000 }; titles.q9 = note; }
  const required = Object.keys(properties).filter((k) => k !== "q9");
  return { params: { mode: "form", message, requestedSchema: { type: "object", properties, required } }, titles };
}

// 클라이언트의 답(JSON-RPC 응답 그대로, 시간 넘기면 null) → 도구 결과 글
export function askResult(answer, titles, waitMs = WAIT_MS) {
  const text = (t) => ({ content: [{ type: "text", text: t }] });
  if (!answer) return text(`${Math.round(waitMs / 60000) || 1}분 안에 답이 없어 창을 닫았다 — 진행하지 말고 같은 질문을 대화로 다시 묻는다.`);
  if (answer.error) return text(`${NO_FORM} (${answer.error.message || answer.error.code})`);
  const { action, content } = answer.result || {};
  if (action === "decline") return text("사용자가 창에서 거절했다 — 진행하지 않는다. 무엇을 바꿀지 대화로 묻는다.");
  if (action !== "accept") return text("사용자가 창을 닫았다(취소) — 진행하지 않는다. 필요하면 대화로 다시 묻는다.");
  const shown = (v) => (Array.isArray(v) ? v.join(", ") : String(v ?? "")).trim();
  const lines = Object.entries(titles)
    .filter(([k]) => shown(content?.[k]) !== "")
    .map(([k, t]) => `- ${t} → ${shown(content[k])}`);
  return text(`사용자가 선택 창에서 답했다:\n${lines.join("\n") || "- (빈 답)"}\n이 답대로 진행한다.`);
}

export const isAnswer = (m) =>
  m && typeof m === "object" && m.method === undefined && m.id !== undefined && m.id !== null && ("result" in m || "error" in m);

// 선택 창 답(클라이언트가 보낸 JSON-RPC 응답)을 기다리는 방으로 넘긴다. 우리 질문이 아니면 버린다.
export async function deliverAnswer(msg, env, props) {
  const m = new RegExp(`^${ID_PREFIX}([0-9a-f-]{36})$`).exec(String(msg.id));
  if (!m || !env.ASK_ROOM) return;
  const room = env.ASK_ROOM.get(env.ASK_ROOM.idFromName(m[1]));
  await room.fetch("https://ask/answer", { method: "POST", body: JSON.stringify({ email: props?.email || "", message: msg }) });
}

// tools/call freewill_ask → SSE 응답. 클라이언트가 SSE 를 못 받으면 바로 "대화로 물어라".
export function askResponse(request, { id, args, env, props, ctx }) {
  const json = (result) =>
    new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), { headers: { "Content-Type": "application/json; charset=utf-8" } });
  if (!env.ASK_ROOM || !/text\/event-stream/.test(request.headers.get("Accept") || "")) {
    return json({ content: [{ type: "text", text: NO_FORM }] });
  }
  let form;
  try { form = askForm(args); } catch (e) {
    return json({ content: [{ type: "text", text: `freewill_ask 인자 오류: ${e.message}` }], isError: true });
  }

  const askId = crypto.randomUUID();
  const room = env.ASK_ROOM.get(env.ASK_ROOM.idFromName(askId));
  const waitMs = Number(env.ASK_WAIT_MS) || WAIT_MS;
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const send = (obj) => writer.write(enc.encode(`event: message\ndata: ${JSON.stringify(obj)}\n\n`));

  const run = (async () => {
    let ping;
    try {
      await room.fetch("https://ask/open", { method: "POST", body: JSON.stringify({ email: props?.email || "" }) });
      await send({ jsonrpc: "2.0", id: `${ID_PREFIX}${askId}`, method: "elicitation/create", params: form.params });
      ping = setInterval(() => writer.write(enc.encode(": ping\n\n")).catch(() => {}), PING_MS);
      const r = await room.fetch("https://ask/wait", { method: "POST", body: JSON.stringify({ ms: waitMs }) });
      const { answer } = await r.json();
      clearInterval(ping);
      await send({ jsonrpc: "2.0", id, result: askResult(answer, form.titles, waitMs) });
    } catch (e) {
      clearInterval(ping);
      await send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `${NO_FORM} (${e.message || e})` }] } }).catch(() => {});
    } finally {
      await writer.close().catch(() => {});
    }
  })();
  ctx?.waitUntil?.(run);
  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}

// 질문 하나에 방 하나. 띄우기 직전 /open(답할 사람 적기) → 답이 오면 /answer → 도구 호출 쪽은 /wait 로 받는다.
// 답이 /wait 보다 먼저 와도 저장해 두니 놓치지 않는다. 30분 뒤 알람으로 치운다(늦게 온 답·버려진 방).
export class AskRoom {
  constructor(state) {
    this.state = state;
    this.waiters = [];
  }

  async fetch(request) {
    const { pathname } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const store = this.state.storage;
    if (pathname === "/open") {
      await store.put("owner", body.email || "");
      await store.setAlarm(Date.now() + 30 * 60 * 1000);
      return new Response("ok");
    }
    if (pathname === "/answer") {
      const owner = await store.get("owner");
      if (owner === undefined) return new Response("없는 질문", { status: 404 });
      if (owner !== (body.email || "")) return new Response("다른 사람의 답", { status: 403 });
      await store.put("answer", body.message);
      for (const done of this.waiters.splice(0)) done(body.message);
      return new Response("ok");
    }
    if (pathname === "/wait") {
      const ready = await store.get("answer");
      const answer = ready !== undefined ? ready : await new Promise((resolve) => {
        this.waiters.push(resolve);
        setTimeout(() => resolve(null), Math.max(1000, Number(body.ms) || WAIT_MS));
      });
      await store.deleteAll();
      return Response.json({ answer });
    }
    return new Response("없는 주소", { status: 404 });
  }

  async alarm() {
    await this.state.storage.deleteAll();
  }
}
