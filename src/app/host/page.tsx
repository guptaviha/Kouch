"use client";

import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import QRCode from 'qrcode';

const SERVER = process.env.NEXT_PUBLIC_GAME_SERVER || 'http://localhost:3001';

type Player = { id: string; name: string; score: number };

export type RoomStates = 'lobby' | 'playing' | 'round_result' | 'finished';

export default function HostPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [state, setState] = useState<RoomStates>('lobby');
  const [question, setQuestion] = useState<string | null>(null);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [roundIndex, setRoundIndex] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [roundResults, setRoundResults] = useState<any>(null);
  const [nextTimerDurationMs, setNextTimerDurationMs] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const s = io(SERVER, { path: '/ws' });
    setSocket(s);

    s.on('server', (msg: any) => {
      if (!msg || !msg.type) return;
      if (msg.type === 'room_created') {
        setRoomCode(msg.roomCode);
        setPlayer(msg.player);
      }
      if (msg.type === 'lobby_update') {
        setPlayers(msg.players || []);
        setState(msg.state || 'lobby');
      }
      if (msg.type === 'game_state') {
        setState('playing');
        setQuestion(msg.question || null);
        setTimerEndsAt(msg.timerEndsAt || null);
        setRoundIndex(typeof msg.roundIndex === 'number' ? msg.roundIndex : null);
        setRoundResults(null);
      }
      if (msg.type === 'round_result') {
        setState('round_result');
        setRoundResults(msg);
        // use nextTimerEndsAt from server to show countdown on results screen
        if (msg.nextTimerEndsAt) setTimerEndsAt(msg.nextTimerEndsAt);
        setRoundIndex(typeof msg.roundIndex === 'number' ? msg.roundIndex : null);
        if (typeof msg.nextTimerDurationMs === 'number') setNextTimerDurationMs(msg.nextTimerDurationMs);
      }
      if (msg.type === 'final_leaderboard') {
        setState('finished');
        setRoundResults({ final: msg.leaderboard });
      }
    });

    return () => {
      s.disconnect();
    };
  }, []);

  useEffect(() => {
    // generate QR image when roomCode available
    if (!roomCode) {
      setQrDataUrl(null);
      return;
    }
    // Build an origin suitable for LAN devices. If served from localhost, replace with the LAN IP
    let originForQr = '';
    if (typeof window !== 'undefined') {
      const { protocol, hostname, port } = window.location;
      // If served from localhost, use the LAN IP so phones on the same network can connect
      const LAN_HOST = process.env.NEXT_PUBLIC_LAN_HOST || '192.168.5.193';
      const hostForQr = (hostname === 'localhost' || hostname === '127.0.0.1') ? LAN_HOST : hostname;
      const portPart = port ? `:${port}` : '';
      originForQr = `${protocol}//${hostForQr}${portPart}`;
    }

    const url = `${originForQr}/player?code=${roomCode}`;
    setJoinUrl(url);
    QRCode.toDataURL(url, { margin: 1, width: 300 }).then((d: string) => setQrDataUrl(d)).catch(() => setQrDataUrl(null));
  }, [roomCode]);

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

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const createRoom = () => {
    if (!socket) return;
    socket.emit('message', { type: 'create_room', name: 'Host' });
  };

  const startGame = () => {
    if (!socket || !roomCode || !player) return;
    socket.emit('message', { type: 'start_game', roomCode, playerId: player.id });
  };

  if (!mounted) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Kouch — Host</h1>

      {!roomCode ? (
        <div>
          <p className="mb-4">Create a room to host the quiz.</p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={createRoom}>Create Room</button>
        </div>
      ) : (
        <div>
          <div className="mb-4">
            <strong>Room:</strong> <span className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">{roomCode}</span>
            {qrDataUrl && (
              <div className="mt-3 flex items-center gap-4">
                <img src={qrDataUrl} alt={`QR code for ${roomCode}`} className="w-44 h-44 bg-white p-1 rounded shadow" />
                <div>
                  <p className="text-sm">Scan to join</p>
                  <div className="flex items-center gap-2">
                    <a className="text-xs text-blue-600 underline break-all" href={joinUrl ?? `/player?code=${roomCode}`}>{joinUrl ?? `/player?code=${roomCode}`}</a>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mb-4">
            <strong>State:</strong> {state}
          </div>

          <div className="mb-4">
            <h3 className="font-semibold">Players</h3>
            <ul>
              {players.map((p) => (
                <li key={p.id}>{p.name} — {p.score} pts</li>
              ))}
            </ul>
          </div>

          {state === 'lobby' && (
            <Button variant="default" onClick={startGame}>Start Game</Button>
          )}

          {state === 'playing' && (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Question</h2>
                  <p className="text-sm text-gray-600">Round {roundIndex != null ? roundIndex + 1 : '—'}</p>
                </div>
                <div className="text-4xl font-extrabold">{roundIndex != null ? `Round ${roundIndex + 1}` : ''}</div>
              </div>
              <p className="mb-2">{question}</p>
              <p className="text-sm text-gray-600">Time remaining: {countdown}s</p>
            </div>
          )}

          {state === 'round_result' && roundResults && (
            <div className="mt-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 rounded">
              <h2 className="text-lg font-semibold">Round Results</h2>
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
              <table className="w-full mt-2 text-sm table-fixed">
                <thead>
                  <tr className="text-left">
                    <th className="pb-2">Player</th>
                    <th className="pb-2">Answer</th>
                    <th className="pb-2">Correct</th>
                    <th className="pb-2">Time (ms)</th>
                    <th className="pb-2">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {(roundResults.results || []).map((r: any) => (
                    <tr key={r.playerId} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="py-2">{r.name}</td>
                      <td className="py-2">{r.answer ?? '—'}</td>
                      <td className="py-2">{r.correct ? 'Yes' : 'No'}</td>
                      <td className="py-2">{r.timeTaken ?? '—'}</td>
                      <td className="py-2">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4">
                <h3 className="font-semibold">Leaderboard</h3>
                <ol className="mt-2">
                  {(roundResults.leaderboard || []).map((p: any) => (
                    <li key={p.id}>{p.name} — {p.score} pts</li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {state === 'finished' && roundResults && (
            <div className="mt-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 rounded">
              <h2 className="text-lg font-semibold">Final Leaderboard</h2>
              <ol className="mt-2">
                {(roundResults.final || []).map((p: any) => (
                  <li key={p.id}>{p.name} — {p.score} pts</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
