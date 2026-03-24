# Realtime Migration Test Flows

This document describes the end-to-end flows that should be validated in plain English for the PartyKit migration.

## 1. Host creates a room
Goal: confirm the host can open a game and receive a valid 4-letter room.

Steps:
1. Open the home page.
2. Pick a game from the game library.
3. Wait for the host room page to finish loading.
4. Confirm that a room code appears.
5. Confirm that the host lobby shows a join URL or QR code.

Expected result:
- A room code is generated.
- The host stays in the lobby state.
- No visible error message is shown.

## 2. Player joins an existing room
Goal: confirm a player can join the room from the player page.

Steps:
1. Open the player page in a second browser session.
2. Enter a nickname.
3. Enter the host room code.
4. Submit the join form.
5. Watch both host and player screens.

Expected result:
- The player moves from the join form into the lobby.
- The host sees the player added to the player list.
- No visible error message is shown.

## 3. Host starts the game
Goal: confirm the lobby transitions into an active round.

Steps:
1. Start with one connected player in the lobby.
2. On the host screen, press the start button.
3. Watch both screens.

Expected result:
- The host leaves the lobby and sees the first round.
- The player sees the playable question screen.
- A countdown is visible.

## 4. Player submits an answer
Goal: confirm a player action is accepted and reflected on both screens.

Steps:
1. Start an active round.
2. On the player screen, enter an answer.
3. Submit the answer.
4. Watch for confirmation on the player screen and answered state on the host screen.

Expected result:
- The player sees confirmation that the answer was received.
- The host sees the player as answered.
- The room progresses to round results when the round is complete.

## 5. Timer expiry without answers
Goal: confirm the room still advances when nobody answers.

Steps:
1. Start a round.
2. Do not submit any answers.
3. Wait for the timer to expire.

Expected result:
- The room advances automatically.
- A round result or next state appears without manual intervention.
- The timer behavior is consistent after transition.

## 6. Multi-part round progression
Goal: confirm a multi-part question advances through stages correctly.

Steps:
1. Start a game that contains a multi-part question.
2. Progress until the multi-part round begins.
3. Submit a correct answer for a stage.
4. Watch for the next stage or final result.

Expected result:
- The current part index advances correctly.
- The prompts shown match the current stage.
- The final result screen appears after the last stage.

## 7. Reconnect during an active round
Goal: confirm a reconnecting participant restores current room state.

Steps:
1. Start an active round.
2. Disconnect the player browser tab or session.
3. Re-open the player flow with the same stored identity if possible.
4. Rejoin the same room.

Expected result:
- The player reconnects to the same room.
- The current round state is restored.
- The host sees the player reconnect instead of duplicating a new participant.

## 8. Invalid join or invalid token rejection
Goal: confirm invalid access is rejected cleanly.

Steps:
1. Try to join a room with an invalid room code or invalid session state.
2. Observe the player UI or request result.

Expected result:
- The join attempt fails.
- The user sees a safe error message.
- The room does not become corrupted.

## 9. Upstream content failure on room creation
Goal: confirm room bootstrap handles pack/content failures safely.

Steps:
1. Attempt to create a room when the content source is unavailable or the pack is invalid.
2. Observe the host UI or API result.

Expected result:
- Room creation fails gracefully.
- The user sees a safe error message.
- No partial room is left in a broken visible state.

## 10. Room close and cleanup
Goal: confirm the host can close a room and all participants are updated.

Steps:
1. Start with an active room.
2. On the host screen, close the room.
3. Watch both host and player screens.

Expected result:
- Participants receive a room closed state.
- The player is returned to a safe non-playing state.
- The host room no longer behaves like an active room.

## 11. Idle room expiration
Goal: confirm inactive rooms eventually expire.

Steps:
1. Create a room.
2. Disconnect all participants.
3. Wait for the configured inactivity TTL.
4. Attempt to use the room again.

Expected result:
- The room expires after inactivity.
- Reuse requires a fresh room flow.

## 12. Recovery after worker restart
Goal: confirm a persisted room can recover after runtime restart.

Steps:
1. Start a room and reach an active timer.
2. Restart the realtime worker.
3. Re-open the host or player session.

Expected result:
- The room restores from the persisted checkpoint.
- Timers reconcile correctly.
- The next transition is still correct.

## Suggested execution order
1. Host creates room
2. Player joins room
3. Host starts game
4. Player submits answer
5. Timer expiry without answers
6. Multi-part progression
7. Reconnect during active round
8. Invalid join rejection
9. Upstream content failure
10. Room close and cleanup
11. Idle room expiration
12. Recovery after worker restart