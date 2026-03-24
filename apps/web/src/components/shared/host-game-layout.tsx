"use client";

import Header from '@/components/header';
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/lib/store';
import { RoomStates, PlayerInfo } from '@/lib/store/types';
import { motion } from 'framer-motion';
import { GamePack } from '@/types/game-types';
import HostLobbyView from '@/components/host/host-lobby-view';
import HostPlayingView from '@/components/host/host-playing-view';
import HostRoundResultView from '@/components/host/host-round-result-view';
import HostFinishedView from '@/components/host/host-finished-view';
import { useQRGenerator } from '@/hooks/useQRGenerator';
import serverMessageHandler from '@/lib/socket/handleServerMessage';
import { Button } from '@/components/ui/button';
import { FaDoorClosed } from 'react-icons/fa';
import SettingUp from '@/components/shared/setting-up';
import ErrorState from '@/components/shared/error-state';
import { getRealtimeBaseUrl } from '@/lib/transport/realtime-url';

interface HostGameLayoutProps {
  game: GamePack;
};

export default function HostGameLayout({ game }: HostGameLayoutProps) {
  const initializeTransport = useGameStore((s) => s.initializeTransport);
  const disconnectTransport = useGameStore((s) => s.disconnectTransport);
  const subscribe = useGameStore((s) => s.subscribe);
  const send = useGameStore((s) => s.send);
  const createRoom = useGameStore((s) => s.createRoom);
  const profile = useGameStore((s) => s.profile as PlayerInfo | null);
  const roomCode = useGameStore((s) => s.roomCode);
  const gameStateValue = useGameStore((s) => s.state);
  const state: RoomStates = gameStateValue as RoomStates;
  const timerEndsAt = useGameStore((s) => s.timerEndsAt);
  const setCountdown = useGameStore((s) => s.setCountdown);
  const roundResults = useGameStore((s) => s.roundResults);
  const timerRef = useRef<number | null>(null);
  const splashTimerRef = useRef<number | null>(null);
  const paused = useGameStore((s) => s.paused);
  const selectedPack = useGameStore((s) => s.selectedPack);
  const setSelectedPack = useGameStore((s) => s.setSelectedPack);
  const errorMessage = useGameStore((s) => s.errorMessage);

  const [mounted, setMounted] = useState(false);

  useQRGenerator(roomCode);

  console.log('Room state:', state);
  console.log('Error message:', errorMessage);

  // Set selected pack based on URL game parameter
  useEffect(() => {
    if (selectedPack !== game) {
      setSelectedPack(game);
    }
  }, [game, selectedPack, setSelectedPack]);

  // Redirect if pack changes unexpectedly
  // useEffect(() => {
  //   if (selectedPack && selectedPack !== game) {
  //     router.push(`/host/${selectedPack}`);
  //   }
  // }, [selectedPack, game, router]);

  useEffect(() => {
    initializeTransport(getRealtimeBaseUrl());
    const unsubscribe = subscribe(serverMessageHandler);

    return () => {
      if (splashTimerRef.current) window.clearTimeout(splashTimerRef.current);
      unsubscribe();
      disconnectTransport();
    };
  }, [disconnectTransport, initializeTransport, subscribe]);

  useEffect(() => {
    if (paused) {
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
  }, [timerEndsAt, paused]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreateRoom = async () => {
    await createRoom({ name: 'Host', pack: game });
  };

  const closeRoom = () => {
    if (!roomCode) return;
    send({ type: 'close_room', roomCode });
  };

  useEffect(() => {
    if (game && !roomCode) {
      void handleCreateRoom();
    }
  }, [createRoom, game, roomCode]);

  if (!mounted) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-[calc(100vh-7rem)] mt-20 w-full relative"
    >
      <Header roomCode={roomCode} avatarKey={profile?.avatar} name={profile?.name ?? null} role="host" roomState={state} />
      {roomCode && state !== 'lobby' && (
        <div className="fixed bottom-4 right-4 z-40">
          <Button
            variant="destructive"
            size="icon"
            onClick={closeRoom}
            title="End game"
            aria-label="End game"
            className="h-12 w-12 rounded-full shadow-lg"
          >
            <FaDoorClosed className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* <PausedOverlay isPaused={paused} onResume={resumeGame} /> */}

      {(!roomCode && state !== 'error') ? (
        <SettingUp />
      ) : (
        <div className="w-full max-w-7xl mx-auto relative">
          {state === 'lobby' && (
            <HostLobbyView game={game} />
          )}


          {state === 'playing' && (
            <HostPlayingView />
          )}


          {state === 'round_result' && roundResults && (
            <HostRoundResultView />
          )}


          {state === 'finished' && roundResults && (
            <HostFinishedView />
          )}

          {state === 'error' && (
            <ErrorState message={errorMessage || undefined} />
          )}
        </div>
      )}
    </motion.div>
  );
}
