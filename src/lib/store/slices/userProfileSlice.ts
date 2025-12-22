/**
 * Zustand slice for game state management
 * This is typically meant for both host and player
 * */

import { StateCreator } from 'zustand';
import { PlayerInfo } from '../types';

// profile stored here is a lightweight representation of the current user
// (host or player) and is shared between host/player pages.
export type UserProfileSlice = {
	profile: Partial<PlayerInfo> | null;
	setProfile: (p: Partial<PlayerInfo> | null) => void;
};

export const createUserProfileSlice: StateCreator<UserProfileSlice> = (set) => ({
	profile: null,
	setProfile: (p: Partial<PlayerInfo> | null) => set({ profile: p }),
});
