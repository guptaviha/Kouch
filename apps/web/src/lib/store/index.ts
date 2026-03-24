/**
 * Zustand store for game, player, and host state management
 * This is the main store index file that combines different slices
 */

import { create } from "zustand";
import { createGameSlice, GameSlice } from './slices/gameSlice';
import { createTransportSlice, TransportSlice } from './slices/transportSlice';
import { createUserProfileSlice, UserProfileSlice } from './slices/userProfileSlice';
import { createGameHostSlice, GameHostSlice } from './slices/gameHostSlice';
import { createGamePlayerSlice, GamePlayerSlice } from './slices/gamePlayerSlice';

type StoreState = GameSlice & TransportSlice & UserProfileSlice & GameHostSlice & GamePlayerSlice;

export const useGameStore = create<StoreState>()((...a) => ({
  ...createGameSlice(...a),
  ...createTransportSlice(...a),
  ...createUserProfileSlice(...a),
  ...createGameHostSlice(...a),
  ...createGamePlayerSlice(...a),
}));