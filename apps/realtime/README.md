# Realtime App

This app contains the PartyKit realtime runtime that will own room state and multiplayer synchronization.

## Deployment target
Deploy this app independently to PartyKit / Cloudflare Workers and Durable Objects.

## Local development
From the repo root:
- `npm run dev:realtime`
- `npm run build:realtime`

Room bootstrap endpoints exposed by the realtime worker:
- `POST /api/rooms` — allocate a 4-letter room and mint a host session
- `POST /api/rooms/:code/join` — validate a room join and mint a player session
- `GET /healthz` — worker health check

The room endpoint itself exposes:
- `GET /parties/main/:code/health` — per-room health summary
- `GET /parties/main/:code/metadata` — safe room metadata lookup
- `GET /parties/main/:code/debug` — debug snapshot in non-production, or when `x-kouch-debug-token` matches `PARTYKIT_DEBUG_TOKEN`

Clients connect to `ws://.../parties/main/:code?session=<encoded-session>` after obtaining a session from the HTTP bootstrap flow.

## Responsibilities
- websocket/session attachment
- room state orchestration
- realtime fanout
- durable room recovery patterns

This app should not import from `apps/web`.
