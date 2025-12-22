import { useGameStore } from '@/lib/store';

// Centralized server message handler. Reads and writes the zustand store directly
// so components/pages don't need to duplicate message parsing logic.
export default function serverMessageHandler(msg: any) {
  if (!msg || !msg.type) return;
  const s = useGameStore.getState();

  const {
    setRoomCode,
    setProfile,
    setShowIntro,
    playAgainPending,
    setPlayAgainPending,
    emit,
    setPlayers,
    setState,
    setCurrentQuestion,
    setQuestionImage,
    setTimerEndsAt,
    setRoundIndex,
    setRoundResults,
    setAnsweredPlayers,
    answeredPlayers,
    setNextTimerDurationMs,
    setPaused,
    setPauseRemainingMs,
    setCountdown,
    setJoined,
    setStatusMessage
  } = s as any;

  try {
    switch (msg.type) {
      case 'room_created':
        setRoomCode?.(msg.roomCode);
        setProfile?.(msg.player);
        setShowIntro?.(false);
        if (playAgainPending) {
          setPlayAgainPending?.(false);
          try {
            emit?.('message', { type: 'start_game', roomCode: msg.roomCode, playerId: msg.player?.id });
          } catch (e) {}
        }
        break;

      case 'lobby_update':
        setPlayers?.(msg.players || []);
        try { setState?.((msg.state || 'lobby')); } catch (e) { setState?.('lobby'); }
        break;

      case 'player_answered': {
        const pid = msg.playerId as string;
        const answered = Array.isArray(answeredPlayers) ? answeredPlayers : [];
        if (!answered.includes(pid)) {
          setAnsweredPlayers?.([...answered, pid]);
        }
        break;
      }

      case 'game_state':
        setState?.('playing');
        setCurrentQuestion?.(msg.question || '');
        setQuestionImage?.(msg.image || null);
        setTimerEndsAt?.(msg.timerEndsAt || null);
        setRoundIndex?.(typeof msg.roundIndex === 'number' ? msg.roundIndex : null);
        setRoundResults?.(null);
        setAnsweredPlayers?.([]);
        break;

      case 'round_result':
        setState?.('round_result');
        setRoundResults?.(msg);
        if (msg.nextTimerEndsAt) setTimerEndsAt?.(msg.nextTimerEndsAt);
        setRoundIndex?.(typeof msg.roundIndex === 'number' ? msg.roundIndex : null);
        if (typeof msg.nextTimerDurationMs === 'number') setNextTimerDurationMs?.(msg.nextTimerDurationMs);
        break;

      case 'final_leaderboard':
        setState?.('finished');
        setRoundResults?.({ final: msg.leaderboard });
        break;

      case 'game_paused':
        setPaused?.(true);
        if (typeof msg.pauseRemainingMs === 'number') {
          setPauseRemainingMs?.(msg.pauseRemainingMs);
          setCountdown?.(Math.max(0, Math.ceil(msg.pauseRemainingMs / 1000)));
        }
        break;

      case 'game_resumed':
        setPaused?.(false);
        if (msg.nextTimerEndsAt) setTimerEndsAt?.(msg.nextTimerEndsAt);
        setPauseRemainingMs?.(null);
        break;

      case 'joined':
        setJoined?.(true);
        setProfile?.(msg.player);
        break;

      case 'answer_received':
        setStatusMessage?.('Answer received');
        break;

      case 'error':
        setStatusMessage?.(msg.message || 'An error occurred');
        break;

      default:
        // unknown message type — ignore
        break;
    }
  } catch (e) {
    // swallow errors in handler to avoid crashing components
    console.error('serverMessageHandler error', e);
  }
}
