/**
 * Shared game types - single source of truth for valid games
 */

export const VALID_GAMES = ['rebus', 'trivia'] as const;

export type GamePack = typeof VALID_GAMES[number];

/**
 * Type guard to check if a string is a valid game
 */
export function isValidGame(value: unknown): value is GamePack {
  return typeof value === 'string' && VALID_GAMES.includes(value as GamePack);
}
