/*
Simple Socket.IO game server + HTTP proxy (TypeScript friendly).

Run (after starting Next on :3000):
  npm run dev:server

This server implements a simple room-based quiz game with 3 hardcoded rounds.
Protocol (client -> server): JSON messages with `type`.
- create_room: { type: 'create_room', name }
- join: { type: 'join', roomCode, name }
- start_game: { type: 'start_game', roomCode, playerId }
- submit_answer: { type: 'submit_answer', roomCode, playerId, answer }

Server emits 'server' events to clients with payloads containing `type`.
*/

import http from 'http';
import httpProxy from 'http-proxy';
import { Server as IOServer, Socket } from 'socket.io';

type RoomStates = 'lobby' | 'playing' | 'round_result' | 'finished';

interface SubmittedAnswer {
  answer: string;
  timeTaken: number;
}

interface Player {
  id: string;
  name: string;
  score: number;
  socket: Socket;
  avatar?: string;
}

interface Host {
  id: string;
  name: string;
  socket: Socket;
  avatar?: string;
}

interface Room {
  code: string;
  players: Map<string, Player>;
  state: RoomStates;
  hostId: string;
  host?: Host;
  roundIndex: number;
  roundStart?: number;
  timers: { round?: NodeJS.Timeout; next?: NodeJS.Timeout };
  // pause support
  paused?: boolean;
  nextTimerEndsAt?: number | null;
  pauseRemainingMs?: number | null;
  answers: Map<string, SubmittedAnswer>;
  selectedPack: string;
  timerEndsAt?: number;
}

const NEXT_TARGET = process.env.NEXT_TARGET || 'http://localhost:3000';
const PORT = parseInt(process.env.PORT || '3001', 10);

const proxy = httpProxy.createProxyServer({ target: NEXT_TARGET, changeOrigin: true }) as any;

const server = http.createServer((req, res) => {
  proxy.web(req, res, (err: Error) => {
    console.error('Proxy error:', err && err.message);
    res.statusCode = 502;
    res.end('Bad Gateway');
  });
});

// Hardcoded questions (3 rounds)
// Hardcoded questions (3 rounds)
const PACKS: Record<string, { question: string; answer: string; image?: string }[]> = {
  general: [
    { question: 'What is the capital of France?', answer: 'paris' },
    { question: 'What is 5 + 7?', answer: '12' },
    { question: 'Which planet is known as the Red Planet?', answer: 'mars' },
  ],
  rebus: [
    { question: 'Solve the rebus puzzle!', answer: 'starfish', image: '/rebus-1.png' },
    { question: 'Solve the rebus puzzle!', answer: 'buttercup', image: '/rebus-2.png' },
    { question: 'Solve the rebus puzzle!', answer: 'fireman', image: '/rebus-3.png' },
  ]
};

const ROUND_DURATION_MS = 30_000; // 30s per round
const BETWEEN_ROUND_MS = 10_000; // 10s pause between rounds (result screen)
// Scoring: base points + time bonus
const BASE_POINTS = 100;
const MAX_TIME_BONUS = 200; // maximum bonus if answered instantly

const rooms = new Map<string, Room>();

function genCode(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let codeStr = '';
  for (let i = 0; i < 4; i++) codeStr += letters[Math.floor(Math.random() * letters.length)];
  return codeStr;
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

const AVATAR_KEYS = [
  'BsRobot', 'SiProbot', 'PiDogFill', 'BiSolidCat', 'MdElderlyWoman', 'MdPregnantWoman',
  'GiPyromaniac', 'TbMichelinBibGourmand', 'TbMoodCrazyHappy', 'GiMonkey', 'GiBatMask',
  'GiSpiderMask', 'GiNinjaHead', 'VscSnake', 'GiSharkBite', 'GiDinosaurRex', 'GiSeaDragon',
  'MdCatchingPokemon', 'GiDirectorChair', 'RiAliensLine', 'GiWitchFlight', 'FaUserAstronaut', 'GiBirdTwitter'
];

function pickAvatar() {
  const avatarIndex = Math.floor(Math.random() * AVATAR_KEYS.length);
  const avatarKey = AVATAR_KEYS[avatarIndex];
  // Debug: log chosen avatar (index + key) to help trace avatar assignment
  console.log('pickAvatar ->', { avatarIndex, avatarKey });
  return avatarKey;
}

function cleanPlayerForWire(player: Player) {
  return { id: player.id, name: player.name, score: player.score, avatar: player.avatar };
}

function broadcast(room: Room, msg: any) {
  for (const player of room.players.values()) {
    try {
      if (player.socket && player.socket.connected) player.socket.emit('server', msg);
    } catch (e) {
      // ignore
    }
  }
  try {
    if (room.host && room.host.socket && room.host.socket.connected) {
      room.host.socket.emit('server', msg);
    }
  } catch (e) {
    // ignore
  }
}

function broadcastLobby(room: Room) {
  const payload = {
    type: 'lobby_update',
    roomCode: room.code,
    players: Array.from(room.players.values()).map(cleanPlayerForWire),
    state: room.state,
  };
  broadcast(room, payload);
}

function leaderboardFor(room: Room) {
  return Array.from(room.players.values())
    .map(cleanPlayerForWire)
    .sort((a, b) => b.score - a.score);
}

function startRound(room: Room) {
  const currentRoundIndex = room.roundIndex;
  const pack = PACKS[room.selectedPack] || PACKS['general'];
  if (currentRoundIndex >= pack.length) {
    room.state = 'finished';
    broadcast(room, { type: 'final_leaderboard', roomCode: room.code, leaderboard: leaderboardFor(room) });
    return;
  }

  room.state = 'playing';
  room.roundStart = Date.now();
  room.answers = new Map<string, SubmittedAnswer>();

  const roundEnd = room.roundStart + ROUND_DURATION_MS;
  room.timerEndsAt = roundEnd;
  broadcast(room, {
    type: 'game_state',
    state: room.state,
    roomCode: room.code,
    roundIndex: currentRoundIndex,
    question: pack[currentRoundIndex].question,
    image: pack[currentRoundIndex].image, // send image URL if available
    timerEndsAt: roundEnd,
  });

  room.timers.round = setTimeout(() => endRound(room), ROUND_DURATION_MS);
}

function endRound(room: Room) {
  if (room.timers.round) clearTimeout(room.timers.round);
  const currentRoundIndex = room.roundIndex;
  const pack = PACKS[room.selectedPack] || PACKS['general'];
  const correctAnswer = pack[currentRoundIndex].answer.toLowerCase().trim();

  const results: Array<{
    playerId: string;
    name: string;
    answer: string | null;
    correct: boolean;
    timeTaken: number | null;
    points: number;
    base: number;
    bonus: number;
  }> = [];

  for (const [pid, player] of room.players) {
    const submitted = room.answers.get(pid);
    if (submitted) {
      const correct = submitted.answer.trim().toLowerCase() === correctAnswer;
      const timeTaken = submitted.timeTaken;
      let points = 0;
      let base = 0;
      let bonus = 0;
      if (correct) {
        // linear bonus based on how quickly they answered in the round
        bonus = Math.max(0, Math.round(MAX_TIME_BONUS * (1 - timeTaken / ROUND_DURATION_MS)));
        base = BASE_POINTS;
        points = base + bonus;
      }
      player.score = (player.score || 0) + points;
      results.push({ playerId: pid, name: player.name, answer: submitted.answer, correct, timeTaken, points, base, bonus });
    } else {
      results.push({ playerId: pid, name: player.name, answer: null, correct: false, timeTaken: null, points: 0, base: 0, bonus: 0 });
    }
  }

  results.sort((a, b) => {
    if (a.correct === b.correct) {
      if (a.timeTaken == null) return 1;
      if (b.timeTaken == null) return -1;
      return a.timeTaken - b.timeTaken;
    }
    return a.correct ? -1 : 1;
  });

  room.state = 'round_result';
  const nextEndsAt = Date.now() + BETWEEN_ROUND_MS;
  room.nextTimerEndsAt = nextEndsAt;
  broadcast(room, {
    type: 'round_result',
    roomCode: room.code,
    roundIndex: currentRoundIndex,
    results,
    leaderboard: leaderboardFor(room),
    // include the correct answer so hosts can display it
    correctAnswer: pack[currentRoundIndex].answer,
    nextTimerEndsAt: nextEndsAt,
    nextTimerDurationMs: BETWEEN_ROUND_MS,
  });

  room.roundIndex++;

  if (room.roundIndex < pack.length) {
    room.timers.next = setTimeout(() => startRound(room), BETWEEN_ROUND_MS);
  } else {
    room.timers.next = setTimeout(() => {
      room.state = 'finished';
      broadcast(room, { type: 'final_leaderboard', roomCode: room.code, leaderboard: leaderboardFor(room) });
    }, BETWEEN_ROUND_MS);
  }
}

function handleMessage(socket: Socket, msg: any) {
  console.log('Received message:', msg);
  let messageObj = msg;
  if (typeof msg === 'string') {
    try {
      messageObj = JSON.parse(msg);
    } catch (e) {
      socket.emit('server', { type: 'error', message: 'invalid json' });
      return;
    }
  }

  const msgType = messageObj && messageObj.type;
  if (!msgType) return;

  const send = (sock: Socket | null | undefined, payload: any) => {
    if (sock && sock.connected) sock.emit('server', payload);
  };

  if (msgType === 'create_room') {
    const name = messageObj.name || 'Host';
    const pack = messageObj.pack || 'general'; // Default to general if not specified
    const code = (() => {
      let newCode = genCode();
      while (rooms.has(newCode)) newCode = genCode();
      return newCode;
    })();

    const hostId = makeId();
    const hostAvatar = pickAvatar();
    const room: Room = {
      code,
      players: new Map(),
      state: 'lobby',
      hostId,
      host: { id: hostId, name, socket, avatar: hostAvatar },
      roundIndex: 0,
      timers: {},
      answers: new Map(),
      selectedPack: pack,
    };

    rooms.set(code, room);

    socket.data = { roomCode: code, hostId };

    send(socket, { type: 'room_created', roomCode: code, player: { id: hostId, name, score: 0, avatar: hostAvatar } });
    broadcastLobby(room);
    return;
  }

  if (msgType === 'join') {
    const { roomCode, name } = messageObj;
    const room = rooms.get(roomCode);
    if (!room) {
      send(socket, { type: 'error', message: 'room not found' });
      return;
    }
    if (room.state !== 'lobby') {
      send(socket, { type: 'error', message: 'room not accepting joins' });
      return;
    }
    const playerId = makeId();
    console.log('Assigning avatar to new player:', playerId);
    const playerObj: Player = { id: playerId, name: name || 'Player', socket, score: 0, avatar: pickAvatar() };
    console.log('New player avatar:', playerObj);
    room.players.set(playerId, playerObj);
    socket.data = { roomCode, playerId };
    send(socket, { type: 'joined', roomCode, player: cleanPlayerForWire(playerObj) });
    broadcastLobby(room);
    return;
  }

  if (msgType === 'start_game') {
    const { roomCode, playerId } = messageObj;
    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.hostId !== playerId) {
      send(socket, { type: 'error', message: 'only host can start' });
      return;
    }
    room.roundIndex = 0;
    startRound(room);
    return;
  }

  if (msgType === 'pause_game') {
    const meta = (socket.data || {}) as { roomCode?: string; playerId?: string; hostId?: string };
    const room = meta.roomCode ? rooms.get(meta.roomCode) : null;
    if (!room) return;
    // only host may pause
    if (!meta.hostId || room.hostId !== meta.hostId) {
      send(socket, { type: 'error', message: 'only host can pause' });
      return;
    }
    if (room.state === 'round_result') {
      // compute remaining time until next round (use nextTimerEndsAt if set, otherwise default)
      const remaining = room.nextTimerEndsAt ? room.nextTimerEndsAt - Date.now() : BETWEEN_ROUND_MS;
      room.pauseRemainingMs = Math.max(0, remaining);
      // clear any scheduled next timer if present
      if (room.timers.next) {
        clearTimeout(room.timers.next);
        room.timers.next = undefined;
      }
      room.paused = true;
      console.log('pause_game ->', { roomCode: room.code, remainingMs: room.pauseRemainingMs });
      broadcast(room, { type: 'game_paused', roomCode: room.code, pauseRemainingMs: room.pauseRemainingMs });
    }
    return;
  }

  if (msgType === 'resume_game') {
    const meta = (socket.data || {}) as { roomCode?: string; playerId?: string; hostId?: string };
    const room = meta.roomCode ? rooms.get(meta.roomCode) : null;
    if (!room) return;
    if (!meta.hostId || room.hostId !== meta.hostId) {
      send(socket, { type: 'error', message: 'only host can resume' });
      return;
    }
    if (room.state === 'round_result' && room.paused) {
      const toWait = room.pauseRemainingMs != null ? room.pauseRemainingMs : BETWEEN_ROUND_MS;
      room.paused = false;
      room.nextTimerEndsAt = Date.now() + toWait;
      room.timers.next = setTimeout(() => startRound(room), toWait);
      broadcast(room, { type: 'game_resumed', roomCode: room.code, nextTimerEndsAt: room.nextTimerEndsAt });
    }
    return;
  }

  if (msgType === 'submit_answer') {
    const { roomCode, playerId, answer } = messageObj;
    const room = rooms.get(roomCode);
    if (!room || room.state !== 'playing') return;
    const player = room.players.get(playerId);
    if (!player) return;
    if (room.answers.has(playerId)) return;
    const timeTaken = Date.now() - (room.roundStart || Date.now());
    room.answers.set(playerId, { answer: String(answer || ''), timeTaken });
    send(player.socket, { type: 'answer_received', roundIndex: room.roundIndex });
    // notify host/other clients that this player has answered so UI can update
    try {
      broadcast(room, { type: 'player_answered', roomCode: room.code, playerId });
    } catch (e) { }
    // If all players have answered, end the round early
    try {
      if (room.answers.size === room.players.size) {
        // clear the round timer if present and end round now
        if (room.timers.round) {
          clearTimeout(room.timers.round);
          room.timers.round = undefined;
        }
        // ensure we only end if currently playing
        if (room.state === 'playing') {
          // Add a slight delay before showing results for better UX
          setTimeout(() => {
            if (room.state === 'playing') endRound(room);
          }, 1500);
        }
      }
    } catch (e) {
      // ignore
    }
    return;
  }

  if (msgType === 'reset_game') {
    const meta = (socket.data || {}) as { roomCode?: string; playerId?: string; hostId?: string };
    const room = meta.roomCode ? rooms.get(meta.roomCode) : null;
    if (!room) return;
    // only host can reset
    if (!meta.hostId || room.hostId !== meta.hostId) {
      send(socket, { type: 'error', message: 'only host can reset game' });
      return;
    }
    // reset game state back to lobby
    room.state = 'lobby';
    room.roundIndex = 0;
    room.nextTimerEndsAt = null;
    room.pauseRemainingMs = null;
    room.paused = false;
    // clear timers
    if (room.timers.round) { clearTimeout(room.timers.round); room.timers.round = undefined; }
    if (room.timers.next) { clearTimeout(room.timers.next); room.timers.next = undefined; }
    // reset player scores
    for (const player of room.players.values()) {
      player.score = 0;
    }
    // notify everyone
    broadcastLobby(room);
    return;
  }

  if (msgType === 'extend_timer') {
    const meta = (socket.data || {}) as { roomCode?: string; playerId?: string; hostId?: string };
    const room = meta.roomCode ? rooms.get(meta.roomCode) : null;
    if (!room) return;
    // only host can extend
    if (!meta.hostId || room.hostId !== meta.hostId) {
      send(socket, { type: 'error', message: 'only host can extend timer' });
      return;
    }

    if (room.state !== 'playing' || !room.timers.round) {
      send(socket, { type: 'error', message: 'can only extend timer during a round' });
      return;
    }

    const EXTENSION_MS = 15_000;

    // If we don't have timerEndsAt tracked yet (e.g. server restarted mid-game but memory persisted? unlikely), fallback
    const currentEnd = room.timerEndsAt || (Date.now() + 1000);
    const newEnd = currentEnd + EXTENSION_MS;
    room.timerEndsAt = newEnd;

    // Reschedule
    if (room.timers.round) clearTimeout(room.timers.round);
    const remaining = Math.max(0, newEnd - Date.now());
    room.timers.round = setTimeout(() => endRound(room), remaining);

    console.log(`Timer extended by ${EXTENSION_MS}ms. New end: ${newEnd}`);
    broadcast(room, { type: 'timer_updated', roomCode: room.code, timerEndsAt: newEnd });
    return;
  }

  if (msgType === 'ping') {
    send(socket, { type: 'pong' });
    return;
  }

  send(socket, { type: 'error', message: 'unknown message type' });
}

const io = new IOServer(server, { path: '/ws', cors: { origin: '*' } });

io.on('connection', (socket: Socket) => {
  socket.on('message', (m: any) => {
    try {
      handleMessage(socket, m);
    } catch (e) {
      console.error('handleMessage error', e);
      socket.emit('server', { type: 'error', message: 'server error' });
    }
  });

  socket.on('client', (m: any) => {
    try {
      handleMessage(socket, m);
    } catch (e) {
      console.error('handleMessage error', e);
      socket.emit('server', { type: 'error', message: 'server error' });
    }
  });

  socket.on('disconnect', () => {
    const meta = (socket.data || {}) as { roomCode?: string; playerId?: string; hostId?: string };
    const room = meta.roomCode ? rooms.get(meta.roomCode) : null;
    if (!room) return;

    if (meta.playerId) {
      room.players.delete(meta.playerId);
      if (room.players.size === 0 && (!room.host || !room.host.socket || !room.host.socket.connected)) {
        Object.values(room.timers || {}).forEach((t) => clearTimeout(t));
        rooms.delete(room.code);
        return;
      }
      broadcastLobby(room);
      return;
    }

    if (meta.hostId) {
      const firstKey = room.players.keys().next().value;
      if (firstKey) {
        const promoted = room.players.get(firstKey)!;
        room.hostId = promoted.id;
        room.host = { id: promoted.id, name: promoted.name, socket: promoted.socket, avatar: promoted.avatar };
        room.players.delete(firstKey);
        if (promoted.socket) promoted.socket.data = { roomCode: room.code, hostId: promoted.id };
        try {
          room.host.socket.emit('server', { type: 'host_promoted', roomCode: room.code, hostId: promoted.id });
        } catch (e) { }
      } else {
        Object.values(room.timers || {}).forEach((t) => clearTimeout(t));
        rooms.delete(room.code);
      }
      broadcastLobby(room);
      return;
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Proxying non-ws requests to ${NEXT_TARGET}`);
  console.log('WebSocket endpoint: ws://<host>:' + PORT + '/ws');
});
