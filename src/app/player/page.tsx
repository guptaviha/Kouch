"use client";

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/components/header';
import { RoomStates } from '@/lib/store/types';
import PlayerAvatar from '@/components/player-avatar';
import { useGameStore } from '@/lib/store';
import { Progress } from '@/components/ui/progress';
// use shared CountUp component
import CountUp from '@/components/count-up';

// Compute a sensible default server URL at runtime so LAN clients will
// connect back to the host that served the page. This avoids the common
// mistake where remote phones try to connect to their own localhost:3001.
const DEFAULT_SERVER = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : 'http://localhost:3001';

const SERVER = process.env.NEXT_PUBLIC_GAME_SERVER || DEFAULT_SERVER;
const ROUND_DURATION_MS = 30_000; // match server round duration

export default function PlayerPage() {
  // websocket helpers
  const connect = useGameStore((s) => s.connect);
  const disconnect = useGameStore((s) => s.disconnect);
  const on = useGameStore((s) => s.on);
  const off = useGameStore((s) => s.off);
  const emit = useGameStore((s) => s.emit);
  // roomCode moved into central store
  const roomCode = useGameStore((s) => s.roomCode);
  const setRoomCode = useGameStore((s) => s.setRoomCode);
  const name = useGameStore((s) => s.name);
  const setName = useGameStore((s) => s.setName);
  const joined = useGameStore((s) => s.joined);
  // profile lives in userProfileSlice and contains id/avatar/name for the current user
  const profile = useGameStore((s) => s.profile);
  // use central zustand store for lobby / current question
  const gameStateValue = useGameStore((s) => s.state);
  const currentQuestion = useGameStore((s) => s.currentQuestion);

  // store uses shared RoomStates directly
  const state: RoomStates = gameStateValue as RoomStates;
  const question = currentQuestion || null;
  // timer/round state moved to store
  const timerEndsAt = useGameStore((s) => s.timerEndsAt);
  const pauseRemainingMs = useGameStore((s) => s.pauseRemainingMs);
  const roundIndex = useGameStore((s) => s.roundIndex);
  const countdown = useGameStore((s) => s.countdown);
  const setCountdown = useGameStore((s) => s.setCountdown);
  const roundResults = useGameStore((s) => s.roundResults);
  const nextTimerDurationMs = useGameStore((s) => s.nextTimerDurationMs);
  const answer = useGameStore((s) => s.answer);
  const setAnswer = useGameStore((s) => s.setAnswer);
  const statusMessage = useGameStore((s) => s.statusMessage);
  const setStatusMessage = useGameStore((s) => s.setStatusMessage);
  const submitted = useGameStore((s) => s.submitted);
  const setSubmitted = useGameStore((s) => s.setSubmitted);
  const timerRef = useRef<number | null>(null);
  const splashTimerRef = useRef<number | null>(null);
  // paused is now stored centrally in the game slice
  const paused = useGameStore((s) => s.paused);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Load saved nickname on mount
    const savedName = localStorage.getItem('kouch_nickname');
    if (savedName) setName(savedName);

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
  }, [timerEndsAt, paused]);

  const joinRoom = () => {
    setStatusMessage(null);
    if (!roomCode || !name) {
      setStatusMessage('Enter name and room code');
      return;
    }

    // Save nickname to localStorage
    try {
      localStorage.setItem('kouch_nickname', name);
    } catch (e) {
      // ignore
    }

    emit('message', { type: 'join', roomCode: roomCode.toUpperCase(), name });
  };

  const submitAnswer = () => {
    if (!profile?.id || !roomCode || paused) return;
    emit('message', { type: 'submit_answer', roomCode, playerId: profile.id, answer });
    setStatusMessage('Waiting for other players to answer...');
    // clear the input so the player can see their answer was submitted
    setAnswer('');
    // disable further submits until next round
    setSubmitted(true);
  };

  if (!mounted) return null;

  return (
    <div className="p-6 max-w-md mx-auto relative">

      <Header roomCode={roomCode || null} avatarKey={profile?.avatar} name={name ?? null} role="player" />

      {paused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="bg-white/90 dark:bg-black/80 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-white/20">
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Game Paused</div>
            <div className="mt-2 text-md text-gray-900 dark:text-white flex items-center justify-center space-x-1">
              <span>Host is up to something</span>
              <span className="animate-bounce delay-75">.</span>
              <span className="animate-bounce delay-150">.</span>
              <span className="animate-bounce delay-300">.</span>
            </div>
          </div>
        </div>
      )}

      {!joined ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-900 shadow-xl border border-gray-100 dark:border-gray-800 rounded-xl p-6 md:p-8"
        >
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">Join the Party</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-widest text-gray-500">Nickname</label>
              <input
                className="w-full p-4 bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-lg"
                placeholder="e.g. Maverick"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-widest text-gray-500">Room Code</label>
              <input
                className="w-full p-4 bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono font-bold text-lg uppercase tracking-wider"
                placeholder="ABCD"
                maxLength={4}
                value={roomCode ?? ''}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              />
            </div>

            <button
              className="w-full py-4 mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={joinRoom}
              disabled={!name.trim() || (roomCode ?? '').length < 4}
            >
              Join Game
            </button>
          </div>

          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-center text-sm font-medium"
            >
              {statusMessage}
            </motion.div>
          )}
        </motion.div>
      ) : (
        <div>
          {state === 'lobby' ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-gray-900 shadow-xl border border-gray-100 dark:border-gray-800 rounded-xl p-8 text-center flex flex-col items-center"
            >
              <div className="mb-6 relative">
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-2 overflow-hidden shadow-inner">
                    <PlayerAvatar avatarKey={profile?.avatar} size={80} />
                  </div>
                </motion.div>
                <div className="absolute -bottom-2 w-16 h-2 bg-black/10 rounded-[100%] blur-sm left-1/2 -translate-x-1/2 animate-pulse" />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Hello, {name}!
              </h2>
              <div className="flex items-center justify-center space-x-1 text-gray-500 font-medium">
                <span>Waiting for host to start</span>
                <span className="animate-bounce delay-75">.</span>
                <span className="animate-bounce delay-150">.</span>
                <span className="animate-bounce delay-300">.</span>
              </div>
            </motion.div>
          ) : (
            null
          )}

          {state === 'playing' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-900 shadow-xl border border-gray-100 dark:border-gray-800 rounded-xl p-6 md:p-8"
            >
              <div className="mb-6">
                <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-2">Question {(roundIndex ?? 0) + 1}</h2>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">{question}</p>
              </div>

              <input
                className="w-full mb-4 p-4 text-lg border-2 border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:border-blue-500 bg-gray-50 dark:bg-gray-900 transition-colors"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer..."
                disabled={submitted}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitAnswer();
                }}
              />

              {!submitted ? <button
                onClick={submitAnswer}
                disabled={submitted || !answer.trim()}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all transform active:scale-95 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:translate-y-[-2px]`}
              >
                Submit Answer
              </button>
                : null}

              {/* Progress bar for the active round */}
              {timerEndsAt && (
                <div className="mt-8">
                  <Progress
                    value={Math.max(
                      0,
                      Math.min(
                        100,
                        Math.round(
                          (100 * (
                            (paused && pauseRemainingMs != null)
                              ? (ROUND_DURATION_MS - pauseRemainingMs)
                              : (ROUND_DURATION_MS - Math.max(0, (timerEndsAt || 0) - Date.now()))
                          )) / ROUND_DURATION_MS
                        )
                      )
                    )}
                    className={`h-3 bg-gray-100 dark:bg-gray-800 [&>div]:bg-gradient-to-r from-blue-500 to-purple-600 ${paused ? '[&>div]:transition-none' : '[&>div]:transition-all [&>div]:duration-300 [&>div]:ease-linear'}`}
                  />
                  <p className="text-xs text-gray-500 mt-2 font-medium text-right">Time remaining: {countdown}s</p>
                </div>
              )}
            </motion.div>
          )}

          {state === 'round_result' && roundResults && (
            <PlayerRoundResult
              roundResults={roundResults}
              playerId={profile?.id}
              timerEndsAt={timerEndsAt}
              nextTimerDurationMs={nextTimerDurationMs}
              countdown={countdown}
              setStatusMessage={setStatusMessage}
              paused={paused}
              pauseRemainingMs={pauseRemainingMs}
            />
          )}

          {state === 'finished' && roundResults && (
            <div className="mt-8 w-full max-w-lg mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-8"
              >
                <h2 className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mb-2 tracking-tight">Game Over!</h2>
                <p className="text-gray-500 font-medium">Here are the final standings</p>
              </motion.div>

              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                {/* Winner Spotlight */}
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

                {/* Runners Up */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50">
                  <ol className="space-y-2">
                    {(roundResults.final || []).slice(1).map((p: any, i: number) => (
                      <motion.li
                        key={p.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + (i * 0.1) }}
                        className={`flex items-center p-3 rounded-xl shadow-sm border ${p.id === profile?.id
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ring-1 ring-blue-500/20'
                          : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'
                          }`}
                      >
                        <div className="font-bold text-gray-400 w-6 text-left">{i + 2}</div>
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0 mr-3 overflow-hidden">
                          <PlayerAvatar avatarKey={p.avatar} size={32} />
                        </div>
                        <div className="flex-1 text-left font-bold text-gray-900 dark:text-gray-100">
                          {p.name} {p.id === profile?.id && '(You)'}
                        </div>
                        <div className="font-bold text-gray-600 dark:text-gray-400">{p.score} pts</div>
                      </motion.li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="mt-8 text-center text-sm text-gray-500 animate-pulse">
                Waiting for host to restart...
              </div>
            </div>
          )}

          {statusMessage && <p className="mt-2 text-sm text-gray-600">{statusMessage}</p>}
        </div>
      )}
    </div>
  );
}

function PlayerRoundResult({ roundResults, playerId, timerEndsAt, nextTimerDurationMs, countdown, setStatusMessage, paused, pauseRemainingMs }: any) {
  const my = playerId ? (roundResults.results || []).find((r: any) => r.playerId === playerId) : null;
  const isCorrect = my?.correct;

  return (
    <div className="mt-4 w-full">
      {/* Your Result Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`rounded-xl shadow-xl overflow-hidden mb-6 border-2 ${isCorrect
          ? 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-400'
          : 'bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-400'
          }`}
      >
        <div className={`p-4 text-center ${isCorrect ? 'bg-green-500' : 'bg-red-500'
          }`}>
          <h2 className="text-white text-lg font-bold uppercase tracking-widest">
            {isCorrect ? 'Correct!' : 'Incorrect'}
          </h2>
        </div>
        <div className="p-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Your Answer</p>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{my?.answer ?? '—'}</div>
          <div className="mt-4 text-sm font-medium text-gray-500">
            {isCorrect ? `+${my?.points || 0} points` : 'Better luck next time!'}
          </div>
        </div>
      </motion.div>

      {/* Leaderboard Card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 p-6">
        <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200">Leaderboard</h3>
        <div className="space-y-3">
          <AnimatePresence>
            {(roundResults.leaderboard || []).map((p: any, index: number) => {
              const result = roundResults.results.find((r: any) => r.playerId === p.id);
              const pointsEarned = result?.points || 0;
              const previousScore = p.score - pointsEarned;
              // Highlight current player
              const isMe = p.id === playerId;

              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-center p-3 rounded-lg ${isMe
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                    : 'bg-gray-50 dark:bg-gray-800/50 border border-transparent'
                    }`}
                >
                  <div className="w-8 h-8 rounded-full flex-shrink-0 mr-3 bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <PlayerAvatar avatarKey={p.avatar} size={32} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold truncate ${isMe ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}`}>
                        {p.name} {isMe && '(You)'}
                      </span>
                    </div>
                  </div>

                  {/* Show answer if available */}
                  {result?.answer && (
                    <div className={`mx-2 text-xs font-medium max-w-[100px] truncate ${result.correct ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {result.answer}
                    </div>
                  )}

                  <div className="text-right flex flex-col items-end">
                    <div className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                      <CountUp from={previousScore} to={p.score} duration={1.5} delay={0.5 + (index * 0.1)} />
                    </div>
                    {pointsEarned > 0 && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 + (index * 0.1) }}
                        className="text-[10px] font-bold text-green-600 dark:text-green-400"
                      >
                        +{pointsEarned}
                      </motion.span>
                    )}
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
              className={`h-3 bg-blue-500 ${paused ? 'transition-none' : 'transition-all duration-300 ease-linear'}`}
              style={{
                width: `${Math.max(
                  0,
                  Math.min(
                    100,
                    Math.round(
                      ((nextTimerDurationMs - (
                        (paused && pauseRemainingMs != null)
                          ? pauseRemainingMs
                          : Math.max(0, timerEndsAt - Date.now())
                      )) / nextTimerDurationMs) * 100
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
  );
}

