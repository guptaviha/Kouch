"use client";

import React from 'react';
import GameOverHeader from '@/components/shared/game-over-header';
// import Leaderboard from '@/components/shared/leaderboard';
import TrailingDots from '@/components/trailing-dots';
import { useGameStore } from '@/lib/store';

export default function PlayerFinishedView() {
    const roundResults = useGameStore((s) => s.roundResults);
    const profile = useGameStore((s) => s.profile);

    return (
        <div className="w-full max-w-lg mx-auto text-center">
            <GameOverHeader titleClassName="!text-3xl !mb-2" />

            {/* Winner Podium with spotlight (hidden) */}
            {/* <Leaderboard
                leaderboard={(roundResults.final || [])}
                highlightPlayerId={profile?.id}
                showPositions
                showWinnerSpotlight={true}
                avatarSize={32}
            /> */}

            <div className="mt-8 text-center text-sm text-gray-500 animate-pulse">
                Waiting for host to restart
                <TrailingDots />
            </div>
        </div>
    );
}
