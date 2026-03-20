import { GameType, GamePack } from './game-types';

export interface GameDetails {
  id: GamePack;
  title: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  estimatedTime: string;
  thumbnailUrl?: string;
  imageUrl: string;
  features: string[];
  gameType?: GameType;
}
