"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PlayerAvatar from '@/components/player-avatar';
import CountUp from '@/components/count-up';
import GenericCard from './generic-card';

interface LeaderboardProps {
  leaderboard: Array<{ id: string; name: string; avatar: string; score: number; connected?: boolean }>;
  results?: Array<{ playerId: string; points: number; correct: boolean; answer?: string }>;
  highlightPlayerId?: string;
  showAnswers?: boolean;
  avatarSize?: number;
  showPositions?: boolean;
  title?: string;
  showWinnerSpotlight?: boolean;
}

export default function Leaderboard({
  leaderboard,
  results = [],
  highlightPlayerId,
  showAnswers = false,
  showPositions = false,
  title = 'Leaderboard',
  showWinnerSpotlight = false,
  className = "",
  listClassName = "max-h-96"
}: LeaderboardProps & { className?: string; listClassName?: string }) {
  const hasWinner = showWinnerSpotlight && Array.isArray(leaderboard) && leaderboard.length > 0;
  const listToRender = hasWinner ? leaderboard.slice(1) : leaderboard;
  const inner = (
    <div className={`space-y-4 overflow-y-auto ${listClassName}`}>
      <AnimatePresence>
        {listToRender.map((p, index) => {
          const result = results.find((r) => r.playerId === p.id);
          const pointsEarned = result?.points || 0;
          const previousScore = p.score - pointsEarned;
          const isHighlighted = p.id === highlightPlayerId;

          // When spotlight is shown the remaining list represents positions starting at 2
          const displayPosition = showPositions ? index + (hasWinner ? 2 : 1) : undefined;

          return (
            <motion.div
              key={p.id}
              layout
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center gap-4 p-4 rounded-2xl font-semibold text-lg transition-all ${result?.correct
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-300 dark:border-emerald-800'
                : isHighlighted
                  ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                  : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800'
                }`}
            >
              {showPositions && (
                <div className="font-bold text-gray-400 w-6 text-left">{displayPosition}</div>
              )}
              <PlayerAvatar
                avatarKey={p.avatar}
                variant="leaderboard"
                state={p.connected === false ? 'disconnected' : undefined}
              />

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
                    <span className="font-bold">{result.answer}</span>
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

  return (
    <GenericCard
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={`p-0 overflow-visible ${className}`}
    >
      {hasWinner && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-gradient-to-br from-yellow-300 to-yellow-100 dark:from-yellow-900/40 dark:to-yellow-900/20 p-8 rounded-xl rounded-b-none border-b-4 border-yellow-400 dark:border-yellow-600"
        >
          <div className="flex flex-col items-center">
            <div className="relative mb-4">
              <PlayerAvatar
                avatarKey={leaderboard[0].avatar}
                variant="winner"
                showCrown={true}
              />
            </div>
            <h3 className="text-2xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">{leaderboard[0].name}</h3>
            <div className="text-xl md:text-3xl font-extrabold text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-4 py-2 rounded-full">
              {leaderboard[0].score} points
            </div>
          </div>
        </motion.div>
      )}

      <div className={`p-4 flex flex-col h-full`}>
        {!showWinnerSpotlight && <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">{title}</h3>}
        {inner}
      </div>
    </GenericCard>
  );
}