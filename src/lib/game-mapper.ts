import { GameDetails } from '@/types/game-details';
import { TriviaPack } from '@/types/trivia';

export function mapPackToGame(pack: TriviaPack): GameDetails {
    return {
        id: pack.id.toString(),
        title: pack.name,
        description: pack.description || '',
        imageUrl: pack.image_url,
        // TODO: Add fields to database, temporarily hardcoded
        minPlayers: 2,
        maxPlayers: 10,
        estimatedTime: '15-30 mins',
        features: ['Multiplayer', 'Trivia', 'Live Host'],
    };
}
