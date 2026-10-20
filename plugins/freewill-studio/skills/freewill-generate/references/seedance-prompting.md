# 시댄스 프롬프트 쓰는 법 — 감독처럼, 보이는 것만, 모순 없이

시댄스(2.0 · 2.5) 영상 프롬프트의 **사내 기본 형식** — 사용자가 따로 말하지 않았을 때 쓴다. 공식 템플릿만 따라 쓴 프롬프트는 카메라·렌즈·빛이 비어 화면이
덤덤했고, 레퍼런스 그림을 카메라 구도로 착각했다(사용자 지적 10/14 — "멀티모달 이해가 딸린다, 외주 프롬프트와 품질 차이가 너무 크다").
그래서 시댄스는 이 형식으로 **자세하고 정성스럽게** 쓴다. 5초 한 컷도 블록을 채우면 보통 2,500~6,000자다 — 짧게 줄이지 않는다.
Omni(구글)는 해당 없다 — 그 공식 가이드대로.

## 0. 무엇이 먼저인가

1. 사용자 지시 — 개인 스킬("CINEDANCE 로"), 붙여 준 프롬프트, 다른 형식("공식 템플릿으로", "짧게")을 말하면 **그대로 따르고**, 이 문서는
   그 스킬이 다루지 않는 빈 곳에만 쓴다. 그렇게 보낼 때는 jobs.json 에 `"user_format": true`(지침 0절 "개인 스킬·다른 지침")
2. 앱에 맞춘 규칙(지침 4단계) — 영어 본문, 레퍼런스 표기 `[Image N]`·`[Video N]`·`[Audio N]`, 엘리먼트 `@{이름}`, 첫·끝 프레임은
   refs 의 role, 비율·길이·해상도·개수·오디오는 설정으로(본문에 쓰지 않음), **소수 초 금지**
3. **이 문서** — 형식·밀도·연출, **`references/seedance-quality.md`** — 그 블록 안에 실패를 막으려고 쓸 것(연기·대사·카메라·빛·여러 컷·증상표),
   그리고 `references/prompt-logic.md` 논리 점검
4. 공식 `official:sd25-pe/<mode>`(2.0 은 `official:sd2-pe`) — 그 모드가 무엇을 받고 무엇을 잠그는지, 표기(대사 `{ }`·효과음 `< >`·
   음악 `( )`), 편집·연장 문장. **단, 공식의 "사용자가 말하지 않은 스타일·카메라·소리는 지어내지 말라"는 따르지 않는다** — 카메라·렌즈·
   빛·색·연기는 감독으로서 정해 쓴다. 사용자가 정한 인물·사건·대사·결말·개수는 바꾸지 않는다.

## 1. 다섯 가지 원칙

1. **보이는 것을 쓴다.** "긴장감", "시네마틱", "에픽" 같은 말은 그림이 되지 않는다. 화면에서 보이고 잴 수 있는 것으로 바꾼다.
   - tense → `He stops mid-step. His right hand closes slowly into a fist. The only light rakes in from screen-left and leaves half his face dark.`
   - epic car shot → `Low tracking shot level with the front wheel as the car takes a wet curve at 60 km/h, spray fanning off the tyres, the camera buffeting.`
2. **그림은 생김새, 글은 사건과 구도.** 레퍼런스 그림은 누가·무엇이·어떤 재질·어떤 빛인지를 맡는다. 카메라가 어디서 어느 렌즈로 무엇을
   보는지, 무엇이 일어나는지는 글이 정한다. 그림의 구도를 그대로 써야 하면 레퍼런스가 아니라 **첫 프레임 모드**다.
3. **시간 안에 들어가게.** 5초에는 사건 하나. 사건을 더 넣으면 전부 반쯤 되다 만다(5절).
4. **모순 없이.** 그 카메라 자리·렌즈·순간에 실제로 보이는 것만 쓴다 — 클로즈업에 발, 뒷모습에 표정, 탑다운에 벽면을 쓰지 않는다.
   보내기 전 `references/prompt-logic.md` 대로 점검한다.
5. **원하는 상태를 긍정형으로.** 막아야 할 실패는 그 긍정 문장 바로 뒤에 짧게(`Faces stay in deep side shadow; no flat front light.` ·
   `Smooth and motorised: no handheld float, no zoom, no cut.`). 원하는 것을 금지 목록으로 대신하지 않는다 — 쓴 말이 그림을 부른다
   (`seedance-quality.md` 1절 6).

## 2. 레퍼런스 — 역할을 범위로 묶는다 (레퍼런스→영상)

**인물·장소·소품은 어셋 라이브러리 엘리먼트 `@{이름}` 으로 부르는 게 기본이다**(지침 6단계 시댄스 0 — 등록·연결 방법).
한 번 등록하면 컷·작업이 바뀌어도 같은 이름으로 다시 부르고, 번호가 섞이지 않으며, 앱이 그 엘리먼트의 그림(시트·여러 방향)을 알아서 붙인다.
그림 파일 `[Image N]` 은 그 컷에만 한 번 쓰는 그림(구도 참고·블로킹 맵), 빠른 시험, 엘리먼트가 안 되는 모드일 때만 — 줄 쓰는 법은 같다.

레퍼런스마다 한 줄: **무엇인지 + 그 그림에서 쓸 것 + (시트면) 배경·칸·글자는 배치일 뿐 + 개수.**

| 종류 | 그림이 맡는 것 | 글이 맡는 것 |
|---|---|---|
| 인물 시트 | 얼굴·체형·머리·옷 | 지금 상태·자세·위치·연기 |
| 장소(여러 방향 그림) | 재질·표면·배치·빛의 성질 | 카메라 자리·화각·컷마다 보이는 쪽 |
| 소품·탈것 시트 | 모양·재질·색·글자 | 이 컷의 상태·방향·쥔 손 |
| 영상 레퍼런스 | 정한 것만(움직임·카메라 움직임·리듬 중) | 나머지 전부 |

```
@{hero_mina} is Mina, a Korean woman in her early thirties, slim, chin-length black bob, navy trench coat over a white shirt. Use her face, hair and wardrobe from the sheet's front full-body panel; do not take the sheet's grey backdrop or panel layout. 100% matches the reference.
@{loc_carpark} is the underground car park plate: board-marked concrete, pale green epoxy floor, square columns with striped corner guards, fluorescent tubes. Use it for the space's geography, materials, colour and light only; the framing of every shot is written below, not taken from the plate. Do not use the cars or people in it.
@{prop_dashcam} is the dashboard camera: matte black body, one round lens in a gunmetal ring, a slim windshield mount. Exactly one camera exists in the frame; the sheet's views and dividing line are layout only. 100% matches the reference.
[Video 1] is used only for the camera move — a slow handheld walk-in; not for the people, clothing or location in it.
The references supply identity, materials, colour and light; the shot sizes, camera positions and timing written here supply the framing.
```
(여기서 `[Video 1]` 은 이 컷에만 쓰는 움직임 참고라 파일로 붙였다 — 엘리먼트와 섞어 써도 된다.)

- **쓸 것과 쓰지 않을 것을 한 문장에** — `@{loc_workshop} is the workbench and window light. Do not use the people in it.`
  그림에 새어 나올 수 있는 것(다른 사람, 시트의 회색 배경·칸, 마네킹)은 그 줄에서 바로 뺀다.
- **충실도를 같이** — 그대로(face, build, wardrobe 전부) / 일부만(`the jacket and the scar; hairstyle may change`) /
  다른 대상에 옮기기(`apply this fabric's weave to Mina's coat only` — 옮겨 갈 대상을 꼭 이름으로) / 느낌만(색·분위기).
- **동작·컷 문장에서는 `@{이름}`·`[Image N]` 대신 사람 이름 + 눈에 보이는 특징 하나로** — `Mina, in the navy trench coat, crosses to the door.`
  핸들을 문장 주어로 쓰면 같은 인물이 둘로 나오기 쉽다(시댄스 2.5). 핸들은 ACTIVE REFERENCES 의 역할 줄에만 한 번씩.
- 인물 외모 글은 짧게 — 나이·역할·체형, 지금 상태, 꼭 살아야 할 특징 한두 개. 긴 외모 글은 그림과 싸운다. 작은 글자·로고·색처럼
  빠지기 쉬운 건 글로도 한 번 적는다.
- **레퍼런스가 많으면 다섯 단계로** — ① 대상마다 한 줄씩(`[Image 1] … [Image 4] define four characters` 처럼 한 줄에 묶지 않는다 — 엘리먼트면 이름이 이미 하나씩이다)
  ② 종류별로 묶기(인물 · 소품 · 장소 · 움직임·소리) + `Do not interchange these characters' appearances, positions or dialogue.`
  ③ 여러 컷에 나오는 인물은 프로필 한 덩어리(옷 = 어느 그림, 늘 드는 소품, 나오는 장소) ④ 컷마다 그 컷에 쓰는 것만 다시 고르기
  ⑤ 소품은 한 사람 것(`belongs only to Mina`), 인원·옷·방향이 컷마다 같은지 확인.
- **그 컷에 안 나오는 대상의 그림은 넣지 않는다** — 넣으면 모델이 화면에 억지로 넣는다. 여러 컷이면 컷 문단에서 그 컷에 나오는 것만 부른다.
- **레퍼런스마다 맡을 일을 한 줄로 말할 수 있어야 넣는다**(사용자 10/20 "판단 없이 막 넣는 느낌 — 방해되는 건 넣으면 안 됨").
  생성물(앞 영상의 프레임 · 앞에서 만든 장면 그림)을 다시 넣지 않는다 — 깨끗한 원본 시트·플레이트에서. 분위기 · 빛 · 재질은 글로 쓴다.
  끌려올 게 있는 그림(다른 인물이 있는 장소 사진 · 글자 · 그림체가 다른 참고 · 다른 컷 구도의 스틸)은 뺀다. 보내기 전에 작업 페이지 '보낼 것'에서 그림으로 보여 준다.
- 같은 대상의 여러 그림(소품 · 캐릭터 6면 시트)은 하나로 묶고 개수를 잠근다 — `jointly define one …`, `exactly one …, never a copy`.
- **공간은 메인 플레이트 한 장이 기본이다**(사용자 10/14 "배경 에셋은 하나만 있어도 되는데") — 여러 방향은 소품 · 캐릭터 이야기다.
  역방향 컷(숏 / 리버스)이 정말 있으면 그 방향 플레이트를 따로 엘리먼트로 두고(`loc_room` · `loc_room_reverse`) 그 컷에서 카메라가 보는 쪽만 부른다
  (`seedance-quality.md` 5절 — 180° 축).
- 그림의 구도를 따르라고 쓰지 않는다 — `matching the camera position of [Image 1]` 같은 문장은 다른 컷까지 그 구도로 끌고 가거나 무시된다.

## 3. 형식 — 블록 순서

필요한 블록만 쓴다. 통제가 필요한 곳(첫 프레임·위치·시선·소품·렌즈·빛·타이밍)은 촘촘하게, 아닌 곳은 짧게. 길이는 장식 형용사가 아니라
**수치·위치·방향**으로 늘린다.

```
SCENE CONTEXT
[Format and genre, the core subject and the principal event in one or two sentences; place, time of day, weather; who is where.]

ACTIVE REFERENCES
[One line per reference, scoped by role (section 2), then the hierarchy line.]

LOCATION MAP
[Foreground / midground / background with distances in metres. Where the camera stands, which side the light comes from, the paths subjects move along. With two or more shots: the axis (the line between the people, or the direction of travel), who is screen-left and screen-right, and the side of the line every shot stays on.]

FIRST FRAME / BLOCKING
[The literal first frame: every required subject already in frame, positions as screen x/y %, body facing and gaze, distance to the landmark.]

FORMAT MODE
[One continuous shot; the timed beats below all happen inside it; the camera does not cut on its own. / CUT 1 … CUT 2 … with cuts only at those points. / Whole-second timecodes that tile the runtime: 0–2s, 2–5s.]

OPTICS
[Per shot: shot size in words, field of view in degrees, camera distance and height, lens character. No drift mid-shot.]

CAMERA
[Per shot: support (locked off / dolly / handheld), ONE move with direction, distance and speed, its motivation, focus behaviour.]

ACTION
[What happens, in order, at the precision the shot needs. Subject motion and camera motion in separate sentences; one action per sentence where control matters.]

FINAL FRAME
[The literal last frame: who or what is where, what is held still, what is still moving.]

PERFORMANCE    (when someone acts)
[What they want, what is in the way, what their body and eyes do about it — breath, pauses, eye-line.]

PHYSICS
[Weight, inertia, contact, cloth and hair delay, liquids, particles — cause and effect.]

LIGHTING
[Real sources in the location, direction, colour temperature in Kelvin, exposure and contrast; one white balance per scene.]

COLOR GRADE    (when the look is stylised)
[Palette tied to material + light + role; hex values when a look is set.]

AUDIO
[<sound effects>, (music), {dialogue} in the official notation; offscreen sources named as offscreen. If nobody speaks: No dialogue or narration; mouths stay closed. No subtitles or on-screen text.]

STYLE
[Overall look in words — photoreal, film texture, real time or slow motion per shot. No director, film or equipment names.]

POSITIVE LOCKS
[Short fixers next to the likely failures: counts, positions, screen direction, light, prop states — each stated once.]
```

공식 템플릿의 필수 항목은 이 안에 다 들어간다 — 목표 = SCENE CONTEXT 첫 문장, 레퍼런스 역할 = ACTIVE REFERENCES,
시작·끝 = FIRST FRAME·FINAL FRAME, 대사 없음 = AUDIO. 여러 장면을 한꺼번에 쓸 때도 장면마다 처음부터 쓴다 — 틀에 끼워 찍지 않는다.

## 4. 렌즈와 카메라

**샷 크기**는 말로 쓰고(ECU · CU · MCU · MS · FS · WS · EWS — 들어오는 것은 `prompt-logic.md` 1절), **화각**은 도(°)로 쓴다.

| 화각 | 대략 렌즈(35mm 환산) | 쓰임 |
|---|---|---|
| 107° | 14–16mm | 큰 실내·건축, 압도하는 설정 |
| 84° | 20–24mm | 넓은 설정, 여러 명의 동선 |
| 63° | 28–35mm | 관찰·르포, 공간 안의 사람 |
| 47° | 40–50mm | 눈으로 보는 보통 시점 |
| 29° | 75–85mm | 얼굴·대화 단독, 배경 분리 |
| 18° | 100–135mm | 얼굴 클로즈업, 생김새 유지 |
| 12° | 180–200mm | 손·물건 세부, 멀리서 |
| 8° | 300–400mm | 멀리서 지켜보기, 압축된 공기 |

- 이 단계 값만 쓴다(23° 같은 중간값 X). mm 는 본문에 쓰지 않는다.
- **화각만으로 샷 크기가 정해지지 않는다** — 거리와 높이를 같이: `29°, camera 4 m from her at 1.5 m height; the close framing comes from lens reach, not from the camera being near.`
- 렌즈와 내용을 맞춘다 — 와이드는 공간·몸·가까운 물체 과장, 망원은 얼굴·관찰·압축, 접사는 따로 인서트. 한 컷에 섞이면 컷을 나눈다.
- 컷마다 받침(고정·돌리·핸드헬드)과 **움직임 하나**: 방향·거리·속도 — `dollies straight forward 1.5 m at walking pace and settles`. 움직이는 이유를 붙인다(깨달음, 소리 쪽으로).
- 좌우는 카메라 기준. 카메라는 빛의 반대편(그늘 쪽)에 서서 빛이 정면으로 납작하게 맞지 않게.
- **컷이 둘 이상이면 180° · 30° 를 기본으로 지킨다**(연출로 일부러 깰 때만 깨고, 그때는 의도와 넘는 방법을 적는다) — 축을 정해 카메라는 선의 한쪽에,
  컷마다 누가 화면 왼쪽 · 오른쪽이고 어느 쪽을 보는지, 같은 대상을 다시 잡으면 30° 넘게 옮기거나 크기를 한 단계 넘게. `seedance-quality.md` 5절.
- 장비·감독·영화 이름은 쓰지 않는다 — 그 모양을 말로 묘사한다.

## 5. 시간과 컷

| 길이 | 넣을 수 있는 것 |
|---|---|
| 4–5초 | 사건 하나. 원테이크 또는 컷 2개까지 |
| 6–10초 | 사건 하나 + 반응, 컷 2–3 |
| 11–15초 | 짧은 장면 하나, 컷 3–5 |
| 16–30초 | 장면 전체(처음·전환·끝), 컷 5–10 또는 긴 원테이크 |

- **멀티 엘리먼트(인물 · 소품 여럿을 부르는) 장면은 한 덩어리로 뽑는다**(사용자 10/20 "한 컷씩 따로 만들면 더블이 안 맞음 — 20초 호흡을 4초 5초씩
  따로 하지 말 것"). 한 호흡이면 시댄스 2.5 최대 30초까지 한 번에, 그 안에서 컷을 나눈다 — 따로 만든 클립끼리는 인물 · 옷 · 빛이 미세하게 달라 이어지지 않는다.
  나누는 건 장소가 바뀔 때, 30초를 넘을 때, 사용자가 컷별로 따로 고치겠다고 할 때만.

- 한 컷은 보통 2초 이상 — 박자에 맞춘 뮤직비디오식 편집만 예외(그때는 박자를 적는다).
- 타임코드는 **정수 초**, 0초부터 길이까지 빈틈·겹침 없이: `0–2s … 2–4s … 4–5s`. 컷 경계가 곧 HARD CUT 이다.
- 컷을 정했으면 `Cuts only at the stated points; the camera does not cut on its own.`
- 그 시간에 실제로 할 수 있는 움직임인가 — 걷기 약 1.4 m/s, 문을 열고 들어오기 2–3초.
- 컷 사이에 유지할 것(컨티뉴이티): 축과 카메라 쪽 · 인물 수 · 위치 · 화면 방향 · 시선 · 쥔 손 · 빛의 방향과 색온도 · 옷 · 소품 상태 — 컷마다 같은 값을 다시 쓴다.

## 6. 연출

- **블로킹은 수치로** — 화면 x/y %, 거리(m·걸음), `within 1 m of the counter, one hand on its edge`. near·beside·around 대신.
- **몸 방향과 시선을 따로** — `torso open to screen-left, eyes locked on the door`.
- **첫 프레임에 필요한 대상이 다 있다** — 빈 설정 샷, 늦은 등장은 일부러 원할 때만.
- **소품은 상태로** — 상태(열림·켜짐·젖음), 방향(어느 면이 카메라를 보는지), 쥔 손, 움직일 때 어떻게 되는지.
- **여러 명**은 각자 위치·속도·시선·근육으로 보이는 감정 하나·알아볼 버릇 하나, 그리고 순서·간격을 잠그는 한 줄.
- **연기는 감정 이름이 아니라 행동** — 원하는 것(동사)·막는 것·그래서 몸과 눈이 하는 것. `she looks sad` 대신
  `her eyes drop to the cup, her jaw sets, she swallows once before she answers`. 듣는 사람도 반응한다. 절제가 기본.
- **대사**는 `{ }` 안의 말만, 그 사람의 입만 그때 움직인다. 말 앞뒤에 숨 쉴 틈.
- 연기(전술 · 듣기 · 눈 · 미세 표정), 대사 길이와 립싱크, 감정에 맞춘 카메라 질감, 컷 잇기(180° · 30° · 컨티뉴이티), 밤 조명, 여러 인물 · 이어지는 클립은
  `seedance-quality.md` 2–8절에 자세히 있다 — 이 컷에 해당하는 절을 골라 같은 밀도로 쓴다.

## 7. 빛·색·물리·수치

- 빛은 장소에 실제로 있는 광원에서 — 창, 네온, 가로등, 화면. 방향·색온도(K)·세기·대비.
- 색은 재질 + 빛 + 역할로 — `the crimson scarf catching the cold corridor spill`. 정해진 룩이면 헥스 값과 검정·흰색이 어디까지 가는지.
- 물리는 원인 → 결과 — 무게, 관성, 접촉 그림자, 옷·머리의 늦음, 액체의 점성, 입자의 방향.
- 속도는 km/h 또는 m/s, 안개는 % 와 보이는 거리(m), 큰 것은 사람 키에 빗대어.

## 8. 모드별

- **레퍼런스→영상** — 이 문서 전체. 그림은 2절대로 범위를 묶고 구도는 글로.
- **첫 프레임 / 첫·끝 프레임** — 그림이 첫 장면 그대로다. `[Image N]` 없이 refs 의 role 로 묶는다. 첫 장면을 길게 다시 묘사하지 않는다 —
  OPTICS 에 `Keep the first frame's field of view` 를 쓰고, 무엇이 어떻게 움직이고 카메라가 어디로 가며 어떻게 끝나는지만.
- **글→영상** — ACTIVE REFERENCES 가 없으니 SCENE CONTEXT·LOCATION MAP·인물 줄이 생김새까지 다 맡는다. 그만큼 자세히.
- **편집·연장** — 공식 모드 문장이 먼저. 원본이 카메라·구도·움직임·빛·결의 기준이고, 바꿀 것 하나를 정확히 쓴 뒤 나머지는 그대로라고 잠근다.

## 9. 예 — 같은 장면, 전과 후

설정: 시댄스 2.5 · 레퍼런스→영상 · 21:9 · 5초 · 모텔 방, 전화기 6면 시트, 녹음기 6면 시트

**전** (실제로 보낸 것의 일부)
```
Shot 1, wide from the doorway, matching the camera position of [Image 1]: ...
Shot 2, close insert on the writing desk under the window: ...
Shot 3, slow dolly-in toward the nightstand beside the bed, ending close to the view of [Image 3]: ...
```
- 5초에 컷 3개 — 컷마다 2초가 안 돼 사건이 다 되다 만다.
- 카메라 자리를 그림에 맡겼다 — 구도가 끌려가거나 무시된다.
- 다시 쓸 방·소품을 그림 파일 6장(`[Image 1]`~`[Image 6]`)으로 붙였다 — 엘리먼트로 등록하면 이름으로 부르고 다음 컷에도 그대로 쓴다.
- 방을 4방향 그림으로 넣었다 — 공간은 메인 플레이트 한 장이면 된다(역방향 컷이 있을 때만 그 방향 플레이트를 따로).
- 화각·카메라 높이·빛 방향·색온도가 없다 — 모델이 무난한 평균으로 채운다.

**후** (같은 설정, 원테이크 — 세 가지를 엘리먼트로 등록하고 `@{이름}` 으로, `refs` 는 비움)
```
SCENE CONTEXT
A 1970s neo-noir thriller, night, heavy rain. In an empty motel room a mustard rotary telephone rings on the nightstand while, on the writing desk across the room, a reel-to-reel tape recorder switches itself on and starts taping a call nobody answers.

ACTIVE REFERENCES
@{loc_motel_room} is the motel room plate: walnut wall panelling, patterned carpet, venetian blinds, a long writing desk under the window and a small nightstand at the head of the bed. Use it for the room's geography, materials, colour and light only; the framing below is written here, not taken from the plate.
@{prop_rotary_phone} is the telephone: glossy mustard-yellow body, cream handset resting in the cradle, clear rotary dial over a cream number ring, coiled cream cord. Exactly one telephone exists; the sheet's six views and grey backdrop are layout only. 100% matches the reference.
@{prop_reel_recorder} is the tape recorder: brushed-aluminium top plate, walnut cheeks, two clear reels of brown tape, chrome head block, two cream VU meters, a row of black piano keys. Exactly one recorder exists; the sheet's six views and grey backdrop are layout only. 100% matches the reference.
The references supply identity, materials and light; the shot size, camera position and timing written here supply the framing.

LOCATION MAP
Foreground, screen-left: the end of the writing desk under the window, the recorder on it. Midground: about 3 m of patterned carpet. Background, screen-right: the nightstand at the head of the bed, the telephone on it. The rain-streaked window is behind the desk on screen-left; red neon from a sign outside falls through the blinds in horizontal stripes.

FIRST FRAME / BLOCKING
The recorder sits in the lower-left third, its reels at x 25%, y 70%, large and soft. The telephone sits on the nightstand at x 72%, y 48%, small and sharp, already ringing. The room is empty.

FORMAT MODE
One continuous shot; the timed beats below all happen inside it; the camera does not cut on its own.

OPTICS
Medium-wide, 47° field of view, the camera 1.2 m behind the recorder at 0.9 m height, just above desk level, looking diagonally across the room to the nightstand. No drift.

CAMERA
Locked off on a tripod at the desk's end. Focus holds on the telephone, then racks to the recorder at 2s and stays there.

ACTION
0–2s: The telephone rings; the handset trembles in its cradle on each ring.
2–4s: In the foreground one piano key on the recorder snaps down by itself, both VU needles jump, and the two reels begin to turn, drawing the brown tape across the head.
4–5s: The reels keep turning while the telephone rings on, soft in the background.

FINAL FRAME
The recorder sharp in the foreground with its reels turning; the telephone soft on the nightstand, the handset still in its cradle, still ringing; nobody in the room.

PHYSICS
The handset rattles a few millimetres in the cradle and settles between rings; the reels spin up over half a second and the tape draws taut.

LIGHTING
No lamps on. Hard red neon stripes through the blinds from screen-left fall across the desk and the carpet; a cold blue 7000K spill from the wet street outlines the bed; deep shadow under the nightstand. The camera sits on the shadow side of the desk.

COLOR GRADE
Low-key red and steel blue against near-black walnut; the darkest wood at #0E0B0C, the neon stripes peaking at #C2343A, the blue spill at #3D5A80; nothing reaches pure white.

AUDIO
<Rain tapping on the window>, <the shrill bell of the rotary telephone>, <a mechanical clunk as the key snaps down>, <a soft tape hiss and the whir of the reels>. No dialogue or narration. No subtitles or on-screen text.

STYLE
Photoreal, 1970s film texture with fine grain, real-time speed.

POSITIVE LOCKS
One telephone, on the nightstand only. One recorder, on the desk only. The room stays empty for the whole shot.
```

첫 프레임만 쓰는 경우(같은 방 그림을 첫 프레임으로)는 ACTIVE REFERENCES·LOCATION MAP 을 빼고 OPTICS 를
`Keep the first frame's field of view and camera height.` 로 시작해, 그 장면에서 움직이는 것과 끝 상태만 같은 밀도로 쓴다.

## 10. 참고 가이드 — 어휘·작성법 보충 (커뮤니티 · MIT, 매일 자동 동기화)

아래 자료에서 품질에 직접 듣는 규칙은 이미 `seedance-quality.md` 로 우리 앱에 맞게 옮겨 두었다 — 먼저 그걸 쓰고, 원문은 말을 더 고를 때 본다.
형식은 이 문서(또는 사용자 지시)를 따르고, 아래는 **말을 고르고 함정을 피할 때** 찾아본다. 그 안의 짧은 공식·키워드 수 제한·
다른 플랫폼 파라미터·`@Image 1` 표기는 따르지 않는다(앱은 `[Image 1]`). 목록과 버전은 `freewill_guide("versions")` 의 커뮤니티 표.

| 필요할 때 | topic |
|---|---|
| 찍기 전에 이 장면이 찍을 가치가 있는지 — 목표·장애물·전술·반전·가치 변화 | `official:higgsfield-scene-engine` |
| 시댄스 2.5 레퍼런스 문법 — 쓸 것·뺄 것·충실도, 여러 레퍼런스, 긴 영상 단계·끝 상태, 오디오·글자 표기, 첫·끝 프레임 | `official:higgsfield-seedance-2-5` (모드별: `/MODE-PLAYBOOKS`, VFX: `/VFX-PIPELINE`) |
| 시댄스 2.0 — 작성 법칙·실패 유형·엔진 규칙·필터 거절 | `official:higgsfield-seedance` · `/FAILURE-MODES` · `/ENGINE-RULES` · `/PRODUCTION-PATTERNS` · `/HELL-GRIND` |
| 영상→영상(편집·VFX·연장) — 원본을 지키고 하나만 바꾸기 | `official:higgsfield-seedance-vfx` · `official:higgsfield/templates/seedance/footage-vfx-transform` |
| 서술형이냐 타임코드형이냐, 프롬프트 구조 | `official:higgsfield-prompt` |
| 결과가 이상할 때 — 증상 → 원인 → 고치기 | `official:higgsfield-troubleshoot` · `official:higgsfield/skills/shared/house-rulings` |
| 부정어를 언제 어떻게(긍정형 원칙의 예외) | `official:higgsfield/skills/shared/negative-constraints` |
| 장르별 시작 틀 — 액션 추격·제품·공포·패션·SF VFX·인물 소개·풍경 설정·코미디·로맨스·댄스 | `official:higgsfield-recipes` · `official:higgsfield/templates/<01~10 이름>` · 예시 `official:higgsfield/prompt-examples` |
| 여러 컷의 룩 통일(전역 스타일 머리말) · 여러 인물 고정 · 위치 지도(staging·top-down) · 표정 비트 | `official:higgsfield/templates/seedance/<global-style-prefix · multi-character-anchor · staging-reference · top-down-map · facs-expression-beats>` |
| 여러 컷 샷리스트 | `official:higgsfield-shotlist-director` |
| 카메라 무빙 이름과 언제 쓰는지, 감정에 맞춘 카메라 | `official:higgsfield-camera` · `official:cinematic-video-prompt/01-camera-angles-and-movement` · 어휘 `official:higgsfield/vocab` |
| 조명·색 보정·룩·무드 어휘 | `official:higgsfield-style` · `official:cinematic-video-prompt/02-lighting` · `/05-style-color-mood` |
| 구도·렌즈·필름 질감 | `official:cinematic-video-prompt/03-composition` · `/04-lens-technical-film` |
| 재질·날씨·자세 | `official:cinematic-video-prompt/06-materials-weather-pose` |
| 연기 — 원하는 것·장애물·전술·시선, 인물 연기 프로필 | `official:higgsfield-acting` |
| 클로즈업 미세 표정(얼굴 근육 단위) | `official:higgsfield-facs` |
| 소리 — 대사·립싱크·효과음·배경음·음악 | `official:higgsfield-audio` |

O-Side 문서 안의 상대 경로는 이렇게 받는다 — `../higgsfield-<이름>/SKILL.md` → `official:higgsfield-<이름>`, `../shared/<파일>.md` →
`official:higgsfield/skills/shared/<파일>`, `../../templates/<경로>.md` → `official:higgsfield/templates/<경로>`, 루트의 `vocab.md` 같은 파일 → `official:higgsfield/<파일>`.

## 11. 보내기 전에

1. `references/prompt-logic.md` 대로 한 블록씩 대조하고 모순을 고친다.
2. `references/seedance-quality.md` 1절 열 가지(컷 규칙 · 끝에 닿는 움직임 · 원인 사슬 · 개수 · 세트 잠금 · 배분 · 잴 수 있는 말 · 동사 · 처음부터 · 한 줄씩 고치기)를 대조한다.
3. 보내기 스크립트 dry-run 이 짚는 "확인할 것"을 하나씩 보고 고치거나, 맞는 경우면 그대로 둔다.
4. 확인 카드는 할지 말지만 묻는다 — 영어 프롬프트는 사용자가 보자고 할 때만 보여 준다.
