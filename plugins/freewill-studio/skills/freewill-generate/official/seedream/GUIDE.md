<!-- 원본: https://docs.byteplus.com/en/docs/ModelArk/seedream-4-0-5-0-prompt-guide · BytePlus · 게시처(BytePlus)가 라이선스를 밝히지 않음 — 출처를 남기고 사내용으로만, 요청 시 삭제 — sync/sync.mjs 가 매일 받아 프롬프트 절만 뽑은 것. 손으로 고치지 말 것. -->

This article introduces prompt usage tips for Seedream 4.5 and 4.0's text-to-image generation, image editing, reference-based generation and multi-image creation, helping you quickly get started with image creation and turn ideas into image creations.

# General guidelines

Seedream 4.5 and 4.0 support a wide range of tasks such as text-to-image generation, image editing, reference-based generation and multi-image creation. For optimal image creation results, consider the following best practices when crafting prompts:

1. **Clearly describe the scene using natural language**

   Use coherent natural language to describe the **subject + action + environment**. If aesthetics matter, include descriptors of **style,**  **color,**  **lighting,**  or **composition**.

   * Recommended: A girl in a lavish dress walking under a parasol along a tree-lined path, in the style of a Monet oil painting.

   * Avoid: Girl, umbrella, tree-lined street, oil painting texture.

2. **Specify application scenario**

   If you have a specific use case, explicitly state the image **purpose** and **type** in your prompt.

   * Recommended: Design a logo for a gaming company. The logo features a dog playing with a game controller. The company name "PITBULL" is written on it.

   * Avoid: An abstract image of a dog holding a controller, and the word PITBULL on it.

3. **Enhance stylistic rendering**

   If a particular style is needed, use **precise style keywords** or **reference images** to achieve better results.

<columnsItem zoneid="dDA1Up9vHu">

<span> </span>

picture book style

</columnsItem>
<columnsItem zoneid="xG4RLJAZDY">

<span> </span>

children's book illustration style

</columnsItem>
<columnsItem zoneid="mirrHXdqqZ">

<span> </span>

style reference image

</columnsItem>

4. **Improve text rendering accuracy**

   Use **double quotation marks** for the text that needs to appear in the generated image.

   * Recommended: Generate a poster with the title "Seedream 4.5".

   * Avoid: Generate a poster titled Seedream 4.5.

5. **Clearly define image editing goals and fixed elements**

   Use **concise**, **unambiguous** **instructions** for modifications. Avoid vague pronouns. If other elements should remain unchanged, specify that explicitly.

   * Recommended: Dress the tallest panda in pink Peking Opera costume and headgear, keeping its pose unchanged.

   * Avoid: Put that one in pink clothes.

# Prompt guide

## Text-to-Image

Use clear and detailed **natural language** to describe the scene. For complex images, describe elements thoroughly to control the output precisely.

> Compared to the older version Seedream 3.0, Seedream 4.5 and 4.0 have a stronger understanding of text prompts, allowing them to generate the expected images with less description, and **the images are no longer washed out**. Therefore, when using Seedream 4.5 and 4.0, using concise and precise prompts is usually better than repeatedly stacking ornate and complex vocabulary.

<span aceTableMode="list" aceTableWidth="1,1"></span>
|Input |Output |
|---|---|
| **[prompt]**  A cluttered office desk. On the desk, there is an open laptop with a screen displaying green code. Next to it, a mug with the word "Developer" on it, with steam rising from the top. An open book lies on the desk, with pages showing a Venn diagram illustrating the nesting relationships of three circles in gray, blue, and light green. A sticky note with a mind map drawn on it, organized in a three-level vertical structure. A fountain pen, with the cap lying beside it. Next to the pen is a smartphone, with a new message notification displayed on the screen. In the corner of the desk, there is a small pot of succulent plants. The background is a blurred bookshelf. Sunlight shines from the right side, casting light and shadow on the desk. |<span> </span> |
| **[prompt]**  Interior view of an open refrigerator: Top shelf: On the left, there is a carton of milk featuring an illustration of three cows of different sizes grazing on a grassland. On the right, there is an egg holder containing eight eggs. Middle shelf: A plate holds leftover roasted chicken with a small red flag stuck into it. Next to it is a transparent container filled with strawberries, the container is decorated with images of a pineapple, strawberries and oranges. Bottom shelf: The vegetable drawer contains lettuce, carrots and tomatoes. On the door shelves, there are bottles of ketchup and mayonnaise. |<span> </span> |

Seedream 4.5 and 4.0 can transform knowledge and reasoning outcomes into high-density visual content, such as formulas, diagrams, and educational illustrations. When generating such images, we recommend that you use **precise** **technical** **terminology** to ensure accurate representation of the concepts. Additionally, clearly specify the desired visualization format, layout, and style.

<span aceTableMode="list" aceTableWidth="1,1"></span>
|Input |Output |
|---|---|
| **[prompt]**  Draw the following system of binary linear equations and the corresponding solution steps on the blackboard: 5x + 2y = 26; 2x -y = 5. |<span> </span> |
| **[prompt]**  Create an infographic showing the causes of inflation. Each cause should be presented independently with an icon. |<span> </span> |

## Image-to-Image

Seedream 4.5 and 4.0 support combining text and images to perform image editing and reference-based generation tasks. Visual cues like **arrows**, **bounding** **boxes** and **doodles** can help designate specific regions within the image.

### Image editing

Seedream 4.5 and 4.0 support image editing operations such as **addition**, **deletion**, **replacement**, and **modification** through text prompts. It is recommended to use clear and concise language to precisely indicate the target elements for editing and the specific changes required.

<span aceTableMode="list" aceTableWidth="1,1"></span>
|Input |Output |
|---|---|
|<span> </span><br><br>>  **[Addition]** <br><br>> **prompt: Add matching silver earrings and a necklace** to the girl in the image |<span> </span> |
|<span> </span><br><br>>  **[Deletion]** <br><br>> **prompt: Remove** the girl's **hat**. |<span> </span> |
|<span> </span><br><br>>  **[Replacement]** <br><br>> **prompt: Replace the largest bread man with a croissant man**, keeping the action and expression unchanged. |<span> </span> |
|<span> </span><br><br>>  **[Modification]** <br><br>> **prompt: Turn the three robots into transparent crystal**, colored red, yellow and green from left to right. Make the green one run, yellow walk, red stand. |<span> </span> |

When the image content is complex and **difficult to describe accurately using text alone**, visual indicators such as arrows, bounding boxes, or doodles can be used to specify the editing target and its location.

<span aceTableMode="list" aceTableWidth="1,1"></span>
|Input |Output |
|---|---|
|<span> </span><br><br>>  **[Doodle]** <br><br>> **prompt**: Insert a TV where **the red area is marked** and a sofa where **the blue area is marked**. Keep the original wooden style. |<span> </span> |
|<span> </span><br><br>>  **[Bounding** **Box]** <br><br>> **prompt**: Enlarge the title to **match the red box** and change its style to match the saxophone icon. |<span> </span> |

### Reference-based generation

Seedream 4.5 and 4.0 support extracting key information from reference images, such as character design, artistic style, and product features, to enable tasks like character creation, style transfer, and product design.

When there are specific features that need to be preserved (e.g., character identity, visual style, product design), you can upload a reference image to ensure the generated result aligns with expectations.

When using reference images, clearly describe:

* **Reference Target**: Clearly describe the elements to be extracted and retained from the reference image, such as character design, product material from the reference image.

* **Generated Scene Description**: Provide detailed information about the desired generated content, including scene, layout, and other specifics.

<span aceTableMode="list" aceTableWidth="1,1"></span>
|Input |Output |
|---|---|
|<span> </span><br><br>>  **[Reference Character]** <br><br>> **prompt: Based on the character in the reference image**, create an anime figure and place it on a desk. Behind it, place a birthday gift box printed with the character's image. Under the box, there is a book. In front of the gift box, add a round plastic base on which the figure stands. Set the scene indoors and make it as realistic as possible. The generated image should match the size of the original image. Position the figure on the left side of the image. The overall style should be consistent with the reference image, maintaining a cinematic photographic feel. |<span> </span> |
|<span> </span><br><br>>  **[Reference Style]** <br><br>> **prompt: Referencing the linear minimalist style of icons**, design 9 application icons for different scenarios, including: music, weather, calendar, camera, chat, map, alarm clock, shopping cart, and notebook, while maintaining a consistent color scheme. |<span> </span> |
|<span> </span><br><br>>  **[Reference Virtual Entity]** <br><br>> **prompt**: Convert **the character in the picture** into a felt wool figure on a small stand, placed on a dark desk. |<span> </span> |
|<span> </span><br><br>>  **[Reference Style]** <br><br>> **prompt**: Generate four tops in different materials and colors, **based on the clothing style worn by the girl** in the image. Show only the clothing. |<span> </span> |

When converting sketches (like wireframes, floor plans, hand-drawn prototypes) into high-fidelity images, we recommend the following guidelines:

1. **Provide a clear original image**. If the image contains text description, indicate "Generate based on the text in the image" in the text prompt.

2. **Clarify the main subject and requirements**, such as a high-fidelity UI interface or a modern living room.

3. **Explicitly define key consistencies with the reference**, such as ensuring that furniture placement matches the reference image and that the layout follows the prototype.

<span aceTableMode="list" aceTableWidth="1,1"></span>
|Input |Output |
|---|---|
|<span> </span><br><br>>  **[Floor Plan]** <br><br>> **prompt: Based on this floor plan**, generate a photorealistic image of a "modern minimalist furnished living room + open dining area". The room layout and furniture placement should exactly match the reference. Use a Mediterranean color palette, and keep the spatial structure and orientation consistent with the example. The room should appear spacious and three-dimensional (with a sunlit double-height ceiling above the dining area). From front to back, the scene should include: sofa & green plants, television, dining table & chairs, and floor-to-ceiling windows. Do not include any text or hand-drawn edges from the original sketch. |<span> </span> |
|<span> </span><br><br>>  **[Hand-Drawn Prototype]** <br><br>> **prompt**: This is a hand-drawn wireframe of a web-based housing rental platform's detail page. Please render it into a high-fidelity UI interface **according to the textual annotations in the sketch**. Add sample images in the gallery section, and include sample text content in the housing information and reservation information sections. |<span> </span> |

## Multi-image input

Seedream 4.5 and 4.0 support multi-image inputs for **composite editing** such as **combination**, **replacement**, or **style transfer**. When using this feature, it's recommended to clearly specify what to reference or edit from each image.

For example, replace **the character in Image 2** with **the character from Image 1**, and generate the result in **the style of Image 3**.

<span aceTableMode="list" aceTableWidth="1,1"></span>
|Input |Output |
|---|---|
|<span> </span><br><br>>  **[Replacement]** <br><br>> **prompt**: Replace **the subject in Image 1** with **the subject from Image 2**. |<span> </span> |
|<span> </span><br><br>>  **[Combination]** <br><br>> **prompt**: Dress **the character in Image 1** with **the outfit from Image 2**. |<span> </span> |
|<span> </span><br><br>>  **[Style Transfer]** <br><br>> **prompt**: Apply **the style of Image 2** to Image 1. |<span> </span> |

## Multi-image output

Seedream 4.5 and 4.0 support generating image sequences with **consistent character continuity** and **unified style**, making it suitable for storyboarding, comic creation, and set-based design scenarios that require a cohesive visual identity, such as IP product design or emoji pack creation.

When generating multiple images, **you can trigger series generation with phrases like "a series", "a set", or by specifying the number of images**.

<span aceTableMode="list" aceTableWidth="1,1"></span>
|Input |Output |
|---|---|
|<span> </span><br><br>>  **[prompt]**  Refer to this logo, **create a set of visual designs** for an outdoor sports brand named "GREEN". The products include packaging bags, hats, cards, wristbands, cartons, lanyards. The main visual color is green, with a simple and modern style. |<span> </span> |
| **[prompt]**  Generate four film storyboard images, corresponding to the following scenes: astronauts repairing a spacecraft in a space station, suddenly encountering an asteroid belt attack, astronauts taking emergency evasive action, and narrowly returning to the spacecraft after being injured. |<span> </span> |
| **[prompt]**  Generate seven mobile phone wallpapers for Monday through Sunday, featuring natural landscapes, with each image labeled with the corresponding date. |<span> </span> |
