"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import TrailingDots from '@/components/trailing-dots';

interface PausedOverlayProps {
  isPaused: boolean;
  title?: string;
  message?: string;
  onResume?: () => void;
  resumeButtonText?: string;
}

export default function PausedOverlay({
  isPaused,
  title = "⏸ Paused",
  message,
  onResume,
  resumeButtonText = "Resume Game"
}: PausedOverlayProps) {
  if (!isPaused) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-lg">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-gray-900 rounded-2xl p-12 shadow-2xl border border-white/20 flex flex-col items-center gap-8 max-w-md"
      >
        <div className="text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          {title}
        </div>
        {message && (
          <div className="text-md text-gray-900 dark:text-white flex items-center justify-center space-x-1">
            <span>
              {message}
              <TrailingDots />
            </span>
          </div>
        )}
        {onResume && (
          <Button onClick={onResume} size="lg" className="w-full text-lg py-6">
            {resumeButtonText}
          </Button>
        )}
      </motion.div>
    </div>
  );
}