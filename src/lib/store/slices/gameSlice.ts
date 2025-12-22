/**
 * Zustand slice for game state management
 * This is typically meant for both host and player
 * */

import { StateCreator } from 'zustand';
import { RoomStates, PlayerInfo } from '@/lib/store/types';

export type GameSlice = {
    // use the shared RoomStates type here so the UI and store agree
    state: RoomStates;
    setState: (state: GameSlice['state']) => void;
    currentQuestion: string;
    setCurrentQuestion: (question: string) => void;
    // room code (4-letter) created by host and shown to players
    roomCode: string | null;
    setRoomCode: (code: string | null) => void;
    // players in the current room (host side authoritative)
    players: PlayerInfo[];
    setPlayers: (players: PlayerInfo[]) => void;
};

export const createGameSlice: StateCreator<GameSlice> = (set) => ({
    state: 'lobby',
    setState: (state) => set({ state }),
    currentQuestion: '',
    setCurrentQuestion: (question) => set({ currentQuestion: question }),
    roomCode: null,
    setRoomCode: (code) => set({ roomCode: code }),
    players: [],
    setPlayers: (players) => set({ players }),
});
