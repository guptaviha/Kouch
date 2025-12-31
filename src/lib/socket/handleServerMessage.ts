import { useGameStore } from '@/lib/store';
import { ServerMessage, PlayerWire } from '@/types/socket';
import { GamePack, isValidGame } from '@/types/games';
import { toast } from '@/hooks/use-toast';

import { setStorageItem } from '@/hooks/use-local-storage';

// Centralized server message handler. Reads and writes the zustand store directly
// so components/pages don't need to duplicate message parsing logic.
export default function serverMessageHandler(msg: ServerMessage) {
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
    setSelectedPack,
    setPlayersWithHints,
    setAnswer,
    setHintUsed,
  } = s;

  const resetStateForNewRoom = () => {
    setState?.('lobby');
    setPlayers?.([]);
    setCurrentQuestion?.('');
    setQuestionImage?.(null);
    setCurrentHint?.(undefined);
    setTimerEndsAt?.(null);
    setTotalQuestionDuration?.(null);
    setRoundIndex?.(null);
    setRoundResults?.(null);
    setAnsweredPlayers?.([]);
    setPlayersWithHints?.([]);
    setNextTimerDurationMs?.(null);
    setPaused?.(false);
    setPauseRemainingMs?.(null);
    setCountdown?.(0);
    setJoined?.(false);
    setStatusMessage?.(null);
    setSubmitted?.(false);
    setHintUsed?.(false);
    setAnswer?.('');
  };

  try {
    switch (msg.type) {
      case 'room_created':
        if (!msg.reused) {
          resetStateForNewRoom();
        }
        if (msg.pack && isValidGame(msg.pack)) {
          console.log('Setting selected pack', msg.pack);
          setSelectedPack?.(msg.pack as GamePack);
        }
        setRoomCode?.(msg.roomCode);
        setProfile?.(msg.player);
        if (Array.isArray(msg.players)) {
          setPlayers?.(msg.players);
        }
        if (msg.state) {
          setState?.(msg.state as any);
        }
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

        // Notify about disconnects/reconnects if we have previous players
        const currentPlayers = s.players as PlayerWire[];
        const newPlayers = msg.players || [];

        // Create a map for easier lookup
        const newPlayerMap = new Map(newPlayers.map(p => [p.id, p]));

        // Check for newly disconnected
        currentPlayers.forEach(p => {
          const newP = newPlayerMap.get(p.id);
          if (p.connected !== false && newP && newP.connected === false) {
            toast({
              variant: "destructive",
              title: "Player Disconnected",
              description: `${p.name} has lost connection.`,
            });
          }
        });

        // Check for newly connected (reconnected)
        newPlayers.forEach(p => {
          const oldP = currentPlayers.find(op => op.id === p.id);
          if ((!oldP || oldP.connected === false) && p.connected !== false) {
            // Only toast if it's a reconnection of a known player or if we want to toast all joins?
            // Maybe too noisy for lobby joins, but good for game re-joins.
            // Let's toast if they were previously disconnected.
            if (oldP && oldP.connected === false) {
              toast({
                title: "Player Reconnected",
                description: `${p.name} is back!`,
                className: "bg-green-500 text-white border-none",
              });
            }
          }
        });

        setPlayers?.(msg.players || []);
        try { setState?.((msg.state || 'lobby')); } catch (e) { setState?.('lobby'); console.error('lobby_update error', e); }
        break;

      case 'player_answered': {
        const pid = msg.playerId as string;
        const answered = Array.isArray(answeredPlayers) ? answeredPlayers : [];
        if (!answered.includes(pid)) {
          setAnsweredPlayers?.([...answered, pid]);
        }

        // If WE are the one who answered, update our status
        if (s.profile?.id === pid) {
          setStatusMessage?.('Answer received');
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
        setAnsweredPlayers?.(msg.answeredPlayers || []);
        // Reset playersWithHints for new round
        if (s.setPlayersWithHints) s.setPlayersWithHints([]);
        if (s.setHintUsed) s.setHintUsed(false);
        setSubmitted?.(false);

        // If we are rejoining and have already answered
        if (msg.answeredPlayers && s.profile?.id && msg.answeredPlayers.includes(s.profile.id)) {
          setStatusMessage?.('Answer received');
          setSubmitted?.(true);
        }
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

      case 'room_closed': {
        resetStateForNewRoom();
        setRoomCode?.(null);
        setSelectedPack?.(null);
        const reason = msg.reason || 'The host closed the room.';
        toast({
          variant: 'destructive',
          title: 'Room closed',
          description: reason,
        });
        break;
      }

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
        if (msg.player?.id && msg.player?.avatar && msg.player?.isNewUser) {
          setStorageItem('kouch_userId', msg.player.id);
          setStorageItem('kouch_userAvatar', msg.player.avatar);
        }
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
