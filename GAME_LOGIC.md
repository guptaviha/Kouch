# Game Logic & Business Flow

This document describes the critical business logic and flow for the Kouch app, covering room management, scoring systems, and user journeys.

---

## Table of Contents
- [1. Game Types & Pack Management](#1-game-types--pack-management)
- [2. Room Management](#2-room-management)
- [3. Trivia Scoring](#3-trivia-scoring)
- [4. Rebus Scoring](#4-rebus-scoring)
- [5. User Journey](#5-user-journey)
- [6. Trivia Content Contribution](#6-trivia-content-contribution)

---

## 1. Game Types & Pack Management

### Overview
The Kouch platform supports multiple game types, each with its own pack of questions/puzzles. Packs are displayed together in the Game Library, regardless of game type.

### Supported Game Types

| Game Type | Source | Description |
|-----------|--------|-------------|
| **trivia** | Neon DB | Trivia questions from our database. Includes multiple choice, open-ended, and multi-part questions. |
| **rebus** | Third-Party API | Rebus puzzles from an external API. Visual puzzles where players type answers. |

### Pack Structure

Each pack has the following properties:
- `id`: Unique identifier (number)
- `name`: Pack title
- `description`: Pack description
- `image_url`: Pack thumbnail
- `gameType`: Either 'trivia' or 'rebus'
- `question_ids`: Array of question IDs (trivia only)

### Data Sources

#### Trivia Packs (Database)
- Stored in: `trivia_packs` table in Neon DB
- Questions in: `trivia_questions` table
- Managed via: Admin panel at `/admin/contribute`
- Service: `PackService.getAllPacks()` fetches from database
- Always include `gameType: 'trivia'`

#### Rebus Packs (Third-Party API)
- API Base URL: `https://rebus.games/api/admin`
- Authentication: Header `x-api-key` with value from `REBUS_PACKS_API_SECRET_KEY` env variable
- Endpoints:
  - `GET /packs` - List all packs
  - `GET /packs/{id}` - Get specific pack
  - `GET /packs/{id}/questions` - Get questions for pack
- Service: `RebusService` handles API communication
- Always include `gameType: 'rebus'`

### Pack Service Implementation

The `PackService` class handles both game types:

```typescript
// Get all packs (combines trivia + rebus)
await PackService.getAllPacks()

// Get pack by ID (auto-detects game type if not specified)
await PackService.getPackById(packId)
await PackService.getPackById(packId, 'trivia')
await PackService.getPackById(packId, 'rebus')

// Get questions for pack (auto-detects game type if not specified)
await PackService.getQuestionsForPack(packId)
await PackService.getQuestionsForPack(packId, 'trivia')
await PackService.getQuestionsForPack(packId, 'rebus')
```

### Game Library Display
- All packs (trivia + rebus) are shown together in the Game Library
- Each pack card shows its game type via features badge
- Packs are sorted by most recently updated (trivia) and as returned by API (rebus)
- If rebus API fails, only trivia packs are shown

---

## 2. Room Management

### Overview
A room is the central hub that connects a host (display) with multiple players (controllers). Each room is identified by a unique 4-letter code and has a specific lifecycle.

### Room Creation & Setup
1. **Host initiates**: Host selects a game from the available list
2. **Room generated**: System creates a room with a unique 4-letter alphanumeric code
3. **Code displayed**: Code is shown on the host screen for players to join
4. **Database entry**: Room record is created in the database with initial state

### Room States

| State | Description | Transitions | Players Join? |
|-------|-------------|-------------|---------------|
| **WAITING** | Room created, waiting for players to join | → READY | Yes |
| **READY** | Minimum players (2+) have joined, host can start | → ACTIVE | No |
| **ACTIVE** | Game is in progress | → PAUSED or FINISHED | No |
| **PAUSED** | Game is temporarily paused by host | → ACTIVE or FINISHED | No |
| **FINISHED** | Game has ended, results available | → CLOSED | No |
| **CLOSED** | Room is archived and inactive | (Terminal state) | No |

### Room Lifecycle

```
WAITING
  ↓ (Player joins)
WAITING (repeat until min players)
  ↓ (Min players reached + host starts)
READY
  ↓ (Host presses play)
ACTIVE
  ↓ (Host pauses)
PAUSED
  ↓ (Host resumes or ends game)
ACTIVE / FINISHED
  ↓ (Game ends)
FINISHED
  ↓ (Host closes room / timeout)
CLOSED
```

### Player Join Mechanism
- Players enter the 4-letter room code on their mobile device
- System validates the code against active rooms
- If valid and in WAITING state: Player is added to the room
- Player list is updated in real-time for host and all connected players
- Host can see player names and avatars joining

### Room Timeout & Cleanup
- Rooms in WAITING state auto-close after 30 minutes without activity
- Rooms in ACTIVE state remain open until game completion
- Closed rooms are archived and cannot be rejoined

---

## 3. Trivia Scoring

### Game Structure
Trivia consists of multiple rounds. Each round features one question with multiple choice answers.

### Round Flow

1. **Question Display**: Host displays the question and options
2. **Answer Period**: Players have 30 seconds (default) to select an answer
3. **Submission**: Players submit their answer via the mobile controller
4. **Reveal**: Host reveals the correct answer
5. **Scoring**: Points are calculated and awarded based on answer correctness and speed
6. **Results**: Players see their score and ranking update

### Scoring Mechanics

#### Base Scoring
- **Correct answer**: 100 base points
- **Incorrect answer**: 0 points

#### Speed Bonus
Points are awarded for answering quickly:
- **0-10 seconds**: +50 bonus points (100% bonus)
- **10-20 seconds**: +30 bonus points (30% bonus)
- **20-30 seconds**: +10 bonus points (10% bonus)
- **After 30 seconds**: 0 bonus points (but can still submit for base points)

#### Hint Penalty
- If a player used a hint during the round: -25 points from their final score for that round
- Hint usage is recorded in player state (`used_hint` or `answered_with_hint`)

#### Final Score Formula (per round)
```
Final Score = Base Points + Speed Bonus - Hint Penalty
```

### Rounds & Progression
- Default trivia game has 5 rounds
- Each round increases in difficulty
- Round scores accumulate toward total game score
- Leaderboard updates after each round

### Example Scoring Scenario
| Event | Base | Speed Bonus | Hint Penalty | Round Score |
|-------|------|-------------|--------------|-------------|
| Correct, 8 sec, no hint | 100 | +50 | 0 | **150** |
| Correct, 15 sec, used hint | 100 | +30 | -25 | **105** |
| Incorrect, 5 sec, no hint | 0 | 0 | 0 | **0** |

#### Multi-Part Questions

- Multi-part prompts reveal progressively across sub-rounds (Part 1/3, Part 2/3, etc.), showing all prompts up to the active part.
- Each part uses the normal round timer; hosts can extend the timer per part.
- Scoring rewards early solves: Part 1 = 300 pts, Part 2 = 200 pts, Part 3 = 100 pts, later parts floor at 50 pts. Hint usage halves the awarded points for that question.
- When a player solves in any part, they are locked out from answering later parts of that question, but they keep their awarded score.
- After the final part (or once everyone has solved), the round result screen shows the accumulated scores and leaderboard as usual.

---

## 4. Rebus Scoring

### Game Structure
Rebus consists of multiple rounds. Each round features a visual rebus puzzle that players must solve by typing the answer.

### Round Flow

1. **Puzzle Display**: Host displays the rebus puzzle image
2. **Answer Period**: Players have 45 seconds (default) to solve and type their answer
3. **Submission**: Players submit their typed answer via the mobile controller
4. **Answer Matching**: System checks if answer is correct (exact match or fuzzy matching within threshold)
5. **Reveal**: Host reveals the correct answer if not guessed
6. **Scoring**: Points are calculated based on correctness and speed
7. **Results**: Players see their score and ranking update

### Scoring Mechanics

#### Base Scoring
- **Correct answer**: 100 base points
- **Incorrect answer**: 0 points
- Answer matching uses fuzzy matching to account for minor spelling variations

#### Speed Bonus
Points are awarded for solving quickly:
- **0-15 seconds**: +60 bonus points (60% bonus)
- **15-30 seconds**: +40 bonus points (40% bonus)
- **30-45 seconds**: +20 bonus points (20% bonus)
- **After 45 seconds**: 0 bonus points (but can still submit for base points)

#### Hint Penalty
- If a player used a hint during the round: -30 points from their final score for that round
- Hint usage is recorded in player state (`used_hint` or `answered_with_hint`)

#### First Correct Answer Bonus
- The first player to submit the correct answer receives an additional +25 bonus points
- This only applies once per round

#### Final Score Formula (per round)
```
Final Score = Base Points + Speed Bonus + First Correct Bonus - Hint Penalty
```

### Rounds & Progression
- Default rebus game has 5 rounds
- Each round features a progressively harder rebus puzzle
- Round scores accumulate toward total game score
- Leaderboard updates after each round

### Example Scoring Scenario
| Event | Base | Speed Bonus | First Correct | Hint Penalty | Round Score |
|-------|------|-------------|----------------|--------------|-------------|
| Correct, 10 sec, first to answer, no hint | 100 | +60 | +25 | 0 | **185** |
| Correct, 20 sec, not first, used hint | 100 | +40 | 0 | -30 | **110** |
| Incorrect, 25 sec, no hint | 0 | 0 | 0 | 0 | **0** |

---

## 5. User Journey

### Host Journey

#### Pre-Game Phase
1. **Launch App**: Host opens Kouch on laptop/desktop
2. **Select Game**: Choose between available games (Trivia, Rebus, etc.)
3. **Game Initialized**: Game creates a new room with 4-letter code
4. **Display Code**: Code is prominently displayed on host screen
5. **Wait for Players**: Host waits on lobby screen while players join
6. **Monitor Joins**: Host sees real-time list of joined players with names and avatars
7. **Minimum Threshold**: Once 2+ players join, "Start Game" button becomes active

#### Game Phase
1. **Start Game**: Host presses "Start Game" button
2. **Round Begins**: First question/puzzle is displayed on host screen
3. **Question/Puzzle Display**: Large, clear display for all to see
4. **Answer Period**: Timer counts down (30-45 seconds depending on game)
5. **Player Submissions**: Host sees which players have answered in real-time
6. **Pause Option**: Host can pause the game at any time
7. **Reveal Answer**: Host reveals correct answer and scores update
8. **Next Round**: Host advances to next round
9. **Repeat**: Steps 2-8 repeat for each round

#### Post-Game Phase
1. **Final Results**: Game ends after all rounds complete
2. **Leaderboard Display**: Final rankings with scores displayed
3. **Winner Highlighted**: Top player shown with special styling
4. **Options**: Host can:
   - Close room (end session)
   - Start new game in same room
   - Export results

### Player Journey

#### Join Phase
1. **Open App**: Player opens Kouch on mobile device
2. **Enter Room Code**: Player sees input screen to enter 4-letter room code
3. **Validate Code**: System checks if room exists and is in WAITING state
4. **Join Success**: Player enters game lobby
5. **Create Profile**: Player enters display name and selects avatar icon
6. **Confirm**: Player joins and sees lobby screen with other players

#### Lobby Phase
1. **Wait for Host**: Player sees list of other players who have joined
2. **See Game Info**: Player knows which game they're about to play
3. **Ready Screen**: Player waits for host to press "Start Game"
4. **Gentle Animation**: Player avatar has subtle bounce animation while waiting

#### Game Phase - Each Round
1. **Question/Puzzle Displayed**: Large display of question or puzzle
2. **Player Responds**:
   - **Trivia**: Select from multiple choice options
   - **Rebus**: Type answer in text input field
3. **Submission Options**:
   - Submit answer to lock it in
   - Request hint (if available, causes state change to `used_hint` or `answered_with_hint`)
   - Change answer until time expires
4. **Answer Locked**: Once submitted or time expires, answer is locked
5. **Answer Revealed**: Host reveals correct answer
6. **Score Update**: Player sees their round score and updated leaderboard position
7. **Feedback**: Visual indication if answer was correct/incorrect
8. **Repeat**: Advance to next round (steps 1-7 repeat)

#### Post-Game Phase
1. **Game Ends**: After final round, game completion screen shown
2. **Final Score**: Player sees their final score and position
3. **Results View**: Player can see full leaderboard of all players
4. **Share Option**: Player can optionally share their performance
5. **Leave Room**: Player can disconnect and return to home screen or join another room

### Real-Time Connection
- All player actions are sent via WebSocket to server
- Server broadcasts relevant updates to host and other players in real-time
- Leaderboard updates immediately after each round scores are calculated
- Player states (idle, active, waiting, answered, used_hint, answered_with_hint) are reflected visually on host

---

## 6. Trivia Content Contribution

- Admin-only flow at `/admin/contribute` creates trivia questions, tags, and packs without a separate trivia database.
- Questions support `multiple_choice` (ordered choices with a single correct index), `open_ended` (multiple accepted answers), and `multi_part` (2-4 parts, each with its own prompt, accepted answers, and optional image). Clues remain optional; labels were removed.
- Each question has a `difficulty` slider (1-5, default 3) and an optional image at the question level. Images selected in the UI are stored with a placeholder URL until S3 upload is implemented.
- Tags are suggested from existing entries; new tags entered on a question are auto-created and attached. Tags are normalized to lowercase for reuse.
- Packs are ordered sets of questions; at least one question is required when creating a pack so hosts can run complete rounds.
- Every record (tags, questions, packs, and their links) carries `created_at`, `updated_at`, and `user_id` metadata, defaulting to `admin` for now.

---

## Summary

- **Rooms** manage the lifecycle of a game session with clear state transitions
- **Trivia** scoring emphasizes speed with a 30-second window and hint penalties
- **Rebus** scoring rewards puzzle-solving speed over a 45-second period with a first-to-answer bonus
- **Host** controls the game flow and monitors all player activity in real-time
- **Players** submit answers, use hints strategically, and see their position update continuously
- Both scoring systems use a formula: Base Points + Speed Bonus + Bonuses - Penalties
