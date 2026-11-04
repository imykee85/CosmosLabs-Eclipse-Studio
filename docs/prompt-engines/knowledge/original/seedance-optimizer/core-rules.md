# Seedance 2.5 Core Prompt Rules

Use this reference for every optimization task.

## 1. Base formula

Build ordinary text-to-video prompts from the following components, omitting any unnecessary component:

**主体 + 动作或事件 + 场景与环境 + 视觉风格 + 运镜或切镜 + 声音**

- Subject + action/event: who/what does what; detail only key actions.
- Scene/environment: place, time, weather, spatial relationship, background state.
- Visual style: light, color, material, image texture, atmosphere.
- Camera/editing: shot size, angle, movement, focus, shot transition.
- Sound: dialogue, timbre, ambience, action SFX, music.

A practical skeleton:

```text
<主体>在<场景与环境>中<主要动作或事件>。
画面呈现<视觉风格>。
镜头采用<景别、机位、运镜或切镜>。
声音包括<对白、环境声、音效或音乐>。
```

Do not force all fields when they add no value.

## 2. Information priority

Apply information in this order:

1. explicit user requirements;
2. explicit reference-media responsibilities;
3. task-specific edit/continuity boundaries;
4. reliable contextual inference;
5. low-risk defaults.

Lower-priority content must never override higher-priority content.

## 3. Auto-enrichment policy

### Safe to infer when useful

- starting position/direction/posture;
- natural motion before/after the key action;
- visible completion state;
- relevant background state and subtle environmental motion;
- physically plausible lighting/material response;
- simple executable camera grammar;
- direct ambience/action SFX;
- 2–4 observable emotion signals;
- continuity for identity, count, clothing, prop ownership, spatial direction, camera axis, and sound.

### Infer cautiously

- precise clothing style/color;
- country/city/era;
- strong color palette;
- complicated VFX or extreme camera moves;
- background music style;
- exact weather/time of day.

### Do not invent by default

- brand/logo/model/specification;
- exact text, signage, formula, UI copy, mandatory subtitles;
- dialogue the user did not supply;
- real-person identity or sensitive identity attributes;
- major plot twists;
- extra characters, animals, vehicles, products, or key props;
- any change to the user's subject count, relationship, product structure, or core scene.

## 4. Observable emotion

Do not leave emotion as only `紧张 / 温馨 / 压抑 / 兴奋 / 释然 / 悲伤` if the user expects controlled performance.

For a single transition, use 2–4 observable behaviors. Good channels include gaze, brows, mouth, breathing, shoulders/body tension, hands, and speaking manner.

Pattern:

```text
整体情绪从<起始情绪>转为<结束情绪>。
发生<触发事件>后，<主体>先出现<即时可观察反应>。
随后，<2–4个可观察表现>逐渐变化。
最终，以<动作/表情/说话方式>表现<目标情绪>。
```

## 5. Camera clarity

Common shot vocabulary may be written directly: wide, full, medium, close-up, extreme close-up; push, pull, pan, truck, follow, orbit, dive, pull-back, tilt, handheld; low angle, top-down, first-person.

For specialist or ambiguous camera terms, write both the term and its visible behavior:

`术语 + 作用主体 + 画面变化 + 前景/背景关系 + 方向或速度 + 最终状态`

Example:

```text
移焦：焦点从前景树叶平滑转移到背景人物。树叶逐渐虚化，背景人物面部由模糊变清晰。
```

## 6. Sound syntax

Natural language is sufficient. When category separation helps, use:

- music: `(背景播放舒缓钢琴乐)`
- SFX: `<远处传来钟声>`
- dialogue: `{你好，欢迎回来}`
- subtitle: `【第一章：启程】`

For non-Chinese speech, specify language + regional variant/accent + delivery + speaker + `{text}`.

If the user asks for no music, preserve dialogue/ambience/SFX only as requested. If the user asks for no sound, do not invent any sound.

## 7. Long-form timing

Prefer stages for normal narrative. Use timestamps only for important handoffs, entrances/exits, transitions, or clearly timed beats.

- Time ranges must be continuous and non-overlapping.
- A time range is a budget, not a frame-perfect edit point.
- Do not request unrealistic frequency such as several complex actions in one second.
- Do not overload one interval with many main events.

## 8. Capability boundaries

Do not promise:

- frame-perfect timestamps;
- frame-identical video editing;
- every reference asset appearing at once;
- exact generated subtitles/formulas/signage/product parameters;
- pixel-identical first/last or keyframe reproduction;
- seamless transition as a literal pixel-preserving cut.

For exact text/parameters/frame points, recommend a workflow combining prepared assets, video generation, and post-production.

## 9. Platform/input boundaries from the supplied guide

When relevant, warn outside the creative prompt:

- total reference assets: up to 50;
- images: up to 30, each up to 4K;
- videos: up to 10, combined duration up to 30 seconds;
- audio: up to 10, combined duration up to 30 seconds;
- video editing is recommended with source video within about 20 seconds and roughly 1–5 reference images for better stability;
- editing keeps source aspect ratio and approximately source duration, with possible small duration variance;
- first/last-frame generation uses the first frame's aspect ratio; first and last images should match aspect ratio;
- extension keeps the source video's aspect ratio, while extension duration is configured separately.
