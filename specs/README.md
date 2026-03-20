# PartyKit Refactor Plan

## Goal
Refactor Kouch so the realtime multiplayer runtime is powered by PartyKit and Cloudflare Durable Objects, while the Next.js app remains independently deployable on separate infrastructure.

Recommended target deployment split:
- `apps/web`: Next.js 15 app for host pages, player pages, admin UI, and non-realtime HTTP APIs.
- `apps/realtime`: PartyKit app running on Cloudflare Workers / Durable Objects for authoritative room state and realtime gameplay.
- `packages/contracts`: shared TypeScript-safe protocol, schemas, and event definitions.
- `packages/game-engine`: pure TypeScript game state transitions and scoring logic reused by realtime runtime and tests.
- `packages/config`: shared environment helpers, constants, and feature flags if needed.

## Architecture Principles
1. **One Party per room code**: each game room maps to a single PartyKit room / Durable Object instance.
2. **Authoritative server state**: room state lives in the PartyKit room, not in browser memory.
3. **TypeScript-safe boundaries**: all client/server payloads use shared discriminated unions plus runtime validation.
4. **Transport abstraction**: the Next.js app should not depend directly on Socket.IO APIs.
5. **Edge-safe code only in realtime app**: no importing Next.js server code into PartyKit.
6. **Pure domain logic**: scoring and round transitions live in framework-agnostic TypeScript modules.
7. **Reconnect-first design**: clients can recover state after network interruption without corrupting room state.
8. **Durable timers**: use Durable Object alarms or resumable scheduling patterns instead of Node timers as the source of truth.
9. **Incremental migration**: keep the existing app playable while tickets land one at a time.

## Suggested Delivery Order
1. [01-monorepo-split.md](./01-monorepo-split.md)
2. [02-shared-contracts.md](./02-shared-contracts.md)
3. [03-edge-data-access.md](./03-edge-data-access.md)
4. [04-partykit-room-runtime.md](./04-partykit-room-runtime.md)
5. [05-game-engine-extraction.md](./05-game-engine-extraction.md)
6. [06-web-client-transport-migration.md](./06-web-client-transport-migration.md)
7. [07-session-auth-bootstrap.md](./07-session-auth-bootstrap.md)
8. [08-reliability-persistence-observability.md](./08-reliability-persistence-observability.md)
9. [09-testing-deployment-cutover.md](./09-testing-deployment-cutover.md)

## Current-State Notes
The current implementation has a few constraints that the refactor must remove:
- The Socket.IO server is a Node process in `server/server.ts`.
- The experimental PartyKit file in `party/index.ts` is only a starter echo server.
- The frontend transport is coupled to Socket.IO in `src/lib/store/slices/websocketSlice.ts`.
- Shared message types exist in `src/types/socket.ts`, but they are not runtime validated.
- The Node socket server imports application code directly from `src/services/pack-service.ts`, which will not work cleanly for an edge-hosted realtime worker.
- Timers are in-memory `setTimeout` calls, which are not durable across process restarts.

## Best-Practice Decisions To Preserve Across All Tickets
- Use `partysocket` or a thin wrapper around the PartyKit WebSocket endpoint instead of Socket.IO.
- Keep room state as a typed single object with explicit versioning.
- Persist only what is needed for recovery and auditing; avoid writing every transient presence update.
- Validate every inbound message at the room boundary.
- Use signed session claims from the web app so the realtime runtime does not trust arbitrary client-provided host/player IDs.
- Separate game content loading from gameplay orchestration.
- Prefer pure TypeScript modules with no framework imports for business rules.
- Make all new packages ESM and strict-mode TypeScript compatible.

## Definition of Done for the Overall Refactor
- The Next.js app and realtime runtime build, test, and deploy independently.
- Host and player flows work with PartyKit-backed rooms.
- Room state survives reconnects and expected worker lifecycle transitions.
- Shared contracts are imported from a package, not duplicated across apps.
- The old Socket.IO server can be removed without breaking gameplay.
