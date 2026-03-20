# Ticket 01 — Split the repo into web and realtime apps

## Objective
Create a clean monorepo layout where the Next.js app and the realtime runtime can be developed, built, and deployed independently.

## Why this ticket exists
Right now the project mixes browser UI, Next.js server code, and the Node socket server in one runtime model. That prevents clean hosting separation and encourages cross-imports that will break in a Cloudflare Worker / PartyKit environment.

## Scope
- Introduce an `apps/` + `packages/` structure.
- Move the current Next.js app into `apps/web`.
- Create `apps/realtime` for PartyKit.
- Add shared workspace config for TypeScript, linting, and scripts.
- Preserve the current app behavior as much as possible during the move.

## Proposed target structure
```text
apps/
  web/
    src/
    package.json
    next.config.mjs
  realtime/
    party/
    package.json
    partykit.json
packages/
  contracts/
  game-engine/
  config/
```

## Technical requirements
- Use npm workspaces or pnpm workspaces. Pick one and apply it consistently.
- Add a root `tsconfig.base.json` with strict settings shared across all packages.
- Each app/package must have its own `tsconfig.json` extending the root config.
- Use TypeScript project references only if they simplify builds; otherwise keep builds independent with `exports` maps.
- Ensure `apps/realtime` does not import from `apps/web`.
- Add workspace scripts such as:
  - `dev:web`
  - `dev:realtime`
  - `dev`
  - `build:web`
  - `build:realtime`
  - `typecheck`
- Remove assumptions that the app and realtime server run on the same origin.

## Implementation notes
- Move the current `src/` tree into `apps/web/src/`.
- Move the current `party/` folder into `apps/realtime/party/`.
- Do **not** move shared message types directly into either app. That belongs in Ticket 02.
- Keep `db/` at repo root unless there is already a better home for migrations.
- Update absolute import aliases so web imports still resolve safely after the move.
- Add environment variable names that make the cross-app boundary explicit, for example:
  - `NEXT_PUBLIC_REALTIME_BASE_URL`
  - `REALTIME_INTERNAL_API_BASE_URL`
- Add a short architecture note to each app README describing its deployment target.

## Deliverables
- Workspace root config updated.
- `apps/web` builds and runs as the Next.js app.
- `apps/realtime` exists with PartyKit tooling wired up.
- Root scripts support parallel local development.
- No app imports code from the other app directly.

## Acceptance criteria
- Running web locally does not require the old Node socket server.
- Running realtime locally does not require the Next.js runtime to be imported as code.
- `tsc --noEmit` succeeds across the workspace.
- A new engineer can tell which code deploys to Netlify-style hosting and which code deploys to Cloudflare Workers.

## Dependencies
- None. This ticket should land first.

## Out of scope
- Migrating actual websocket logic.
- Changing gameplay behavior.
- Introducing authentication.
