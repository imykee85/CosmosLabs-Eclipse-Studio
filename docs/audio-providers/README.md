# Eclipse audio (Voice Studio): provider reference files

Source: the owner's ECLIPSE AUDIO MASTER BRIEF (2026-10-14). Claude Code cannot open links, so these files are the single source of truth. NOT STATED / VERIFY means the docs did not say: test it with a real key, never guess.

- `build-brief.md`: scope, capabilities, build order, provider interface, jobs/storage/queueing, ledger, voices and consent, UI, env vars, tests, risks.
- `elevenlabs.md`, `fish-audio.md`, `minimax.md`, `qwen3-tts.md`, `seed-audio.md`: provider facts.

Build order (one batch per phase, tests green before the next): 1 interface + registry + jobs + R2 + ledger + ElevenLabs TTS + fake provider; 2 Fish, MiniMax sync, Qwen, Seed Audio TTS; 3 STT; 4 SFX + music (ElevenLabs); 5 voices (list, clone with consent, design, delete); 6 MiniMax long TTS and polish. Do NOT touch Canvas or Agents. Do not build WebSocket realtime, MiniMax music, ElevenLabs professional clone, dubbing, Qwen-Audio/CosyVoice WebSocket families.
