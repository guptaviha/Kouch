"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PlayerAvatar from '@/components/player-avatar';
import CountUp from '@/components/count-up';

interface LeaderboardProps {
  leaderboard: Array<{ id: string; name: string; avatar: string; score: number }>;
  results?: Array<{ playerId: string; points: number; correct: boolean; answer?: string }>;
  highlightPlayerId?: string;
  showAnswers?: boolean;
  avatarSize?: number;
  showPositions?: boolean;
}

export default function Leaderboard({
  leaderboard,
  results = [],
  highlightPlayerId,
  showAnswers = false,
  avatarSize = 80,
  showPositions = false
}: LeaderboardProps) {
  return (
    <div className="space-y-4 max-h-96 overflow-y-auto">
      <AnimatePresence>
        {leaderboard.map((p, index) => {
          const result = results.find((r) => r.playerId === p.id);
          const pointsEarned = result?.points || 0;
          const previousScore = p.score - pointsEarned;
          const isHighlighted = p.id === highlightPlayerId;

          return (
            <motion.div
              key={p.id}
              layout
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center gap-6 p-6 rounded-2xl font-semibold text-lg transition-all ${
                result?.correct
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-300 dark:border-emerald-800'
                  : isHighlighted
                  ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                  : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800'
              }`}
            >
              {showPositions && (
                <div className="font-bold text-gray-400 w-6 text-left">{index + 1}</div>
              )}
              <div className="rounded-full flex-shrink-0 bg-gray-200 dark:bg-gray-700 overflow-hidden ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 ring-blue-400" style={{ width: avatarSize + 8, height: avatarSize + 8 }}>
                <PlayerAvatar avatarKey={p.avatar} size={avatarSize} />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xl text-gray-900 dark:text-white">{p.name}</span>
                  {pointsEarned > 0 && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + (index * 0.1) }}
                      className="text-base font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1 rounded-full"
                    >
                      +{pointsEarned}
                    </motion.span>
                  )}
                </div>
                {showAnswers && result?.answer && (
                  <div className={`text-sm font-medium ${result.correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    Your answer: <span className="font-bold">{result.answer}</span>
                  </div>
                )}
              </div>

              <div className="text-right flex-shrink-0">
                <div className="text-4xl font-extrabold text-gray-900 dark:text-white tabular-nums">
                  <CountUp from={previousScore} to={p.score} duration={1.5} delay={0.5 + (index * 0.1)} />
                </div>
                <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">points</div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}