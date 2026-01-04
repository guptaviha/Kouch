"use client";

import { Bouncy } from 'ldrs/react';
import 'ldrs/react/Bouncy.css';

interface TrailingDotsProps {
  variant?: 'default' | 'lg' | 'xl';
}

export default function TrailingDots({ variant = 'default' }: TrailingDotsProps) {
  const size = variant === 'lg' ? 20 : variant === 'xl' ? 24 : 16;
  return <Bouncy size={size} color="currentColor" />;
}
