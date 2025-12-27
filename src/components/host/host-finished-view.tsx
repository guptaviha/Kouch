"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import PlayerAvatar from '@/components/player-avatar';
import GameOverHeader from '../shared/game-over-header';
import Leaderboard from '../shared/leaderboard';

interface HostFinishedViewProps {
    roundResults: any; // Using any for now, ideally specific type
    resetGame: () => void;
}

export default function HostFinishedView({ roundResults, resetGame }: HostFinishedViewProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-12"
        >
            <div className="w-full max-w-4xl px-4">
                {/* Game Over Header */}
                <GameOverHeader />

                {/* Winner Podium with spotlight */}
                <Leaderboard
                    leaderboard={roundResults.final}
                    showWinnerSpotlight={true}
                    showAnswers={false}
                    showPositions={true}
                    title=''
                />

                {/* Play Again Button */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="text-center"
                >
                    <Button variant="action" onClick={resetGame} className="mb-4 w-full md:w-auto">
                        Play Again
                    </Button>
                    <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">Players will need to rejoin with their phones</p>
                </motion.div>
            </div>
        </motion.div>
    );
}
