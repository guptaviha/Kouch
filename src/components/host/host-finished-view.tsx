"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import GameOverHeader from '../shared/game-over-header';
import Leaderboard from '../shared/leaderboard';
import { PlayerInfo } from '@/lib/store/types';
import { useGameStore } from '@/lib/store';
import Link from 'next/link';

export default function HostFinishedView() {
    // Store selectors
    const roundResults = useGameStore((s) => s.roundResults);
    const roomCode = useGameStore((s) => s.roomCode);
    const profile = useGameStore((s) => s.profile as PlayerInfo | null);
    const emit = useGameStore((s) => s.emit);
    const setPlayAgainPending = useGameStore((s) => s.setPlayAgainPending);

    // TODO: This needs some rework because all the players get disconnected when the host resets the game
    const resetGame = () => {
        if (!roomCode || !profile) return;
        emit('message', { type: 'reset_game', roomCode, playerId: profile.id });
        setPlayAgainPending(true);
        emit('message', { type: 'create_room', name: 'Host' });
    };
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
                />

                {/* Play Again Button */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="text-center mt-6"
                >
                    <Link href="/">
                        <Button variant="action" className="mb-4 w-full md:w-auto">
                            Explore Game Library
                        </Button>
                        {/* <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">Players will need to rejoin with their phones</p> */}
                    </Link>
                </motion.div>
            </div>
        </motion.div>
    );
}
