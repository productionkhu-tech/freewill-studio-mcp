# freewill-studio 개발 규칙

사용자에게는 한국어로 답한다. 구조와 설치는 README.md. 저장소: `productionkhu-tech/freewill-studio-mcp` (**공개** —
팀원이 GitHub 계정 없이 설치하도록), 마켓플레이스 이름 `freewill`, 플러그인 이름 `freewill-studio`.

공개 저장소이므로 **비밀값·키·토큰·내부 주소(게이트웨이 등)·팀/프로젝트 실명·사내 숫자를 절대 넣지 않는다.**
외부 스킬을 새로 넣으면 `THIRD_PARTY_NOTICES.md` 에 출처·라이선스를 같이 적는다.

## 절대 하지 말 것

1. **`plugins/freewill-studio/skills/freewill-generate/official/` 을 손으로 고치지 말 것.** 동기화가 덮어쓴다.
   공식 스킬과 다르게 써야 할 부분은 `SKILL.md` 4단계 대응표의 "건너뛰는 부분"에 적는다.
2. **Claude 쪽(`.claude-plugin/`) plugin.json · marketplace.json 에 `version` 을 넣지 말 것.** 비워 두면 커밋마다 새 버전으로
   잡혀 자동 업데이트가 따라간다. 넣으면 매번 올려야 하고, 깜빡하면 아무도 업데이트를 못 받는다.
   **OpenAI 쪽(`.codex-plugin/plugin.json`)은 반대로 version 이 있어야 한다** — Codex 는 버전 번호로 폴더를 나눠서, 번호가 같으면
   새로 받지 않는다. 플러그인 파일을 고쳐 올리면 `bump-codex-version.yml` 이 자동으로 올리니 손으로 건드리지 않는다.
3. **sync.mjs 에서 `fs.cpSync` 를 쓰지 말 것.** Windows 의 Node 25 에서 한글 경로로 복사하면 메시지 없이 프로세스가
   죽는다(종료 코드 127). `copyDir` 를 쓴다.
4. **공식 스킬의 실행 지시를 살리지 말 것.** API 직접 호출, 키 설정, CLI 설치, 자체 업데이트 — 생성은 앱이,
   갱신은 이 저장소가 한다.
5. **나노바나나의 `/api/status`·`/api/events` 를 부르지 말 것.** status 는 읽는 순간 '창 닫기 요청' 신호를 지우고,
   events 는 꺼내 가는 큐라 앱 화면의 팝업을 가로챈다. 읽기는 `/api/version`·`/api/settings`·`/api/projects`·
   `/api/billing/state`·`/static/app.js` 만.
6. **앱 규칙은 저장소가 아니라 이 PC 의 앱에서 읽는다** (`scripts/read-local-apps.mjs`). 저장소가 더 새 버전이어도
   이 PC 가 업데이트 전이면 그 기능은 없다. 릴리즈는 "업데이트 있음" 알림에만 쓴다.
7. **GitHub API 를 사용자 PC 에서 부르지 말 것.** 로그인 없이 IP 당 시간 60회라 사무실에서 금방 막힌다.
   최신 릴리즈는 `github.com/<repo>/releases/latest` 가 넘겨 주는 주소로 본다 (read-local-apps.mjs 참고).

## 함께 고쳐야 하는 것

- 공식 스킬 추가·삭제: `sync/sources.json` 의 `tracked` + `SKILL.md` 4단계 대응표 (+ `models` 목록)
- 앱에 모델이 추가·변경됨: `references/app-rules.md` (앱 MCP 의 규칙 도구가 생기면 이 파일은 지운다)
  - 나노바나나 원본: `나노바나나 api/static/app.js` 의 `MODEL_SPECS`
  - 시댄스 원본: 렌더러의 모델 목록(`Rt`)과 2.5 사양(`kA`) — 설치본 `resources/dist/assets/index-*.js`

## 원격 커넥터 (`connector/`)

- Cloudflare 워커 `freewill-mcp` (`https://freewill-mcp.production-khu.workers.dev/mcp`). 상태 없는 MCP(Streamable HTTP, JSON 응답).
- 도구 두 개: `freewill_guide(topic, part)` 지침·공식 스킬, `freewill_script(name)` 앱 스크립트 원문. **GitHub main 의 raw 파일을
  5분 캐시로 그대로** 내려준다 — 그래서 저장소만 고치면 커넥터는 손댈 일이 없다.
- 손대야 하는 경우: 파일을 새로 추가하거나 경로가 바뀌면 `worker.js` 의 `GUIDES`·`SCRIPTS` 표를 고치고 `connector/` 에서 `npx wrangler deploy`.
- 긴 문서(시댄스 2.5 공식 스킬 9만 자)는 3.6만 자씩 `part` 로 나눈다 — 클라이언트 도구 응답 한도 때문.
- 키·비밀값·바인딩 없음. 공개 저장소 내용만 내려주는 읽기 전용이다. 여기에 생성 기능이나 비밀값을 넣지 말 것.

## 나노바나나로 보내기 (`plugins/freewill-studio/scripts/send-to-nanobanana.mjs`)

- 앱을 고치지 않고 앱 자체 주소로 Generate 를 누른다: 화면의 `<meta name="nb-csrf">` 토큰 → 탭 확인(`/api/projects`) →
  팀·프로젝트 확인(`/api/billing/state`) → 작업마다 `/api/refs/clear`·`/api/refs/add-path` → `/api/settings`(pid 지정) →
  `/api/generate` → 끝나면 탭 입력값을 원래대로.
- `/api/generate` 는 **화면에 떠 있는 탭**으로 들어간다(pid 를 안 받는다). 그래서 보내는 중에 탭이 바뀌면 멈춘다.
- 앱은 작업마다 설정을 스냅샷으로 저장해서, 프롬프트를 바꿔 가며 연달아 넣어도 섞이지 않는다.
- 스켈레톤 개수는 앱이 "그 탭의 남은 작업 수"로 그린다 — 화면 쪽 수정 없이 뜬다.
- **앱 코드를 import 해서 헤드리스로 생성하지 말 것.** 앱 화면에 안 떠서 사용자가 못 본다 (10/3 실제로 그렇게 해서 문제됨).
- 시험: `--dry-run` 은 아무것도 안 보내고 연결·탭·팀/프로젝트만 확인한다. 가짜 서버로는 `FREEWILL_NB_URL`.

## 로컬 앱 읽기 (`plugins/freewill-studio/scripts/read-local-apps.mjs`)

- 나노바나나: 실행 중일 때만 (127.0.0.1:5656). 화면 코드의 `MODEL_SPECS` 원문 + 지금 설정 + 팀/프로젝트 선택 상태.
- 시댄스: 실행 중이면 앱이 서빙하는 화면 코드, 아니면 설치 폴더(`%LOCALAPPDATA%\Programs\Freewill Seedance 2.0\resources`)의
  화면 코드에서 모델 목록과 그걸 읽는 함수들을 **내용으로** 찾아 잘라 온다. 압축된 변수 이름(`Rt`, `kA`)은 빌드마다
  바뀌므로 이름으로 찾지 말 것. 버전은 `app.asar` 머리말에서 `package.json` 만 읽는다.
- 앱 구조가 바뀌어 못 찾으면 "못 찾음"이라고 출력하고 스냅샷으로 넘어간다 — 지어내지 않는다.
- 시험: `FREEWILL_NB_URL`·`FREEWILL_SD_URL` 로 주소를 바꿔 가짜 서버에 붙일 수 있다.

## 확인

```bash
node sync/sync.mjs --dry-run
node plugins/freewill-studio/scripts/read-local-apps.mjs
```

받기·비교·검사까지 하고 파일은 안 바꾼다. 실제 반영은 GitHub Actions 가 매일 한다. 로컬에서 실제로 돌리면
`official/`, `sync/official.lock.json`, `sync/CHANGELOG.md` 가 바뀌니 커밋할 때 같이 올린다.
