---
name: freewill-generate
description: 나노바나나(이미지)·시댄스(영상)로 만들 것을 맡을 때 쓴다 — "이미지/영상 만들어줘", "프롬프트 써줘·다듬어줘", "이 콘티로 영상", "레퍼런스로 영상", 시댄스 2.5/2.0, Gemini Omni, GPT Image 2/2.5(선버스트·플레어), Seedream, 나노바나나 Gemini 이미지 프롬프트 요청. 모델별 공식 프롬프팅 스킬(BytePlus sd25-pe·sd2-pe, Google Omni, OpenAI imagegen)을 따라 쓰고, 앱 규칙에 맞는 것만 묻고, 확인을 받은 뒤 앱으로 넘긴다.
---

# 프리윌 스튜디오 — 나노바나나 · 시댄스

**이 파일은 시작점이다. 실제 지침은 매번 커넥터에서 최신본을 받는다** — 그래야 모델이 새로 나오거나 규칙이 바뀌어도
이 플러그인을 업데이트하지 않고 늘 최신으로 일한다(커넥터는 GitHub 최신본을 5분 안에 내려준다).

1. 이 대화에 `freewill_guide`·`freewill_script` 도구가 있으면 **먼저 `freewill_guide(topic="start")` 를 받아 그대로 따른다.**
   이 폴더의 `GUIDE.md`·`references/`·`official/` 사본보다 그게 우선이다(사본은 플러그인을 설치한 때의 것이라 낡았을 수 있다).
2. 도구가 없으면 커넥터 로그인 전이다 — 아래 "로그인" 대로 한다. 로그인 전에는 이 폴더의 `GUIDE.md` 사본으로 프롬프트·설정
   정리까지만 하고(낡았을 수 있다고 말한다), 앱으로 보내기는 하지 않는다.

## 로그인 — 앱으로 보내려면 커넥터 로그인이 필요하다

**프롬프트 쓰기·다듬기는 로그인 없이 된다. 앱으로 보내기(6단계)는 "프리윌 스튜디오 MCP" 커넥터에 회사 구글 계정
(@studiofreewill.com)으로 로그인돼 있어야 한다.** 커넥터는 이 플러그인을 설치하면 같이 등록된다. 로그인하는 곳은 커넥터
하나뿐이다 — **나노바나나·시댄스 앱에는 구글 로그인이 없고, "Freewill Studio" 라는 앱도 없다.** 없는 버튼·메뉴·키를
지어내 안내하지 않는다.

로그인됐는지는 이 대화에 `freewill_script`·`freewill_guide` 도구가 있는지로 안다. 없으면 **에이전트가 로그인을 시작한다 —
사람은 브라우저에서 회사 구글 계정만 고른다.** 사용자에게 터미널 명령을 시키지 않는다(Codex 명령은 보통 PATH 에도 없다).

- **Codex** — 아래를 직접 실행한다(실행 승인을 받는다). 브라우저가 열리고, 사람이 계정을 고를 때까지 기다린다(2분쯤):
  ```powershell
  $cx = if ($env:CODEX_CLI_PATH) { $env:CODEX_CLI_PATH } else { (Get-ChildItem "$env:LOCALAPPDATA\OpenAI\Codex\bin\*\codex.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName }
  & $cx mcp login freewill
  ```
  Codex 샌드박스는 네트워크를 막으므로 이 명령도 **네트워크 허용(샌드박스 밖)으로 실행 승인**을 받아 돌린다.
  "freewill 이 없다"고 나오면 플러그인이 옛 버전이다 — `& $cx mcp add freewill --url https://freewill-mcp.production-khu.workers.dev/mcp`
  다음 다시 login. 로그인이 끝나면 **"새 대화를 열어 주세요"** 라고만 말한다(도구는 새 대화부터 보인다).
- **Claude** — 에이전트가 대신 누를 수 없다. "설정 → 커넥터에서 freewill **연결**을 한 번 눌러 회사 구글 계정으로
  로그인해 주세요" 라고 한 줄로 안내한다(Claude Code 터미널이면 `/mcp` → freewill → 인증).
- 로그인 전에는 프롬프트·설정 정리까지만 하고, 로그인되면 이어서 보낸다.

로그인은 **7일** 유지된다(지나면 같은 방식으로 다시). 보내기 스크립트는 `freewill_script` 로 받을 때마다 12시간짜리 표가
들어 있어서, "표 없음/만료"가 나오면 **에이전트가 다시 받으면 된다 — 사용자에게 로그인을 다시 하라고 하지 않는다.**
"로그인 표"는 내부 장치라 사용자에게 꺼내 말하지 않는다. 플러그인 폴더에 깔린 `scripts/send-to-*.mjs` 는 표가 없어서
보내지 못한다 — 보낼 때는 항상 `freewill_script` 로 받은 원문을 쓴다(응답의 ```js 블록 안 코드만 .mjs 로 저장 — 앞의 안내 문장까지 넣으면 문법 오류).
