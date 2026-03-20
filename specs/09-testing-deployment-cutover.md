# Ticket 09 — Testing, deployment separation, and production cutover

## Objective
Finish the migration with reliable test coverage, separate deployment pipelines, and a controlled switchover from the old socket server to PartyKit.

## Why this ticket exists
Even a correct PartyKit implementation can fail operationally if deployment boundaries, environment configuration, and rollback paths are not explicit.

## Scope
- Add test coverage across packages and apps.
- Define independent deployment pipelines for web and realtime apps.
- Introduce feature flags and rollback controls.
- Remove the old socket server when migration confidence is high.

## Technical requirements
- Add test layers:
  - unit tests for `packages/contracts`
  - unit tests for `packages/game-engine`
  - integration tests for PartyKit room flows
  - basic browser flow coverage for host/player happy paths
- Define environment matrices for:
  - local
  - preview/staging
  - production
- Separate deploy commands and secrets for:
  - `apps/web` to Netlify/Vercel/other Node-compatible host
  - `apps/realtime` to Cloudflare Workers / PartyKit
- Add a feature flag such as `NEXT_PUBLIC_REALTIME_PROVIDER=socketio|partykit` if a staged migration is needed.
- Provide rollback instructions that can disable PartyKit traffic without redeploying both apps.

## Recommended validation scenarios
- Host creates room, players join, game completes.
- Reconnect during active round.
- Timer expiry without answers.
- Multi-part question progression.
- Room close and cleanup.
- Invalid token or invalid command rejection.
- Upstream content service failure on room creation.

## Deliverables
- CI steps for typecheck, lint, unit tests, and integration tests.
- Deployment docs for separate hosting targets.
- Feature flag / cutover plan.
- Removal plan for `server/server.ts` and old Socket.IO dependencies.

## Acceptance criteria
- Web and realtime apps deploy independently with separate secrets.
- The PartyKit path can be enabled in staging without affecting existing production gameplay.
- A rollback path exists and is documented.
- Legacy Socket.IO server code can be deleted once cutover is complete.

## Dependencies
- All previous tickets.

## Out of scope
- New gameplay features unrelated to the migration.
