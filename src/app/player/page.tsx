"use client";

import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { RoomStates } from '../host/page';

const SERVER = process.env.NEXT_PUBLIC_GAME_SERVER || 'http://localhost:3001';

export default function PlayerPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [state, setState] = useState<RoomStates>('lobby');
  const [question, setQuestion] = useState<string | null>(null);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [roundIndex, setRoundIndex] = useState<number | null>(null);
  const [answer, setAnswer] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<any>(null);
  const [roundResults, setRoundResults] = useState<any>(null);
  const [nextTimerDurationMs, setNextTimerDurationMs] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const s = io(SERVER, { path: '/ws' });
    setSocket(s);

    s.on('server', (msg: any) => {
      if (!msg || !msg.type) return;
      if (msg.type === 'joined') {
        setJoined(true);
        setPlayerId(msg.player.id);
        setMessage('Joined room ' + msg.roomCode);
      }
      if (msg.type === 'lobby_update') {
        setState(msg.state || 'lobby');
      }
      if (msg.type === 'game_state') {
        setState('playing');
        setQuestion(msg.question || null);
        setTimerEndsAt(msg.timerEndsAt || null);
        setRoundIndex(typeof msg.roundIndex === 'number' ? msg.roundIndex : null);
        setLeaderboard(null);
      }
      if (msg.type === 'answer_received') {
        setMessage('Answer received');
      }
      if (msg.type === 'round_result') {
        setState('round_result');
        setLeaderboard(msg.leaderboard || null);
        setRoundResults(msg);
        if (msg.nextTimerEndsAt) setTimerEndsAt(msg.nextTimerEndsAt);
        if (typeof msg.nextTimerDurationMs === 'number') setNextTimerDurationMs(msg.nextTimerDurationMs);
        setRoundIndex(typeof msg.roundIndex === 'number' ? msg.roundIndex : null);
      }
      if (msg.type === 'final_leaderboard') {
        setState('finished');
        setLeaderboard(msg.leaderboard || null);
      }
    });

    // prefill room code from URL param if present
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) setRoomCode(code.toUpperCase());
      }
    } catch (e) {}

    return () => { s.disconnect(); };
  }, []);

  useEffect(() => {
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
    if (!socket || !playerId || !roomCode) return;
    socket.emit('message', { type: 'submit_answer', roomCode, playerId, answer });
    setMessage('Submitted');
  };

  if (!mounted) return null;

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Kouch — Player</h1>

      {!joined ? (
        <div>
          <label className="block mb-2">Name</label>
          <input className="w-full mb-3 p-2 border rounded" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="block mb-2">Room Code</label>
          <input className="w-full mb-3 p-2 border rounded" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} />
          <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={joinRoom}>Join</button>
          {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}
        </div>
      ) : (
        <div>
          <p className="mb-2">Room: <strong>{roomCode}</strong></p>
          <p className="mb-2">State: {state}</p>

          {state === 'playing' && (
            <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 rounded">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Question</h2>
                  <p className="text-sm text-gray-600">Round {roundIndex != null ? roundIndex + 1 : '—'}</p>
                </div>
                <div className="text-3xl font-bold">{roundIndex != null ? `Round ${roundIndex + 1}` : ''}</div>
              </div>
              <p className="mb-2">{question}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">Time remaining: {countdown}s</p>
              <input className="w-full mb-2 p-2 border rounded" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type answer" />
              <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={submitAnswer}>Submit</button>
            </div>
          )}

          {state === 'round_result' && roundResults && (
            <div className="mt-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 rounded">
              <h3 className="font-semibold">Round Results</h3>
              {timerEndsAt && nextTimerDurationMs && (
                <div className="my-3">
                  <div className="w-full h-3 bg-gray-200 dark:bg-gray-800 rounded overflow-hidden">
                    <div
                      className="h-3 bg-green-500 transition-all"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(
                            100,
                            Math.round(
                              ((nextTimerDurationMs - Math.max(0, timerEndsAt - Date.now())) / nextTimerDurationMs) * 100
                            )
                          )
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Next question in {countdown}s</p>
                </div>
              )}

              {/* Show this player's result breakdown */}
              {playerId && (
                <div className="mt-2 mb-3 p-2 border rounded bg-gray-50 dark:bg-gray-900">
                  <h4 className="font-semibold">Your result</h4>
                  {(() => {
                    const my = (roundResults.results || []).find((r: any) => r.playerId === playerId);
                    if (!my) return <p className="text-sm text-gray-600">You did not submit an answer.</p>;
                    return (
                      <div className="text-sm">
                        <p><strong>Answer:</strong> {my.answer ?? '—'}</p>
                        <p><strong>Correct:</strong> {my.correct ? 'Yes' : 'No'}</p>
                        <p><strong>Time:</strong> {my.timeTaken ?? '—'} ms</p>
                        <p><strong>Base:</strong> {my.base ?? 0} pts</p>
                        <p><strong>Time bonus:</strong> {my.bonus ?? 0} pts</p>
                        <p className="mt-1"><strong>Total:</strong> {my.points} pts</p>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <h3 className="font-semibold">Leaderboard</h3>
                <ol className="mt-2">
                  {(roundResults.leaderboard || []).map((p: any) => (
                    <li key={p.id}>{p.name} — {p.score} pts</li>
                  ))}
                </ol>
              </div>
            </div>
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
