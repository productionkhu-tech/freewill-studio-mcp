# 이미지 프롬프트 쓰는 법 — 나노바나나 (스틸 · 플레이트 · 시트 · 편집)

나노바나나로 만드는 그림의 **사내 기본값**이다 — 사용자가 다른 형식·개인 스킬을 말하면 그쪽이 먼저(지침 0절).
에셋(인물 · 소품 · 탈것 · 배경 시트)의 틀은 `assets.md`, 모순 점검은 `prompt-logic.md`, 모델 말투는 그 모델의 공식 가이드(지침 4단계 표).
이 문서는 그 사이 — 모델 고르기, 레퍼런스 부르기, 스틸 구도, 빛 · 색 · 사실감, 고치는 법 — 를 O-Side Media 의 이미지 실전 기록에서 골라
우리 앱에 맞게 옮긴 것이다(사용자 10/14 "이미지/비디오 퀄리티 올려 주는 규칙은 꼼꼼히 보고 잘 따와라").
근거는 대부분 다른 플랫폼(힉스필드)의 관찰이고 GPT 쪽은 2.0 세대 기록이다 — 2.5 에서는 같은 프롬프트로 A/B 해 보고 고른다(기본 2장).

## 1. 모델 고르기 — 이 PC 앱에 있는 것

| 할 일 | 먼저 | 이유 · 주의 |
|---|---|---|
| 실사 인물 시트 | Seedream 5.0 Pro | 피부 · 머리카락이 살아 있다(우리 결과). 시댄스 인물 레퍼런스는 시드림 원본 시트 그대로 |
| 얼굴 맞추기 · 작은 수정 | Nano Banana 2.1 · Pro | 넣은 그림을 가장 잘 붙들고 얼굴 일치가 가장 좋다는 보고(Nano Banana 2 기준) |
| 글자 · 라벨 · 버튼 · 화면 UI · 브랜드 옷 | GPT Image 2.5 (편집이면 Sunburst) | 따옴표 안 글자를 정확히. 4K · max 는 장당 1–2분 |
| 공간 플레이트 | Nano Banana Pro | 2장 뽑아 빛으로 고른다 — GPT 는 노랗게, 나노바나나는 너무 깨끗하고 대칭으로 기운다 |
| 상상 속 생물 | Seedream | 생물에 가장 강하다는 보고 |
| 빠른 룩 확인 | Nano Banana 2 Lite (1K) | 초고속 · 저가 |

- **다시 쓰기 전에 모델부터 바꿔 본다.** GPT 시트가 납작하게(2D 처럼) 나오면 같은 프롬프트를 Nano Banana Pro 로 먼저 돌린다. 옷 질감은 모델 2–3개를 같이 비교한다.
- **GPT Image 2.5** — 품질은 일에 맞게: `low` 는 초안, 최종은 high · xhigh · max 를 비교한다(앱 기본 auto = max). Flare 는 빠른 일상 생성,
  Sunburst 는 정밀 편집. 투명 배경을 고르면 받은 파일에 알파가 실제로 있는지 본다. 품질 · 해상도 · 배경 · 비율은 설정으로 — 본문에 쓰지 않는다.
- **Nano Banana Pro** — 생각 단계가 늘 켜져 있다. 여러 요소가 얽힌 장면 · 글자 · 목업 · 일관된 인물 5명까지 강하다. 작은 글자와 잔 세부,
  도표 속 숫자, 복잡한 합성 편집의 흠, 긴 대화로 이어 고칠 때 인물이 흘러가는 것은 약하다(구글 문서).

## 2. 레퍼런스 부르는 법 — 모델마다 다르다

| 모델 | 부르는 법 |
|---|---|
| Nano Banana (Gemini) | 순서와 내용으로 — `the first image (her portrait)`, `image 2` (구글 공식 가이드의 말투) |
| Seedream | `image 1`, `image 2` |
| GPT Image | 말로만 — `the first reference image, the woman's portrait` (`[Image N]` 태그가 안 먹는다) |

- **넣을 때마다 따져 본다 — 생각 없이 넣지 않는다**(사용자 10/20 "레퍼런스 넣을 때 고민하라는 것 — 생각 없이 넣지 말고", "방해되는 건 넣으면 안 됨").
  개수를 줄이라는 게 아니라 한 장마다 ① 가져올 것(얼굴 · 옷 · 공간 · 소품 · 구도) ② 같이 끌려올 것(다른 인물 · 글자 · 구도 · 그림체 · 조명 · 생성물의 뭉개짐)과
  막는 법 ③ 글로 되는지를 따진다. 필요한데 빠진 것은 넣는다. 첫 생성은 깨끗한 원본 한 장에서(생성물을 되먹이면 쌓일수록 더러워진다), 재질 · 빛 · 배경은 글로.
  시드림은 그림체 참고 그림도 얼굴 검열에 걸린다.
  jobs.json refs 는 `{"path", "why"}` — why 에 가져올 것과 끌려올 것의 대처를 한 줄로(없으면 보내기 스크립트가 멈춤). 보내기 전에 작업 페이지
  '보낼 것'에 그림과 why 가 같이 뜬다(`work-folder.md` 4절).
- **그림마다 역할 하나, 범위까지** — `Use the first image for her face and hair only, the second for the jacket only, the third for the room's layout and light.`
  로고는 따로 한 장(`the third image is the strict logo identity and placement reference`).
- **고정된 대상은 장면 프롬프트에서 다시 묘사하지 않는다** — 다시 쓰면 매번 새로 해석한다("모든 컷이 제품을 다시 그리는" 가장 흔한 원인). 이름과 역할만.
- **제품 · 소품을 사진에서 옮길 때** — `the EXACT SAME [object] shown in the first image — a studio photograph of that real object, not a redesign or a reinterpretation`.
  상표는 사진 속 실제 부품 그대로, 사진에 안 보이는 면은 `plain and simple, nothing added`, 실제 비대칭과 마모를 남긴다.
  사진이 여러 장이면 먼저 그 제품에 맞게 틀을 고쳐 쓴 뒤(무엇이 어느 사진에 보이는지) 보낸다.
- **도시 · 거리 그림을 레퍼런스로 넣으면 실내 인물이 밖으로 나간다**(Nano Banana Pro) — 장소는 글로 쓴다. 한 프롬프트에 그림을 아주 많이 넣으면
  (폴라로이드 12장 벽) 흔들린다 — 요소를 따로 만들어 합친다.

## 3. 스틸 구도 — 크기 · 앵글 · 자리

- **꼴**: `[샷 크기] + [앵글] + 대상과 자세 + 공간 + 빛(시간 · 광원 · 성질) + 질감(필름 · 그레이드)` —
  `An overhead extreme wide photograph looking straight down: Mina is a tiny figure crossing an empty concrete car park …`
- **크기**: EWS(풍경 속 작은 대상) · WS(공간 속 전신) · FS(머리~신발이 화면을 채움) · MLS(무릎 위) · 카우보이(허벅지 중간 위) · MS(허리 위) ·
  MCU(가슴 위) · CU(얼굴) · ECU(세부 하나) · 매크로(질감). 들어오는 것과 모순은 `prompt-logic.md` 1절.
- **앵글이 읽히는 것**: 낮게 = 힘 · 높게 = 약함 · 기울임 = 불안 · 어깨 너머 = 대화 · 시점 = 몰입.
- **화각 · 거리 · 높이를 시댄스와 같은 말로** — `29° field of view from 2.5 m at eye level`(값은 `seedance-prompting.md` 4절 표).
  첫 프레임으로 쓸 그림이면 영상 OPTICS 와 같은 값이어야 이어진다. 스틸은 한 순간이다 — 크래시 줌 · 휩 팬 · 돌리 같은 카메라 무빙 말은 그림이 되지 않는다.
  움직임 흐림은 빠른 대상에 일부러 줄 때만, 어디에 얼마나(`the gull big and soft with motion blur, the car sharp`).
- **화면을 구역으로** — 삼분할 · 앞중뒤 층마다 무엇이 있는지, 자리는 x/y % 와 화면을 차지하는 %
  (`right third, x 70%, y 50%, filling about 25% of the frame`). 빈 구역도 긍정형으로(`the left third is plain dark wall`).
- 장면 한 장을 원하는데 인물 요청이 여러 방향 시트로 나오면(Nano Banana Pro 의 버릇) 첫 문장을 `One single photograph, a single composition:` 으로.

## 4. 빛 · 색 · 사실감

- **빛을 박는다** — 방향 · 높이 · 성질 · 색온도. 바깥은 해의 자리(`low sun from camera-right, about 15° above the horizon, long shadows toward camera-left`).
  **플레이트는 빛으로 고른다** — 스틸의 나쁜 빛이 나쁜 영상의 가장 흔한 원인이다.
- **프로젝트 룩(Visual DNA)** — 룩이 정해진 작업이면 헥스 5–7개(색은 말 대신 헥스로), 빛의 원칙, 재질, 익숙한 것과 새것의 짝 하나,
  피할 것을 긍정형으로(`shadows stay deep indigo #1B1F3B, never pure black`) 한 덩어리로 정해 그 작업의 모든 프롬프트에 같은 글로 붙인다.
- **강조색 하나를 아끼고 60 · 30 · 10.** 색은 재질 + 빛 + 역할로(`the crimson scarf catching the cold corridor spill`).
- **사실감은 질감과 결함으로** — 실제 재질 이름, 실제 비대칭과 마모, 접사면 렌즈 성격(`a 100 mm macro look at f/8, every fibre resolving`).
  얼굴에 `photorealistic` 을 쓰면 GPT 에서 플라스틱처럼 나온다는 보고와 그 반대 보고가 같이 있다 — 필름 말(`a 35 mm photograph, natural grain`)과 A/B.
  나노바나나 피부가 플라스틱처럼 나오면 끝에 `fine film grain, deep shadow detail, real skin texture` (공간 플레이트에는 천장 연무를 넣지 않는다 — 사내 취향).
  아나모픽 · 필름 룩은 8절 — 렌즈 이름 대신 초점 · 흐림 · 타원 보케 · 가로 줄 플레어 · 필름을 증거로 쓴다.
- **크기는 기준으로** — `tiny compared to the creature` 는 매번 다르게 나온다. 몸의 기준(`its eye is level with her knee`)이나 사람 키 비교,
  확실하지 않으면 작은 쪽을 더 작게.
- **옷은 실루엣 + 알아볼 것 하나** — 단추 · 끈 · 장신구 · 무늬마다 그리는 힘을 쓴다.
- `masterpiece` · `best quality` · `award-winning` · `stunning` 같은 빈 수식어는 효과가 없다 — 지운다. 디테일을 말하려면 그 디테일이 어디서 보이는지를
  바로 붙인다(`8K capture detail — pores, wool weave, crisp paint reflections`).

## 5. 시트 · 플레이트 — assets.md 틀에 더하는 것

- **작업마다 회색 하나를 정해 모든 시트에 같은 값으로** — 헥스로(`one flat solid neutral grey background (#8A8A8A), seamless, no gradient`).
  따뜻한 회색 · 흰색 · 검정은 피한다(가장자리 오류가 커진다). 제품은 `shadowless, no gradient, no reflections` 까지.
- **보는 면은 샷 리스트에서** — 카메라가 돌아가는 소품은 앞 · 옆 · 뒤, 뒤집히거나 구르면 **바닥면**(본 적 없는 밑면은 지어낸다),
  정밀해야 하면 접사(로고 · 재질 · 이음새) 칸을 더한다.
- **생물** — 전신 + 입 다문 머리 + 입 벌린 머리(같은 각도). 입을 벌리면 머리 모양이 바뀐다.
- **상태는 따로 만든다** — 젖은 · 다친 · 땀 흘리는 · 다른 옷은 영상 프롬프트의 글로 시키지 말고 그 상태의 시트를 따로(엘리먼트도 따로).
  글로 시키면 얼굴이 흘러내린다.
- **가족 · 닮은 사람은 한 얼굴에서** —
  `take the exact face from the man in the first image and translate it onto her: the same eyes, brows, nose and lips, the same moles and freckles in matching positions`.
- **군중은 다양성 시트** — 서로 다른 4–5명이 선 한 장을 `a variety reference` 로. 한 사람 그림 + '모두 다르게' 글은 복제 인간이 된다.
- **공간 플레이트** — 3/4, 사람 없음, 해 자리 박기, 블로킹이 지나갈 **빈 통로**(어수선한 건 양옆으로 — 가운데 깊이의 잡동사니는 영상에서 뭉개진다),
  모든 장면으로 번질 색조는 피한다, 기준물 하나. 공간은 메인 플레이트 한 장이 기본이고, 역방향 컷(숏 / 리버스)이 실제로 있을 때만
  그 방향 플레이트를 더 만든다(엘리먼트는 따로 — 180° 축, `seedance-quality.md` 5절). 그때는 메인과 노출을 맞춘다:
  `Match the exposure of this plate to the master plate (the second image, the same room), keeping everything else identical. CHANGE: exposure and light level only.`
- 소품은 움직임 시험이 필요 없다. 연기할 인물은 굳히기 전에 짧은 시댄스 초안(480p)으로 움직여 본다 — 그림이 좋을수록 영상이 선명하다.
- (시험할 것) 출처는 "한 시트에 읽히는 얼굴은 하나 — 전신 칸의 머리는 지운다"고 한다(전신 칸의 작은 얼굴로 생김새가 평균으로 흐려진다는 이유).
  우리는 시드림 원본 3칸 그대로가 기본이다(손댄 시트가 BytePlus 실사 인물 필터에 걸렸다) — 영상에서 얼굴이 흐려지는 게 보일 때만 따로 시험한다.

## 6. 고칠 때

- **다시 만들지 말고 고친다** — 로고 하나 · 색 하나는 한 줄 편집. 다시 뽑으면 맞았던 것까지 다시 굴린다. 편집 구조는 `assets.md` "고칠 때"
  (CHANGE / PRESERVE EXACTLY).
- 편집은 `Keep everything else exactly the same.` 로 끝낸다 — 없으면 GPT 가 주변까지 다시 그린다.
- **GPT 편집은 할 때마다 피부가 뭉개진다** — 인물 원본을 여러 번 고칠 거면 Nano Banana 로 고치거나, 바뀐 부분만 원본 위에 합성한다.
- **옷은 돌려 가며 고른다** — `Take the shirt from the second image, make it pink, keep the jeans from the first. Keep the face, skin and background unchanged.`
- 버튼처럼 정확한 자리가 필요하면 그림 사본에 빨간 화살표를 그려 넣고 프롬프트가 그 화살표를 읽게 한다
  (`the red arrow points to the channel-up key directly above the "CH" label`). 화살표 없는 원본은 따로 둔다.
- 결과 하나가 이상하면 — 같은 결함이 두 장 다면 프롬프트를, 한 장만이면 다시 뽑기를.

## 7. 출처와 다르게 쓰는 곳

- 본문에 `[ASPECT RATIO]`, `high-resolution`, `4K` → 설정으로.
- 금지 목록(`no redesign, no stylization …`, `NO neon`) → 원하는 상태를 긍정으로. GPT 가 실제로 붙이는 것(광고 그림의 별점 · 버튼)을 봤을 때만 짧은 제외 한 줄.
- 회색: 출처는 사람 밝은 회색 · 제품 `#DCDCDC` · 사람 시트 `#8A8A8A` 등 제각각 — 우리는 작업마다 하나.
- 연무: 출처는 사람 그림 끝에 `light atmospheric haze` — 공간 플레이트에는 넣지 않는다.
- 나이 단어: 출처는 피한다(힉스필드 필터) — 우리 인물 틀은 나이를 쓴다.
- 카메라 · 렌즈 제품명(`Canon EOS R5 …`) → 렌즈 성격을 말로.

출처: O-Side Media [higgsfield-ai-prompt-skill](https://github.com/OSideMedia/higgsfield-ai-prompt-skill)(MIT, © 2026 O-Side Media) —
`official:higgsfield-gpt-image-2`(+ `/reference-sheet-workflow`) · `official:higgsfield-image-shots` · `official:higgsfield-character-design` ·
`official:higgsfield-cinema/reference-sheet-types` · `official:higgsfield/image-models` · `official:higgsfield/templates/ad-asset-prep` 를 우리 말로 옮겼다(원문은 매일 동기화).

## 8. 아나모픽 룩 — 렌즈 이름이 아니라 증거를 쓴다

모델은 `anamorphic` 이라는 이름을 따르지 않고 그 렌즈의 **보이는 증거** — 초점 하나와 녹는 앞뒤, 세로 타원 보케, 가로 줄 플레어, 필름 — 를 따른다.
증거를 다 적는다. 렌즈 · 카메라 · 필름 제조사 이름은 쓰지 않는다(7절). 사용자 로컬 스킬(아나모픽 룩, 10/26)에서 옮겼다.

- **화각은 할 일에서 고른다** — 스틸은 mm 를 써도 된다. 영상 첫 프레임으로 쓸 그림이면 영상 OPTICS 와 같은 °(`seedance-prompting.md` 4절 표의 값)로.

  | 할 일 | 렌즈 | 화각 | 이유 |
  |---|---|---|---|
  | 공간 · 설정 · 지리 | 24 mm | 약 84° | 공간이 읽히고 깊이가 쌓인다 — 장소의 기본 |
  | 주인공 물체 · 깊이 층이 있는 공간 | 35 mm | 약 63° | 흐림을 쓸 수 있고 가장자리가 덜 늘어난다 |
  | 좁은 실내 · 골목 · 차 안 | 40 mm | 약 57° | 24 mm 면 벽에 부딪힐 때(영상 화각표엔 없어 첫 프레임이면 63°) |
  | 미디엄 · 연기 | 50 mm | 약 47° | 얼굴이 읽힌다 |
  | 얼굴 · 인서트 | 85 mm | 약 29° | 얼굴을 24 mm 로 잡으면 늘어난다 |

  인물 시트는 85 mm(얼굴) · 50 mm(전신) · 35 mm(여럿).
- **흐림은 물리로 박는다** — 광각에 `strong blur` 만 쓰면 다 선명하게 나온다. 넷을 다 쓴다: ① 초점 물체 하나(`focus locked on the edge of the first column`)
  ② 거리와 높이(`the camera 1–3 m from it, the lens at knee height`) ③ `the aperture wide open` ④ 무엇이 녹는지 층마다
  (`the foreground railing melts into creamy blur, the far wall dissolves softly`). 초점 물체가 없으면 모델은 전부 선명하게 둔다.
- **보케와 플레어는 물건으로 — 맺히는 자리와 광원까지.**
  `anamorphic bokeh: tall vertical oval highlights on the wet floor and the lamp bulbs, and one long horizontal blue streak flare off the brightest light in frame`.
  보케는 **세로로 긴** 타원, 플레어는 **가로** 줄. 광원이 텅스텐 · 불이면 `warm amber streak flare` — 따뜻한 램프의 파란 줄은 가짜로 읽힌다.
  화면에 밝은 광원이 없으면 플레어도 없다 — 이유가 될 빛 하나(램프 · 수평선 띠 · 젖은 반사)를 둔다.
- **필름은 빛에 맞추고, 제조사 대신 균형과 감도로** — 밤 · 실내 · 해 질 녘 · 텅스텐은 `tungsten-balanced 500-speed colour negative, visible grain`,
  낮 · 흐린 날 · 파스텔은 `daylight-balanced 250-speed colour negative, fine grain`.
- **카메라 앵커는 한쪽에서 대각선으로, 높이 하나** — `Three-quarter angle from one side of the room, looking diagonally into its depth, the lens at waist height.`
  나노바나나 3 Pro 는 이 문장을 맨 앞에 둬야 따른다(5절 공간 플레이트 · 사내 취향).
- **공간 플레이트 순서** — ① 카메라 앵커 ② `A film still:` + 장소 한 줄 + 분위기 ③ 화면 속 앞 → 뒤 ④ 색 60 · 30 · 10 ⑤ 빛(광원 · 색온도 · 방향 · 대비)
  ⑥ 초점 · 조리개 · 녹는 것 · 보케 · 플레어 ⑦ 끝 문단 — 필름 · 렌즈 mm · 물리 세 자리를 장면에 맞게 바꿔 붙인다:
  `Photographed on real 35 mm film with tungsten-balanced 500-speed colour negative grain; a 24 mm anamorphic lens with a subtle horizontal flare and gentle highlight bloom; natural true-to-life colour; real environmental physics — rain falling in streaks backlit by the street lamp; gritty documentary realism, indistinguishable from a photograph taken on location. Every element in the frame is unique. A clean environment plate, empty of people; every sign face is a plain blank surface.`
  비는 램프 · 네온에 **역광**으로 줄이 보일 때만 비로 읽힌다 — 그렇게 적는다.
- **비율** — 2.39:1 이 이 룩의 기본이지만 본문에 쓰지 않고 설정으로: 앱의 `21:9`, 정확히 2.39:1 이 필요하면 GPT · 시드림 custom 픽셀(예: GPT 3824×1600).
- **고치기**

  | 증상 | 고치기 |
  |---|---|
  | 다 선명하다 | 초점 물체 이름 · 1–3 m · `wide open` |
  | 보케가 둥글다 | `tall vertical oval highlights` + 맺히는 자리 |
  | 플레어가 없다 | 화면에 밝은 광원 하나, 거기서 나오는 줄 |
  | 어안처럼 휜다 | `rectilinear`, 35 mm 로 |
  | 얼굴이 늘어났다 | 사람을 24 mm 로 잡음 — 85 · 50 mm 로 |
  | 3D 렌더 같다 | 끝 문단을 통째로 — 실제 35 mm 필름 · 그레인 · 물리 줄 |
  | 따뜻한 램프에 파란 플레어 | 줄 색을 광원에 맞춰 주황으로 |
  | 로고 · 상표가 생긴다 | 어딘가 제품 이름을 썼다 — 생김새 묘사로 |

  영상에서는 mm 대신 ° 로 같은 증거를 쓴다(`seedance-quality.md` 4절 아나모픽 룩).
