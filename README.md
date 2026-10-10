# Eclipse (MVP)

AI image generation for Cosmos Labs. Sign in, enter a prompt, get an image from Higgsfield, browse past generations.

Stack: Next.js 14 (App Router) · TypeScript · Tailwind · Clerk · Prisma/Postgres · Higgsfield API.

## Setup
1. `cp .env.example .env` and fill in `DATABASE_URL`, the Clerk keys and `HIGGSFIELD_API_KEY`.
2. `npm install`
3. `npx prisma db push` (creates the `generations` table)
4. `npm run dev`

Higgsfield endpoint/model/auth live in `src/lib/higgsfield.ts` (overridable via `HIGGSFIELD_BASE_URL` / `HIGGSFIELD_MODEL`).

## Pages
- `/` public landing page (placeholder gradient art, swap for real renders)
- `/sign-in`, `/sign-up` Clerk, styled to match
- `/onboarding` six questions shown once after sign-up (saved to the `onboarding` table)
- `/dashboard` projects home shown after sign-in and after onboarding (saved projects, search and bin; stored in the `projects` table, or in the browser while in demo mode)
- `/create` prompt → generate (protected), `/gallery` past generations (protected)

## Deploy
Import the repo in Vercel, set the same env vars, and run `prisma db push` against the production database.


