# Ticket 03 — Extract edge-safe game content and room bootstrap data access

## Objective
Separate gameplay content loading and room bootstrap concerns from the Next.js app so the PartyKit runtime can fetch authoritative pack/question data without importing web app server code.

## Why this ticket exists
The current Node socket server imports `PackService` from the Next.js codebase. That is a bad boundary for Cloudflare Workers because it couples the realtime runtime to app internals and may rely on Node-only assumptions later.

## Scope
- Create a shared edge-safe data access layer or dedicated HTTP bootstrap API.
- Define how PartyKit loads trivia/rebus pack metadata and questions.
- Define how the web app creates signed session claims for host/player joins.

## Recommended approach
Use a split model:
1. **Web app** remains responsible for user-facing HTTP pages and admin CRUD.
2. **Realtime app** fetches pack/question payloads through one of these approaches:
   - preferred: direct edge-safe DB/API clients in `packages/game-content`
   - fallback: signed internal HTTP requests to web-owned APIs

For this project, the preferred route is likely:
- Trivia content: use an edge-compatible Neon HTTP client directly from the realtime app.
- Rebus content: call the existing third-party API directly from the realtime app with Cloudflare secrets.

## Technical requirements
- Create a package or module boundary such as `packages/game-content` or `apps/realtime/src/services`.
- No imports from `apps/web/src/services` into realtime.
- Define typed interfaces for:
  - `GamePackSummary`
  - `RoomPackDefinition`
  - `PlayableQuestion`
- Normalize trivia and rebus content into a shared runtime shape before room creation.
- Cache pack/question fetches per room bootstrap where safe, but do not rely on process-global caches for correctness.
- Ensure all external calls are compatible with Workers `fetch` semantics.

## Implementation notes
- Keep the normalization step pure and well-tested.
- Convert DB/API shapes into minimal gameplay payloads before storing them in room state.
- Avoid giving the room full admin-edit metadata it does not need.
- Add timeouts and error categorization for upstream data fetches.
- If content fetch fails during room creation, return a typed recoverable error to the host.

## Security notes
- Secrets for Neon and Rebus APIs must be configured separately for `apps/web` and `apps/realtime`.
- Do not expose admin credentials to the browser.
- If internal HTTP calls are used, require HMAC or signed bearer auth between apps.

## Deliverables
- Edge-safe content loading abstraction.
- Pack/question normalization utilities.
- Typed error model for room bootstrap failures.
- Documentation describing which runtime owns which external API credentials.

## Acceptance criteria
- A room can be created entirely from the realtime runtime without importing web app code.
- Both trivia and rebus content can be normalized into a shared room-ready structure.
- Data access code runs in a Worker-compatible environment.

## Dependencies
- Tickets 01 and 02.

## Out of scope
- Implementing PartyKit room websocket handling.
- Migrating the frontend transport.
