---
name: seedance25-prompt-optimizer
description: Optimize, expand, rewrite, or structure rough video-generation ideas into detailed Seedance 2.5 prompts. Use when the user asks to 优化提示词/扩写视频提示词/写 Seedance 2.5 或即梦视频提示词, or when they need prompt structures for text-to-video, multi-reference media, long video, video editing, extension, first/last frames, keyframes, storyboards, blockouts, auto-movie, or seamless transitions. Preserve explicit constraints and add only low-risk, video-relevant details. Do not use for unrelated image prompts, general filmmaking advice, or factual Seedance documentation unless the user also wants a production-ready prompt.
---

# Seedance 2.5 Prompt Optimizer

Turn a user's rough video idea into a production-ready Seedance 2.5 prompt. Do not merely make the wording longer. Translate intent into visible, audible, sequential, and continuity-safe instructions.

## Core outcome

By default, return only a directly usable prompt under:

```markdown
## 优化后的 Seedance 2.5 提示词

<完整成品提示词>
```

If the user asks what was changed, append a short `## 自动补充了什么` section. Do not expose hidden analysis or internal checklists.

## Reference loading

This skill uses progressive disclosure. Read only the references needed for the current task:

- Always read `references/core-rules.md` before optimizing a prompt.
- Read `references/task-templates.md` when the task uses references, multiple scenes, editing, extension, keyframes, storyboards, blockouts, auto-movie, or transitions.
- Read `references/examples.md` only when an example would materially help resolve structure or style.

Do not load every reference by default when the task is a simple one-line text-to-video prompt.

## Workflow

Follow this order.

1. **Lock hard constraints.** Extract the user's subject, subject count, event, scene, style, camera, sound, timing, reference-media roles, exclusions, and any must-keep state. Never overwrite them with defaults.
2. **Route the task.** Select one primary task type from the routing table below. Use a secondary type only when it is truly nested inside the primary workflow.
3. **Assess missing information.** For ordinary text-to-video, infer safe details rather than interrogating the user. Ask one concise question only when a missing fact makes the task itself ambiguous, such as which object to replace, which clip comes first, or what a reference image is supposed to define.
4. **Enrich safely.** Add only details that improve action clarity, scene credibility, camera execution, sound fit, continuity, or reference binding. Do not add decorative detail with no generation function.
5. **Make abstract ideas observable.** Convert emotion, atmosphere, and specialist camera language into things that can be seen or heard.
6. **Render using the task template.** Prefer natural-language instructions and clear state transitions. Use stages instead of dense timestamps for longer narratives.
7. **Validate.** Remove contradictions, duplicate instructions, impossible precision claims, unnecessary timestamps, and accidental changes to subject count or user constraints.
8. **Output the final prompt.** Keep platform notes outside the prompt if a boundary warning is necessary.

## Task routing

| Type | Trigger signals | Output structure |
|---|---|---|
| `TEXT_TO_VIDEO` | Rough idea, subject/action/scene only | Subject + event → scene → visual → camera → sound → continuity if needed |
| `MULTI_REFERENCE` | `@图片`, `@视频`, `@音频`, “参考这些素材” | Per-asset responsibility → subject mapping → subject setup → scene usage |
| `LONG_VIDEO` | Multiple sequential events, workflow, story, ~20–30s | Goal → stages → end state per stage → continuity |
| `VIDEO_EDIT` | Modify/replace/remove/add/adjust existing video | Edit goal → unique master → target reference → edit scope → keep list → timeline inheritance if needed |
| `VIDEO_EXTEND` | Extend before/after an existing clip | Boundary state → new event → continuity |
| `FIRST_LAST_FRAME` | Image explicitly used as first/last frame | Per-anchor role → continuous action → arrive at last frame |
| `MULTI_KEYFRAME` | Multiple images define ordered states | Declare keyframe order → per-frame state → continuous transitions |
| `STORYBOARD` | Grid storyboard / multi-panel board | Read order → shot-by-shot action/composition → final style/sound |
| `COARSE_BLOCKOUT` | Simple geometry gives movement/positions/camera | Map each blockout object → inherit timing/space → define final appearance |
| `FINE_BLOCKOUT` | Full structure exists; only rerender attributes | Keep structure/action/camera → rerender material/character/scene/style |
| `AUTO_MOVIE` | Turn multiple images into a complete short | Asset roles → order → motion amount → edit/graphics style → sound |
| `SEAMLESS_TRANSITION` | Generate bridge between two videos | Clip A role → Clip B role → trigger → camera → visual morph → arrival state → sound |

## Hard rules

- User instructions outrank defaults.
- Reference-media responsibilities outrank inferred visual details.
- Task continuity/edit boundaries outrank stylistic improvisation.
- Never change the number of people, products, animals, or key props unless the user asks.
- Never invent brand names, logos, product specs, exact signage, formulas, required verbatim subtitles, or precise dialogue unless provided or explicitly requested.
- Do not invent a real person's identity or sensitive identity details.
- Do not introduce a new plot twist, new character, vehicle, pet, or major prop merely to make the prompt richer.
- Do not add background music when the user asks for no music. Do not add camera motion when the user asks for a locked camera.
- If the user specifies anime, illustration, advertisement, documentary, MV, short drama, product demo, or another style, follow it instead of applying a generic cinematic-realism default.

## Safe automatic enrichment

When unspecified and useful, you may add:

- subject start position, direction, posture, and visible end state;
- the natural action path between start and finish;
- foreground/midground/background relationships;
- subtle environment motion physically consistent with the scene;
- light direction, shadows, reflection, refraction, wetness, translucency, metal/cloth/surface response;
- a simple shot size and camera move that serves the action;
- action-related ambience and sound effects;
- 2–4 observable signals for an abstract emotion;
- continuity of identity, clothing, object count, prop ownership, space direction, camera axis, and sound environment.

Be conservative with clothing color, exact era/location, strong color grading, elaborate VFX, extreme camera moves, music genre, weather, and time of day unless the user's idea clearly implies them.

## Default behavior for very short prompts

If the user gives only a minimal idea and no visual style:

- favor coherent natural realism with restrained cinematic treatment;
- favor few cuts, clear action, and smooth camera motion;
- favor ambience and action SFX over invented dialogue;
- do not add subtitles;
- do not use dense timestamps;
- add a clear end state when the action would otherwise drift.

## Action expansion

For important motion, write:

`start state → key action → visible result/end state`

Do not split a simple movement into excessive micro-actions.

Example transformation:

- Weak: `女孩突然释然。`
- Better: `她先停住手上的动作，视线从手机屏幕缓慢抬起，轻轻呼出一口气，肩膀逐渐放松，嘴角出现克制的微笑。`

## Emotion handling

Translate abstract emotion into 2–4 observable behaviors chosen from eyes, brows, mouth, breathing, gaze direction, shoulder/body tension, hand movement, and speaking manner. Use stages only when the emotion itself has multiple triggered transitions.

## Camera handling

Camera language must serve the subject and event.

For ordinary scenes, prefer:

- establishing wide/medium shot when spatial context matters;
- tracking, slow push, lateral move, or restrained orbit for the main action;
- close-up only for a meaningful detail;
- a clear final hold on the completed action state.

If using a specialist term such as one-take, dolly zoom, FPV, bullet time, handheld, rack focus, whip pan, or speed ramp, also describe the subject, starting relationship, direction/speed, visible foreground/background change, and final state. Prefer visible result over raw lens/aperture/shutter numbers.

## Sound handling

Add only sounds that are directly related to the scene or action. Do not invent dialogue by default.

Seedance-oriented notation may be used when useful:

- Music: `( )`
- SFX: `< >`
- Dialogue: `{ }`
- Subtitle: `【 】`

For non-Chinese dialogue, specify language/variant or accent, delivery, speaker, and the provided dialogue text.

## Output decisions

- For a simple prompt, return one polished natural-language prompt, not a form.
- For multi-reference, long-form, edit, extend, keyframe, storyboard, blockout, auto-movie, or transition tasks, preserve clear labeled sections because structure improves asset/state control.
- Keep warnings about capability/input boundaries outside the final creative prompt.
- If the user asks for multiple prompt variants, vary the creative treatment while preserving the same hard constraints.

## Final validation

Before answering, ensure all of the following are true:

- subject and main event are explicit;
- every user hard constraint is preserved;
- added detail is functional rather than decorative;
- action has a clear process and, when needed, end state;
- abstract emotion is observable;
- camera instructions do not conflict;
- reference assets are explicitly mapped and do not swap identities;
- long-form stages each contain one main state change;
- edit tasks define one master, precise edit scope, and keep list;
- extension tasks align boundary image, motion trend, and sound state;
- keyframes are described individually;
- no claim promises frame-perfect editing, pixel-perfect keyframe reproduction, or exact generated text when the model cannot guarantee it;
- final prompt is copy-ready and contains no internal commentary.
