# Ticket 01 — Define the Game Database schema

## Objective
Create the Neon schema for curated game records and their filter metadata.

## Why this ticket exists
The current database only models trivia content. A Game Database needs a dedicated schema for curated game entries, their rules, and their filterable metadata.

## Scope
- Add the next sequential SQL migration under `db/migrations/`.
- Add a matching schema document under `db/migrations/schema/`.
- Define a primary table for curated games.
- Define normalized tables for general tags and equipment tags.
- Add indexes and constraints needed for list and filter queries.

## Proposed tables

### game_catalog_games
- `id` (bigserial, primary key)
- `slug` (text, unique, required)
- `name` (text, unique, required)
- `short_description` (text, required)
- `rules_markdown` (text, required)
- `min_players` (int, required)
- `max_players` (int, required)
- `ideal_players_min` (int, nullable)
- `ideal_players_max` (int, nullable)
- `min_play_time_minutes` (int, required)
- `max_play_time_minutes` (int, required)
- `ease_of_learning` (int, required, check between 1 and 5)
- `requires_equipment` (boolean, default `false`)
- `created_by` (text, default `admin`)
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, default `now()` with update trigger)

### game_catalog_tags
- `id` (bigserial, primary key)
- `name` (text, unique, required, normalized to lowercase in the API)
- `description` (text, nullable)
- `created_by` (text, default `admin`)
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, default `now()` with update trigger)

### game_catalog_game_tags
- `game_id` (bigint, FK -> `game_catalog_games.id`, cascade delete)
- `tag_id` (bigint, FK -> `game_catalog_tags.id`, cascade delete)
- `created_by` (text, default `admin`)
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, default `now()` with update trigger)
- Primary key: (`game_id`, `tag_id`)

### game_catalog_equipment_tags
- `id` (bigserial, primary key)
- `name` (text, unique, required, normalized to lowercase in the API)
- `description` (text, nullable)
- `created_by` (text, default `admin`)
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, default `now()` with update trigger)

### game_catalog_game_equipment
- `game_id` (bigint, FK -> `game_catalog_games.id`, cascade delete)
- `equipment_tag_id` (bigint, FK -> `game_catalog_equipment_tags.id`, cascade delete)
- `created_by` (text, default `admin`)
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, default `now()` with update trigger)
- Primary key: (`game_id`, `equipment_tag_id`)

## Required constraints
- `min_players >= 1`
- `max_players >= min_players`
- `ideal_players_min` and `ideal_players_max`, when present, must stay within the min/max bounds
- `min_play_time_minutes >= 1`
- `max_play_time_minutes >= min_play_time_minutes`
- `ease_of_learning BETWEEN 1 AND 5`
- `slug` stored trimmed and lowercase via API sanitization

## Query and indexing notes
- Add an index on `slug` for detail lookups.
- Add indexes on `ease_of_learning`, `min_players`, `max_players`, `min_play_time_minutes`, and `max_play_time_minutes` to support filter queries.
- Add indexes on both join tables for reverse lookups by `tag_id` and `equipment_tag_id`.

## Deliverables
- SQL migration for the new schema.
- Schema markdown in `db/migrations/schema/`.
- A documented set of constraints that match the public filter model.

## Acceptance criteria
- The schema can store all requested metadata for a curated game entry.
- Tags and equipment tags are reusable across many games.
- `created_by` defaults to `admin` when omitted.
- The schema documentation is updated alongside the migration.

## Out of scope
- Ratings, favorites, analytics, or user-generated reviews.
- Final card imagery, thumbnails, or CDN upload flows.