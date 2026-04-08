CREATE TABLE game_catalog_games (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_description TEXT NOT NULL,
  rules_markdown TEXT NOT NULL,
  min_players INT NOT NULL,
  max_players INT NOT NULL,
  ideal_players_min INT,
  ideal_players_max INT,
  min_play_time_minutes INT NOT NULL,
  max_play_time_minutes INT NOT NULL,
  ease_of_learning INT NOT NULL,
  requires_equipment BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT game_catalog_games_slug_format CHECK (slug = LOWER(BTRIM(slug)) AND slug <> ''),
  CONSTRAINT game_catalog_games_player_range CHECK (min_players >= 1 AND max_players >= min_players),
  CONSTRAINT game_catalog_games_ideal_min_range CHECK (
    ideal_players_min IS NULL OR (ideal_players_min >= min_players AND ideal_players_min <= max_players)
  ),
  CONSTRAINT game_catalog_games_ideal_max_range CHECK (
    ideal_players_max IS NULL OR (ideal_players_max >= min_players AND ideal_players_max <= max_players)
  ),
  CONSTRAINT game_catalog_games_ideal_range_order CHECK (
    ideal_players_min IS NULL OR ideal_players_max IS NULL OR ideal_players_max >= ideal_players_min
  ),
  CONSTRAINT game_catalog_games_time_range CHECK (
    min_play_time_minutes >= 1 AND max_play_time_minutes >= min_play_time_minutes
  ),
  CONSTRAINT game_catalog_games_learning_range CHECK (ease_of_learning BETWEEN 1 AND 5)
);

CREATE TABLE game_catalog_tags (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE game_catalog_game_tags (
  game_id BIGINT NOT NULL REFERENCES game_catalog_games(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES game_catalog_tags(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, tag_id)
);

CREATE TABLE game_catalog_equipment_tags (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE game_catalog_game_equipment (
  game_id BIGINT NOT NULL REFERENCES game_catalog_games(id) ON DELETE CASCADE,
  equipment_tag_id BIGINT NOT NULL REFERENCES game_catalog_equipment_tags(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, equipment_tag_id)
);

CREATE UNIQUE INDEX idx_game_catalog_games_name_lower ON game_catalog_games (LOWER(name));
CREATE INDEX idx_game_catalog_games_ease_of_learning ON game_catalog_games (ease_of_learning);
CREATE INDEX idx_game_catalog_games_requires_equipment ON game_catalog_games (requires_equipment);
CREATE INDEX idx_game_catalog_games_player_bounds ON game_catalog_games (min_players, max_players);
CREATE INDEX idx_game_catalog_games_ideal_player_bounds ON game_catalog_games (ideal_players_min, ideal_players_max);
CREATE INDEX idx_game_catalog_games_time_bounds ON game_catalog_games (min_play_time_minutes, max_play_time_minutes);
CREATE INDEX idx_game_catalog_game_tags_tag_id ON game_catalog_game_tags (tag_id);
CREATE INDEX idx_game_catalog_game_equipment_equipment_tag_id ON game_catalog_game_equipment (equipment_tag_id);

CREATE TRIGGER trg_game_catalog_games_updated BEFORE UPDATE ON game_catalog_games
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_game_catalog_tags_updated BEFORE UPDATE ON game_catalog_tags
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_game_catalog_game_tags_updated BEFORE UPDATE ON game_catalog_game_tags
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_game_catalog_equipment_tags_updated BEFORE UPDATE ON game_catalog_equipment_tags
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_game_catalog_game_equipment_updated BEFORE UPDATE ON game_catalog_game_equipment
FOR EACH ROW EXECUTE FUNCTION set_updated_at();