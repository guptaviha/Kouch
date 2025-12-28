"use client";

import { useGameStore } from '@/lib/store';
import { useState, useEffect } from 'react';

import { useLocalStorage } from '@/hooks/use-local-storage';
import { Icon } from 'lucide-react';

export default function DebugFloatingBox() {
  const [isVisible, setIsVisible] = useState(true);
  const roomCode = useGameStore((s) => s.roomCode);
  const state = useGameStore((s) => s.state);
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const paused = useGameStore((s) => s.paused);
  const roundIndex = useGameStore((s) => s.roundIndex);
  const countdown = useGameStore((s) => s.countdown);
  const players = useGameStore((s) => s.players);
  const answeredPlayers = useGameStore((s) => s.answeredPlayers);
  const selectedPack = useGameStore((s) => s.selectedPack);

  const [userId] = useLocalStorage<string | null>('kouch_userId', null);
  const [avatar] = useLocalStorage<string | null>('kouch_userAvatar', null);
  console.log('userId from debug-floating-box', userId);

  useEffect(() => {
    let lastKey = '';
    let lastKeyTime = 0;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'd') {
        const now = Date.now();
        if (lastKey === 'd' && now - lastKeyTime < 500) {
          setIsVisible(prev => !prev);
          lastKey = '';
          lastKeyTime = 0;
        } else {
          lastKey = 'd';
          lastKeyTime = now;
        }
      } else {
        lastKey = '';
        lastKeyTime = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (process.env.NODE_ENV !== 'development') return null;
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 right-0 bg-black/70 text-white p-4 rounded-tl-lg shadow-lg z-50 max-w-xs">
      <h3 className="text-sm font-bold mb-2">Debug Info</h3>
      <div className="text-xs space-y-1">
        <div>UserId: {userId?.slice(0, 8) || 'None'}</div>
        <div>Avatar: {avatar || 'None'}</div>
        <div>Room Code: {roomCode || 'N/A'}</div>
        <div>State: {state}</div>
        <div>Question: {currentQuestion || 'N/A'}</div>
        <div>Paused: {paused ? 'Yes' : 'No'}</div>
        <div>Round: {roundIndex ?? 'N/A'}</div>
        <div>Countdown: {countdown}</div>
        <div>Players: {players.length}</div>
        <div>Answered: {answeredPlayers.length}</div>
        <div>Pack: {selectedPack || 'N/A'}</div>
      </div>
    </div>
  );
}