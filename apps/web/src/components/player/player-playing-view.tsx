"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useGameStore } from '@/lib/store';
import TrailingDots from '@/components/trailing-dots';
import { getRandomMessage } from '@/utils/messages';
import type { QuestionType } from '@/types/game-types';

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
    multiple_choice: 'Multiple Choice',
    open_ended: 'Open Ended',
    multi_part: 'Multi Part',
};

export default function PlayerPlayingView() {
    const roundIndex = useGameStore((s) => s.roundIndex);
    const currentPartIndex = useGameStore((s) => s.currentPartIndex);
    const totalParts = useGameStore((s) => s.totalParts);
    const questionType = useGameStore((s) => s.currentQuestionType);
    const currentHint = useGameStore((s) => s.currentHint);
    const hintUsed = useGameStore((s) => s.hintUsed);
    const answer = useGameStore((s) => s.answer);
    const setAnswer = useGameStore((s) => s.setAnswer);
    const submitted = useGameStore((s) => s.submitted);
    const statusMessage = useGameStore((s) => s.statusMessage);
    const emit = useGameStore((s) => s.emit);
    const profile = useGameStore((s) => s.profile);
    const roomCode = useGameStore((s) => s.roomCode);
    const paused = useGameStore((s) => s.paused);
    const answeredPlayers = useGameStore((s) => s.answeredPlayers as string[]);
    const setHintUsed = useGameStore((s) => s.setHintUsed);
    const setStatusMessage = useGameStore((s) => s.setStatusMessage);
    const setSubmitted = useGameStore((s) => s.setSubmitted);

    const [answerReceivedMessage] = useState(getRandomMessage('answer_received'));
    const [waitingForPlayersMessage] = useState(getRandomMessage('waiting_for_players'));

    const useHint = () => {
        if (!profile?.id || !roomCode || paused || hintUsed) return;
        emit('message', { type: 'use_hint', roomCode, playerId: profile.id });
        setHintUsed(true);
    };

    const submitAnswer = () => {
        if (!profile?.id || !roomCode || paused) return;
        emit('message', { type: 'submit_answer', roomCode, playerId: profile.id, answer });
        setStatusMessage('Waiting for other players to answer...');
        setAnswer('');
        setSubmitted(true);
    };

    const isSolvedMultiPart = statusMessage === 'Solved - waiting for others';
    const isSubmittedNotSolved = questionType === 'multi_part' && submitted && !isSolvedMultiPart;
    const isWaitingGeneric = statusMessage === 'Answer received' || statusMessage === 'Waiting for other players to answer...';

    if (isSolvedMultiPart || isSubmittedNotSolved || isWaitingGeneric) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${isSubmittedNotSolved ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'} shadow-xl border rounded-xl p-6 md:p-8 text-center`}
            >
                <div className="mb-4">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {isSolvedMultiPart ? 'You solved it!' : (isSubmittedNotSolved ? 'Answer recorded' : answerReceivedMessage)}
                    </h2>
                    <div className="flex items-center justify-center space-x-1 text-gray-500 font-medium">
                        <span>
                            {isSolvedMultiPart ? 'Waiting for other players to finish...' : (isSubmittedNotSolved ? 'Your answer was not correct. Waiting for next prompt...' : waitingForPlayersMessage)}
                            <TrailingDots />
                        </span>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-900 shadow-xl border border-gray-100 dark:border-gray-800 rounded-xl p-6 md:p-8"
        >
            <div className="mb-6 flex justify-between items-start">
                <div>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">Question {(roundIndex ?? 0) + 1}</h2>
                    {questionType && (
                        <span className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200 text-[10px] font-semibold">
                            {QUESTION_TYPE_LABELS[questionType] ?? 'Open Ended'}
                        </span>
                    )}
                    {typeof currentPartIndex === 'number' && typeof totalParts === 'number' && totalParts > 0 && (
                        <span className="ml-2 mt-2 inline-flex items-center px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200 text-[10px] font-semibold">
                            Part {currentPartIndex + 1}/{totalParts}
                        </span>
                    )}
                </div>
                {currentHint && !hintUsed && (
                    <button
                        onClick={useHint}
                        className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-3 py-1.5 rounded-full font-bold hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors flex items-center gap-1"
                    >
                        Show Hint (1/2 pts)
                    </button>
                )}
            </div>

            {hintUsed && currentHint && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-xl border border-yellow-200 dark:border-yellow-800 text-sm font-medium"
                >
                    <span className="font-bold mr-1">Hint:</span> {currentHint}
                </motion.div>
            )}

            {/* Player view stays minimal: no prompts or titles, just input */}

            <input
                className="w-full mb-4 p-4 text-lg border-2 border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:border-blue-500 bg-gray-50 dark:bg-gray-900 transition-colors"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer..."
                disabled={submitted}
                autoFocus
                onKeyDown={(e) => {
                    if (e.key === 'Enter') submitAnswer();
                }}
            />

            {!submitted && (
                <Button
                    variant="action"
                    className="w-full mt-4"
                    onClick={submitAnswer}
                    disabled={submitted || !answer.trim()}
                >
                    Submit Answer
                </Button>
            )}
        </motion.div>
    );
}
