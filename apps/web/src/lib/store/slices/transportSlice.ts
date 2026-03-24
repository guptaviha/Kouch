import { StateCreator } from 'zustand';

import type { ClientEvent, ParticipantSession, RoomSnapshot, ServerEvent } from '@kouch/contracts';
import { toast } from '@/hooks/use-toast';
import { getStorageItem } from '@/hooks/use-local-storage';
import {
	authorizeJoinSession,
	bootstrapHostSession,
	createPartyKitTransport,
	type RealtimeTransport,
} from '@/lib/transport/partykit-transport';
import type { GamePack } from '@/types/game-types';

import type { GameHostSlice } from './gameHostSlice';
import type { GamePlayerSlice } from './gamePlayerSlice';
import type { GameSlice } from './gameSlice';
import type { UserProfileSlice } from './userProfileSlice';
import type { ConnectionState } from '../types';

type TransportStoreState = GameSlice & TransportSlice & UserProfileSlice & GameHostSlice & GamePlayerSlice;

export type TransportSlice = {
	transport: RealtimeTransport | null;
	transportBaseUrl: string | null;
	transportSession: ParticipantSession | null;
	connectionState: ConnectionState;
	isConnectedToServer: boolean;
	isReconnecting: boolean;
	initializeTransport: (baseUrl: string) => void;
	disconnectTransport: () => void;
	send: (event: ClientEvent) => void;
	subscribe: (handler: (event: ServerEvent) => void) => () => void;
	createRoom: (input: { name?: string; pack?: GamePack }) => Promise<void>;
	joinRoom: (input: { roomCode: string; name?: string }) => Promise<void>;
};

let hasConnectedOnce = false;

function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, '');
}

function getStoredIdentity() {
	return {
		participantId: getStorageItem('kouch_userId') || undefined,
		avatar: getStorageItem('kouch_userAvatar') || undefined,
	};
}

export const createTransportSlice: StateCreator<TransportStoreState, [], [], TransportSlice> = (set, get) => {
	const setConnectionState = (connectionState: ConnectionState) => {
		const previousState = get().connectionState;
		set({
			connectionState,
			isConnectedToServer: connectionState === 'connected',
			isReconnecting: connectionState === 'reconnecting',
		});

		if (connectionState === 'connected') {
			if (hasConnectedOnce && previousState === 'reconnecting') {
				toast({
					title: 'Back online',
					description: 'Connection restored.',
					duration: 2500,
					className: 'bg-green-500 text-white border-none',
				});
			}

			hasConnectedOnce = true;
		}

		if (connectionState === 'failed' && previousState !== 'failed') {
			toast({
				variant: 'destructive',
				title: 'Connection failed',
				description: 'Unable to reach the realtime room.',
			});
		}
	};

	const applySnapshot = (snapshot: RoomSnapshot) => {
		const store = get();
		const isPaused = typeof snapshot.pauseRemainingMs === 'number' && snapshot.pauseRemainingMs > 0;
		const currentPlayer = store.profile?.id
			? snapshot.players.find((player) => player.id === store.profile?.id)
			: undefined;

		store.setRoomCode(snapshot.roomCode);
		store.setPlayers(snapshot.players);
		store.setState(snapshot.state);
		store.setRoundIndex(snapshot.roundIndex ?? null);
		store.setCurrentPartIndex(snapshot.currentPartIndex ?? null);
		store.setTotalParts(snapshot.totalParts ?? null);
		store.setTimerEndsAt(snapshot.timerEndsAt ?? null);
		store.setTotalQuestionDuration(snapshot.totalQuestionDuration ?? null);
		store.setPauseRemainingMs(snapshot.pauseRemainingMs ?? null);
		store.setPaused(isPaused);

		if (isPaused) {
			store.setCountdown(Math.max(0, Math.ceil((snapshot.pauseRemainingMs ?? 0) / 1000)));
		}

		if (currentPlayer) {
			store.setProfile({
				...(store.profile || {}),
				...currentPlayer,
			});
		}
	};

	const ensureTransport = () => {
		const existingTransport = get().transport;
		if (existingTransport) {
			return existingTransport;
		}

		const nextTransport = createPartyKitTransport();
		nextTransport.setConnectionStateListener(setConnectionState);
		set({ transport: nextTransport });
		return nextTransport;
	};

	return {
		transport: null,
		transportBaseUrl: null,
		transportSession: null,
		connectionState: 'idle',
		isConnectedToServer: false,
		isReconnecting: false,
		initializeTransport: (baseUrl: string) => {
			const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
			if (get().transport && get().transportBaseUrl === normalizedBaseUrl) {
				return;
			}

			get().transport?.disconnect();

			const transport = createPartyKitTransport();
			transport.setConnectionStateListener(setConnectionState);

			set({
				transport,
				transportBaseUrl: normalizedBaseUrl,
				transportSession: null,
				connectionState: 'idle',
				isConnectedToServer: false,
				isReconnecting: false,
			});
		},
		disconnectTransport: () => {
			get().transport?.disconnect();
			set({
				transportSession: null,
				connectionState: 'disconnected',
				isConnectedToServer: false,
				isReconnecting: false,
			});
		},
		send: (event: ClientEvent) => {
			get().transport?.send(event);
		},
		subscribe: (handler: (event: ServerEvent) => void) => {
			return ensureTransport().subscribe(handler);
		},
		createRoom: async ({ name, pack }) => {
			const baseUrl = get().transportBaseUrl;
			if (!baseUrl) {
				throw new Error('Realtime transport not initialized');
			}

			try {
				setConnectionState('connecting');
				const { participantId, avatar } = getStoredIdentity();
				const response = await bootstrapHostSession(baseUrl, {
					participantId,
					displayName: name,
					avatar,
					pack,
				});

				set({ transportSession: response.session });
				applySnapshot(response.snapshot);
				get().setProfile({
					...(get().profile || {}),
					id: response.session.participantId,
					name: response.session.displayName ?? name ?? 'Host',
					avatar: response.session.avatar ?? avatar,
				});

				if (pack) {
					get().setSelectedPack(pack);
				}

				ensureTransport().connect({ websocketUrl: response.websocketUrl });
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Unable to create room';
				setConnectionState('failed');
				get().setState('error');
				get().setErrorMessage(message);
			}
		},
		joinRoom: async ({ roomCode, name }) => {
			const baseUrl = get().transportBaseUrl;
			if (!baseUrl) {
				throw new Error('Realtime transport not initialized');
			}

			try {
				get().setStatusMessage(null);
				setConnectionState('connecting');
				const { participantId, avatar } = getStoredIdentity();
				const response = await authorizeJoinSession(baseUrl, {
					roomCode,
					participantId,
					displayName: name,
					avatar,
				});

				set({ transportSession: response.session });
				applySnapshot(response.snapshot);
				get().setProfile({
					...(get().profile || {}),
					id: response.session.participantId,
					name: response.session.displayName ?? name,
					avatar: response.session.avatar ?? avatar,
				});
				ensureTransport().connect({ websocketUrl: response.websocketUrl });
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Unable to join room';
				setConnectionState('failed');
				get().setStatusMessage(message);
			}
		},
	};
};