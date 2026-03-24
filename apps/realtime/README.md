# Realtime App

This app contains the PartyKit realtime runtime that will own room state and multiplayer synchronization.

## Deployment target
Deploy this app independently to PartyKit / Cloudflare Workers and Durable Objects.

## Local development
From the repo root:
- `npm run dev:realtime`
- `npm run build:realtime`
- `npm run test --workspace @kouch/realtime`

Room bootstrap endpoints exposed by the realtime worker:
- `POST /api/rooms` — allocate a 4-letter room and mint a host session
- `POST /api/rooms/:code/join` — validate a room join and mint a player session
- `GET /healthz` — worker health check

The room endpoint itself exposes:
- `GET /parties/main/:code/health` — per-room health summary
- `GET /parties/main/:code/metadata` — safe room metadata lookup
- `GET /parties/main/:code/debug` — debug snapshot in non-production, or when `x-kouch-debug-token` matches `PARTYKIT_DEBUG_TOKEN`

Clients connect to `ws://.../parties/main/:code?session=<encoded-session>` after obtaining a session from the HTTP bootstrap flow.

The worker now expects that `session` query param to be a web-issued signed token. The following env vars must match the web app:
- `KOUCH_SESSION_SECRET` — shared HMAC secret used to verify signed realtime session tokens
- `PARTYKIT_DEBUG_TOKEN` — optional production-only token for room debug access

Bootstrap HTTP endpoints are intended for the web app only and should be called with the internal headers the web app sends during session creation.

## Responsibilities
- websocket/session attachment
- room state orchestration
- realtime fanout
- durable room recovery patterns
- integration coverage for room lifecycle and checkpoint recovery

This app should not import from `apps/web`.

## Durability and recovery
- Each room persists a compact checkpoint in Durable Object storage under `room:checkpoint`.
- Stored checkpoint fields include the serializable game state, `lastActiveAt`, the last checkpoint reason, and the next scheduled alarm timestamp.
- Ephemeral runtime maps such as websocket connection references are never stored. They are rebuilt as clients reconnect.
- On room startup, the worker restores the last checkpoint, replays any expired round transitions, and re-schedules the next alarm.
- Alarms are used for both round timing and idle-room expiration. The next alarm is always the earliest of:
  - active round / round-result timer expiry
  - room inactivity TTL expiry when the room has no active connections

## Observability
- Structured logs are emitted for room lifecycle, command handling, transition failures, reconnects, and inactivity expiry.
- Log payloads include room code, room state, `stateVersion`, participant role, participant ID, command type, correlation ID, and failure reason when available.
- Log-based counters are emitted through `metric` events for:
  - `room_creates`
  - `joins`
  - `reconnects`
  - `invalid_commands`
  - `upstream_content_fetch_failures`
  - `round_transitions`
- The per-room debug endpoint now also exposes runtime checkpoint metadata:
  - `lastActiveAt`
  - `inactivityDeadline`
  - `scheduledAlarmAt`
  - `lastCheckpointReason`
  - active connection count

## Recovery scenarios to verify locally
1. Host reconnect during lobby
	- Create a room.
	- Connect the host websocket, then disconnect it.
	- Reconnect with the same signed session and confirm the lobby snapshot and player roster are restored.
2. Player reconnect during an active round
	- Start a round, disconnect a player, then reconnect with the same signed session.
	- Confirm the player receives the latest snapshot plus current round state.
3. Worker restart during a timer countdown
	- Start a round, persist a checkpoint, then restart the PartyKit worker before the timer ends.
	- Confirm startup reconciliation advances overdue timers and re-arms the next alarm.
4. Room expiration after inactivity
	- Leave a room with no active connections.
	- After the inactivity TTL, confirm the room is closed for inactivity and durable state is cleared.
5. Late join after game start
	- Start a game, then try to join with a brand-new player session.
	- Confirm the request is rejected and a structured warning is logged.
