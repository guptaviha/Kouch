# Ticket 04 — Build the PartyKit room runtime

## Objective
Replace the placeholder PartyKit server with a real room runtime where each room code maps to a PartyKit party / Durable Object that owns gameplay state and presence.

## Why this ticket exists
`party/index.ts` is currently just a demo echo server. The app needs a production-oriented PartyKit runtime that follows Durable Object patterns instead of emulating a Node Socket.IO server.

## Scope
- Implement the PartyKit room server.
- Define room naming strategy and connection flow.
- Implement authoritative state management in the room.
- Support host and player roles.

## PartyKit best-practice decisions
- Use **one room object per room code**.
- Use the room object as the only authoritative source of truth for active game state.
- Keep hot state in memory for low-latency fanout, but persist checkpoints needed for recovery.
- Use `onConnect`, `onMessage`, and `onRequest` deliberately:
  - `onConnect` for validated session attachment
  - `onMessage` for typed commands
  - `onRequest` for health checks, metadata lookup, or debug-safe snapshot fetches
- Broadcast normalized state updates rather than room-internal implementation details.
- Keep connection-specific metadata separate from persisted room state.

## Technical requirements
- Create a typed room state model, for example:
  - room identity
  - host session
  - player roster
  - game phase
  - current round state
  - scoring state
  - timer/alarm metadata
  - protocol version
- Maintain participant connection index by session ID and connection ID.
- Implement room creation and join semantics with typed errors.
- Add host reassociation/reconnect support.
- Add room close semantics and cleanup rules.
- Add a lightweight debug endpoint in `onRequest` gated for non-production or signed access.

## Message flow guidance
Recommended sequence:
1. Web app requests a signed host/player session token.
2. Browser opens a PartySocket connection to the room endpoint.
3. Room validates session claims.
4. Room attaches participant connection.
5. Room sends a full `room_snapshot`.
6. Subsequent commands mutate room state and broadcast updated snapshots or event-specific payloads.

## Implementation notes
- Do not port Socket.IO APIs 1:1.
- Treat reconnect as reattaching a logical participant to a new websocket connection.
- Avoid storing raw websocket objects inside persisted state.
- Use explicit helper methods like:
  - `broadcastSnapshot()`
  - `sendToParticipant()`
  - `applyCommand()`
  - `persistCheckpoint()`
- Add room state versioning so stale resumes can be detected.
- Keep all Room internals TypeScript strict; no ambient `any`.

## Deliverables
- A PartyKit room server replacing the starter implementation.
- Connection/session attachment flow.
- Snapshot broadcasting and room lifecycle management.
- Local development configuration for PartyKit.

## Acceptance criteria
- Host can create a room and receive a room code.
- Players can join the same PartyKit room by code.
- Room presence and phase changes are broadcast without Socket.IO.
- Realtime runtime does not depend on Node HTTP server behavior.

## Dependencies
- Tickets 01, 02, and 03.

## Out of scope
- Full game logic migration.
- Client-side store migration.
