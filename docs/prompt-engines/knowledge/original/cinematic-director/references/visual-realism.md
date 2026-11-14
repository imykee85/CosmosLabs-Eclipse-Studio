# Visual realism and take diagnosis

Use this for photoreal prompts and complaints such as plastic skin, waxy faces, rigid movement, or artificial motion. These are diagnosis questions and plausible interventions, not known Seedance mechanisms or universal cures. Inspect the actual source and output before saying what caused a failure.

## Locate the problem before changing the prompt

Ask where the failure first becomes visible, using available evidence:

| Observation | Inspect | First intervention to consider |
|---|---|---|
| The input portrait or first frame already looks waxy | Full source image; retouching, uniform gloss, texture, light, facial shape | Correct or replace the relevant appearance source with approval; protect identity and composition |
| Source looks convincing; output's held face does not | The actual generated frame, light/highlights, shot size, material response | Simplify competing look instructions; direct one observed material/light issue |
| Held frames look convincing; movement feels robotic | Full-speed clip and relevant slowed passage; trigger, gaze, contact, effort, recovery | Repair one causal performance problem; see performance direction |
| Skin or identity changes during motion | Before/during/after frames; occlusion, extreme turn, complex choreography | Reduce the difficult motion or overlap; consider supported reference guidance or separate coverage |
| Feet slide, hands float, bodies snap into marks | Contact frames, route, timing, scale, start pose | Supply clear contact/support and feasible travel; remove competing actions |
| Texture crawls, edges shimmer, frames ghost, motion repeats | Original output if available versus preview/export; processing settings | Inspect temporal/render or delivery behavior before adding acting instructions |
| Detail looks oversharpened or smeared only after export | Known original versus processed copy and actual metadata | Check the documented export/upscale/interpolation path; do not guess hidden processing |

If media is absent, state that these are hypotheses. Do not call a prompt audit a render diagnosis. The model, input assets, supported controls, generated take, and subsequent processing can all matter; prompt length alone cannot identify the cause.

## Preflight the source

An approved image can anchor a look and also carry an unwanted defect. Inspect whether skin, eyes, hair, clothes, and the set already look photographic, and whether the pose permits the intended next action. An identity portrait may guide identity only; an image-to-video first frame constrains much more.

When a correction is needed, describe the bounded change: preserve identity, age, anatomy, wardrobe, framing, and intended wetness; correct the observed surface or light problem. Do not silently beautify, age, whiten, roughen, or add scars to a person. Do not erase the user's chosen stylization merely because this skill can do photorealism.

## Describe material response, not just detail quantity

Use only details visible at the shot's distance, exposure, focus, and speed. A distant sprint needs weight and silhouette; a held close-up may show expression-linked folds, subtle tone variation, hairline detail, or moisture.

When skin detail is visible, consider five separate aspects; include only those that matter at the shot's scale:

- **Color:** preserve the person's skin tone and plausible local variation under the scene's light; avoid uniform color, skin lightening, or invented blemishes.
- **Surface reflection:** let moisture and different skin regions catch the actual light differently, with highlights following the face's shape. A damp forehead and a less reflective cheek need not respond identically. Preserve plausible highlights instead of making all skin matte.
- **Roughness:** describe relevant smoothness or fine texture and its effect on reflection; avoid one polished coating across skin, lips, fabric, and props. Do not exaggerate pores or roughen every face.
- **Scattering:** when strong backlight passes through thin areas such as an ear or fingertip, allow subtle, localized transmitted warmth appropriate to the skin tone and exposure. Do not add a uniform waxy glow or invent transmission where the lighting does not support it.
- **Expression-related changes:** let small creases, stretches, and highlights follow the changing facial shape and settle with the expression, while preserving identity and stable markings. Avoid a fixed texture mask or exaggerated wrinkles.

Other useful material and contact checks:

- Eyes need coherent gaze and light relationships. Avoid oversized glowing catchlights, glass-marble eyes, or endless darting as generic instructions. Correct these only if relevant or observed.
- Wet fabric darkens, clings or hangs according to its material and load. Leather, waxed canvas, steel and glass have different reflections. Do not give every surface the same smooth coating.
- Weight and contact can make a surface believable: a strap loads a shoulder, a sleeve bunches at a grip, a palm contacts a rail. Select the event important to the shot; do not catalogue every fibre.

Describe the visible outcome in ordinary language. Rendering terms such as subsurface scattering explain a concept but are not actual shader controls in a text prompt. Avoid arbitrary numerical roughness/scattering values, pore inventories, or “8K skin” as substitutes for observable direction.

## Light should reveal form

Locate the motivated source and state its direction, shadow softness, fill relationship, and falloff. A soft source can still be directional and restricted by flags; soft does not mean evenly lighting everything. Negative fill means reducing bounce on the shadow side. Preserve a believable dominant source without pretending visible practicals and passing headlights do not contribute.

Use exposure and highlight behavior to protect the requested skin/material appearance. Do not make “never clip,” “lift every shadow,” “matte everything,” or “add haze” universal rules. Deep blacks, wet shine, grain-free capture and still cameras can all be intentional.

When changing view, light remains in world space. Camera-left in one shot can become camera-right in a reverse angle. A production brief's lighting label should be translated into a visible effect rather than copied with contradictory descriptions.

## Preserve the chosen optics without making them a cure

For an anamorphic look, describe the desired characteristics selectively: oval defocused highlights where visible, particular focus falloff, restrained edge character, and a horizontal flare only when an actual source/angle motivates it. Do not automatically add distortion, blue streaks, grain, halation, fake letterboxing, or shallow focus to every shot. Those are separate choices, and lens designs differ.

Spherical optics can also look photographic. Anamorphic appearance does not direct an actor or repair contact. Keep the user's preference while testing performance separately. Motion blur can make speed read, but it cannot repair impossible joint motion or a slipping foot; image-wide sharpness and heavy blur everywhere are not a coherent target.

“180-degree shutter” requests a motion-blur character. On a physical camera it describes exposure for half the frame interval; it is distinct from the action-line rule and field of view. Do not report actual encoded fps or exposure from this phrase.

## Compare takes without inventing evidence

With generation authorization and an agreed budget, a useful comparison is the existing prompt versus one targeted change, using the same model/mode, references, duration, resolution, audio, and seed if the route exposes one. Repeat only as useful and authorized. Stochastic outputs can differ even when inputs match; a changed seed or resolution is another variable.

Judge the actual event: Did the hand make and retain contact? Did the person respond after the sound? Did momentum continue through the stop? Did the intended subtle reaction register at delivery size? Record timestamps, successful details, failure, and the one next hypothesis. No invented realism score or claimed success rate from a handful of takes.

For repeated failure, choose an intervention proportional to the evidence: clearer motivation, fewer simultaneous actions, a source-frame correction, supported performance-reference video, independently generated coverage, or an explicitly chosen alternate route. Do not keep adding “natural,” “human,” “perfect,” or long negative lists.

## Sources and limits

Public pages checked 30 October 2026:

- [Higgsfield Seedance help](https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-use-seedance): actual output controls, reference roles, complete-clip review, and one-variable iteration. The selected live mode still needs verification.
- [ARRI Master Anamorphic](https://www.arri.com/en/cine-lenses/arri-zeiss-fujinon-lenses/master-anamorphics): specific lens characteristics, oval defocused highlights, focus falloff, and separate flare options. These describe real optics, not a guarantee of model compliance.
- [Epic Games Digital Humans](https://dev.epicgames.com/documentation/en-us/unreal-engine/digital-humans?application_version=4.27): distinct skin color, roughness, specularity, scattering, normal detail, and expression-related material changes. This rendering documentation motivates the separation of material response from texture quantity; it is not Seedance implementation documentation.
- [RED shutter documentation](https://docs.red.com/955-0196/955-0196_V1.7%20Rev-B%20RED%20PS%2C%20KOMODO%20Operation%20Guide%20HTML/Content/4_Menus/01_Image_LUT/Shutter.htm): physical shutter-angle/exposure relationships, not a video-model control.

The diagnostic workflow above is a synthesis, not the result of controlled video-generation experiments.
