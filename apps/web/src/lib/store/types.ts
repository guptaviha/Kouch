export type RoomStates = 'lobby' | 'playing' | 'round_result' | 'finished' | 'home' | 'error';

// If you need other shared types for the game slice, add them here.
export type PlayerInfo = {
	id: string;
	name: string;
	score: number;
	avatar?: string;
	connected?: boolean;
};

