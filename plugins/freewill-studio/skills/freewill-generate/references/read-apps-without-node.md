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
