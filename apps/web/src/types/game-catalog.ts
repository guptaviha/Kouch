export interface GameCatalogTag {
  id: number;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GameCatalogEquipmentTag {
  id: number;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GameCatalogGameRecord {
  id: number;
  slug: string;
  name: string;
  short_description: string;
  rules_markdown: string;
  min_players: number;
  max_players: number;
  ideal_players_min: number | null;
  ideal_players_max: number | null;
  min_play_time_minutes: number;
  max_play_time_minutes: number;
  ease_of_learning: number;
  requires_equipment: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  tags: GameCatalogTag[];
  equipment_tags: GameCatalogEquipmentTag[];
}

export interface GameCatalogListItem {
  id: number;
  slug: string;
  name: string;
  short_description: string;
  min_players: number;
  max_players: number;
  ideal_players_min: number | null;
  ideal_players_max: number | null;
  min_play_time_minutes: number;
  max_play_time_minutes: number;
  ease_of_learning: number;
  requires_equipment: boolean;
  tags: Array<Pick<GameCatalogTag, 'id' | 'name'>>;
  equipment_tags: Array<Pick<GameCatalogEquipmentTag, 'id' | 'name'>>;
}

export type GameCatalogDetail = GameCatalogGameRecord;

export interface GameCatalogFacetOption {
  name: string;
  count: number;
}

export interface GameCatalogFilterMetadata {
  tags: GameCatalogFacetOption[];
  equipment_tags: GameCatalogFacetOption[];
  ease_of_learning_options: number[];
  player_count_bounds: {
    min_players: number | null;
    max_players: number | null;
  };
  play_time_bounds: {
    min_play_time_minutes: number | null;
    max_play_time_minutes: number | null;
  };
}

export interface GameCatalogFilters {
  search: string | null;
  player_count: number | null;
  min_players: number | null;
  max_players: number | null;
  ideal_players: number | null;
  min_play_time_minutes: number | null;
  max_play_time_minutes: number | null;
  ease_of_learning: number[];
  tags: string[];
  requires_equipment: boolean | null;
  equipment: string[];
  limit: number;
  offset: number;
}

export interface GameCatalogListResponse {
  games: GameCatalogListItem[];
  total_count: number;
  filters: GameCatalogFilterMetadata;
  applied_filters: GameCatalogFilters;
}

export interface CreateGameCatalogTagPayload {
  name: string;
  description?: string | null;
  created_by?: string;
}

export interface CreateGameCatalogGamePayload {
  slug?: string;
  name: string;
  short_description: string;
  rules_markdown: string;
  min_players: number;
  max_players: number;
  ideal_players_min?: number | null;
  ideal_players_max?: number | null;
  min_play_time_minutes: number;
  max_play_time_minutes: number;
  ease_of_learning: number;
  requires_equipment?: boolean;
  created_by?: string;
  tag_names?: string[];
  equipment_names?: string[];
}

export interface UpdateGameCatalogGamePayload extends Partial<CreateGameCatalogGamePayload> {}