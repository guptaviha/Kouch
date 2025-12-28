import { useGameStore } from '@/lib/store';

import { setStorageItem } from '@/hooks/use-local-storage';

// Centralized server message handler. Reads and writes the zustand store directly
// so components/pages don't need to duplicate message parsing logic.
export default function serverMessageHandler(msg: any) {
  if (!msg || !msg.type) return;
  const s = useGameStore.getState();

  const {
    setRoomCode,
    setProfile,
    playAgainPending,
    setPlayAgainPending,
    emit,
    setPlayers,
    setState,
    setCurrentQuestion,
    setCurrentHint,
    setQuestionImage,
    setTimerEndsAt,
    setTotalQuestionDuration,
    setRoundIndex,
    setRoundResults,
    setAnsweredPlayers,
    answeredPlayers,
    setNextTimerDurationMs,
    setPaused,
    setPauseRemainingMs,
    setCountdown,
    setJoined,
    setStatusMessage,
    setSubmitted,
  } = s;

  try {
    switch (msg.type) {
      case 'room_created':
        setRoomCode?.(msg.roomCode);
        setProfile?.(msg.player);
        // Save host ID to localStorage
        if (msg.player?.id && msg.player?.avatar && msg.player?.isNewUser) {
          setStorageItem('kouch_userId', msg.player.id);
          setStorageItem('kouch_userAvatar', msg.player.avatar);
        }
        if (playAgainPending) {
          setPlayAgainPending?.(false);
          try {
            emit?.('message', { type: 'start_game', roomCode: msg.roomCode, playerId: msg.player?.id });
          } catch (e) { }
        }
        break;

      case 'lobby_update':
        console.log('lobby_update', msg);
        setPlayers?.(msg.players || []);
        try { setState?.((msg.state || 'lobby')); } catch (e) { setState?.('lobby'); console.error('lobby_update error', e); }
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
        setCurrentHint?.(msg.hint || undefined); // Update current hint
        setTimerEndsAt?.(msg.timerEndsAt || null);
        if (msg.totalQuestionDuration) setTotalQuestionDuration?.(msg.totalQuestionDuration);
        setRoundIndex?.(typeof msg.roundIndex === 'number' ? msg.roundIndex : null);
        setRoundResults?.(null);
        setAnsweredPlayers?.([]);
        // Reset playersWithHints for new round
        if (s.setPlayersWithHints) s.setPlayersWithHints([]);
        if (s.setHintUsed) s.setHintUsed(false);
        setSubmitted?.(false);
        break;

      case 'player_hint_used': {
        const pid = msg.playerId as string;
        const withHints = s.playersWithHints || [];
        if (!withHints.includes(pid) && s.setPlayersWithHints) {
          s.setPlayersWithHints([...withHints, pid]);
        }
        break;
      }


      case 'round_result':
        setStatusMessage?.('');
        setState?.('round_result');
        setRoundResults?.(msg);
        if (msg.nextTimerEndsAt) setTimerEndsAt?.(msg.nextTimerEndsAt);
        setRoundIndex?.(typeof msg.roundIndex === 'number' ? msg.roundIndex : null);
        if (typeof msg.nextTimerDurationMs === 'number') setNextTimerDurationMs?.(msg.nextTimerDurationMs);
        break;

      case 'final_leaderboard':
        setStatusMessage?.('');
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

      case 'timer_updated':
        if (msg.timerEndsAt) setTimerEndsAt?.(msg.timerEndsAt);
        if (msg.totalQuestionDuration) setTotalQuestionDuration?.(msg.totalQuestionDuration);
        break;

      case 'joined':
        setJoined?.(true);
        setProfile?.(msg.player);
        // Save player ID to localStorage
        if (msg.player?.id) setStorageItem('kouch_userId', msg.player.id);
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
