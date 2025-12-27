"use client";

import PlayerAvatar from '@/components/player-avatar';
import Header from '@/components/header';
import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { RoomStates, PlayerInfo } from '@/lib/store/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import QRCode from 'qrcode';
import TrailingDots from '@/components/trailing-dots';
import { Smartphone, Pause, Play } from 'lucide-react';
import { GamePack } from '@/types/games';
import { GameDetails } from '@/types/game-details';
import PausedOverlay from '@/components/shared/paused-overlay';
import TimerProgress from '@/components/shared/timer-progress';
import Leaderboard from '@/components/shared/leaderboard';
import GameDetailsCard from './game-details-card';
import GenericCard from './generic-card';

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
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-8 items-start pb-32">
              {/* LEFT SECTION: Game Details Card */}
              <div className="lg:col-span-3">
                {gameDetails && <GameDetailsCard gameDetails={gameDetails} />}
              </div>

              {/* RIGHT SECTION: QR Code + Players */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="lg:col-span-4 flex flex-col gap-6"
              >
                {/* QR Code Card - Compact */}
                {qrDataUrl ? (
                  <GenericCard
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="p-6 z-10"
                  >
                    <div className="grid grid-cols-2 gap-6 items-center">
                      {/* Left: Phone Controller Label + Room Code */}
                      <div className="flex flex-col justify-center">
                        <div className="flex items-center bg-green-50 dark:bg-green-900/20 rounded-xl py-3 px-4 w-fit mb-4">
                          <Smartphone className="w-7 h-7 text-green-500 mr-2" />
                          <span className="text-lg font-semibold text-gray-700 dark:text-gray-200">Phone controller game</span>
                        </div>
                        <p className="text-lg font-semibold text-gray-500 uppercase tracking-widest mb-3">Room Code</p>
                        <h3 className="text-7xl font-bold text-gray-900 dark:text-white font-mono tracking-widest leading-tight">{roomCode}</h3>
                        <div className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                          <p className="mb-2">or visit</p>
                          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 break-all font-mono inline-block">
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
                            <img src={qrDataUrl} alt={`QR code for ${roomCode}`} className="w-60 h-60 rounded" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </GenericCard>
                ) : (
                  <div className="text-center text-gray-600">
                    Generating QR code
                    <TrailingDots />
                  </div>
                )}

                <Button onClick={() => { if (roomCode) emit('message', { type: 'mock', roomCode }); }}>Load Mock Players</Button>
                {/* Players Card */}
                <GenericCard
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex flex-col z-10 h-fit max-h-[calc(100vh-300px)]"
                >
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-800">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Players</h3>
                    <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full font-bold">{players.length} joined</span>
                  </div>

                  {players.length === 0 ? (
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="flex flex-col items-center justify-center py-8 px-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl"
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
                </GenericCard>
              </motion.div>

              {/* Centered Start Button */}
              <Button
                variant="floatingAction"
                onClick={startGame}
                disabled={players.length === 0}
              >
                {players.length === 0 ? (
                  <span className="flex items-center gap-2">Waiting<TrailingDots /></span>
                ) : (
                  'Start Game'
                )}
              </Button>
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
                  <GenericCard
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-10 text-center mb-16"
                  >
                    <p className="text-xl text-blue-600 dark:text-blue-400 uppercase tracking-wider font-bold mb-4">Question {(roundIndex ?? 0) + 1}</p>
                    <h2 className={`${questionImage ? 'text-2xl sm:text-3xl' : 'text-6xl sm:text-7xl'} font-extrabold text-gray-900 dark:text-white leading-tight tracking-tight`}>
                      {question}
                    </h2>

                    {/* Question Image - Large & Centered */}
                    {questionImage && (
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex justify-center mb-6"
                      >
                        <div className="p-2 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 max-w-2xl">
                          <img src={questionImage} alt="Puzzle" className="w-full max-w-xs h-auto rounded-2xl" />
                        </div>
                      </motion.div>
                    )}

                    {/* Timer Bar - Prominent */}
                    {timerEndsAt && totalQuestionDuration && (
                      <div className="mt-8 mb-8">
                        <TimerProgress
                          timerEndsAt={timerEndsAt}
                          totalDuration={totalQuestionDuration}
                          paused={paused}
                          pauseRemainingMs={pauseRemainingMs}
                          countdown={countdown}
                          showCountdownText={true}
                          className="h-6 rounded-full"
                        />
                      </div>
                    )}
                  </GenericCard>

                </div>

                {/* Player Status Row - Bottom */}
                {players.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="fixed bottom-4 left-0 right-0 px-4"
                  >
                    {/* <div className="max-w-6xl mx-auto bg-white/70 dark:bg-gray-900/70 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 dark:border-gray-800/20 p-4"> */}
                    <GenericCard
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="max-w-6xl mx-auto !p-4"
                    >
                      <div className="flex items-center justify-center gap-6 overflow-x-auto pt-3 pb-1">
                        {players.map((p, i) => {
                          const answered = answeredPlayers.includes(p.id);
                          const hasUsedHint = playersWithHints?.includes(p.id);
                          const playerState = answered
                            ? (hasUsedHint ? 'answered_with_hint' : 'answered')
                            : (hasUsedHint ? 'used_hint' : 'waiting');

                          return (
                            <motion.div
                              key={p.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="flex flex-col items-center flex-shrink-0 relative"
                            >
                              <PlayerAvatar
                                avatarKey={p.avatar}
                                variant="game"
                                state={playerState}
                                index={i}
                              />

                              <div className={`mt-2 text-center text-sm font-bold whitespace-nowrap ${answered ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                {p.name}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </GenericCard>
                  </motion.div>
                )}

                {/* Extend Timer Button (during the round) */}
                {!paused && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="fixed top-24 right-8 z-30"
                  >
                    <Button
                      onClick={extendTimer}
                      size="lg"
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg px-6 py-4 rounded-xl shadow-lg cursor-pointer"
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
                      <p className="text-white text-2xl font-bold uppercase tracking-widest">Correct Answer</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-12 text-center">
                      <div className="text-7xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        {roundResults.correctAnswer}
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Leaderboard */}
                <Leaderboard leaderboard={roundResults.leaderboard || []} results={roundResults.results} showAnswers />

                {/* Extend Timer + Pause/Resume Buttons (visible on result screen) */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="fixed top-24 right-8 z-30 flex items-center gap-3"
                >
                  {!paused ? (
                    <Button
                      onClick={pauseGame}
                      size="lg"
                      className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-lg px-5 py-4 rounded-xl shadow-lg"
                    >
                      <Pause className="w-5 h-5 mr-2" /> Pause
                    </Button>
                  ) : (
                    <Button
                      onClick={resumeGame}
                      size="lg"
                      className="bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg px-5 py-4 rounded-xl shadow-lg"
                    >
                      <Play className="w-5 h-5 mr-2" /> Resume
                    </Button>
                  )}
                </motion.div>

                {/* Next Round Timer
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
                )} */}
                {timerEndsAt && nextTimerDurationMs && (
                  <GenericCard
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className='w-full min-h-44 max-w-4xl mt-12 text-center'
                  >
                    <p className="text-gray-600 dark:text-gray-400 text-lg font-semibold mb-4">Next round starts in</p>
                    <TimerProgress
                      timerEndsAt={timerEndsAt}
                      totalDuration={nextTimerDurationMs}
                      paused={paused}
                      pauseRemainingMs={pauseRemainingMs}
                      countdown={countdown}
                      showCountdownText={true}
                      className="h-6 rounded-full"
                    />
                  </GenericCard>
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
                  <h2 className="text-7xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
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
                  <Button variant="action" onClick={resetGame} className="mb-4 w-full md:w-auto">
                    Play Again
                  </Button>
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
