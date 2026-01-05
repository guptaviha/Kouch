"use client";

import Header from '@/components/header';
import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { RoomStates, PlayerInfo } from '@/lib/store/types';
import { motion } from 'framer-motion';
import { GamePack } from '@/types/game-types';
import HostLobbyView from '@/components/host/host-lobby-view';
import HostPlayingView from '@/components/host/host-playing-view';
import HostRoundResultView from '@/components/host/host-round-result-view';
import HostFinishedView from '@/components/host/host-finished-view';
import PausedOverlay from '@/components/shared/paused-overlay';
import { useQRGenerator } from '@/hooks/useQRGenerator';
import serverMessageHandler from '@/lib/socket/handleServerMessage';
import { Button } from '@/components/ui/button';
import { FaDoorClosed } from 'react-icons/fa';
import SettingUp from '@/components/shared/setting-up';

const SERVER = process.env.NEXT_PUBLIC_GAME_SERVER || 'http://localhost:3001';

interface HostGameLayoutProps {
  game: GamePack;
};

export default function HostGameLayout({ game }: HostGameLayoutProps) {
  const router = useRouter();
  // websocket helpers
  const connect = useGameStore((s) => s.connect);
  const disconnect = useGameStore((s) => s.disconnect);
  const on = useGameStore((s) => s.on);
  const off = useGameStore((s) => s.off);
  const emit = useGameStore((s) => s.emit);
  // user profile
  const profile = useGameStore((s) => s.profile as PlayerInfo | null);
  // room and players
  const roomCode = useGameStore((s) => s.roomCode);
  // game state
  const gameStateValue = useGameStore((s) => s.state);
  const state: RoomStates = gameStateValue as RoomStates;
  // timer state
  const timerEndsAt = useGameStore((s) => s.timerEndsAt);
  const setCountdown = useGameStore((s) => s.setCountdown);
  const roundResults = useGameStore((s) => s.roundResults);
  const timerRef = useRef<number | null>(null);
  const splashTimerRef = useRef<number | null>(null);
  const paused = useGameStore((s) => s.paused);
  const selectedPack = useGameStore((s) => s.selectedPack);
  const setSelectedPack = useGameStore((s) => s.setSelectedPack);

  const [mounted, setMounted] = useState(false);

  useQRGenerator(roomCode);

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
    connect(SERVER);

    // Register event handler synchronously to avoid race conditions
    // where we emit 'fetch_room_for_game' before listening for 'room_created'
    on('server', serverMessageHandler);

    return () => {
      if (splashTimerRef.current) window.clearTimeout(splashTimerRef.current);
      off('server', serverMessageHandler);
      disconnect();
    };
  }, []);

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

  const createRoom = () => {
    emit('message', { type: 'fetch_room_for_game', name: 'Host', pack: game });
  };

  const closeRoom = () => {
    if (!roomCode) return;
    emit('message', { type: 'close_room', roomCode });
  };

  useEffect(() => {
    if (game && !roomCode) {
      createRoom();
    }
  }, [game, roomCode]);

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

      {!roomCode ? (
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
        </div>
      )}
    </motion.div>
  );
}
