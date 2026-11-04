# Seedance 2.5 Task Templates

Load the sections relevant to the current task. Do not force every field into every prompt.

## Multi-reference creation

Goal: make the model know exactly which asset defines which person, prop, scene, action, camera, or sound.

Recommended order:

`逐份素材职责 → 主体映射 → 按类型分组 → 主体设定 → 分场景调用`

Basic mapping:

```text
@图片1用于<主体>的<外貌、服装、结构或材质>，不采用<无关背景/人物/构图>。
@视频1用于<动作、运镜或节奏>，不采用<无关人物身份、服装或场景>。
@音频1用于<角色或声音类型>的<音色、台词、环境声或音乐>。
```

Never write only `@图片1至@图片4分别定义四名角色`. Bind each person/product/prop individually.

For multiple views of one subject:

```text
@图片1定义同一主体的正面。
@图片2定义同一主体的左侧结构。
@图片3定义同一主体的右侧结构。
三张图片共同定义同一个主体，成片中始终只有一个该主体。
```

If a reference video already accurately defines action, camera, and order, state what to inherit without redundantly rewriting each action.

## Long video / multiple events

```text
【生成目标】
生成一段<视频类型>。核心主体是<主体>，主要事件是<故事概要>。

【阶段一】
开始时：<初始状态>。
主要事件：<一个主要动作或事件>。
结束时：<人物位置、道具归属或可观察状态>。

【阶段二】
承接上一阶段：<需要保持的状态>。
主要事件：<一个主要动作或事件>。
结束时：<可观察状态>。

【阶段三】
主要事件：<收束事件>。
结束时：<最终画面状态>。

【保持一致】
保持<人物身份、数量、服装、道具归属、空间方向和声音关系>稳定。
```

Each stage should contain one main state change.

## Video editing

Always define the source as the unique master.

```text
【编辑目标】
编辑@视频1，在<全片或明确时间段>对<对象/区域/声音类别>进行<增加、移除、替换或调整>。

【原视频职责】
@视频1是唯一编辑母版，负责<人物、场景、动作、构图、镜头、遮挡关系、声音和事件顺序>。

【目标素材职责】
@图片1或@音频1用于<目标对象或声音的指定属性>。

【编辑范围】
只处理<对象、区域、时间段或声音类别>。

【保持内容】
保持@视频1中的<不应变化的画面、动作、声音和时间关系>。
```

### Object replacement

Also state:

- exact original object and target object;
- target object count across the full clip;
- target inherits original object's appearance times, motion path, speed change, occlusion, and exit timing;
- all non-target content remains source-master content.

### Background replacement

State that only the background outside the subject silhouette changes, unless the user asks otherwise. Define what the new image contributes: layout, material, depth, environment color, or light direction.

### Sound edit

Treat dialogue, language, voice timbre, background music, ambience, and SFX as separate categories. When one changes, say whether the others remain.

## Video extension

### Extend after source

```text
@视频1是需要向后延长的原视频。

向后延长@视频1。延长片段的第一个画面直接承接@视频1尾帧：保持<主体姿态与朝向>、<道具位置>、<背景与空间关系>、<机位与构图>、<光线>、<声音状态>和<运动趋势>连续。

随后，<新的动作、事件、镜头或声音>。

延长过程中保持<人物身份与服装>、<关键道具>、<背景布局>、<摄影轴线>和<原有声音环境>连续。
同一主体始终为同一个连续对象，不重复、不分裂；人物外形和物体部件数量保持稳定。
```

### Extend before source

```text
@视频1是需要向前延长的原视频。

向前延长@视频1。在原视频开始之前，<前置动作、事件、镜头或声音>。

延长片段的最后一个画面自然衔接@视频1首帧：<主体姿态与朝向>，<道具位置>，<背景与空间关系>；保持<机位与构图>、<光线>、<声音状态>和<运动趋势>与@视频1首帧一致。
```

If some reference materials are only supposed to appear after the original clip begins, explicitly keep them out of the forward-extension segment.

## First and last frame

Describe anchors separately.

```text
@图片1作为首帧，定义视频开始时的构图、主体位置、姿态、道具状态、场景和镜头方向。
@图片2作为尾帧，定义视频结束时的构图、主体位置、姿态、道具状态、场景和镜头方向。
@图片3用于<主体A>的<外貌、服装、结构或材质>，不改变首尾帧构图。

<描述一个连续动作或事件>。
画面从@图片1定义的首帧自然开始，经过连续动作后到达@图片2定义的尾帧。
首尾之间保持<人物身份、道具结构与归属、场景布局和镜头方向>连续。
```

First and last images should use the same aspect ratio.

## Multiple keyframes

```text
以@图片1至@图片N的顺序作为关键帧。

@图片1作为首帧，定义<开始状态>。
@图片2定义第二个关键帧：<第一阶段结束状态>。
@图片3定义第三个关键帧：<第二阶段结束状态>。
@图片N作为尾帧，定义<最终状态>。

画面依次经过这些关键状态，各阶段之间使用连续动作自然过渡。
全过程保持<主体身份、道具结构与归属、场景布局、光线和摄影轴线>连续。
```

Treat keyframes as ordered states, not frame-by-frame replicas.

## Storyboard / grid board

```text
@图片1提供<N格宫格分镜>的镜头顺序和大致构图，按照<读取顺序>读取；不采用图中的<线稿画风、文字标注或占位人物>。
@图片2定义<主体A>的<外貌与服装>。
@图片3定义<关键道具或场景>的<结构、材质或光线>。

镜头1：<景别、主体动作、场景状态>。
镜头2：<景别、主体动作、运镜或切换方式>。
……
镜头N：<结束动作和结束画面状态>。

最终画面采用<视觉风格>，声音包括<对白、环境声、动作音效或音乐>。
```

Use the board for sequence and approximate composition; do not demand strict reproduction of every panel detail.

## Coarse blockout

```text
@视频1是粗粒度白模参考，仅提供<动作路径、人物站位、机位、运镜、切镜、光影变化、声音节奏或空间关系>，不采用白模外观、材质和场景。
@视频1中的<白模主体A>对应<主体A>。
@视频1中的<几何道具B>对应<关键道具B>。
@图片1定义<主体A>的<外貌、服装或结构>。
@图片2定义<主体B/道具/场景>的<指定属性>。

<主体>在<场景>中完成<主要动作或事件>。
保持@视频1中的<动作路径、站位、运镜、切镜、光影或声音节奏>。
最终画面采用<人物、场景、材质和视觉风格>。
```

Map every important blockout geometry separately.

## Fine blockout

```text
@视频1是细粒度白模参考，保持<主体结构、动作、空间布局、机位、运镜和切镜>，不采用原有灰模材质和空白背景。
@图片1定义<主体>的<人物形象、材质、颜色或表面细节>。
@图片2定义<场景>的<空间、材质、光线或视觉风格>。

将@视频1中的<主体>重渲染为<最终主体>，场景重渲染为<最终场景>。
保持@视频1中的<结构、动作、镜头和空间关系>。
```

## Auto-movie from stills

```text
【素材职责】
@图片1用于<开场/人物/商品/场景>。
@图片2用于<过程画面>。
@图片3用于<结尾画面>。
@视频1仅用于<剪辑节奏/转场/字幕包装/音乐风格>，不采用其中的人物身份和场景（如适用）。

【编排方式】
图片按照<指定顺序/上传顺序/主题自由编排>出现。
<需要保持的人物、商品、地点和事件关系>。

【画面动态】
每张图片采用<轻微Live动效、视差、推拉、横移或局部动作>。
保持<主体外观、商品结构、文字或背景关系>稳定。

【成片风格】
采用<剪辑节奏、转场方式、字幕或图形包装、色彩风格>。

【声音】
包括<对白、环境声、音效或音乐>。
```

If image order matters, name the order explicitly. If free ordering is allowed, explicitly say `可按主题自由编排`.

## Seamless transition

```text
@视频1是转场前片段，采用其<尾部主体、动作、构图、镜头方向和声音>。
@视频2是转场后片段，采用其<开头主体、构图、镜头方向和声音>。
保持两段原视频中的<人物身份、商品结构、场景和主要动作>稳定。

在@视频1尾部，<主体或前景物>通过<动作>触发转场。
镜头<运动方向和速度变化>，画面中的<形状、材质、光线或空间>逐渐变化为@视频2开头的<对应元素>。
转场结束时自然到达@视频2开头构图，并保持<主体位置、镜头方向和运动趋势>连续。
声音从<前段声音>平滑过渡到<后段声音>。
```

Useful transition families include dive/return, character rotation, foreground occlusion, object morphing, and push/pull or focus changes. Always describe the visible transformation rather than naming an effect alone.
