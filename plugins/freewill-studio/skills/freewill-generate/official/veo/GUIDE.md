<!-- 원본: https://ai.google.dev/gemini-api/docs/veo.md.txt · Google · CC BY 4.0 (Google for Developers 문서) — sync/sync.mjs 가 매일 받아 프롬프트 절만 뽑은 것. 손으로 고치지 말 것. -->

## Limitations  {% id="limitations" %}

* **Multi-video prompting:** Referencing or reasoning across multiple videos is not currently supported. Attempting multi-video prompting may result in degraded model performance or unexpected outputs.
* **Language support:** English (EN) is fully supported, but other languages have not been evaluated, so they may work but results can vary.
* **Request latency:** Min: 11 seconds; Max: 6 minutes (during peak hours).
* **Regional limitations:** In EU, UK, CH, MENA locations, `allow_adult` is
  the only allowed value for `personGeneration`.
* **Video retention:** Generated videos are stored on the server for 2 days,
  after which they are removed. To save a local copy, you must download your
  video within 2 days of generation. Extended videos are treated as newly
  generated videos.
* **Watermarking:** Videos created by Veo are watermarked using [SynthID](https://deepmind.google/technologies/synthid/), our tool for watermarking
  and identifying AI-generated content. Videos can be verified using the
  [SynthID](https://deepmind.google/science/synthid/) verification platform.
* **Safety:** Generated videos are passed through safety filters and
  memorization checking processes that help mitigate privacy, copyright and
  bias risks.
* **Audio error:** Veo 3.1 will sometimes block a video from generating
  because of safety filters or other processing issues with the audio. You
  will not be charged if your video is blocked from generating.

## Veo prompt guide  {% id="prompt-guide" %}

This section contains examples of videos you can create using Veo, and shows you
how to modify prompts to produce distinct results.

### Safety filters  {% id="safety-filters" %}

Veo applies safety filters across Gemini to help ensure that
generated videos and uploaded photos don't contain offensive content.
Prompts that violate our [terms and guidelines](/docs/usage-policies#abuse-monitoring) are blocked.

### Prompt writing basics  {% id="basics" %}

Good prompts are descriptive and clear. To get the most out of Veo, start with
identifying your core idea, refine your idea by adding keywords and modifiers,
and incorporate video-specific terminology into your prompts.

The following elements should be included in your prompt:

* **Subject**: The object, person, animal, or scenery that you want in your
  video, such as *cityscape*, *nature*, *vehicles*, or *puppies*.
* **Action**: What the subject is doing (for example, *walking*, *running*, or
  *turning their head*).
* **Style**: Specify creative direction using specific film
  style keywords, such as *sci-fi*, *horror film*, *film noir*, or animated
  styles like *cartoon*.
* **Camera positioning and motion**: \[Optional\] Control the camera's location
  and movement using terms like *aerial view*, *eye-level*, *top-down shot*,
  *dolly shot*, or *worms eye*.
* **Composition**: \[Optional\] How the shot is framed, such as *wide shot*,
  *close-up*, *single-shot* or *two-shot*.
* **Focus and lens effects**: \[Optional\] Use terms like *shallow focus*,
  *deep focus*, *soft focus*, *macro lens*, and *wide-angle lens* to achieve
  specific visual effects.
* **Ambiance**: \[Optional\] How the color and light contribute to the scene,
  such as *blue tones*, *night*, or *warm tones*.

#### More tips for writing prompts  {% id="more-tips" %}

* **Use descriptive language**: Use adjectives and adverbs to paint a clear
  picture for Veo.
* **Enhance the facial details**: Specify
  facial details as a focus of the photo like using the word *portrait* in
  the prompt.

*For more comprehensive prompting strategies, visit [Introduction to
prompt design](/docs/prompting-strategies).*

### Prompting for audio  {% id="audio" %}

You can provide Veo with cues for sound effects, ambient noise, and dialogue.
The model captures the nuance of these cues to generate a synchronized
soundtrack.

* **Dialogue:** Use quotes for specific speech. (Example: "This must be the
  key," he murmured.)
* **Sound Effects (SFX):** Explicitly describe sounds. (Example: tires
  screeching loudly, engine roaring.)
* **Ambient Noise:** Describe the environment's soundscape. (Example: A faint,
  eerie hum resonates in the background.)

These videos demonstrate prompting Veo 3's audio generation with increasing
levels of detail.

| Prompt | Generated output |
| :--- | :--- |
| **More detail (Dialogue and ambience)** A wide shot of a misty Pacific Northwest forest. Two exhausted hikers, a man and a woman, push through ferns when the man stops abruptly, staring at a tree. Close-up: Fresh, deep claw marks are gouged into the tree's bark. Man: (Hand on his hunting knife) "That's no ordinary bear." Woman: (Voice tight with fear, scanning the woods) "Then what is it?" A rough bark, snapping twigs, footsteps on the damp earth. A lone bird chirps. |  |
| **Less detail (Dialogue)** Paper Cut-Out Animation. New Librarian: "Where do you keep the forbidden books?" Old Curator: "We don't. They keep us." |  |

{% button href="https://deepmind.google/models/veo/" variant="primary" %}Try Veo{% /button %}

### Prompting with reference images  {% id="use-reference-images" %}

You can use one or more images as inputs to guide your generated videos, using
Veo's [image-to-video](/docs/veo#generate-from-images)
capabilities. Veo uses the input image as the initial frame. Select an image
closest to what you envision as the first scene of your video to animate
everyday objects, bring drawings and paintings to life, and add movement and
sound to nature scenes.

| Prompt | Generated output |
| :--- | :--- |
| **Input image (Generated by Nano Banana)** A hyperrealistic macro photo of tiny, miniature surfers riding ocean waves inside a rustic stone bathroom sink. A vintage brass faucet is running, creating the perpetual surf. Surreal, whimsical, bright natural lighting. |  |
| **Output Video (Generated by Veo 3.1)** A surreal, cinematic macro video. Tiny surfers ride perpetual, rolling waves inside a stone bathroom sink. A running vintage brass faucet generates the endless surf. The camera slowly pans across the whimsical, sunlit scene as the miniature figures expertly carve the turquoise water. |  |

Veo 3.1 lets you [reference images](/docs/veo#reference-images) or
ingredients to direct your generated
video's content. Provide up to three asset images of a single person, character,
or product. Veo preserves the subject's appearance in the output video.

| Prompt | Generated output |
| :--- | :--- |
| **Reference image (Generated by Nano Banana)** A deep sea angler fish lurks in the deep dark water, teeth bared and bait glowing. |  |
| **Reference image (Generated by Nano Banana)** A pink child's princess costume complete with a wand and tiara, on a plain product background. |  |
| **Output Video (Generated by Veo 3.1)** Create a silly cartoon version of the fish wearing the costume, swimming and waving the wand around. |  |

Using Veo 3.1, you can also generate videos by specifying the [first and last
frames](/docs/veo#using-first-and-last-video-frames) of the video.

| Prompt | Generated output |
| :--- | :--- |
| **First image (Generated by Nano Banana)** A high quality photorealistic front image of a ginger cat driving a red convertible racing car on the French riviera coast. |  |
| **Last image (Generated by Nano Banana)** Show what happens when the car takes off from a cliff. |  |
| **Output Video (Generated by Veo 3.1)** Optional |  |

This feature gives you precise control over your shot's composition by letting
you define the starting and ending frame. Upload an image or use a frame from a
previous video generation to make sure your scene begins and concludes exactly
as you envision it.

### Prompting for extension  {% id="extend-prompt" %}

To [extend](/docs/veo#extending-veo-videos) your Veo-generated
video with Veo 3.1 (not available for Veo 3.1 Lite), use the video as an input
along with an optional text prompt. Extend finalizes the final second or 24
frames of your video and continues the action.

Note that voice is not able to be effectively extended if it's not present in
the last 1 second of video.

| Prompt | Generated output |
| :--- | :--- |
| **Input video (Generated by Veo 3.1)** The paraglider takes off from the top of the mountain and starts gliding down the mountains overlooking the flower covered valleys below. |  |
| **Output Video (Generated by Veo 3.1)** Extend this video with the paraglider slowly descending. |  |

### Example prompts and output  {% id="examples" %}

This section presents several prompts, highlighting how descriptive details can
elevate the outcome of each video.

#### Icicles  {% id="icicles" %}

This video demonstrates how you can use the elements of
[prompt writing basics](/docs/veo#basics) in your prompt.

| Prompt | Generated output |
| :--- | :--- |
| Close up shot (composition) of melting icicles (subject) on a frozen rock wall (context) with cool blue tones (ambiance), zoomed in (camera motion) maintaining close-up detail of water drips (action). |  |

#### Man on the phone  {% id="man-on-the-phone" %}

These videos demonstrate how you can revise your prompt with increasingly
specific details to get Veo to refine the output to your liking.

| Prompt | Generated output |
| :--- | :--- |
| **Less detail** The camera dollies to show a close up of a desperate man in a green trench coat. He's making a call on a rotary-style wall phone with a green neon light. It looks like a movie scene. |  |
| **More detail** A close-up cinematic shot follows a desperate man in a weathered green trench coat as he dials a rotary phone mounted on a gritty brick wall, bathed in the eerie glow of a green neon sign. The camera dollies in, revealing the tension in his jaw and the desperation etched on his face as he struggles to make the call. The shallow depth of field focuses on his furrowed brow and the black rotary phone, blurring the background into a sea of neon colors and indistinct shadows, creating a sense of urgency and isolation. |  |

#### Snow leopard  {% id="snow-leopard" %}

| Prompt | Generated output |
| :--- | :--- |
| **Simple prompt:** A cute creature with snow leopard-like fur is walking in winter forest, 3D cartoon style render. |  |
| **Detailed prompt:** Create a short 3D animated scene in a joyful cartoon style. A cute creature with snow leopard-like fur, large expressive eyes, and a friendly, rounded form happily prances through a whimsical winter forest. The scene should feature rounded, snow-covered trees, gentle falling snowflakes, and warm sunlight filtering through the branches. The creature's bouncy movements and wide smile should convey pure delight. Aim for an upbeat, heartwarming tone with bright, cheerful colors and playful animation. |  |

### Examples by writing elements  {% id="element-examples" %}

These examples show you how to refine your prompts by each basic element.

#### Subject and context  {% id="subject" %}

Specify the main focus (subject) and the background or environment (context).

| Prompt | Generated output |
| :--- | :--- |
| An architectural rendering of a white concrete apartment building with flowing organic shapes, seamlessly blending with lush greenery and futuristic elements |  |
| A satellite floating through outer space with the moon and some stars in the background. |  |

#### Action  {% id="action" %}

Specify what the subject is doing (e.g., walking, running, or turning their
head).

| Prompt | Generated output |
| :--- | :--- |
| A wide shot of a woman walking along the beach, looking content and relaxed towards the horizon at sunset. |  |

#### Style  {% id="style" %}

Add keywords to steer the generation toward a specific aesthetic (e.g., surreal,
vintage, futuristic, film noir).

| Prompt | Generated output |
| :--- | :--- |
| Film noir style, man and woman walk on the street, mystery, cinematic, black and white. |  |

#### Camera motion and composition  {% id="camera-motion" %}

Specify how the camera moves (POV shot, aerial view, tracking drone view) and
how the shot is framed (wide shot, close-up, low angle).

| Prompt | Generated output |
| :--- | :--- |
| A POV shot from a vintage car driving in the rain, Canada at night, cinematic. |  |
| Extreme close-up of a an eye with city reflected in it. |  |

#### Ambiance  {% id="ambiance" %}

Color palettes and lighting influence the mood. Try terms like "muted orange
warm tones," "natural light," "sunrise," or "cool blue tones."

| Prompt | Generated output |
| :--- | :--- |
| A close-up of a girl holding adorable golden retriever puppy in the park, sunlight. |  |
| Cinematic close-up shot of a sad woman riding a bus in the rain, cool blue tones, sad mood. |  |

### Aspect ratios  {% id="aspect-ratios" %}

Veo lets you specify the aspect ratio for your video.

| Prompt | Generated output |
| :--- | :--- |
| **Widescreen (16:9)** Create a video with a tracking drone view of a man driving a red convertible car in Palm Springs, 1970s, warm sunlight, long shadows. |  |
| **Portrait (9:16)** Create a video highlighting the smooth motion of a majestic Hawaiian waterfall within a lush rainforest. Focus on realistic water flow, detailed foliage, and natural lighting to convey tranquility. Capture the rushing water, misty atmosphere, and dappled sunlight filtering through the dense canopy. Use smooth, cinematic camera movements to showcase the waterfall and its surroundings. Aim for a peaceful, realistic tone, transporting the viewer to the serene beauty of the Hawaiian rainforest. |  |
