# Seamless Interaction analysis scripts

These scripts rebuild the numbers in `references/conversation-rhythm.md`. They download **only text files**: annotations, transcripts and voice-activity timing, about 40 MB in total. No video or audio is downloaded. Everything comes from Meta's public host, `dl.fbaipublicfiles.com/seamless_interaction`.

Dataset: Meta FAIR, Seamless Interaction, licensed CC-BY-NC 4.0. Keep the downloaded data out of anything you publish. Only the derived statistics live in this skill.

## Run

Python 3.9+ with the standard library only.

```bash
git clone --depth 1 https://github.com/facebookresearch/seamless_interaction.git /tmp/si_repo
```

```bash
python3 1_fetch_text.py /tmp/si_repo /tmp/si_data
```

```bash
python3 2_fetch_vad_for_annotations.py /tmp/si_repo /tmp/si_data
```

```bash
python3 3_turn_timing.py /tmp/si_data /tmp/si_repo
```

```bash
python3 4_moments.py /tmp/si_data /tmp/si_repo
```

## What each script does

1. **`1_fetch_text.py`** downloads every annotated Moment of Interest (1P-IS, 1P-R, 3P-IS, 3P-R, 3P-V). It also downloads transcripts and VAD for a random sample of conversation pairs: 90 naturalistic and 90 improvised, seed 7. To grow the sample, raise the `90`s.
2. **`2_fetch_vad_for_annotations.py`** downloads VAD for the annotated files and their partners, so each moment can be labeled speaking or listening.
3. **`3_turn_timing.py`** computes turn gaps and overlaps, turn length, pauses inside a turn, backchannels, and Big Five correlations. It writes `timing_results.json`.
4. **`4_moments.py`** works on the annotated moments. It tags states and behaviors, splits them by speaking or listening and by extraversion, and compares first-person with observer reads. It writes `ann_results.json` and `moments.json`.

## Results from the 2026-11-09 run

These are copied here:

- `timing_results.json`
- `timing_by_relationship.json`
- `ann_results.json`
