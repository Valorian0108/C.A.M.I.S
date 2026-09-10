# MARGIN//EVENT

Pre-event margin consequence simulator for leveraged rToken traders.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/mockup-sandbox/src/components/mockups/margin-event/Desk.tsx` — current UI prototype
- `artifacts/mockup-sandbox/src/components/mockups/margin-event/_group.css` — prototype-local styles
- `README.md` — product overview and implementation plan
- `PROGRESS.md` — push-by-push progress log
- `attached_assets/Pasted--Base-Camp-Hackathon-S2-EN-When-tokenized-US-stocks-mak_1789011891049.txt` — hackathon brief

## Architecture decisions

- The product is positioned as an AI Trading Desk, with the human retaining final decision authority.
- Financial outputs must come from deterministic simulator rules; Qwen explains results and uncertainty but does not create the numerical truth.
- The interface uses an independent MARGIN//EVENT identity rather than obvious exchange branding.
- The current prototype is isolated in the mockup sandbox so its styles do not affect other reusable mockups.
- Credentials must remain server-side and must never be committed to the repository.

## Product

- Inspect upcoming rToken corporate actions.
- Compare account collateral and margin state before and after an event.
- Understand liquidation-buffer changes in plain language.
- Compare hold, add-collateral, and reduce-exposure scenarios.
- Use Qwen as a research copilot after deterministic calculations are complete.

## User preferences

- Keep the project documentation current.
- Add a progress entry for each implementation push so progress is easy to track.
- Push implementation changes to the connected GitHub repository when authentication is available.

## Gotchas

- The current mockup is not yet a deployable application.
- Do not put Qwen or Bitget credentials in frontend code, commits, or chat.
- Simulated numbers must be labeled until the official event and margin rules are connected.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
