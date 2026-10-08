# Node 없이 이 PC 앱 읽기

`node` 명령이 없으면 (팀원 PC 대부분이 그렇다) `scripts/read-local-apps.mjs` 대신 에이전트 기본 도구(명령 실행, 파일 검색
Grep·rg)로 직접 읽는다. Claude Code·Codex 둘 다 같은 방법이다.
**읽기만 한다.** 결과는 스크립트와 같은 기준으로 쓴다 — 이 PC 의 앱이 정답, 스냅샷은 마지막 수단.

## 나노바나나 — 켜져 있을 때만

Windows PowerShell 에서 `curl` 은 다른 명령이다. 꼭 `curl.exe` 라고 쓴다 (Windows 10 이상 기본 내장).

```
curl.exe -s http://127.0.0.1:5656/api/version
curl.exe -s http://127.0.0.1:5656/api/billing/state
curl.exe -s http://127.0.0.1:5656/api/settings
curl.exe -s http://127.0.0.1:5656/static/app.js -o "<임시 폴더>/nb-app.js"
```

- `version` 이 응답하지 않으면 꺼져 있는 것 → 켜 달라고 한다.
- `billing/state` 의 `confirmed` 가 false 거나 `project_id` 가 비었으면 → 앱에서 팀·프로젝트를 먼저 고르게 하고 멈춘다.
- `settings` 에서는 model · resolution · aspect · quality · count · output_dir · ref_limit 만 본다. 프롬프트 칸은 보지 않는다.
- 받아 둔 `nb-app.js` 에서 `MODEL_SPECS = {` 줄을 찾아(Grep -n) 그 줄부터 닫는 `};` 까지 읽는다 (Read, 약 100줄).
- **`/api/status` 와 `/api/events` 는 부르지 않는다.** 앱의 닫기 신호를 지우고 화면 팝업을 가로챈다.

## 시댄스 — 꺼져 있어도 된다

**버전** — 실행 파일 속성:

```powershell
(Get-Item "$env:LOCALAPPDATA\Programs\Freewill Seedance 2.0\Freewill Seedance 2.0.exe").VersionInfo.FileVersion
```

Mac: `defaults read "/Applications/Freewill Seedance 2.0.app/Contents/Info" CFBundleShortVersionString`

**규칙** — 화면 코드 `…\Freewill Seedance 2.0\resources\dist\assets\index-*.js`. 한 줄짜리 압축 코드라 통째로는 안 읽힌다.
검색 도구(Grep, `rg -o`)를 `-o` (일치한 부분만)로 써서 **한 번에 400자 안쪽**으로 잘라 읽는다. 더 길게 잡으면 도구가 줄을 생략한다.
이어서 보려면 앞 결과의 마지막 몇 글자를 다음 패턴의 시작으로 쓴다.

1. 모델 목록 — `id:"dreamina-seedance-2-0-260128".{0,400}` 로 시작해서 `}]` 가 나올 때까지 이어 읽는다.
2. 목록 안에 `...이름` (펼쳐 쓰는 값, 지금은 2.5 사양이 `...kA`) 이 있으면 그 정의 — `[,; ]이름=\{.{0,300}` 부터 이어 읽는다.
3. 목록 이름(예: `Rt`)으로 기본값 함수들 — `function \w+\(n\)\{.{0,80}Rt\.find.{0,200}`.
   특히 `res` 가 없는 모델의 해상도 기본값을 정하는 함수 (`includes("fast")` 가 들어 있는 것).
4. 비율 — `\["adaptive"[^\]]*\]` · 한 번에 만드는 개수 — `"Output Count".{0,300}max:"\d+"`

압축된 이름(`Rt`, `kA` 같은 것)은 앱이 새로 빌드될 때마다 바뀐다. 이름이 안 맞으면 1번의 `dreamina-seedance` 처럼
**내용**으로 다시 찾는다. 한글은 `\uXXXX` 꼴로 적혀 있으니 풀어서 이해한다.

못 찾으면 `references/app-rules.md` 스냅샷으로 넘어가고, "앱 구조가 바뀌어 직접 못 읽었다"고 사용자에게 말한다.

## Node 없이 보내기 — 나노바나나

`scripts/send-to-nanobanana.mjs` 와 같은 순서를 PowerShell 로 한다. **한글이 깨지지 않게 보낼 때도 읽을 때도 UTF-8 로 직접 다룬다** —
Windows PowerShell 5.1 의 `Invoke-RestMethod` 는 응답에 charset 이 없으면 한글을 잘못 읽어서, 그 값을 되돌려 넣으면 탭의 원래 프롬프트가
깨진 글자로 바뀐다 (가짜 앱으로 확인함). 그래서 읽기는 아래 `Get-NB` 만 쓴다.
PowerShell 에서 `$PID` 는 예약된 변수라 탭 ID 는 `$tabPid` 처럼 다른 이름을 쓴다.

```powershell
$nb = "http://127.0.0.1:5656"
$html = (Invoke-WebRequest "$nb/" -UseBasicParsing).Content
$h = @{ "X-NB-Token" = [regex]::Match($html, 'name="nb-csrf" content="([^"]+)"').Groups[1].Value }
function Send-NB($path, $obj) {
  $bytes = [Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Depth 6 -Compress))
  Invoke-RestMethod -Method Post -Uri "$nb$path" -Headers $h -ContentType "application/json; charset=utf-8" -Body $bytes
}
function Get-NB($path) {
  $r = Invoke-WebRequest "$nb$path" -UseBasicParsing
  [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json
}
$tabPid = (Get-NB "/api/projects").active
$before = Get-NB "/api/settings"
```

1. `Get-NB "/api/billing/state"` — `confirmed` 가 아니면 멈추고 앱에서 팀·프로젝트를 고르게 한다.
2. 작업마다 (같은 탭이 계속 떠 있는지 `/api/projects` 의 `active` 로 확인하면서). **사내 규칙 2 의 한도는 여기서도 지킨다** —
   넣기 전에 `(Get-NB "/api/projects").projects` 의 `outstanding` 을 모두 더해, 이번 작업 장수를 더한 값이 10 을 넘으면
   줄어들 때까지 기다린다(기다리는 동안은 3번처럼 탭 입력값을 되돌려 둔다). 하루 1,000장을 넘게 보내지 않는다.
   ```powershell
   Send-NB "/api/refs/clear" @{ preserve_pinned = $false }
   Send-NB "/api/refs/add-path" @{ filepath = "C:\경로\ref1.png" }     # 레퍼런스마다
   Send-NB "/api/settings" @{ pid = $tabPid; fixed_prompt = ""; prompt_sections = @("프롬프트")
                              model = "gpt-image-2.5-sunburst"; resolution = "4K"; aspect = "16:9"; quality = "max"; count = 1 }
   Send-NB "/api/generate" @{}       # ok 가 아니고 "Queue full" 이면 잠깐 기다렸다 다시
   ```
3. 다 넣은 뒤 원래 입력값으로 되돌린다: `Send-NB "/api/settings" @{ pid = $tabPid; fixed_prompt = $before.fixed_prompt;
   prompt_sections = @($before.prompt_sections); model = $before.model; resolution = $before.resolution; aspect = $before.aspect;
   quality = $before.quality; count = $before.count }` — 레퍼런스도 원래 경로로 다시 넣는다.
4. 진행은 `/api/projects` 의 그 탭 요약(`done`/`total`/`outstanding`)으로만 본다. `/api/status`·`/api/events` 는 부르지 않는다.

## Node 없이 시댄스로 보내기 (앱 26.10.304~)

`scripts/send-to-seedance.mjs` 와 같은 순서다. 시댄스 앱이 **켜져 있어야** 한다 — 앱 화면이 작업함에서 요청을 받아 작성 칸을
잠깐 빌려 보내고 원래대로 돌려놓는다. 한글 때문에 읽기·보내기 모두 UTF-8 로 직접 다룬다(위 나노바나나와 같은 이유).

```powershell
$sd = "http://127.0.0.1:3000"
function Get-SD($path) {
  $r = Invoke-WebRequest "$sd$path" -UseBasicParsing
  [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json
}
function Send-SD($path, $obj) {
  $bytes = [Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Depth 8 -Compress))
  try {
    $r = Invoke-WebRequest -Method Post -Uri "$sd$path" -ContentType "application/json; charset=utf-8" -Body $bytes -UseBasicParsing
    [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json
  } catch {
    # 400·409 같은 거절도 이유가 본문에 있다. Windows PowerShell 5.1 은 그 본문을 ErrorDetails 에 담아 둔다(한글 정상).
    if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message | ConvertFrom-Json } else { throw }
  }
}
$s = Get-SD "/api/agent/status"
$m = Get-SD "/api/agent/manual"      # 앱이 낸 사용 설명서 — $m.text 를 읽고, $m.version 을 기억한다
```

1. 상태 확인 — 연결이 안 되면 앱이 꺼진 것. 응답이 JSON 이 아니거나 `ok` 가 없으면 **에이전트 연결 전 버전**(앱을 껐다 켜서
   업데이트하게 한다). `screenAlive` 가 false 면 앱 창이 닫혔거나 멈춘 것, `project` 가 비었으면 프로젝트를 열게,
   `billing` 이 비었으면 설정 패널 맨 위에서 과금 프로젝트를 고르게 하고 멈춘다. `composer` 가 false 면 갤러리 화면이다.
   `allowedModels` 는 그 과금 프로젝트로 지금 쓸 수 있는 모델이다.
2. **`$m.text` 가 설정의 정답이다**(모델·모드·값 범위·레퍼런스 상한·사용법). 보내기 직전에는 기억한 버전이 그대로인지 본다:
   `(Get-SD "/api/agent/status?manual=$([uri]::EscapeDataString($m.version))").manualStale` 이 `True` 면 앱이 업데이트된 것 — `$m` 을 다시 읽고 설정과
   확인 카드를 다시 맞춘다.
3. 확인 카드에 `$s.project` · `$s.billing` 을 보여주고 답을 받은 뒤, 작업마다 넣고 앱이 받을 때까지 기다린다:
   ```powershell
   $job = Send-SD "/api/agent/jobs" @{ manual = $m.version; name = "cut_01"; prompt = "프롬프트 전문"; project = $s.project; billing = $s.billing
     settings = @{ model = "dreamina-seedance-2-5-260628"; mode = "multimodal_reference"; ratio = "16:9"; duration = 10
                   resolution = "720p"; draft = $true; output_count = 1; generate_audio = $true }
     refs = @("C:\경로\a.png", @{ path = "C:\경로\b.png"; role = "reference_image" }) }
   if (-not $job.id) { $job.error }   # stale 이면 "앱이 업데이트됐습니다" — 2번처럼 설명서부터 다시
   do { Start-Sleep -Seconds 2; $j = Get-SD "/api/agent/jobs/$($job.id)" } while ($j.status -in "pending", "taken")
   ```
   `failed` 면 `$j.error` 를 그대로 사용자에게 보여주고 나머지 작업은 보내지 않는다. `sent` 면 `$j.messages` 가 이번에 생긴 카드다.
   **사내 규칙 2 의 한도는 여기서도 지킨다** — 작업을 넣기 전에 열린 프로젝트의 카드 중 대기·생성 중(`queued`·`running`)인
   것과 이번 `output_count` 를 더해 3 을 넘으면 줄어들 때까지 기다린다(카드 목록은 26.10.305~ 의 `cards.list` 명령, 그 전
   버전이면 이번에 넣은 요청의 `$j.messages` 로 센다). 하루 200개를 넘게 보내지 않는다.
4. 지켜보기는 같은 주소를 5초쯤 간격으로 다시 읽어 `status` 가 `done` 이 될 때까지. 카드마다 `status`·`videoUrl`·`error` 가 있다.
5. 진행 확인에 `/api/byteplus/tasks/<id>` 는 부르지 않는다 — 그 조회는 크레딧 보고·영상 보관을 하는 앱 화면 몫이다.

### 앱 기능 명령 (앱 26.10.305~)

명령 목록과 인자는 `$m.text` 의 "명령" 절. 한 번 보내면 결과가 올 때까지(최대 60초) 기다렸다가 답한다:

```powershell
$r = Send-SD "/api/agent/commands" @{ manual = $m.version; command = "elements.add"; wait = 60
  args = @{ collection = "K"; items = @(@{ name = "박사"; category = "character"; description = "주인공"
                                          images = @("C:\경로\박사_정면.png", "C:\경로\박사_측면.png") }) } }
while ($r.status -in "pending", "taken") { Start-Sleep -Seconds 2; $r = Get-SD "/api/agent/commands/$($r.id)" }
if ($r.status -eq "failed") { $r.error } else { $r.result | ConvertTo-Json -Depth 8 }
```

`stale` 이면 앱이 업데이트된 것 — `$m` 을 다시 읽는다. 과금되는 명령(`card.final` · `card.regenerate`)은 확인 카드를 받은 뒤에만.
