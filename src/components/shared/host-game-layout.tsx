"use client";

import PlayerAvatar from '@/components/player-avatar';
import Header from '@/components/header';
import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { RoomStates, PlayerInfo } from '@/lib/store/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import ActionButton from '@/components/action-button';
import QRCode from 'qrcode';
import TrailingDots from '@/components/trailing-dots';
import { Lightbulb } from 'lucide-react';
import { GamePack } from '@/types/games';
import { GameDetails } from '@/types/game-details';
import PausedOverlay from '@/components/shared/paused-overlay';
import TimerProgress from '@/components/shared/timer-progress';
import Leaderboard from '@/components/shared/leaderboard';

const SERVER = process.env.NEXT_PUBLIC_GAME_SERVER || 'http://localhost:3001';

interface HostGameLayoutProps {
  game: GamePack;
}

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
      className="min-h-[calc(100vh-6rem)] mt-24 w-full relative"
    >
      <Header roomCode={roomCode} avatarKey={profile?.avatar} name={profile?.name ?? null} role="host" />

      <div className="mb-4"></div>

      <PausedOverlay isPaused={paused} onResume={resumeGame} />

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
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-stretch pb-32">

              {/* LEFT SECTION: Game Title & Description - Takes 3 columns */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="lg:col-span-3 flex flex-col"
              >
                {gameDetails && (
                  <>
                    {/* Image and Content Row */}
                    <div className="flex gap-8 mb-8 relative">
                      <motion.div
                        className="flex-shrink-0"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        <div className="relative">
                          <img
                            src={gameDetails.imageUrl}
                            alt={`${gameDetails.title} game`}
                            className="w-48 h-72 object-cover rounded-2xl shadow-2xl border border-white/20"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl"></div>
                        </div>
                      </motion.div>

                      {/* Title, Stats, and Tags aligned to bottom of image */}
                      <div className="absolute left-56 top-0 flex flex-col justify-end h-72 pb-4 gap-4">
                        <motion.div>
                          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white">
                            {gameDetails.title}
                          </h1>
                        </motion.div>

                        <div className="flex flex-row gap-3">
                          <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-full text-base font-semibold w-fit">
                            ⏱ {gameDetails.estimatedTime}
                          </span>
                          <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-full text-base font-semibold w-fit">
                            👥 {gameDetails.minPlayers}-{gameDetails.maxPlayers} Players
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {gameDetails.features.map((feature) => (
                            <span key={feature} className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-full text-sm font-medium">
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Full Width Description */}
                    <p className="text-lg sm:text-xl text-gray-700 dark:text-gray-300 leading-relaxed max-w-2xl">
                      {gameDetails.description}
                    </p>
                  </>
                )}
              </motion.div>

              {/* RIGHT SECTION: QR Code + Players - Takes 2 columns */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="lg:col-span-2 flex flex-col gap-6"
              >
                {/* QR Code Card - Compact */}
                {qrDataUrl ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-6 z-10"
                  >
                    <div className="grid grid-cols-2 gap-6 items-center">
                      {/* Left: Room Code */}
                      <div className="flex flex-col justify-center">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Room Code</p>
                        <h3 className="text-6xl font-bold text-gray-900 dark:text-white font-mono tracking-widest leading-tight">{roomCode}</h3>
                        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                          <p className="mb-2">or visit</p>
                          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 break-all text-xs font-mono inline-block">
                            <a target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 font-medium" href={joinUrl ?? `/player?code=${roomCode}`}>
                              {joinUrl ? joinUrl.replace(/^https?:\/\//, '').split('?')[0] : `${roomCode}.local`}
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Right: Tilted Framed QR Code (static 10° rotation, no animation) */}
                      <div className="flex justify-center items-center">
                        <div className="transform" style={{ transform: 'rotate(4deg)' }}>
                          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border-4 border-gray-300 dark:border-gray-700 p-2">
                            <img src={qrDataUrl} alt={`QR code for ${roomCode}`} className="w-40 h-40 rounded" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="text-center text-gray-600">
                    Generating QR code
                    <TrailingDots />
                  </div>
                )}

                {/* Players Card */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-6 flex flex-col z-10"
                  style={{ height: 'fit-content', maxHeight: 'calc(100vh - 300px)' }}
                >
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-800">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Players</h3>
                    <span className="bg-gradient-to-r from-green-400 to-emerald-500 text-white px-4 py-2 rounded-full text-lg font-bold shadow-lg">
                      {players.length}
                    </span>
                  </div>

                  {players.length === 0 ? (
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="flex flex-col items-center justify-center py-8 px-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-900/50"
                    >
                      <p className="text-base font-semibold text-gray-700 dark:text-gray-300">Waiting for players to join</p>
                    </motion.div>
                  ) : (
                    <div className="grid grid-cols-3 gap-4 overflow-y-auto pt-2 pb-2" style={{ maxHeight: 'calc(100vh - 450px)' }}>
                      <AnimatePresence mode='popLayout'>
                        {players.map((p, i) => (
                          <motion.div
                            key={p.id}
                            layout
                            initial={{ opacity: 0, scale: 0.8, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                            transition={{ delay: i * 0.05 }}
                            className="flex flex-col items-center gap-2 pt-2"
                          >
                            <PlayerAvatar 
                              avatarKey={p.avatar} 
                              variant="lobby"
                              index={i}
                            />
                            <p className="font-bold text-sm text-gray-900 dark:text-white text-center truncate w-full">{p.name}</p>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              </motion.div>

              {/* Centered Start Button */}
              <motion.div
                className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40"
              >
                <ActionButton onClick={startGame} disabled={players.length === 0} className="py-6 px-8 text-lg whitespace-nowrap">
                  {players.length === 0 ? (
                    <span className="flex items-center gap-2">Waiting<TrailingDots /></span>
                  ) : (
                  'Start Game'
                  )}
                </ActionButton>
              </motion.div>
            </div>
          )}


          {state === 'playing' && (
            <>
              {/* Main Game Content - Centered & Large */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center pb-32"
              >
                {/* Question Section */}
                <div className="w-full max-w-4xl">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-900/40 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 dark:border-gray-800/20 p-12 text-center mb-12"
                  >
                    <p className="text-xl text-gray-600 dark:text-gray-400 uppercase tracking-wider font-bold mb-6">Question {(roundIndex ?? 0) + 1}</p>
                    <h2 className="text-6xl sm:text-7xl font-extrabold text-gray-900 dark:text-white leading-tight mb-8 tracking-tight">
                      {question}
                    </h2>

                    {/* Timer Bar - Prominent */}
                    {timerEndsAt && totalQuestionDuration && (
                      <div className="mt-12">
                        <TimerProgress
                          timerEndsAt={timerEndsAt}
                          totalDuration={totalQuestionDuration}
                          paused={paused}
                          pauseRemainingMs={pauseRemainingMs}
                          countdown={countdown}
                          showCountdownText={false}
                          className="h-6 rounded-full"
                        />
                        <div className="mt-6 flex items-center justify-center gap-3">
                          <span className="text-7xl font-extrabold text-gray-900 dark:text-white tabular-nums">
                            {countdown}
                          </span>
                          <span className="text-3xl text-gray-600 dark:text-gray-400 font-semibold">seconds</span>
                        </div>
                      </div>
                    )}
                  </motion.div>

                  {/* Question Image - Large & Centered */}
                  {questionImage && (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="flex justify-center mb-12"
                    >
                      <div className="p-4 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 max-w-2xl">
                        <img src={questionImage} alt="Puzzle" className="w-full h-auto rounded-2xl" />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Player Status Row - Bottom */}
                {players.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="fixed bottom-8 left-0 right-0 px-4"
                  >
                    <div className="max-w-6xl mx-auto bg-white/70 dark:bg-gray-900/70 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 dark:border-gray-800/20 p-6">
                      <div className="flex items-center justify-center gap-6 overflow-x-auto pt-3 pb-1">
                        {players.map((p, i) => {
                          const answered = answeredPlayers.includes(p.id);
                          const hasUsedHint = playersWithHints?.includes(p.id);

                          return (
                            <motion.div
                              key={p.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="flex flex-col items-center flex-shrink-0 relative"
                            >
                              {hasUsedHint && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute -top-3 -left-3 bg-yellow-400 text-yellow-900 rounded-full p-2 z-10 shadow-lg border-2 border-white dark:border-gray-900"
                                >
                                  <Lightbulb className="w-5 h-5" />
                                </motion.div>
                              )}

                              {answered && (
                                <motion.div
                                  initial={{ scale: 0, rotate: -180 }}
                                  animate={{ scale: 1, rotate: 0 }}
                                  className="absolute -top-3 -right-3 bg-green-500 text-white rounded-full p-2 z-10 shadow-lg border-2 border-white dark:border-gray-900"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </motion.div>
                              )}

                              <motion.div
                                animate={{ y: answered ? 0 : [0, -6, 0] }}
                                transition={{
                                  duration: 3,
                                  repeat: answered ? 0 : Infinity,
                                  ease: "easeInOut",
                                  delay: i * 0.2
                                }}
                                className="transition-all duration-300"
                              >
                                <PlayerAvatar 
                                  avatarKey={p.avatar} 
                                  variant="game"
                                  state={answered ? 'answered' : 'waiting'}
                                  badge={answered ? 'check' : undefined}
                                  index={i}
                                />
                              </motion.div>

                              <div className={`mt-2 text-center text-sm font-bold whitespace-nowrap ${answered ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                {p.name}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Extend Timer Button */}
                {!paused && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="fixed top-16 right-8 z-30"
                  >
                    <Button
                      onClick={extendTimer}
                      size="lg"
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg px-6 py-4 rounded-xl shadow-lg"
                    >
                      ⏱ +15s
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            </>
          )}


          {state === 'round_result' && roundResults && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-12"
            >
              <div className="w-full max-w-4xl">
                {/* Correct Answer - Big & Prominent */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-12"
                >
                  <div className="bg-blue-600 rounded-3xl shadow-2xl overflow-hidden mb-6">
                    <div className="bg-blue-600 p-8 text-center">
                      <p className="text-white text-2xl font-bold uppercase tracking-widest mb-4">Correct Answer</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-12 text-center">
                      <div className="text-7xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        {roundResults.correctAnswer}
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Leaderboard */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-center">
                    <h3 className="text-white text-3xl font-bold uppercase tracking-widest">Leaderboard</h3>
                  </div>

                  <div className="p-8">
                    <Leaderboard leaderboard={roundResults.leaderboard || []} results={roundResults.results} showAnswers />
                  </div>
                </motion.div>

                {/* Next Round Timer */}
                {timerEndsAt && nextTimerDurationMs && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mt-12 text-center"
                  >
                    <div className="inline-block bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-8">
                      <p className="text-gray-600 dark:text-gray-400 text-lg font-semibold mb-4">Next round starts in</p>
                      <div className="text-6xl font-extrabold text-blue-600 dark:text-blue-400">{countdown}s</div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}


          {state === 'finished' && roundResults && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center py-12"
            >
              <div className="w-full max-w-4xl px-4">
                {/* Game Over Header */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center mb-12"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-8xl mb-6 inline-block"
                  >
                    🎉
                  </motion.div>
                  <h2 className="text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 mb-4 tracking-tight">
                    Game Over!
                  </h2>
                  <p className="text-2xl text-gray-600 dark:text-gray-400 font-semibold">Final Standings</p>
                </motion.div>

                {/* Winner Podium */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden mb-8"
                >
                  {(roundResults.final || [])[0] && (
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="bg-gradient-to-br from-yellow-300 to-yellow-100 dark:from-yellow-900/40 dark:to-yellow-900/20 p-12 border-b-4 border-yellow-400 dark:border-yellow-600"
                    >
                      <div className="flex flex-col items-center">
                        <div className="relative mb-6">
                          <PlayerAvatar 
                            avatarKey={(roundResults.final || [])[0].avatar} 
                            variant="winner"
                            showCrown={true}
                            badge={1}
                          />
                        </div>

                        <h3 className="text-4xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">{(roundResults.final || [])[0].name}</h3>
                        <div className="text-3xl font-extrabold text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-6 py-3 rounded-full">
                          {(roundResults.final || [])[0].score} points
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Rest of Leaderboard */}
                  <div className="p-8">
                    <div className="space-y-4">
                      {(roundResults.final || []).slice(1).map((p: any, i: number) => (
                        <motion.div
                          key={p.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + (i * 0.1) }}
                          className="flex items-center p-6 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-shadow"
                        >
                          <div className="flex-shrink-0 mr-6">
                            <PlayerAvatar 
                              avatarKey={p.avatar} 
                              variant="podium"
                              badge={i + 2}
                            />
                          </div>

                          <div className="flex-1">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{p.name}</div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <div className="text-3xl font-extrabold text-gray-900 dark:text-white">{p.score}</div>
                            <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">points</div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* Play Again Button */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="text-center"
                >
                  <button
                    className="px-12 py-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-2xl shadow-2xl active:scale-95 transition-all text-2xl mb-4 w-full md:w-auto"
                    onClick={resetGame}
                  >
                    Play Again 🎮
                  </button>
                  <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">Players will need to rejoin with their phones</p>
                </motion.div>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
}
