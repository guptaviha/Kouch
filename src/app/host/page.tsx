"use client";

import PlayerAvatar from '@/components/player-avatar';
import Header from '@/components/header';
import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import ActionButton from '@/components/action-button';
import QRCode from 'qrcode';

const SERVER = process.env.NEXT_PUBLIC_GAME_SERVER || 'http://localhost:3001';
const ROUND_DURATION_MS = 30_000; // same as server

type Player = { id: string; name: string; score: number; avatar?: string };

export type RoomStates = 'lobby' | 'playing' | 'round_result' | 'finished';

export default function HostPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [answeredPlayers, setAnsweredPlayers] = useState<string[]>([]);
  const [state, setState] = useState<RoomStates>('lobby');
  const [question, setQuestion] = useState<string | null>(null);
  const [questionImage, setQuestionImage] = useState<string | null>(null);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [roundIndex, setRoundIndex] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [roundResults, setRoundResults] = useState<any>(null);
  const [nextTimerDurationMs, setNextTimerDurationMs] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const splashTimerRef = useRef<number | null>(null);
  const [paused, setPaused] = useState(false);
  const pauseTimerRef = useRef<number | null>(null);
  const [pauseRemainingMs, setPauseRemainingMs] = useState<number | null>(null);
  const [playAgainPending, setPlayAgainPending] = useState(false);
  const [selectedPack, setSelectedPack] = useState<string | null>(null);

  useEffect(() => {
    const s = io(SERVER, { path: '/ws' });
    setSocket(s);

    s.on('server', (msg: any) => {
      if (!msg || !msg.type) return;
      if (msg.type === 'room_created') {
        setRoomCode(msg.roomCode);
        setPlayer(msg.player);
        // hide the intro only after server confirms the room was created
        setShowIntro(false);
        // if Play Again flow requested a new room, auto-start the new game
        if (playAgainPending) {
          setPlayAgainPending(false);
          try {
            // directly instruct server to start the newly created room
            s.emit('message', { type: 'start_game', roomCode: msg.roomCode, playerId: msg.player.id });
          } catch (e) { }
        }
      }
      if (msg.type === 'lobby_update') {
        setPlayers(msg.players || []);
        setState(msg.state || 'lobby');
      }
      if (msg.type === 'player_answered') {
        const pid = msg.playerId as string;
        setAnsweredPlayers((prev) => (prev.includes(pid) ? prev : [...prev, pid]));
      }
      if (msg.type === 'game_state') {
        setState('playing');
        setQuestion(msg.question || null);
        setQuestionImage(msg.image || null);
        setTimerEndsAt(msg.timerEndsAt || null);
        setRoundIndex(typeof msg.roundIndex === 'number' ? msg.roundIndex : null);
        setRoundResults(null);
        setRoundResults(null);
        // reset answered players for the new round
        setAnsweredPlayers([]);
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
      if (msg.type === 'game_paused') {
        setPaused(true);
        if (typeof msg.pauseRemainingMs === 'number') {
          setPauseRemainingMs(msg.pauseRemainingMs);
          setCountdown(Math.max(0, Math.ceil(msg.pauseRemainingMs / 1000)));
        }
      }
      if (msg.type === 'game_resumed') {
        setPaused(false);
        // if server provided nextTimerEndsAt, update timer
        if (msg.nextTimerEndsAt) setTimerEndsAt(msg.nextTimerEndsAt);
        setPauseRemainingMs(null);
      }
    });

    return () => {
      if (splashTimerRef.current) window.clearTimeout(splashTimerRef.current);
      s.disconnect();
    };
  }, []);

  useEffect(() => {
    // generate QR image when roomCode available
    if (!roomCode) {
      setQrDataUrl(null);
      return;
    }
    // Build an origin suitable for LAN devices. If served from localhost, allow an
    // override via NEXT_PUBLIC_LAN_HOST. If that's not set, fall back to the
    // current window hostname (useful when the page is already served from the
    // host's LAN IP). This avoids a hardcoded IP baked into the source.
    let originForQr = '';
    if (typeof window !== 'undefined') {
      const { protocol, hostname, port } = window.location;
      // Prefer an explicit env override (set NEXT_PUBLIC_LAN_HOST when developing
      // so phones can reach the dev machine). However, if that env var is set to
      // a loopback value like "localhost" or "127.0.0.1" it won't help remote
      // devices — in that case fall back to the page hostname (which will be the
      // LAN IP when the page is opened via http://<host-ip>:3000).
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
      // when paused, freeze the countdown — already set by pause handler
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

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  const createRoom = () => {
    if (!socket) return;
    socket.emit('message', { type: 'create_room', name: 'Host', pack: selectedPack });
  };

  const startGame = () => {
    if (!socket || !roomCode || !player) return;
    socket.emit('message', { type: 'start_game', roomCode, playerId: player.id });
  };

  const pauseGame = () => {
    if (!socket || !roomCode || !player) return;
    socket.emit('message', { type: 'pause_game' });
  };

  const resumeGame = () => {
    if (!socket || !roomCode || !player) return;
    socket.emit('message', { type: 'resume_game' });
  };

  const resetGame = () => {
    if (!socket || !roomCode || !player) return;
    // reset current game, then create a fresh room and auto-start it
    socket.emit('message', { type: 'reset_game', roomCode, playerId: player.id });
    // request server to create a new room for us and mark pending to auto-start
    setPlayAgainPending(true);
    socket.emit('message', { type: 'create_room', name: 'Host' });
  };

  if (!mounted) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-8 max-w-3xl mx-auto relative">

      <Header roomCode={roomCode} avatarKey={player?.avatar} name={player?.name ?? null} role="host" />

      {/* Home page tagline + how to play + big start button */}
      {showIntro && (
        <div className="mb-10 text-center">
          <p className="text-2xl text-gray-400 dark:text-gray-500 font-medium tracking-tight mb-8">couch party games for friends</p>

          <div className="w-full max-w-2xl mx-auto border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-8 bg-gray-50/50 dark:bg-gray-900/50">
            <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-gray-200">How to play</h3>
            <ol className="list-decimal list-inside space-y-3 text-gray-600 dark:text-gray-400 text-left w-fit mx-auto">
              <li className="pl-2">Get some friends with phones</li>
              <li className="pl-2">Choose a game pack below</li>
              <li className="pl-2">Start a party on a screen everyone can see</li>
              <li className="pl-2">Decimate your friends!</li>
            </ol>
          </div>

        </div>
      )}

      {paused && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white/80 dark:bg-black/70 backdrop-blur-sm rounded p-6">
            <div className="text-4xl font-extrabold">Game Paused</div>
          </div>
        </div>
      )}

      {!roomCode ? (
        <div className='flex flex-col items-center gap-8 w-full'>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            <div
              onClick={() => setSelectedPack('general')}
              className={`cursor-pointer p-6 rounded-xl border-2 transition-all ${selectedPack === 'general' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg scale-[1.02]' : 'border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700'}`}
            >
              <h3 className="text-xl font-bold mb-2">General Trivia</h3>
              <p className="text-gray-600 dark:text-gray-400">Classic brain teasers to test your knowledge.</p>
            </div>
            <div
              onClick={() => setSelectedPack('rebus')}
              className={`cursor-pointer p-6 rounded-xl border-2 transition-all ${selectedPack === 'rebus' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-lg scale-[1.02]' : 'border-gray-200 dark:border-gray-800 hover:border-purple-300 dark:hover:border-purple-700'}`}
            >
              <h3 className="text-xl font-bold mb-2">Rebus Puzzles</h3>
              <p className="text-gray-600 dark:text-gray-400">Visual word puzzles. Say what you see!</p>
            </div>
          </div>

          <div className={`transition-all duration-500 ${selectedPack ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
            <ActionButton onClick={createRoom}>Start Party</ActionButton>
          </div>
        </div>
      ) : (
        <div>
          {state === 'lobby' && (
            <div className="mb-4">
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
                          <a target="_blank" rel="noreferrer" className="text-sm font-mono text-blue-600 dark:text-blue-400 font-medium break-all" href={joinUrl ?? `/player?code=${roomCode}`}>{joinUrl?.replace(/^https?:\/\//, '') ?? `.../player?code=${roomCode}`}</a>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">Generating QR code...</div>
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
                        <p className="text-lg font-medium text-gray-400 dark:text-gray-500 mb-2">Waiting for players...</p>
                        <p className="text-sm text-gray-400">Scan the QR code to allow friends to join!</p>
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
              {/* players' answer status strip (moved to bottom of the page for better layout) */}
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Question</h2>
                  </div>
                </div>
                <p className="mb-2 text-xl font-medium">{question}</p>
                {questionImage && (
                  <div className="my-6 flex justify-center">
                    <img src={questionImage} alt="Puzzle" className="max-h-64 rounded-lg shadow-md border border-gray-100 dark:border-gray-800" />
                  </div>
                )}
              </div>

              {/* Round progress bar at bottom of the playing card */}
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
              {/* Player avatars below the timer (round view) */}
              {players.length > 0 && (
                <div className="mt-4 flex items-center justify-center gap-4">
                  {players.map((p) => {
                    const answered = answeredPlayers.includes(p.id);
                    return (
                      <div key={p.id} className="flex flex-col items-center text-xs w-20">
                        <motion.div
                          initial={false}
                          animate={answered ? { scale: 0.92, opacity: 1 } : { scale: 1, opacity: 0.45 }}
                          transition={{ duration: 0.22 }}
                          className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center"
                        >
                          <div className={`${answered ? '' : 'filter grayscale opacity-40'} w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800`}>
                            <PlayerAvatar avatarKey={p.avatar} size={36} />
                          </div>
                        </motion.div>
                        <div className={`mt-1 truncate w-full text-center ${answered ? 'text-white' : 'text-gray-400'}`}>{p.name}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {state === 'round_result' && roundResults && (
            <div className="mt-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 rounded relative">
              {/* Pause / Resume controls for host only */}
              <div className="absolute right-4 top-4">
                {!paused ? (
                  <Button variant="destructive" onClick={pauseGame}>Pause</Button>
                ) : (
                  <Button variant="default" onClick={resumeGame}>Resume</Button>
                )}
              </div>
              <h2 className="text-lg font-semibold">Round Results</h2>

              {/* Show the correct answer prominently at the top */}
              {roundResults.correctAnswer && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded">
                  <p className="text-sm text-gray-700 dark:text-gray-200">Answer</p>
                  <div className="text-2xl font-bold">{roundResults.correctAnswer}</div>
                </div>
              )}

              <div className="mt-3">
                <h3 className="font-semibold">Leaderboard</h3>
                <ol className="mt-2">
                  {(roundResults.leaderboard || []).map((p: any) => (
                    <li key={p.id}>{p.name} — {p.score} pts</li>
                  ))}
                </ol>
              </div>

              {/* Results table without time column */}
              <div className="mt-4 overflow-auto">
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

              {/* Progress bar */}
              {timerEndsAt && nextTimerDurationMs && (
                <div className="mt-4">
                  <div className="w-full h-3 bg-gray-200 dark:bg-gray-800 rounded overflow-hidden">
                    <div
                      className="h-3 bg-green-500 transition-all duration-300 ease-linear"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(
                            100,
                            Math.round(
                              // when paused, use pauseRemainingMs to compute elapsed
                              paused && pauseRemainingMs != null
                                ? ((nextTimerDurationMs - pauseRemainingMs) / nextTimerDurationMs) * 100
                                : ((nextTimerDurationMs - Math.max(0, (timerEndsAt || 0) - Date.now())) / nextTimerDurationMs) * 100
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
          )}

          {state === 'finished' && roundResults && (
            <div className="mt-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 rounded">
              <h2 className="text-lg font-semibold">Final Leaderboard</h2>
              <ol className="mt-2">
                {(roundResults.final || []).map((p: any) => (
                  <li key={p.id}>{p.name} — {p.score} pts</li>
                ))}
              </ol>
              <div className="mt-4">
                <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={resetGame}>Play Again</button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
