/**
 * Zustand slice for game state management
 * This is typically meant for both host and player
 * */

import { StateCreator } from 'zustand';

export type GamePlayerSlice = {
	name: string;
	setName: (n: string) => void;
	joined: boolean;
	setJoined: (v: boolean) => void;
	answer: string;
	setAnswer: (a: string) => void;
	statusMessage: string | null;
	setStatusMessage: (m: string | null) => void;
	submitted: boolean;
	setSubmitted: (v: boolean) => void;
};

export const createGamePlayerSlice: StateCreator<GamePlayerSlice> = (set) => ({
	name: '',
	setName: (n: string) => set({ name: n }),
	joined: false,
	setJoined: (v: boolean) => set({ joined: v }),
	answer: '',
	setAnswer: (a: string) => set({ answer: a }),
	statusMessage: null,
	setStatusMessage: (m: string | null) => set({ statusMessage: m }),
	submitted: false,
	setSubmitted: (v: boolean) => set({ submitted: v }),
});
