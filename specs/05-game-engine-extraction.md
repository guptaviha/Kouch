# Ticket 05 — Extract the game engine into pure TypeScript modules

## Objective
Move scoring, round transitions, multi-part logic, and room mutation rules out of the transport layer and into a pure domain package.

## Why this ticket exists
The current socket server combines transport concerns, room state storage, timers, scoring, and pack handling in one large file. That makes the migration risky and hard to test. PartyKit works best when message handling is thin and domain logic is isolated.

## Scope
- Create `packages/game-engine`.
- Extract trivia/rebus game progression into pure functions.
- Model commands and state transitions independently of PartyKit.
- Add deterministic tests around scoring and round flow.

## Technical requirements
- Define a single serializable domain state, for example `GameRoomState`.
- Define pure functions such as:
  - `createRoomState()`
  - `addPlayer()`
  - `startGame()`
  - `submitAnswer()`
  - `useHint()`
  - `pauseGame()`
  - `resumeGame()`
  - `extendTimer()`
  - `skipTimer()`
  - `advanceRound()`
  - `closeRoom()`
- Return structured transition results, for example:
  - next state
  - emitted domain events
  - scheduled timer/alarm intents
  - validation errors
- Eliminate direct websocket calls from domain code.
- Eliminate direct `setTimeout` usage from domain code.

## Design notes
A good pattern is:
- `command` enters the room
- room runtime validates participant/session rights
- runtime calls pure reducer or command handler
- reducer returns new state + side effects
- runtime applies side effects using PartyKit primitives

This keeps game logic testable and reusable.

## Migration guidance from current server
Extract and rewrite logic currently embedded in `server/server.ts`:
- room creation defaults
- lobby transitions
- answer submission rules
- multi-part progress tracking
- scoring calculations
- final leaderboard creation
- pause/resume behavior
- timer extension/skip rules

## Deliverables
- `packages/game-engine` with zero framework imports.
- Unit tests for each state transition path.
- Clear mapping from domain events to wire events.

## Acceptance criteria
- Game progression can be tested without spinning up PartyKit or Next.js.
- The PartyKit room runtime becomes a thin orchestration layer.
- Existing trivia and rebus scoring behavior is preserved unless intentionally changed.
- Multi-part question logic is deterministic and typed.

## Dependencies
- Tickets 02, 03, and 04.

## Out of scope
- UI changes.
- Deployment changes.
