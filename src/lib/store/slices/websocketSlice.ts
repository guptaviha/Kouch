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

export const createWebSocketSlice: StateCreator<WebSocketSlice> = (set, get) => ({
	socket: null,
	setSocket: (s: Socket | null) => set({ socket: s }),
	connect: (serverUrl: string) => {
		// avoid reconnecting if already connected to same server
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
		try { s.emit(event, payload); } catch (e) { }
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
