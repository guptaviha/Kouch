"use client";

import React from 'react';
import { Quantum } from 'ldrs/react';
import { useTheme } from 'next-themes';
import 'ldrs/react/quantum.css';

interface SettingUpProps {
  message?: string;
  size?: number;
  speed?: number;
}

export default function SettingUp({ message = 'Setting up game room', size = 72, speed = 2 }: SettingUpProps) {
  const { resolvedTheme } = useTheme();

  return (
    <div className="flex flex-col items-center justify-center translate-y-[-10%] h-screen" role="status" aria-live="polite">
      <div className="mb-8">
        <Quantum size={size} speed={speed} color={resolvedTheme === 'dark' ? '#ffffff' : '#374151'} />
      </div>
      <p className="text-xl text-muted-foreground">{message}</p>
    </div>
  );
}
