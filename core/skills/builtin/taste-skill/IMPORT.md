Source: https://github.com/Leonxlnx/taste-skill (skills/taste-skill, install name design-taste-frontend)
Commit: f624f37a8c650b9cc550253104925efe4c8de246
License: MIT (Copyright (c) 2026 Leonxlnx). Keep LICENSE with the files.
Imported: whole skill folder unchanged (SKILL.md, references/, library/, assets/, scripts/, evals/).
Needs: Node 22+, Chrome/Edge/Chromium, network for scripts/assets.mjs. No API keys.
Pinned: never track main. Update by hand: new commit, re-run tests, update this file.
Eclipse changes: none to the vendored files. Wrappers live in src/lib/core-skills/ and src/lib/sandbox/.
Wrapper (outside this folder): core/skills/wrappers/chrome, copied to /work/bin/chrome on the build machine; sandbox_exec sets CHROME_PATH=/work/bin/chrome because inspect.mjs cannot pass --no-sandbox.
