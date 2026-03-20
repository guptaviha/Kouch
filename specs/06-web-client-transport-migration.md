# Ticket 06 — Migrate the web app from Socket.IO to a PartyKit transport layer

## Objective
Replace the current Socket.IO-coupled frontend transport with a PartyKit-compatible client abstraction while preserving host/player UI behavior.

## Why this ticket exists
The frontend currently depends on `socket.io-client` semantics inside the zustand slice. That makes the UI tightly coupled to the old server protocol and blocks a clean PartyKit migration.

## Scope
- Replace the current websocket slice with a transport abstraction.
- Connect the web app to PartyKit rooms using `partysocket` or a thin WebSocket wrapper.
- Update host/player pages and shared layouts to consume the new event model.

## Technical requirements
- Introduce a transport interface, for example:
  - `connect(session)`
  - `disconnect()`
  - `send(event)`
  - `subscribe(handler)`
- The zustand store should depend on that transport interface, not on Socket.IO types.
- Remove `socket.io-client` from web app runtime dependencies after migration.
- Support connection states:
  - idle
  - connecting
  - connected
  - reconnecting
  - disconnected
  - failed
- Keep existing reconnect UX such as toasts/modals where appropriate.
- Parse every inbound server payload through shared contracts.

## Implementation notes
- Replace `src/lib/store/slices/websocketSlice.ts` with a transport slice or service adapter.
- Update `src/lib/socket/handleServerMessage.ts` to consume the new snapshot-oriented protocol.
- Prefer a single subscription stream of typed events instead of event-name strings like `'server'` and `'message'`.
- Keep host/player UI components unaware of PartyKit specifics.
- Preserve local profile caching only if it remains compatible with signed session flows from Ticket 07.

## Migration guidance
Current UI integrations to revisit include:
- host room creation
- player join
- answer submission
- pause/resume
- timer updates
- room close handling
- reconnect state handling

## Deliverables
- New PartyKit transport adapter.
- Store integration updated.
- Host/player flows running without `socket.io-client`.
- Old socket-specific code removed or isolated behind a temporary feature flag.

## Acceptance criteria
- Host and player UIs can connect to the realtime room through the new transport.
- No UI code calls Socket.IO-specific APIs.
- TypeScript catches invalid outbound event payloads from the client.
- Reconnect UI still works when the websocket drops and resumes.

## Dependencies
- Tickets 02 and 04. Ticket 05 is strongly recommended before landing this ticket fully.

## Out of scope
- Session signing and auth policy details.
- Production cutover.
