import { GamePack } from './games';

export interface GameDetails {
  id: GamePack;
  title: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  estimatedTime: string;
  thumbnailUrl?: string;
  features: string[];
}
