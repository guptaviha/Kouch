"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import PlayerAvatar from '@/components/player-avatar';

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
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center mb-12"
                >
                    <h2 className="text-7xl font-extrabold dark:text-blue-400 text-blue-600 mb-4 tracking-tight">
                        Game Over!
                    </h2>
                    <p className="text-2xl text-gray-600 dark:text-gray-400 font-semibold">Final Standings</p>
                </motion.div>

                {/* Winner Podium */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden mb-8"
                >
                    {(roundResults.final || [])[0] && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="bg-gradient-to-br from-yellow-300 to-yellow-100 dark:from-yellow-900/40 dark:to-yellow-900/20 p-12 border-b-4 border-yellow-400 dark:border-yellow-600"
                        >
                            <div className="flex flex-col items-center">
                                <div className="relative mb-6">
                                    <PlayerAvatar
                                        avatarKey={(roundResults.final || [])[0].avatar}
                                        variant="winner"
                                        showCrown={true}
                                    />
                                </div>

                                <h3 className="text-4xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">{(roundResults.final || [])[0].name}</h3>
                                <div className="text-3xl font-extrabold text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-6 py-3 rounded-full">
                                    {(roundResults.final || [])[0].score} points
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Rest of Leaderboard */}
                    <div className="p-8">
                        <div className="space-y-4">
                            {(roundResults.final || []).slice(1).map((p: any, i: number) => (
                                <motion.div
                                    key={p.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.4 + (i * 0.1) }}
                                    className="flex items-center p-6 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-shadow"
                                >
                                    <div className="flex-shrink-0 mr-6">
                                        <PlayerAvatar
                                            avatarKey={p.avatar}
                                            variant="podium"
                                        />
                                    </div>

                                    <div className="flex-1">
                                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{p.name}</div>
                                    </div>

                                    <div className="text-right flex-shrink-0">
                                        <div className="text-3xl font-extrabold text-gray-900 dark:text-white">{p.score}</div>
                                        <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">points</div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.div>

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
