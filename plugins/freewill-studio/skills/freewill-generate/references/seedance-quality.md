# 시댄스 품질 규칙 — 자주 나는 실패와 그걸 막는 문장

`seedance-prompting.md` 가 **형식**(블록 순서·밀도·레퍼런스 쓰는 법)이면, 이 문서는 그 블록 안에 **무엇을 써야 실패가 안 나는지**다.
커뮤니티 스킬 — O-Side Media `higgsfield-ai-prompt-skill`(시댄스 2.0·2.5 실전 기록)과 Rylai `cinematic-video-prompt-skill`(어휘) — 을
처음부터 끝까지 읽고 품질에 직접 듣는 규칙만 골라 우리 앱(BytePlus)에 맞게 옮겼다(사용자 10/14 "퀄리티 올려 주는 프롬프트·규칙은 꼼꼼히 보고 잘 따와라").
대부분 현장 관찰이라 BytePlus 에서 잰 값은 아니다. 사용자 지시와 앱 규칙(정수 초·설정은 본문에 안 씀·`[Image N]`·`@{이름}`)이 먼저고,
출처와 다르게 쓰는 곳은 10절에 모았다.

- **쓰기 전에** — 2절(연기)·3절(대사·소리)·4절(카메라)·5절(빛·색)·6절(여러 컷)·7절(상황별)에서 이 컷에 해당하는 것을 고른다
- **다 쓰고 나서** — 1절 열 가지와 `prompt-logic.md` 로 대조한다. 보내기 스크립트 dry-run 이 일부를 "확인할 것"으로 짚는다
- **결과가 이상하면** — 9절 증상표에서 원인을 찾아 **한 곳만** 고친다(1절 10)

## 1. 기본 열 가지 — 모든 시댄스 프롬프트

1. **컷은 정한 곳에서만.** FORMAT MODE 에 컷 규칙을 쓴다. 여러 컷이면 `Cuts only at the stated points; the camera does not cut on its own.`,
   원테이크면 `One continuous shot; the timed beats below all happen inside it; the camera does not cut on its own.` — 원테이크 안의 타임코드가
   컷 지시로 읽히기도 한다(출처 안에서도 엇갈리는 관찰이라 문장으로 못 박는다).
   컷이 바뀌면 **샷 크기와 카메라 성격을 둘 다** 바꾼다(MS 핸드헬드 → ECU 고정). 컷 종류는 이름으로 — HARD · SMASH · MATCH · INSERT · REVERSE.
   디졸브·페이드는 요청할 때만.
2. **움직임은 한 방향으로 채우고, 끝에 닿는다.** 한 컷의 행동은 같은 방향으로 이어지는 2–3 동작(다가가 → 손을 뻗어 → 집는다)이다.
   갔다가 돌아오는 움직임은 컷 둘이다 — 한 컷에 넣으면 남는 시간을 되돌아가는 동작으로 채운다. 끝은 눈에 보이는 사실로 쓴다
   (`the cup is in her hand, lifted clear of the saucer`). 카메라 움직임도 **끝에 화면이 무엇을 보여 주는지**까지 —
   `slow dolly-in, ending on her hands wrapped around the cup`. 그 움직임과 시간으로 FINAL FRAME 에 실제로 닿는지 계산한다
   (5초 느린 푸시로 와이드가 ECU 가 되지 않는다).
3. **물건은 원인이 있어야 움직인다.** 손으로 다루는 장면은 사슬로 쓴다 — 처음 상태 → 손이 닿는 곳 → 힘의 방향 → 재질의 반응 → 끝 상태.
   `Her thumb presses the red key: 2–3 mm of travel, a click, the key springs back; the screen lights only after the click.`
   과정을 다 못 보여 주면 두 상태 + 소리(닫힌 상자 → 딸깍 → 열린 상자). 한 번만 일어나야 하는 동작(버튼 한 번, 한 걸음)은 블로킹 · ACTION ·
   POSITIVE LOCKS 세 곳에 같은 말로 적고, 다른 손가락이 어디 있는지도 긍정형으로(`her other fingers stay curled under the phone`).
4. **개수·주인·키를 잠근다.** SCENE CONTEXT 첫 줄에 인물 수(`Exactly three people are in this scene: Mina, Jun and the guard.`).
   세는 소품은 `exactly one … throughout`, 소품마다 주인 한 명(`the parcel belongs only to the courier`). 군중은 덩어리 하나로 대략의 수를 적고
   (`a crowd of about twenty`) 따라가는 인물은 셋까지. 손 클로즈업은 손이 몇 개고 화면 어느 쪽에서 들어오는지, 손 연기를 하는 사람은 둘까지.
   두 사람 이상이면 실제 키(`Mina is 165 cm, Jun is 182 cm`), 와이드에는 사람 크기 기준을 하나 둔다. 복제는 모델의 기본 실패라
   `never a second phone` 같은 짧은 부정은 써도 된다.
5. **세트는 레퍼런스가 보여 준 것만.** `The set contains only what the location reference shows — no added furniture, doors or rooms.`
   역방향 컷에서는 없는 것을 이름으로 적는다(`the wall behind the bed is solid panelling with no second door`). 레퍼런스에 없는 방·문·길을
   지어내는 게 가장 흔한 표류다.
6. **금지보다 배분.** 번지는 색은 자리와 양을 정해 준다 — `Yellow exists only inside the lamp bulb and a palm-sized halo beneath it.`
   부정문은 모델의 기본값이 곧 실패인 곳(복제, 멋대로 컷 · 줌 · 떠다니는 핸드헬드, 싸움의 슬로모션, 깔리는 음악, 레퍼런스 음성 따라 하기)에만,
   긍정 사실 다음에 짧게 — `Smooth and motorised: no handheld float, no zoom, no cut.` · `It dips once on its springs and does not travel along the ground.`
   원하는 것을 금지 목록으로 대신하지는 않는다.
   맨말 품질어 — `film grain`, `blurry background`, `hazy`, `imperfect focus` — 는 화면 전체를 뭉갠다. 어느 면이 언제 어떻게
   (`a brief focus hunt on the fence at 2s; her face stays sharp`), 안개는 % 와 거리(m)로 쓴다.
7. **잴 수 있는 말.** `fast` 대신 km/h·보폭·접촉(`fast` 가 복잡한 움직임에서 화면을 가장 많이 흔드는 말이라는 관찰), 무게는 kg
   (`a 75 kg man — the drop lands hard`), 안개는 `40% density, visible to about 15 m`, 화이트밸런스는 장면마다 Kelvin 하나, 큰 것은 사람 키에
   빗대어, 좌우는 카메라 기준. "더 자연스럽게"는 몸의 어디서 어디로 무엇이 전해지는지로(`the push travels from her heel up through the hip`).
8. **동사 하나에 뜻 하나, 문장은 짧게.** 두 가지로 읽히는 동사(tear, shoot, duck, bolt, draw, wave, fire, strike, break, snap)는 바꾼다 —
   `wind tearing at her coat` → `wind whipping hard at her coat`. 현재 시제, 박자마다 세 문장까지, 중요한 건 한 번만.
   인물은 요청이 없으면 렌즈를 보지 않는다. `beautiful` · `stunning` · `epic` · `dynamic` · `cinematic` · `masterpiece` 는 지우고 보이는 것으로.
   디테일을 말하려면 그 디테일이 어디서 보이는지를 바로 붙인다(`8K capture detail — pores, wool weave, the grain of the dashboard plastic`).
9. **프롬프트마다 처음부터.** 다른 프롬프트를 가리키지 않는다 — `as above`, `same as shot 10`, 장면 번호, 앞 컷 요약을 쓰지 않는다.
   컷끼리 맞춰야 하는 값은 **같은 절댓값을 양쪽에 다 쓴다**(같은 km/h, 같은 K, 같은 화면 %). 한 시퀀스의 렌즈 성격 · 조명 원칙 · 색 · STYLE ·
   소리 원칙은 한 곳에서 고쳐 모든 컷에 같은 글로 붙인다 — 어느 컷이 그중 하나를 바꾸면 바꾼다고 적는다.
10. **고칠 때는 한 줄만.** `Keep … / Change only … / Do not alter anything else.` 문장을 덧붙이지 말고 그 자리에서 바꾼다(덧붙이면 앞 문장과 싸운다).
    다시 뽑을 때 바꾸는 건 하나씩. 두 테이크에 **같은** 결함이면 프롬프트 탓이니 고쳐 쓰고, 테이크마다 **다른** 결함이면 운이니 프롬프트를
    그대로 두고 다시 뽑아 고른다. 고칠수록 나빠지면 대상 + 행동 + 카메라만 남기고 다시 쌓는다. 열 번 가까이 고쳐도 안 되면 컷이 잘못된 것 —
    나누고, 행동 하나를 빼고, 앵글을 바꾼다. 한 컷의 주 임무가 둘이면(액션과 대사, 물리와 연기) 컷 둘이다.

## 2. 연기 — 감정 이름 대신 몸이 하는 일

- **감정은 근육·숨·눈·피부로 푼다.** 겹친 감정은 얼굴에 위의 감정, 숨·자세·손에 아래 감정, 눈에 새는 것 하나 —
  `Anxious resolve: jaw set, gaze locked on him, shallow chest breathing, her free hand opening and closing at her side.`
  어떤 감정인지 풀 수 없으면 사용자에게 고르게 한다.
- **원하는 것과 전술.** 인물마다 지금 원하는 것을 동사로(press, charm, shame, plead, provoke, bargain, threaten, stall) — 막히면 전술이 바뀐다.
  한 컷에 2–4번의 변화가 멈춤 · 자세 · 빠르기 · 시선 중 하나로 보인다. 손에는 할 일을 준다 — 손이 멈추는 순간이 강세다
  (`she keeps folding the cloth until his question; her hands stop mid-fold`).
- **듣는 사람도 연기한다.** 말이 끝나기 전에 반응하고, 어려운 질문 앞에서 잠깐 멈추고, 말없이 있는 사람에게는 할 일(그가 거짓말하는지 살핀다)을 준다.
  대사 차례를 기다리는 빈 얼굴이 가장 AI 같다.
- **눈에 일을 준다.** 상대의 두 눈을 번갈아 보기, 말이 먹혔는지 확인하기, 훔쳐보고 돌아오기. 깜박임은 상태대로(긴장하면 연달아, 여유로우면 느리게),
  고개보다 눈이 먼저 간다. 가만히 있는 컷이면 느린 깜박임 한 번 · 빠른 두 번 · 힘준 한 번처럼 깜박임으로 박자를 만든다.
- **클로즈업일수록 덜 움직인다.** 반대되는 두 진실을 같이 — `the smile stays on her mouth while her eyes tighten, and she swallows once`.
  감정 변화마다 몸의 신호 2–4개(넘으면 흐려진다). 분노: 턱 근육이 뛰고, 힘준 단어에서 콧방울이 벌어지고, 절정에서 눈을 깜박이지 않는다.
  눈물 없는 슬픔: 눈이 젖지만 흐르지 않고, 입술이 가늘게 떨리고, 고개가 조금 내려간다. 절정 뒤의 여운(늦게 돌아오는 숨)도 쓴다.
- **1–2초마다 작은 사건 하나.** 정지는 '아무도 안 움직인다'가 아니라 '참고 있다'로 쓴다(`he holds still, only his breathing visible`).
- **거리와 서열.** 0.5 m 안은 친밀, 0.5–1.2 m 개인, 1.2–3.5 m 사회, 3.5 m 넘으면 공적 — 거리가 바뀌면 박자가 바뀐 것이다
  (`he closes from 3 m to 0.4 m and drops to a whisper`). 서열이 높은 사람은 머리가 고정되고 움직임이 느리고 시선이 길다. 낮은 사람은 만지작거리고 제 몸을 만진다.
- **여러 명.** 장면 전체가 무슨 사건인지 한 줄(장면의 끝에서 거꾸로 정한다), 인물마다 다른 동기와 카메라에 보이는 몸의 통로 하나,
  반응은 동시에 말고 차례로, 위협 앞에서는 모두 멈춘다.
- **미세 표정 비트(클로즈업 한 컷).** 한 번에 표정 3–4개까지. 비트는 컷이 아니라 한 클로즈업 안의 표정 변화이고, 비트 구간을 합하면 길이(정수 초)다.
  근육을 **말로** 쓴다:

  | 읽히는 것 | 쓰는 말 |
  |---|---|
  | 진짜 웃음 | cheeks lift and crow's feet crease while the lip corners rise |
  | 예의상 웃음 | the mouth smiles, the eyes stay flat |
  | 경멸 | a one-sided smirk, one lip corner pulled up and tight |
  | 슬픔 | inner brows raised and drawn together, mouth corners pulled down |
  | 두려움 | upper lids raised, brows lifted and drawn together, nostrils flaring, lips stretched sideways |
  | 분노 | brows lowered, a hard stare with tightened lids, lips pressed thin |
  | 혐오 | the nose wrinkles, the upper lip lifts, the lower lip pulls down |
  | 웃는데 눈이 배신 | the mouth keeps smiling while the lower lids tighten |
  | 무너지는 침착 | brows lowered, lips pressed together, the chin starting to tremble |
  | 웃으며 떨리는 턱 | eyes smiling while the chin trembles |

  출처는 FACS 번호(AU6+AU12 …)를 쓰지만 BytePlus 에서 번호가 먹는지는 확인되지 않았다 — 말로 쓴다(번호 표는 `official:higgsfield-facs`).
- **보내기 전에 한 번** — 이 문단에 끊이지 않는 행동, 바뀌는 전술, 대사와 다른 속마음, 몸에 드러난 서열이 있는가. `she looks sad` 처럼 읽히면 다시 쓴다.
  더 깊게는 `official:higgsfield-acting`(전술·듣기·몸·실패 유형 15가지).

## 3. 대사와 소리

- **대사는 AUDIO 에, 한 줄씩** — 누가 · 목소리와 감정 · `{정확한 대사}` · 하는 동작 · 얼굴 반응. 그리고 한 번만 말한다고 잠근다:
  `Mina says this line once and nothing else; everyone without a line keeps their mouth closed and relaxed.`
  입만 웃는 반응은 소리 없는 표정이라고 적는다(`a silent half-smile, no laugh`).
- **입 맞추기(립싱크)는 한 컷에 한 얼굴.** 3–8초, MCU 이상으로 가깝게, 카메라는 고정이나 느린 푸시, 대사 중엔 고개를 끄덕이거나 돌리지 않는다.
  두 사람이 주고받으면 컷을 나눈다(숏 / 리버스). 말이 겹치게 쓰지 않는다.
- **대사 길이를 컷에 맞춘다.** 영어 기준 15초에 25–30단어쯤. **짧은 대사를 긴 컷에 두면 남는 시간을 지어낸 웅얼거림으로 채운다**
  (시댄스 2.0 영어 4초 컷에서 6단어 이하 대사가 그랬다는 작은 측정) — 대사를 늘리거나(4초에 8단어 넘게), 컷을 줄이거나, 말 뒤의 침묵을 행동으로
  적는다(`after the line she holds his gaze in silence; only the rain is heard`).
- **말 앞 · 중 · 뒤.** 앞에 숨·침 삼키기, 중간에 힘줄 단어와 그걸 나르는 몸(콧방울·눈동자), 뒤에 잠깐 붙든 시선 → 풀림.
  `A short breath in, one swallow; {I already told you.}, the weight on "told"; her gaze stays on him a beat, then drops.`
  표정은 이마·눈·볼이 맡고, 입술과 턱은 소리가 맞춘다.
- **언어와 목소리.** 영어가 아니면 언어를 적는다 — `She whispers {괜찮아} in Korean.` 또는 대사 앞에 `Dialogue language: Korean.`
  (대사·화면 글자만 그 언어로, 본문은 영어). 낯선 이름은 읽는 법을 적는다. 인물마다 목소리 묘사(음역 · 빠르기 · 억양 · 말버릇)를 정해 모든 컷에 같은 글로.
  말투 지시(`says warmly`, `whispers urgently`)가 없으면 평평하게 읽는다. 가장 무서운 대사는 가장 조용하다. 멈춤은 그 안에서 무언가 일어날 때만 멈춤이다.
- **배경 소리는 층으로.** 주변음 2–3개 + 그 공간의 울림(`a reverberant concrete stairwell`, `the tight hush of a car interior`) + 구체적인 효과음.
  효과음은 행동마다 하나, 그 순간에 맞춰(`as the cup meets the saucer`). 대사가 중요한 컷은 AUDIO 를 가볍게 — 소리를 많이 쌓으면 대사를 덮는다.
  침묵도 사건이다(`two seconds of nothing, then one footstep`).
- **음악.** 없을 때는 들리는 소리 목록을 먼저 쓰고 그다음 `No music.` 한 줄 — 음악 괄호 `( )` 안에 넣지 않고, 금지 목록을 길게 늘이지 않는다.
  있을 때는 악기 · 빠르기 · 분위기 · 들어오고 나가는 때(`(a solo piano enters at 3s and builds to the end)`), 곡·가수 이름은 쓰지 않는다.
  너무 크게 나오면 짧게, 맨 뒤에, `subtle`.
- 화면 속 화면(TV · 폰 · 모니터)이 있으면 거기 무엇이 나오는지 적는다. 화면 밖 목소리는 `offscreen` 으로, 목소리만 나오는 인물도 이름을 적는다.
- 소리 레퍼런스를 넣었으면 무엇을 가져오고 무엇은 가져오지 않는지 — `take the melody from [Audio 1]; the voice is Mina's own`. 넣은 소리를 그대로 쓰려면
  주변음·음악 말을 지우고 `[Audio 1] plays unchanged from start to end.` 더 깊게는 `official:higgsfield-audio`.

## 4. 카메라 — 감정을 닮은 질감, 무빙은 하나

- **카메라 질감은 주인공의 감정을 닮는다.** 무빙을 하나 더 넣는 게 아니라 그 무빙의 결이다.

  | 감정 | 카메라 |
  |---|---|
  | 분노 | 손에 든 채 잘게 떨린다 — 흔들림이 불규칙하고 작다 |
  | 침착 · 통제 | 부드럽게 숨 쉬는 핸드헬드, 또는 고정 |
  | 슬픔 · 약함 | 느리고 낮게, 조금씩 아래로 흘러내린다 |
  | 충격 · 깨달음 | 고정했다가 아주 느린 푸시, 드러나는 순간 멈춘다 |
  | 무너짐 | 천천히 물러나 넓게 — 혼자 남은 공간 |

  감정이 컷 안에서 바뀌면 처음 · 바뀔 때 · 끝 세 구간으로 흔들림 · 흐름 · 푸시 속도만 바꾼다
  (`while he argues the frame twitches; over the last two seconds the sway settles as he goes quiet`).
- **두 사람 장면은 꼴부터.** 쫓기 — 쫓기는 사람이 화면 앞쪽 / 대결 — 우세한 쪽 낮은 자리에서, 한쪽이 연달아 이기지 않게 / 충돌 — 느린 준비, 빠른 타격,
  느린 여파 / 맞섬 — 어깨 너머 타이트하게, 힘이 넘어가는 순간에만 축을 넘는다 / 심문 — 묻는 사람을 낮은 앵글로 / 협상 — 대칭, 같은 크기.
  정하는 순서는 사용자 지시 > 장면의 꼴 > 감정. 눈에 띄는 선택이면 카드에 한 줄로 알린다.
- **무빙은 물리로.** 받침(고정 · 돌리 · 핸드헬드 · 크레인 · 짐벌) + 움직임 **하나** + 총 거리와 시간 + 속도(율이나 비유 — `about 6° per second`,
  `a 10% change in scale over the whole shot`, `like a leaf settling in still air`). 카메라가 실제로 움직이면 push in · pull back · track · crane 이다.
  `zoom` 은 화각이 바뀌는 것이라 OPTICS 의 화각 고정과 부딪힌다 — 정말 줌이면 OPTICS 에 시작·끝 화각을 쓴다. 팬(제자리에서 돈다)과
  글라이드(옮겨 간다)를 구별한다. 움직임 둘은 구간을 나눠 차례로, 아니면 컷.
- **컷의 문법.** 컷 다음 첫 문장에 누가 어디서 어느 쪽을 보는지, 카메라가 앞 컷에서 어디로 옮겼는지. 화면 밖으로 나간 사람은 그 컷에서 다시 나오지 않는다.
  인서트는 고정, 누구의 무엇인지(`static insert: HER thumb on the latch`). 따로 만든 클립은 같은 손짓 하나로 잇고(매치 컷), 180° 선을 지킨다.
- **샷 길이(정수 초, 한 컷 2초 이상).** 설정 · 인서트 2초, 대사 한 줄 3–7초, 말없는 반응 5–10초, 감정이 크게 움직이는 클로즈업 8–15초.
  반응을 짧은 칸에 밀어 넣으면 서두른다.
- **렌즈와 심도.** 감정 클로즈업 29°·18° 얕은 심도, 대화 · 투샷 47° 중간, 공간 63° 깊게, 인서트는 아주 얕게. 인서트 · 타이트 클로즈업은 처음부터 끝까지
  초점을 고정하고, 초점이 옮겨 가면 계기 → 옮김 → 상태로(`as he sets the bottle down, focus moves from the bottle to her face and holds there`).
- **자주 쓰는 무빙** — 숫자는 자리표, 장면에 맞게:

  | 무빙 | 쓸 때 | 쓰는 말 |
  |---|---|---|
  | 푸시인 | 가까워짐 · 깨달음 · 긴장 | `slow push from a medium shot into a tight close-up over 8 seconds, eye level` |
  | 풀백 | 고립 · 떠남 · 무너지는 사람에게 공간 | `draws back 1.5 m over 6 seconds, from a medium close-up to a wide; she stays still` |
  | 옆 트래킹 | 옆으로 가는 행동 | `tracks left beside the runner, 2 m off, at his pace` |
  | 제자리 팬 | 시선을 끌고 가기 | `the camera holds its position and pans with him across the room` |
  | 크레인 | 규모 드러내기 · 손에서 거리로 | `rises from her hands to the whole street over 8 seconds` |
  | 바로 위 | 약함 · 감시 · 판결 | `locked directly overhead, looking straight down` |
  | 반원 돌기 | 전환점 · (한 바퀴면) 고립 | `a gentle half-circle around her at eye level, constant radius, over 10 seconds` |
  | 핸드헬드 | 사실감 · 가까움 · 혼란 | `handheld follow with a light, restrained shake` |
  | 고정 | 분위기 · 무표정 코미디 · 제품 · 대화 | `tripod-locked frame; nothing in the camera moves` |
  | 휩 팬 | 전환 · 빠른 행동(1초 이상 잡는다) | `whip pan from the thief across to the officer` |
  | 크래시 줌 | 충격 · 세부(드라마 · 일상물에는 쓰지 않음) | `a sudden crash zoom from wide into an extreme close-up as the blow lands` |
  | 낮은 추격 | 추격 · 속도 | `low behind him, matching his sprint` |
  | 초점 옮기기 | 앞뒤 면 사이로 관심 이동 | 위 렌즈 줄의 문장 |
  | 기울인 앵글 | 불안 · (핸드헬드와) 공포 | `the horizon slightly canted, held` |
  | 시점 숏 | 몰입 · 공포 | `POV: her hands shove the heavy door open` |

  더 많은 이름과 쓰임은 `official:higgsfield-camera` · `official:cinematic-video-prompt/01-camera-angles-and-movement` — 프리셋 이름 대신 움직임을 말로 쓴다.

## 5. 빛과 색

- **빛은 물리 사건으로.** 광원의 자리 · 반사 · 그림자 모양 · 공기의 밀도 — `moody` 대신
  `the key comes from screen-left about 30° above her eyeline; a warm bounce off the floorboards softens the shadow under her jaw`.
- **밤은 화면 속 광원으로.** 그냥 `night` 이라고 쓰면 낮 화면을 파랗게 칠한 '밝은 밤'이 나온다. 바깥 밤은 장면 안의 불빛(헤드라이트 · 브레이크등 ·
  간판 · 계기판)만으로 밝히고 하늘은 거의 검다고 적는다. 실내 밤은 실내등 · 화면이 색을 정한다.
- **강조색 하나를 아껴 둔다.** 차분한 그레이드에서 이야기에 중요한 물건 하나만 채도 높은 색(시간으로도 아낀다 — 반전 장면에만 노을빛).
  화면의 색은 주색 60 · 보조색 30 · 강조 10. 장면마다 세 색을 이름으로, 룩이 정해졌으면 헥스로.
- **STYLE 은 짧게, 자세한 건 제 블록에.** STYLE 은 기준 하나 + 보조 1–2개(`Photoreal, 1970s film texture with fine grain, real-time speed.`).
  세부 룩은 OPTICS · LIGHTING · COLOR GRADE 에. 시대는 연도보다 재질과 빛으로(1980년대 사무실 = 깜박이는 형광등 · 베이지 플라스틱 · 브라운관 빛).
- **분위기 말은 재질 + 빛 + 역할로 바꾼다.** 차가운 스릴러 = 채도 낮춘 청록과 주황, 따뜻한 회상 = 호박색 · 낮은 대비, 공포 = 병든 녹황 · 눌린 검정 —
  각각 무엇이 그 색이고 빛이 어디서 오는지로 쓴다. 조명 패턴: 렘브란트(초상 드라마) · 스플릿(이중성) · 림(분리) · 키아로스쿠로(강한 드라마).
  어휘는 `official:higgsfield-style` · `official:cinematic-video-prompt/02-lighting` · `/05-style-color-mood`.

## 6. 여러 컷 · 이어지는 클립

- **찍기 전에 장면 점검**(이야기 작업) — 목표 · 장애물 · 전술 · 반전 · 가치 변화(관객의 판단이 무엇에서 무엇으로)를 한 줄씩. 가치 변화를 말할 수 없는
  장면은 깨끗하게 나와도 편집에서 죽는다. 계획에만 두고 프롬프트에는 쓰지 않는다(`official:higgsfield-scene-engine`).
- **서술형이 기본, 타임코드는 필요할 때.** 하나로 이어지는 사건은 흐르는 문장으로, 따로 떨어진 행동의 정확한 때가 중요하면(변신 · 여러 단계 액션 · 박자)
  정수 초 타임코드로. 2.5 긴 원테이크는 단계 = 처음 상태 → 주 사건 하나 → 끝 상태이고, 다음 단계는 그대로인 것부터 다시 적는다
  (`Stage 2: the same clothes, the parcel still in her left hand.`).
- **한 프롬프트에 묶는 기준.** 같은 인물 · 같은 장소 · 감정 한 덩어리일 때만. 장소 · 인물 · 셋업이 바뀌거나, 인서트거나, 한도를 넘으면 나눈다
  (강한 행동 2개 · 카메라 무빙 2개 · 주요 인물 3명 · 복잡한 VFX 1개 · 장소 변화 1번을 넘을 때). 4–8초 행동 하나, 8–12초 행동 + 드러남, 12–15초 박자 2–3.
  이어지는 감정 붕괴 하나는 쪼개지 않는다.
- **단조로움 점검.** 샷 크기 + 무빙 줄만 읽어 같은 게 세 번 연달아 나오지 않게.
- **여러 인물 고정.** 인물마다 이름 + 눈에 띄는 특징 · 화면 자리(삼분할 + x/y % + 화면을 차지하는 %) · 앞뒤 층 · 몸 방향 · 시선 · 닿는 곳 · 지금 상태,
  그다음 서로의 거리 · 시선 · 엇갈리는 규칙 · 빈 공간. 컷마다 다시 적는다. 위에서 본 지도로 계획하고 프롬프트에는 블로킹 문장만 넣는다
  (`official:higgsfield/templates/seedance/multi-character-anchor` · `top-down-map`).
- **장면 지리.** 사람 없는 평면 — 기준물 · 화면 왼쪽과 오른쪽 · 카메라가 서는 쪽 · 넘지 않는 선 — 을 LOCATION MAP 에 쓰고 그 장면의 모든 컷에 같은 글로.
  문 · 복도는 카메라 자리와 화면 진행 방향까지 적는다(`she travels screen-left to screen-right, locked`).
- **앞 클립에서 이어 갈 때.** 계획이 아니라 **실제로 받은 끝 프레임**에서 시작한다. 끝난 박자는 끝났다고 적고, 한 클립은 박자 하나만. 속도 · 카메라 단계
  (`opens mid-dolly`) · 소품 상태 · 소리 단계 · 화면 방향을 글로 넘긴다 — 그림 한 장은 속도를 못 나른다. 생김새는 흘러간 끝 프레임이 아니라
  **원래 레퍼런스(엘리먼트)**로 다시 잡는다. 연장은 두 번까지, 그다음은 원래 레퍼런스에서 새로 시작한다.
- 나간 인물은 나간 쪽과 마지막 모습을 적어 두었다가, 다시 들어올 때 맞춘다.

## 7. 상황별

- **걷기** — `heel lands first, strict left-right alternation, one foot always on the ground`. 나란히 걸으면
  `shoulder to shoulder on one depth line, both heads the same size`. 컷 사이 속도는 양쪽 프롬프트에 같은 km/h.
- **싸움** — 실제 속도(원치 않으면 `real-time speed, no slow motion`), 동작마다 이름과 방향, 손 · 발 인서트, 주요 동작은 한 타임라인에,
  이미 진행 중인 동작에서 시작한다. 빠른 동작이 녹아내리면 슬로모션으로 뽑아 편집에서 빠르게 돌리는 방법도 있다.
- **크기** — 화면 안에 사람 + 계산이 맞는 기준물(`its wingspan is as wide as twenty people lying head to toe`). 확실하지 않으면 큰 것을 더 작게.
- **변신 · 전환** — 중간 지점에 무엇이 보이는지 적는다. 없으면 툭 끊기거나 뭉개진다. 처음 → 계기 → 중간 → 끝.
- **춤** — 동작을 박자마다 쉬운 말로(발 · 방향 · 손), 춤 용어는 안 먹는다. 박자에 맞춘다는 문장 하나, 한 클립에 둘까지.
- **반사** — 거울 · 물웅덩이 · 칼날의 반사는 자주 틀린다. 반사가 이야기의 핵심이면 반사만 따로 한 컷.
- **첫 · 끝 프레임 모드** — 첫 그림에 없는 것은 없다고, 어떻게 들어오는지 적는다(`the photo is not on the fridge at first; it rises into frame in her hand from below`).
  그대로인 것은 이름으로 잠근다(`the magnet stays on the fridge door throughout; only the photo moves`). 본문은 움직임과 카메라만.
- **블록아웃 영상 레퍼런스**(블록아웃 스튜디오의 회색 MP4 를 `[Video 1]` 로) — 거칠면
  `[Video 1] is a coarse blockout reference. It provides only the motion paths, subject blocking, camera movement and cuts; do not use its grey materials, shapes or scene.`
  그리고 블록아웃의 덩어리마다 누구 · 무엇인지 짝지어 적고 인물 · 장소 · 스타일은 따로 정한다. 정교하면 구조 · 동작 · 카메라 · 컷을 지키되
  `do not use its grey materials`. 경로 선 · 축 · 카메라 표시는 지우고 넣는다. 일부만 쓰면 몇 초부터 몇 초인지(정수).
- **영상 → 영상(편집)** — 원본의 생김새 · 연기 · 구도 · 렌즈 · 카메라를 그대로, 바꿀 것 하나만. 새로 넣은 것은 원본과 섞이게(빛 번짐 · 닿는 그림자 · 시차).
- **필터 거절** — 실존 인물 이름은 체형 · 특징으로, 브랜드는 생김새로, 폭력은 결과 · 긴장 · 물리로, 선정성 오탐이면 신체 세부와 관능적 형용사를 뺀다.
  지어낸 생물은 `an original design`. 나이 단어(boy · girl · child · teen …)를 피하라는 건 힉스필드 필터 대책이다 — BytePlus 에선 확인되지 않았으니,
  걸리면 역할 · 옷 · 체형으로 바꿔 다시 보낸다.

## 8. 장르별 시작 틀 — 한 줄 꼴

| 장르 | 꼴 |
|---|---|
| 액션 추격 | 대상과 옷 + 젖은 네온 공간 → 카메라 관계 하나(뒤에서 낮게, 같은 속도) → 장애물 하나와 대응 하나 → 절정, 그레이드는 두 색 |
| 제품 | 재질 · 색 · 형태(브랜드 없이) → 이름 있는 표면 + 광원 하나 → 처음부터 끝까지 적은 카메라 경로 하나 → 접사 순간(따르기 · 김) → 사람 손길 → 소리 하나 |
| 공포 | 일상 동작으로 거짓 평온 → 틀린 것 하나 → 그쪽으로 느린 푸시 → 알아차림. 피보다 불길함 |
| 패션 | 얼굴 · 체형 + 머리부터 발끝까지 재질별 옷 + 소품 하나 → 느린 걸음 · 돌기 · 멈춤 → 대상과 반대로 가는 카메라 → 이름 있는 단단한 빛 하나 |
| SF VFX | 낡은 세트(그 빛이 팔레트를 정한다) → 물리가 분명한 행동(무중력 손잡이) → 위험 물체 → 행동 하나가 VFX 하나로 터짐. VFX 하나, 물리 세계 하나 |
| 인물 소개 | 보이는 특징 + 알아볼 표식 하나 → 성격이 드러나는 작은 행동 → 미디엄 와이드에서 MCU 로 느린 돌리 → 방향 있는 빛. 감정 하나 |
| 풍경 설정 | 시간 + 장소 + 잴 수 있는 규모 → 다가오거나 바뀌는 것 → 그 변화에 묶인 카메라 → 보상 순간. 가만한 묘사만 있으면 사진이 된다 |
| 코미디 | 평범한 설정 → 무표정 박자(마시고 · 깜박이고 · 내려놓기) → 한 줄 펀치 → 앞은 태연, 뒤는 난장. 고정 미디엄, 밝은 키, 개그 하나 |
| 로맨스 | 공간이 일한다 → 함께한 시간을 암시하는 디테일 둘 → 멈춤 → 다정한 몸짓 하나, 카메라는 천천히 돈다. 눈빛 말고 몸의 행동 |
| 댄스 | 대비되는 옷 + 빈 공간 + 빛 하나 → 강약(느린 팔 · 폭발하는 회전 · 바닥) → 강도에 따라 조여 오는 카메라 → 절정에서 카메라 전환. 동작은 쉬운 말로, 둘까지 |

드라마 = 공간 → 상태가 드러남 → 감정 박자 / 다큐 = 공간 → 맥락 속 대상 → 지켜본 행동 / 변신 = 전 → 계기 → 중간 → 후.
예시 원문은 `official:higgsfield-recipes` · `official:higgsfield/templates/<01~10 이름>` · `official:higgsfield/prompt-examples` — 꼴만 가져오고 형식은 우리 블록으로 쓴다.

## 9. 결과가 이상할 때 — 증상 → 원인 → 고치기

| 증상 | 흔한 원인 | 고치기 |
|---|---|---|
| 흐리고 떨리고 녹아내린다 | 5초에 행동 박자가 셋 이상, 한 문장에 여러 축 | 박자를 컷으로 나누고 문장 하나에 축 하나 — 줄이지 말고 정리 |
| 카메라가 어지럽다 | 무빙이 둘 이상 | 주 무빙 하나, 나머지는 컷 |
| 시키지 않은 컷이 생긴다 | 컷 규칙 없음, 원테이크에 타임코드 | 1절 1의 컷 문장 |
| 레퍼런스와 다른 사람 | 글이 그림과 다르게 묘사, 컷마다 묘사가 다름 | 그림과 부딪히는 글부터 지운다 — 이름 + 특징 하나만 |
| 첫 프레임에서 거의 안 움직인다 | 글이 그림을 다시 묘사 | 바뀌는 것만 — 무빙 하나, 움직임 종류, 공기의 움직임 |
| 동작이 뻣뻣하다 | 의도 · 물리가 없음 | 정도 부사 + 물리 결과, 모으기 → 터짐 → 여파 |
| 손은 움직이는데 물건이 그대로 | 다루는 과정이 빠짐 | 1절 3의 원인 사슬, 아니면 두 상태 + 소리 |
| 갔다가 되돌아온다 | 남는 시간을 채움 | 같은 방향 2–3 동작, 이름 붙은 끝 |
| 결과가 나오기 전에 끝난다 | 끝 상태가 없음 | 눈에 보이는 완료 사실, 다음 컷은 결과에서 시작 |
| 사람 · 손 · 소품이 늘어난다 | 개수 · 손 주인이 없음 | 인물 수를 첫 줄에, 손 개수와 들어오는 쪽, `exactly one … throughout` |
| 세트에 없는 방 · 문이 생긴다 | 세트 잠금 없음 | 1절 5, 역방향은 없는 것을 이름으로 |
| 웅얼거리거나 대사를 또 한다 | 짧은 대사에 긴 컷, 한 번 잠금 없음 | 3절 — 한 번만, 다른 입은 다문다, 길이를 맞춘다 |
| 대사 입이 안 맞는다 | 고개 움직임, 긴 컷, 얼굴 여럿 | 한 얼굴, MCU, 고정, 3–8초 |
| 넣은 소리가 바뀐다 | 주변음 · 음악 말 | 그 말을 지우고 `[Audio 1] plays unchanged from start to end` |
| 클립이 처음부터 다시 하거나 뒷 박자를 당겨 온다 | 계획에서 씀, 끝난 박자 표시 없음 | 받은 끝 프레임에서, 끝난 것은 끝났다고, 뒷 박자는 지운다 |
| 이을수록 얼굴이 변한다 | 연장을 거듭함 | 원래 레퍼런스로 다시, 연장은 두 번까지 |
| 잇는 곳에서 멈추거나 방향이 뒤집힌다 | 그림은 속도 · 방향을 못 나른다 | 속도 · 방향 · 카메라 단계 · 화면 방향을 글로 |
| 그림이 엉뚱한 역할로 샌다 | 역할 · 제외 줄 없음 | 레퍼런스마다 쓸 것과 뺄 것을 한 줄에 |
| 군중이 복제 인간 | 한 사람 그림 + '모두 다르게' 글 | 서로 다른 4–5명이 선 다양성 시트를 레퍼런스로(`a variety reference: four different people`) |
| 엉뚱한 버튼을 누른다 | 동작이 몸에 고정 안 됨 | 빨간 화살표를 그린 소품 그림 사본, 한 번 잠금 ×3 |
| 색이 화면 전체로 번진다 | 색 이름만 씀 | 1절 6의 배분 + 자기 점검 문장(`if the frame turns yellow, the frame is wrong`) |
| 화면 전체가 뭉개진다 | 맨말 품질어(grain · hazy · blurry) | 어느 면이 언제, 안개는 % · m |
| 밤인데 낮처럼 밝다 | `night` 한 단어 | 화면 속 광원만, 하늘은 거의 검게(5절) |

더 자세한 표는 `official:higgsfield-troubleshoot` · `official:higgsfield-seedance/FAILURE-MODES` · `official:higgsfield/skills/shared/house-rulings`.

## 10. 출처와 다르게 쓰는 곳

| 출처 | 우리 |
|---|---|
| 0.3–0.5초 인서트, `1.5s`, `0.8s whip` | 정수 초, 한 컷 2초 이상(박자 편집만 예외) — 짧은 인서트는 2초로 잡거나 무빙 안에 넣는다 |
| 본문에 `16:9`, `24 fps`, `4K`, `Duration: 10s` | 비율 · 길이 · 해상도는 설정으로 — 본문의 숫자는 설정을 바꾸지 못하고, 설정과 다르면 모순이 된다(보내기 스크립트가 짚는다). 디테일을 말하는 룩 문장(`8K capture detail — pores …`)은 둔다 |
| `@Image1` · `@loc_cave` | `[Image N]` · `@{name}`(지침 4단계) |
| 전신 칸의 머리를 지운 시트, 패널을 잘라 낸 그림 | 시드림 원본 시트 그대로 — 손댄 시트는 BytePlus 실사 인물 필터에 걸렸다 |
| 렌즈 말은 플레이트에 굽고 다시 쓰지 말라 | OPTICS 블록을 매 프롬프트에(화각 · 거리 · 높이). 렌즈 성격 말은 프로젝트마다 정한다 |
| 30–100단어, 512자 | 우리 블록 형식으로 자세하게(5초 한 컷도 2,500자 넘게) |
| 부정어 꼬리를 줄줄이(`NO CGI. NO BGM.`) | 모델의 기본 실패를 막는 짧은 부정만, 긍정 사실 다음에(1절 6) |
| '시네마틱' 대신 감독 이름 | 감독 · 작품 · 장비 이름은 쓰지 않는다 — 빛과 렌즈를 말로 |
| 나이 단어 금지 | 힉스필드 필터 대책 — BytePlus 에선 확인 안 됨, 걸리면 바꾼다 |
| 원테이크의 초 단위 박자가 컷을 부른다 / 안 부른다(출처 안에서 엇갈림) | 타임코드는 쓰되 1절 1의 원테이크 문장을 같이 |

출처: O-Side Media [higgsfield-ai-prompt-skill](https://github.com/OSideMedia/higgsfield-ai-prompt-skill)(MIT, © 2026 O-Side Media) ·
Rylai [cinematic-video-prompt-skill](https://github.com/Rylaispirit/cinematic-video-prompt-skill)(MIT) — 규칙만 골라 우리 말로 옮겼다.
원문은 `official:higgsfield-*` · `official:higgsfield/…` · `official:cinematic-video-prompt/…`(매일 동기화, 목록은 `freewill_guide("versions")` 의 커뮤니티 표).
