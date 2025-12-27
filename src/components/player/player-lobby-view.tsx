"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import PlayerAvatar from '@/components/player-avatar';
import TrailingDots from '@/components/trailing-dots';
import { useGameStore } from '@/lib/store';
import { getRandomMessage } from '@/utils/messages';

export default function PlayerLobbyView() {
    const profile = useGameStore((s) => s.profile);
    const [waitingMessage, setWaitingMessage] = useState(getRandomMessage('waiting_to_start'));

    useEffect(() => {
        setWaitingMessage(getRandomMessage('waiting_to_start'));
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-900 shadow-xl border border-gray-100 dark:border-gray-800 rounded-xl p-8 text-center flex flex-col items-center"
        >
            <div className="relative">
                <PlayerAvatar
                    avatarKey={profile?.avatar}
                    variant="lobby"
                />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Hello, {profile?.name ?? 'Player'}!
            </h2>
            <div className="flex items-center justify-center space-x-1 text-gray-500 font-medium">
                <span>
                    {waitingMessage}
                    <TrailingDots />
                </span>
            </div>
        </motion.div>
    );
}
