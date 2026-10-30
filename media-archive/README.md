# Media archive

Files kept for later use. NOT served by the site (outside `public/`), so they add nothing to deployments.
To use one, copy it into `public/` and wire it in.

- `hero/hero-seedance.mp4` + `-poster.jpg`: the user's Seedance 2.5 clip as a hero (H.264 level 4.0, muted, 1.4 MB); `-original.mov` is the untouched upload (HEVC, 6 MB).
- `hero/hero-first-video.mp4` + `-poster.jpg`: the first hero video.
- `hero/HeroVideo.tsx.txt`: the component that played them (autoplay fixes for iPhone); `hero.jpg` stays in `public/hero/`.

- `hero/hero-astronaut-flowers.jpg`: the astronaut-in-red-flowers still that was the landing hero until 2026-10-30. `hero/hero-seedance-original.mp4` is the astronaut-in-orbit clip (720x1280, with sound) that replaced it; the served copy is `public/hero/hero.mp4`.
