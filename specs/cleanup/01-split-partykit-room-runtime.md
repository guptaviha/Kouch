# Ticket 01 — Split the PartyKit room runtime into focused modules

## Status
Completed.

## Objective
Reduce `apps/realtime/party/index.ts` to a thin PartyKit entrypoint by moving bootstrap, session parsing, checkpoint recovery, connection bookkeeping, and event fanout into focused modules.

## Why this ticket exists
- `apps/realtime/party/index.ts` is 1,786 lines and currently mixes HTTP bootstrap endpoints, token parsing, room lifecycle, alarms, metrics, and websocket command handling in one file.
- The file contains transitional or unused helpers such as `decodeBase64Url()` and still returns `encodedSession` values even though the websocket connection path is validated with signed session tokens.
- Small changes are harder than they need to be because room lifecycle, transport concerns, and logging are interleaved inside one class.

## Scope
- Extract pure helpers from `apps/realtime/party/index.ts` into focused modules such as:
  - `session.ts` for room code normalization, env helpers, and signed-session parsing
  - `bootstrap.ts` for create-room and join-room HTTP flows
  - `checkpoint.ts` for checkpoint persistence, alarm scheduling, and recovery
  - `connection-registry.ts` for participant and connection bookkeeping
  - `event-emitter.ts` for snapshot and domain-event broadcasts
- Keep the PartyKit `Server` class focused on orchestration.
- Remove unused helpers and transitional fields once callers are updated.
- Add targeted tests around extracted modules so behavior does not depend only on end-to-end room tests.

## Expected benefit
- Smaller, testable units with clearer ownership.
- Less merge-conflict pressure in the busiest realtime file.
- Easier debugging of alarms, reconnects, and bootstrap failures.

## Acceptance criteria
- `apps/realtime/party/index.ts` no longer owns bootstrap logic, session parsing, checkpoint persistence, and domain-event fanout directly.
- Dead helpers such as `decodeBase64Url()` are removed.
- Extracted modules have focused tests covering their main behavior.
- Room behavior remains unchanged for create, join, reconnect, alarm recovery, and room close flows.

## Out of scope
- Changing gameplay rules in `packages/game-engine`.
- Removing legacy Socket.IO support across the rest of the repo.