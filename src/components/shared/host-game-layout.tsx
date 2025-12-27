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
import { GameDetails } from '@/types/game-details';
import HostLobbyView from '@/components/host/host-lobby-view';
import HostPlayingView from '@/components/host/host-playing-view';
import HostRoundResultView from '@/components/host/host-round-result-view';
import HostFinishedView from '@/components/host/host-finished-view';

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
  const players = useGameStore((s) => s.players as PlayerInfo[]);
  const setPlayers = useGameStore((s) => s.setPlayers);
  const answeredPlayers = useGameStore((s) => s.answeredPlayers as string[]);
  const playersWithHints = useGameStore((s) => s.playersWithHints);
  // game state
  const gameStateValue = useGameStore((s) => s.state);
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const state: RoomStates = gameStateValue as RoomStates;
  const question = currentQuestion || null;
  const questionImage = useGameStore((s) => s.questionImage as string | null);
  // timer state
  const timerEndsAt = useGameStore((s) => s.timerEndsAt);
  const roundIndex = useGameStore((s) => s.roundIndex);
  const pauseRemainingMs = useGameStore((s) => s.pauseRemainingMs);
  const totalQuestionDuration = useGameStore((s) => s.totalQuestionDuration);
  const countdown = useGameStore((s) => s.countdown);
  const setCountdown = useGameStore((s) => s.setCountdown);
  const roundResults = useGameStore((s) => s.roundResults);
  const nextTimerDurationMs = useGameStore((s) => s.nextTimerDurationMs);
  const timerRef = useRef<number | null>(null);
  const splashTimerRef = useRef<number | null>(null);
  const paused = useGameStore((s) => s.paused);
  const playAgainPending = useGameStore((s) => s.playAgainPending);
  const setPlayAgainPending = useGameStore((s) => s.setPlayAgainPending);
  const selectedPack = useGameStore((s) => s.selectedPack);
  const setSelectedPack = useGameStore((s) => s.setSelectedPack);
  const qrDataUrl = useGameStore((s) => s.qrDataUrl);
  const setQrDataUrl = useGameStore((s) => s.setQrDataUrl);
  const joinUrl = useGameStore((s) => s.joinUrl);
  const setJoinUrl = useGameStore((s) => s.setJoinUrl);

  const [gameDetails, setGameDetails] = useState<GameDetails | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    async function fetchGameDetails() {
      try {
        const res = await fetch(`/api/games/${game}`);
        if (res.ok) {
          const data = await res.json();
          setGameDetails(data);
        }
      } catch (error) {
        console.error('Failed to fetch game details', error);
      }
    }
    fetchGameDetails();
  }, [game]);

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

  const startGame = () => {
    if (!roomCode || !profile) return;
    emit('message', { type: 'start_game', roomCode, playerId: profile.id });
  };

  const extendTimer = () => {
    if (!roomCode) return;
    emit('message', { type: 'extend_timer', roomCode, hostId: profile?.id });
  };

  const pauseGame = () => {
    if (!roomCode || !profile) return;
    emit('message', { type: 'pause_game' });
  };

  const resumeGame = () => {
    if (!roomCode || !profile) return;
    emit('message', { type: 'resume_game' });
  };

  const resetGame = () => {
    if (!roomCode || !profile) return;
    emit('message', { type: 'reset_game', roomCode, playerId: profile.id });
    setPlayAgainPending(true);
    emit('message', { type: 'create_room', name: 'Host' });
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
            <HostLobbyView
              gameDetails={gameDetails}
              qrDataUrl={qrDataUrl}
              roomCode={roomCode}
              joinUrl={joinUrl}
              players={players}
              startGame={startGame}
              emit={emit}
            />
          )}


          {state === 'playing' && (
            <HostPlayingView
              question={question}
              questionImage={questionImage}
              timerEndsAt={timerEndsAt}
              totalQuestionDuration={totalQuestionDuration}
              paused={paused}
              pauseRemainingMs={pauseRemainingMs}
              countdown={countdown}
              players={players}
              answeredPlayers={answeredPlayers}
              playersWithHints={playersWithHints}
              roundIndex={roundIndex}
              extendTimer={extendTimer}
            />
          )}


          {state === 'round_result' && roundResults && (
            <HostRoundResultView
              roundResults={roundResults}
              timerEndsAt={timerEndsAt}
              nextTimerDurationMs={nextTimerDurationMs}
              paused={paused}
              pauseRemainingMs={pauseRemainingMs}
              countdown={countdown}
              pauseGame={pauseGame}
              resumeGame={resumeGame}
            />
          )}


          {state === 'finished' && roundResults && (
            <HostFinishedView
              roundResults={roundResults}
              resetGame={resetGame}
            />
          )}
        </div>
      )}
    </motion.div>
  );
}
