"use client";

import React from 'react';
import { Sofa, Laptop } from 'lucide-react';
import PlayerAvatar from './player-avatar';

type Props = {
  roomCode?: string | null;
  avatarKey?: string | undefined;
  name?: string | null;
  role?: 'host' | 'player' | 'guest';
};

export default function Header({ roomCode, avatarKey, name, role = 'guest' }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2">
      <div className="flex items-center gap-3">
        <Sofa className="w-7 h-7 transform -rotate-12 text-gray-800 dark:text-gray-200" aria-hidden />
        <h1 className="text-2xl font-bold m-0">KouchParty</h1>
      </div>

      {roomCode ? (
        <div className="text-right text-xs flex items-center gap-3">
          <div className="flex flex-col items-center">
            <span className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">{roomCode}</span>
            <span className="text-xs mt-1">Code</span>
          </div>

          <div className="flex items-center gap-2">
            {role === 'host' ? (
              <div className="flex flex-col items-center">
                <Laptop size={24} />
                <span className="text-xs mt-1">Host</span>
              </div>
            ) : (
              avatarKey ? (
                <div className="flex flex-col items-center">
                  <PlayerAvatar avatarKey={avatarKey} size={24} />
                  <span className="text-xs mt-1">{name ?? 'Player'}</span>
                </div>
              ) : null
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
