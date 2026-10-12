# 앱 모델 → 공식 프롬프트 가이드

자동 생성 — 저장소의 `sync/sync.mjs` 가 매일 공식 원본(BytePlus·Google·OpenAI 스킬 목록과 문서)과 비교해 새로 쓴다.
손으로 고치지 말 것(바꿀 것은 `sync/sources.json`). 공식 원본에 새 가이드가 올라오면 다음 동기화 때 이 표에 저절로 붙는다.

앱 모델 ID 에 왼쪽 글자(정규식)가 들어가면 그 줄의 가이드를 `freewill_guide("<topic>")` 로 받아 **끝까지(part 이어서)** 읽고
그 방식대로 쓴다. 지침 4단계 "앱에 맞춘 규칙"(영어 본문·앱 표기·모드별 바인딩)이 가이드보다 먼저다.

| 앱 모델 ID 에 이게 들어가면 | 가이드 (topic) | 만든 곳 | 쓰는 부분 | 건너뛰는 부분 | 버전 · 반영일 |
|---|---|---|---|---|---|
| `seedance-2-5` | `official:sd25-pe` | BytePlus 공식 스킬 | 전체 — 입력 상태, 핵심 워크플로 1~8, 템플릿, 원칙 | "Self-update before triggering" | 0.1.1 · 2026-10-02 |
| `seedance-2-0` | `official:sd2-pe` | BytePlus 공식 스킬 | 전체 | — | #301a03be · 2026-10-02 |
| `gemini-omni` | `official:gemini-omni-flash-api` | Google 공식 스킬 | "Prompting Gemini Omni Flash" 이하 | SDK·스크립트·업로드·의존성 | #96bcfe08 · 2026-10-02 |
| `gpt-image` | `official:imagegen` | OpenAI 공식 스킬 | SKILL.md 의 Prompt augmentation, Specificity policy, Use-case taxonomy, Shared prompt schema, Prompting best practices, Guidance by asset type + references/prompting.md, references/sample-prompts.md | image_gen 도구, CLI, OPENAI_API_KEY, 저장 경로 규칙. "Use case: / Asset type:" 같은 필드 양식은 GPT Image 에만 쓴다 | #0db6b41f · 2026-10-02 |
| `gemini-.*image` · `nano-banana` | `official:nano-banana` | Google 공식 문서 | 전체 — 만들기·편집 템플릿과 예시 프롬프트, Best practices, Limitations | — | #99b20e9a · 2026-10-12 |
| `veo` | `official:veo` | Google 공식 문서 | 전체 | — | #5c35e0fa · 2026-10-12 |
| `seedream` | `official:nano-banana` + `official:higgsfield-generate/model-catalog` + `official:higgsfield-generate/prompt-engineering` | 공식 가이드 없음 (BytePlus) | BytePlus 공식 시드림 프롬프트 가이드가 아직 없다 — 이미지 프롬프트 공식 원칙(구글 nano-banana) + 힉스필드 모델 성격. BytePlus 가 내면 감시에서 잡혀 자동으로 붙는다 | — | — |

**표에 없는 모델(새로 들어온 모델)** — ① 같은 회사·같은 계열의 가장 가까운 가이드(예: 새 시댄스 버전이면 가장 최근 시댄스 가이드)
② 힉스필드 `official:higgsfield-generate/prompt-engineering`(기본 원칙) · `official:higgsfield-generate/model-catalog`(모델별 성격) ③ 사용자에게 "이 모델 공식 가이드는 아직 연결 전" 이라고 한 줄 알린다.
