# 앱 모델 → 공식 프롬프트 가이드

자동 생성 — 저장소의 `sync/sync.mjs` 가 매일 공식 원본(BytePlus·Google·OpenAI 스킬 목록과 문서)과 비교해 새로 쓴다.
손으로 고치지 말 것(바꿀 것은 `sync/sources.json`). 공식 원본에 새 가이드가 올라오면 다음 동기화 때 이 표에 저절로 붙는다.

앱 모델 ID 에 왼쪽 글자(정규식)가 들어가면 그 줄의 가이드를 `freewill_guide("<topic>")` 로 받아 **끝까지(part 이어서)** 읽고
그 방식대로 쓴다. 지침 4단계 "앱에 맞춘 규칙"(영어 본문·앱 표기·모드별 바인딩)이 가이드보다 먼저다.

| 앱 모델 ID 에 이게 들어가면 | 가이드 (topic) | 만든 곳 | 쓰는 부분 | 건너뛰는 부분 | 버전 · 반영일 |
|---|---|---|---|---|---|
| `seedance-2-5` | `official:sd25-pe/<앱 mode>` — `text_to_video` · `image_to_video_first` · `image_to_video_first_last` · `multimodal_reference` · `edit_video` · `extend_video` (그 모드에 필요한 절만) · 전체 `official:sd25-pe` | BytePlus 공식 스킬 | 모드별 topic(공통 원칙 + 그 모드 템플릿만). 모드가 정해지지 않았으면 전체 | "Self-update before triggering" | 0.1.1 · 2026-10-02 |
| `seedance-2-0` | `official:sd2-pe` | BytePlus 공식 스킬 | 전체 | — | #301a03be · 2026-10-02 |
| `gemini-omni` | `official:gemini-omni-flash-api` | Google 공식 스킬 | "Prompting Gemini Omni Flash" 이하 | SDK·스크립트·업로드·의존성 | #96bcfe08 · 2026-10-02 |
| `gpt-image` | `official:gpt-image` | OpenAI 공식 문서(원문에서 바로) | 전체 — 모델 고르기(2.5 Flare·Sunburst), 프롬프트 기본, 만들기·편집·여러 턴 예시 프롬프트 | 코드 예시(SDK) | #ff47a722 · 2026-10-12 |
| `seedream` | `official:seedream` | BytePlus 공식 문서(원문에서 바로) | 전체 — 일반 원칙, 텍스트→이미지, 편집, 레퍼런스 생성, 여러 장 입력·출력 (4.0~4.5 기준 문서 — 5.0 전용이 나오면 바꾼다) | — | #62bb2d0c · 2026-10-12 |
| `gemini-.*image` · `nano-banana` | `official:nano-banana` | Google 공식 문서 | 전체 — 만들기·편집 템플릿과 예시 프롬프트, Best practices, Limitations | — | #99b20e9a · 2026-10-12 |
| `veo` | `official:veo` | Google 공식 문서 | 전체 | — | #5c35e0fa · 2026-10-12 |

**커뮤니티 참고 가이드(MIT)** — 모델 회사 공식이 아니다. 사내 쓰는 법(`seedance-prompting`)·공식 가이드를 보충하는 작성법·어휘로 쓰고,
그 안의 형식·길이 규칙, 다른 플랫폼 파라미터, `@Image 1` 표기는 따르지 않는다(사용자 지시 > 앱 규칙 > 사내 쓰는 법이 먼저).

| 가이드 (topic) | 만든 곳 | 쓰는 부분 | 건너뛰는 부분 | 버전 · 반영일 |
|---|---|---|---|---|
| `official:higgsfield-seedance-2-5` · `official:higgsfield-seedance-2-5/MODE-PLAYBOOKS` · `official:higgsfield-seedance-2-5/VFX-PIPELINE` | O-Side Media (커뮤니티 · MIT) | 시댄스 2.5 — 레퍼런스마다 쓸 것·쓰지 않을 것·충실도, 여러 레퍼런스 5단계(대상마다 한 줄→묶기→프로필→장면별로 고르기→소유), 긴 영상의 단계·끝 상태, 오디오·글자 표기, 첫·끝 프레임, 감정·카메라 용어 (MODE-PLAYBOOKS: 모드별) | Higgsfield 파라미터·CLI·genre 힌트, 핸들 표기 @Image 1(앱은 [Image 1]), 사내 형식과 겹치는 짧은 공식(Core Prompt Formula) | 1.6.0 · 2026-10-14 |
| `official:higgsfield-seedance` · `official:higgsfield-seedance/ENGINE-RULES` · `official:higgsfield-seedance/FAILURE-MODES` · `official:higgsfield-seedance/HELL-GRIND` · `official:higgsfield-seedance/PRODUCTION-PATTERNS` | O-Side Media (커뮤니티 · MIT) | 시댄스 2.0 — 프롬프트 작성 법칙, 실패 유형(FAILURE-MODES)·엔진 규칙(ENGINE-RULES)·제작 패턴(PRODUCTION-PATTERNS), 콘텐츠 필터 거절 진단 | Higgsfield 파라미터·preflight 스크립트 실행, 여섯 칸 공식(사내 형식이 먼저) | 1.16.0 · 2026-10-14 |
| `official:higgsfield-camera` | O-Side Media (커뮤니티 · MIT) | 카메라 무빙·앵글·샷 크기 어휘와 언제 쓰는지·예문, 감정에 맞춘 카메라(Camera-Emotion Sync) | Higgsfield 화면의 프리셋 이름 자체(움직임을 말로 풀어 쓴다) | 3.5.1 · 2026-10-14 |
| `official:higgsfield-acting` | O-Side Media (커뮤니티 · MIT) | 연기 층 — 원하는 것·장애물·전술·비트·서브텍스트·듣기·시선, 인물별 연기 프로필과 장면별 고쳐 쓰기 | — | 1.3.0 · 2026-10-14 |
| `official:higgsfield-facs` | O-Side Media (커뮤니티 · MIT) | 얼굴 근육(FACS Action Unit) 단위 표정 지시 — 클로즈업 미세 연기, 섞인·억지 표정 | — | 1.1.2 · 2026-10-14 |
| `official:higgsfield-style` | O-Side Media (커뮤니티 · MIT) | 룩·무드 어휘 — 색 보정(Color Grade)·조명(Lighting) 어휘, 시네마틱 조명 기법, 스타일 레시피 | Higgsfield 플랫폼 스타일 프리셋 이름, 비율 안내(앱 설정으로) | 3.1.3 · 2026-10-14 |
| `official:cinematic-video-prompt` · `official:cinematic-video-prompt/examples/example-prompts` · `official:cinematic-video-prompt/01-camera-angles-and-movement` · `official:cinematic-video-prompt/02-lighting` · `official:cinematic-video-prompt/03-composition` · `official:cinematic-video-prompt/04-lens-technical-film` · `official:cinematic-video-prompt/05-style-color-mood` · `official:cinematic-video-prompt/06-materials-weather-pose` | Quốc Nghi Huỳnh (커뮤니티 · MIT) | 어휘 사전(설명은 베트남어, 용어는 영어) — references/01 카메라 앵글·무빙(언제 쓰는지), 02 조명, 03 구도, 04 렌즈·필름, 05 스타일·색·무드, 06 재질·날씨·포즈. SKILL.md 8절 실전 교훈 | 2절 공식(칸마다 키워드 1~2개)·6절 '기술 키워드 8개까지' — 사내 형식(자세하게)이 먼저 | #09b03f78 · 2026-10-14 |

**표에 없는 모델(새로 들어온 모델)** — ① 같은 회사·같은 계열의 가장 가까운 가이드(예: 새 시댄스 버전이면 가장 최근 시댄스 가이드)
② 힉스필드 `official:higgsfield-generate/prompt-engineering`(기본 원칙) · `official:higgsfield-generate/model-catalog`(모델별 성격) ③ 사용자에게 "이 모델 공식 가이드는 아직 연결 전" 이라고 한 줄 알린다.
