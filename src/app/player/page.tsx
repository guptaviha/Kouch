"use client";

import React, { useEffect, useRef, useState } from 'react';
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

// Compute a sensible default server URL at runtime so LAN clients will
// connect back to the host that served the page. This avoids the common
// mistake where remote phones try to connect to their own localhost:3001.
const DEFAULT_SERVER = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : 'http://localhost:3001';

const SERVER = process.env.NEXT_PUBLIC_GAME_SERVER || DEFAULT_SERVER;

export default function PlayerPage() {
  // websocket helpers
  const connect = useGameStore((s) => s.connect);
  const disconnect = useGameStore((s) => s.disconnect);
  const on = useGameStore((s) => s.on);
  const off = useGameStore((s) => s.off);
  // roomCode moved into central store
  const setRoomCode = useGameStore((s) => s.setRoomCode);
  const setProfile = useGameStore((s) => s.setProfile);
  const joined = useGameStore((s) => s.joined);
  // profile lives in userProfileSlice and contains id/avatar/name for the current user
  const profile = useGameStore((s) => s.profile);
  // use central zustand store for lobby / current question
  const gameStateValue = useGameStore((s) => s.state);

  // store uses shared RoomStates directly
  const state: RoomStates = gameStateValue as RoomStates;
  // timer/round state moved to store
  const timerEndsAt = useGameStore((s) => s.timerEndsAt);

  const setCountdown = useGameStore((s) => s.setCountdown);
  const roundResults = useGameStore((s) => s.roundResults);
  const timerRef = useRef<number | null>(null);
  const splashTimerRef = useRef<number | null>(null);
  // paused is now stored centrally in the game slice
  const paused = useGameStore((s) => s.paused);
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
    if (savedName) setProfile({ ...(profile || {}), name: savedName });

    connect(SERVER);

    let handler: any = null;
    (async () => {
      const mod = await import('@/lib/socket/handleServerMessage');
      handler = mod.default;
      on('server', handler);
    })();

    // prefill room code from URL param if present
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) setRoomCode(code.toUpperCase());
      }
    } catch (e) { }

    return () => { if (splashTimerRef.current) window.clearTimeout(splashTimerRef.current); if (handler) off('server', handler); disconnect(); };
  }, []);

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

      {/* <PausedOverlay isPaused={paused} title="Game Paused" message={pausedMessage} /> */}

      {!joined ? (
        <PlayerJoinView />
      ) : (
        <div>
          {state === 'lobby' && <PlayerLobbyView />}
          {state === 'playing' && <PlayerPlayingView />}
          {state === 'round_result' && roundResults && <PlayerRoundResultView />}
          {state === 'finished' && roundResults && <PlayerFinishedView />}
        </div>
      )}
    </div>
  );
}

