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
            className="flex flex-row h-[calc(100vh-6rem)] w-full gap-6 p-6 overflow-hidden"
        >
            {/* Left Column: Answer, Timer, Controls */}
            <div className="flex flex-col w-1/3 gap-6">
                {/* Correct Answer Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex-shrink-0"
                >
                    <div className="bg-blue-600 rounded-3xl shadow-xl overflow-hidden">
                        <div className="bg-blue-600 p-6 text-center">
                            <p className="text-white text-xl font-bold uppercase tracking-widest">Correct Answer</p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-8 text-center flex items-center justify-center min-h-[160px]">
                            <div className="text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight">
                                {roundResults.correctAnswer}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Controls & Timer Section */}
                <div className="flex-1 flex flex-col gap-6">
                    {/* Controls */}
                    <div className="flex gap-4">
                        {!paused ? (
                            <Button
                                onClick={pauseGame}
                                size="lg"
                                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-xl h-16 rounded-2xl shadow-lg"
                            >
                                <Pause className="w-6 h-6 mr-3" /> Pause
                            </Button>
                        ) : (
                            <Button
                                onClick={resumeGame}
                                size="lg"
                                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold text-xl h-16 rounded-2xl shadow-lg"
                            >
                                <Play className="w-6 h-6 mr-3" /> Resume
                            </Button>
                        )}
                    </div>

                    {/* Timer Card */}
                    {timerEndsAt && nextTimerDurationMs && (
                        <GenericCard
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 }}
                            className='flex-1 flex flex-col justify-center items-center text-center p-8'
                        >
                            <p className="text-gray-500 dark:text-gray-400 text-xl font-semibold mb-6">Next round starts in</p>
                            <TimerProgress
                                timerEndsAt={timerEndsAt}
                                totalDuration={nextTimerDurationMs}
                                paused={paused}
                                pauseRemainingMs={pauseRemainingMs}
                                countdown={countdown}
                                showCountdownText={true}
                                className="w-full"
                            />
                        </GenericCard>
                    )}
                </div>
            </div>

            {/* Right Column: Leaderboard */}
            <div className="flex-1 h-full min-h-0">
                <Leaderboard
                    leaderboard={roundResults.leaderboard || []}
                    results={roundResults.results}
                    showAnswers
                    className="h-full flex flex-col shadow-xl"
                    listClassName="flex-1 overflow-y-auto min-h-0 pr-2"
                />
            </div>
        </motion.div>
    );
}
