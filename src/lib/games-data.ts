import { GameDetails } from '@/types/game-details';

export const GAMES_DATA: Record<string, GameDetails> = {
  trivia: {
    id: 'trivia',
    title: 'Trivia',
    description: 'Test your knowledge across various categories! Compete with friends to see who knows the most about everything from history to pop culture.',
    minPlayers: 2,
    maxPlayers: 8,
    estimatedTime: '15-30 mins',
    imageUrl: '/Trivia Fiesta Holiday pack.png',
    features: ['Multiple Categories', 'Fast-paced Rounds', 'Live Scoreboard'],
  },
  rebus: {
    id: 'rebus',
    title: 'Rebus',
    description: 'Decipher the hidden meaning behind the images. A visual puzzle game that challenges your lateral thinking and wordplay skills.',
    minPlayers: 2,
    maxPlayers: 8,
    estimatedTime: '10-20 mins',
    imageUrl: '/Rebus Cafe.png',
    features: ['Visual Puzzles', 'Wordplay Challenges', 'Brain Teasers'],
  },
};

export const getAllGames = (): GameDetails[] => {
  return Object.values(GAMES_DATA);
};

export const getGameDetails = (id: string): GameDetails | null => {
  return GAMES_DATA[id] || null;
};
