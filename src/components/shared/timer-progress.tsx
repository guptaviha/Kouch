"use client";

import React from 'react';
import { Progress } from '@/components/ui/progress';

interface TimerProgressProps {
  timerEndsAt?: number | null;
  totalDuration?: number | null;
  paused?: boolean;
  pauseRemainingMs?: number | null;
  countdown: number;
  showCountdownText?: boolean;
  className?: string;
}

export default function TimerProgress({
  timerEndsAt,
  totalDuration,
  paused,
  pauseRemainingMs,
  countdown,
  showCountdownText = true,
  className = ""
}: TimerProgressProps) {
  if (!timerEndsAt || !totalDuration) return null;

  const progressValue = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (100 * (
          (paused && pauseRemainingMs != null)
            ? (totalDuration - pauseRemainingMs)
            : (totalDuration - Math.max(0, (timerEndsAt || 0) - Date.now()))
        )) / totalDuration
      )
    )
  );

  return (
    <div className={className}>
      <Progress
        value={progressValue}
        className={`h-3 bg-gray-100 dark:bg-gray-800 [&>div]:bg-gradient-to-r from-blue-500 to-purple-600 ${paused ? '[&>div]:transition-none' : '[&>div]:transition-all [&>div]:duration-300 [&>div]:ease-linear'}`}
      />
      {showCountdownText && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <span className="text-4xl font-extrabold text-gray-900 dark:text-white tabular-nums">
            {countdown}
          </span>
          <span className="text-2xl text-gray-600 dark:text-gray-400 font-semibold">seconds</span>
        </div>
      )}
    </div>
  );
}