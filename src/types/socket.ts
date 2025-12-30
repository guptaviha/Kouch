export type RoomPhase = 'lobby' | 'playing' | 'round_result' | 'finished';

export type PlayerWire = {
  id: string;
  name: string;
  score: number;
  avatar?: string;
  isNewUser?: boolean;
  connected?: boolean;
};

export type RoundResultEntry = {
  playerId: string;
  name: string;
  answer: string | null;
  correct: boolean;
  timeTaken: number | null;
  points: number;
  base: number;
  bonus: number;
  hintUsed: boolean;
};

export type ClientMessage =
  | { type: 'fetch_room_for_game'; name?: string; pack?: string; userId?: string; avatar?: string }
  | { type: 'join'; roomCode: string; name?: string; userId?: string; avatar?: string }
  | { type: 'start_game'; roomCode: string; playerId: string }
  | { type: 'pause_game' }
  | { type: 'resume_game' }
  | { type: 'submit_answer'; roomCode: string; playerId: string; answer: string }
  | { type: 'use_hint'; roomCode: string; playerId: string }
  | { type: 'reset_game'; roomCode?: string; playerId?: string; hostId?: string }
  | { type: 'extend_timer'; roomCode?: string; playerId?: string; hostId?: string }
  | { type: 'ping' }
  | { type: 'mock'; roomCode?: string };

export type ServerMessage =
  | { type: 'room_created'; roomCode: string; player: PlayerWire; pack?: string; reused?: boolean; players?: PlayerWire[]; state?: RoomPhase }
  | { type: 'lobby_update'; roomCode: string; players: PlayerWire[]; state: RoomPhase }
  | {
    type: 'game_state';
    state: 'playing';
    roomCode: string;
    roundIndex: number;
    question: string;
    image?: string;
    hint?: string;
    timerEndsAt: number;
    totalQuestionDuration: number;
    answeredPlayers?: string[];
  }
  | {
    type: 'round_result';
    roomCode: string;
    roundIndex: number;
    results: RoundResultEntry[];
    leaderboard: PlayerWire[];
    correctAnswer: string;
    nextTimerEndsAt: number;
    nextTimerDurationMs: number;
  }
  | { type: 'final_leaderboard'; roomCode: string; leaderboard: PlayerWire[] }
  | { type: 'game_paused'; roomCode: string; pauseRemainingMs: number }
  | { type: 'game_resumed'; roomCode: string; nextTimerEndsAt: number }
  | { type: 'timer_updated'; roomCode: string; timerEndsAt: number; totalQuestionDuration: number }
  | { type: 'joined'; roomCode: string; player: PlayerWire }
  | { type: 'answer_received'; roundIndex: number }
  | { type: 'player_answered'; roomCode: string; playerId: string }
  | { type: 'player_hint_used'; playerId: string }
  | { type: 'mock_added'; roomCode: string }
  | { type: 'host_promoted'; roomCode: string; hostId: string }
  | { type: 'pong' }
  | { type: 'error'; message: string };

export interface ClientToServerEvents {
  message: (payload: ClientMessage) => void;
  client: (payload: ClientMessage) => void;
}

export interface ServerToClientEvents {
  server: (payload: ServerMessage) => void;
}

export interface SocketData {
  roomCode?: string;
  playerId?: string;
  hostId?: string;
}
