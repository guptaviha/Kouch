# Ticket 02 — Create shared TypeScript-safe realtime contracts

## Objective
Replace the current ad hoc socket payload typing with a shared contracts package that provides both compile-time types and runtime validation.

## Why this ticket exists
The existing protocol in `src/types/socket.ts` is useful, but it is tied to the current app layout and only gives compile-time safety. PartyKit rooms must defensively validate inbound messages because any browser can connect directly to the room endpoint.

## Scope
- Create `packages/contracts`.
- Define all client-to-room and room-to-client messages there.
- Add runtime schemas for parsing inbound payloads.
- Add shared room state and snapshot types.
- Version the protocol.

## Technical requirements
- Use a schema library compatible with both Next.js and Workers, such as `zod` or `valibot`.
- Model messages as discriminated unions:
  - `ClientEvent`
  - `ServerEvent`
  - `RoomSnapshot`
  - `RoomCommand`
  - `ParticipantSession`
- Keep all payloads serializable with no class instances or `Map`/`Set` in public message types.
- Expose helper parsers:
  - `parseClientEvent()`
  - `isServerEvent()`
  - `createProtocolEnvelope()`
- Include explicit `protocolVersion` in handshake or session metadata.
- Replace loosely typed optional fields with narrower message-specific payloads.

## Contract design guidance
Recommended event groups:
- **Handshake**: `host_create_room`, `player_join_room`, `resume_session`
- **Gameplay commands**: `start_game`, `submit_answer`, `use_hint`, `pause_game`, `resume_game`, `extend_timer`, `skip_timer`, `reset_game`, `close_room`
- **Server state pushes**: `room_created`, `room_snapshot`, `lobby_update`, `round_started`, `round_result`, `game_finished`, `room_closed`, `error`
- **Presence/system**: `participant_joined`, `participant_left`, `participant_reconnected`, `heartbeat_ack`

## Implementation notes
- Prefer one `room_snapshot` event carrying the authoritative room view instead of many partially overlapping payloads.
- Keep derived UI-only values out of the wire format when they can be computed on the client.
- Use plain arrays/records in snapshot types so persistence to Durable Object storage is straightforward.
- Define reusable enums/unions for:
  - room phase
  - role (`host` / `player`)
  - game type
  - question type
- Add codecs for persisted room state separately from public wire messages if needed.

## Deliverables
- `packages/contracts` with runtime schemas and exported TypeScript types.
- Migration plan mapping old Socket.IO events to new PartyKit events.
- Consumer examples for both web and realtime apps.

## Acceptance criteria
- Both `apps/web` and `apps/realtime` import protocol types from the package.
- Every inbound client event can be validated at runtime.
- No `any` is needed for realtime event handling.
- The protocol can evolve without importing UI store code into the realtime runtime.

## Dependencies
- Ticket 01.

## Out of scope
- Rewriting the room runtime.
- Persisting room state.
