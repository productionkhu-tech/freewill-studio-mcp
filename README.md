# freewill-studio

나노바나나(이미지)·시댄스(영상) 생성을 **Claude 와 GPT(Codex·ChatGPT)** 에서 하기 위한 사내 플러그인. 저장소 하나로 두 쪽에 다 깔린다.

- **모델별 공식 프롬프팅 스킬**로 프롬프트를 쓴다 — BytePlus(시댄스 2.5·2.0), Google(Gemini Omni), OpenAI(GPT Image).
  원본이 바뀌면 **매일 자동으로 따라간다.**
- **이 PC 에 깔린 앱을 읽고** 그 버전의 규칙대로 묻는다 — 저장소가 더 새 버전이어도 이 PC 가 업데이트 전이면
  그 기능은 없으니까. 모델·모드에 따라 필요한 것만, 한 번에, 선택지로.
- **확인을 받고 앱으로 넘긴다.** 팀·프로젝트는 사람이 앱에서 고른다.
- 개인 스킬은 자유롭게 같이 쓴다.

> **나노바나나**: 확인을 받으면 띄워 둔 앱으로 바로 보낸다 — 앱에 스켈레톤이 뜨고, 완성되면 갤러리에 들어오고,
> 끝나면 결과를 열어 보고 알려준다 (`scripts/send-to-nanobanana.mjs`, 앱 수정 없이 앱 자체 주소로 Generate).
> **시댄스**: 아직은 프롬프트·설정을 정리해 주면 앱에 옮겨 적는다 (보안 정리 후 연동 예정).

공개 저장소라 GitHub 계정은 필요 없다. 마켓플레이스 주소는 어디서든 이것 하나:

```
https://github.com/productionkhu-tech/freewill-studio-mcp.git
```

> 주소는 꼭 `https://…git` 전체로. `productionkhu-tech/freewill-studio-mcp` 처럼 줄여 쓰면 SSH 로 받으려다 실패하는 경우가 있다.

## Claude 에서 불러오기

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

## GPT 에서 불러오기 (Codex 앱 · ChatGPT 데스크톱)

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
.claude-plugin/marketplace.json        Claude 용 마켓플레이스 "freewill"
.agents/plugins/marketplace.json       GPT(Codex·ChatGPT) 용 마켓플레이스 "freewill"
plugins/freewill-studio/
  .claude-plugin/plugin.json           Claude 용 (version 없음 — 커밋마다 새 버전)
  .codex-plugin/plugin.json            GPT 용 (version 있음 — 자동으로 올라감)
  scripts/read-local-apps.mjs          이 PC 앱의 버전·모델 규칙·지금 설정 읽기
  skills/freewill-generate/            ← 두 쪽이 같이 쓰는 스킬
    SKILL.md                           질문 → 공식 가이드 → 확인 카드 → 앱
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
2. `sync/sources.json` 의 `tracked` 에 추가하고, `SKILL.md` 4단계 대응표에 모델 ID ↔ 스킬을 연결한다.
3. 앱에 새 모델이 들어가면 `references/app-rules.md` 도 갱신한다 (앱 MCP 가 생기면 불필요).

## 개인 스킬

개인 스킬은 각자 설치해서 같이 쓰면 된다. "내 ○○ 스킬로" 라고 하면 그걸 쓴다.
팀·프로젝트 선택, 개수 한도, 보내기 전 확인은 개인 스킬을 써도 그대로다.
