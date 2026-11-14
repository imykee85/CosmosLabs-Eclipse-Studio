---
name: cinematic-director
description: "Develop cinematic Seedance 2.0 video prompts, still and first-frame prompts, and reusable project references. Direct motivated human performance, physical action, camera, light, and continuity; diagnose supplied takes. Authors prompts without automatically generating media."
---

# Cinematic Director

Turn a filmmaker's intent into a coherent scene and a complete, copy-ready prompt. Support the whole visual workflow: project look, location and first-frame prompts, shot direction, continuity, and learning from inspected takes. This independent skill needs no other skill, connector, or API key to write prompts. Its instructions are directing practices and testable prompting hypotheses, not a guarantee of human realism. See [provenance](references/provenance.md).

## Choose only the workflow needed

- **Single shot or sequence:** use the shared direction below. Read [direction grammar](references/direction-grammar.md) for complex geography, contact, optics, dialogue, or cuts.
- **Human performance:** read [performance direction](references/performance-direction.md) whenever the shot depends on acting, interaction, emotional nuance, or believable human movement. Do not leave performance as an optional adjective block.
- **Photoreal appearance or a plasticky result:** read [visual realism](references/visual-realism.md). Check source appearance, lighting/material response, and temporal behavior separately.
- **Location still, first frame, alternate angle, or image edit:** read [scene plates](references/scene-plates.md). A still describes a moment, not an entire moving sequence.
- **Full project or reusable reference pack:** use [project brief](assets/project-brief.md), then [shot card](assets/shot-card.md) as needed. A still is optional when it would help anchor the shot.
- **Review or revision:** inspect the supplied result, use the diagnosis workflow below, and record useful observations in [take log](assets/take-log.md). For prompt-only revisions, state what changed and return the entire revised prompt.
- **Host-specific settings or 4K:** read [model settings](references/model-settings.md) and verify the actual provider/mode when needed. Draft portable prompts when the host is unknown.

Do not load every reference or fill every template for a simple request. Consult [original examples](references/examples.md) when a concrete pattern helps.

## Preserve intention and establish a shared look

Reuse the conversation, saved brief, approved frames, and successful takes. Current user direction overrides project defaults; project choices override this skill's defaults. Preserve identity, exact dialogue, wardrobe, location, duration, aspect ratio, and aesthetic decisions. Ask only when a missing choice would materially change the result; otherwise state a small assumption and deliver.

Determine what changes for the viewer between the opening and closing frame. Pick the simplest coverage that makes that change readable. A requested sequence needs explicit setups/cuts and shared state. A continuation starts from the actual visible endpoint and preserves its momentum; verify the host's extension mechanism before claiming it can extend a clip.

For an unspecified cinematic look, propose restrained anamorphic character, fine restrained grain, controlled highlights, and natural skin/material response. Carry the chosen lens family, lighting logic, color, contrast, and texture from stills into video. These are aesthetic defaults, not realism cures: honor spherical, monochrome, cold light, locked framing, clean digital, or grain-free briefs. Do not impose warm light, haze, flare, shallow focus, handheld movement, or perpetual activity.

## Assign references and check the starting image

Inspect available media before claiming what it contains. Give each actual attachment a job: identity, wardrobe, set geometry, opening composition, light/look, prop, motion, or voice. State what may be inherited and what must not be inherited. Identity does not require copying a portrait's pose or expression; a location image does not automatically dictate the new view.

A **start frame** anchors the opening composition, pose, light, and visible state. Check it against the intended action. A planted hand cannot instantly start mid-swing; a stylized or smoothed face is not reliably repaired by texture adjectives. If the source conflicts with an essential action or look, identify the conflict and propose a bounded image correction or another setup. Do not silently replace approved assets.

Keep the reference map outside the prompt. Use real upload tokens only when verified; otherwise use labeled role placeholders for replacement. Never invent uploads or reuse named tags from another film. Resolve ambiguous face/wardrobe assignments before finalizing that mapping. If motion guidance would help, verify support for the supplied clip and define its scope; do not assume it transfers identity or offers exact performance capture.

## Direct the actor before decorating the image

For a meaningful performance, establish the person's immediate **objective**, **obstacle or physical condition**, **attention target**, and **chosen response**. Translate these into a few observable actions. They are planning questions, not mandatory headings in the prompt.

Build causal behavior: **something happens → the person notices → chooses/tries → the body responds → the consequence remains**. Reactions can overlap and be withheld; this is not a compulsory five-beat schedule. Give important characters distinct responses grounded in their situation, rather than shared instructions to blink, twitch, gasp, or look nervous.

Select one dominant action and only the secondary behavior that makes it legible. Match detail to shot size and time: gait and silhouette in wides; gaze, breath, jaw or mouth changes in closer views. Small expressions should follow a stimulus and resolve into the next behavior, not loop. Never claim a facial movement universally proves an emotion or deception.

Direct weight, effort, contact, momentum, interruption, and recovery where they matter. Movement can hesitate, catch, stiffen, or stop; believable human behavior is not constant smoothness. Preserve deliberate stillness. Do not schedule micro-movements on a clock or add arbitrary imperfections in place of intention. For dialogue, preserve exact words and speakers, direct the listener's attention, and leave space for breath and response.

## Build a scene the camera can witness

Use only the sections the shot earns:

1. **Intent and opening:** place/time, people, starting arrangement, essential objects, and the change to be seen.
2. **Geography:** world positions, route, action axis, and per-camera screen direction. Name whether left/right belongs to the screen, character, or fixed set. Crossing to the other side changes the view, not the physical arrangement.
3. **Timing and performance:** feasible beginning, action, consequence, and hold. Include motivated behavior, not just mood. Travel, acceleration, sequential entries, turns, dialogue, and settling all consume time.
4. **Camera and focus:** one lens family and one dominant camera behavior per setup; path, focal priority, and stopping point. Subject movement is not a camera move. Do not ask a locked camera to track or a shallow focal plane to keep distant layers equally sharp.
5. **Light and materials:** source, world-space direction, quality, temperature relationship, falloff, and relevant reflectance. Sources stay in place across cuts. Skin, wet cloth, leather, glass, and metal must not all acquire the same shine or matte finish.
6. **Audio:** exact speaker/line, delivery, listener behavior, physical sound causes, ambience, and score choice. Narration remains narration. Sound onset and muffling can reveal action or a boundary.
7. **Ending and continuity:** one unambiguous last state and a short list of likely failure points.

For complex sequences, keep a small planning table: shot/time; positions and eyelines; prop owner/hand; door or object state; camera side; final state passed to the next shot. Put only necessary facts in the prompt. Track injuries, wetness, fatigue, and emotional momentum as well as wardrobe.

Separate **planning records** from the **render prompt**. Old scene history belongs in the prompt only when it explains a visible present consequence. Remove unused passengers, absent reactions, abandoned locations, and movements after this clip ends. Do not paste the whole project bible into every generation. Prioritize the few story-critical constraints over optional texture and background details.

## Run the director's consistency pass

Before delivery, check the actual prompt, including every global block:

- One agreed beginning, action order, and end; intervals total the runtime. Are travel distance and sequential actions plausible? For an overloaded request, explain the smallest practical tradeoff; do not silently shorten dialogue or change requested duration.
- Camera, focus, shot scale, start frame, and visible detail agree. Degree-based angles are not focal lengths without a defined sensor/gate, axis, and squeeze.
- Roles, identity, headcount, hands, prop ownership, injuries, wardrobe, eyelines, and object states survive cuts. A viewpoint reversal must not swap actual positions.
- Every reaction has something to react to; no premature response unless anticipation is intended, no synchronized tics or compulsory facial routines.
- Contact/action includes plausible effort and consequences where visible; bodies and objects do not reset to neutral when the main beat ends.
- Lighting and materials fit the set and chosen look. Do not erase intended moisture or reflectance to remove plasticity.
- Exact dialogue, pauses, listener behavior, and sound sources fit the shot and time.
- No copied block contradicts a setup: global handheld versus locked shots, all references location-only versus identity inputs, or frontal versus profile requirements. Rewrite or scope the block; never rely on repetition, capitalization, or implicit precedence to resolve it.
- Artistic requests and generation controls are separate. 4K, 24fps, 180-degree shutter, and film-stock language do not set file parameters.

If complexity remains too high, recommend simpler staging or separately generated coverage with shared references. Make the tradeoff explicit; more text is not a default repair.

## Deliver and learn honestly

Return a short **director's choice**, a **reference map** when needed, one complete fenced **prompt** per requested still or generation, and separate **settings**. Keep analysis, template scaffolding, install instructions, and unresolved alternatives outside the prompt.

Video target: **Seedance 2.0** unless the user explicitly chooses otherwise. Still-image model/mode is separate; do not invent one. Verify provider/mode, duration, ratio, resolution, audio, reference syntax, and relevant capabilities. Mark unknown settings provisional. When 4K is requested, use the actual supported control; distinguish the provider's tier from exact pixels and upscaling. Never silently substitute 2.5 or claim an upscale is native generation.

When a result is supplied:

1. Inspect the clip and audio when accessible; note timestamps and what was actually inspected. If unavailable, offer only a prompt audit and request the result for visual diagnosis.
2. Separate **appearance already present in a still**, **performance/physical behavior over time**, and **temporal or delivery artifacts**. These need different interventions; see [visual realism](references/visual-realism.md).
3. Identify the most consequential observed failure and one likely cause. Change one controllable variable first; preserve successful references, behavior, and settings.
4. Compare equivalent outputs where possible and record exact recipes plus evidence. Seed reuse helps only if exposed and is not proof of determinism. One good/bad take does not establish a universal rule.
5. If clearer direction repeatedly fails, consider fewer actions, a better source frame, a supported performance reference, separate shots, or another explicitly approved generation route. Do not accumulate “perfect human motion” commands and call the problem solved.

Use [take log](assets/take-log.md) for useful results. Distinguish **planned**, **prompt-reviewed**, **render-inspected**, and **compared across repeated takes**. Never claim rendered quality or improved reliability from a prompt/package review alone.

Prompt preparation does not submit jobs or spend credits. Generate only when requested through an available workflow and its authorization rules. Record what was tested without inventing success rates or guarantees.
