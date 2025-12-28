/**
 * Zustand slice for game state management
 * This is typically meant for both host and player
 * */

import { StateCreator } from 'zustand';
import { io, Socket } from 'socket.io-client';

export type WebSocketSlice = {
	socket: Socket | null;
	setSocket: (s: Socket | null) => void;
	connect: (serverUrl: string) => Socket;
	disconnect: () => void;
	emit: (event: string, payload?: any) => void;
	on: (event: string, handler: (...args: any[]) => void) => void;
	off: (event: string, handler?: (...args: any[]) => void) => void;
};

import { getStorageItem } from '@/hooks/use-local-storage';

export const createWebSocketSlice: StateCreator<WebSocketSlice> = (set, get) => ({
	// ... (socket, setSocket, connect, disconnect, on, off impl) 
	socket: null,
	setSocket: (s: Socket | null) => set({ socket: s }),
	connect: (serverUrl: string) => {
		const existing = get().socket;
		if (existing) return existing;
		const s = io(serverUrl, { path: '/ws' });
		set({ socket: s });
		return s;
	},
	disconnect: () => {
		const s = get().socket;
		if (s) {
			try { s.disconnect(); } catch (e) { }
		}
		set({ socket: null });
	},
	emit: (event: string, payload?: any) => {
		const s = get().socket;
		if (!s) return;

		let finalPayload = payload;
		// If payload is object (and not null/array), inject userId
		if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
			const userId = getStorageItem('kouch_userId');
			const avatar = getStorageItem('kouch_userAvatar');
			if (userId) {
				finalPayload = { userId, avatar, ...payload };
			}
		}

		try { s.emit(event, finalPayload); } catch (e) { }
	},
	on: (event: string, handler: (...args: any[]) => void) => {
		const s = get().socket;
		if (!s) return;
		s.on(event, handler);
	},
	off: (event: string, handler?: (...args: any[]) => void) => {
		const s = get().socket;
		if (!s) return;
		if (handler) s.off(event, handler);
		else s.removeAllListeners(event);
	},
});
