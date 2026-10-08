# freewill-studio

나노바나나(이미지)·시댄스(영상) 생성을 **Claude 와 GPT(Codex·ChatGPT)** 에서 하기 위한 사내 플러그인. 저장소 하나로 두 쪽에 다 깔린다.

- **모델별 공식 프롬프팅 스킬**로 프롬프트를 쓴다 — BytePlus(시댄스 2.5·2.0), Google(Gemini Omni), OpenAI(GPT Image).
  원본이 바뀌면 **매일 자동으로 따라간다.**
- **이 PC 에 깔린 앱을 읽고** 그 버전의 규칙대로 묻는다 — 저장소가 더 새 버전이어도 이 PC 가 업데이트 전이면
  그 기능은 없으니까. 모델·모드에 따라 필요한 것만, 한 번에, 선택지로.
- **확인을 받고 앱으로 넘긴다** — 답은 버튼으로 한다(Claude 는 자체 선택지, Codex 는 커넥터가 띄우는 선택 창 `freewill_ask`).
  팀·프로젝트는 사람이 앱에서 고른다.
- **프롬프트는 앱에 맞게 점검한다** — 본문은 영어(대사·그림 속 글자만 그 언어), 레퍼런스는 앱 표기 `[Image N]`,
  첫·끝 프레임 모드는 표기 없이(앱이 역할로 묶음). 어긋나면 보내기 스크립트가 dry-run 에서 멈춘다.
- **보내는 양에 한도가 있다** — 나노바나나는 동시 10장(그 PC 의 앱)·하루 1,000장(한 사람), 시댄스는 동시 3개·하루 200개.
  넘으면 스크립트가 앞의 것이 끝나길 기다리거나(동시) 보내지 않는다(하루). 사람이 앱에서 직접 만드는 건 그대로다.
- **회사 구글 계정으로 로그인하고, MCP 로 보낸 건 누가·어느 PC·어떤 모델·몇 개인지 기록된다**(프롬프트·그림은 안 남김) — 관리자 화면 `/admin`.
- **스크립트는 이 PC 의 앱과만 통신한다** — 커넥터가 내려주기 직전과 푸시마다 검사한다(`connector/script-check.mjs`).
- 개인 스킬은 자유롭게 같이 쓴다.

> **나노바나나**: 확인을 받으면 띄워 둔 앱으로 바로 보낸다 — 앱에 스켈레톤이 뜨고, 완성되면 갤러리에 들어오고,
> 끝나면 결과를 열어 보고 알려준다 (`scripts/send-to-nanobanana.mjs`, 앱 수정 없이 앱 자체 주소로 Generate).
> **시댄스** (앱 26.10.304 이상): 확인을 받으면 띄워 둔 앱으로 바로 보낸다 — 앱이 작성 칸을 잠깐 빌려 전송 버튼과 같은 길로
> 보내고 원래대로 돌려놓는다. 생성 중 카드·권한 검사·크레딧 집계가 평소대로 된다 (`scripts/send-to-seedance.mjs`).
> 무엇을 보낼 수 있는지는 **시댄스가 직접 낸 사용 설명서**가 정답이라, 시댄스에 모델이 추가되거나 한도가 바뀌어도
> 이 저장소는 그대로다. 앱이 업데이트되면 앱이 "설명서를 다시 읽으라"고 돌려보내서 한 채팅방을 오래 써도 맞춰진다.
> 26.10.305 부터는 생성 말고도 **어셋 라이브러리(컬렉션·엘리먼트 등록 → 프롬프트에서 `@{이름}`), 카드(본편·다운로드·채택·재생성),
> 프로젝트, 크레딧 사용량 보기**를 에이전트가 앱 버튼과 같은 함수로 한다. 지우기와 과금 프로젝트 고르기는 사람이 앱에서.
> 그 전 버전이면 프롬프트·설정을 정리해 주고 사람이 옮겨 적는다.

## 가장 쉬운 방법: 커넥터 연결 (설치·업데이트 없음)

Higgsfield 처럼 주소 하나만 연결한다. 커넥터가 이 저장소의 **최신 지침·공식 스킬·앱 스크립트를 그때그때** 내려주므로
업데이트할 게 없다. 연결 주소:

```
https://freewill-mcp.production-khu.workers.dev/mcp
```

**회사 구글 계정(@studiofreewill.com)으로 로그인해야 쓴다.** 연결할 때 구글 로그인 창이 뜨고, 로그인은 7일 유지된다
(지나면 다시 로그인). 회사 밖 계정은 거절된다.

| 어디서 | 연결하는 곳 |
|---|---|
| **Claude** (웹·데스크톱·Code 탭 한 번에) | 설정 → 커넥터 → **커스텀 커넥터 추가** → 이름 `freewill`, 위 주소 → **연결**(구글 로그인). 회사 플랜에서 관리자만 추가할 수 있게 돼 있으면 관리자가 한 번 추가하고 팀원은 "연결"만 누른다 |
| Claude Code (터미널) | `claude mcp add --scope user --transport http freewill https://freewill-mcp.production-khu.workers.dev/mcp` → `/mcp` 에서 freewill 인증 |
| **Codex** (앱·CLI) | **아래 플러그인을 설치한다** — 커넥터가 같이 등록된다. 처음 보낼 때 에이전트가 구글 로그인 창을 띄우고, 사람은 회사 계정만 고른다(터미널 명령 없음) |
| ChatGPT | 설정 → 앱·커넥터에서 커스텀 커넥터(MCP)로 위 주소 추가 (플랜·워크스페이스 설정에 따라 관리자가 해야 할 수 있음) |

커넥터는 생성을 하지 않는다 — 키 없이 지침과 스크립트만 내려준다. 띄워 둔 앱에 작업을 넣는 건 PC 에서 도는 에이전트(Code 탭·Codex)가
커넥터에서 받은 스크립트로 한다. 그래서 claude.ai 웹·Cowork·ChatGPT 웹에서는 프롬프트·설정 정리까지만 된다.

**사용 기록**: 커넥터가 스크립트를 내려줄 때 받는 사람의 로그인 표(12시간)를 넣고, 스크립트는 앱에 넣기 직전마다 커넥터에
누가·언제·어느 PC(윈도우 사용자)·무슨 모델·해상도·몇 장/개·과금 프로젝트를 남긴다. 하루 한도(한 사람 이미지 1,000장 · 영상 200개)도
여기서 센다. **프롬프트와 그림은 보내지 않는다.** 표가 없거나 만료된 스크립트는 보내지 않는다(커넥터에서 다시 받으면 된다).
관리자는 `https://freewill-mcp.production-khu.workers.dev/admin` (관리자 구글 계정)에서 날짜·사람·PC·모델별로 보고 CSV 로 받는다.
같은 화면의 **사람별 한도 조정**에서 특정 사람의 하루 한도를 늘리거나 줄이고(기간 지정 가능), 0 으로 막을 수 있다 — 배포 없이 바로 적용.
앱에서 사람이 직접 만든 것은 여기 없고 각 앱의 집계에 있다.

> **플러그인에는 커넥터가 들어 있다**(2026-10-08~). Codex·Claude Code 는 플러그인 하나만 설치하면 되고, 커넥터를 따로 추가해 둔 게 있으면 지운다(같은 이름 freewill 이 둘이 된다). claude.ai 웹·데스크톱 채팅은 위 커스텀 커넥터로.
> 보내기는 커넥터 로그인 뒤 `freewill_script` 로 받은 스크립트로만 된다 — 플러그인 폴더에 깔린 사본은 표가 없어서 보내지 못한다.

## 플러그인으로 설치 (Codex·Claude Code — 커넥터 포함)

공개 저장소라 GitHub 계정은 필요 없다. 마켓플레이스 주소는 어디서든 이것 하나:

```
https://github.com/productionkhu-tech/freewill-studio-mcp.git
```

> 주소는 꼭 `https://…git` 전체로. `productionkhu-tech/freewill-studio-mcp` 처럼 줄여 쓰면 SSH 로 받으려다 실패하는 경우가 있다.
> 플러그인은 마켓플레이스마다 **자동 업데이트를 한 번 켜야** 계속 최신을 받는다 (주소로 추가한 목록은 기본이 꺼짐).

### Claude 에서 불러오기

1. Claude 앱 → **Customize(사용자 지정) → Plugins → Add → Add marketplace**
2. 위 주소를 붙여넣는다
3. 목록에 뜬 **freewill-studio** 를 설치한다

Code 탭 대화창의 `/plugin` 명령은 데스크톱 앱에서는 안 된다 (터미널 Claude Code 전용).

<details>
<summary>위 메뉴가 안 보이거나 Code 탭에 바로 넣고 싶을 때 (PowerShell)</summary>

통째로 붙여넣는다. 플러그인을 설치하고 자동 업데이트까지 켠다 (설정 파일의 기존 내용은 그대로 두고 한 칸만 넣는다).

```powershell
$c = (Get-ChildItem "$env:APPDATA\Claude\claude-code" -Recurse -Filter claude.exe | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
& $c plugin marketplace add https://github.com/productionkhu-tech/freewill-studio-mcp.git
& $c plugin install freewill-studio@freewill
$cfg = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $env:USERPROFILE ".claude" }
$s = Join-Path $cfg "settings.json"
$j = [IO.File]::ReadAllText($s) | ConvertFrom-Json
$j.extraKnownMarketplaces.freewill | Add-Member -NotePropertyName autoUpdate -NotePropertyValue $true -Force
[IO.File]::WriteAllText($s, ($j | ConvertTo-Json -Depth 32), (New-Object Text.UTF8Encoding $false))
```

터미널 Claude Code: `/plugin marketplace add <주소>` → `/plugin install freewill-studio@freewill`,
자동 업데이트는 `/plugin` → Marketplaces → `freewill` → Enable auto-update.
</details>

### GPT 에서 불러오기 (Codex 앱 · ChatGPT 데스크톱)

1. Codex 앱 대화창에 이렇게 보낸다 — Codex 가 직접 실행한다:
   ```
   codex plugin marketplace add https://github.com/productionkhu-tech/freewill-studio-mcp.git 실행해줘
   ```
2. **Plugins** → 마켓플레이스 고르는 곳에서 **Freewill (프리윌루전)** → **Freewill Studio** 설치
3. 새 대화부터 적용된다

새 버전 받기: 같은 식으로 `codex plugin marketplace upgrade freewill` 을 실행하고 앱을 다시 켠다.
ChatGPT 웹·모바일까지 띄우려면 워크스페이스 관리자가 이 GitHub 마켓플레이스를 가져오면 된다.

## 어디서 얼마나 되나

| 어디서 | 이 PC 앱 읽기 | 비고 |
|---|---|---|
| Claude 데스크톱 Code 탭 · Claude Code | ✅ | 가장 정확 |
| Codex 앱 · CLI | ✅ | 가장 정확 |
| Cowork · claude.ai · ChatGPT 웹 | ✗ | 이 PC 밖에서 돌아서 앱 규칙 스냅샷으로만 |

Node.js 는 없어도 된다 — 없으면 기본 도구로 앱을 읽는다.

## 쓰는 법

그냥 말하면 된다.

- "시댄스 2.5로 이 콘티 이미지 넣어서 10초 영상 프롬프트 써줘"
- "GPT 선버스트로 제품 사진 배경만 바꾸는 프롬프트"
- "이 프롬프트 Seedance 2.0 공식 방식으로 다듬어줘"
- "지금 공식 가이드 버전 뭐야?"

## 구조

```
connector/                             원격 MCP 커넥터 (Cloudflare 워커 freewill-mcp) — 저장소 최신본을 그대로 내려줌
  ask.js                               선택 창(freewill_ask) — MCP elicitation, 답을 기다리는 자리는 Durable Object
.claude-plugin/marketplace.json        Claude 용 마켓플레이스 "freewill"
.agents/plugins/marketplace.json       GPT(Codex·ChatGPT) 용 마켓플레이스 "freewill"
plugins/freewill-studio/
  .claude-plugin/plugin.json           Claude 용 (version 없음 — 커밋마다 새 버전)
  .codex-plugin/plugin.json            GPT 용 (version 있음 — 자동으로 올라감)
  scripts/read-local-apps.mjs          이 PC 앱의 버전·모델 규칙·지금 설정 읽기
  skills/freewill-generate/            ← 두 쪽이 같이 쓰는 스킬
    SKILL.md                           시작점 — 로그인, 그리고 "최신 지침은 커넥터에서"
    GUIDE.md                           전체 지침(질문 → 공식 가이드 → 확인 카드 → 앱) — 커넥터가 이걸 내려준다
    references/
      read-apps-without-node.md        Node 없는 PC 에서 앱 읽는 법
      app-rules.md                     앱 규칙 스냅샷 (마지막 수단)
      interview.md                     질문 방식
      house-rules.md                   사내 규칙
    official/                          ← 자동 동기화 영역, 손대지 말 것
      VERSIONS.md                      지금 들어 있는 버전
      sd25-pe/ sd2-pe/ gemini-omni-flash-api/ imagegen/ higgsfield-generate/
sync/
  sources.json                         어떤 공식 스킬을 어디서 받는지
  sync.mjs                             받기 · 비교 · 검사 · 반영 · 기록
  official.lock.json                   반영된 해시·버전 (자동)
  CHANGELOG.md                         바뀐 기록 (자동)
.github/workflows/
  sync-official.yml                    매일 09:17 공식 스킬 동기화
  bump-codex-version.yml               플러그인을 고치면 GPT 용 버전 자동으로 올림
```

## 공식 스킬 자동 연동

매일 GitHub 에서 `sync/sync.mjs` 가 돈다.

1. `sources.json` 의 공식 스킬을 원본에서 받아 지금 들어 있는 것과 내용 지문을 비교한다.
2. 바뀌었으면
   - **auto** (BytePlus·Google·OpenAI): 검사를 통과하면 바로 반영하고 커밋한다.
     검사 — 파일이 깨지지 않았는지, 크기가 급변하지 않았는지, `curl … | sh` 같은 위험 문구가 새로 생기지 않았는지.
     하나라도 걸리면 멈추고 이슈로 알린다.
   - **review** (Higgsfield): 이슈로 알리고 사람이 보고 반영한다.
3. 원본 목록에 **새 스킬**이 올라오면(시댄스 3 의 `sd3-pe` 같은 것) 이슈로 알린다.

검토 대기 중인 걸 반영하려면:

```bash
node sync/sync.mjs --accept higgsfield-generate
```

받아서 비교만 해 보려면 `node sync/sync.mjs --dry-run`.

### 새 모델이 나오면

1. 이슈로 새 공식 스킬 알림이 온다 (예: `sd3-pe`).
2. `sync/sources.json` 의 `tracked` 에 추가하고, `GUIDE.md` 4단계 대응표에 모델 ID ↔ 스킬을 연결한다.
3. 앱에 새 모델이 들어가면 `references/app-rules.md` 도 갱신한다 (앱 MCP 가 생기면 불필요).

## 개인 스킬

개인 스킬은 각자 설치해서 같이 쓰면 된다. "내 ○○ 스킬로" 라고 하면 그걸 쓴다.
팀·프로젝트 선택, 개수 한도, 보내기 전 확인은 개인 스킬을 써도 그대로다.
