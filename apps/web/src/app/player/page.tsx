"use client";

import { useEffect, useRef, useState } from 'react';
import Header from '@/components/header';
import { RoomStates } from '@/lib/store/types';
import { useGameStore } from '@/lib/store';
import { getRandomMessage } from '@/utils/messages';
import PausedOverlay from '@/components/shared/paused-overlay';
import PlayerJoinView from '@/components/player/player-join-view';
import PlayerLobbyView from '@/components/player/player-lobby-view';
import PlayerPlayingView from '@/components/player/player-playing-view';
import PlayerRoundResultView from '@/components/player/player-round-result-view';
import PlayerFinishedView from '@/components/player/player-finished-view';
import ErrorState from '@/components/shared/error-state';
import serverMessageHandler from '@/lib/socket/handleServerMessage';
import { getRealtimeBaseUrl } from '@/lib/transport/realtime-url';

export default function PlayerPage() {
  const initializeTransport = useGameStore((s) => s.initializeTransport);
  const disconnectTransport = useGameStore((s) => s.disconnectTransport);
  const subscribe = useGameStore((s) => s.subscribe);
  const setRoomCode = useGameStore((s) => s.setRoomCode);
  const setProfile = useGameStore((s) => s.setProfile);
  const joined = useGameStore((s) => s.joined);
  // profile lives in userProfileSlice and contains id/avatar/name for the current user
  const profile = useGameStore((s) => s.profile);
  // use central zustand store for lobby / current question
  const gameStateValue = useGameStore((s) => s.state);

  const state: RoomStates = gameStateValue as RoomStates;
  const timerEndsAt = useGameStore((s) => s.timerEndsAt);

  const setCountdown = useGameStore((s) => s.setCountdown);
  const roundResults = useGameStore((s) => s.roundResults);
  const timerRef = useRef<number | null>(null);
  const splashTimerRef = useRef<number | null>(null);
  // paused is now stored centrally in the game slice
  const paused = useGameStore((s) => s.paused);
  const errorMessage = useGameStore((s) => s.errorMessage);
  const [mounted, setMounted] = useState(false);
  const [pausedMessage, setPausedMessage] = useState(getRandomMessage('game_paused'));

  useEffect(() => {
    setMounted(true);
  }, []);

  // Regenerate paused message when paused state changes
  useEffect(() => {
    if (paused) {
      setPausedMessage(getRandomMessage('game_paused'));
    }
  }, [paused]);

  useEffect(() => {
    // Load saved nickname on mount
    const savedName = localStorage.getItem('kouch_nickname');
    if (savedName) {
      const existingProfile = useGameStore.getState().profile;
      setProfile({ ...(existingProfile || {}), name: savedName });
    }

    initializeTransport(getRealtimeBaseUrl());
    const unsubscribe = subscribe(serverMessageHandler);

    // prefill room code from URL param if present
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) setRoomCode(code.toUpperCase());
      }
    } catch (e) { }

    return () => {
      if (splashTimerRef.current) window.clearTimeout(splashTimerRef.current);
      unsubscribe();
      disconnectTransport();
    };
  }, [disconnectTransport, initializeTransport, setProfile, setRoomCode, subscribe]);

  useEffect(() => {
    if (paused) {
      // freeze countdown while paused; value set when pause message received
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (!timerEndsAt) {
      setCountdown(0);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    function tick() {
      const rem = Math.max(0, Math.ceil(((timerEndsAt || 0) - Date.now()) / 1000));
      setCountdown(rem);
    }
    tick();
    timerRef.current = window.setInterval(tick, 250);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [timerEndsAt, paused, setCountdown]);

  if (!mounted) return null;

  return (
    <div className="mt-32 p-6 max-w-md mx-auto relative">
      <Header
        roomCode={useGameStore.getState().roomCode || null}
        avatarKey={profile?.avatar}
        name={profile?.name ?? null}
        role="player"
        roomState={state}
      />


      <PausedOverlay isPaused={paused} title="Game Paused" message={pausedMessage} />

      {!joined ? (
        <PlayerJoinView />
      ) : (
        <div>
          {state === 'lobby' && <PlayerLobbyView />}
          {state === 'playing' && <PlayerPlayingView />}
          {state === 'round_result' && roundResults && <PlayerRoundResultView />}
          {state === 'finished' && roundResults && <PlayerFinishedView />}
          {state === 'error' && <ErrorState message={errorMessage || undefined} />}
        </div>
      )}
    </div>
  );
}

