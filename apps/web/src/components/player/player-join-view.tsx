"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useGameStore } from '@/lib/store';

export default function PlayerJoinView() {
    const roomCode = useGameStore((s) => s.roomCode);
    const setRoomCode = useGameStore((s) => s.setRoomCode);
    const profile = useGameStore((s) => s.profile);
    const setProfile = useGameStore((s) => s.setProfile);
    const statusMessage = useGameStore((s) => s.statusMessage);
    const emit = useGameStore((s) => s.emit);
    const setStatusMessage = useGameStore((s) => s.setStatusMessage);

    const joinRoom = () => {
        setStatusMessage(null);
        if (!roomCode || !profile?.name) {
            setStatusMessage('Enter name and room code');
            return;
        }

        // Save nickname to localStorage
        try {
            localStorage.setItem('kouch_nickname', profile?.name ?? '');
        } catch (e) {
            // ignore
        }

        emit('message', { type: 'join', roomCode: roomCode, name: profile?.name });

        const requestFullscreen = () => {
            const docEl = document.documentElement as any;
            if (docEl.requestFullscreen) {
                docEl.requestFullscreen();
            } else if (docEl.mozRequestFullScreen) {
                docEl.mozRequestFullScreen();
            } else if (docEl.webkitRequestFullscreen) {
                docEl.webkitRequestFullscreen();
            } else if (docEl.msRequestFullscreen) {
                docEl.msRequestFullscreen();
            }
        };

        requestFullscreen();
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-900 shadow-xl border border-gray-100 dark:border-gray-800 rounded-xl p-6 md:p-8"
        >
            <div className="mb-6 text-center">
                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">Join the Party</h2>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block mb-1.5 text-xs font-bold uppercase tracking-widest text-gray-500">Nickname</label>
                    <input
                        className="w-full p-4 bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-lg"
                        placeholder="e.g. Maverick"
                        value={profile?.name ?? ''}
                        onChange={(e) => setProfile({ ...(profile || {}), name: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block mb-1.5 text-xs font-bold uppercase tracking-widest text-gray-500">Room Code</label>
                    <input
                        className="w-full p-4 bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono font-bold text-lg uppercase tracking-wider"
                        placeholder="ABCD"
                        maxLength={4}
                        value={roomCode ?? ''}
                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    />
                </div>

                <Button
                    variant="action"
                    className="w-full mt-2"
                    onClick={joinRoom}
                    disabled={!((profile?.name ?? '').trim()) || (roomCode ?? '').length < 4}
                >
                    Join Game
                </Button>
            </div>

            {statusMessage && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-center text-sm font-medium"
                >
                    {statusMessage}
                </motion.div>
            )}
        </motion.div>
    );
}
