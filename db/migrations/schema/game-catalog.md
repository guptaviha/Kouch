# Game Catalog Schema

## Tables

### game_catalog_games
- `id` (bigserial, primary key)
- `slug` (text, unique, lowercase, required)
- `name` (text, required, case-insensitive unique)
- `short_description` (text, required)
- `rules_markdown` (text, required)
- `min_players` (int, required, at least 1)
- `max_players` (int, required, at least `min_players`)
- `ideal_players_min` (int, nullable, must stay within `min_players` / `max_players`)
- `ideal_players_max` (int, nullable, must stay within `min_players` / `max_players`)
- `min_play_time_minutes` (int, required, at least 1)
- `max_play_time_minutes` (int, required, at least `min_play_time_minutes`)
- `ease_of_learning` (int, required, check between 1 and 5)
- `requires_equipment` (boolean, default `false`)
- `created_by` (text, default `admin`)
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, auto-updated trigger)

### game_catalog_tags
- `id` (bigserial, primary key)
- `name` (text, unique, stored lowercase via API)
- `description` (text, nullable)
- `created_by` (text, default `admin`)
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, auto-updated trigger)

### game_catalog_game_tags
- `game_id` (bigint, FK -> `game_catalog_games.id`, cascade delete)
- `tag_id` (bigint, FK -> `game_catalog_tags.id`, cascade delete)
- `created_by` (text, default `admin`)
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, auto-updated trigger)
- Primary key: (`game_id`, `tag_id`)

### game_catalog_equipment_tags
- `id` (bigserial, primary key)
- `name` (text, unique, stored lowercase via API)
- `description` (text, nullable)
- `created_by` (text, default `admin`)
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, auto-updated trigger)

### game_catalog_game_equipment
- `game_id` (bigint, FK -> `game_catalog_games.id`, cascade delete)
- `equipment_tag_id` (bigint, FK -> `game_catalog_equipment_tags.id`, cascade delete)
- `created_by` (text, default `admin`)
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, auto-updated trigger)
- Primary key: (`game_id`, `equipment_tag_id`)

## Indexes
- Unique index on `slug` via the table-level unique constraint
- `idx_game_catalog_games_name_lower`
- `idx_game_catalog_games_ease_of_learning`
- `idx_game_catalog_games_requires_equipment`
- `idx_game_catalog_games_player_bounds`
- `idx_game_catalog_games_ideal_player_bounds`
- `idx_game_catalog_games_time_bounds`
- `idx_game_catalog_game_tags_tag_id`
- `idx_game_catalog_game_equipment_equipment_tag_id`

## Triggers
- `set_updated_at()` keeps `updated_at` current for all Game Catalog tables.