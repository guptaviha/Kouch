import type {
  ParticipantRole,
  QuestionType,
  RoomPhase,
  RoundResultEntry,
} from '@kouch/contracts';
import type { RoomPackDefinition } from '@kouch/game-content';

export const DEFAULT_ROUND_DURATION_MS = 30_000;
export const DEFAULT_ROUND_RESULT_DURATION_MS = 10_000;
export const DEFAULT_TIMER_EXTENSION_MS = 10_000;
export const BASE_POINTS = 100;
export const MAX_TIME_BONUS = 200;
export const MULTI_PART_POINTS = [300, 200, 100] as const;

export type StoredAnswer = {
  answer: string;
  submittedAt: number;
};

export type MultiPartProgressEntry = {
  solvedPart?: number;
  solvedAnswer?: string;
  solvedTime?: number;
  pointsAwarded?: number;
  lastAttempt?: {
    partIndex: number;
    answer: string;
    timeTaken: number;
  };
};

export type GameParticipant = {
  participantId: string;
  role: ParticipantRole;
  displayName: string;
  avatar?: string;
  score: number;
  joinedAt: number;
  lastSeenAt: number;
};

export type GameRoundResultState = {
  roundIndex: number;
  results: RoundResultEntry[];
  correctAnswer: string;
  nextTimerEndsAt: number;
  nextTimerDurationMs: number;
};

export type GameRoundState = {
  roundIndex: number | null;
  startedAt: number | null;
  currentPartIndex: number | null;
  totalParts: number | null;
  timerEndsAt: number | null;
  totalQuestionDuration: number | null;
  pauseRemainingMs: number | null;
  answeredParticipantIds: string[];
  hintParticipantIds: string[];
  answers: Record<string, StoredAnswer>;
  multiPartProgress: Record<string, MultiPartProgressEntry>;
  lastResult: GameRoundResultState | null;
};

export type GameRoomState = {
  roomCode: string;
  protocolVersion: number;
  stateVersion: number;
  phase: RoomPhase;
  hostParticipantId?: string;
  participants: GameParticipant[];
  selectedPack?: string;
  packDefinition?: RoomPackDefinition;
  createdAt: number;
  updatedAt: number;
  closedAt?: number;
  closeReason?: string;
  round: GameRoundState;
};

export type GameRoundView = {
  roundIndex: number;
  currentPartIndex: number | null;
  totalParts: number | null;
  question: string;
  questionType: QuestionType;
  prompts?: string[];
  promptImages?: Array<string | null> | null;
  image?: string | null;
  hint?: string;
  timerEndsAt: number;
  totalQuestionDuration: number;
  answeredParticipantIds: string[];
};

export type GameEngineEvent =
  | { type: 'lobby_updated' }
  | { type: 'round_started'; round: GameRoundView }
  | { type: 'round_result_ready'; result: GameRoundResultState }
  | { type: 'game_finished' }
  | { type: 'game_paused'; pauseRemainingMs: number }
  | { type: 'game_resumed'; nextTimerEndsAt: number }
  | { type: 'timer_updated'; timerEndsAt: number; totalQuestionDuration: number }
  | { type: 'player_answered'; playerId: string; roundIndex: number }
  | { type: 'player_hint_used'; playerId: string }
  | { type: 'room_closed'; reason: string };

export type TimerIntent = {
  type: 'set-alarm';
  at: number | null;
};

export type GameEngineErrorCode =
  | 'HOST_ALREADY_ASSIGNED'
  | 'PARTICIPANT_ROLE_MISMATCH'
  | 'PARTICIPANT_NOT_FOUND'
  | 'PACK_NOT_READY'
  | 'INVALID_PHASE'
  | 'ALREADY_ANSWERED'
  | 'ALREADY_SOLVED'
  | 'NO_ACTIVE_TIMER';

export type GameEngineError = {
  code: GameEngineErrorCode;
  message: string;
};

export type GameTransitionResult = {
  ok: boolean;
  state: GameRoomState;
  events: GameEngineEvent[];
  timerIntent?: TimerIntent;
  error?: GameEngineError;
};

export type CreateRoomStateInput = {
  roomCode: string;
  protocolVersion: number;
  now: number;
  selectedPack?: string;
  packDefinition?: RoomPackDefinition;
};

export type UpsertParticipantInput = {
  participantId: string;
  role: ParticipantRole;
  displayName: string;
  avatar?: string;
  now: number;
};

export type ConfigureRoomInput = {
  hostParticipantId?: string;
  selectedPack?: string;
  packDefinition?: RoomPackDefinition;
  now: number;
};

export type StartGameInput = {
  now: number;
  roundDurationMs?: number;
};

export type SubmitAnswerInput = {
  participantId: string;
  answer: string;
  now: number;
  roundDurationMs?: number;
  roundResultDurationMs?: number;
};

export type UseHintInput = {
  participantId: string;
  now: number;
};

export type PauseGameInput = {
  now: number;
};

export type ResumeGameInput = {
  now: number;
};

export type ExtendTimerInput = {
  now: number;
  extensionMs?: number;
};

export type AdvanceRoundInput = {
  now: number;
  roundDurationMs?: number;
  roundResultDurationMs?: number;
};

export type CloseRoomInput = {
  now: number;
  reason: string;
};

export type ResetGameInput = {
  now: number;
};

function cloneRoundResult(result: GameRoundResultState | null): GameRoundResultState | null {
  if (!result) {
    return null;
  }

  return {
    ...result,
    results: result.results.map((entry) => ({ ...entry })),
  };
}

function cloneState(state: GameRoomState): GameRoomState {
  return {
    ...state,
    participants: state.participants.map((participant) => ({ ...participant })),
    round: {
      ...state.round,
      answeredParticipantIds: [...state.round.answeredParticipantIds],
      hintParticipantIds: [...state.round.hintParticipantIds],
      answers: Object.fromEntries(
        Object.entries(state.round.answers).map(([participantId, answer]) => [participantId, { ...answer }]),
      ),
      multiPartProgress: Object.fromEntries(
        Object.entries(state.round.multiPartProgress).map(([participantId, progress]) => [
          participantId,
          {
            ...progress,
            lastAttempt: progress.lastAttempt ? { ...progress.lastAttempt } : undefined,
          },
        ]),
      ),
      lastResult: cloneRoundResult(state.round.lastResult),
    },
  };
}

function success(
  state: GameRoomState,
  events: GameEngineEvent[] = [],
  timerIntent?: TimerIntent,
): GameTransitionResult {
  return {
    ok: true,
    state,
    events,
    timerIntent,
  };
}

function failure(state: GameRoomState, code: GameEngineErrorCode, message: string): GameTransitionResult {
  return {
    ok: false,
    state,
    events: [],
    error: { code, message },
  };
}

function bumpState(state: GameRoomState, now: number): GameRoomState {
  state.stateVersion += 1;
  state.updatedAt = now;
  return state;
}

function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase();
}

function getQuestion(state: GameRoomState) {
  if (state.round.roundIndex == null) {
    return undefined;
  }

  return state.packDefinition?.questions[state.round.roundIndex];
}

function getTotalParts(question: NonNullable<ReturnType<typeof getQuestion>>): number {
  if (Array.isArray(question.prompts) && question.prompts.length > 0) {
    return question.prompts.length;
  }

  return 1;
}

function multiPartPointsFor(partIndex: number): number {
  if (MULTI_PART_POINTS[partIndex] != null) {
    return MULTI_PART_POINTS[partIndex];
  }

  const last = MULTI_PART_POINTS[MULTI_PART_POINTS.length - 1];
  return Math.max(50, last - (partIndex - MULTI_PART_POINTS.length + 1) * 25);
}

function leaderboard(state: GameRoomState): GameParticipant[] {
  return state.participants
    .filter((participant) => participant.role === 'player')
    .map((participant) => ({ ...participant }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.joinedAt - right.joinedAt;
    });
}

function getActivePlayers(state: GameRoomState): GameParticipant[] {
  return state.participants.filter((participant) => participant.role === 'player');
}

function buildRoundView(state: GameRoomState): GameRoundView | null {
  const question = getQuestion(state);
  if (!question || state.round.roundIndex == null || state.round.timerEndsAt == null || state.round.totalQuestionDuration == null) {
    return null;
  }

  const prompts = question.questionType === 'multi_part'
    ? question.prompts?.slice(0, Math.min((state.round.currentPartIndex ?? 0) + 1, question.prompts.length))
    : question.prompts;

  const answeredParticipantIds = question.questionType === 'multi_part'
    ? Object.entries(state.round.multiPartProgress)
      .filter(([, progress]) => progress.solvedPart !== undefined)
      .map(([participantId]) => participantId)
    : state.round.answeredParticipantIds;

  return {
    roundIndex: state.round.roundIndex,
    currentPartIndex: state.round.currentPartIndex,
    totalParts: state.round.totalParts,
    question: question.question,
    questionType: question.questionType,
    prompts,
    promptImages: question.promptImages,
    image: question.image,
    hint: question.hint,
    timerEndsAt: state.round.timerEndsAt,
    totalQuestionDuration: state.round.totalQuestionDuration,
    answeredParticipantIds,
  };
}

function startRoundState(
  state: GameRoomState,
  roundIndex: number,
  now: number,
  roundDurationMs: number,
): GameTransitionResult {
  const question = state.packDefinition?.questions[roundIndex];
  if (!question) {
    state.phase = 'finished';
    state.round = {
      ...state.round,
      roundIndex,
      startedAt: null,
      currentPartIndex: null,
      totalParts: null,
      timerEndsAt: null,
      totalQuestionDuration: null,
      pauseRemainingMs: null,
      answeredParticipantIds: [],
      hintParticipantIds: [],
      answers: {},
      multiPartProgress: {},
      lastResult: null,
    };
    bumpState(state, now);
    return success(state, [{ type: 'game_finished' }], { type: 'set-alarm', at: null });
  }

  state.phase = 'playing';
  state.round = {
    roundIndex,
    startedAt: now,
    currentPartIndex: question.questionType === 'multi_part' ? 0 : null,
    totalParts: question.questionType === 'multi_part' ? getTotalParts(question) : null,
    timerEndsAt: now + roundDurationMs,
    totalQuestionDuration: roundDurationMs,
    pauseRemainingMs: null,
    answeredParticipantIds: [],
    hintParticipantIds: [],
    answers: {},
    multiPartProgress: question.questionType === 'multi_part' ? {} : {},
    lastResult: null,
  };
  bumpState(state, now);

  const round = buildRoundView(state);
  return success(
    state,
    round ? [{ type: 'round_started', round }] : [],
    { type: 'set-alarm', at: state.round.timerEndsAt },
  );
}

function buildNonMultiPartResults(
  state: GameRoomState,
  roundDurationMs: number,
): RoundResultEntry[] {
  const question = getQuestion(state);
  if (!question) {
    return [];
  }

  const correctAnswers = question.answers.map(normalizeAnswer);
  const players = getActivePlayers(state);
  const results = players.map((player) => {
    const submission = state.round.answers[player.participantId];
    const hintUsed = state.round.hintParticipantIds.includes(player.participantId);

    if (!submission || state.round.startedAt == null) {
      return {
        playerId: player.participantId,
        name: player.displayName,
        answer: null,
        correct: false,
        timeTaken: null,
        points: 0,
        base: 0,
        bonus: 0,
        hintUsed,
      } satisfies RoundResultEntry;
    }

    const normalizedAnswer = normalizeAnswer(submission.answer);
    const correct = correctAnswers.includes(normalizedAnswer);
    const timeTaken = submission.submittedAt - state.round.startedAt;
    let base = 0;
    let bonus = 0;
    let points = 0;

    if (correct) {
      base = BASE_POINTS;
      bonus = Math.max(0, Math.round(MAX_TIME_BONUS * (1 - timeTaken / roundDurationMs)));
      points = base + bonus;
      if (hintUsed) {
        points = Math.floor(points / 2);
      }

      const participant = state.participants.find((candidate) => candidate.participantId === player.participantId);
      if (participant) {
        participant.score += points;
      }
    }

    return {
      playerId: player.participantId,
      name: player.displayName,
      answer: submission.answer,
      correct,
      timeTaken,
      points,
      base,
      bonus,
      hintUsed,
    } satisfies RoundResultEntry;
  });

  results.sort((left, right) => {
    if (left.correct === right.correct) {
      if (left.timeTaken == null) return 1;
      if (right.timeTaken == null) return -1;
      return left.timeTaken - right.timeTaken;
    }

    return left.correct ? -1 : 1;
  });

  return results;
}

function evaluateMultiPartStage(state: GameRoomState): void {
  const question = getQuestion(state);
  if (!question || question.questionType !== 'multi_part') {
    return;
  }

  const partIndex = state.round.currentPartIndex ?? 0;
  const correctAnswers = question.answers.map(normalizeAnswer);

  for (const player of getActivePlayers(state)) {
    const existingProgress = state.round.multiPartProgress[player.participantId] ?? {};
    if (existingProgress.solvedPart !== undefined) {
      state.round.multiPartProgress[player.participantId] = existingProgress;
      continue;
    }

    const submission = state.round.answers[player.participantId];
    if (!submission || state.round.startedAt == null) {
      state.round.multiPartProgress[player.participantId] = existingProgress;
      continue;
    }

    const timeTaken = submission.submittedAt - state.round.startedAt;
    existingProgress.lastAttempt = {
      partIndex,
      answer: submission.answer,
      timeTaken,
    };

    const isCorrect = correctAnswers.includes(normalizeAnswer(submission.answer));
    if (!isCorrect) {
      state.round.multiPartProgress[player.participantId] = existingProgress;
      continue;
    }

    let points = multiPartPointsFor(partIndex);
    if (state.round.hintParticipantIds.includes(player.participantId)) {
      points = Math.floor(points / 2);
    }

    existingProgress.solvedPart = partIndex;
    existingProgress.solvedAnswer = submission.answer;
    existingProgress.solvedTime = timeTaken;
    existingProgress.pointsAwarded = points;
    player.score += points;
    state.round.multiPartProgress[player.participantId] = existingProgress;
  }
}

function buildMultiPartResults(state: GameRoomState): RoundResultEntry[] {
  const players = getActivePlayers(state);
  const results = players.map((player) => {
    const progress = state.round.multiPartProgress[player.participantId] ?? {};
    const hintUsed = state.round.hintParticipantIds.includes(player.participantId);

    if (progress.solvedPart !== undefined) {
      const points = progress.pointsAwarded ?? multiPartPointsFor(progress.solvedPart);
      return {
        playerId: player.participantId,
        name: player.displayName,
        answer: progress.solvedAnswer ?? progress.lastAttempt?.answer ?? null,
        correct: true,
        timeTaken: progress.solvedTime ?? progress.lastAttempt?.timeTaken ?? null,
        points,
        base: points,
        bonus: 0,
        hintUsed,
      } satisfies RoundResultEntry;
    }

    return {
      playerId: player.participantId,
      name: player.displayName,
      answer: progress.lastAttempt?.answer ?? null,
      correct: false,
      timeTaken: progress.lastAttempt?.timeTaken ?? null,
      points: 0,
      base: 0,
      bonus: 0,
      hintUsed,
    } satisfies RoundResultEntry;
  });

  results.sort((left, right) => {
    if (left.correct === right.correct) {
      if (left.timeTaken == null) return 1;
      if (right.timeTaken == null) return -1;
      return left.timeTaken - right.timeTaken;
    }

    return left.correct ? -1 : 1;
  });

  return results;
}

function finalizeCurrentRound(
  state: GameRoomState,
  now: number,
  roundResultDurationMs: number,
): GameTransitionResult {
  const question = getQuestion(state);
  if (!question || state.round.roundIndex == null) {
    return failure(state, 'INVALID_PHASE', 'No active round to complete');
  }

  if (question.questionType === 'multi_part') {
    evaluateMultiPartStage(state);
    const totalParts = state.round.totalParts ?? getTotalParts(question);
    const everyoneSolved = getActivePlayers(state).length > 0
      && getActivePlayers(state).every((player) => state.round.multiPartProgress[player.participantId]?.solvedPart !== undefined);

    if (!everyoneSolved && (state.round.currentPartIndex ?? 0) + 1 < totalParts) {
      const nextPartIndex = (state.round.currentPartIndex ?? 0) + 1;
      state.phase = 'playing';
      state.round.startedAt = now;
      state.round.currentPartIndex = nextPartIndex;
      state.round.totalParts = totalParts;
      state.round.timerEndsAt = now + DEFAULT_ROUND_DURATION_MS;
      state.round.totalQuestionDuration = DEFAULT_ROUND_DURATION_MS;
      state.round.pauseRemainingMs = null;
      state.round.answeredParticipantIds = Object.entries(state.round.multiPartProgress)
        .filter(([, progress]) => progress.solvedPart !== undefined)
        .map(([participantId]) => participantId);
      state.round.answers = {};
      state.round.lastResult = null;
      bumpState(state, now);
      const round = buildRoundView(state);
      return success(
        state,
        round ? [{ type: 'round_started', round }] : [],
        { type: 'set-alarm', at: state.round.timerEndsAt },
      );
    }
  }

  const results = question.questionType === 'multi_part'
    ? buildMultiPartResults(state)
    : buildNonMultiPartResults(state, state.round.totalQuestionDuration ?? DEFAULT_ROUND_DURATION_MS);

  state.phase = 'round_result';
  state.round.timerEndsAt = now + roundResultDurationMs;
  state.round.totalQuestionDuration = roundResultDurationMs;
  state.round.pauseRemainingMs = null;
  state.round.lastResult = {
    roundIndex: state.round.roundIndex,
    results,
    correctAnswer: question.answers[0] ?? '',
    nextTimerEndsAt: state.round.timerEndsAt,
    nextTimerDurationMs: roundResultDurationMs,
  };
  state.round.answers = question.questionType === 'multi_part' ? {} : state.round.answers;
  bumpState(state, now);

  return success(
    state,
    [{ type: 'round_result_ready', result: state.round.lastResult }],
    { type: 'set-alarm', at: state.round.timerEndsAt },
  );
}

export function createRoomState(input: CreateRoomStateInput): GameRoomState {
  return {
    roomCode: input.roomCode,
    protocolVersion: input.protocolVersion,
    stateVersion: 0,
    phase: 'lobby',
    participants: [],
    selectedPack: input.selectedPack,
    packDefinition: input.packDefinition,
    createdAt: input.now,
    updatedAt: input.now,
    round: {
      roundIndex: null,
      startedAt: null,
      currentPartIndex: null,
      totalParts: null,
      timerEndsAt: null,
      totalQuestionDuration: null,
      pauseRemainingMs: null,
      answeredParticipantIds: [],
      hintParticipantIds: [],
      answers: {},
      multiPartProgress: {},
      lastResult: null,
    },
  };
}

export function configureRoom(state: GameRoomState, input: ConfigureRoomInput): GameTransitionResult {
  const nextState = cloneState(state);
  nextState.hostParticipantId = input.hostParticipantId ?? nextState.hostParticipantId;
  nextState.selectedPack = input.selectedPack ?? nextState.selectedPack;
  nextState.packDefinition = input.packDefinition ?? nextState.packDefinition;
  bumpState(nextState, input.now);
  return success(nextState, [{ type: 'lobby_updated' }]);
}

export function upsertParticipant(state: GameRoomState, input: UpsertParticipantInput): GameTransitionResult {
  const nextState = cloneState(state);
  const existing = nextState.participants.find((participant) => participant.participantId === input.participantId);

  if (existing && existing.role !== input.role) {
    return failure(nextState, 'PARTICIPANT_ROLE_MISMATCH', 'Participant role mismatch');
  }

  if (input.role === 'host' && nextState.hostParticipantId && nextState.hostParticipantId !== input.participantId) {
    return failure(nextState, 'HOST_ALREADY_ASSIGNED', 'Host already assigned for this room');
  }

  if (existing) {
    existing.displayName = input.displayName || existing.displayName;
    existing.avatar = input.avatar ?? existing.avatar;
    existing.lastSeenAt = input.now;
  } else {
    nextState.participants.push({
      participantId: input.participantId,
      role: input.role,
      displayName: input.displayName,
      avatar: input.avatar,
      score: 0,
      joinedAt: input.now,
      lastSeenAt: input.now,
    });
  }

  if (input.role === 'host') {
    nextState.hostParticipantId = input.participantId;
  }

  bumpState(nextState, input.now);
  return success(nextState, [{ type: 'lobby_updated' }]);
}

export function addPlayer(state: GameRoomState, input: Omit<UpsertParticipantInput, 'role'>): GameTransitionResult {
  return upsertParticipant(state, {
    ...input,
    role: 'player',
  });
}

export function startGame(state: GameRoomState, input: StartGameInput): GameTransitionResult {
  const nextState = cloneState(state);
  if (!nextState.packDefinition?.questions.length) {
    return failure(nextState, 'PACK_NOT_READY', 'No playable pack is loaded for this room');
  }

  return startRoundState(nextState, 0, input.now, input.roundDurationMs ?? DEFAULT_ROUND_DURATION_MS);
}

export function submitAnswer(state: GameRoomState, input: SubmitAnswerInput): GameTransitionResult {
  const nextState = cloneState(state);
  if (nextState.phase !== 'playing' || nextState.round.roundIndex == null) {
    return failure(nextState, 'INVALID_PHASE', 'Answers are only accepted during an active round');
  }

  const participant = nextState.participants.find((candidate) => candidate.participantId === input.participantId && candidate.role === 'player');
  if (!participant) {
    return failure(nextState, 'PARTICIPANT_NOT_FOUND', 'Player not found in room');
  }

  const question = getQuestion(nextState);
  if (!question) {
    return failure(nextState, 'INVALID_PHASE', 'No active question is available');
  }

  if (question.questionType === 'multi_part' && nextState.round.multiPartProgress[input.participantId]?.solvedPart !== undefined) {
    return failure(nextState, 'ALREADY_SOLVED', 'Player already solved this question');
  }

  if (nextState.round.answers[input.participantId]) {
    return failure(nextState, 'ALREADY_ANSWERED', 'Player already answered this stage');
  }

  nextState.round.answers[input.participantId] = {
    answer: input.answer,
    submittedAt: input.now,
  };
  nextState.round.answeredParticipantIds = [...nextState.round.answeredParticipantIds, input.participantId];
  bumpState(nextState, input.now);

  const activePlayers = question.questionType === 'multi_part'
    ? getActivePlayers(nextState).filter((player) => nextState.round.multiPartProgress[player.participantId]?.solvedPart === undefined)
    : getActivePlayers(nextState);
  const everyoneAnswered = activePlayers.length > 0
    && activePlayers.every((player) => Boolean(nextState.round.answers[player.participantId]));

  const events: GameEngineEvent[] = [{
    type: 'player_answered',
    playerId: input.participantId,
    roundIndex: nextState.round.roundIndex,
  }];

  if (!everyoneAnswered) {
    return success(nextState, events);
  }

  const finalized = finalizeCurrentRound(
    nextState,
    input.now,
    input.roundResultDurationMs ?? DEFAULT_ROUND_RESULT_DURATION_MS,
  );
  if (finalized.ok) {
    finalized.events = [...events, ...finalized.events];
  }
  return finalized;
}

export function useHint(state: GameRoomState, input: UseHintInput): GameTransitionResult {
  const nextState = cloneState(state);
  if (nextState.phase !== 'playing') {
    return failure(nextState, 'INVALID_PHASE', 'Hints are only available during an active round');
  }

  const participant = nextState.participants.find((candidate) => candidate.participantId === input.participantId && candidate.role === 'player');
  if (!participant) {
    return failure(nextState, 'PARTICIPANT_NOT_FOUND', 'Player not found in room');
  }

  if (nextState.round.hintParticipantIds.includes(input.participantId)) {
    return success(nextState);
  }

  nextState.round.hintParticipantIds = [...nextState.round.hintParticipantIds, input.participantId];
  bumpState(nextState, input.now);
  return success(nextState, [{ type: 'player_hint_used', playerId: input.participantId }]);
}

export function pauseGame(state: GameRoomState, input: PauseGameInput): GameTransitionResult {
  const nextState = cloneState(state);
  if ((nextState.phase !== 'playing' && nextState.phase !== 'round_result') || nextState.round.timerEndsAt == null) {
    return failure(nextState, 'INVALID_PHASE', 'A timer is not actively running');
  }

  const remainingMs = Math.max(0, nextState.round.timerEndsAt - input.now);
  nextState.round.pauseRemainingMs = remainingMs;
  nextState.round.timerEndsAt = null;
  bumpState(nextState, input.now);
  return success(nextState, [{ type: 'game_paused', pauseRemainingMs: remainingMs }], { type: 'set-alarm', at: null });
}

export function resumeGame(state: GameRoomState, input: ResumeGameInput): GameTransitionResult {
  const nextState = cloneState(state);
  if (nextState.round.pauseRemainingMs == null) {
    return failure(nextState, 'INVALID_PHASE', 'The room is not paused');
  }

  const nextTimerEndsAt = input.now + nextState.round.pauseRemainingMs;
  nextState.round.timerEndsAt = nextTimerEndsAt;
  nextState.round.pauseRemainingMs = null;
  bumpState(nextState, input.now);
  return success(nextState, [{ type: 'game_resumed', nextTimerEndsAt }], { type: 'set-alarm', at: nextTimerEndsAt });
}

export function extendTimer(state: GameRoomState, input: ExtendTimerInput): GameTransitionResult {
  const nextState = cloneState(state);
  if (nextState.phase !== 'playing' || nextState.round.timerEndsAt == null || nextState.round.totalQuestionDuration == null) {
    return failure(nextState, 'NO_ACTIVE_TIMER', 'No active timer to extend');
  }

  const extensionMs = input.extensionMs ?? DEFAULT_TIMER_EXTENSION_MS;
  nextState.round.timerEndsAt += extensionMs;
  nextState.round.totalQuestionDuration += extensionMs;
  bumpState(nextState, input.now);
  return success(nextState, [{
    type: 'timer_updated',
    timerEndsAt: nextState.round.timerEndsAt,
    totalQuestionDuration: nextState.round.totalQuestionDuration,
  }], { type: 'set-alarm', at: nextState.round.timerEndsAt });
}

export function advanceRound(state: GameRoomState, input: AdvanceRoundInput): GameTransitionResult {
  const nextState = cloneState(state);

  if (nextState.phase === 'playing') {
    return finalizeCurrentRound(nextState, input.now, input.roundResultDurationMs ?? DEFAULT_ROUND_RESULT_DURATION_MS);
  }

  if (nextState.phase === 'round_result') {
    const nextRoundIndex = (nextState.round.roundIndex ?? -1) + 1;
    if (!nextState.packDefinition?.questions[nextRoundIndex]) {
      nextState.phase = 'finished';
      nextState.round.timerEndsAt = null;
      nextState.round.pauseRemainingMs = null;
      nextState.round.totalQuestionDuration = null;
      bumpState(nextState, input.now);
      return success(nextState, [{ type: 'game_finished' }], { type: 'set-alarm', at: null });
    }

    return startRoundState(nextState, nextRoundIndex, input.now, input.roundDurationMs ?? DEFAULT_ROUND_DURATION_MS);
  }

  return failure(nextState, 'INVALID_PHASE', 'There is no active round to advance');
}

export function skipTimer(state: GameRoomState, input: AdvanceRoundInput): GameTransitionResult {
  return advanceRound(state, input);
}

export function resetGame(state: GameRoomState, input: ResetGameInput): GameTransitionResult {
  const nextState = cloneState(state);
  nextState.phase = 'lobby';
  nextState.closedAt = undefined;
  nextState.closeReason = undefined;
  nextState.participants = nextState.participants.map((participant) => ({
    ...participant,
    score: participant.role === 'player' ? 0 : participant.score,
  }));
  nextState.round = {
    roundIndex: null,
    startedAt: null,
    currentPartIndex: null,
    totalParts: null,
    timerEndsAt: null,
    totalQuestionDuration: null,
    pauseRemainingMs: null,
    answeredParticipantIds: [],
    hintParticipantIds: [],
    answers: {},
    multiPartProgress: {},
    lastResult: null,
  };
  bumpState(nextState, input.now);
  return success(nextState, [{ type: 'lobby_updated' }], { type: 'set-alarm', at: null });
}

export function closeRoom(state: GameRoomState, input: CloseRoomInput): GameTransitionResult {
  const nextState = cloneState(state);
  nextState.phase = 'finished';
  nextState.closedAt = input.now;
  nextState.closeReason = input.reason;
  nextState.round.timerEndsAt = null;
  nextState.round.pauseRemainingMs = null;
  nextState.round.totalQuestionDuration = null;
  bumpState(nextState, input.now);
  return success(nextState, [{ type: 'room_closed', reason: input.reason }], { type: 'set-alarm', at: null });
}

export function getLeaderboard(state: GameRoomState): GameParticipant[] {
  return leaderboard(state);
}

export function getCurrentRoundView(state: GameRoomState): GameRoundView | null {
  return buildRoundView(state);
}

export function getLastRoundResult(state: GameRoomState): GameRoundResultState | null {
  return cloneRoundResult(state.round.lastResult);
}
