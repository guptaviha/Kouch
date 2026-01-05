import { GameDetails } from '@/types/game-details';
import type { GamePackDetail } from '@/types/game-types';

export function mapPackToGame(pack: GamePackDetail): GameDetails {
    const gameTypeFeature = pack.gameType === 'rebus' ? 'Rebus' : 'Trivia';
    
    return {
        id: pack.id.toString(),
        title: pack.name,
        description: pack.description || '',
        imageUrl: pack.image_url,
        // TODO: Add fields to database, temporarily hardcoded
        minPlayers: 2,
        maxPlayers: 10,
        estimatedTime: '15-30 mins',
        features: ['Multiplayer', gameTypeFeature, 'Live Host'],
        gameType: pack.gameType,
    };
}
