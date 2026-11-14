# Locations, first frames, matching views, and image edits

Write still-image prompts that support a coherent film project. The still-image tool/model is chosen separately from Seedance video; do not invent access, settings, or upload tags. This guide authors prompts unless generation is explicitly requested.

## Choose the still's job

- **Location master:** establish reusable geometry, materials, major objects, and light. Omit people if an empty environment is requested.
- **First frame:** establish the actual opening pose and composition of one video shot, including relevant people, props, contact and travel space.
- **Matching angle:** show another view of an established set while preserving world geometry, time, weather, materials, and source positions.
- **Bounded edit:** change a specific element of an approved image while naming the details to protect.

A reference pack may contain these different roles. Do not call every image a first frame, or make an identity image own a pose/expression accidentally. Verify the selected host's actual roles before assuming a location plate can be supplied independently of the start image.

## Establish a usable frame

Inspect supplied references and the shared project look. Decide camera position/height, shot size, subject placement, relevant foreground and background, focus priority, and paths of movement. Use enough geometry to keep the intended action possible; avoid over-specifying invisible architecture.

For a first frame, stage the instant before or at the start of the action. If a hand will pick up a cup, show a reachable cup and a plausible hand position. Do not place approach, contact, reaction, and final pose into one still, and do not imply the image contains a montage unless a storyboard is requested.

Specify the few defining materials and motivated light sources. Carry the project's lens family, palette, contrast, and texture into the video prompt unchanged unless the user requests a change. If unspecified, the main skill's restrained anamorphic default applies; do not silently introduce a competing spherical default.

For photoreal work, use the source/appearance checks in [visual realism](visual-realism.md). Fine surface detail must be visible at this scale; prioritize silhouette and light for a wide location. Grain, flare, air haze, dirt, and warm light are not compulsory.

## Change viewpoint without changing the set

Use an approved master as the spatial anchor where supported. Name the new camera's location and viewing direction relative to fixed landmarks. Preserve door placement, platform/road adjacency, prop positions, and light-source locations. Explain the new screen relationship only after the world relationship is clear.

Do not request a geometry-only reference and simultaneously demand its exact composition unless that exception is explicit. A single attachment cannot be assumed to contain two distinct unseen views. Inspect the actual media or label the uncertainty. Newly exposed hidden architecture is an assumption, not a confirmed feature.

## Edit with boundaries

Write **target → change → protected details**. For example: change the light leaking through the rear doorway from warm to cool; preserve the character, pose, wardrobe, camera, furniture and daylight elsewhere. If the requested edit conflicts with a protected detail, surface that conflict rather than silently choosing.

After an actual edit, inspect the result for identity, composition, geometry, materials and unintended changes. An image-edit prompt alone is not verification.

## Deliver

Give the still's purpose, a reference map when applicable, one self-contained prompt, and separate provisional or verified image settings. For a full still-to-video request, provide the still prompt and a compatible video prompt; do not falsely describe the proposed still as generated, selected, or approved. When the user later chooses a frame, revise the video's opening to match the real frame.
