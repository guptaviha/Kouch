"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface ReconnectingModalProps {
  isVisible: boolean;
}

export default function ReconnectingModal({ isVisible }: ReconnectingModalProps) {
  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-xl max-w-md w-full mx-4"
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Connection Lost</h2>
          <p className="text-gray-600 dark:text-gray-400">Trying to reconnect...</p>
        </div>
      </motion.div>
    </motion.div>
  );
}