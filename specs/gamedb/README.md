# Game Database Rollout Plan

## Goal
Add a curated Game Database inside the existing `apps/web` app so admins can create game entries and players can browse a filterable library of games, rules, and metadata.

## Product framing
- User-facing name: **Game Database** or **Game Wiki**.
- Internal naming: prefer `game_catalog` in code and SQL to avoid collisions with the existing `/api/games` pack endpoints.
- Runtime target: this feature lives entirely in `apps/web` and its Neon-backed data layer.
- UI scope: the public browse experience should only define structure, required fields, and responsive behavior for now. Final visual design should wait for the screenshot reference.

## Delivery order
1. [01-game-catalog-schema.md](./01-game-catalog-schema.md)
2. [02-game-catalog-api-and-types.md](./02-game-catalog-api-and-types.md)
3. [03-admin-game-catalog-ui.md](./03-admin-game-catalog-ui.md)
4. [04-public-game-database-ui.md](./04-public-game-database-ui.md)

## Cross-ticket decisions
- Reuse the existing admin shell under `apps/web/src/app/admin` instead of creating a separate tool.
- Keep request and response payloads typed in the web app, following the current trivia admin pattern.
- Maintain database migrations under `db/migrations/` and schema documentation under `db/migrations/schema/`.
- Default `created_by` to `admin` on the server, but allow the API contract to accept an override string for future compatibility.
- Treat general tags and equipment tags as separate taxonomies so the public filter UI can expose them independently.
- Keep the first public browsing pass focused on browse, filtering, and rules display. Do not block the rollout on polished imagery or high-fidelity layout work.

## Definition of done
- Admins can create and edit curated game entries in the existing web app.
- The database supports the requested metadata: player counts, time, ease of learning, tags, equipment requirements, rules, author, and timestamps.
- Public users can browse a mobile-friendly grid and filter it by the supported metadata.
- The feature does not conflict with the existing trivia pack APIs or gameplay routes.