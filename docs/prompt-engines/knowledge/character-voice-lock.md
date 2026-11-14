CHARACTER VOICE LOCK

Eclipse notes written from the owner's "Character Voice Lock" method (the brief is kept unchanged in docs/prompt-engines/knowledge/original/voice-lock/brief.md). Use it when a person wants a character to keep ONE consistent voice across every shot of a Seedance 2.5 video, or when a voice changes between shots. You write prompts and hand them over with suggest_prompt; you never render anything and never say a voice is locked before it has been heard.

WHY IT WORKS
Seedance picks a voice partly from the character's FACE. Words like "deeper" or "rougher" often cannot override that, and a voice described only in text drifts between shots. An AUDIO REFERENCE holds. So: describe the voice, test cheaply with text only, and if that fails supply a real audio reference and attach it to every shot where the character speaks.

WHAT IS AVAILABLE IN ECLIPSE
- Seedance 2.5 in Video Studio takes reference sounds (up to 10): the person's Audio Studio takes and sounds uploaded in Assets, added from the Ingredients picker's My audio tab. They are numbered in the order added: write "audio 1", "audio 2", and "image 1" for pictures, never @ tags.
- Reference sounds are connected but NOT yet verified live with this method: say so once, and if a test shows the audio reference is ignored, tell the person plainly. Steps 1, 2 and 7 (voice brief, text test, direction rules) never need it.
- Storing the voice: tell the person to save the final clip in Assets as a sound named like KNIGHT_voice_v1 (Assets, Upload) and to keep the voice brief next to the character (Memory, topic Characters, which you can write with remember). There is no automatic attaching yet: they add the sound in Ingredients on each speaking shot, and you remind them to.
- Step 5 (an effect such as a mask or radio) is a manual step in audio software; say so. You have no tool for it.

RULES (always)
1. Write plain, specific prompts that describe what the camera sees and what the audience hears.
2. Every reference line states its purpose and that it is never a shot ("voice only, never a shot").
3. NEVER recreate a real, identifiable person's voice. Describe its qualities and build an original voice, changing at least two qualities when working from a reference clip.
4. After every test, ask what they heard before moving to the next step.
5. Use the names the references have in Eclipse (image 1, audio 1...), never tags from another tool.
6. Work through the steps in order; skip steps once the voice is right (cheapest test first).
7. Test at the resolution they will finish at; low-resolution tests are unreliable.
8. Never claim a voice is locked until the same prompt has produced the same voice 2 to 3 times.

STEP 0: ASK FIRST (only what is missing, one short message)
The character sheet or a description of the look (note anything covering the face: helmet, mask, fur, beak); who the character is and what they want; 3 to 5 lines they will say; voice qualities (age, accent, pitch, pace, attitude); any effect (mask, helmet, radio, creature); optionally a short clip of a real voice they like (you describe its qualities and build an ORIGINAL voice from it).

STEP 1: THE VOICE BRIEF
Two short paragraphs: age, pitch, timbre, accent, pace, breath, texture, and how the voice changes under stress. It goes into EVERY prompt for this character, even after the voice is locked.

STEP 2: THE CHEAP TEST (Template A)
Text only: character sheet + voice brief + one line. Run the same prompt 2 to 3 times at 5 to 8 s, at the finishing resolution. Right and consistent every time: go to Step 6. Generic, robotic or different each time: Step 3.

STEP 3: A HUMAN REFERENCE
They record a real person (themselves, a friend, an actor) reading the character's lines in character: 10 to 15 s, quiet room, phone close to the mouth, no music, no echo. Several lines with different energy beat one line repeated. It may sound silly; human timing is what makes the AI voice feel alive. Give Template B with the clip attached; run 2 to 3 tests. Right: Step 5 if an effect is needed, else Step 6. Better but wrong (too nice, too young, too clean): Step 4.

STEP 4: CAST A VOICE DONOR
If the face conflicts with the voice they want, make a DIFFERENT character whose face suggests that voice (age, build, scars, expression), as a close-up with the mouth clearly visible, a simple dark background and a microphone in front for cleaner audio. Template C (three lines, 2 s pause between) or C2 (one 30 s generation, the same line six ways). Extract the audio, clip the best 10 to 15 s and use it as the reference for the real character. Examples: a scarred, furious Viking as donor for a masked knight; a weathered old storyteller for a wise creature. Optional extra, not part of the original method and not yet proven as a Seedance reference: make the reference voice in Audio Studio with a voice model and use that take; offer it as an option and test it first.

STEP 5: PROCESS THE VOICE ONCE
Only for effects no prompt can make (mask, voice box, radio, giant creature). They drop pitch, EQ and filter ONCE in audio software and export a clean 10 to 15 s file; Seedance then keeps the effect in every shot. Keep it subtle so every word stays clear.

STEP 6: LOCK AND STORE
Cut the final ~10 s voice clip, name it (KNIGHT_voice_v1), save it in Assets, attach it as the reference sound on every shot where the character speaks (Template B or D), and keep the voice brief in the prompt too. A reference sound costs far less than a video character sheet; use video sheets only when likeness or costume keeps drifting.

STEP 7: DIRECT THE PERFORMANCE (every speaking shot)
- Fewer lines per generation; too many words in 30 s makes characters speed-talk: cut lines or split the scene.
- Dialogue word for word: number the lines, say who speaks each and how, and state these are the ONLY words in the clip.
- Real pauses: action beats between lines (a breath, a glance, a hand on the table).
- An intention per line (what the character wants from the other person).
- Name the accent AND the accents to avoid ("General American, NOT British"; for Ghanaian characters "Ghanaian English accent, NOT British, NOT American, NOT Nigerian").
- No music in the audio line, so a score does not bury the voice.

TEMPLATES (fill the brackets; use the person's own words)
A. TEXT-ONLY VOICE TEST (6 s, single shot)
[CHARACTER] VOICE TEST - 6s - SINGLE SHOT
Image 1 is the character sheet: look only, never a shot.
VOICE: [voice brief]. Accent: [accent], NOT [accent to avoid].
Handheld medium close-up of [CHARACTER] in [simple location], [lighting]. A natural breath first, then [he/she] says, word for word: "[line]". Precise lip sync.
AUDIO: dialogue and quiet room tone only. No music, no subtitles, no on-screen text.

B. VOICE LOCK BLOCK (paste into EVERY shot where the character speaks)
Audio 1 is [CHARACTER]'s voice only. Take its exact timbre, pitch and accent. Never its picture, framing, wardrobe or performance. It is never a shot.
VOICES: [CHARACTER] speaks with exactly the voice in audio 1 (same timbre, same pitch). Accent: [accent], NOT [accent to avoid]. Delivery: [two or three words, e.g. low, dry, controlled]. Natural breaths before lines.

C. VOICE DONOR READS THE LINES (15 s)
VOICE DONOR - 15s - SINGLE SHOT
[Donor description designed for the target voice: age, build, scars, expression]. [Dark room, one light source]. Tight handheld close-up, mouth clearly visible, an old microphone in front.
The donor reads three numbered lines in order, 2 seconds of pause between them: 1. "[line]" 2. "[line]" 3. "[line]". Delivery: [e.g. low, hoarse, barely holding back rage]. Accent: [accent].
AUDIO: the donor's voice and quiet room tone only. No music, no echo, no subtitles.

C2. ONE LINE, SIX DELIVERIES (30 s)
VOICE DONOR, DELIVERY RANGE - 30s - SINGLE SHOT
[Same donor description as C].
The donor says the line "[line]" six times: 1 quiet threat, 2 barked order, 3 tired contempt, 4 amused, 5 slow and deliberate, 6 full rage. 2 seconds of silence between each. Same voice every time; only the delivery changes.
AUDIO: the donor's voice and quiet room tone only. No music, no subtitles.
Then clip the best 10 to 15 s as the reference.

D. THE LOCKED SHOT (character sheet + processed voice)
Image 1 is the character sheet: look only (e.g. armor), never a shot.
Audio 1 is the exact voice, including the [effect, e.g. metal mask filter]. Never its picture. Never a shot.
VOICES: [CHARACTER] speaks every line with exactly the voice in audio 1, effect included. Accent: [accent]. [CHARACTER] never needs to shout.
Handheld low-angle medium close-up in [setting], [lighting and atmosphere]. [CHARACTER] takes one step toward the camera, pauses, then says, word for word: "[line]". Two seconds of silence, with a physical reaction (e.g. a helmet tilt).
AUDIO: dialogue, footsteps, ambient sound. No music, no subtitles, no on-screen text.

E. TWO CHARACTERS, TWO LOCKED VOICES
Audio 1 is [CHARACTER 1]'s exact voice and accent only. No picture, face, framing, wardrobe, lighting or performance. Never a shot.
Audio 2 is [CHARACTER 2]'s exact voice and accent only. Same exclusions. Never a shot.
DIALOGUE, WORD FOR WORD (these are the only words in the clip, no overlap, real pauses between):
1. [CHARACTER 1] ([delivery note]): "[line]"
2. [CHARACTER 2] ([delivery note]): "[line]"
3. [CHARACTER 1] ([delivery note]): "[line]"
4. [CHARACTER 2] ([delivery note]): "[line]"
VOICES: each character speaks with exactly their own reference voice (timbre, pitch, accent). [CHARACTER 1] accent [accent], NOT [avoid]. [CHARACTER 2] accent [accent], NOT [avoid]. Natural breaths before lines.
PERFORMANCE: both characters breathe and are never frozen between lines. Small actions fill the gaps (blinks, glances, busy hands). [One character's] eyes stay on [an object] while the other speaks.
STRICTLY EXCLUDE: extra or invented words, overlapping speech, the wrong accent for either character, music, subtitles, on-screen text.

F. SHEET IMAGE (optional video character sheet, stage 1; make it in Image Studio)
[CHARACTER] SHEET IMAGE - TWO PANELS
Input images in this order: 1 character, 2 hair texture, 3 skin texture, 4 background texture, 5 t-shirt texture. (The numbers must match the real order the pictures are attached.)
RIGHT panel: highly detailed half-body portrait, fine skin and hair detail. Hair texture from image 2 adapted to the character. Skin texture from image 3 with skin tone [paler / warmer / same as original]. T-shirt from image 5, background from image 4.
LEFT panel: full-length photo of the character, kept the same as the original.

G. VIDEO CHARACTER SHEET (optional, stage 2: 10 s, 16:9, sound on, one intro line; only when likeness or costume keeps drifting)
[CHARACTER] VIDEO CHARACTER SHEET - 10s - SPLIT PANEL 16:9 - STATIC CAMERA, STUDIO
Image 1 is the sheet image: appearance only; keep its two-panel layout; not the first or last frame.
FORMAT LOCK: 16:9 frame split vertically into two equal panels, a thin seam that never moves. The same character in both.
STUDIO LOCK: only the character and a plain backdrop (background texture from image 1). No equipment, crew, props or floor marks.
RIGHT PANEL LOCK: one unbroken take 0 to 10 s; only breathing, eyes and speech change.
CONTINUITY LOCK: one character, identical face, hair, skin and outfit throughout. No cloning, no extra people.
TECH SPEC: photoreal live-action, not animated, not CGI. Soft front-left light with an edge glow. Matte skin, natural colour, even exposure.
CAMERA: static, locked off in both panels. No push-in, drift or zoom.
RIGHT PANEL (0-10s) INTRODUCTION: half-body, centred, facing the lens. Still until 2.5 s, then speaks the line at normal pace with a short pause after the first word. [Delivery note].
LEFT PANEL, SHOT 1 (0-5s) THE TURN AROUND: full-body wide; the character turns on the spot in about six steps, feet doing the turning. Silent hard cut at 5 s.
LEFT PANEL, SHOT 2 (5-7s) OUTFIT: static close-up of the outfit.
LEFT PANEL, SHOT 3 (7-8.5s) HANDS: static close-up of one hand and forearm.
LEFT PANEL, SHOT 4 (8.5-10s) DETAIL: static close-up of the most distinctive remaining detail.
VOICE LOCK: [voice brief]. Accent [accent]. Normal speaking rate. Same speaker for the whole line.
DIALOGUE LOCK: the single line "Hi... this is me. This is how I look, and this is how I sound." Spoken once, starting at 2.5 s, no ad-libs. 15 words, about 7.4 s. Do not change or lengthen it.
SPEECH LOCK: from 2.5 s to the end the voice is the only sound. No effects, footsteps, cloth or cuts over the words.
SOUND: dry, close-mic studio dialogue. Only before the line (0 to 2.5 s): soft room tone and the first footsteps of the turn. No music, subtitles, captions or on-screen text.

TROUBLESHOOTING (use after each test)
- Voice changes between shots: run the same prompt 3 times before changing anything; confirm the reference sound AND the lock block are on the shot.
- Characters talk too fast: too many lines for the length; cut lines, add seconds or split into two generations.
- Echo or "AI wash": often the character picture (a darker or meaner-looking sheet can change the voice); retest with a cleaner sheet before touching the audio.
- "Deeper" or "rougher" does nothing: the face controls the voice; go to Step 4.
- Accent slips: name the accent in the voice block and list accents to avoid in the exclusions.
- The reference appears as a shot: add "voice only, never a shot" to EVERY reference line.

YOUR DELIVERY RULES (Atlas, Character Voice Lock)
- Hand each prompt over with suggest_prompt so it fills the person's prompt box (one prompt per reply); set_prompt_box for the length, aspect ratio and quality you agreed. Keep within the prompt limit of the model in the box. They press Generate.
- Offer this when a scene has a speaking character; ask for the Step 0 inputs, one short message at a time, with a recommendation instead of a menu.
- You cannot hear audio: after every test ask what they heard, and never judge a voice yourself.
