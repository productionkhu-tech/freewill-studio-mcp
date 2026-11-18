#!/usr/bin/env node
// 시작 지침(freewill_guide("start"))이 한 번에 나가는지 잰다 — 커넥터(connector/mcp.js)가 만드는 글 그대로, GitHub raw 처럼 LF 로.
// 넘으면 커넥터가 두 부분(part=2)으로 나눠 주는데, 에이전트가 뒷부분을 안 읽을 수 있다. 11/18 공식 문서 표(VERSIONS.md — 봇이 씀)에
// 시드림 5.5 줄이 붙어 36,263자가 됐는데 아무도 몰랐다 → 동기화(sync.mjs)가 매일 재서 넘으면 알림 이슈, 사람이 푸시하면 검사 워크플로가 실패.
//
//   node sync/start-len.mjs          길이와 한도를 출력, 넘으면 종료 코드 1
//
// 커넥터 코드를 임시 폴더에 복사해 길이를 재는 함수 하나만 덧붙여 부른다(Cloudflare 전용 패키지는 빈 껍데기로) — 지침을 만드는 규칙이
// 바뀌어도 여기는 안 고친다. 저장소 파일은 이 폴더 것을 로컬 주소로 내준다(네트워크 안 씀).
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function startGuideLength(repo = REPO) {
  const conn = path.join(repo, "connector");
  const limit = Number(/const PART_CHARS = (\d+)/.exec(fs.readFileSync(path.join(conn, "mcp.js"), "utf8"))?.[1]);
  if (!limit) throw new Error("connector/mcp.js 에서 PART_CHARS 를 못 찾음 — 나눠 주는 한도를 바꿨으면 여기도 확인");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "startlen_"));
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "");
    const f = path.resolve(repo, rel);
    if (!f.startsWith(path.resolve(repo)) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(""); }
    res.writeHead(200);
    res.end(/\.(md|mjs|js|json|ya?ml)$/i.test(f) ? fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n") : fs.readFileSync(f));
  });
  try {
    for (const f of fs.readdirSync(conn)) if (/\.m?js$/.test(f)) fs.copyFileSync(path.join(conn, f), path.join(tmp, f));
    fs.writeFileSync(path.join(tmp, "package.json"), '{"type":"module"}');
    const stub = path.join(tmp, "node_modules", "@cloudflare", "workers-oauth-provider");
    fs.mkdirSync(stub, { recursive: true });
    fs.writeFileSync(path.join(stub, "package.json"), '{"name":"@cloudflare/workers-oauth-provider","type":"module","main":"index.js"}');
    fs.writeFileSync(path.join(stub, "index.js"), "export default class X {}\nexport const OAuthProvider = X;\nexport class AuthorizationError extends Error {}\n");
    // callTool 의 start 와 같은 식 — 그 줄이 바뀌면 아래 검사가 멈춰 알려 준다
    const mcp = fs.readFileSync(path.join(tmp, "mcp.js"), "utf8");
    const expr = /text = (`\$\{START_PREAMBLE\.trimEnd\(\)\}[^`]*`);/.exec(mcp)?.[1];
    if (!expr) throw new Error("connector/mcp.js 에서 start 지침을 만드는 줄을 못 찾음 — 바뀌었으면 sync/start-len.mjs 도 맞출 것");
    fs.appendFileSync(path.join(tmp, "mcp.js"), `\nexport async function __startText(base) { rawBase = base; const entry = GUIDES.start; return ${expr}; }\n`);
    await new Promise((r) => srv.listen(0, "127.0.0.1", r));
    const m = await import(pathToFileURL(path.join(tmp, "mcp.js")).href);
    const text = await m.__startText(`http://127.0.0.1:${srv.address().port}`);
    return { length: text.length, limit };
  } finally {
    srv.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { length, limit } = await startGuideLength();
  const over = length > limit;
  console.log(`시작 지침 ${length.toLocaleString("en-US")}자 / 한도 ${limit.toLocaleString("en-US")}자 — ${over ? `★ ${length - limit}자 넘음: 두 부분으로 나간다. GUIDE.md(옛 앱 호환 문구 · 날짜 인용)나 sources.json 의 use 설명을 줄일 것` : `한 번에 나감(여유 ${limit - length}자)`}`);
  process.exitCode = over ? 1 : 0;
}
