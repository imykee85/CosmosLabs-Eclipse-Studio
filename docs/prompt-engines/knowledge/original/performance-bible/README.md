# Performance Bible: a Claude skill for realistic character performance

**Author:** [@sirlifehacker](https://x.com/sirlifehacker)

Give it a scene idea, and optionally a character sheet. It invents characters with real inner lives (what they want, what they're hiding, where they're from) and turns that into realistic, motivated behavior: gestures, gaze, timing, how they listen, and the small nuances in between.

It's built for AI filmmakers and creators, and it works with any video model. It writes plain performance directions you paste into your own prompts, shot lists or actor notes. It doesn't decide your camera, lighting, references or model settings.

**Core rule: the camera sees verbs, not psychology.** "Nervous" never reaches the page. A knee bouncing under the table does.

## Install

- **Claude Code:** unzip into `~/.claude/skills/` so you have `~/.claude/skills/performance-bible/SKILL.md`. Start a new session.
- **claude.ai:** go to Settings → Capabilities → Skills and upload the zip.

## Use

> Use performance-bible: two people in a diner booth, random

> Use performance-bible: [attach a character sheet] he's confident and extroverted; put him in a deli in New York

It doesn't ask clarifying questions. It makes choices and states them, including which traits you gave and which it inferred. Swap anything you want.

**Output, in this order:**
1. **Cast:** archetype, origin, fear, want, secret, body and voice for each character.
2. **Scene engine:** objectives, subtext, who holds status and how it flips, and the rhythm register (naturalistic or heightened).
3. **Beats:** the trigger, what's underneath, what each person does, including the listener.
4. **Performance directions:** plain behavior paragraphs, ready to drop into any prompt.

## What's inside

```
performance-bible/
├── SKILL.md                        workflow; origins, 10 archetypes, tells, scene dynamics,
│                                   how to write performance directions
├── references/
│   └── conversation-rhythm.md      measured human behavior from Meta's Seamless Interaction
│                                   dataset: turn gaps and overlaps, backchannels, what listeners
│                                   do, a state → visible-behavior lookup, what Big Five does
│                                   and doesn't predict, a checklist for judging takes
├── examples/theo-la-nyc.md         full run: three traits → one character across four real
│                                   LA/NYC locations
├── tests/take-log.md               template for logging which directions read on screen
└── tools/seamless/                 scripts + results to reproduce or extend the analysis
```

## Where the knowledge comes from

- **Acting and directing craft:**
  - objectives, obstacles and tactics (Stanislavski)
  - status (Keith Johnstone)
  - attention and truthful response (Meisner)
  - origin and archetype tendencies as starting points, not rules

  All adapted in paraphrase.
- **Measured human behavior:** my analysis of Meta FAIR's Seamless Interaction dataset. It covers 4,971 annotated "moments of interest," 180 two-person conversations with turn timing, and Big Five scores for 191 participants. Details and caveats are in `references/conversation-rhythm.md`.
- **What's not included:** model-specific prompt rules. How any particular video model responds to these directions is for you to test in your own tool. `tests/take-log.md` is there for that.

## Known gaps

- There's no secure-extravert archetype yet. "Confident + extroverted" currently maps to The Performer.
- Scene dynamics cover two people. Groups of 3 or more aren't covered yet.

## Credits and licences

- **Seamless Interaction:** `references/conversation-rhythm.md` and `tools/seamless/` contain statistics and paraphrased behavior patterns derived from Meta FAIR's dataset (https://github.com/facebookresearch/seamless_interaction). That dataset is licensed **CC-BY-NC 4.0** (attribution, non-commercial).
  - The skill doesn't include the dataset itself. The scripts download text files from Meta's public host if you rerun them.
  - Check the non-commercial term before using that part in paid work.
- **Paper:** Agrawal et al., *Seamless Interaction: Dyadic Audiovisual Motion Modeling and Large-Scale Dataset*, arXiv:2506.22554 (2025).
