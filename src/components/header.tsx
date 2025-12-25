"use client";

import { DarkModeToggle } from "@/components/dark-mode-toggle";
import React, { useState } from 'react';
import Link from 'next/link';
import { Sofa, Laptop } from 'lucide-react';
import { MdFullscreen, MdFullscreenExit } from 'react-icons/md';
import PlayerAvatar from './player-avatar';
import { Button } from "./ui/button";

type Props = {
  roomCode?: string | null;
  avatarKey?: string | undefined;
  name?: string | null;
  role?: 'host' | 'player' | 'guest';
};

export default function Header({ roomCode, avatarKey, name, role = 'guest' }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  return (
    <div className="flex items-center justify-between gap-3 mb-2">
      <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
        <Sofa className="w-7 h-7 transform -rotate-12 text-gray-800 dark:text-gray-200" aria-hidden />
        <h1 className="text-2xl font-bold m-0">KouchParty</h1>
      </Link>

      {roomCode ? (
        <div className="text-right text-xs flex items-center gap-3">
          <div className="flex flex-col items-center">
            <span className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">{roomCode}</span>
            <span className="text-xs mt-1">Code</span>
          </div>

          <div className="flex items-center gap-3">
            {role === 'host' ? (
              <>
                <div className="flex flex-col items-center">
                  <Laptop size={24} />
                  <span className="text-xs mt-1">Host</span>
                </div>

                {/* <div className="flex items-center"> */}
                  <DarkModeToggle />
                {/* </div> */}

                <Button variant="ghost"
                  onClick={toggleFullscreen}
                  size="icon"
                  aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                  {isFullscreen ? (
                    <MdFullscreenExit size={24} />
                  ) : (
                    <MdFullscreen size={24} />
                  )}
                  {/* <span className="text-xs mt-1">Full</span> */}
                </Button>
              </>
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
      ) : <DarkModeToggle />}
    </div>
  );
}
