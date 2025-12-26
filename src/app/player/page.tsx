"use client";

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/components/header';
import { RoomStates } from '@/lib/store/types';
import PlayerAvatar from '@/components/player-avatar';
import { useGameStore } from '@/lib/store';
import { Progress } from '@/components/ui/progress';
// use shared CountUp component
import { getRandomMessage } from '@/utils/messages';
import TrailingDots from '@/components/trailing-dots';
import PausedOverlay from '@/components/shared/paused-overlay';
import TimerProgress from '@/components/shared/timer-progress';
import Leaderboard from '@/components/shared/leaderboard';
import ActionButton from '@/components/action-button';

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
  const emit = useGameStore((s) => s.emit);
  // roomCode moved into central store
  const roomCode = useGameStore((s) => s.roomCode);
  const setRoomCode = useGameStore((s) => s.setRoomCode);
  const setProfile = useGameStore((s) => s.setProfile);
  const joined = useGameStore((s) => s.joined);
  // profile lives in userProfileSlice and contains id/avatar/name for the current user
  const profile = useGameStore((s) => s.profile);
  // use central zustand store for lobby / current question
  const gameStateValue = useGameStore((s) => s.state);
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const currentHint = useGameStore((s) => s.currentHint); // Get hint from store

  // store uses shared RoomStates directly
  const state: RoomStates = gameStateValue as RoomStates;
  const question = currentQuestion || null;
  // timer/round state moved to store
  const timerEndsAt = useGameStore((s) => s.timerEndsAt);
  const pauseRemainingMs = useGameStore((s) => s.pauseRemainingMs);
  const roundIndex = useGameStore((s) => s.roundIndex);
  const countdown = useGameStore((s) => s.countdown);
  const totalQuestionDuration = useGameStore((s) => s.totalQuestionDuration);

  const setCountdown = useGameStore((s) => s.setCountdown);
  const roundResults = useGameStore((s) => s.roundResults);
  const nextTimerDurationMs = useGameStore((s) => s.nextTimerDurationMs);
  const answer = useGameStore((s) => s.answer);
  const setAnswer = useGameStore((s) => s.setAnswer);
  const statusMessage = useGameStore((s) => s.statusMessage);
  const setStatusMessage = useGameStore((s) => s.setStatusMessage);
  const submitted = useGameStore((s) => s.submitted);
  const setSubmitted = useGameStore((s) => s.setSubmitted);
  const hintUsed = useGameStore((s) => s.hintUsed);
  const setHintUsed = useGameStore((s) => s.setHintUsed);
  const timerRef = useRef<number | null>(null);
  const splashTimerRef = useRef<number | null>(null);
  // paused is now stored centrally in the game slice
  const paused = useGameStore((s) => s.paused);
  const [mounted, setMounted] = useState(false);
  const [pausedMessage, setPausedMessage] = useState(getRandomMessage('game_paused'));
  const [waitingMessage, setWaitingMessage] = useState(getRandomMessage('waiting_to_start'));

  useEffect(() => {
    setMounted(true);
  }, []);

  // Regenerate paused message when paused state changes
  useEffect(() => {
    if (paused) {
      setPausedMessage(getRandomMessage('game_paused'));
    }
  }, [paused]);

  // Regenerate waiting message when state changes to lobby
  useEffect(() => {
    if (state === 'lobby') {
      setWaitingMessage(getRandomMessage('waiting_to_start'));
    }
  }, [state]);

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
  }, [timerEndsAt, paused]);

  const joinRoom = () => {
    setStatusMessage(null);
    if (!roomCode || !profile?.name) {
      setStatusMessage('Enter name and room code');
      return;
    }

    // Save nickname to localStorage
    try {
      localStorage.setItem('kouch_nickname', profile?.name ?? '');
    } catch (e) {
      // ignore
    }

    emit('message', { type: 'join', roomCode: roomCode.toUpperCase(), name: profile?.name });

    const requestFullscreen = () => {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        docEl.mozRequestFullScreen();
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
      }
    };

    requestFullscreen();
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

  const useHint = () => {
    if (!profile?.id || !roomCode || paused || hintUsed) return;
    emit('message', { type: 'use_hint', roomCode, playerId: profile.id });
    setHintUsed(true);
  };

  if (!mounted) return null;

  return (
    <div className="mt-32 p-6 max-w-md mx-auto relative">
      <Header 
        roomCode={roomCode || null}
        avatarKey={profile?.avatar}
        name={profile?.name ?? null}
        role="player"
        roomState={state}
      />


      <PausedOverlay isPaused={paused} title="Game Paused" message={pausedMessage} />

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
                value={profile?.name ?? ''}
                onChange={(e) => setProfile({ ...(profile || {}), name: e.target.value })}
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

            <ActionButton
              className="w-full mt-2"
              onClick={joinRoom}
              disabled={!((profile?.name ?? '').trim()) || (roomCode ?? '').length < 4}
            >
              Join Game
            </ActionButton>
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
              <div className="relative">
                <PlayerAvatar 
                  avatarKey={profile?.avatar} 
                  variant="lobby"
                />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Hello, {profile?.name ?? 'Player'}!
              </h2>
              <div className="flex items-center justify-center space-x-1 text-gray-500 font-medium">
                <span>
                  {waitingMessage}
                  <TrailingDots />
                </span>
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
              <div className="mb-6 flex justify-between items-start">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-2">Question {(roundIndex ?? 0) + 1}</h2>
                </div>
                {currentHint && !hintUsed && (
                  <button
                    onClick={useHint}
                    className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-3 py-1.5 rounded-full font-bold hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors flex items-center gap-1"
                  >
                    Show Hint (1/2 pts)
                  </button>
                )}
              </div>

              {hintUsed && currentHint && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-xl border border-yellow-200 dark:border-yellow-800 text-sm font-medium"
                >
                  <span className="font-bold mr-1">Hint:</span> {currentHint}
                </motion.div>
              )}

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

                <TimerProgress
                  timerEndsAt={timerEndsAt}
                  totalDuration={totalQuestionDuration}
                  paused={paused}
                  pauseRemainingMs={pauseRemainingMs}
                  countdown={countdown}
                  className="mt-8"
                />
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
                      <PlayerAvatar 
                        avatarKey={(roundResults.final || [])[0].avatar} 
                        variant="winner"
                        showCrown={true}
                        badge={1}
                      />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{(roundResults.final || [])[0].name}</h3>
                    <div className="text-yellow-600 dark:text-yellow-400 font-bold bg-yellow-100 dark:bg-yellow-900/30 px-4 py-1 rounded-full text-sm">
                      {(roundResults.final || [])[0].score} points
                    </div>
                  </motion.div>
                )}

                {/* Runners Up */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50">
                  <Leaderboard leaderboard={(roundResults.final || []).slice(1)} highlightPlayerId={profile?.id} showPositions avatarSize={32} />
                </div>
              </div>

              <div className="mt-8 text-center text-sm text-gray-500 animate-pulse">
                Waiting for host to restart
                <TrailingDots />
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
        <Leaderboard leaderboard={roundResults.leaderboard || []} results={roundResults.results} highlightPlayerId={playerId} showAnswers avatarSize={32} />
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

