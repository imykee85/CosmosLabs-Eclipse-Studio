# Media archive

Files kept for later use. NOT served by the site (outside `public/`), so they add nothing to deployments.
To use one, copy it into `public/` and wire it in.

- `hero/hero-seedance.mp4` + `-poster.jpg`: the user's Seedance 2.5 clip as a hero (H.264 level 4.0, muted, 1.4 MB); `-original.mov` is the untouched upload (HEVC, 6 MB).
- `hero/hero-first-video.mp4` + `-poster.jpg`: the first hero video.
- `hero/HeroVideo.tsx.txt`: the component that played them (autoplay fixes for iPhone); `hero.jpg` stays in `public/hero/`.

- `hero/hero-astronaut-flowers.jpg`: the astronaut-in-red-flowers still that was the landing hero until 2026-10-30. `hero/hero-seedance-original.mp4` is the astronaut-in-orbit clip (720x1280, with sound) that replaced it; the served copy is `public/hero/hero.mp4`.
- The astronaut-in-orbit clip is the landing hero again (`public/hero/hero.mp4`, `.webm`, `hero-poster.jpg`, no sound).
- `hero/hero-silhouette-light-1.jpg`: the first silhouette-in-light hero still (2026-10-30), replaced the same day by a version with a sharper crowd and a ring halo.
- `hero/hero-silhouette-light-2.jpg`: the second silhouette-in-light hero still (served as `public/hero/hero-2.jpg` on 2026-10-30), replaced the same day when the astronaut clip came back as the hero.
- The typed-line overlay ('Step into a world of endless possibilities', component TypedLine.tsx) was tried over the video on 2026-10-30 and replaced by the Welcome screen over the video; it is in git history (commit 1da257b).
