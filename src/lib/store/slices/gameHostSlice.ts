/**
 * Zustand slice for game state management
 * This is typically information and actions meant only for the host
 * */

import { StateCreator } from 'zustand';
import { PlayerInfo } from '../types';

export type GameHostSlice = {
    // players in the current room (host side authoritative)
    players: PlayerInfo[];
    setPlayers: (players: PlayerInfo[]) => void;
    // QR / join URL data used by host UI
    qrDataUrl: string | null;
    setQrDataUrl: (d: string | null) => void;
    joinUrl: string | null;
    setJoinUrl: (u: string | null) => void;
    // whether to show the intro/landing UI on host
    showIntro: boolean;
    setShowIntro: (v: boolean) => void;
    // answers tracked on host for UI (who has answered this round)
    answeredPlayers: string[];
    setAnsweredPlayers: (ids: string[]) => void;
    // small optional image for the current question (rebus/illustration)
    questionImage: string | null;
    setQuestionImage: (img: string | null) => void;
    // whether the host has requested a "play again" flow and is awaiting room creation
    playAgainPending: boolean;
    setPlayAgainPending: (v: boolean) => void;
};

export const createGameHostSlice: StateCreator<GameHostSlice> = (set) => ({
    players: [],
    setPlayers: (players: PlayerInfo[]) => set({ players }),
    qrDataUrl: null,
    setQrDataUrl: (d: string | null) => set({ qrDataUrl: d }),
    joinUrl: null,
    setJoinUrl: (u: string | null) => set({ joinUrl: u }),
    showIntro: true,
    setShowIntro: (v: boolean) => set({ showIntro: v }),
    answeredPlayers: [],
    setAnsweredPlayers: (ids: string[]) => set({ answeredPlayers: ids }),
    questionImage: null,
    setQuestionImage: (img: string | null) => set({ questionImage: img }),
    playAgainPending: false,
    setPlayAgainPending: (v: boolean) => set({ playAgainPending: v }),
});
