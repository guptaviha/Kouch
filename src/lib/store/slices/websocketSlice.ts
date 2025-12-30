/**
 * Zustand slice for game state management
 * This is typically meant for both host and player
 * */

import { StateCreator } from 'zustand';
import { io, Socket } from 'socket.io-client';

import { ClientToServerEvents, ServerToClientEvents } from '@/types/socket';
import { toast } from '@/hooks/use-toast';

type TypedClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type WebSocketSlice = {
	socket: TypedClientSocket | null;
	setSocket: (s: TypedClientSocket | null) => void;
	isConnectedToServer: boolean;
	isReconnecting: boolean;
	connect: (serverUrl: string) => TypedClientSocket;
	disconnect: () => void;
	emit: (event: keyof ClientToServerEvents, payload: Parameters<ClientToServerEvents[keyof ClientToServerEvents]>[0]) => void;
	on: (event: keyof ServerToClientEvents, handler: ServerToClientEvents[keyof ServerToClientEvents]) => void;
	off: (event: keyof ServerToClientEvents, handler?: ServerToClientEvents[keyof ServerToClientEvents]) => void;
};

import { getStorageItem } from '@/hooks/use-local-storage';

let hasConnectedOnce = false;

export const createWebSocketSlice: StateCreator<WebSocketSlice> = (set, get) => ({
	// ... (socket, setSocket, connect, disconnect, on, off impl) 
	socket: null,
	setSocket: (s: TypedClientSocket | null) => set({ socket: s }),
	isConnectedToServer: false,
	isReconnecting: false,
	connect: (serverUrl: string) => {
		const existing = get().socket;
		if (existing) {
			if (!existing.connected) existing.connect();
			return existing;
		}
		const s = io(serverUrl, { path: '/ws' }) as TypedClientSocket;

		const showReconnectingModal = () => {
			set({ isReconnecting: true });
		};

		const clearReconnectingModal = () => {
			set({ isReconnecting: false });
		};

		const showReconnectedToast = () => {
			toast({
				title: 'Back online',
				description: 'Connection restored.',
				duration: 2500,
				className: "bg-green-500 text-white border-none",
			});
		};

		s.on('connect', () => {
			set({ isConnectedToServer: true });
			clearReconnectingModal();
			if (hasConnectedOnce) showReconnectedToast();
			hasConnectedOnce = true;
		});

		s.on('disconnect', (reason) => {
			set({ isConnectedToServer: false });
			if (reason === 'io client disconnect') return;
			showReconnectingModal();
		});

		s.io.on('reconnect_attempt', () => {
			showReconnectingModal();
		});

		s.io.on('reconnect_error', () => {
			showReconnectingModal();
		});

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
	emit: (event, payload) => {
		const s = get().socket;
		if (!s) return;

		let finalPayload = payload;
		// If payload is object (and not null/array), inject userId
		if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
			const userId = getStorageItem('kouch_userId');
			const avatar = getStorageItem('kouch_userAvatar');
			if (userId) {
				finalPayload = { userId, avatar, ...payload } as typeof payload;
			}
		}

		try { s.emit(event, finalPayload); } catch (e) { }
	},
	on: (event, handler) => {
		const s = get().socket;
		if (!s) return;
		s.on(event, handler);
	},
	off: (event, handler) => {
		const s = get().socket;
		if (!s) return;
		if (handler) s.off(event, handler);
		else s.removeAllListeners(event);
	},
});
