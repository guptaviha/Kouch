"use client";

import PlayerAvatar from '@/components/player-avatar';
import Header from '@/components/header';
import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { RoomStates, PlayerInfo } from '@/lib/store/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import ActionButton from '@/components/action-button';
import QRCode from 'qrcode';
import CountUp from '@/components/count-up';
import TrailingDots from '@/components/trailing-dots';
import { Lightbulb } from 'lucide-react';
import { GamePack } from '@/types/games';
import { GameDetails } from '@/types/game-details';

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
  const setProfile = useGameStore((s) => s.setProfile);
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

  const [mounted, setMounted] = useState(false);

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
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-8 max-w-3xl mx-auto relative">

      <Header roomCode={roomCode} avatarKey={profile?.avatar} name={profile?.name ?? null} role="host" />

      {paused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="bg-white/90 dark:bg-black/80 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-white/20 flex flex-col items-center gap-6">
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Game Paused</div>
            <Button onClick={resumeGame} size="lg" className="w-full">Resume</Button>
          </div>
        </div>
      )}

      {!roomCode ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">
            Creating room
            <TrailingDots />
          </p>
        </div>
      ) : (
        <div>
          {state === 'lobby' && (
            <div className="mb-4">
              {/* Game Title and Description */}
              {gameDetails && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center mb-10"
                >
                  <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {gameDetails.title}
                  </h1>
                  <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                    {gameDetails.description}
                  </p>
                  <div className="flex items-center justify-center gap-4 mt-4 text-sm font-medium text-muted-foreground">
                    <span className="bg-secondary px-3 py-1 rounded-full">{gameDetails.estimatedTime}</span>
                    <span className="bg-secondary px-3 py-1 rounded-full">{gameDetails.minPlayers}-{gameDetails.maxPlayers} Players</span>
                  </div>
                </motion.div>
              )}

              <div className="flex flex-col md:flex-row gap-6 items-stretch">

                {/* QR / scan / URL column */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="w-full md:w-1/2 flex flex-col items-center"
                >
                  {qrDataUrl ? (
                    <div className="flex flex-col items-center gap-4 rounded-xl p-8 bg-white dark:bg-gray-900 shadow-xl border border-gray-100 dark:border-gray-800 w-full max-w-sm h-full justify-center">
                      <div className="text-center">
                        <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-2">Join the party</p>
                        <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600 mb-1">{roomCode}</h3>
                      </div>

                      <div className="p-3 bg-white rounded-xl shadow-inner border border-gray-200">
                        <img src={qrDataUrl} alt={`QR code for ${roomCode}`} className="w-48 h-48 rounded-lg" />
                      </div>

                      <div className="w-full text-center">
                        <p className="text-gray-500 text-sm mb-1">or visit</p>
                        <div className="bg-gray-100 dark:bg-gray-800 rounded px-3 py-1.5 inline-block">
                            <a target="_blank" rel="noreferrer" className="text-sm font-mono text-blue-600 dark:text-blue-400 font-medium break-all" href={joinUrl ?? `/player?code=${roomCode}`}>{joinUrl ? joinUrl.replace(/^https?:\/\//, '').replace(/\?.*$/, '') : `.../player`}</a>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">
                      Generating QR code
                      <TrailingDots />
                    </div>
                  )}
                </motion.div>

                {/* Players column */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="w-full md:w-1/2"
                >
                  <div className="rounded-xl bg-white dark:bg-gray-900 shadow-xl border border-gray-100 dark:border-gray-800 p-8 min-h-[400px] flex flex-col h-full">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
                      <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Players</h3>
                      <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-xs font-bold">{players.length} joined</span>
                    </div>

                    {players.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-900/50">
                        <p className="text-lg font-medium text-gray-400 dark:text-gray-500 mb-2">
                          Waiting for players
                          <TrailingDots />
                        </p>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-auto">
                        <AnimatePresence mode='popLayout'>
                          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {players.map((p, i) => (
                              <motion.li
                                key={p.id}
                                layout
                                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                                className="p-3 rounded-lg"
                              >
                                <motion.div
                                  animate={{ y: [0, -6, 0] }}
                                  transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                    delay: i * 0.2
                                  }}
                                  className="flex flex-col items-center w-full"
                                >
                                  <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center bg-transparent mb-2">
                                    <PlayerAvatar avatarKey={p.avatar} size={40} />
                                  </div>
                                  <div className="text-sm font-medium text-center truncate w-full px-1 text-gray-700 dark:text-gray-200">{p.name}</div>
                                </motion.div>
                              </motion.li>
                            ))}
                          </ul>
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </motion.div>

              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className='mt-10 text-center'
              >
                <ActionButton onClick={startGame} disabled={players.length === 0}>Start Game</ActionButton>
              </motion.div>
            </div>
          )}

          {state === 'playing' && (
            <>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 bg-white dark:bg-gray-900 shadow-xl border border-gray-100 dark:border-gray-800 rounded-xl p-8 text-center"
              >
                <div className="mb-6 relative">
                  {!paused && (
                    <div className="absolute top-0 right-0 z-20">
                      <Button
                        onClick={extendTimer}
                        variant="outline"
                        size="sm"
                        className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                      >
                        +15s
                      </Button>
                    </div>
                  )}
                  <h2 className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-2">Question {(roundIndex ?? 0) + 1}</h2>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 leading-tight">{question}</p>
                </div>

                {questionImage && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="my-8 flex justify-center"
                  >
                    <div className="p-2 bg-white rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800">
                      <img src={questionImage} alt="Puzzle" className="max-h-72 rounded-xl" />
                    </div>
                  </motion.div>
                )}

                {timerEndsAt && totalQuestionDuration && (
                  <div className="mt-8 px-4">
                    <Progress
                      value={Math.max(
                        0,
                        Math.min(
                          100,
                          Math.round(
                            (100 * (
                              (paused && pauseRemainingMs != null)
                                ? (totalQuestionDuration - pauseRemainingMs)
                                : (totalQuestionDuration - Math.max(0, (timerEndsAt || 0) - Date.now()))
                            )) / totalQuestionDuration
                          )
                        )
                      )}
                      className={`h-4 [&>div]:bg-gradient-to-r from-blue-500 to-purple-600 ${paused ? '[&>div]:transition-none' : '[&>div]:transition-all [&>div]:duration-300 [&>div]:ease-linear'}`}
                    />
                    <p className="text-sm font-medium text-gray-500 mt-2">Time remaining: {countdown}s</p>
                  </div>
                )}
              </motion.div>

              {players.length > 0 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                  {players.map((p, i) => {
                    const answered = answeredPlayers.includes(p.id);
                    const hasUsedHint = playersWithHints?.includes(p.id);

                    return (
                      <div key={p.id} className="flex flex-col items-center w-20 relative">
                        {hasUsedHint && (
                          <div className="absolute -top-1 -left-1 bg-yellow-400 text-yellow-900 rounded-full p-1 z-10 shadow-lg border-2 border-white dark:border-gray-900">
                            <Lightbulb className="w-3 h-3" />
                          </div>
                        )}

                        {answered && (
                          <motion.div
                            initial={{ scale: 0 }} animate={{ scale: 1 }}
                            className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-1 z-10 shadow-lg border-2 border-white dark:border-gray-900"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </motion.div>
                        )}
                        <motion.div
                          animate={{ y: [0, -4, 0] }}
                          transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: i * 0.2
                          }}
                          className={`${answered ? 'opacity-100 grayscale-0' : 'opacity-60 grayscale'} transition-all duration-300`}
                        >
                          <div className={`w-12 h-12 flex items-center justify-center`}>
                            <PlayerAvatar avatarKey={p.avatar} size={36} />
                          </div>
                        </motion.div>
                        <div className={`mt-1 truncate w-full text-center text-xs font-medium ${answered ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>{p.name}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {state === 'round_result' && roundResults && (
            <div className="mt-4 w-full max-w-2xl mx-auto relative">
              <div className="absolute right-4 top-2.5 z-10">
                {!paused && (
                  <Button variant="destructive" size="sm" onClick={pauseGame}>Pause</Button>
                )}
              </div>

              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden mb-6"
              >
                <div className="bg-blue-600 p-4 text-center">
                  <h2 className="text-white text-sm font-bold uppercase tracking-widest">Correct Answer</h2>
                </div>
                <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/50">
                  <div className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white">
                    {roundResults.correctAnswer}
                  </div>
                </div>
              </motion.div>

              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 p-6">
                <h3 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-200 px-2">Leaderboard</h3>
                <div className="space-y-3">
                  <AnimatePresence>
                    {(roundResults.leaderboard || []).map((p: any, index: number) => {
                      const result = roundResults.results.find((r: any) => r.playerId === p.id);
                      const pointsEarned = result?.points || 0;
                      const previousScore = p.score - pointsEarned;

                      return (
                        <motion.div
                          key={p.id}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className={`flex items-center p-3 rounded-lg ${result?.correct
                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30'
                            : 'bg-gray-50 dark:bg-gray-800/50 border border-transparent'
                            }`}
                        >
                          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex-shrink-0 mr-4 bg-gray-200 dark:bg-gray-700 overflow-hidden">
                            <PlayerAvatar avatarKey={p.avatar} size={40} />
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900 dark:text-gray-100">{p.name}</span>
                              {pointsEarned > 0 && (
                                <motion.span
                                  initial={{ opacity: 0, scale: 0.5 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: 0.5 + (index * 0.1) }}
                                  className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full"
                                >
                                  +{pointsEarned}
                                </motion.span>
                              )}
                            </div>
                          </div>

                          {result?.answer && (
                            <div className={`mx-4 text-sm font-medium max-w-[150px] truncate ${result.correct ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                              {result.answer}
                            </div>
                          )}

                          <div className="text-right">
                            <div className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                              <CountUp from={previousScore} to={p.score} duration={1.5} delay={0.5 + (index * 0.1)} />
                            </div>
                            <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">pts</div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>

              {timerEndsAt && nextTimerDurationMs && (
                <div className="mt-8 px-4">
                  <div className="w-full h-3 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-3 bg-blue-500 transition-all duration-300 ease-linear"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(
                            100,
                            Math.round(
                              paused && pauseRemainingMs != null
                                ? ((nextTimerDurationMs - pauseRemainingMs) / nextTimerDurationMs) * 100
                                : ((nextTimerDurationMs - Math.max(0, (timerEndsAt || 0) - Date.now())) / nextTimerDurationMs) * 100
                            )
                          )
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-center text-gray-500 mt-2 font-medium">Next round in {countdown}s</p>
                </div>
              )}
            </div>
          )}

          {state === 'finished' && roundResults && (
            <div className="mt-8 w-full max-w-lg mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-8"
              >
                <h2 className="text-4xl font-extrabold text-blue-600 dark:text-blue-400 mb-2 tracking-tight">Game Over!</h2>
                <p className="text-gray-500 font-medium">Here are the final standings</p>
              </motion.div>

              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                {(roundResults.final || [])[0] && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-gradient-to-b from-yellow-50 to-white dark:from-yellow-900/20 dark:to-gray-900 p-8 border-b border-gray-100 dark:border-gray-800 flex flex-col items-center"
                  >
                    <div className="relative mb-4">
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-4xl animate-bounce">👑</div>
                      <div className="w-24 h-24 rounded-full bg-yellow-100 dark:bg-yellow-900/40 p-1 ring-4 ring-yellow-400/30">
                        <PlayerAvatar avatarKey={(roundResults.final || [])[0].avatar} size={88} />
                      </div>
                      <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-yellow-900 font-bold w-8 h-8 flex items-center justify-center rounded-full shadow-lg border-2 border-white dark:border-gray-900">
                        1
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{(roundResults.final || [])[0].name}</h3>
                    <div className="text-yellow-600 dark:text-yellow-400 font-bold bg-yellow-100 dark:bg-yellow-900/30 px-4 py-1 rounded-full text-sm">
                      {(roundResults.final || [])[0].score} points
                    </div>
                  </motion.div>
                )}

                <div className="p-4 bg-gray-50 dark:bg-gray-800/50">
                  <ol className="space-y-2">
                    {(roundResults.final || []).slice(1).map((p: any, i: number) => (
                      <motion.li
                        key={p.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + (i * 0.1) }}
                        className="flex items-center p-3 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800"
                      >
                        <div className="font-bold text-gray-400 w-6 text-left">{i + 2}</div>
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0 mr-3 overflow-hidden">
                          <PlayerAvatar avatarKey={p.avatar} size={32} />
                        </div>
                        <div className="flex-1 text-left font-bold text-gray-900 dark:text-gray-100">{p.name}</div>
                        <div className="font-bold text-gray-600 dark:text-gray-400">{p.score} pts</div>
                      </motion.li>
                    ))}
                  </ol>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="mt-8"
              >
                <button
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg hover:shadow-blue-500/30 active:scale-95 transition-all text-lg w-full md:w-auto"
                  onClick={resetGame}
                >
                  Play Again
                </button>
                <p className="mt-3 text-sm text-gray-400">Everyone will need to rejoin</p>
              </motion.div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
