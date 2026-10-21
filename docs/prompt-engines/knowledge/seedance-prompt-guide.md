SEEDANCE 2.5 PROMPT GUIDE

Eclipse notes from BytePlus' official "Dreamina Seedance 2.5 prompt guide" (pasted by the owner 2026-10-21; the original page is long and full of picture and video links, so it is NOT kept word for word: this is its rules, limits, techniques and fixes, reworded). It is read together with the Storyboard Director above. Where the Director's own rules (the owner's workflow, questions, locks and status block) say something different, the Director wins; this guide supplies what Seedance 2.5 itself responds to.

WHAT SEEDANCE 2.5 TAKES
- One video of 4 to 30 seconds, with sound, from text, pictures, video clips and sound clips in any mix, up to 50 references in all: up to 30 pictures (up to 4K), up to 10 video clips and up to 10 sound clips (clips and sounds together no more than 30 seconds each). Sound alone is allowed as a reference.
- It understands 11 languages in the prompt and in speech: Chinese, English, Spanish, Indonesian, Malay, Thai, Arabic, Portuguese, Vietnamese, Japanese and Korean.
- Compared with the previous version (2.0): it follows timestamps in whole seconds (2.0 only follows shot numbers), it accepts several views of one subject, it can make any aspect ratio from 0.4 to 2.5 when the references set it, and Edit and Extend keep colour, brightness and sound better.

LOCKED AND UNLOCKED JOBS
- LOCKED (the input decides the shape, so the person cannot choose it): Edit keeps the shape AND the length of the clip being edited (about 0.3 s shorter at most; clips from Seedance 2.5 itself keep their exact length); Extend keeps the shape of the clip being extended and the person chooses how many seconds to add; a start frame (and an end frame) keeps the shape of the start picture. Use an end picture with the same shape as the start picture, or it is stretched.
- UNLOCKED (references used only as meaning): reference pictures, clips and sounds, storyboards, keyframes. The person chooses shape and length.
- If an image is only SAID to be the first or last frame in the prompt (as a reference picture), the shape is not locked and the match is close, not exact. A real start frame is exact.

REFERENCE INPUT ADVICE
- Subjects from sound or video: 1 to 5 work best, 6 to 10 may work but are less stable; 5 to 10 seconds of input is best.
- Subjects from pictures: 1 to 8 work best, 9 to 12 may work less stably. With 1 to 5 subjects, single-view or multi-view pictures are both fine; with more than 5, use one single-view picture per subject, and give extra views as separate pictures, never several views in one picture.
- Storyboard sheets: 15 panels or fewer, simple stick-figure or line-art drawings, no text on the sheet.
- 3D clay-model clips: simple, coarse models (plain shapes for people, objects and animals) reference better than detailed ones.
- Edit clips: under 20 seconds is steadier. Edit with reference pictures: 1 to 5 pictures is best, 6 to 8 may work.
- Resize reference pictures so they are not bigger than the video's resolution: oversized pictures can leave fingerprint-like texture on grass and leaves.

HOW TO WRITE THE PROMPT
- Think like a visual storyteller. Order: subject + action or event + place and setting + style + camera + sound. Leave out parts that do not matter. Describe what you want (positive wording); only subtitles and audio take a "no ...".
- ONE-SENTENCE SUMMARY first (subject, place, event, style, camera), then the DETAILED PLOT by timeline or by shot, then ADDITIONAL NOTES for anything that must stay the same all through (camera angle, setting, sound, mood).
- ASSET REFERENCING: name each reference by the order it was added, "Image 1", "Video 1", "Audio 1", and say what it is for (who, voice, motion, place, style, lighting). Put the mapping in the prompt text, never only inside the picture (a name written on a picture is not enough: "John is at school" can mix characters up). Examples: "The knight in Image 1." "Images 1 and 2 are Character 1 and use Audio 1; Images 3 and 4 are Character 2 and use Audio 2." "Refer to the casting action in Video 1 and the wrap-around camera move in Video 2." "Refer to Image 1 for lighting and colour filter." If only part of a reference should be used, say which part. When the reference is already exact, say "follow Video 1's actions and camera, same order" and do not re-describe it.
- ORDER matters: add references in the order the subjects FIRST APPEAR, and number them to match. Mixed-up characters are usually caused by an order that does not match the story.
- TIMESTAMPS use whole seconds: "0-3 seconds ... 3-7 seconds ... 7-15 seconds", or "[1s-4s] ... [4s-8s]". No gaps between ranges. Too little plot in a range makes the model improvise; too much gives extra cuts or lost beats. Do not use timestamps for fast repeated actions ("shake the head three times a second"). Point-in-time ("at 5 seconds, a quick left wipe") and relative ("after 3 seconds everyone shakes their head") timing also work.
- SOUND markers in a prompt: music in (), sound effects in <>, spoken lines in {}, on-screen text in 【】. For speech in a language other than the prompt's, say the language before the line. Write a line once, with the performance note before it: "Granny Zhou's line (in disbelief): {...}". Repeating words after the line, or attaching tone or expression notes to single words, can make subtitles appear.
- NEGATIVE CONTROL that works: "no subtitles", "no BGM; only ambience and action sounds", "no audio".
- CAMERA: say it plainly: shot size (extreme wide, wide, medium, medium close-up, close-up), movement (push in, pull out, pan, track, follow, orbit, tilt, handheld), angle (low, overhead, first person), techniques (one take, dolly zoom, aerial, FPV, bullet time, speed ramp). For an unusual term add a short explanation ("rack focus: the focus slides from the tree in front to the person behind"). For a transition give the time and the method ("at 5 seconds a left wipe with a soft dissolve").
- ACTIONS: describe broadly ("several sets of high knees and somersaults", "close combat from both sides"); detail only a few memorable moves; do not repeat the same move. EXPRESSIONS: use descriptive sentences, not idioms.
- FIRST AND LAST FRAMES: prefer real start and end pictures (exact match). The prompt can still say "Image 3 is the first frame, Image 5 is the last frame" when they are reference pictures (close match).
- KEYFRAMES (the video must follow the pictures closely): add each keyframe as its own picture in order and start the prompt with "Use Images 1 to 7 in order as keyframes." Then describe the story. The length is the person's choice.
- STORYBOARD SHEET (one picture with many panels): it is a plot guide, not frame-exact. Steps: (1) state what each reference is; (2) one-paragraph story summary; (3) describe the plot per panel, filling in action, camera and style that the drawing cannot show, with timestamps if useful. A concept storyboard can use a short prompt: "Build the full story in the order of the storyboard and use the shots sensibly." Do not use cluttered, over-sharpened AI storyboards, and make sure the prompt does not contradict the drawing. For exact panels use keyframes instead.
- 3D CLAY-MODEL REFERENCE: say which parts of the clay clip to follow ("the camera move and motion of Video 1", or "the lighting changes, camera move and motion of Video 1"), say which model is which character or object ("the man in grey from Image 1 replaces the red model in Video 1"), and still describe the finished video in detail, consistent with the clay clip. For a finished-model clip to be re-rendered, give the look: setting, mood, sounds.
- EDITING: say exactly what changes and, where possible, from A to B, with seconds for partial edits. Start with "Edit the video" or "Video edit:" and use a clear verb (add, remove, replace, change). Examples: "Only edit the man's line in Video 1: change it to ... and give it an American accent." "Between 4 and 6 seconds of Video 1, change the man from drinking coffee to mopping the floor; leave the rest unchanged." "Replace the woman on the right in Video 1 with the woman in Image 1." To translate speech: "Translate every spoken line of Video 1 into Chinese, no subtitles, adjust the lips to match, keep everything else."
- EXTENDING: use "Extend Video 1 forward/backward", "Continue ...", "Continue the story ..." and say what happens in the added seconds.
- ONE-CLICK EDIT of many pictures: "Turn all the pictures into one video, order free, <style>, <audio feel>; the pictures may move slightly like live photos but must not be changed."
- TRANSITION between two clips: "Connect Video 1 and Video 2 seamlessly: at the end of Video 1 the camera flies up and dives down into Video 2, <what changes during the move>. Do not change the two clips."

FIXES FOR COMMON PROBLEMS
- Glowing eyes: add "normal human eyes, no glowing eyes" as a top-priority limit, and replace extreme feeling words ("fanatical", "extremely shocked") with calmer ones ("amazed").
- Wrong character for a reference: reorder references by first appearance and renumber the prompt to match.
- Misspelt on-screen words: split the word into letters that appear one by one ("the letters D, I, H, E, T, A, O appear in turn"), or supply the exact text as a picture reference ("referring to Image 2"), especially for Chinese.
- Subtitles appear anyway: keep dialogue lines clean (one line each, performance note in brackets before the line, no repeated words), make sure reference clips have no subtitles, and write "No subtitles of any kind" near the start and the end. It cannot be fully removed.
- Music appears despite "no BGM": state at the START and again at the end that only the listed dialogue and quiet ambience exist, and list the words: music, background music, BGM, score, instrumental, melody, soundtrack, synth, ambient pad, drone, swelling tone, crescendo, stinger. Otherwise remove the non-voice sound afterwards.
- Odd bubbling, echo or whistle sounds: remove water, wave and echo wording from the prompt.
- Edit comes out about 0.3 s short: switch to a reference job with the length chosen, or make the source clip's frame count 8n+1 (for example 161 frames).
- Changing a clip's aspect ratio with Edit adds invented picture: use a reference job with a detailed per-second description of the source and stress "every frame and every shot, same order, same timing, nothing missing".
- Mixed languages after translating speech: require ALL speech (also background voices, whispers, exclamations) to be translated, give the full new dialogue with times for each character, require word-by-word lip match, and say everything else stays unchanged.
- Hard jobs unstable: split into steps (for example first a reference job that makes the animation, then an Edit job that uses it as a reference).
- Style looks different from the previous version (2.0) with the same prompt: Extend a clip made by the previous version to keep its look.
- A JPG that will not load (odd colour subsampling): re-save it as a standard JPEG or PNG first.

SHAPE OF A GOOD LONG PROMPT (example)
"Realistic nature-documentary style, natural light. On a warm afternoon on a grassy forest slope a chubby panda cub rolls downhill. [Character, setting, camera: low-angle medium-wide, slight handheld, panda always in frame.] 0-3 s: ... 3-8 s: ... [Sound: only wind, rustling grass and the soft plop of the roll. Mood: warm, natural.]" — one-sentence summary, setting and camera notes, then timed beats, then sound and mood.

IF THE PERSON IS USING THE PREVIOUS VERSION (2.0) OF THE MODEL
- Limits are smaller: 4 to 15 seconds, up to 9 pictures, 3 video clips and 3 sound clips; a sound clip needs a picture or a clip with it (sound alone is not allowed); six fixed shapes (21:9, 16:9, 4:3, 1:1, 3:4, 9:16); up to 4K (sharp, but 4K files use a video format some browsers cannot play, they download fine).
- It does not follow timestamps, only shot numbers: write "Shot 1 ... Shot 2 ..." instead of seconds. Prefer one single-view picture per subject.
- References are named by type and order ("Image 1", "Video 1", "Audio 1") exactly the same way. Voice: `"Character" says: "line", voice timbre references Audio 1`.
- Edit and Extend work through the prompt with a reference clip: for Edit say what is added (what, when, where), what is removed (and what stays), or what replaces what; for Extend say "Extend Video 1 forward/backward" and what happens next, and add "and then end with Video 1" to keep the original footage; for a fill-in give 2 or 3 clips with the transition between them ("Video 1, then <transition>, into Video 2").
- A picture whose shape differs from the output can make frames stretch or jump: use a start picture cropped to the output shape.
