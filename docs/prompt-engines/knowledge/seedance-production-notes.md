SEEDANCE 2.5 PRODUCTION NOTES

Eclipse notes in our own words, written after reading the owner's "seedance-25" skill (the original and its references are kept unchanged in docs/prompt-engines/knowledge/original/seedance-production/). It adds a production method on top of the director, the guide and the optimizer above: pick the task path, bind every reference to a role, compile in a fixed order, and repair with one change at a time. Where it disagrees with Eclipse's own limits or numbering (we call attachments "image 1", "video 1", "audio 1" and run 480p to 1080p), Eclipse's facts win.

1. TRUTH BOUNDARY
- State only what is known for this model and this screen. Never carry numbers from the previous version over to 2.5. Never say you watched, heard or measured an attachment you cannot inspect: say "you told me" for descriptions and "I can see" only for what you really looked at.
- Different apps and providers expose different subsets. When unsure whether a mode exists in the person's screen, say so and offer the nearest one that does.

2. MINIMUM BRIEF (ask one short question only if a missing answer would change the result; otherwise use a safe default and say it)
- Goal (what the viewer sees or feels), task path, length, aspect ratio and quality (these are settings, not prompt words), what each attachment can contribute, what must stay the same and what may change, sound (language, speaker, delivery, effects, music or silence), and whether the person has the right to use every face, voice, brand and track.

3. PICK THE TASK PATH
Clear single shot: one visible event and one camera move. References: give every asset one role and its exclusions. Several events inside 30 seconds: stages, each with one state change and a visible end state. Longer than 30 seconds: several clips, each generated on its own. Change existing footage: name one master video, what changes and what is preserved. Continue footage: write from the real last frame and any motion still open. Two endpoints or several states: define every anchor separately and connect them with one continuous action. Storyboard sheet or grey blockout: say whether it controls motion or the full shape. Transition between clips: define the trigger, the motion that carries across, the arrival state and the sound bridge. A failed take: find the cause, then change one thing.

4. THE REFERENCE ROLE MAP (do this before any creative writing)
- Give each asset ONE main role: identity, wardrobe, product shape, place, first frame, last frame, motion, camera, pacing, sound or style. Add what it must NOT transfer ("use the choreography only, not the performer, clothes, room or logo").
- Name and bind each important person, product and prop individually; never "images 1 to 4 are four people". Pick references per scene instead of forcing every asset into every shot. When several views show one subject, say so and fix the count of subjects.
- One owner per dimension: if two assets disagree about the same thing, name the winner and what you give up. An asset that controls nothing is removed. A maximum is not a target.
- Priority when things conflict: safety and rights, then what the screen really allows, then the person's must-haves, then the reference roles, then continuity, then readable action, then camera, then decoration.

5. COMPILE IN THIS ORDER
Reference roles, goal, subject and main event, scene or stage progression, camera, light and look, sound, continuity and exclusions.
- Subject and action first. Replace "premium", "stunning" and "cinematic" with things you can see: an action with a start state, a trigger, a change and a visible end state.
- One main camera move by default, with its start, what it follows, its direction, speed change and end point. One physical light source with a direction and what it does to the subject. Emotion becomes two to four visible or audible cues (gaze, brow, mouth, breath, hands, posture, delivery).
- If a reference already controls motion or camera, say only what to inherit; do not describe a competing move. Prefer stages to exact seconds; use seconds only for a key handoff, entrance, exit or beat, in consecutive, non-overlapping ranges, and treat them as budgets, not exact edit points.
- Text, logos, formulas and exact timing are best prepared as pictures or added afterwards.

6. FIRST DECIDE WHAT KIND OF PROBLEM IT IS
Keep (the main goal worked), fix afterwards (colour, captions, sound mix, trim, a few unstable end frames), edit instead of regenerate (composition and timing are right, one layer or one sound is wrong), re-roll (the prompt is sound and the miss looks like chance; stop after two or three repeats), or rewrite (the same defect in two takes: find the mechanism first). Do not polish decoration once the main goal works.

7. ONE CHANGE PER RETRY
Change exactly one thing: one sentence, or the seed, or the mode, or one reference, or one setting. Set a retry budget and what "good enough" means before generating; if there is no progress by half the budget, change strategy (split the shot, fewer subjects, another mode, remove a conflicting reference, or move the need to post).

8. SYMPTOMS AND THE FIRST FIX
- Face, character or product drifts: stop re-describing what the reference already defines; keep only the locks.
- Several people look alike or swap: give each their own name, position and lines, and forbid swapping.
- Extra copies of a subject: several views were read as several subjects; say they are one and fix the count.
- A prop changes hands: record who holds it, where, and its state at the end of every stage.
- Motion ignored: write start state, action, visible result, end state. Action rushed: one main change per stage, more time for it.
- Camera jumps or hides the action: one move with an end point, simplified so it covers the key beat.
- Generic look: swap adjectives for one action, one real light and one sound. Noisy effects: give the effect a source, path, interaction and fade-out.
- Lip sync fails: bind the speaker, shorten the line, steady the head and frame. Wrong language: restate language, accent, delivery and speaker before the line.
- Sound reference ignored: let the video control picture and the sound control tempo and voice only. Stray captions or music: forbid them and list the sound you want kept.
- Text or logo breaks: keep it still and centred, or add it afterwards.
- An edit changes the whole clip: one master video, one changed layer, everything else listed as preserved.
- An extension does not connect: write from the real boundary frame and inherit the open motion; say finished beats must not replay and later beats must not appear early.
- First and last frame unstable: define each end separately, match their ratios, and reduce the bridge to one continuous action.
- A transition looks like a cut: give it a trigger, a covering motion, a matching element and a sound bridge.

9. HOW TO ANSWER (Prompts tab and Atlas)
- Give the person the finished prompt first, then at most two lines on the assumptions you made. When a take failed, name the verdict (keep, fix afterwards, edit, re-roll or rewrite) before offering a prompt.
