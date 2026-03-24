# Deployment and Cutover Guide

## Deployment split
- Web app: deploy `apps/web` to a Node-compatible host such as Vercel or Netlify.
- Realtime app: deploy `apps/realtime` to Cloudflare Workers / PartyKit.
- Legacy rollback runtime: keep `server/server.ts` deployable until PartyKit production cutover is stable.

## Required commands
From the repo root:
- Web build: `npm run build:web`
- Realtime build: `npm run build:realtime`
- Unit tests: `npm run test:unit`
- Integration tests: `npm run test:integration`
- Full CI gate: `npm run ci`

## Environment matrix

### Local
| App | Variable | Purpose |
| --- | --- | --- |
| web | `NEXT_PUBLIC_REALTIME_PROVIDER=partykit` | Selects PartyKit transport by default |
| web | `NEXT_PUBLIC_REALTIME_BASE_URL=http://127.0.0.1:1999` | Public base URL used by the browser transport |
| web | `REALTIME_BASE_URL=http://127.0.0.1:1999` | Server-side bootstrap target for Next.js route handlers |
| web | `KOUCH_SESSION_SECRET` | Signs realtime session tokens |
| realtime | `KOUCH_SESSION_SECRET` | Verifies realtime session tokens |
| realtime | `PARTYKIT_HOST` / PartyKit local config | Local PartyKit worker target |
| legacy socket | `PORT=3001` | Legacy rollback runtime port |
| legacy socket | `NEXT_TARGET=http://localhost:3000` | Proxy target for the old Socket.IO server |

### Preview / staging
| App | Variable | Purpose |
| --- | --- | --- |
| web | `NEXT_PUBLIC_REALTIME_PROVIDER=partykit` | Enables PartyKit for staging validation |
| web | `NEXT_PUBLIC_REALTIME_BASE_URL` | Public staging PartyKit base URL |
| web | `REALTIME_BASE_URL` | Server-to-worker staging PartyKit URL |
| web | `KOUCH_SESSION_SECRET` | Shared staging signing secret |
| realtime | `KOUCH_SESSION_SECRET` | Shared staging verification secret |
| realtime | `PARTYKIT_DEBUG_TOKEN` | Enables authenticated debug room inspection |
| realtime | content service secrets | Staging content access |

### Production
| App | Variable | Purpose |
| --- | --- | --- |
| web | `NEXT_PUBLIC_REALTIME_PROVIDER=partykit` | Production PartyKit cutover flag |
| web | `NEXT_PUBLIC_REALTIME_BASE_URL` | Public PartyKit origin |
| web | `REALTIME_BASE_URL` | Internal PartyKit bootstrap origin |
| web | `KOUCH_SESSION_SECRET` | Production signing secret |
| realtime | `KOUCH_SESSION_SECRET` | Production verification secret |
| realtime | `PARTYKIT_DEBUG_TOKEN` | Restricted production debug access |
| realtime | content service secrets | Production content access |

## CI coverage
The repository CI gate runs:
1. `npm run lint`
2. `npm run typecheck`
3. `npm run test:unit`
4. `npm run test:integration`

Coverage added for ticket 9:
- `packages/contracts` unit tests for protocol parsing and signed session tokens
- `packages/game-engine` unit tests for round transitions and timer intents
- `apps/realtime` integration tests for room lifecycle, invalid session rejection, and checkpoint recovery
- `apps/web` browser-facing transport tests for bootstrap helpers, websocket envelopes, and provider flags

## Cutover plan
1. Deploy the realtime worker to preview/staging.
2. Set staging web env vars to point `REALTIME_BASE_URL` and `NEXT_PUBLIC_REALTIME_BASE_URL` at the staging PartyKit worker.
3. Validate host/player happy paths, reconnects, timer expiry, invalid token rejection, and upstream pack failures.
4. Promote the same realtime build to production.
5. Switch production web env vars to PartyKit and keep the legacy socket deployment available during the observation window.
6. Monitor structured room logs and metric events:
   - `room_creates`
   - `joins`
   - `reconnects`
   - `invalid_commands`
   - `upstream_content_fetch_failures`
   - `round_transitions`

## Rollback controls
- Web-only rollback: set `NEXT_PUBLIC_REALTIME_PROVIDER=socketio` and point `NEXT_PUBLIC_REALTIME_BASE_URL` at the legacy socket host.
- Keep the legacy runtime deployed during the rollback window so the browser can reconnect without redeploying the realtime worker.
- If bootstrap requests must be blocked immediately, the Next.js `/api/realtime/session/*` endpoints fail closed whenever the provider flag is `socketio`.
- Because the web and realtime apps deploy independently, the PartyKit worker can remain deployed while web traffic is temporarily shifted back to the legacy socket service.

## Legacy removal plan
Delete the following only after the PartyKit production path is stable and rollback is no longer needed:
1. Remove `server/server.ts` and the `server/` documentation.
2. Delete the root `dev:legacy-socket` script.
3. Remove root `socket.io` and web `socket.io-client` dependencies.
4. Delete the `socketio` branch from the realtime provider flag helper and transport slice.
5. Remove any environment variables that only exist for the legacy runtime.

## Validation checklist
- Host creates a room, players join, and the game finishes.
- Reconnect during an active round restores the latest state.
- Timer expiry advances the room without answers.
- Multi-part questions progress correctly.
- Rooms close cleanly and idle rooms expire.
- Invalid tokens and invalid commands are visible in logs.
- Pack fetch failures surface cleanly in the host bootstrap flow.
