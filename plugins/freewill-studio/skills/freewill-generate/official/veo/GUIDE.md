<!-- 원본: https://ai.google.dev/gemini-api/docs/veo.md.txt · Google · CC BY 4.0 (Google for Developers 문서) — sync/sync.mjs 가 매일 받아 프롬프트 절만 뽑은 것. 손으로 고치지 말 것. -->

## Limitations

- **Multi-video prompting:** Referencing or reasoning across multiple videos is not currently supported. Attempting multi-video prompting may result in degraded model performance or unexpected outputs.
- **Language support:** English (EN) is fully supported, but other languages have not been evaluated, so they may work but results can vary.
- **Request latency:** Min: 11 seconds; Max: 6 minutes (during peak hours).
- **Regional limitations:** In EU, UK, CH, MENA locations, `allow_adult` is the only allowed value for `personGeneration`.
- **Video retention:** Generated videos are stored on the server for 2 days, after which they are removed. To save a local copy, you must download your video within 2 days of generation. Extended videos are treated as newly generated videos.
- **Watermarking:** Videos created by Veo are watermarked using [SynthID](https://deepmind.google/technologies/synthid/), our tool for watermarking and identifying AI-generated content. Videos can be verified using the [SynthID](https://deepmind.google/science/synthid/) verification platform.
- **Safety:** Generated videos are passed through safety filters and memorization checking processes that help mitigate privacy, copyright and bias risks.
- **Audio error:** Veo 3.1 will sometimes block a video from generating because of safety filters or other processing issues with the audio. You will not be charged if your video is blocked from generating.

## Veo prompt guide

This section contains examples of videos you can create using Veo, and shows you
how to modify prompts to produce distinct results.

### Safety filters

Veo applies safety filters across Gemini to help ensure that
generated videos and uploaded photos don't contain offensive content.
Prompts that violate our [terms and guidelines](https://ai.google.dev/gemini-api/docs/usage-policies#abuse-monitoring) are blocked.

### Prompt writing basics

Good prompts are descriptive and clear. To get the most out of Veo, start with
identifying your core idea, refine your idea by adding keywords and modifiers,
and incorporate video-specific terminology into your prompts.

The following elements should be included in your prompt:

- **Subject** : The object, person, animal, or scenery that you want in your video, such as *cityscape* , *nature* , *vehicles* , or *puppies*.
- **Action** : What the subject is doing (for example, *walking* , *running* , or *turning their head*).
- **Style** : Specify creative direction using specific film style keywords, such as *sci-fi* , *horror film* , *film noir* , or animated styles like *cartoon*.
- **Camera positioning and motion** : \[Optional\] Control the camera's location and movement using terms like *aerial view* , *eye-level* , *top-down shot* , *dolly shot* , or *worms eye*.
- **Composition** : \[Optional\] How the shot is framed, such as *wide shot* , *close-up* , *single-shot* or *two-shot*.
- **Focus and lens effects** : \[Optional\] Use terms like *shallow focus* , *deep focus* , *soft focus* , *macro lens* , and *wide-angle lens* to achieve specific visual effects.
- **Ambiance** : \[Optional\] How the color and light contribute to the scene, such as *blue tones* , *night* , or *warm tones*.

#### More tips for writing prompts

- **Use descriptive language**: Use adjectives and adverbs to paint a clear picture for Veo.
- **Enhance the facial details** : Specify facial details as a focus of the photo like using the word *portrait* in the prompt.

*For more comprehensive prompting strategies, visit [Introduction to
prompt design](https://ai.google.dev/gemini-api/docs/prompting-intro).*

### Prompting for audio

You can provide Veo with cues for sound effects, ambient noise, and dialogue.
The model captures the nuance of these cues to generate a synchronized
soundtrack.

- **Dialogue:** Use quotes for specific speech. (Example: "This must be the key," he murmured.)
- **Sound Effects (SFX):** Explicitly describe sounds. (Example: tires screeching loudly, engine roaring.)
- **Ambient Noise:** Describe the environment's soundscape. (Example: A faint, eerie hum resonates in the background.)

These videos demonstrate prompting Veo 3's audio generation with increasing
levels of detail.

| **Prompt** | **Generated output** |
|---|---|

Try out these prompts yourself to hear the audio!

[Try Veo](https://deepmind.google/models/veo/)

### Prompting with reference images

You can use one or more images as inputs to guide your generated videos, using
Veo's [image-to-video](https://ai.google.dev/gemini-api/docs/veo#generate-from-images)
capabilities. Veo uses the input image as the initial frame. Select an image
closest to what you envision as the first scene of your video to animate
everyday objects, bring drawings and paintings to life, and add movement and
sound to nature scenes.

| **Prompt** | **Generated output** |
|---|---|

Veo 3.1 lets you [reference images](https://ai.google.dev/gemini-api/docs/veo#reference-images) or
ingredients to direct your generated
video's content. Provide up to three asset images of a single person, character,
or product. Veo preserves the subject's appearance in the output video.

| **Prompt** | **Generated output** |
|---|---|

Using Veo 3.1, you can also generate videos by specifying the [first and last
frames](https://ai.google.dev/gemini-api/docs/veo#using-first-and-last-video-frames) of the video.

| **Prompt** | **Generated output** |
|---|---|

This feature gives you precise control over your shot's composition by letting
you define the starting and ending frame. Upload an image or use a frame from a
previous video generation to make sure your scene begins and concludes exactly
as you envision it.

### Prompting for extension

To [extend](https://ai.google.dev/gemini-api/docs/veo#extending-veo-videos) your Veo-generated
video with Veo 3.1 (not available for Veo 3.1 Lite), use the video as an input
along with an optional text prompt. Extend finalizes the final second or 24
frames of your video and continues the action.

Note that voice is not able to be effectively extended if it's not present in
the last 1 second of video.

| **Prompt** | **Generated output** |
|---|---|

### Example prompts and output

This section presents several prompts, highlighting how descriptive details can
elevate the outcome of each video.

#### Icicles

This video demonstrates how you can use the elements of
[prompt writing basics](https://ai.google.dev/gemini-api/docs/veo#basics) in your prompt.

| **Prompt** | **Generated output** |
|---|---|

#### Man on the phone

These videos demonstrate how you can revise your prompt with increasingly
specific details to get Veo to refine the output to your liking.

| **Prompt** | **Generated output** |
|---|---|

#### Snow leopard

| **Prompt** | **Generated output** |
|---|---|

### Examples by writing elements

These examples show you how to refine your prompts by each basic element.

#### Subject and context

Specify the main focus (subject) and the background or environment (context).

| **Prompt** | **Generated output** |
|---|---|

#### Action

Specify what the subject is doing (e.g., walking, running, or turning their
head).

| **Prompt** | **Generated output** |
|---|---|

#### Style

Add keywords to steer the generation toward a specific aesthetic (e.g., surreal,
vintage, futuristic, film noir).

| **Prompt** | **Generated output** |
|---|---|

#### Camera motion and composition

Specify how the camera moves (POV shot, aerial view, tracking drone view) and
how the shot is framed (wide shot, close-up, low angle).

| **Prompt** | **Generated output** |
|---|---|

#### Ambiance

Color palettes and lighting influence the mood. Try terms like "muted orange
warm tones," "natural light," "sunrise," or "cool blue tones."

| **Prompt** | **Generated output** |
|---|---|

### Aspect ratios

Veo lets you specify the aspect ratio for your video.

| **Prompt** | **Generated output** |
|---|---|
