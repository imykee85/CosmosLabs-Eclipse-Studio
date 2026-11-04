# Color and image

Use when sources need interpretation, normalization, matching, or a creative grade. Distinguish what is known about the signal from how the picture should feel.

## Keep the operations distinct

Preserve five understandable stages, whether implemented as nodes, layers, settings, or another editable workflow:

1. Source interpretation and input transform.
2. Technical correction.
3. Shot matching.
4. Creative look and scene-specific trims.
5. Output transform and delivery verification.

A fixed saturation or contrast treatment is not normalization. A LUT may perform a technical transform, a creative look, or both; know its purpose, expected input, and output. Tagging a file does not transform its pixels.

## Interpret the source and destination

Determine the destination color space, transfer, range, and monitoring requirements. Inspect source metadata, camera or acquisition information, bit depth, primaries, transfer, matrix, and range as relevant. Include image profiles and HDR metadata where present. Do not infer log from a flat image, or a profile from resolution, codec, or extension alone.

When evidence conflicts, resolve it through source information or a documented interpretation before applying an automatic transform. Retain the assumption and its basis. Do not mistake an untransformed diagnostic frame of log or HDR for a trustworthy appearance preview.

Use verified transforms suited to the source and finishing environment. Preserve sufficient precision through correction, compositing, and conversion. For HDR-to-SDR work, make the tone-mapping choice with highlight intent and the destination in mind; audition alternatives when the choice is consequential. RAW, HDR, wide-gamut, and calibrated mastering are legitimate production scopes whose tools, transforms, monitoring, and expertise must be established for that job.

## Correct and match with intent

Group related shots by camera, scene, and lighting where useful; select an appropriate reference. Address exposure, balance, black and white relationships, contrast, and saturation in a sequence that makes the correction understandable. Then refine the match in context.

Use picture together with waveform, RGB parade, vectorscope, and other relevant scopes. A measurement can reveal a cast or clipping; it cannot choose the scene's intended warmth or emotional distance. Do not match unrelated compositions by whole-frame histogram or neutralize intentional differences between day and night, places, or dramatic states.

Prefer stable shot corrections. Frame-by-frame automated balancing can pump or remove motivated lighting change. Correct a genuine exposure drift deliberately when needed. Baked clipping or lost source information cannot be restored by labeling a treatment recovery.

Compare the same person's complexion across related shots. Preserve shadow detail, highlight texture, facial contrast, and environmental intent. Do not homogenize different people toward a universal hue or brightness target. Cosmetic changes should be intentional, appropriate to the brief, and within the authorized source treatment.

## Build the look and finish the image

Make the look interpretable and reversible. It can develop by scene or chapter rather than flatten the whole film into one recipe. Inspect whether it obscures essential proof, changes a product misleadingly, or imposes an unintended portrayal on a real person.

Consider where graphics belong in the pipeline. Exact identity colors usually need protection from the footage's creative grade; a diegetic graphic may intentionally receive scene lighting and treatment. Composite with an appropriate working space and alpha interpretation, especially around translucent edges, glows, or light integration.

Review the actual decoded delivery as well as the working image. Confirm intended transforms and metadata, shot-to-shot continuity, gradients, black and highlight behavior, skin, and compression artifacts. Scope values outside a nominal range are reasons to investigate, not automatic proof of perceptual gamut failure. Use the monitoring environment required by the claimed finish; ordinary-screen playback cannot establish calibrated mastering.
