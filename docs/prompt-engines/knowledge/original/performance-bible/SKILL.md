---
name: performance-bible
description: "Turns a scene idea into characters with inner lives and realistic behavior: gesture, gaze, timing, listening, nuance. Use for believable human performances in AI video or film."
---

# Performance Bible

Purpose: take a one-line scene setup ("two people in a diner booth") and produce characters whose behavior comes from real motives, then write that behavior as plain performance directions. Paste them into any video model's prompt, a shot list, or notes for an actor or animator.

This skill directs the **people**. Camera, lighting, reference images, model syntax and generation settings belong to your own workflow and your model's documentation.

**Core rule: the camera sees verbs, not psychology.** Every inner state must end as a concrete physical action, breath pattern, eyeline, timing choice, or vocal quality. Words like "nervous," "insecure," or "confident" never appear in the final directions.

## When to read references
- **Before writing beats for any scene with dialogue or a listener:** read `references/conversation-rhythm.md`. It covers measured turn gaps and overlaps, backchannels, listener behavior, a state → visible-behavior lookup, and what Big Five does and doesn't predict, all from Meta's Seamless Interaction dataset.
- **After the user shares a take:** log what read and what didn't in `tests/take-log.md`. When the same behavior keeps failing to read, change how it's directed.
- **For a worked example of the full output:** `examples/theo-la-nyc.md` (one character, four real locations, three traits given).

## Workflow
1. **Read the setup.** Pull out the location, how many characters, and any stated relationship or tension. If none is given, invent a relationship and a subtext conflict: one character wants something the other is withholding.
2. **Build each character** using Layer 1 (origin) and Layer 2 (archetype). Unless told otherwise, make the two characters contrast: different archetypes, different movement tempo, different origin. If the user gives only a few traits, list which traits were **given** and which were **inferred** in the Cast section.
3. **Set the scene engine** with Layer 4: each character's objective, their secret, and who holds status at the start and at the end. Status should flip at least once, **on a visible physical event** (see Layer 5).
4. **Write 3–6 beats.** For each beat:
   - Note the hidden state underneath.
   - Name the **trigger**: what the other person just said or did.
   - Pick each character's tells from Layer 3 and the state table in `conversation-rhythm.md`, filtered through their archetype.
   - Choose them for what the audience should *read*, not only what the character feels. Self-report and observer read matched only 29% of the time.
   - Every beat gives the **listener** a behavior too.
5. **Write the performance directions** with Layer 5.
6. **Output** in the format at the bottom.

Don't stop to ask questions. Make choices, state them in the Cast section, and let the user swap anything. If they say "random," pick contrasting archetypes and origins at random.

## Layer 1: Origins → habits
Culture and upbringing produce tendencies, not rules. Blend them with the archetype and avoid caricature.

| Origin factor | Gesture | Space | Voice | Body habits |
|---|---|---|---|---|
| Loud, crowded household (many siblings) | Big, fast, interrupting | Comfortable close; leans in | Loud, overlaps others | Eats fast, guards the plate, reaches across the table |
| Quiet, strict household | Minimal, hands visible and still | Keeps distance | Soft; waits for gaps; apologizes before speaking | Sits upright, napkin in lap, asks permission |
| Volatile household (unpredictable adult) | Small, close to body | Back to wall, faces the door | Measured; tracks the other person's tone | Scans the room, startles at sudden noise, placating half-smiles |
| Working-class / manual-labor upbringing | Hands used like tools; demonstrative | Sits wide | Direct, few words | Forearms on table, rough hands, eats without ceremony |
| Affluent / old money | Economical, unhurried | Takes space without effort | Slow, doesn't fill silence | Proper utensil use, still posture, small gestures carry weight |
| Rural / small town | Slow, nods a lot | Relaxed distance | Long pauses, regional idioms | Touches cap brim, leans on elbows, unhurried chewing |
| Big city (NYC, Philly, Chicago) | Sharp, punctuating | Efficient, close | Fast, overlapping | Eyes track surroundings calmly, impatient foot |
| High-contact cultural background (Mediterranean, Latin American, Middle Eastern) | Wide gestures from the shoulder, rhythmic | Close; touches the other person's arm | Expressive pitch range | Animated face, leans in for emphasis |
| Low-contact / restraint-valued background (East Asian, Nordic) | Small gestures from the wrist | More distance | Even pitch; comfortable with silence | Less sustained eye contact (deference) or long calm silences |
| US South | Warm, softening rituals | Friendly-close | Stretched vowels, politeness before directness | Smiles while disagreeing, "hon"/"y'all" |
| Military or ex-athlete | Minimal, precise | Squared to the table | Clipped | Upright, scans exits, very still hands |

**Dialect:** name a specific region, give 1–2 audible features (for example Boston non-rhotic "r," Southern vowel stretch), plus pace, volume and pitch range.

## Layer 2: Archetypes (v1, 10)
Each entry lists core fear, defense, baseline body (breath / posture / gaze / hands), under pressure, and the tell when hiding something.

1. **The Pleaser** (anxious attachment, high agreeableness)
   - Fear: abandonment. Defense: appeasing.
   - Baseline: shallow high-chest breath; leans forward with shoulders rounded; searches the other person's face for approval; fidgets with napkin or sleeve.
   - Under pressure: over-explains, laughs at the wrong moments, over-mirrors.
   - Hiding: smile that doesn't reach the eyes; swallows before speaking.
2. **The Fortress** (avoidant attachment)
   - Fear: being engulfed or needed. Defense: withdrawal.
   - Baseline: slow controlled breath; leans back with an arm along the booth; steady but disengaged gaze, often out the window; hands still around the cup.
   - Under pressure: gets quieter, checks phone, sets jaw.
   - Hiding: lips press thin; slow blinks.
3. **The Performer** (high extraversion, narcissistic edge)
   - Fear: being ordinary or unseen. Defense: charm.
   - Baseline: full diaphragm breath; open posture that takes space; long eye contact, checks whether others in the room are watching; big illustrative gestures.
   - Under pressure: gets louder, jokes, touches the other person's arm.
   - Hiding: tells a long story; holds eye contact a beat too long.
4. **The Survivor** (hypervigilant, volatile upbringing)
   - Fear: danger, being caught off guard. Defense: watchfulness and control.
   - Baseline: held or interrupted breath; back to wall facing the door, coiled; scans the room every few seconds; hands under the table or tight to the body.
   - Under pressure: freezes, then turns sharp.
   - Hiding: goes perfectly still.
5. **The Fixer** (high conscientiousness, control-oriented)
   - Fear: chaos or failure. Defense: organizing.
   - Baseline: steady breath with frustrated sighs; upright and aligned; direct purposeful gaze; arranges objects (straightens silverware, wipes the table).
   - Under pressure: lists solutions, answers emotion with logistics.
   - Hiding: keeps hands busy.
6. **The Ghost** (depressive, low energy)
   - Fear: being a burden. Defense: invisibility.
   - Baseline: slow breath with heavy exhales; collapsed posture, chin down; looks down or away, long blank stares; limp, minimal hands.
   - Under pressure: delayed responses, one-word answers.
   - Hiding: flat face, nods.
7. **The Hustler** (high openness, low conscientiousness, street-smart)
   - Fear: being trapped. Defense: humor and deflection.
   - Baseline: easy breath; loose posture angled toward the exit; quick eyes that read people; hands always moving (coin, lighter, sugar packet).
   - Under pressure: changes the subject, smiles wider.
   - Hiding: touches nose or mouth; speeds up.
8. **The Judge** (high conscientiousness, low agreeableness)
   - Fear: being wrong or looking foolish. Defense: criticism.
   - Baseline: tight breath, exhales through the nose; rigid posture, arms crossed or fingertips steepled; evaluating gaze with raised brows; precise hands, points.
   - Under pressure: colder, more formal language.
   - Hiding: purses lips, glances away, then looks back harder.
9. **The Dreamer** (high openness, high neuroticism)
   - Fear: being unloved or meaningless. Defense: idealization.
   - Baseline: uneven breath with sighs; soft posture, chin on hand; gazes out the window, then turns suddenly intense; touches own face or hair, traces the cup rim.
   - Under pressure: eyes well up, overstates things poetically.
   - Hiding: stares off into the distance.
10. **The Steady One** (secure attachment)
    - Fear: little that shows. Defense: direct communication.
    - Baseline: slow belly breath; relaxed and upright; warm eye contact with natural breaks; calm open palms.
    - Under pressure: pauses, then names the problem out loud.
    - Hiding: rarely; a slight delay before answering.

Most drama needs at least one insecure archetype. The Steady One works best as a contrast.

> **Known gap (Test 01):** there is no secure extravert. "Confident + extroverted" falls into The Performer and picks up its fear of being ordinary and its narcissistic edge. Until a "Host / Connector" archetype exists, use the Performer's baseline body with the Steady One's attachment, and say so in the Cast section.
>
> **Seamless data on personality (see `conversation-rhythm.md` §6):** Big Five traits did **not** predict how much someone talks, how long their turns are, or how often they backchannel. Every correlation was within ±0.12, across 191 people. Extraversion showed up in channels instead. More-extraverted people used more hand gestures (22% vs 16% of their notable moments), more eyebrow movement (17% vs 6%), more eye contact (7% vs 1%) and more leaning in. So play a high-extraversion archetype through gesture, brows, eye contact and lean, not extra lines or volume.

## Layer 3: Tells lookup
Pick from the emotion, then modulate by archetype. Expressive types amplify. Restrained types suppress, and suppressed emotion leaks out through the hands, feet, breath and swallowing.

**Leakage order:** the face is the most controlled, hands come next, legs and feet are the least. For subtle scenes, put the truth under the table: bouncing knee, feet pointed toward the exit, hands gripping the seat.

- **Anxiety:** shallow breath, swallowing, licking lips or teeth, touching the neck, bouncing knee, picking cuticles, checking phone.
- **Shame:** eyes down, touches face, shrinks posture, turns a shoulder away, voice drops.
- **Suppressed anger:** jaw clench, nostril flare, sudden stillness, palm pressed flat on the table, slow blink, short exhale.
- **Expressed anger:** leans in, points, raises volume, chopping hand gestures.
- **Grief:** heavy exhale, unfocused eyes, slow movement, holds the cup without drinking.
- **Attraction / affection:** leans in, mirrors the other person, lingering eye contact, touches own neck or hair, feet turned toward them.
- **Contempt:** one-sided lip raise, eye roll, leans back, looks away while the other is talking.
- **Deception:** too still or more self-touching, delayed answers, lopsided smile, more detail than the question needs.
- **Fear:** freezes, eyes widen briefly, holds breath, pulls hands in toward the body.
- **Relief:** long exhale, shoulders drop, short laugh, sits back.

**What observers actually record** (Seamless, 4,971 annotated moments; full table in `conversation-rhythm.md` §4–5):
- **Duration:** a notable moment lasts about 3 seconds and uses one or two channels.
- **Most-recorded channels:** eyebrows (20%), head tilt (17%), lips/mouth (17%), hand gesture (16%), smile (13%), nod (11%), lean (11%).
- **Speakers vs. listeners:** speakers gesture with their hands (24%). Listeners nod (15%), move their lips (24%) and tilt their head (19%).
- **Add these channels to the lists above:**
  - brows up with a head tilt (surprise, skepticism, interest)
  - lips pressed or pulled in (uncertainty, holding back)
  - a sigh with the head tipped back (frustration)
  - a slow nod with the head tilted (empathy)

## Layer 4: Scene dynamics (two people)
- **Objective:** phrase it as a verb aimed at the other person ("to get her to admit she's leaving," "to make him laugh so he won't ask").
- **Obstacle:** the other person's objective.
- **Tactics change by beat:** charm, guilt, threaten, plead, deflect, withdraw.
- **Status:** high status shows as stillness, taking time, holding space, not filling silence. Low status shows as more movement, filling silence, shrinking. Flip it at least once, **and make the flip a prop or body event the audience can't miss.** A twitch or a single nod is easy to lose.
- **Mirroring** reads as connection; mismatched rhythm reads as conflict.
- **Rhythm register** (`conversation-rhythm.md` §2). Pick one per scene and state it in the Scene engine:
  - **Naturalistic:** answers start about 0.4s after the other person stops, a third of answers have a gap over 1s, and about a third of turn switches overlap.
  - **Heightened / played:** the actor register. Overlap on about half of switches, with answers landing almost immediately.

  A gap over 2s, or a gap filled with a visible behavior, is what makes a pause read as meaningful.
- **The listener is half the scene.** Half of all notable moments in the data happen while listening. Give the listener a nonverbal reaction every ~3–5s of the partner's speech. A spoken "yeah" or "mm-hmm" is rare (about 1–2 per minute of the other person's talk), so use them sparingly.
- **Include one silent beat:** nobody speaks, and the behavior *is* the scene. Give it a length ("about four seconds") and something visible to watch.
- **Booth blocking:** decide who faces the door, how far each leans, and which props they use (coffee, menu, fries, napkin, phone, the check).

## Layer 5: Writing performance directions (any model, any medium)
These are performance-writing practices, not claims about how any particular video model responds. Test them in your own tool and keep what reads.

- **Verb + body part + object.** "Drums two fingers against the mug," never "seems anxious."
- **Trigger first, then the response.** "When she says ___, he ___." Most real nuances are reactions to the other person (`conversation-rhythm.md` §1).
- **About one nuance per ~3 seconds per character**, using one or two channels, at most a two-step sequence: "raises his eyebrows, then tilts his head." This is the measured size of a real moment, not a model limit.
- **The listener always does something:** a nod, brows up with a head tilt, lips pressed, a brief smile, or an ongoing task. Say that the listener isn't speaking while the other person talks.
- **Match detail to how big the person is in frame:**
  - Close: brows, lips, eyes, breath, swallowing.
  - Medium: hands, head, posture, props.
  - Wide: posture, spacing, gait, big gestures.
- **Name every eyeline:** at the partner, at the object, away and down, out the window.
- **Dialogue:** exact words in quotes, who says them, and the delivery in plain words (pace, volume, pitch, one or two accent features). Say how the answer lands:
  - "after a short beat"
  - "a full two seconds pass"
  - "she starts before he finishes"
- **Status flips and silent beats get a visible event:** a prop handed over, a step back, a turn away, a timed stillness.
- **Keep out:** psychology adjectives, backstory, and anything the audience can't see.

## Output format
**Cast** (per character, compact):
Name, age · look and wardrobe · archetype · origin · attachment · core fear · want in this scene · secret · baseline body · voice · *(given vs. inferred traits when the user supplied only a few)*

**Scene engine:**
Relationship · subtext · rhythm register (naturalistic / heightened) · status at open → status at close (with the physical event that flips it)

**Beats:**
Beat # · trigger · what's happening underneath (one line) · A's behavior · B's behavior (the listener always gets one)

**Performance directions:**
One numbered block per shot or moment, written as plain behavior paragraphs (Layer 5) ready to drop into any prompt or shot list. No model syntax, camera settings or technical parameters unless the user asks.

## Worked example (v1, text-only)
Setup: "Two characters in a diner booth at night."

**Cast**
- **Marcus, 38.** Broad, worn Carhartt jacket, two-day stubble. The Survivor. Raised in South Philly in a volatile household. Fear: being blindsided. Wants his sister to come to their father's funeral. Secret: he already paid for it. Sits facing the door with hands under the table and scans the entrance. Fast, low Philly voice that clips the ends of words.
- **Dani, 31.** Camel coat she keeps on, hair pulled back tight. The Fortress. Left home at 18 and lives in Seattle now. Fear: being pulled back in. Wants to leave without promising anything. Secret: she already booked a flight. Leans back with an arm along the booth and watches the rain on the window. Even, quiet voice with long pauses.

**Scene engine:** estranged siblings. Underneath, the real question is who raised whom. Status opens with Dani (she's calm and he needs something) and flips to Marcus when he slides the funeral-home receipt across the table.

**Direction 1:** Late-night diner booth, rain on the window. A broad man in a worn Carhartt jacket sits facing the door with both hands under the table edge, glancing past her shoulder at the entrance every few seconds. Across from him, a woman in a camel coat leans back against the booth with one arm along its top, slowly stirring coffee she doesn't drink, her eyes on the window. Neither speaks for about four seconds. When the bell over the door rings, his eyes go to it before his head turns; she doesn't look up.

For a fuller example with one character across four real locations, see `examples/theo-la-nyc.md`.
