"use client";

import React from 'react';
import { MdError } from 'react-icons/md';
import { useTheme } from 'next-themes';

interface ErrorStateProps {
  message?: string;
  size?: number;
}

export default function ErrorState({ message = 'An error occurred', size = 72 }: ErrorStateProps) {
  const { resolvedTheme } = useTheme();

  return (
    <div className="flex flex-col items-center justify-center translate-y-[-10%] h-screen" role="status" aria-live="polite">
      <div className="mb-8">
        <MdError size={size} color={resolvedTheme === 'dark' ? '#ffffff' : '#374151'} />
      </div>
      <p className="text-xl text-muted-foreground">{message}</p>
    </div>
  );
}