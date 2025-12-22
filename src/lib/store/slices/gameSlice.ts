/**
 * Zustand slice for game state management
 * This is typically meant for both host and player
 * */

import { StateCreator } from 'zustand';
import { RoomStates } from '@/lib/store/types';

export type GameSlice = {
    // use the shared RoomStates type here so the UI and store agree
    state: RoomStates;
    setState: (state: GameSlice['state']) => void;
    currentQuestion: string;
    setCurrentQuestion: (question: string) => void;
    // room code (4-letter) created by host and shown to players
    roomCode: string | null;
    setRoomCode: (code: string | null) => void;
    // timer/round state shared between host and players
    timerEndsAt: number | null;
    setTimerEndsAt: (ts: number | null) => void;
    pauseRemainingMs: number | null;
    setPauseRemainingMs: (ms: number | null) => void;
    // whether the game is paused (host toggles this, players read it)
    paused: boolean;
    setPaused: (v: boolean) => void;
    roundIndex: number | null;
    setRoundIndex: (idx: number | null) => void;
    // live countdown and round results for UI
    countdown: number;
    setCountdown: (sec: number) => void;
    roundResults: any;
    setRoundResults: (r: any) => void;
    nextTimerDurationMs: number | null;
    setNextTimerDurationMs: (ms: number | null) => void;
};

export const createGameSlice: StateCreator<GameSlice> = (set) => ({
    state: 'lobby',
    setState: (state) => set({ state }),
    currentQuestion: '',
    setCurrentQuestion: (question) => set({ currentQuestion: question }),
    roomCode: null,
    setRoomCode: (code) => set({ roomCode: code }),
    timerEndsAt: null,
    setTimerEndsAt: (ts) => set({ timerEndsAt: ts }),
    pauseRemainingMs: null,
    setPauseRemainingMs: (ms) => set({ pauseRemainingMs: ms }),
    paused: false,
    setPaused: (v) => set({ paused: v }),
    roundIndex: null,
    setRoundIndex: (idx) => set({ roundIndex: idx }),
    countdown: 0,
    setCountdown: (sec) => set({ countdown: sec }),
    roundResults: null,
    setRoundResults: (r) => set({ roundResults: r }),
    nextTimerDurationMs: null,
    setNextTimerDurationMs: (ms) => set({ nextTimerDurationMs: ms }),
});
