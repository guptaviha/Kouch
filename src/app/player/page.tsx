"use client";

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Header from '@/components/header';
import { io, Socket } from 'socket.io-client';
import { RoomStates } from '@/lib/store/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import PlayerAvatar from '@/components/player-avatar';
import { useGameStore } from '@/lib/store';

// Compute a sensible default server URL at runtime so LAN clients will
// connect back to the host that served the page. This avoids the common
// mistake where remote phones try to connect to their own localhost:3001.
const DEFAULT_SERVER = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : 'http://localhost:3001';

const SERVER = process.env.NEXT_PUBLIC_GAME_SERVER || DEFAULT_SERVER;
const ROUND_DURATION_MS = 30_000; // match server round duration

export default function PlayerPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  // roomCode moved into central store
  const roomCode = useGameStore((s) => s.roomCode);
  const setRoomCode = useGameStore((s) => s.setRoomCode);
  const [name, setName] = useLocalStorage<string>('playerName', '');
  const [joined, setJoined] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerAvatar, setPlayerAvatar] = useState<string | undefined>(undefined);
  // use central zustand store for lobby / current question
  const gameStateValue = useGameStore((s) => s.state);
  const setGameState = useGameStore((s) => s.setState);
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const setCurrentQuestion = useGameStore((s) => s.setCurrentQuestion);

  // store uses shared RoomStates directly
  const state: RoomStates = gameStateValue as RoomStates;
  const question = currentQuestion || null;
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [pauseRemainingMs, setPauseRemainingMs] = useState<number | null>(null);
  const [roundIndex, setRoundIndex] = useState<number | null>(null);
  const [answer, setAnswer] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any>(null);
  const [roundResults, setRoundResults] = useState<any>(null);
  const [nextTimerDurationMs, setNextTimerDurationMs] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [showRoundSplash, setShowRoundSplash] = useState(false);
  const [roundMinimized, setRoundMinimized] = useState(false);
  const splashTimerRef = useRef<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const s = io(SERVER, { path: '/ws' });
    setSocket(s);

    s.on('server', (msg: any) => {
      if (!msg || !msg.type) return;
      if (msg.type === 'error') {
        setMessage(msg.message || 'An error occurred');
        return;
      }

      if (msg.type === 'joined') {
        setJoined(true);
        setPlayerId(msg.player.id);
        setPlayerAvatar(msg.player.avatar);
        return;
      }

      if (msg.type === 'lobby_update') {
  try { setGameState((msg.state || 'lobby') as RoomStates); } catch (e) { setGameState('lobby'); }
        return;
      }

      if (msg.type === 'game_state') {
  setGameState('playing');
        setCurrentQuestion(msg.question || '');
        setTimerEndsAt(msg.timerEndsAt || null);
        setRoundIndex(typeof msg.roundIndex === 'number' ? msg.roundIndex : null);
        setLeaderboard(null);
        // clear previous answer at the start of a round
        setAnswer('');
        // allow submitting for the new round
        setSubmitted(false);
        // clear any waiting messages when a new round starts
        setMessage(null);
        // do not show round splash on player — host shows splash only
        return;
      }

      if (msg.type === 'answer_received') {
        setMessage('Answer received');
        return;
      }

      if (msg.type === 'round_result') {
  setGameState('round_result');
        setLeaderboard(msg.leaderboard || null);
        setRoundResults(msg);
        if (msg.nextTimerEndsAt) setTimerEndsAt(msg.nextTimerEndsAt);
        if (typeof msg.nextTimerDurationMs === 'number') setNextTimerDurationMs(msg.nextTimerDurationMs);
        setRoundIndex(typeof msg.roundIndex === 'number' ? msg.roundIndex : null);
        // round finished — allow submitting in the next round
        setSubmitted(false);
        setMessage(null);
        return;
      }

      if (msg.type === 'final_leaderboard') {
  setGameState('finished');
        setLeaderboard(msg.leaderboard || null);
        return;
      }

      if (msg.type === 'game_paused') {
        setPaused(true);
        if (typeof msg.pauseRemainingMs === 'number') {
          setPauseRemainingMs(msg.pauseRemainingMs);
          setCountdown(Math.max(0, Math.ceil(msg.pauseRemainingMs / 1000)));
        }
        return;
      }

      if (msg.type === 'game_resumed') {
        setPaused(false);
        if (msg.nextTimerEndsAt) setTimerEndsAt(msg.nextTimerEndsAt);
        setPauseRemainingMs(null);
        return;
      }
    });

    // prefill room code from URL param if present
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) setRoomCode(code.toUpperCase());
      }
    } catch (e) { }

    return () => { if (splashTimerRef.current) window.clearTimeout(splashTimerRef.current); s.disconnect(); };
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
  }, [timerEndsAt]);

  const joinRoom = () => {
    if (!socket) return;
    if (!roomCode || !name) {
      setMessage('Enter name and room code');
      return;
    }
    socket.emit('message', { type: 'join', roomCode: roomCode.toUpperCase(), name });
  };

  const submitAnswer = () => {
    if (!socket || !playerId || !roomCode || paused) return;
    socket.emit('message', { type: 'submit_answer', roomCode, playerId, answer });
    setMessage('Waiting for other players to answer...');
    // clear the input so the player can see their answer was submitted
    setAnswer('');
    // disable further submits until next round
    setSubmitted(true);
  };

  if (!mounted) return null;

  return (
    <div className="p-6 max-w-md mx-auto relative">

      <Header roomCode={roomCode || null} avatarKey={playerAvatar} name={name ?? null} role="player" />

      {paused && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white/80 dark:bg-black/70 backdrop-blur-sm rounded p-6">
            <div className="text-3xl font-extrabold">Game Paused</div>
          </div>
        </div>
      )}

      {!joined ? (
        <div>
          <label className="block mb-2">Name</label>
          <input className="w-full mb-3 p-2 border rounded" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="block mb-2">Room Code</label>
          <input className="w-full mb-3 p-2 border rounded" value={roomCode ?? ''} onChange={(e) => setRoomCode(e.target.value)} />
          <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={joinRoom}>Join</button>
          {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}
        </div>
      ) : (
        <div>
          {state === 'lobby' ? (
            <div className="mb-4 p-4 rounded bg-gray-50 dark:bg-gray-900 text-center">
              <p className="text-lg font-medium">Waiting for host to start game</p>
            </div>
          ) : (
            null
          )}

          {state === 'playing' && (
              <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 rounded">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">Question</h2>
                  </div>
                </div>
                <p className="mb-2">{question}</p>
                <input
                  className="w-full mb-2 p-2 border rounded"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type answer"
                  disabled={submitted}
                />
                <button
                  onClick={submitAnswer}
                  disabled={submitted}
                  className={submitted
                    ? 'px-4 py-2 bg-gray-400 text-white rounded cursor-not-allowed opacity-80'
                    : 'px-4 py-2 bg-green-600 text-white rounded hover:brightness-90'
                  }
                >
                  {submitted ? 'Submitted' : 'Submit'}
                </button>
                {submitted && (
                  <p className="mt-3 text-sm text-gray-600">Waiting for other players to answer...</p>
                )}

                {/* Progress bar for the active round (bottom) */}
                {timerEndsAt && (
                  <div className="mt-4">
                    <div className="w-full h-3 bg-gray-200 dark:bg-gray-800 rounded overflow-hidden">
                      <div
                        className={
                          `h-3 bg-green-500 ${paused ? 'transition-none' : 'transition-all duration-300 ease-linear'}`
                        }
                        style={{
                              width: `${Math.max(
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
                              )}%`,
                        }}
                      />
                    </div>
                        <p className="text-xs text-gray-600 mt-1">Time remaining: {countdown}s</p>
                  </div>
                )}
              </div>
          )}

          {state === 'round_result' && roundResults && (
            <PlayerRoundResult
              roundResults={roundResults}
              playerId={playerId}
              timerEndsAt={timerEndsAt}
              nextTimerDurationMs={nextTimerDurationMs}
              countdown={countdown}
              setMessage={setMessage}
              paused={paused}
              pauseRemainingMs={pauseRemainingMs}
            />
          )}

          {state === 'finished' && leaderboard && (
            <div className="mt-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 rounded">
              <h3 className="font-semibold">Final Leaderboard</h3>
              <ol className="mt-2">
                {(leaderboard || []).map((p: any) => (
                  <li key={p.id}>{p.name} — {p.score} pts</li>
                ))}
              </ol>
            </div>
          )}

          {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}
        </div>
      )}
    </div>
  );
}

function PlayerRoundResult({ roundResults, playerId, timerEndsAt, nextTimerDurationMs, countdown, setMessage, paused, pauseRemainingMs }: any) {
  const [flash, setFlash] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!playerId) return;
    const my = (roundResults.results || []).find((r: any) => r.playerId === playerId);
    if (!my) return;
    if (my.correct) setFlash('bg-green-100 dark:bg-green-900');
    else setFlash('bg-red-100 dark:bg-red-900');
    const t = window.setTimeout(() => setFlash(null), 3000);
    return () => window.clearTimeout(t);
  }, [roundResults, playerId]);

  const my = playerId ? (roundResults.results || []).find((r: any) => r.playerId === playerId) : null;

  return (
    <div className={`mt-4 p-4 rounded ${flash ?? ''}`}> 
      <div className="mb-3">
        <p className="text-sm text-gray-600 dark:text-gray-300">Your answer</p>
        <div className="text-2xl font-bold">{my ? (my.answer ?? '—') : '—'}</div>
        <p className="text-sm mt-1">{my ? (my.correct ? 'Correct' : 'Incorrect') : ''}</p>
      </div>

      {/* Leaderboard */}
      <div>
        <h3 className="font-semibold">Leaderboard</h3>
        <ol className="mt-2">
          {(roundResults.leaderboard || []).map((p: any) => (
            <li key={p.id}>{p.name} — {p.score} pts</li>
          ))}
        </ol>
      </div>

      {/* Results breakdown without time */}
      <div className="mt-4">
        <table className="w-full mt-2 text-sm table-fixed">
          <thead>
            <tr className="text-left">
              <th className="pb-2">Player</th>
              <th className="pb-2">Answer</th>
              <th className="pb-2">Correct</th>
              <th className="pb-2">Points</th>
            </tr>
          </thead>
          <tbody>
            {(roundResults.results || []).map((r: any) => (
              <tr key={r.playerId} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-2">{r.name}</td>
                <td className="py-2">{r.answer ?? '—'}</td>
                <td className="py-2">{r.correct ? 'Yes' : 'No'}</td>
                <td className="py-2">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {timerEndsAt && nextTimerDurationMs && (
        <div className="mt-4">
          <div className="w-full h-3 bg-gray-200 dark:bg-gray-800 rounded overflow-hidden">
            <div
              className={`h-3 bg-green-500 ${paused ? 'transition-none' : 'transition-all duration-300 ease-linear'}`}
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
          <p className="text-xs text-gray-600 mt-1">Next question in {countdown}s</p>
        </div>
      )}
    </div>
  );
}
