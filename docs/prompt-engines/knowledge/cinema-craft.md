CINEMA CRAFT

Eclipse notes written from the owner's "cinema" skill (the original SKILL.md is kept unchanged in docs/prompt-engines/knowledge/original/cinema-craft/). The original describes one tool's menus; here only the craft is kept and it is turned into words that go inside a prompt, so it works with any image or video model in Eclipse. YOUR DELIVERY RULES at the end say how to hand over your answer.

WHEN TO USE THIS
The person wants a cinematic look or a film shot: camera and lens choices, camera movement, lighting and colour grade, genre feel, speed changes, a multi-shot sequence, action or fight scenes, a hero frame or a storyboard.

HOW TO CHOOSE THE LOOK
Always decide for the person; never answer "it depends". Name the camera feel, lens character, focal length and aperture in one line with a one-line reason, then write them into the prompt as plain description (for example "shot on large-format digital, warm cinema prime lens, 50mm, f/1.4, shallow depth of field, creamy background").

Camera feel: premium large-format digital = ultra sharp, clean, modern (commercial, fashion, product). Classic 16mm film = grain, texture, organic warmth (drama, indie, period, horror). Modular 8K digital = high dynamic range, clean (nature, documentary, architecture). Full-frame cine digital = the cinematic standard, flattering (narrative, character, romance). Super 35 studio digital = industry standard (action, thriller, suspense). 70mm large-format film = epic scale, rich grain (spectacle, prestige).
Lens character: clinical sharp prime (no flaws, product and documentary); warm cinema prime (golden, skin-flattering portraits); classic anamorphic (strong flare, wide horizontal bokeh, prestige and fashion); compact anamorphic (oval bokeh, subtle flare, action and thriller); halation or diffusion (glow around highlights, romance, memory, dread); 70s prime (warm, soft, nostalgic); vintage prime (slight distortion, retro, horror); swirl-bokeh portrait (artistic portraits); tilt lens (selective focus, miniature or dream effect); macro (texture detail, food, product close-ups).
Focal length: 14mm wide and environmental (establishing, architecture, scale); 35mm natural human view (documentary, two-shots, candid); 50mm classic portrait compression (faces, products); 8mm ultra-wide with distortion (POV, disorientation).
Aperture: f/1.4 shallow, subject sharp and background creamy (intimacy, emotion); f/4 balanced and natural; f/11 deep, everything sharp (product, landscape, architecture).

Quick picks by intent. Warm intimate portrait: full-frame cine, warm cinema prime, 50mm, f/1.4. Prestige look: 70mm film, classic anamorphic, 50mm, f/1.4. Fashion editorial: large-format digital, classic anamorphic, 50mm, f/1.4. Nostalgia: 16mm, 70s prime, 50mm, f/1.4. Epic establishing: 70mm film, classic anamorphic, 14mm, f/4. Documentary: 8K digital, clinical prime, 35mm, f/4. Moody atmosphere: 16mm, diffusion lens, 35mm, f/4. Romance: full-frame, diffusion lens, 50mm, f/1.4. Tension: Super 35, compact anamorphic, 35mm, f/4. Horror: 16mm, vintage prime, 35mm, f/4. Action: Super 35, compact anamorphic, 35mm, f/4. Product packshot: large-format digital, clinical prime, 50mm, f/11. Interior: 8K digital, clinical prime, 14mm, f/11.

CAMERA MOVEMENT
Use plain film words and one movement per shot: static (locked off: dialogue, tension), handheld (urgency, realism), push-in or zoom in (intensity), pull-out or zoom out (revelation, isolation), dolly in (intimacy), dolly out (distance, context), tracking or camera follows (chase, accompaniment), pan left or right (reveal, scan the space), tilt up (scale, aspiration) or tilt down (weight, consequence), orbit around the subject (isolation, drama), crane or jib up (scale, god's-eye) or down (arrival), drone aerial (geography), lateral dolly left or right (parallel tracking), roll (stylised disorientation). If the video model has its own camera setting, use that and keep the movement out of the prompt text.

LIGHT AND GRADE
Say the light source and quality (hard or soft, key direction, practical lights, golden hour, overcast, neon), then the grade: colour temperature (warm or cool), contrast, saturation, grain, bloom or glow. Grade the first frame, then describe later frames as "the same grade". Genre starting points: action = hard high-contrast light, desaturated cool; horror = low-key, harsh shadows, desaturated with a teal-green tint; comedy = bright even light, warm and saturated; western = golden dusty light, amber; suspense = low-key motivated light, cold and muted; intimate = soft warm light; spectacle or epic = dramatic contrast, bold saturated colour; noir = hard shadows, near-monochrome; drama = naturalistic, motivated light.

SPEED
Describe time as well as space: normal speed; slow motion for impact or emotion; speed-up for montage or passing time; a slow-then-snap "impact" beat at the key moment; a held "hero moment" (slow build, dramatic pause, release). Pick one speed idea per shot.

SEQUENCES AND STORYBOARDS
- One transformation per shot: one place to one place, one beat to the next, one action to its consequence. If the script has several beats, cut it into several shots.
- Start with a hero frame (the best single image of the scene), grade it, and reuse it as the reference for the other shots so faces, wardrobe and the look stay locked.
- Name each character once by a short visual tag ("the man in the leather jacket") and reuse the same tag in every shot; end each shot by saying who is where.
- Plan each generation as if it is the deliverable; do not rely on generating twenty and choosing one.
- Places that hide small drift: circular arenas, ruins, forests, dunes, colonnades, fog, dust and smoke. Places that expose it: famous landmarks, strict geometric corridors, signage and lettering, mirrors and glass.

ACTION AND FIGHTS
Models render standoffs, near-misses, the moment before contact, the aftermath, bodies moving through a space, someone walking away, someone pinned against a wall, someone falling. They fail at a punch connecting, kicks, martial-arts choreography, exact cause and effect, props used as weapons and close grappling (it reads as embracing). So describe the energy, not the moves, and cut around contact: a sequence of standoff, first exchange (energy only), escalation (bodies, speed), close-up moment, the finish (someone goes down), resolution (hero walks away). When two characters share a prompt the model may swap which is the hero: put the hero first and anchor positions at the end of each shot.

PROMPT HYGIENE
Keep prompts short and visual: scene, subject, action, light. Some models cap the prompt near 500 characters; when you do not know the cap, keep the main prompt well under 500 and put extras in separate shots. Do not invent setting names, camera menus or version names that are not in the person's studio; speak in plain film terms.

YOUR DELIVERY RULES (Atlas, Cinema Craft)
- Lead with one line of the look you chose and why (body, lens, focal length, aperture, light, grade, movement), then the prompt in its own code block with those choices written in as description.
- The first shot or the hero frame also goes through suggest_prompt so it fills the prompt box. For a sequence give one prompt per shot, numbered, each in its own code block.
- Stay inside the model's prompt limit shown in the context.
