# Ticket 08 — Add durability, recovery, and observability to the realtime system

## Objective
Make the PartyKit runtime resilient to disconnects, worker lifecycle changes, and production debugging needs.

## Why this ticket exists
The current socket server relies on in-memory maps and Node timers. In a Durable Object model, state survives differently, connections can drop and resume, and timers should not depend on one process staying alive forever.

## Scope
- Define what room state is persisted.
- Replace timer assumptions with durable scheduling.
- Add observability for room lifecycle and gameplay issues.
- Add recovery behavior for reconnects and room restoration.

## Technical requirements
- Persist a checkpointed room snapshot to Durable Object storage at meaningful boundaries, for example:
  - room created
  - player joined/left if roster changed materially
  - game started
  - answer accepted
  - round advanced
  - room closed
- Do not persist raw websocket connection objects.
- Use alarms or an equivalent durable scheduling mechanism for round expiry / interstitial transitions.
- On room startup, restore the last persisted snapshot and reconcile timers.
- Track a monotonic room `stateVersion` or event sequence number.
- Add structured logs with room code, role, participant ID, command type, and failure reason.
- Add metrics or at least log-based counters for:
  - room creates
  - joins
  - reconnects
  - invalid commands
  - upstream content fetch failures
  - round transitions

## Implementation notes
- Persist snapshots in a compact serializable shape.
- Avoid writing every heartbeat or transient presence mutation to storage.
- Recompute ephemeral indexes like connection maps after restore.
- Make room recovery idempotent.
- Add debug-only endpoints or log correlation IDs to help inspect broken rooms without exposing secrets.

## Recovery behavior to define
- Host reconnect during lobby.
- Player reconnect during active round.
- Worker restart during timer countdown.
- Room expiration after inactivity.
- Late join attempts after game start.

## Deliverables
- Durable persistence strategy documented and implemented.
- Alarm-based or durable timer orchestration.
- Structured logging and local debugging guidance.
- Recovery test scenarios documented.

## Acceptance criteria
- Active rooms can recover from expected runtime restarts without corrupting state.
- Countdown transitions remain correct after recovery.
- Debugging a broken room does not require attaching directly to process memory.
- Invalid commands are visible in logs with enough context to diagnose safely.

## Dependencies
- Tickets 04, 05, 06, and 07.

## Out of scope
- Final deployment cutover.
- Product analytics dashboards.
