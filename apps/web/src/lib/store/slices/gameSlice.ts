/**
 * Zustand slice for game state management
 * This is typically meant for both host and player
 * */

import { StateCreator } from 'zustand';
import { RoomStates } from '@/lib/store/types';
import type { QuestionType } from '@/types/game-types';

export type GameSlice = {
    // use the shared RoomStates type here so the UI and store agree
    state: RoomStates;
    setState: (state: GameSlice['state']) => void;
    currentQuestion: string;
    setCurrentQuestion: (question: string) => void;
    currentQuestionType: QuestionType | null;
    setCurrentQuestionType: (questionType: QuestionType | null) => void;
    currentPrompts: string[];
    setCurrentPrompts: (prompts: string[]) => void;
    currentPartIndex: number | null;
    setCurrentPartIndex: (idx: number | null) => void;
    totalParts: number | null;
    setTotalParts: (count: number | null) => void;
    // room code (4-letter) created by host and shown to players
    roomCode: string | null;
    setRoomCode: (code: string | null) => void;
    // timer/round state shared between host and players
    timerEndsAt: number | null;
    setTimerEndsAt: (ts: number | null) => void;
    totalQuestionDuration: number | null;
    setTotalQuestionDuration: (ms: number | null) => void;
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
    // Current question hint (for rebus)
    currentHint?: string;
    setCurrentHint: (hint: string | undefined) => void;
    // Error state
    errorMessage: string | null;
    setErrorMessage: (msg: string | null) => void;
};

export const createGameSlice: StateCreator<GameSlice> = (set) => ({
    state: 'lobby',
    setState: (state) => set({ state }),
    currentQuestion: '',
    setCurrentQuestion: (question) => set({ currentQuestion: question }),
    currentQuestionType: null,
    setCurrentQuestionType: (questionType) => set({ currentQuestionType: questionType }),
    currentPrompts: [],
    setCurrentPrompts: (prompts) => set({ currentPrompts: prompts }),
    currentPartIndex: null,
    setCurrentPartIndex: (idx) => set({ currentPartIndex: idx }),
    totalParts: null,
    setTotalParts: (count) => set({ totalParts: count }),
    roomCode: null,
    setRoomCode: (code) => set({ roomCode: code }),
    timerEndsAt: null,
    setTimerEndsAt: (ts) => set({ timerEndsAt: ts }),
    totalQuestionDuration: null,
    setTotalQuestionDuration: (ms) => set({ totalQuestionDuration: ms }),
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
    currentHint: undefined,
    setCurrentHint: (hint) => set({ currentHint: hint }),
    errorMessage: null,
    setErrorMessage: (msg) => set({ errorMessage: msg }),
});
