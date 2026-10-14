# 에셋 만들기 — 인물 · 여러 인물 · 소품 · 탈것 · 배경

영상(특히 레퍼런스→영상)에 쓸 인물·소품·탈것·장소 그림을 만들 때의 **기본 형식과 프롬프트 쓰는 법**이다.
사용자가 다른 형식을 말하거나 개인 스킬로 쓰라고 하면 그걸 따른다 — 이 문서는 아무 말이 없을 때의 기본값이다.
모델별 문법은 4단계의 공식 가이드를 같이 읽는다(형식은 이 문서, 그 모델에 맞는 말투는 공식 가이드).
프롬프트는 **자세하고 정성스럽게** — 틀의 칸을 빠짐없이 채우고, 칸끼리 모순이 없게(`references/prompt-logic.md`) 쓴다.

## 형식 — 종류마다 정해져 있다 (묻지 말고 기본값으로)

| 종류 | 한 장 안의 구성 | 배경 | 비율 · 해상도 | 모델 추천(이 PC 앱에 있는 것 중) |
|---|---|---|---|---|
| **인물 1명** | 3칸 나란히: 왼쪽 얼굴 클로즈업(정면, 눈은 렌즈) · 가운데 정면 전신 · 오른쪽 같은 자세 뒷모습 전신 | 한 장으로 이어진 **중간 회색 무지 배경** | 16:9 · 2K | Seedream 5.0 Pro(실사 피부·머리카락) · 없으면 Nano Banana Pro / GPT Image 2.5 |
| **여러 인물**(엑스트라·팀·가족) | **정면 풀샷 한 장**: 한 줄로 서서 겹치지 않게, 머리부터 신발까지, 모두 같은 빛 | 같은 회색 | 16:9 · 2K | Nano Banana Pro |
| **소품** | 2칸 앞 · 뒤(같은 크기·같은 자리, 가운데 얇은 세로선). 옆모습이 중요한 물건은 앞 · 옆 · 뒤 3칸 | 같은 회색 | 16:9 · 2K~4K | GPT Image 2.5(글자·기호 정확) · Nano Banana Pro |
| **탈것** | 2칸: 3/4 앞(카메라 왼쪽에서) · 3/4 뒤(카메라 오른쪽에서), 가운데 세로선, 문은 다 닫힘 | 밝은 회색 | 16:9 · 2K~4K | Nano Banana Pro · GPT Image 2.5 |
| **배경(장소)** | **풀샷 한 장, 3/4 대각 앵글**(2점 투시 — 정면으로 마주 보지 않음), 눈높이, 앞·중간·뒤 깊이, 사람 없음 | — | 16:9(시네마스코프면 21:9) · 2K | Nano Banana Pro · 프로덕션 4K 면 GPT Image 2.5 |

- 장수는 기본 2장(A/B) — 하나로는 우연인지 프롬프트 탓인지 못 가린다. 빠른 룩 확인만이면 Flash Lite 1K.
- 화면이 있는 기기(폰·태블릿·모니터)는 앞면 화면을 **크로마 그린 단색**으로 — 화면 내용은 나중에 합성한다. 사용자가 화면 내용을 정해 주면 그대로.
- 탈것 번호판은 가상의 문자열 하나를 정해 앞뒤에 똑같이(따옴표로 정확히). 실제 브랜드 엠블럼·로고는 빈 면으로.
- 묻는 건 형식이 아니라 내용뿐이다 — 인물: 누구(나이·생김새·옷), 몇 명 / 소품·탈것: 무엇(재질·색·디테일) / 배경: 어디·언제(실내외·시간대). 형식은 확인 카드에 한 줄로 보여 준다.
- **시댄스 레퍼런스→영상에 넣을 세트**(사용자 10/14 "에셋이 빈약하다 — 앞뒤 옆 위 느낌으로 여러 방향, 분리는 제대로, 16:9")는 한 장으로 끝내지 않는다:
  공간은 메인 3/4 를 먼저 고른 뒤 그 그림을 레퍼런스로 카메라만 옮겨 **역방향 · 측면 · 위** 3장을 더(아래 '같은 공간 다른 방향'),
  소품·사람 아닌 캐릭터(로봇 등)는 **6면 시트**(앞·뒤·좌·우·위·아래). 사람은 3칸 시트 그대로(시드림 원본 — 실사 인물 필터). 전부 16:9.
- 영상에서 **말하거나 감정 연기가 큰 인물**이면 같은 사람의 **강한 표정 클로즈업**(크게 웃음·화남 — 이가 보이게) 한 장을 시트와 따로 더 만든다 —
  무표정 그림만 있으면 첫 대사에서 입 모양·치아를 지어낸다(커뮤니티 `official:higgsfield-seedance-2-5` 의 레퍼런스 세트 권장).

## 프롬프트 요령

1. **영어 자연어 문장.** 첫 문장에 틀을 박는다 — "Three studio photographs …", "A three-quarter wide interior view …". 키워드 나열(4k, masterpiece)은 효과 없다.
2. **원하는 것을 긍정으로.** "plain blank surface", "empty of people", "unbranded, smooth badge area". "no X" 를 줄줄이 쓰면 오히려 X 를 부른다 — 글자·로고 금지만 한 줄로 분명히.
3. **비율·해상도·장수는 앱 설정** — 프롬프트 본문에 "16:9", "4K" 를 쓰지 않는다.
4. **빛은 방향과 성질로.** "one large soft key from front-left, gentle ratio, soft contact shadow". 시트는 **자연광 같은 부드러운 빛·낮은 대비**로 — 3점 조명·강한 림라이트로 만든 시트를 영상에 넣으면 인물만 밝게 뜬다.
5. **재질은 실제 이름으로** — brushed aluminium, leather-grained plastic, honed marble, matte black titanium.
6. **실사 단서**: "studio photographs", "photoreal product photography", "real-estate interior photograph". "character reference sheet", "illustration", "concept art", "painterly" 는 그림체로 샌다.
7. **실존 인물 이름·브랜드·로고 금지** — 생김새를 특징으로 풀어 쓴다. 꼭 필요한 글자(번호판·버튼 기호)는 정확한 문구를 따옴표로.
8. **패널은 문장으로 하나씩** — "Left: … Middle: … Right: …", 그리고 일관성 문장 하나: "the same real person in all three, identical hair and wardrobe".
9. **자세하게, 빠짐없이.** 틀의 칸(칸 위치 · 카메라 · 대상 · 옷 · 빛 · 사실감)을 다 채운다 — 짧게 줄이지 않는다. 길이는 장식 형용사가 아니라
   위치 · 수치 · 재질로 늘린다. 칸끼리 모순이 없게 — 얼굴 칸에 신발, 뒷모습 칸에 표정, 정면 칸에 뒷면 로고를 쓰지 않는다(`prompt-logic.md`).
10. 사실감 문장(살짝 비대칭인 얼굴, 점, 잔주름)이 기본. 사용자가 "예쁘게·모델처럼"이라고 하면 그 문장은 빼고 다듬어진 미인형으로 쓴다.

## 틀 — 대괄호만 채운다

**인물 1명 (3칸)**
```
Three studio photographs of the same [woman/man] side by side across one continuous flat mid-grey seamless backdrop, a film character sheet — the same real person in all three, identical hair and wardrobe throughout.
LEFT PANEL, x 0–33%: a head-and-shoulders portrait, face square to camera, eyes looking into the lens, the head filling y 12–78% of the panel.
CENTRE PANEL, x 33–66%: full body from the front, hair to shoes, standing at ease with the feet shoulder-width apart, arms relaxed and held slightly clear of the body so the silhouette reads.
RIGHT PANEL, x 66–100%: the same stance seen from directly behind at the identical distance — the back of the head, the shoulder line, the waist and the shoes readable.
CAMERA: both full-body panels at a 47° field of view from 4 m away at hip height (about 1 m), dead level, the crown near the top edge and the shoes near the bottom; the portrait panel at 29° from 2.5 m at eye level, the tight framing coming from lens reach; every panel square-on with no perspective lean.
THE [WOMAN/MAN]: [age, build and height, face shape and features, skin tone in words, hair, distinctive marks].
WARDROBE, identical in all panels: [garments with materials and colours], [shoes], [one signature item].
LIGHT: soft even daylight-like studio light from front-left, low contrast, exposed slightly low, gentle natural falloff, a soft contact shadow under the feet in the two full-body panels.
REALISM: photoreal studio photography, pore-level skin with fine vellus hair, slight natural asymmetry, one or two small moles, real fabric weave and natural creases, true-to-life colour, every panel in sharp focus.
```

**여러 인물 (정면 풀샷 한 장)**
```
One continuous flat mid-grey studio seamless with [N] people standing side by side in a single row, a casting photograph — each one a different real person, evenly spaced and not overlapping, all square to camera, full length from head to shoes, arms relaxed at their sides. [Person 1 in one clause: age, gender, build, clothes]; [Person 2]; [Person 3]. Everyday clothes in a muted palette, plain fabrics with no logos or readable text. Neutral easy expressions, mouths closed, eyes to the lens. Camera at a 47° field of view from about 7 m at hip height, dead level, everyone from crown to shoes with a strip of floor below the feet. One large soft key from front-left slightly above eye level, a gentle ratio, a soft contact shadow under every pair of feet. Photoreal casting photography, everyone equally sharp.
```

**소품 (앞 · 뒤 2칸)**
```
A straight-on product photograph of one [object] shown twice on a flat mid-grey seamless backdrop, the sheet split into two equal panels by a single thin vertical line down the exact centre. The left panel is the FRONT, upright and square to camera: [shape, materials, colours, buttons and markings — exact text in quotes]. The right panel is the BACK of the same [object] at the identical size and position: [back details]. Camera at an 18° field of view from about 1.5 m, square-on to each face with no perspective lean, the object filling about 70% of its panel's height. Soft broad light from front-left, one gentle highlight on the [metal/glass], a soft contact shadow under each. Photoreal product photography, the [materials] resolving, plain unbranded surfaces.
```
화면 있는 기기면 앞 칸에: `the screen is a flat, even, solid chroma-green panel from edge to edge`.

**소품 · 사람 아닌 캐릭터 (6면 시트 — 영상 레퍼런스 세트용)**
```
A six-view product reference of one [object] on a flat mid-grey seamless backdrop, laid out as a 3×2 grid of equal panels separated only by an even grey gap: top row FRONT, BACK, LEFT SIDE; bottom row RIGHT SIDE, TOP, UNDERSIDE — the same single [object] at the same scale in every panel, square-on to each face. [Shape, materials, colours, markings — exact text in quotes]. Camera at an 18° field of view from about 1.5 m for every panel, no perspective lean, the object filling about 70% of each panel. Soft broad light from front-left, one gentle highlight on the [metal/glass], a soft contact shadow under it. Photoreal product photography, plain unbranded surfaces.
```
기본 앞·뒤 시트를 먼저 고르고, 그 그림을 레퍼런스로 넣어 6면으로 넓히면 생김새가 흔들리지 않는다(GPT Image 2.5 Sunburst).

**탈것 (3/4 앞 · 3/4 뒤)**
```
A product reference of a [colour and finish] [body type], [design character], shown twice on one sheet over a plain light-grey seamless studio backdrop, split by a single thin vertical line down the centre: a three-quarter FRONT view from camera-left on the left — the nose, the bonnet, the front plate and the driver's side — and a three-quarter REAR view from camera-right on the right — the tail, the rear lamps, the rear plate and the passenger side — the same vehicle, colour and wheels in both. [Key design lines: lamps, grille, wheels, glass, mirrors]. Licence plates front and rear read "[ABC 1234]" in dark block characters, identical on both. The vehicle stands alone with every door closed. Camera at a 47° field of view from about 7 m at 1 m height for both views, the whole vehicle in frame with a margin, all four wheels on the floor line. Even soft daylight from high front-left, a soft contact shadow under every tyre. The badge recesses on the nose and on the tailgate are smooth, blank body-colour surfaces — a generic, unbranded design. Photoreal automotive product photography.
```
실제 차처럼 그리면 모델이 실존 브랜드 엠블럼을 붙이기 쉽다(한글 번호판 SUV 를 Nano Banana Pro 로 만들었더니 2장 모두 실제 브랜드 엠블럼).
엠블럼 자리는 위처럼 "매끈한 빈 면"으로 긍정형으로 적고, 결과에서 엠블럼부터 본다 — 붙어 나오면 아래 '고칠 때'로 그 자리만 빈 면으로 고친다.

**배경 (3/4 풀샷)**
```
A three-quarter wide [interior/exterior] view, shot like a real-estate [interior] photograph from standing eye height with a wide lens. The camera stands [where], well off the centre line and turned about forty degrees across the space, so it reads in two-point perspective with depth from foreground to background. [The main aisle / corridor / street] runs diagonally across the frame from the [right] foreground to the [left] background, and [what closes the far end] sits in the [left] third of the frame, seen at an angle: [what recedes along the left], [what recedes along the right].
Optics: 84° rectilinear wide, camera at 1.6 m eye height, verticals kept vertical.
[Place, era, time of day]. [Architecture and materials with their finish]. [Furniture and fixed objects]. Every sign, screen and label is a plain blank surface. The space is empty of people; clear, still air.
Light: [main source, direction and colour temperature], [secondary sources], soft shadows. Colour: [palette in words — 60/30/10 if the user gave one].
```

**같은 공간 다른 방향 (영상 레퍼런스 세트용 — 고른 메인 그림을 레퍼런스로)**
```
Edit the image: show the same single [place] from a different camera position.
CHANGE: the camera moves to [the far end, looking back toward the entrance / the side wall, looking straight across the space / directly overhead, looking straight down at the floor plan].
PRESERVE EXACTLY: the architecture, materials, furniture and fixture positions, light direction and colour, time of day and weather — the same place, now seen from that position.
```
위(탑다운)에서는 바닥과 물건의 윗면만 보인다 — 벽면·간판 정면을 쓰지 않는다(`prompt-logic.md` 2절).
카메라 위치 문장이 가장 중요하다 — 맨 앞에 둔다. 영상에서 카메라가 서는 쪽과 같은 방향에서 찍어 두면 플레이트가 컷과 부딪히지 않는다.
통로·복도·주차장·거리처럼 한 방향으로 길게 뻗은 공간은 그 끝을 정면으로 보는 1점 투시로 새기 쉽다(지하주차장 2장 중 1장이 그렇게 나옴).
그 길이 화면을 대각으로 가로지르고 끝이 화면 한쪽 1/3 에 온다고 **자리를 적는다**. "never a head-on view" 같은 부정문은 오히려 그 구도를 부르니 쓰지 않는다.

## 받은 뒤 점검 — 형식부터

결과를 열어 보고 형식이 맞는지 먼저 본다(지침 6단계 끝 보고). A/B 중 맞는 쪽을 권하고, 어긋난 장은 무엇이 어긋났는지 한 줄로 보여 주고
"어떤 걸 다시 만들까요?"(지침 7단계)로 묻는다.

| 종류 | 볼 것 |
|---|---|
| 인물 1명 | 3칸 구성(얼굴 · 정면 전신 · 뒷모습 전신) · 세 칸이 같은 사람·같은 옷 · 회색 무지 · 빛이 부드러운지(인물만 밝게 뜨면 영상에서 튄다) |
| 여러 인물 | 한 줄 · 겹침 없음 · 머리부터 신발까지 · 모두 정면 |
| 소품 | 앞·뒤 같은 크기·같은 자리 · 화면은 크로마 그린 단색 · 글자·로고 없음 |
| 탈것 | 3/4 앞·뒤 · 번호판 글자가 앞뒤 같은지 · **실존 브랜드 엠블럼** |
| 배경 | 1점 투시로 새지 않았는지 · 사람 없음 · 표지판·기둥 번호 같은 글자 |

## 고칠 때 (편집)

한 번에 하나만 바꾼다. 원본을 레퍼런스로 넣고:
```
Edit the image: [one-line goal].
CHANGE: [the single thing that changes, precisely].
PRESERVE EXACTLY: [face, hair, wardrobe, pose, camera angle, background, light and shadows, colour] — identical otherwise.
```
너무 많이 바뀌었다고 하면 PRESERVE 를 늘리고 CHANGE 를 줄인다. 구도를 통째로 바꿔야 하면 편집이 아니라 새로 만든다.

## 영상에서 쓸 때 (시댄스)

영상 프롬프트 쓰는 법 전체는 `references/seedance-prompting.md` — 그림은 생김새, 구도는 글(2절).

- **시트는 생성 원본 그대로** 레퍼런스로 넣는다 — 패널을 잘라 내거나 손댄 시트는 BytePlus 실사 인물 필터에 걸리기 쉽다. 그림 비율은 0.39~2.5 안.
- **영상에 넣을 에셋은 어셋 라이브러리 엘리먼트로 등록해 `@{이름}` 으로 부르는 게 기본이다**(지침 6단계 시댄스 0) — 이름 · 분류
  character / location / prop · 설명 한 줄 · 이미지(시트 원본 그대로, 장소는 여러 방향 그림까지 한 엘리먼트에). 이름은 `hero_mina` ·
  `lot_hotel_garage` · `prop_dashcam` 처럼 짧은 영어로. 그림 파일을 직접 붙이는 건 한 번 쓰고 말 그림일 때만.
- 영상 프롬프트에는 이렇게: 시트의 칸·구분선·라벨은 배치일 뿐 물건이 아니라고, 그 소품은 화면에 하나뿐이라고 — `The sheet's panels, dividing line and labels are layout only and never appear as objects; only ONE [object] exists in the frame.` 인물은 나이 · 역할 · 지금 상태 · 눈에 띄는 특징만 짧게, 나머지는 레퍼런스가 맡는다.
- 그 컷에 나오지 않는 에셋은 넣지 않는다 — 넣으면 모델이 화면에 억지로 넣는다.
- 배경 그림을 구도까지 따르게 하려면 첫 프레임으로, 장소의 생김새·분위기만 쓰려면 레퍼런스로(모드는 3단계에서 정한다).
