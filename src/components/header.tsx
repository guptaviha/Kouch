"use client";

import { DarkModeToggle } from "@/components/dark-mode-toggle";
import React, { useState } from 'react';
import Link from 'next/link';
import { Sofa, Laptop } from 'lucide-react';
import { MdFullscreen, MdFullscreenExit } from 'react-icons/md';
import PlayerAvatar from './player-avatar';
import { Button } from "./ui/button";
import { RoomStates } from "@/lib/store/types";
import { useGameStore } from "@/lib/store";

type Props = {
  roomCode?: string | null;
  avatarKey?: string | undefined;
  name?: string | null;
  role?: 'host' | 'player' | 'guest';
  roomState: RoomStates;
};

export default function Header({ roomCode, avatarKey, name, role = 'guest', roomState }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  };

  // Listen for fullscreen changes
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Handle scroll for header shadow
  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={`fixed left-0 w-full top-0 px-6 py-4 transition-all duration-300 z-50 ${scrolled ? 'bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm' : ''}`}>
      <div className="w-full flex justify-between items-center relative">
        {/* Logo+Title */}
        <div className="flex flex-col gap-1">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Sofa className="w-7 h-7 transform -rotate-12 text-gray-800 dark:text-gray-200" aria-hidden />
            <h1 className="text-2xl font-bold m-0">KouchParty</h1>
          </Link>
          {/* Room Code Centered Below Logo */}
          {roomCode && roomState !== 'lobby' && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Room Code: <span className="">{roomCode}</span>
            </div>
          )}
        </div>

        {/* Action Buttons on the Right */}
        <div className="flex items-center gap-3">
          {/* {role === 'host' && (
            <div className="flex flex-col items-center">
              <Laptop size={24} />
              <span className="text-xs mt-1">Host</span>
            </div>
          )} */}

          {role === 'player' && avatarKey && (
            <div className="flex flex-col items-center">
              <PlayerAvatar avatarKey={avatarKey} variant="header" />
              <span className="text-xs mt-1">{name ?? 'Player'}</span>
            </div>
          )}

          <DarkModeToggle />

          {role === 'host' && (
            <Button
              variant="ghost"
              onClick={toggleFullscreen}
              size="icon"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <MdFullscreenExit size={24} />
              ) : (
                <MdFullscreen size={24} />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
