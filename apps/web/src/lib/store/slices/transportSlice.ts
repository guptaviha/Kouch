import { StateCreator } from 'zustand';

import type { ClientEvent, ParticipantSession, RoomSnapshot, ServerEvent } from '@kouch/contracts';
import { toast } from '@/hooks/use-toast';
import { getStorageItem, setStorageItem } from '@/hooks/use-local-storage';
import { getRealtimeProvider, type RealtimeProvider } from '@/lib/realtime/provider';
import {
	authorizeJoinSession,
	bootstrapHostSession,
	createPartyKitTransport,
	type RealtimeTransport,
} from '@/lib/transport/partykit-transport';
import { createSocketIoTransport } from '@/lib/transport/socketio-transport';
import type { GamePack } from '@/types/game-types';

import type { GameHostSlice } from './gameHostSlice';
import type { GamePlayerSlice } from './gamePlayerSlice';
import type { GameSlice } from './gameSlice';
import type { UserProfileSlice } from './userProfileSlice';
import type { ConnectionState } from '../types';

type TransportStoreState = GameSlice & TransportSlice & UserProfileSlice & GameHostSlice & GamePlayerSlice;

const SOCKETIO_RESPONSE_TIMEOUT_MS = 6_000;

export type TransportSlice = {
	transport: RealtimeTransport | null;
	transportBaseUrl: string | null;
	transportSession: ParticipantSession | null;
	connectionState: ConnectionState;
	isConnectedToServer: boolean;
	isReconnecting: boolean;
	roomCreationPending: boolean;
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

function createRealtimeTransport(provider: RealtimeProvider): RealtimeTransport {
	return provider === 'socketio' ? createSocketIoTransport() : createPartyKitTransport();
}

function waitForServerEvent(
	transport: RealtimeTransport,
	predicate: (event: ServerEvent) => boolean,
	timeoutMs = SOCKETIO_RESPONSE_TIMEOUT_MS,
): Promise<ServerEvent> {
	return new Promise((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			unsubscribe();
			reject(new Error('Timed out waiting for realtime response'));
		}, timeoutMs);

		const unsubscribe = transport.subscribe((event) => {
			if (!predicate(event)) {
				return;
			}

			clearTimeout(timeoutId);
			unsubscribe();
			resolve(event);
		});
	});
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

		const nextTransport = createRealtimeTransport(getRealtimeProvider());
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

			const transport = createRealtimeTransport(getRealtimeProvider());
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
			if (get().roomCreationPending) {
				return;
			}

			const baseUrl = get().transportBaseUrl;
			if (!baseUrl) {
				throw new Error('Realtime transport not initialized');
			}

			try {
				set({ roomCreationPending: true });
				setConnectionState('connecting');
				const { participantId, avatar } = getStoredIdentity();
				const provider = getRealtimeProvider();

				if (provider === 'socketio') {
					const transport = ensureTransport();
					const roomCreatedPromise = waitForServerEvent(
						transport,
						(event) => event.type === 'room_created' || event.type === 'error',
					);

					transport.connect({ websocketUrl: baseUrl });
					transport.send({
						type: 'fetch_room_for_game',
						name,
						pack,
						userId: participantId,
						avatar,
					});

					const event = await roomCreatedPromise;
					if (event.type === 'error') {
						throw new Error(event.message);
					}

					if (event.type !== 'room_created') {
						throw new Error('Unexpected realtime response while creating room');
					}

					setStorageItem('kouch_userId', event.player.id);
					if (event.player.avatar) {
						setStorageItem('kouch_userAvatar', event.player.avatar);
					}

					get().setRoomCode(event.roomCode);
					get().setPlayers(event.players ?? []);
					get().setState(event.state ?? 'lobby');
					get().setProfile(event.player);
					if (pack) {
						get().setSelectedPack(pack);
					}

					set({ transportSession: null });
					get().setErrorMessage(null);
					return;
				}

				const response = await bootstrapHostSession(baseUrl, {
					participantId,
					displayName: name,
					avatar,
					pack,
				});

				set({ transportSession: response.session });
				applySnapshot(response.snapshot);
				setStorageItem('kouch_userId', response.session.participantId);
				get().setProfile({
					...(get().profile || {}),
					id: response.session.participantId,
					name: response.session.displayName ?? name ?? 'Host',
					avatar: response.session.avatar ?? avatar,
				});

				if (response.session.avatar) {
					setStorageItem('kouch_userAvatar', response.session.avatar);
				}

				if (pack) {
					get().setSelectedPack(pack);
				}

				get().setErrorMessage(null);
				ensureTransport().connect({ websocketUrl: response.websocketUrl });
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Unable to create room';
				setConnectionState('failed');
				get().setState('error');
				get().setErrorMessage(message);
			} finally {
				set({ roomCreationPending: false });
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
				const provider = getRealtimeProvider();

				if (provider === 'socketio') {
					const transport = ensureTransport();
					const joinedPromise = waitForServerEvent(
						transport,
						(event) => event.type === 'joined' || event.type === 'error',
					);

					transport.connect({ websocketUrl: baseUrl });
					transport.send({
						type: 'join',
						roomCode,
						name,
						userId: participantId,
						avatar,
					});

					const event = await joinedPromise;
					if (event.type === 'error') {
						throw new Error(event.message);
					}

					if (event.type !== 'joined') {
						throw new Error('Unexpected realtime response while joining room');
					}

					setStorageItem('kouch_userId', event.player.id);
					if (event.player.avatar) {
						setStorageItem('kouch_userAvatar', event.player.avatar);
					}

					set({ transportSession: null });
					get().setRoomCode(event.roomCode);
					get().setProfile(event.player);
					get().setErrorMessage(null);
					return;
				}

				const response = await authorizeJoinSession(baseUrl, {
					roomCode,
					participantId,
					displayName: name,
					avatar,
				});

				set({ transportSession: response.session });
				applySnapshot(response.snapshot);
				setStorageItem('kouch_userId', response.session.participantId);
				get().setProfile({
					...(get().profile || {}),
					id: response.session.participantId,
					name: response.session.displayName ?? name,
					avatar: response.session.avatar ?? avatar,
				});
				if (response.session.avatar) {
					setStorageItem('kouch_userAvatar', response.session.avatar);
				}
				get().setErrorMessage(null);
				ensureTransport().connect({ websocketUrl: response.websocketUrl });
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Unable to join room';
				setConnectionState('failed');
				get().setStatusMessage(message);
			}
		},
	};
};