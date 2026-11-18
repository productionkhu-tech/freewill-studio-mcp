# 앱 규칙 스냅샷

> **마지막 수단.** 규칙은 이 PC 의 앱에서 읽는 게 원칙이다 — `scripts/read-local-apps.mjs` (또는 앱 MCP 도구).
> 그걸 못 돌리는 환경(Cowork·웹)에서만 이 표를 쓴다. 사용자가 말한 모델이나 값이 여기 없으면 지어내지 말고
> 앱 화면을 확인해 달라고 할 것.
>
> **모델 표 · 계열 SOTA 줄은 자동** — `sync/sync.mjs` 가 매일 두 앱의 GitHub 코드(나노바나나 `static/app.js` 의 `MODEL_SPECS` ·
> `SOTA_MODELS`, 시댄스 `src/store.ts` 의 `MODELS`)에서 다시 쓴다(사용자 11/17). 그 밖의 글(주의 · 키 · 모드별 규칙)은 사람이 쓴 것 —
> 나노바나나 `v2026-11-1702`, 시댄스 `26.11.601` 기준.

## 나노바나나 (이미지)

공통: 한 번에 **1~10장**. 비율에 `auto` 가 있다 (레퍼런스나 모델이 정함).

부르는 이름 (구글 이름 → 앱 모델 ID): Nano Banana Pro = `gemini-3-pro-image` · Nano Banana 2.1 = `gemini-nano-banana-2.1` ·
Nano Banana 2 = `gemini-3.1-flash-image` · Nano Banana 2 Lite = `gemini-3.1-flash-lite-image` · Nano Banana = `gemini-2.5-flash-image`.

Nano Banana 2.1 은 Nano Banana 2 의 후속 — 구글이 새 작업에 권장. Lite 는 테스트 · 룩 확인용.

**계열 SOTA(모델 추천은 이것부터 — 앱이 켜져 있으면 `read-local-apps` 표가 우선)**:
<!-- AUTO:sota — sync/sync.mjs 가 매일 앱 코드(SOTA_MODELS 별표 · 모델 이름)에서 다시 쓴다. 손으로 고치지 말 것 -->
Nano Banana `gemini-3-pro-image`(빠른 것 `gemini-3.1-flash-image` · 가장 가벼운 것 `gemini-3.1-flash-lite-image`) · Seedream `seedream-5-5-261028`(빠른 것 `seedream-5-0-flash-260915`) · GPT Image `gpt-image-2.6-sunburst`(빠른 것 `gpt-image-2.6-flare`) · Seedance `dreamina-seedance-2-5-260628`(빠른 것 `dreamina-seedance-2-5-flash-261115` · 가장 가벼운 것 `dreamina-seedance-2-0-mini-260615`) · Gemini Omni `gemini-omni-1.2-flash`
<!-- /AUTO:sota -->

<!-- AUTO:nanobanana-models — sync/sync.mjs 가 매일 나노바나나 앱 코드(static/app.js 의 MODEL_SPECS)에서 다시 쓴다. 손으로 고치지 말 것 -->
★ = 앱이 고른 계열 SOTA(모델 메뉴 별표). 괄호 = 앱 화면의 시작값. 앱 설명은 앱 코드의 글 그대로.

| 모델 ID | 해상도 (기본) | 품질 (기본) | 레퍼런스 | 그 밖 | 앱 설명 |
|---|---|---|---|---|---|
| `gemini-2.5-flash-image` | 1K (1K) | — | 최대 3장 | — | 10 RPM limit — auto-throttled to ~8 RPM |
| `gemini-3-pro-image` ★ | 1K / 2K / 4K (2K) | — | 최대 14장 | — | 10 RPM limit — auto-throttled to ~8 RPM |
| `gemini-3.1-flash-image` | 512px / 1K / 2K / 4K (2K) | — | 최대 14장 | — | 10 RPM limit — auto-throttled to ~8 RPM |
| `gemini-nano-banana-2.1` | 1K / 2K / 4K (2K) | — | 최대 14장 | — | Nano Banana 2.1 — thinking high. 10 RPM limit — auto-throttled to ~8 RPM |
| `gemini-3.1-flash-lite-image` | 1K (1K) | — | 최대 14장 | — | Lite: ultra-fast & low-cost. 1K only (2K/4K unsupported). |
| `seedream-5-5-261028` ★ | 1K / 1.5K / 2K (2K) | — | 최대 10장 | 배경(투명) | BytePlus Seedream 5.5 - more realistic, steadier edits. 1K/1.5K/2K, png. Can return a transparent background. |
| `seedream-5-0-pro-260628` | 1K / 1.5K / 2K (2K) | — | 최대 10장 | — | BytePlus Seedream 5.0 Pro - high precision. 1K/1.5K/2K, png. 1.5K costs the same as 1K. |
| `seedream-5-0-flash-260915` | 1K / 1.5K / 2K (2K) | — | 최대 10장 | — | BytePlus Seedream 5.0 Flash - faster and cheaper than Pro. 1K/1.5K/2K, png. |
| `seedream-4-5-251128` | 2K / 4K (2K) | — | 최대 14장 | — | BytePlus Seedream 4.5 - jpeg. 2K/4K. |
| `gpt-image-2` | 1K / 2K / 4K (1K) | low / medium / high / auto (high) | 최대 16장 | — | OpenAI Image API — generation may take up to ~2 min. |
| `gpt-image-2.5-flare` | 1K / 2K / 4K (1K) | low / medium / high / xhigh / max / auto (max) | 최대 16장 | 배경(투명) | GPT Image 2.5 Fast — quick everyday generation. Starts at max quality. |
| `gpt-image-2.5-sunburst` | 1K / 2K / 4K (1K) | low / medium / high / xhigh / max / auto (max) | 최대 16장 | 배경(투명) | GPT Image 2.5 Heavy — editing precision. Starts at max quality. |
| `gpt-image-2.6-flare` | 1K / 2K / 4K (1K) | low / medium / high / xhigh / max / auto (max) | 최대 16장 | 배경(투명), complexity low / medium / high, GIF · SVG | GPT Image 2.6 Fast — quick iteration. Starts at max quality. |
| `gpt-image-2.6-sunburst` ★ | 1K / 2K / 4K (1K) | low / medium / high / xhigh / max / auto (max) | 최대 16장 | 배경(투명), complexity low / medium / high, GIF · SVG | GPT Image 2.6 Heavy — detailed visual work. Starts at max quality. |

비율:

- `gemini-2.5-flash-image` · `gemini-3-pro-image`: auto, 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
- `gemini-3.1-flash-image` · `gemini-nano-banana-2.1` · `gemini-3.1-flash-lite-image`: auto, 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9, 1:4, 4:1, 1:8, 8:1
- `seedream-5-5-261028` · `seedream-5-0-pro-260628` · `seedream-5-0-flash-260915` · `seedream-4-5-251128`: auto, 1:1, 4:3, 3:4, 16:9, 9:16, 3:2, 2:3, 21:9, custom
- `gpt-image-2` · `gpt-image-2.5-flare` · `gpt-image-2.5-sunburst` · `gpt-image-2.6-flare` · `gpt-image-2.6-sunburst`: auto, 1:1, 3:2, 2:3, 4:3, 3:4, 4:5, 5:4, 16:9, 9:16, 21:9, 9:21, 3:1, 1:3, custom
<!-- /AUTO:nanobanana-models -->

모델별 주의:

- **비운 칸** — 위 표의 괄호는 앱 화면의 시작값이다. MCP 는 앱 탭 · 모델 설정을 안 따른다(사용자 11/5): 모델은 꼭 적고, 해상도 · 품질은 그 모델의 맨 위, 비율은 GPT 1:1 · 그 밖 auto(레퍼런스가 있으면 그 비율), 1장. `dry-run` 줄에 나온 값이 그대로 나가고, 앱이 거절할 값은 한 장도 나가기 전에 멈춘다.

- **GPT**: `[Image N]` 태그가 안 먹는다 — 레퍼런스는 프롬프트에서 말로 설명한다. `auto` 비율은 1번 레퍼런스 비율을 따르고, 레퍼런스가 없으면 크기를 OpenAI 가 정해 해상도가 무시된다(비율을 비우면 1:1).
  gpt-image-2 는 품질이 high 까지 (max 를 보내면 오류). 4K·max 는 장당 1~2분.
- **GPT Image 2.6** (앱 `v2026-11-0501`~): 크기 규칙 · 품질 사다리 · 투명 배경 · 레퍼런스 16장 · 단가는 2.5 와 같다.
  토큰은 high 이상이면 2.5 와 같고 low · medium 은 3~4배(1024² low 823 vs 196, medium 1,449 vs 439). 4K max 실측 Flare 약 40초 · Sunburst 약 100초.
  `complexity` low / medium / high(요금 같음)는 2.6 전용 — 2.5 · gpt-image-2 에 적으면 스크립트가 멈춘다. 안 적으면 high.
  한 곳만 고치는 편집은 low 부터(high 는 시키지 않은 곳까지 바꿀 수 있다), 글자 · 복잡한 구도는 high(`image-prompting.md` 1절).
  GIF · SVG(`output_format`, 앱 `v2026-11-0502`~)도 2.6 전용 — 시켰을 때만, `image-prompting.md` 9절. SVG 는 레퍼런스 불가.
- **Seedream**: 레퍼런스는 프롬프트에서 `image 1`, `image 2` 처럼 부른다.
- **Seedream 5.5** (앱 `v2026-11-1702`~, BytePlus 얼리 액세스): 크기 · 레퍼런스는 5.0 Pro 와 같다. 소개 글의 4K 는 API 가 거절한다(앱 주석) — 2K 까지.
  투명 배경은 GPT 2.5 · 2.6 과 같은 설정 `openai_bg_transparent`(앱 이름 그대로) — 시켰을 때만. 글로만도, 레퍼런스 10장에서 오려 내기도 된다(5.0 은 알파 있는 PNG 1장만).
  공식대로 프롬프트에도 떨어진 대상 + 투명 배경을 적는다. 여러 번 이어 고칠 때는 투명을 끄고 넣는 그림도 알파 없는 것으로(공식 권장). 쓰는 법은 `official:seedream-5-5`.
- **Gemini**: 분당 10회 제한 — 앱이 알아서 8회 정도로 늦춘다. 많이 뽑으면 오래 걸린다고 미리 말해 줄 것.
  레퍼런스 14장 안에서 2.1 · 3.1 Flash 는 인물 일관성 4명 · 물체 10개까지, 3 Pro 는 인물 5명 · 물체 6개 · 스타일 3장까지(구글 문서).
- **custom 픽셀**: GPT 는 16의 배수 · 긴 변 3840 이하 · 비율 3:1 이내 · 655,360~8,294,400 픽셀.
  Seedream 은 16의 배수 · 비율 16 이내 · 5.5 · 5.0 Pro · Flash 921,600~4,624,220 / 4.5 3,686,400~16,777,216 픽셀.
  벗어나면 앱이 말없이 크기를 고친다(GPT 640x480 → 816x816 처럼 모양까지 바뀐다). `"aspect": "custom"` 없이 적은 크기는 안 쓰이므로 스크립트가 멈춘다.

## 시댄스 (영상)

> **시댄스 26.10.304 이상이 켜져 있으면 이 절 대신 앱이 직접 낸 사용 설명서를 쓴다** (`send-to-seedance.mjs --manual`
> 또는 `read-local-apps.mjs`). 앱 코드에서 자동으로 만들어져 늘 그 PC 의 앱과 같고, 보낼 때 그 버전을 `manual` 에 적는다.
> 아래는 앱이 꺼져 있거나 옛 버전일 때, 또는 PC 밖(웹)에서 프롬프트만 정리할 때 쓰는 사본이다.

공통: 한 번에 **1~3개** (기본 1). 비율: adaptive, 21:9, 16:9, 4:3, 1:1, 3:4, 9:16.
**프로젝트마다 쓸 수 있는 모델이 다르다** (크레딧 시트 권한 — 권한 없는 모델은 앱이 막는다).

<!-- AUTO:seedance-models — sync/sync.mjs 가 매일 시댄스 앱 코드(src/store.ts 의 MODELS, 고를 수 있는 모델만)에서 다시 쓴다. 손으로 고치지 말 것 -->
| 모델 ID | 이름 | 길이 | 해상도 | 초안 | 레퍼런스 상한 (이미지/영상/오디오) | 공식 가이드 |
|---|---|---|---|---|---|---|
| `dreamina-seedance-2-5-260628` | Seedance 2.5 | 4~30초 | 480p / 720p / 1080p | 있음(480p → 본편) | 30 / 10 / 10 | `official:sd25-pe` |
| `dreamina-seedance-2-5-flash-261115` | Seedance 2.5 Flash | 4~30초 | 480p / 720p | — | 10 / 5 / 5 | `official:sd25-pe` |
| `dreamina-seedance-2-0-260128` | Seedance 2.0 | 4~15초 | 480p / 720p / 1080p / 4k | — | 9 / 3 / 3 | `official:sd2-pe` |
| `dreamina-seedance-2-0-fast-260128` | Seedance 2.0 Fast | 4~15초 | 480p / 720p | — | 9 / 3 / 3 | `official:sd2-pe` |
| `dreamina-seedance-2-0-mini-260615` | Seedance 2.0 Mini | 4~15초 | 480p / 720p | — | 9 / 3 / 3 | `official:sd2-pe` |
| `gemini-omni-1.2-flash` | Gemini Omni 1.2 Flash | 3~15초 | 360p / 720p / 1080p / 4k | — | 10 / 3 / 0 | `official:gemini-omni-flash-api` |

앱이 모델마다 적어 둔 사용법(앱 코드 `notes` 그대로):

- `dreamina-seedance-2-5-260628` — 초안(draft)이 기본 — 480p 로 먼저 보고, 고른 것만 앱 카드의 '본편' 으로 1080p 를 만든다(같은 시드·구도를 키운 것). 바로 최종이면 draft:false 와 해상도를 정한다. 1080p 는 HEVC 10-bit — mov(기본)는 4:4:4 라 일부 편집기·플레이어가 못 열고, mp4 는 4:2:0 이라 더 잘 열린다.
- `dreamina-seedance-2-5-flash-261115` — 2.5 와 같은 기능(30초 · 편집 · 연장 · 오디오만 레퍼런스)을 더 싸게 — 같은 해상도면 2.5 단가의 약 65%. 해상도는 480p · 720p 뿐(1080p 없음). 초안(draft)이 없다 — 바로 최종이다. 레퍼런스는 이미지 10 · 영상 5 · 오디오 5 까지(2.5 는 30 · 10 · 10). 2.5 보다 약 2배 빠르다(720p 5초 실측 68초 vs 142초). 카메라 연출 · 장면 짜임은 2.5 가 낫다 — 시안 · 많이 뽑기는 Flash, 1080p 최종은 2.5 초안 → 본편.
- `dreamina-seedance-2-0-260128` — 4K 는 과금 프로젝트에 4K 권한이 있을 때만 — 없으면 낮추지 않고 거절한다. 4K 는 HEVC 10-bit 라 코덱이 없는 PC 에서는 미리보기가 안 될 수 있다.
- `dreamina-seedance-2-0-fast-260128` — 빠른 시안용 — 1080p·4K 가 없다.
- `gemini-omni-1.2-flash` — 길이 3~15초. 첫·끝 프레임을 공식 지원한다(image_to_video 에 두 장) — 두 장이면 10초까지. 결과가 10초를 넘으면 참조 영상은 1개까지(10초 이하면 3개). 이미지는 10장까지. edit 원본은 15초까지. extend 는 한 번에 3~10초를 붙이고, 원본 + 붙일 길이가 30초까지. 360p 15초가 1분 안팎, 연장은 2분 안팎. 1080p · 4K 는 업스케일이라 더 걸린다.
<!-- /AUTO:seedance-models -->

모드: 텍스트→영상, 이미지→영상 (첫 프레임 / 첫·끝 프레임), 레퍼런스→영상, 영상 편집 · 연장. Omni 의 연장 · 첫·끝 프레임 길이는 위 모델 메모.

꼭 지킬 것:

- **오디오 생성과 마지막 프레임 받기는 같이 못 켠다.** 마지막 프레임을 켜면 오디오가 꺼진다.
- **Seedance 2.5 는 앱 기본이 초안(Draft) 모드**다 — 초안은 **480p** 로 나간다(저장된 해상도는 그대로 둔다).
  마음에 드는 초안은 앱 카드의 '본편' 으로 1080p 를 만든다(같은 시드·구도를 키운 것). 바로 최종본이면
  `draft:false` 와 해상도를 물어서 보낸다. 초안은 2.5 만 있다(2.5 Flash 는 없음 — 바로 최종).
- **4K** (시댄스 26.11.1801~): 2.0 · Omni 4K 는 누구나. **2.5 4K 는 과금 코드에 권한이 있을 때만** — 크레딧 시트 `Project_Status` F열 '2.5 4K 허용'
  (기본 꺼짐, 앱이 1분마다 읽음). 어느 모델이 권한을 묻는지는 설명서의 `fourKNeedsGrant`. 권한이 없으면 앱도 스크립트도 **낮추지 않고 거절**한다 —
  시트에서 껐다면 그 뒤로 보내는 4K(바로 4K · 4K 본편)는 다 막힌다. 초안 → 본편은 1080p(기본) 또는 4K, 한 초안에 해상도마다 하나씩(1080p 를 본 뒤 4K 도 된다,
  따로 과금). 4K 는 계정 전체 동시 1편(넘치면 BytePlus 대기열) · 같은 길이 1080p 의 약 1.6배 값 · HEVC 10-bit(2.5 mov 는 4:4:4).
  사용자가 4K 를 말했을 때만 쓴다 — 기본은 초안 480p → 1080p 본편.
- **Seedance 2.5 에서 입력이 값을 잠그는 작업**: 영상 편집 · 연장 · 첫 프레임 · 첫·끝 프레임은 비율이 입력 기준(adaptive)으로
  고정, 영상 편집은 길이도 입력 기준. 이 값들은 묻지 말고 자동이라고 알린다. 2.5 출력 형식은 mov(기본) / mp4.
- 레퍼런스 영상·오디오는 공개 주소로 올라간다 — 앱이 처리한다. 사용자는 파일만 주면 된다.

### 에이전트로 보낼 때 (`send-to-seedance.mjs`, 앱 26.10.304~)

보낼 때는 앱의 설명서가 기준이고(위 안내), jobs.json 에 그 설명서 버전(`manual`)을 적는다. 앱이 업데이트돼 버전이 다르면
앱이 "업데이트됐습니다" 로 돌려보내고 스크립트가 새 설명서를 보여 준다 — 그걸로 확인 카드를 다시 보여 준 뒤 보낸다.
아래 표는 설명서와 같은 내용의 사본이다.

설정 키 — 앱에서 가져오는 건 과금뿐이다. 스크립트는 비어 있으면 보내지 않는다(모드가 고정하는 비율 · 길이, 초안의 해상도는 빼도 된다). 앱은 안 준 값을 모델 기본값으로 채운다(26.11.601~, 그 전 앱은 프로젝트 설정).

| 키 | 값 |
|---|---|
| `model` | 위 표의 모델 ID |
| `mode` | `text_to_video` · `image_to_video_first` · `image_to_video_first_last` · `multimodal_reference` · `edit_video` · `extend_video` (시댄스) |
| `omniTask` | Gemini Omni 는 `mode` 대신 이것: `text_to_video` · `image_to_video` · `reference_to_video` · `edit` · `extend` |
| `ratio` | 시댄스 `adaptive` `21:9` `16:9` `4:3` `1:1` `3:4` `9:16` · Omni `16:9` `9:16` |
| `duration` | 모델 범위 안의 정수 초, 시댄스는 `-1`(자동)도 |
| `resolution` | 모델 표의 값(2.5 4K 는 과금 코드에 권한이 없으면 앱도 스크립트도 낮추지 않고 거절 — 사람이 앱에서 보낼 때만 1080p 로 낮춰 보낸다) |
| `output_count` | 1~3 |
| `generate_audio` · `return_last_frame` | true / false (Omni 는 오디오 없음, 첫·끝 프레임 모드는 마지막 프레임 없음) |
| `draft` | true / false — 2.5 만 |
| `final` | (스크립트 전용 — 앱엔 안 보냄) 초안을 4K 본편으로 올릴 계획이면 `"4k"`. 보내기 전에 4K 권한을 보고, 확인 카드에 "초안 480p → 4K 본편" 으로. 본편은 `card.final` 에 `"resolution": "4k"` |
| `output_format` | `mov` / `mp4` — 2.5 · 2.5 Flash 만 |

모드별 레퍼런스 (드래그와 같은 규칙으로 앱이 검사한다 — 어긋나면 이유와 함께 실패):

- 텍스트→영상: 없음
- 첫 프레임: 이미지 1장 · 첫·끝 프레임: 이미지 2장 — `role` 을 `first_frame` / `last_frame` 으로
- 레퍼런스→영상: 이미지·영상·오디오를 모델 상한까지. 프롬프트에서 `[Image 1]` `[Video 1]` `[Audio 1]` 처럼 부르고,
  번호는 넘긴 순서대로 종류별로 센다. 2.0 은 오디오만으로는 안 된다(2.5 는 된다)
- 영상 편집 · 연장: 개수는 모델마다 다르다 — 설명서의 모드 표가 정답이다.
  - 2.0 계열: 편집 영상 1개(+ 이미지 9 · 오디오 3) · 연장 영상 1~3개(이미지 · 오디오 안 됨)
  - 2.5(앱 26.10.2801~): 편집 이미지 30 · 영상 10 · 오디오 10 · 연장 이미지 30 · 영상 10(오디오 10 은 앱 26.10.2802~),
    영상 합계 30.2초
  - 2.5 편집에 영상이 여럿이면 첫 문장에서 고칠 원본 하나를 `[Video N]` 으로 지목한다 — 결과 비율 · 길이는 그 영상을 따른다.
    나머지 영상 · 그림은 대상마다 무엇을 가져오는지 한 줄씩(공식 sd25-pe 편집 템플릿 — 원본은 하나)
  - 2.5 연장도 이을 원본 하나를 `[Video N]` 으로 정하고 방향(앞 · 뒤)과 이어질 내용을 쓴다. 다른 영상 · 그림은 새 구간에
    가져올 것만 — 경계 프레임은 원본이 정한다
  - 설명서의 "@Video 로 지목" 은 앱 화면의 멘션을 말한다. 프롬프트에는 `[Video N]` 으로 쓴다(앱이 그대로 보낸다)
- Omni: 첫(·끝) 프레임은 image_to_video, 이미지·영상 레퍼런스는 reference_to_video, edit·extend 는 영상 1개(50MB 이하)

파일 한도 — 이미지 30MB · 한 변 300~6000px / 영상 200MB · 2~15.2초(2.5 는 30.2초, 2.5 편집 원본은 4초 이상) ·
한 변 300~6000px · 가로÷세로 0.4~2.5, 합계 길이도 같은 상한 / 오디오 15MB · 2~15.2초(2.5 는 30.2초) · wav·mp3.

앱이 보내지 않는 때: 열린 프로젝트·과금 프로젝트가 jobs.json 의 `project`·`billing` 과 다름 · 앱에 없는 값 · 레퍼런스를
하나라도 못 붙임 · 앱이 경고로 멈춤(권한 없음 등 — 그 문구가 그대로 실패 이유). 비율은 앱이 따로 안 보고 BytePlus 가
과금 전에 거절한다. 26.10.2002~ 는 입력 중 · 생성 중 · 갤러리 화면에서도 받고, 프로젝트 코드가 없으면 기다리다 10분이 지나면 취소된다.

### 앱 기능 명령과 엘리먼트 멘션 (앱 26.10.305~)

- 프롬프트의 `@{이름}` = 프로젝트에 연결된 컬렉션의 엘리먼트(어셋 라이브러리). 앱이 그 이미지를 레퍼런스로 붙인다.
  레퍼런스→영상 · 영상 편집 모드(2.5 는 연장도)에서만. 엘리먼트 이미지도 모델의 이미지 상한에 같이 센다.
- 명령(`send-to-seedance.mjs --do <명령>`): 프로젝트 목록·열기·만들기, 과금 프로젝트 목록(영상 수·토큰·권한),
  컬렉션·엘리먼트 보기·만들기·등록·고치기·프로젝트에 연결, 카드 목록·조회·채택·다운로드·본편(💰)·재생성(💰)·취소.
  인자는 설명서의 "명령" 절이 정답이다.
- 지우기와 과금 프로젝트 고르기는 명령이 없다 — 사람이 앱에서. 앱 창이 최소화돼 있어도 동작한다.
