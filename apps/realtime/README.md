# Realtime App

This app contains the PartyKit realtime runtime that will own room state and multiplayer synchronization.

## Deployment target
Deploy this app independently to PartyKit / Cloudflare Workers and Durable Objects.

## Local development
From the repo root:
- `npm run dev:realtime`
- `npm run build:realtime`

For now, the build step is a strict TypeScript validation step until the PartyKit runtime is implemented beyond the starter room.

## Responsibilities
- websocket/session attachment
- room state orchestration
- realtime fanout
- durable room recovery patterns

This app should not import from `apps/web`.
