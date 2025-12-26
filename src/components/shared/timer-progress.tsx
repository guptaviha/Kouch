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
        <p className="text-xs text-gray-500 mt-2 font-medium text-right">
          Time remaining: {countdown}s
        </p>
      )}
    </div>
  );
}