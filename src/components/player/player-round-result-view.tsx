"use client";

import React from 'react';
import { motion } from 'framer-motion';
import Leaderboard from '@/components/shared/leaderboard';
import { useGameStore } from '@/lib/store';

export default function PlayerRoundResultView() {
    const roundResults = useGameStore((s) => s.roundResults);
    const profile = useGameStore((s) => s.profile);
    const my = profile?.id ? (roundResults.results || []).find((r: any) => r.playerId === profile.id) : null;
    const isCorrect = my?.correct;

    return (
        <div className="mt-4 w-full">
            {/* Your Result Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`rounded-xl shadow-xl overflow-hidden mb-6 border-2 ${isCorrect
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-400'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-400'
                    }`}
            >
                <div className={`p-4 text-center ${isCorrect ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                    <h2 className="text-white text-lg font-bold uppercase tracking-widest">
                        {isCorrect ? 'Correct!' : 'Incorrect'}
                    </h2>
                </div>
                <div className="p-6 text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Your Answer</p>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{my?.answer ?? '—'}</div>
                    <div className="mt-4 text-sm font-medium text-gray-500">
                        {isCorrect ? `+${my?.points || 0} points` : 'Better luck next time!'}
                    </div>
                </div>
            </motion.div>

            {/* Leaderboard Card */}
            <Leaderboard leaderboard={roundResults.leaderboard || []} results={roundResults.results} highlightPlayerId={profile?.id} showAnswers avatarSize={32} />
        </div>
    );
}
