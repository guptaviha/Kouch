# Ticket 02 — Add typed Game Database APIs

## Objective
Create typed API contracts and route handlers for administering and browsing curated game entries.

## Why this ticket exists
The admin UI and public browse UI both need a stable server contract. The existing `/api/games` endpoints already serve playable packs, so this feature needs a distinct typed surface.

## Scope
- Add dedicated Game Database types in the web app.
- Add admin routes for create, read, update, and taxonomy lookup.
- Add public routes for filtered list views and detail views.
- Add a small service layer or query helpers so route handlers do not inline all SQL.

## Proposed file layout
- `apps/web/src/types/game-catalog.ts`
- `apps/web/src/services/game-catalog-service.ts`
- `apps/web/src/app/api/admin/game-catalog/games/route.ts`
- `apps/web/src/app/api/admin/game-catalog/games/[id]/route.ts`
- `apps/web/src/app/api/admin/game-catalog/tags/route.ts`
- `apps/web/src/app/api/admin/game-catalog/equipment/route.ts`
- `apps/web/src/app/api/game-catalog/games/route.ts`
- `apps/web/src/app/api/game-catalog/games/[slug]/route.ts`

## Required types
- `GameCatalogTag`
- `GameCatalogEquipmentTag`
- `GameCatalogGameRecord`
- `GameCatalogListItem`
- `GameCatalogDetail`
- `GameCatalogFilters`
- `GameCatalogFacetOption`
- `GameCatalogListResponse`
- `CreateGameCatalogGamePayload`
- `UpdateGameCatalogGamePayload`

## API behavior

### Admin routes
- `GET /api/admin/game-catalog/games`
  - Returns recent games for the admin list.
  - Supports optional `limit`, `search`, and `tag` query params.
- `POST /api/admin/game-catalog/games`
  - Creates a new curated game record.
  - Accepts metadata, rules, tags, equipment tags, and optional `created_by`.
- `GET /api/admin/game-catalog/games/[id]`
  - Returns the full editable record.
- `PATCH /api/admin/game-catalog/games/[id]`
  - Updates the editable record and related tags.
- `GET /api/admin/game-catalog/tags`
  - Returns normalized general tags for autocomplete.
- `GET /api/admin/game-catalog/equipment`
  - Returns normalized equipment tags for autocomplete.

### Public routes
- `GET /api/game-catalog/games`
  - Returns grid-friendly items and the filter metadata needed by the browse page.
  - Supports `search`, `minPlayers`, `maxPlayers`, `idealPlayers`, `timeMin`, `timeMax`, `easeOfLearning`, `tags`, `requiresEquipment`, and `equipment` query params.
- `GET /api/game-catalog/games/[slug]`
  - Returns the full rules and metadata needed by the detail page.

## Validation and typing rules
- Follow the existing trivia admin pattern: sanitize all inputs and keep payload interfaces strict.
- Keep route handlers free of `any`.
- Normalize tag and equipment names to lowercase on write.
- Treat `created_by` as optional in the payload and default it on the server.
- When `requires_equipment` is `false`, the API should clear or ignore equipment tags to avoid contradictory records.

## Deliverables
- A dedicated type module for the Game Database.
- Typed route handlers for admin and public consumers.
- Shared query helpers or service methods used by the routes.

## Acceptance criteria
- The new API surface does not conflict with the existing `/api/games` pack endpoints.
- Admin consumers can create and update records with a typed payload.
- Public consumers can filter by all requested metadata.
- List responses include enough data for a grid plus sidebar filters without extra round-trips.

## Dependencies
- Ticket 01.

## Out of scope
- Authentication, authorization, or role management.
- Bulk CSV import or external data sync.