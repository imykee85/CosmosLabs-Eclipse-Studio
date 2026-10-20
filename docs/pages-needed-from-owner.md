# Pages Claude needs from the owner

Why: the sandbox cannot reach these providers' websites, and I will not guess field names or prices. Each item below stays unbuilt (or greyed out) until the page arrives.

How to send: paste the page text into the chat, or save it as a file and attach it. Save time by sending the request page (the one that lists the fields a request accepts), not the marketing page. Never include keys.

## A. Higgsfield request pages

1. Kling O3 and Kling Omni: the request page for each. Unlocks the Kling O3/Omni models in Video Studio.
2. Genjutsu restyle: the request page, and the page or call that lists the available looks (styles). Unlocks the Style window in Motion mode, which has no styles connected today.
3. Genjutsu object swap: the request page. Unlocks object replacement in a video.
4. Kling Motion Control: the request page that shows the "scene control" field (where the background comes from). Today only the orientation field is sent.
5. 3D scene: the request page. Unlocks the "3D scene" option in Motion mode.
6. Seedance 2.0 Mini: the request page. Adds the model.
7. Seedance 1.5 Pro: the request page. Adds the model.
8. Cinema Studio 3.0: the request page. Adds the model.
9. FLUX 3 Video: the request page. Adds the model.

## B. Voice request pages

10. Qwen instruct voice (qwen3-tts-instruct-flash): the page that shows the instruction field name. Unlocks style instructions for Qwen voices.
11. Qwen voice cloning: the enrollment page, including which models it works with.
12. Seed voice cloning: the voice replication pages (the paths and fields were unreadable before).
13. Seed transcription (speech to text): the request page. Adds Seed as a transcription option.

## C. Direct provider reference files (cheaper routes)

14. BytePlus Seedance: save as `docs/video-providers/byteplus-seedance.md`. Unlocks the cheaper Seedance 2.0 and 2.5 route.
15. Qwen Image: save as `docs/image-providers/qwen-image.md`. Unlocks the cheaper Qwen Image route.
16. xAI image (Grok Imagine): save as `docs/image-providers/xai-imagine.md`. Unlocks the cheaper Grok Image route. It also needs `XAI_API_KEY` (Secret).
17. BytePlus console prices: screenshots of the ModelArk pricing for Seedance 2.0 and 2.5. I use them to confirm my cost estimates before the cheaper route is switched on.

## D. Prices

18. Mirelo prices: the real per-second price from Mirelo Studio (the current number is a partner listing). Also needs `MIRELO_API_KEY` (Secret).

## What happens after you send a page

I read it, build only what the page confirms, test against a fake provider, push, merge, and tell you what you must set in Vercel (Config or Secret). Anything the page does not make clear stays listed as "not verified" instead of being guessed.
