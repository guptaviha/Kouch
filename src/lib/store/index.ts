/**
 * Zustand store for game, player, and host state management
 * This is the main store index file that combines different slices
 */

import { create } from "zustand";
import { createGameSlice, GameSlice } from './slices/gameSlice';
import { createWebSocketSlice, WebSocketSlice } from './slices/websocketSlice';
import { createUserProfileSlice, UserProfileSlice } from './slices/userProfileSlice';
import { createHostSlice, HostSlice } from './slices/hostSlice';

type StoreState = GameSlice & WebSocketSlice & UserProfileSlice & HostSlice;

export const useGameStore = create<StoreState>()((...a) => ({
  ...createGameSlice(...a),
  ...createWebSocketSlice(...a),
  ...createUserProfileSlice(...a),
  ...createHostSlice(...a),
}));