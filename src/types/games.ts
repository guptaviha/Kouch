/**
 * Shared game types - single source of truth for valid games
 */

export type GamePack = string;

/**
 * Type guard to check if a string is a valid game - for now accepts any string as we have dynamic packs
 */
export function isValidGame(value: unknown): value is GamePack {
  return typeof value === 'string' && value.length > 0;
}
