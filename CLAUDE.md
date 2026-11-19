# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the dev server (http://localhost:3000)
- `npm run build` / `npm run start` — production build / serve
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`, uses `eslint-config-next`)

No test framework is configured yet.

## Architecture

Fresh Create Next App scaffold (Next.js 16.4.6, React 19.3, Tailwind CSS 4 via `@tailwindcss/turbopack`, TypeScript). Uses the App Router under `src/app/` (`layout.tsx`, `page.tsx`, `globals.css`). The `@/*` import alias maps to `src/*`.

## UI standards

Read `docs/ui.md` before writing any UI code. Only shadcn/ui components may be used; custom components are NOT permitted.

## Data fetching standards

Read `docs/fetching-data.md` before writing any code that reads data. All data is fetched in Server Components via Drizzle helpers in `src/data/` (no raw SQL, no route handlers or client-side fetching), and users may only access their own data.

## Next.js version caveat

This Next.js version has breaking changes relative to common training data. Per `AGENTS.md`, read the relevant guide in `node_modules/next/dist/docs/` (`01-app` for App Router) before writing any code, and heed deprecation notices.
