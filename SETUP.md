# 프리윌 스튜디오 MCP 세팅

**사람이 할 일**: 이 파일을 Claude 데스크톱(Code 탭)이나 Codex 대화창에 끌어다 놓고 "이대로 세팅해 줘"라고 보내기.
파일 대신 이 주소를 붙여 넣어도 됨: https://github.com/productionkhu-tech/freewill-studio-mcp/blob/main/SETUP.md
그다음엔 실행 승인, 회사 구글 계정(@studiofreewill.com) 고르기, 새 대화 열기만 하면 됨.
세팅이 끝난 뒤 새 대화에 이 파일을 다시 넣고 "확인해 줘"라고 하면 연결 상태를 확인해 줌.

---

## 에이전트에게

이 사용자의 PC에 **프리윌 스튜디오 MCP**(나노바나나·시댄스를 대화로 쓰게 하는 사내 커넥터)를 연결한다.

지킬 것
- 이 파일에 적힌 명령만 실행한다. 다른 설정·플러그인·MCP 서버는 바꾸거나 지우지 않는다.
- 키·토큰·비밀번호를 묻거나 입력하지 않는다. 로그인은 사람이 브라우저에서 한다.
- 실행 승인을 물을 때는 무엇을 하는 명령인지 한 줄로 알린다.

| 이름 | 주소 |
|---|---|
| 연결 주소 | `https://freewill-mcp.production-khu.workers.dev/mcp` |
| 플러그인 주소 | `https://github.com/productionkhu-tech/freewill-studio-mcp.git` |

### 0. 이미 연결돼 있나

이 대화의 도구 목록에 이름이 `freewill_guide` 로 끝나는 도구가 있으면 연결된 상태다.
그 도구를 topic `start` 로 불러 맨 위에 "지침 버전"이 나오면 연결은 끝났다. 이어서 **앱 상태**를 본다(명령을 쓸 수 있을 때만 — 읽기만 한다).

1. `node -v` — 없으면 "앱으로 보내는 스크립트는 Node(LTS)가 있어야 편하다. 없어도 PowerShell 길로 보낼 수는 있다 — 설치는 TA팀에 문의"라고 알린다(설치하지 않는다).
2. `freewill_script` 도구로 `read-local-apps` 를 받아 임시 폴더에 `.mjs` 로 저장하고 `node` 로 실행한다(Codex 는 샌드박스 밖 승인).
   두 앱이 켜져 있는지, 버전이 최신인지(⬆ 표시), 과금이 골라져 있는지가 나온다.

사용자에게 아래처럼 알리고 끝낸다.

- 연결돼 있음(지침 버전 ○○○○)
- 앱: 나노바나나 ○○ · 시댄스 ○○ — 꺼져 있으면 켜 달라고, ⬆ 가 있으면 "앱을 완전히 껐다 켜면(트레이에서 종료) 새 버전이 깔림"
  (나노바나나 v2026-10-2001 · 시댄스 26.10.2004 부터는 탭 · 프로젝트를 바꾸지 않고 보낸다)
- 과금은 사람이 앱에서 고름 — 나노바나나는 탭마다(탭 옆 ! · 앱을 켤 때마다 한 번 확인), 시댄스는 설정 패널 맨 위 '프로젝트 코드'
- (Codex 일 때) 권한은 '기본' 또는 '자동 검토'로 — '전체 액세스'면 "이대로 생성할까요?" 선택 버튼이 안 뜨고 말로 답해야 함
- 나노바나나·시댄스를 켜 두고 말로 시키면 됨. 예: "나노바나나 2.1 2K로 이 콘티 10컷, 두 장씩", "3번만 더 어둡게 다시", "오늘 시댄스 크레딧 얼마 썼어?"
- 작업을 시작할 때 프로젝트 폴더와 프로젝트 코드(예: ABC)를 알려 주면 결과가 그 안의 씬 → 컷 폴더에 회사 이름 규칙으로 정리됨

도구가 없으면 지금 도는 곳에 따라 1(Codex) 또는 2(Claude)로 간다.

### 1. Codex (앱·CLI)

명령이 GitHub와 로그인 창(127.0.0.1)에 닿아야 하므로 **처음부터 샌드박스 밖(네트워크 허용)으로 실행 승인**을 받는다.

1. codex 실행 파일을 찾는다. `CODEX_CLI_PATH` 환경 변수 → PATH 의 `codex` → (Windows) `%LOCALAPPDATA%\OpenAI\Codex\bin\*\codex.exe` 중 가장 최근 것 순서.
   앱 폴더 맨 위의 `bin\codex.exe` 는 옛 버전이라 쓰지 않는다.
   ```powershell
   $cx = $env:CODEX_CLI_PATH
   if (-not $cx) { $cx = (Get-Command codex -ErrorAction SilentlyContinue).Source }
   if (-not $cx) { $cx = (Get-ChildItem "$env:LOCALAPPDATA\OpenAI\Codex\bin\*\codex.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName }
   ```
2. 마켓플레이스와 플러그인을 넣는다. 플러그인 안에 커넥터가 들어 있어 같이 등록된다.
   ```powershell
   & $cx plugin marketplace add https://github.com/productionkhu-tech/freewill-studio-mcp.git
   & $cx plugin add freewill-studio@freewill
   ```
   마켓플레이스가 이미 있다고 하면 `& $cx plugin marketplace upgrade freewill` 을 실행하고 `plugin add` 를 다시 한다.
3. `& $cx mcp list` 에 `freewill` 한 줄이 보이는지 확인한다. 두 줄이면(예전에 손으로 넣은 것) 지우지 말고 사용자에게 알린 뒤 TA팀에 문의하라고 한다.
4. 로그인: `& $cx mcp login freewill` → 브라우저가 열린다. 사용자에게 "회사 구글 계정(@studiofreewill.com)을 골라 주세요"라고 한 줄로 알린다. 회사 밖 계정은 거절된다.
5. 끝나면 사용자에게: "Codex 앱을 껐다 켜고 새 대화를 열어 주세요. 새 대화에 이 파일을 넣고 '확인해 줘'라고 하면 연결을 확인합니다."

### 2. Claude (데스크톱 앱)

Claude 커넥터는 Claude 계정에 붙는 것이라 에이전트가 대신 추가할 수 없다. 사람이 설정에서 누르도록 안내한다.
플러그인은 설치하지 않는다. 커넥터만으로 되고, 같이 깔면 같은 도구가 두 번 잡힌다.

1. 명령을 쓸 수 있으면(Code 탭) 연결 주소를 클립보드에 넣어 두고, 넣었다고 알린다.
   - Windows: `Set-Clipboard -Value "https://freewill-mcp.production-khu.workers.dev/mcp"`
   - Mac: `printf %s "https://freewill-mcp.production-khu.workers.dev/mcp" | pbcopy`
2. 사용자에게 이 순서를 그대로 보여 준다.
   1. Claude 데스크톱 앱 → 설정 → 커넥터
   2. 목록에 '프리윌 스튜디오 MCP'가 있으면 '연결'. 없으면 '커스텀 커넥터 추가' → 이름 `프리윌 스튜디오 MCP`, 주소는 붙여넣기 → 추가 → '연결'
   3. 구글 로그인 창에서 회사 계정(@studiofreewill.com) 고르기. Claude 계정과 달라도 됨
   4. Code 탭에서 새 대화를 열고, 이 파일을 넣어 "확인해 줘"
3. 막히면
   - 관리자만 추가할 수 있다고 나옴 → TA팀에 요청
   - "계정 불일치" → 브라우저의 claude.ai 가 데스크톱과 다른 Claude 계정으로 로그인된 상태. 데스크톱과 같은 계정으로 claude.ai 웹에 로그인해 거기서 설정 → 커넥터 → 연결(데스크톱에도 같이 연결됨). 크롬 프로필이 여러 개면 그 계정이 로그인된 프로필 창에서.

### 3. 알려 줄 것

- 앱으로 보내기까지 되는 곳: Claude 데스크톱 Code 탭, Codex 앱
- 프롬프트·설정 정리까지만 되는 곳: claude.ai 웹, Claude 일반 채팅, Cowork, ChatGPT 웹
- 보내려면 이 PC에 나노바나나·시댄스가 깔려 있고 켜져 있어야 함(완전히 껐다 켜면 자동 업데이트). 없으면 TA팀에 문의
- 과금(나노바나나 탭의 팀·프로젝트, 시댄스 프로젝트 코드)은 사람이 앱에서 고름 — 안 골라져 있으면 에이전트가 골라 달라고 함
- Codex 권한이 '전체 액세스'면 Codex 가 선택 창을 띄우지 않고 자동으로 거절함 → 확인을 말로 받음. 버튼으로 받으려면 '기본'·'자동 검토'
- Claude 에서 보내기가 "자동 권한 검사에서 막힘(자격 증명 유출)"으로 멈추면 → 입력창 아래 권한 모드를 '자동'에서 '권한 묻기'로 바꾸고 다시 보내라고 하기(허용 창에서 허용). 새 대화에서 해도 됨
- 연결 확인은 새 대화에 이 파일을 넣고 "확인해 줘" — 연결 · 앱 버전 · 과금까지 한 번에 봄
- 로그인은 30일 유지. 지나면 같은 방법으로 다시 로그인
