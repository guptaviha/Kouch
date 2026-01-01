"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import PlayerAvatar from '@/components/player-avatar';
import GenericCard from '../shared/generic-card';
import TimerProgress from '../shared/timer-progress';
import { PlayerInfo } from '@/lib/store/types';
import { useGameStore } from '@/lib/store';
import type { QuestionType } from '@/types/trivia';

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
    multiple_choice: 'Multiple Choice',
    open_ended: 'Open Ended',
    multi_part: 'Multi Part',
};

export default function HostPlayingView() {
    // Store selectors
    const question = useGameStore((s) => s.currentQuestion);
    const currentPrompts = useGameStore((s) => s.currentPrompts);
    const questionType = useGameStore((s) => s.currentQuestionType);
    const currentPartIndex = useGameStore((s) => s.currentPartIndex);
    const totalParts = useGameStore((s) => s.totalParts);
    const questionImage = useGameStore((s) => s.questionImage as string | null);
    const timerEndsAt = useGameStore((s) => s.timerEndsAt);
    const totalQuestionDuration = useGameStore((s) => s.totalQuestionDuration);
    const paused = useGameStore((s) => s.paused);
    const pauseRemainingMs = useGameStore((s) => s.pauseRemainingMs);
    const countdown = useGameStore((s) => s.countdown);
    const players = useGameStore((s) => s.players as PlayerInfo[]);
    const answeredPlayers = useGameStore((s) => s.answeredPlayers as string[]);
    const playersWithHints = useGameStore((s) => s.playersWithHints);
    const roundIndex = useGameStore((s) => s.roundIndex);
    const roomCode = useGameStore((s) => s.roomCode);
    const profile = useGameStore((s) => s.profile as PlayerInfo | null);
    const emit = useGameStore((s) => s.emit);

    const extendTimer = () => {
        if (!roomCode) return;
        emit('message', { type: 'extend_timer', roomCode, hostId: profile?.id });
    };
    return (
        <>
            {/* Main Game Content - Centered & Large */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center pb-32"
            >
                {/* Question Section */}
                <div className="w-full max-w-4xl">
                    <GenericCard
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-10 text-center mb-16"
                    >
                        <div className="mb-4">
                            <p className="text-xl text-blue-600 dark:text-blue-400 uppercase tracking-wider font-bold">Question {(roundIndex ?? 0) + 1}</p>
                            {questionType && (
                                <span className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200 text-xs font-semibold">
                                    {QUESTION_TYPE_LABELS[questionType] ?? 'Open Ended'}
                                </span>
                            )}
                            {typeof currentPartIndex === 'number' && typeof totalParts === 'number' && totalParts > 0 && (
                                <span className="ml-2 mt-2 inline-flex items-center px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200 text-xs font-semibold">
                                    Part {currentPartIndex + 1}/{totalParts}
                                </span>
                            )}
                        </div>

                        <div className="space-y-4 text-left sm:text-center">
                            {questionType !== 'multi_part' && (
                                <h2 className={`${questionImage ? 'text-2xl sm:text-3xl' : 'text-4xl sm:text-5xl'} font-extrabold text-gray-900 dark:text-white leading-tight tracking-tight`}>
                                    {question}
                                </h2>
                            )}

                            {(() => {
                                const promptsToShow = questionType === 'multi_part'
                                    ? (currentPrompts || [])
                                    : (currentPrompts?.length ? currentPrompts : question ? [question] : []);
                                return promptsToShow.map((prompt, idx) => (
                                    <p
                                        key={`prompt-${idx}`}
                                        className="text-lg sm:text-xl text-gray-700 dark:text-gray-200 leading-relaxed"
                                    >
                                        {prompt}
                                    </p>
                                ));
                            })()}
                        </div>

                        {/* Question Image - Large & Centered */}
                        {questionImage && (
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="flex justify-center mb-6"
                            >
                                <div className="p-2 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 max-w-2xl">
                                    <img src={questionImage} alt="Puzzle" className="w-full max-w-xs h-auto rounded-2xl" />
                                </div>
                            </motion.div>
                        )}

                        {/* Timer Bar - Prominent */}
                        {timerEndsAt && totalQuestionDuration && (
                            <div className="mt-8 mb-8">
                                <TimerProgress
                                    timerEndsAt={timerEndsAt}
                                    totalDuration={totalQuestionDuration}
                                    paused={paused}
                                    pauseRemainingMs={pauseRemainingMs}
                                    countdown={countdown}
                                    showCountdownText={true}
                                    className="h-6 rounded-full"
                                />
                            </div>
                        )}
                    </GenericCard>

                </div>

                {/* Player Status Row - Bottom */}
                {players.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="fixed bottom-4 left-0 right-0 px-4"
                    >
                        <GenericCard
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="max-w-6xl mx-auto !p-4"
                        >
                            <div className="flex items-center justify-center gap-6 overflow-x-auto pt-3 pb-1">
                                {players.map((p, i) => {
                                    const answered = answeredPlayers.includes(p.id);
                                    const hasUsedHint = playersWithHints?.includes(p.id);

                                    let playerState: React.ComponentProps<typeof PlayerAvatar>['state'] = answered
                                        ? (hasUsedHint ? 'answered_with_hint' : 'answered')
                                        : (hasUsedHint ? 'used_hint' : 'waiting');

                                    if (p.connected === false) {
                                        playerState = 'disconnected';
                                    }

                                    return (
                                        <motion.div
                                            key={p.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="flex flex-col items-center flex-shrink-0 relative"
                                        >
                                            <PlayerAvatar
                                                avatarKey={p.avatar}
                                                variant="game"
                                                state={playerState}
                                                index={i}
                                            />

                                            <div className={`mt-2 text-center text-sm font-bold whitespace-nowrap ${answered ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                                {p.name}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </GenericCard>
                    </motion.div>
                )}

                {/* Extend Timer Button (during the round) */}
                {!paused && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="fixed top-24 right-8 z-30"
                    >
                        <Button
                            onClick={extendTimer}
                            size="lg"
                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg px-6 py-4 rounded-xl shadow-lg cursor-pointer"
                        >
                            ⏱ +30s
                        </Button>
                    </motion.div>
                )}
            </motion.div>
        </>
    );
}
