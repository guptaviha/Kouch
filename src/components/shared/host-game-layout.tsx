"use client";

import Header from '@/components/header';
import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { RoomStates, PlayerInfo } from '@/lib/store/types';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';
import TrailingDots from '@/components/trailing-dots';
import { GamePack } from '@/types/games';
import HostLobbyView from '@/components/host/host-lobby-view';
import HostPlayingView from '@/components/host/host-playing-view';
import HostRoundResultView from '@/components/host/host-round-result-view';
import HostFinishedView from '@/components/host/host-finished-view';
import PausedOverlay from '@/components/shared/paused-overlay';

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
  const setQrDataUrl = useGameStore((s) => s.setQrDataUrl);
  const setJoinUrl = useGameStore((s) => s.setJoinUrl);

  const [mounted, setMounted] = useState(false);

  // Validate game parameter
  useEffect(() => {
    if (game !== 'rebus' && game !== 'trivia') {
      router.push('/');
    }
  }, [game, router]);

  // Set selected pack based on URL game parameter
  useEffect(() => {
    if (selectedPack !== game) {
      setSelectedPack(game);
    }
  }, [game, selectedPack, setSelectedPack]);

  // Redirect if pack changes unexpectedly
  useEffect(() => {
    if (selectedPack && selectedPack !== game) {
      router.push(`/host/${selectedPack}`);
    }
  }, [selectedPack, game, router]);

  useEffect(() => {
    connect(SERVER);

    let handler: any = null;
    (async () => {
      const mod = await import('@/lib/socket/handleServerMessage');
      handler = mod.default;
      on('server', handler);
    })();

    return () => {
      if (splashTimerRef.current) window.clearTimeout(splashTimerRef.current);
      if (handler) off('server', handler);
      disconnect();
    };
  }, []);

  useEffect(() => {
    if (!roomCode) {
      setQrDataUrl(null);
      return;
    }
    let originForQr = '';
    if (typeof window !== 'undefined') {
      const { protocol, hostname, port } = window.location;
      const envLan = process.env.NEXT_PUBLIC_LAN_HOST;
      const invalidLoopbacks = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
      const LAN_HOST = envLan && !invalidLoopbacks.includes(envLan) ? envLan : window.location.hostname;
      const hostForQr = (hostname === 'localhost' || hostname === '127.0.0.1') ? LAN_HOST : hostname;
      const portPart = port ? `:${port}` : '';
      originForQr = `${protocol}//${hostForQr}${portPart}`;
    }

    const url = `${originForQr}/player?code=${roomCode}`;
    setJoinUrl(url);
    QRCode.toDataURL(url, { margin: 1, width: 300 }).then((d: string) => setQrDataUrl(d)).catch(() => setQrDataUrl(null));
  }, [roomCode]);

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
    emit('message', { type: 'create_room', name: 'Host', pack: game });
  };

  useEffect(() => {
    console.log('client game', game);
    console.log('client roomCode', roomCode);
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

      <div className="mb-4"></div>

      {/* <PausedOverlay isPaused={paused} onResume={resumeGame} /> */}

      {!roomCode ? (
        <div className="flex items-center justify-center h-screen">
          <p className="text-xl text-muted-foreground">
            Setting up game room
            <TrailingDots />
          </p>
        </div>
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
