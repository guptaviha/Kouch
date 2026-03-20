"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface GameOverHeaderProps {
  title?: string;
  subtitle?: string;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
}

export default function GameOverHeader({
  title = 'Game Over!',
  subtitle = 'Final Standings',
  className = '',
  titleClassName = '',
  subtitleClassName = '',
}: GameOverHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`text-center mb-12 ${className}`}
    >
      <h2 className={`text-7xl font-extrabold dark:text-blue-400 text-blue-600 mb-4 tracking-tight ${titleClassName}`}>{title}</h2>
      <p className={`text-2xl text-gray-600 dark:text-gray-400 font-semibold ${subtitleClassName}`}>{subtitle}</p>
    </motion.div>
  );
}
