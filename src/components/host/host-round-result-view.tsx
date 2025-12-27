"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Pause, Play } from 'lucide-react';
import Leaderboard from '../shared/leaderboard';
import GenericCard from '../shared/generic-card';
import TimerProgress from '../shared/timer-progress';
import { PlayerInfo } from '@/lib/store/types';
import { useGameStore } from '@/lib/store';

export default function HostRoundResultView() {
    // Store selectors
    const roundResults = useGameStore((s) => s.roundResults);
    const timerEndsAt = useGameStore((s) => s.timerEndsAt);
    const nextTimerDurationMs = useGameStore((s) => s.nextTimerDurationMs);
    const paused = useGameStore((s) => s.paused);
    const pauseRemainingMs = useGameStore((s) => s.pauseRemainingMs);
    const countdown = useGameStore((s) => s.countdown);
    const roomCode = useGameStore((s) => s.roomCode);
    const profile = useGameStore((s) => s.profile as PlayerInfo | null);
    const emit = useGameStore((s) => s.emit);

    const pauseGame = () => {
        if (!roomCode || !profile) return;
        emit('message', { type: 'pause_game' });
    };

    const resumeGame = () => {
        if (!roomCode || !profile) return;
        emit('message', { type: 'resume_game' });
    };
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-12"
        >
            <div className="w-full max-w-4xl">
                {/* Correct Answer - Big & Prominent */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-12"
                >
                    <div className="bg-blue-600 rounded-3xl shadow-2xl overflow-hidden mb-6">
                        <div className="bg-blue-600 p-8 text-center">
                            <p className="text-white text-2xl font-bold uppercase tracking-widest">Correct Answer</p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-12 text-center">
                            <div className="text-7xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                                {roundResults.correctAnswer}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Leaderboard */}
                <Leaderboard leaderboard={roundResults.leaderboard || []} results={roundResults.results} showAnswers />

                {/* Extend Timer + Pause/Resume Buttons (visible on result screen) */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="fixed top-24 right-8 z-30 flex items-center gap-3"
                >
                    {!paused ? (
                        <Button
                            onClick={pauseGame}
                            size="lg"
                            className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-lg px-5 py-4 rounded-xl shadow-lg"
                        >
                            <Pause className="w-5 h-5 mr-2" /> Pause
                        </Button>
                    ) : (
                        <Button
                            onClick={resumeGame}
                            size="lg"
                            className="bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg px-5 py-4 rounded-xl shadow-lg"
                        >
                            <Play className="w-5 h-5 mr-2" /> Resume
                        </Button>
                    )}
                </motion.div>

                {timerEndsAt && nextTimerDurationMs && (
                    <GenericCard
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className='w-full min-h-44 max-w-4xl mt-12 text-center'
                    >
                        <p className="text-gray-600 dark:text-gray-400 text-lg font-semibold mb-4">Next round starts in</p>
                        <TimerProgress
                            timerEndsAt={timerEndsAt}
                            totalDuration={nextTimerDurationMs}
                            paused={paused}
                            pauseRemainingMs={pauseRemainingMs}
                            countdown={countdown}
                            showCountdownText={true}
                            className="h-6 rounded-full"
                        />
                    </GenericCard>
                )}
            </div>
        </motion.div>
    );
}
