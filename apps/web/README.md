# Web App

This app contains the Next.js 15 UI for:
- host pages
- player pages
- admin pages
- non-realtime HTTP APIs

## Deployment target
Deploy this app independently to a web host such as Netlify, Vercel, or another Node-compatible platform.

## Local development
From the repo root:
- `npm run dev:web`
- `npm run build:web`

## Environment
Create or link `apps/web/.env.local` for app-local environment variables.

Important public runtime variables should describe the cross-app boundary explicitly, for example:
- `NEXT_PUBLIC_REALTIME_BASE_URL`
- `NEXT_PUBLIC_REALTIME_PROVIDER` — `partykit` by default, or `socketio` during rollback windows

Server-side realtime bootstrap variables:
- `REALTIME_BASE_URL` — base URL for the PartyKit worker used by Next.js route handlers
- `KOUCH_SESSION_SECRET` — shared HMAC secret used to mint signed realtime session tokens

## Testing
From the repo root:
- `npm run test --workspace @kouch/web`

Current coverage includes:
- provider flag parsing
- PartyKit bootstrap helper calls
- browser websocket envelope handling

## Cutover note
- When `NEXT_PUBLIC_REALTIME_PROVIDER=partykit`, the browser uses the PartyKit websocket/session bootstrap flow.
- When `NEXT_PUBLIC_REALTIME_PROVIDER=socketio`, the browser transport switches to the legacy Socket.IO runtime and the PartyKit bootstrap endpoints fail closed.
