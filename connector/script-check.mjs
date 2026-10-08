// 앱 스크립트 통신 검사.
//
// 커넥터가 내려주는 스크립트(read-local-apps · send-to-*)는 테스터 PC 에서 그대로 node 로 실행된다.
// 그래서 이 PC 의 앱(127.0.0.1), 우리 GitHub 릴리스 페이지, 이 커넥터(사용 기록·하루 한도) 말고는 어디와도
// 통신하지 못하게 한다.
// 워커는 내려주기 직전에, Actions(check-scripts.yml)는 푸시마다 같은 검사를 돌린다.
//
// 실수나 단순한 변조를 막는 장치다. 주소를 글자 단위로 쪼개 숨기는 식의 의도적인 변조까지 잡지는 못한다 —
// 그건 저장소 쓰기 권한(계정 2단계 인증 · 저장소 한정 토큰)으로 막는다.

const ALLOWED_URLS = [
  /^http:\/\/127\.0\.0\.1:\d+/,
  /^http:\/\/localhost:\d+/,
  /^https:\/\/github\.com\/productionkhu-tech\//,
  /^https:\/\/freewill-mcp\.production-khu\.workers\.dev(?:\/|$)/,
];

const ALLOWED_IMPORTS = new Set(["node:fs", "node:os", "node:path", "node:url", "node:util", "node:crypto"]);

const FORBIDDEN = [
  [/child_process/, "다른 프로그램 실행(child_process)"],
  [/\beval\s*\(/, "eval"],
  [/\bnew\s+Function\s*\(/, "new Function"],
  [/\bimport\s*\(/, "동적 import"],
  [/\brequire\s*\(/, "require"],
  [/\b(?:WebSocket|EventSource)\b/, "WebSocket·EventSource"],
  [/\bprocess\.(?:binding|dlopen)\b/, "process.binding·dlopen"],
];

// 문제 목록을 돌려준다. 빈 배열이면 통과.
export function checkScript(code) {
  const problems = [];
  for (const m of code.matchAll(/^\s*(?:import|export)\b[^;"'\n]*?\bfrom\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']/gm)) {
    const mod = m[1] || m[2];
    if (!ALLOWED_IMPORTS.has(mod)) problems.push(`허용 안 된 모듈: ${mod}`);
  }
  for (const [re, label] of FORBIDDEN) if (re.test(code)) problems.push(`허용 안 된 기능: ${label}`);
  for (const m of code.matchAll(/\b(?:https?|wss?|ftp):\/\/[^\s"'`)<>\]]+/gi)) {
    if (!ALLOWED_URLS.some((re) => re.test(m[0]))) problems.push(`허용 안 된 주소: ${m[0]}`);
  }
  for (const m of code.matchAll(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g)) {
    if (m[0] !== "127.0.0.1") problems.push(`허용 안 된 IP: ${m[0]}`);
  }
  return [...new Set(problems)];
}
