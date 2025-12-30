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

// Note: we avoid importing TypeScript-only modules here to keep the server runnable
// by plain Node. Types are not required at runtime.
import http from 'http';
import httpProxy from 'http-proxy';
import { Server as IOServer, Socket } from 'socket.io';

import type {
  ClientMessage,
  ServerMessage,
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  RoomPhase,
  PlayerWire,
  RoundResultEntry,
} from '../src/types/socket.ts';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, any, SocketData>;

interface SubmittedAnswer {
  answer: string;
  timeTaken: number;
}

interface Player {
  id: string;
  name: string;
  score: number;
  socket: TypedSocket;
  avatar?: string;
  connected: boolean;
}

interface Host {
  id: string;
  name: string;
  socket: TypedSocket;
  avatar?: string;
}

interface Room {
  code: string;
  players: Map<string, Player>;
  state: RoomPhase;
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
  totalQuestionDuration?: number;
  hintsUsed?: Set<string>;
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
const PACKS: Record<string, { question: string; answer: string; image?: string; hint?: string }[]> = {
  trivia: [
    { question: 'What is the capital of France?', answer: 'paris' },
    { question: 'What is 5 + 7?', answer: '12' },
    { question: 'Which planet is known as the Red Planet?', answer: 'mars' },
  ],
  rebus: [
    { question: 'Solve the rebus puzzle!', answer: 'starfish', image: '/rebus-1.png', hint: 'Celestial body + ocean creature' },
    { question: 'Solve the rebus puzzle!', answer: 'buttercup', image: '/rebus-2.png', hint: 'Dairy product + drinking vessel' },
    { question: 'Solve the rebus puzzle!', answer: 'fireman', image: '/rebus-3.png', hint: 'Hot element + human male' },
  ]
};

const ROUND_DURATION_MS = 8_000; // 30s per round
const BETWEEN_ROUND_MS = 10_000; // 10s pause between rounds (result screen)
// Scoring: base points + time bonus
const BASE_POINTS = 100;
const MAX_TIME_BONUS = 200; // maximum bonus if answered instantly

const rooms = new Map<string, Room>();

// Create a four-letter room code.
function genCode(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let codeStr = '';
  for (let i = 0; i < 4; i++) codeStr += letters[Math.floor(Math.random() * letters.length)];
  return codeStr;
}

// Generate a short unique identifier.
function makeId(): string {
  return crypto.randomUUID();
}

const AVATAR_KEYS = [
  'BsRobot', 'SiProbot', 'PiDogFill', 'BiSolidCat', 'MdElderlyWoman', 'MdPregnantWoman',
  'GiPyromaniac', 'TbMichelinBibGourmand', 'TbMoodCrazyHappy', 'GiMonkey', 'GiBatMask',
  'GiSpiderMask', 'GiNinjaHead', 'VscSnake', 'GiSharkBite', 'GiDinosaurRex', 'GiSeaDragon',
  'MdCatchingPokemon', 'GiDirectorChair', 'RiAliensLine', 'GiWitchFlight', 'FaUserAstronaut', 'GiBirdTwitter'
];

// Select a random avatar key for a player.
function pickAvatar() {
  const avatarIndex = Math.floor(Math.random() * AVATAR_KEYS.length);
  const avatarKey = AVATAR_KEYS[avatarIndex];
  // Debug: log chosen avatar (index + key) to help trace avatar assignment
  console.log('pickAvatar ->', { avatarIndex, avatarKey });
  return avatarKey;
}

// Strip socket reference before sending player data over the wire.
function cleanPlayerForWire(player: Player): PlayerWire {
  return { id: player.id, name: player.name, score: player.score, avatar: player.avatar, connected: player.connected };
}

// Emit a typed server message to every participant in a room.
function broadcast(room: Room, msg: ServerMessage) {
  console.log('broadcasting to room', { roomCode: room.code, msg });
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

// Notify lobby participants of the latest lobby state.
function broadcastLobby(room: Room) {
  const payload = {
    type: 'lobby_update',
    roomCode: room.code,
    players: Array.from(room.players.values()).map(cleanPlayerForWire),
    state: room.state,
  };
  broadcast(room, payload);
}

// Safely parse incoming payloads into typed client messages.
function parseClientMessage(msg: ClientMessage | string): ClientMessage | null {
  if (typeof msg === 'string') {
    try {
      const parsed = JSON.parse(msg);
      return parsed as ClientMessage;
    } catch (e) {
      return null;
    }
  }

  if (!msg || typeof msg !== 'object' || !('type' in msg)) {
    return null;
  }

  return msg as ClientMessage;
}

// Compute descending leaderboard for a room.
function leaderboardFor(room: Room) {
  return Array.from(room.players.values())
    .map(cleanPlayerForWire)
    .sort((a, b) => b.score - a.score);
}

// Begin a round, broadcast the question, and arm the round timer.
function startRound(room: Room) {
  const currentRoundIndex = room.roundIndex;
  const pack = PACKS[room.selectedPack] || PACKS['trivia'];
  if (currentRoundIndex >= pack.length) {
    room.state = 'finished';
    broadcast(room, { type: 'final_leaderboard', roomCode: room.code, leaderboard: leaderboardFor(room) });
    return;
  }

  room.state = 'playing';
  room.roundStart = Date.now();
  room.answers = new Map<string, SubmittedAnswer>();
  room.hintsUsed = new Set<string>(); // Reset hints for new round

  const roundEnd = room.roundStart + ROUND_DURATION_MS;
  room.timerEndsAt = roundEnd;
  room.totalQuestionDuration = ROUND_DURATION_MS;

  // Players get state without hint initially
  broadcast(room, {
    type: 'game_state',
    state: 'playing',
    roomCode: room.code,
    roundIndex: currentRoundIndex,
    question: pack[currentRoundIndex].question,
    image: pack[currentRoundIndex].image, // send image URL if available
    hint: pack[currentRoundIndex].hint, // Send hint data to client
    timerEndsAt: roundEnd,
    totalQuestionDuration: ROUND_DURATION_MS,
    answeredPlayers: [],
  });

  room.timers.round = setTimeout(() => endRound(room), ROUND_DURATION_MS);
}

// Finish a round, score answers, and schedule the next phase.
function endRound(room: Room) {
  if (room.timers.round) clearTimeout(room.timers.round);
  const currentRoundIndex = room.roundIndex;
  const pack = PACKS[room.selectedPack] || PACKS['trivia'];
  const correctAnswer = pack[currentRoundIndex].answer.toLowerCase().trim();

  const results: RoundResultEntry[] = [];

  for (const [pid, player] of room.players) {
    const submitted = room.answers.get(pid);
    const hintUsed = room.hintsUsed ? room.hintsUsed.has(pid) : false;

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

        // Halve points if hint was used
        if (hintUsed) {
          points = Math.floor(points / 2);
        }
      }
      player.score = (player.score || 0) + points;
      results.push({ playerId: pid, name: player.name, answer: submitted.answer, correct, timeTaken, points, base, bonus, hintUsed });
    } else {
      results.push({ playerId: pid, name: player.name, answer: null, correct: false, timeTaken: null, points: 0, base: 0, bonus: 0, hintUsed });
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

// Main message dispatcher for all client-to-server traffic.
function handleMessage(socket: TypedSocket, msg: ClientMessage | string) {
  console.log('Received message:', msg);
  const messageObj = parseClientMessage(msg);
  if (!messageObj) {
    socket.emit('server', { type: 'error', message: 'invalid json' });
    return;
  }

  const msgType = messageObj.type;
  const send = (sock: TypedSocket | null | undefined, payload: ServerMessage) => {
    console.log('Sending message:', payload);
    if (sock && sock.connected) sock.emit('server', payload);
  };

  if (msgType === 'create_room') {
    const name = messageObj.name || 'Host';
    const pack = messageObj.pack || 'trivia'; // Default to trivia if not specified
    const code = (() => {
      let newCode = genCode();
      while (rooms.has(newCode)) newCode = genCode();
      return newCode;
    })();

    // Use provided userId if available, otherwise generate new
    const isNewUser = !messageObj.userId;
    const hostId = messageObj.userId || makeId();
    const hostAvatar = isNewUser ? pickAvatar() : messageObj.avatar;
    const room: Room = {
      code,
      players: new Map(),
      state: 'lobby',
      hostId,
      host: { id: hostId, name, socket, avatar: hostAvatar },
      roundIndex: 0,
      timers: {},
      answers: new Map(),
      hintsUsed: new Set(),
      selectedPack: pack,
    };

    rooms.set(code, room);

    socket.data = { roomCode: code, hostId };

    send(socket, { type: 'room_created', roomCode: code, player: { id: hostId, name, score: 0, avatar: hostAvatar, isNewUser } });
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
    // Use provided userId if available, otherwise generate new
    const isNewUser = !messageObj.userId;
    const playerId = messageObj.userId || makeId();
    const playerAvatar = isNewUser ? pickAvatar() : (messageObj.avatar || pickAvatar());

    // Check if player is already continuously reconnecting/rejoining? 
    // For now we just overwrite/update if same ID, or treat as new player.
    // If we want to support reconnection, we might check if player already exists.

    let playerObj = room.players.get(playerId);

    if (playerObj) {
      // Rejoining player
      console.log('Player rejoining:', playerId);
      playerObj.socket = socket;
      playerObj.connected = true;
      // Keep the old name/avatar if rejoining.

    } else {
      // New joiner
      if (room.state !== 'lobby') {
        send(socket, { type: 'error', message: 'room not accepting joins' });
        return;
      }
      playerObj = { id: playerId, name: name || 'Player', socket, score: 0, avatar: playerAvatar, connected: true };
      room.players.set(playerId, playerObj);
    }

    socket.data = { roomCode, playerId };

    // Send joined message
    send(socket, { type: 'joined', roomCode, player: { ...cleanPlayerForWire(playerObj), isNewUser } });

    // If rejoining mid-game, send current state
    if (room.state === 'playing') {
      const currentRoundIndex = room.roundIndex;
      const pack = PACKS[room.selectedPack] || PACKS['trivia'];
      send(socket, {
        type: 'game_state',
        state: 'playing',
        roomCode: room.code,
        roundIndex: currentRoundIndex,
        question: pack[currentRoundIndex].question,
        image: pack[currentRoundIndex].image,
        hint: pack[currentRoundIndex].hint,
        timerEndsAt: room.timerEndsAt || 0,
        totalQuestionDuration: room.totalQuestionDuration || ROUND_DURATION_MS,
        answeredPlayers: Array.from(room.answers.keys()),
      });
    } else if (room.state === 'round_result') {
      // Should probably send last round result... 
      // For simplicity, just sending lobby update + logic on client to show 'result' state might be tricky 
      // without re-sending the 'round_result' payload.
      // Let's re-send round result if possible, or just lobby update.
      // The client handles 'round_result' state in lobby_update, but it needs the 'roundResults' data which comes in 'round_result' message.
      // For now, minimal support: just get them in.
    }

    broadcastLobby(room); // This sends the updated list with 'connected: true'
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

  if (msgType === 'use_hint') {
    const { roomCode, playerId } = messageObj;
    const room = rooms.get(roomCode);
    if (!room || room.state !== 'playing') return;

    // Add player to hints used set
    if (!room.hintsUsed) room.hintsUsed = new Set();
    room.hintsUsed.add(playerId);

    // Notify host so they can show an icon
    try {
      if (room.host && room.host.socket) {
        room.host.socket.emit('server', { type: 'player_hint_used', playerId });
      }
    } catch (e) { }
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
    room.hintsUsed = new Set();
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

    const EXTENSION_MS = 30_000;

    // If we don't have timerEndsAt tracked yet (e.g. server restarted mid-game but memory persisted? unlikely), fallback
    const currentEnd = room.timerEndsAt || (Date.now() + 1000);
    const newEnd = currentEnd + EXTENSION_MS;
    room.timerEndsAt = newEnd;
    room.totalQuestionDuration = (room.totalQuestionDuration || ROUND_DURATION_MS) + EXTENSION_MS;

    // Reschedule
    if (room.timers.round) clearTimeout(room.timers.round);
    const remaining = Math.max(0, newEnd - Date.now());
    room.timers.round = setTimeout(() => endRound(room), remaining);

    console.log(`Timer extended by ${EXTENSION_MS}ms. New end: ${newEnd}`);
    broadcast(room, { type: 'timer_updated', roomCode: room.code, timerEndsAt: newEnd, totalQuestionDuration: room.totalQuestionDuration });
    return;
  }

  if (msgType === 'ping') {
    send(socket, { type: 'pong' });
    return;
  }

  // Add mock players into a room for local/dev testing
  if (msgType === 'mock') {
    const { roomCode } = messageObj as { roomCode?: string };
    const room = roomCode ? rooms.get(roomCode) : null;
    if (!room) return;

    // Add each mock player as a non-connected placeholder player
    for (const mp of mockPlayers) {
      const pid = makeId();
      const player: Player = {
        id: pid,
        name: mp.name,
        score: mp.score || 0,
        avatar: mp.avatar || pickAvatar(),
        socket: ({} as unknown) as TypedSocket,
        connected: true,
      };
      room.players.set(pid, player);
    }

    // Notify everyone in the lobby about the updated players list
    broadcastLobby(room);
    send(socket, { type: 'mock_added', roomCode: room.code });
    return;
  }

  send(socket, { type: 'error', message: 'unknown message type' });
}

const mockPlayers = [
  { id: '1', name: 'Alice', avatar: 'BsRobot', score: 20 },
  { id: '2', name: 'Bob', avatar: 'PiDogFill', score: 15 },
  { id: '3', name: 'Charlie', avatar: 'GiSharkBite', score: 10 },
  { id: '4', name: 'Diana', avatar: 'GiWitchFlight', score: 5 },
];

const io = new IOServer<ClientToServerEvents, ServerToClientEvents, any, SocketData>(server,
  {
    path: '/ws',
    cors: { origin: '*' },
    pingInterval: 2000,
    pingTimeout: 5000,
  });

// Wire Socket.IO connection handlers with typed events.
io.on('connection', (socket: TypedSocket) => {
  // forward client payloads to the shared handler
  if (socket.recovered) {
    console.log('Client reconnected');
  }
  else {
    console.log('Client connected first time');
  }
  socket.on('message', (m: ClientMessage | string) => {
    try {
      handleMessage(socket, m);
    } catch (e) {
      console.error('handleMessage error', e);
      socket.emit('server', { type: 'error', message: 'server error' });
    }
  });

  socket.on('client', (m: ClientMessage | string) => {
    try {
      handleMessage(socket, m);
    } catch (e) {
      console.error('handleMessage error', e);
      socket.emit('server', { type: 'error', message: 'server error' });
    }
  });

  // Cleanup bookkeeping when a socket disconnects.
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    const meta = (socket.data || {}) as { roomCode?: string; playerId?: string; hostId?: string };
    const room = meta.roomCode ? rooms.get(meta.roomCode) : null;
    if (!room) return;

    if (meta.playerId) {
      const p = room.players.get(meta.playerId);
      if (p) {
        p.connected = false;
        console.log('Player disconnected (marked as offline):', meta.playerId);
      }

      // If everyone is gone (disconnected), we might want to clean up EVENTUALLY.
      // But for now, let's keep the room alive if host is there.
      // Check if ALL players + HOST are gone? 

      if (room.players.size === 0 && (!room.host || !room.host.socket || !room.host.socket.connected)) {
        // This condition implies 0 players in map. But we kept them. 
        // So we need to check if all are disconnected.
      }

      // If host is gone and all players are disconnected, maybe cleanup?
      // For now, stick to the request: "do not delete players if they disconnect".

      broadcastLobby(room);
      return;
    }

    if (meta.hostId) {
      const firstKey = room.players.keys().next().value;
      if (firstKey) {
        const promoted = room.players.get(firstKey)!;
        room.hostId = promoted.id;
        room.host = { id: promoted.id, name: promoted.name, socket: promoted.socket, avatar: promoted.avatar };
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
