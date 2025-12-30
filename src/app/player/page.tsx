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
  const isConnected = useGameStore((s) => s.isConnected);
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



  // Debounce the disconnected overlay to prevent flashing on quick reconnects (e.g. waking phone)
  const [showDisconnectedOverlay, setShowDisconnectedOverlay] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!isConnected) {
      // Wait 500ms before showing overlay
      timer = setTimeout(() => {
        setShowDisconnectedOverlay(true);
      }, 500);
    } else {
      setShowDisconnectedOverlay(false);
    }
    return () => clearTimeout(timer);
  }, [isConnected]);

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

      {/* Disconnected Overlay */}
      {showDisconnectedOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-2xl text-center max-w-sm w-full border border-gray-200 dark:border-gray-800">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Disconnected</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              You lost connection to the game server.
            </p>
            <button
              onClick={() => connect(SERVER)}
              className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl active:scale-95 transition-transform"
            >
              Reconnect
            </button>
          </div>
        </div>
      )}

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

