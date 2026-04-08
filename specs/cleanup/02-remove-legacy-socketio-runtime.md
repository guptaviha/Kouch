# Ticket 02 — Remove the legacy Socket.IO runtime and dual transport branch

## Objective
Delete the old Socket.IO runtime and collapse the web app onto one PartyKit-only transport path.

## Why this ticket exists
- `server/server.ts` is 1,079 lines of legacy realtime logic that now sits beside the PartyKit room runtime.
- `apps/web/src/lib/store/slices/transportSlice.ts` duplicates room creation and join flows for both `socketio` and `partykit` providers.
- `apps/web/src/lib/transport/socketio-transport.ts`, `apps/web/src/lib/realtime/provider.ts`, the Dockerfile, and deployment docs all carry rollback-only behavior that increases maintenance cost.

## Scope
- Remove `server/server.ts` and the legacy server docs once no supported flow depends on them.
- Delete `apps/web/src/lib/transport/socketio-transport.ts`.
- Collapse `RealtimeProvider` and the transport slice bootstrap logic to a single PartyKit path.
- Remove `socket.io` and `socket.io-client` dependencies plus related environment variables and deployment instructions.
- Simplify the container/runtime story so the app no longer assumes a co-hosted Node socket server.

## Expected benefit
- Less duplicated logic in the client store.
- Fewer production modes, dependencies, and deployment branches.
- Easier local setup and a smaller blast radius for realtime changes.

## Acceptance criteria
- No application code branches on `socketio` versus `partykit`.
- Root and web package manifests no longer include Socket.IO dependencies.
- Deployment docs describe a single supported realtime path.
- Host and player flows run end-to-end through PartyKit only.

## Out of scope
- Rewriting existing PartyKit behavior.
- Adding a new rollback strategy.