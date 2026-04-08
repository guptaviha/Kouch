# Ticket 03 — Normalize realtime session bootstrap and prune legacy contracts

## Status
Completed.

## Objective
Make session bootstrap, websocket connection, and shared contract types describe one current protocol instead of a mix of legacy and current flows.

## Why this ticket exists
- `apps/web/src/lib/realtime/session-bootstrap.ts` creates signed session tokens and `apps/web/src/lib/transport/partykit-transport.ts` expects a `sessionToken` field.
- `apps/realtime/party/index.ts` still generates local `encodedSession` values and threads them into websocket URLs, even though `parseSessionFromRequest()` verifies signed session tokens.
- `packages/contracts/src/index.ts` still includes legacy transport-era commands, events, and fields such as `fetch_room_for_game`, `join`, `room_created`, `joined`, and `isNewUser`, which keep transitional states alive in the client and tests.
- Debug-only events like `mock` and `mock_added` are mixed into the same production contract surface.

## Scope
- Standardize on one session-token field name and one token generation path.
- Remove local base64 session encoding helpers from the PartyKit worker.
- Prune or isolate legacy and debug-only contract members that are no longer part of the supported runtime flow.
- Update bootstrap endpoints, client parsers, and tests to use the simplified protocol.
- Prefer `room_snapshot` plus explicit lifecycle events over duplicated handshake events when the snapshot already carries the needed state.

## Expected benefit
- Smaller protocol surface with fewer impossible combinations.
- Less client branching around old handshake events.
- Clearer security model because all websocket sessions come from the same signed-token flow.

## Acceptance criteria
- The PartyKit bootstrap payload uses one token field consistently across web and realtime code.
- Unused contract fields and events tied only to the old transport are removed or moved behind a debug-only contract.
- The client no longer depends on `isNewUser` or legacy join/create events for the PartyKit path.
- Contract and transport tests are updated to match the simplified handshake.

## Out of scope
- Removing gameplay events that are still used by the PartyKit runtime.
- Changing the visual behavior of host and player screens.