# Conversation rhythm and nuance (from Meta's Seamless Interaction dataset)

Read this before writing beats for any scene with dialogue or a listener. It turns measured human behavior into performance directions you can use with any video model, an actor or an animator.

**Where the numbers come from:** my own analysis of a slice of the Seamless Interaction dataset (Meta FAIR, 2025), run 2026-11-09:

- **Annotations:** all 4,971 released "Moments of Interest" across 1,663 files, with their speaking/listening context.
- **Timing:** transcripts and voice-activity timing for 180 two-person conversations (90 unscripted, 90 improvised), 4,796 turn switches.
- **Personality:** BFI-2 Big Five scores for 191 of those participants.

Only text and timing files were used, no video. The dataset is licensed **CC-BY-NC 4.0**. This file holds derived statistics and paraphrased patterns, not the raw data. See Licence at the bottom.

**Two kinds of conversation in the dataset:**
- **Naturalistic:** ordinary people talking through a prompt (2,745 h).
- **Improvised:** mostly professional actors playing assigned roles and stances (1,320 h).

When you want a scene to feel *real*, use the naturalistic numbers. When you want it to feel *played* or heightened, use the improvised ones.

---

## 1. The six rules (summary)

1. **Every nuance is a reaction.** 57% of the observers' reasons name something the partner just did or said (65% for listening moments). Write the trigger first: "When she says ___, he ___."
2. **A nuance lasts about 3 seconds** (median 3s; most run 1–6s), and it usually uses one or two body channels. Budget one nuance per ~3s window per character.
3. **The listener is half the performance.** 50% of annotated moments happen while the person is *listening*, against 42% while speaking. Listeners nod, tilt their head, move their mouth and lips, and raise their eyebrows. Speakers gesture with their hands.
4. **Eyebrows are the most-recorded single feature** (20% of all moments, 48% of surprise, 40% of skepticism). Head tilt is close behind (17%). Name them in your directions.
5. **Real conversation has gaps; acted conversation overlaps.** Unscripted turns start a median 0.4s after the partner stops, and a third of gaps are over 1 second. Actors start a median 0.07s after and overlap on 45% of turn switches.
6. **Write for what the audience reads, not what the character feels.** Participants' own account of a moment and the observer's read matched only 29% of the time. Pick the behavior that *reads* as the state you want on screen.

---

## 2. Timing: turns, gaps and overlaps

| Measure | Unscripted (ordinary people) | Improvised (actors) |
|---|---|---|
| Gap before the next speaker starts (median) | **0.40 s** | 0.07 s |
| Middle half of gaps | −0.19 s (overlap) to +1.35 s | −0.48 s to +0.71 s |
| Turn switches that overlap | 31% | **45%** |
| Gaps of 0–0.5 s | 21% | 24% |
| Gaps over 1 s | **32%** | 19% |
| Gaps over 2 s | 15% | 8% |
| Turn length (median) | 4.3 s, about 11 words | 3.3 s, about 10 words |
| Turn length (90th percentile) | 27 s | 14 s |
| Pause inside a turn (median) | 0.42 s; 17% over 1 s | 0.42 s; 18% over 1 s |

**How to use it:**
- **A one-second silence before an answer is normal**, not dramatic. One in three real answers has one. To make a pause *mean* something, go past 2 seconds, or fill it with a visible behavior.
- **Mid-turn thinking pauses** (about 0.4s, sometimes over 1s) are where speakers look away, tilt their head, or press their lips. A line with one written-in pause reads more natural than a clean delivery.
- **Overlap is the heightened register.** Arguments, banter and actor energy start before the other person finishes. For a naturalistic scene, keep overlaps to roughly one in three switches.
- **Friends vs. strangers:** almost no difference in this sample. Median gap 0.45s vs. 0.39s, overlap 31% vs. 32%. Strangers took slightly longer turns (4.5s vs. 3.8s) and backchanneled a little more. Don't use relationship alone to set rhythm.

## 3. Backchannels (verbal "I'm listening" sounds)

- **Rate:** spoken backchannels are rarer than people assume. The median is 1.3 per minute of partner speech in unscripted talk, and 2.4 per minute for actors.
- **Timing:** half of them (50–62%) land *while the partner is still talking*. The rest fall in the partner's pauses.
- **Words:** "yeah" dominates, then "okay," "right," "yes," "mm-hmm," "exactly," "oh," "nice," and doubled "yeah, yeah."
- **Implication for a short scene (10–15 seconds):** a verbal backchannel is optional, at most one. **Nonverbal listening carries the scene** (Section 4). Note that nods weren't counted in these numbers; this is speech only.

## 4. What observers actually see

From the observer's written description of each annotated moment ("what was visibly different from this person's baseline").

**Channels mentioned:** hands/arms 62% · face 60% · head 43% · torso/legs/feet 29%. About 30% of moments are face and head only.

| Behavior | All | While speaking | While listening |
|---|---|---|---|
| Eyebrows (raise, furrow) | 20% | 19% | 20% |
| Head tilt | 17% | 15% | **19%** |
| Lips / mouth (press, purse, bite, open) | 17% | 10% | **24%** |
| Hand gesture | 16% | **24%** | 10% |
| Smile | 13% | 11% | 14% |
| Nod | 11% | 6% | **15%** |
| Lean (in/back) | 11% | 11% | 10% |
| Eyes (widen, close, squint, blink) | 10% | 8% | 11% |
| Gaze shift (away, down, up) | 9% | 9% | 9% |
| Laugh | 6% | 6% | 6% |
| Self-touch (face, hair, neck, chin) | 5% | 5% | 6% |
| Head shake | 5% | 6% | 5% |
| Sigh / visible breath | 4% | 2% | 6% |
| Shrug | 3% | 3% | 3% |
| Arms crossed | 1% | 1% | 1% |

- **Sequences:** about a quarter of moments (24%) are described as a short sequence ("nodded, then shook their head"; "frowned, then leaned back"). A two-step reaction is natural. Three or more steps in 3 seconds is rare.
- **Rare in the data:** mixed signals (a smile with a frown in the same moment, about 1%) and freezes or stopped gestures (about 3%). Use them as deliberate choices, not as defaults.

## 5. State → behavior lookup (Seamless-grounded)

Use this alongside Layer 3 in SKILL.md. The percentages show how often each behavior appeared in moments that observers labeled with that state. The phrasings are paraphrased composites of observer descriptions, ready to drop into prompts.

| State to read on screen | Mostly when | Top observed channels | Prompt phrasings |
|---|---|---|---|
| **Confident / assertive** (n 353) | speaking (62%) | hand gestures 22%, brows 19%, head tilt 17%, nod 13% | holds both palms up toward the partner while explaining · clasped hands open and move forward · looks straight at the partner, brows lifted |
| **Engaged / interested** (n 515) | not speaking (73%) | brows 23%, mouth 22%, nod 19%, head tilt 19%, smile 14% | small nods while the other talks · head tilted, brows lifted · leans in slightly |
| **Empathetic / agreeing** (n 273) | either | **nod 38%**, brows 23%, hand 18%, head tilt 17% | nods slowly, head tilted · presses lips together · shows open palms with a small shrug |
| **Happy** (n 621) | not speaking (63%) | smile 34%, brows 19%, nod 16%, hands 16% | smiles and nods · brows lift with the smile |
| **Amused** (n 168) | either | **laugh 49%**, smile 29%, head tilt 16%, lean 15% | laughs and leans back · covers mouth with a hand while laughing · small laugh, then looks down |
| **Surprised** (n 333) | not speaking (80%) | **brows 48%**, mouth 30%, eyes 21%, head pulls back 16% | eyebrows shoot up, mouth opens · head pulls back a few centimeters · hand goes to cheek or mouth |
| **Skeptical** (n 116) | either | **brows 40%, head tilt 31%**, mouth 22%, shrug | one brow up, head tilted · shrugs with arms out · side glance with a half-smile |
| **Uncertain** (n 424) | not speaking (61%) | mouth 25%, brows 22%, head tilt 22%, gaze away 10% | pulls lips in or purses them · glances to the side · hand to mouth or hair · squeezes own hands |
| **Thinking** (n 292) | not speaking (66%) | head tilt 24%, lips 23%, nod 17% | looks down and bites lip · squints, eyes to the side · lips make an "O" |
| **Uncomfortable / nervous** (n 381) | either | head tilt 24%, brows 18%, gaze away 15%, short smile 11% | glances away, brows up · brief tight smile · scratches chin, blinks a few times · shifts weight |
| **Frustrated** (n 459) | either | hands 20%, brows 19%, mouth 19%, **sigh 12%** | sighs, tips head back, eyes close · bites lip · palm out toward the partner · rubs nose or eye |
| **Sad / disappointed** (n 136) | not speaking (60%) | head tilt 25%, lips 23%, gaze down 12% | lowers face and looks down · puffs cheeks and exhales · lips pressed tight · hand over face |

## 6. Personality: what Big Five does and doesn't predict

**Doesn't predict timing.** Across 191 people with BFI-2 scores, none of the five traits predicted speaking share, turn length or backchannel rate (every correlation between −0.06 and 0.12). In these conversations the situation set the rhythm, not the personality.

**Does shift which channels show.** Unscripted participants only, top vs. bottom third on extraversion, share of their annotated moments:

| Behavior | High extraversion | Low extraversion |
|---|---|---|
| Hand gestures | **22%** | 16% |
| Eyebrows | **17%** | 6% |
| Eye contact | **7%** | 1% |
| Leaning in | **12%** | 8% |
| Smile | 15% | 13% |
| Laugh | 9% | **21%** |

Based on about 220–250 moments per group, so treat it as directional.

**What this means for the skill:**
- **Play "extroverted" through channels, not airtime.** Give the character more hand gestures, more eyebrow movement, more held eye contact and more lean-in. Don't give him longer or more lines, or a louder voice by default.
- **Laughter isn't an extravert marker here.** The less extraverted group laughed in more of their notable moments. A laugh works as a release or deflection for any type.
- **Actors' personality scores don't predict their role's behavior**, because improvised participants play assigned stances. So trust the archetype's direction over the actor's own traits.

## 7. Feeling vs. reading (first-person vs. observer)

- **The two accounts rarely matched.** For 252 moments, both the participant's self-report and the observer's read could be categorized, and they shared a state only **29%** of the time.
- **The most common inner state was "thinking."** People most often reported thinking or working something out. Observers read those same moments as *engaged*, *confident* or *uncertain*.
- **Implication:** the audience never sees the inner state. It sees behavior and guesses. Choose behaviors from the **state you want the viewer to read** (Section 5). This is the dataset's version of the skill's core rule.

## 8. Writing it into directions

These follow from the human data above. How well a given video model reproduces them is a separate question, so check takes in your own tool (`tests/take-log.md`).

1. **Trigger, then response.** "When the young man asks, 'You miss home?', [response]." Never an unprovoked expression.
2. **One nuance per ~3s per character, one or two channels**, at most a two-step sequence: "raises his eyebrows, then tilts his head."
3. **Give the listener one nonverbal reaction per ~3–5s of partner speech.** Rotate: nod → brows up with head tilt → lips press → small smile. Make clear the listener isn't speaking during the other person's line.
4. **Verbal backchannels are rare and deliberate.** Real people produce about 1–2 per minute of partner speech. If you want one, write the exact word and when it lands: "partway through his line, she says 'mm-hmm' once."
5. **Name the gap:**
   - Naturalistic answer: "after a short beat, she answers."
   - Loaded answer: "a full two seconds pass, then…"
   - Heightened or argument: "she starts talking before he finishes his last word."
6. **Put eyebrows and head tilt into close and medium shots.** They're the channels observers record most.
7. **Small channels carry the nuance.** Brows and lips are where real nuance lives. Give each nuance a clear trigger and a few seconds of its own so it has room to read.

## 9. Viewing checklist for takes

- [ ] Does each reaction have a visible trigger from the other person?
- [ ] Does the listener do something every ~3–5s (nod, brows, tilt, lips), without mouthing the speaker's words?
- [ ] Are gaps between lines plausible (mostly 0.2–1.5s), or do the lines run together?
- [ ] Did the eyebrows and head move at all, or is the face a mask while only the hands move?
- [ ] Is any nuance held well past ~6s (a frozen smile)?
- [ ] For an "extroverted" character: is it carried by gestures, eyes and lean, rather than by just talking more?

## 10. Method and limits

**How the data was processed:**
- Turns were built from each speaker's voice-activity segments, with words assigned from the time-aligned transcript.
- A backchannel is a segment of three words or fewer from a fixed list ("yeah," "mm-hmm," "okay"…), under 1.6s. Nods aren't included.
- Gap = next turn's start minus previous turn's end. Negative = overlap.
- States and behaviors were tagged by keyword matching on the observers' text. Categories overlap, and about 14% of descriptions matched no behavior keyword.
- Speaking/listening context comes from voice activity overlapping the moment's time window (at least 30% of the window).

**Caveats:**
- **Mostly actors.** 81% of annotated moments come from improvised (mostly actor) sessions, because those are what Meta annotated.
- **Timing noise.** The dataset notes timestamp misalignment in about 10% of interactions. Per-speaker audio is denoised but can still pick up the other person.
- **Sample size.** The 180 conversation pairs were randomly sampled (seed 7). Rerun with more pairs before treating the decimals as precise.
- **What it doesn't cover.** These numbers describe two people standing or sitting face to face on a set. They don't cover groups, walking, or outdoor locations.
- **Human norms, not model rules.** These describe how people behave. How well any video model reproduces them is untested here. Log what you find in `tests/take-log.md`.

**Reproduce or extend:** the scripts are in `tools/seamless/` (see its README). They fetch only text files from Meta's public download host.

## Licence and sources

- **Dataset:** Meta FAIR, *Seamless Interaction Dataset*, https://github.com/facebookresearch/seamless_interaction · https://huggingface.co/datasets/facebook/seamless-interaction. Licensed **CC-BY-NC 4.0** (attribution, non-commercial).
  - This file contains derived statistics and paraphrased behavior descriptions, not dataset records, and credits the source.
  - If the skill's output is used in paid client work, check that use against the NonCommercial term, or ask Meta for permission. This is a flag, not legal advice.
- **Paper:** Agrawal et al., *Seamless Interaction: Dyadic Audiovisual Motion Modeling and Large-Scale Dataset*, arXiv:2506.22554 (2025):
  - §2–2.2: collection and interpersonal-stance prompts.
  - §2.3: Moment-of-Interest annotations.
  - §6.1: human preference studies.
  - Note: the paper reports no turn-taking or backchannel statistics. Sections 2–4 of this file are my own analysis.
