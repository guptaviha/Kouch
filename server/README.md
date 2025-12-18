Kouch - Game Server

This folder contains a small standalone Socket.IO game server used by the Kouch app.

Overview
- Socket.IO endpoint (attached to HTTP server): ws://localhost:3001/ws (Socket.IO protocol)
- HTTP: all non-Socket requests are proxied to the Next.js app (default http://localhost:3000)

Run (development)
1. Start the Next.js dev server (default port 3000):
   npm run dev

2. In a second terminal, start the game server:
   npm run dev:server

The server listens on port 3001 by default and proxies HTTP traffic to the Next.js dev server.

Environment variables
- PORT - port where this server listens (default 3001)
- NEXT_TARGET - URL of Next.js server to proxy HTTP requests to (default http://localhost:3000)

Socket.IO protocol (JSON messages)
Client -> Server
- create_room
  { type: 'create_room', name: 'Host name' }
  -> server replies with { type: 'room_created', roomCode, player }

- join
  { type: 'join', roomCode: 'ABCD', name: 'Alice' }
  -> server replies with { type: 'joined', roomCode, player }

- start_game (host only)
  { type: 'start_game', roomCode: 'ABCD', playerId }

- submit_answer
  { type: 'submit_answer', roomCode: 'ABCD', playerId, answer: 'Paris' }

Server -> Client (examples)
- lobby_update: current players and state
- game_state: when a round starts, includes question and timer end timestamp
- round_result: results for the round and current leaderboard
- final_leaderboard: after all rounds

Notes
- The server uses an in-memory store. It's intended for local development and prototyping. For production you'd persist rooms, handle reconnections, and add authentication.
- Questions are hard-coded in `server/server.js` and there are 3 rounds.

Client hint
- Use `socket.io-client` in the browser or React app and listen for `server` events. Emit `message` or `client` events with objects that include a `type` field (e.g. `{ type: 'join', roomCode: 'ABCD', name: 'Alice' }`).
