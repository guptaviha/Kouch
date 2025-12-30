"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TrailingDots from '@/components/trailing-dots';
import PlayerAvatar from '@/components/player-avatar';
import GenericCard from '../shared/generic-card';
import GameDetailsCard from '../shared/game-details-card';
import { GameDetails } from '@/types/game-details';
import { PlayerInfo } from '@/lib/store/types';
import { useGameStore } from '@/lib/store';

interface HostLobbyViewProps {
    game: string; // The game pack name
}

export default function HostLobbyView({ game }: HostLobbyViewProps) {
    const [gameDetails, setGameDetails] = useState<GameDetails | null>(null);

    // Store selectors
    const qrDataUrl = useGameStore((s) => s.qrDataUrl);
    const roomCode = useGameStore((s) => s.roomCode);
    const joinUrl = useGameStore((s) => s.joinUrl);
    const players = useGameStore((s) => s.players as PlayerInfo[]);
    const profile = useGameStore((s) => s.profile as PlayerInfo | null);
    const emit = useGameStore((s) => s.emit);

    useEffect(() => {
        async function fetchGameDetails() {
            try {
                const res = await fetch(`/api/games/${game}`);
                if (res.ok) {
                    const data = await res.json();
                    setGameDetails(data);
                }
            } catch (error) {
                console.error('Failed to fetch game details', error);
            }
        }
        fetchGameDetails();
    }, [game]);

    const startGame = () => {
        if (!roomCode || !profile) return;
        emit('message', { type: 'start_game', roomCode, playerId: profile.id });
    };
    return (
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-8 items-start pb-32">
            {/* LEFT SECTION: Game Details Card */}
            <div className="lg:col-span-3">
                {gameDetails && <GameDetailsCard gameDetails={gameDetails} />}
            </div>

            {/* RIGHT SECTION: QR Code + Players */}
            <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="lg:col-span-4 flex flex-col gap-6"
            >
                {/* QR Code Card - Compact */}
                {qrDataUrl ? (
                    <GenericCard
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="p-6 z-10"
                    >
                        <div className="grid grid-cols-2 gap-6 items-center">
                            {/* Left: Phone Controller Label + Room Code */}
                            <div className="flex flex-col justify-center">
                                <div className="flex items-center bg-green-50 dark:bg-green-900/20 rounded-xl py-3 px-4 w-fit mb-4">
                                    <Smartphone className="w-7 h-7 text-green-500 mr-2" />
                                    <span className="text-lg font-semibold text-gray-700 dark:text-gray-200">Phone controller game</span>
                                </div>
                                <p className="text-lg font-semibold text-gray-500 uppercase tracking-widest mb-3">Room Code</p>
                                <h3 className="text-7xl font-bold text-gray-900 dark:text-white font-mono tracking-widest leading-tight">{roomCode}</h3>
                                <div className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                                    <p className="mb-2">or visit</p>
                                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 break-all font-mono inline-block">
                                        <a target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 font-medium" href={joinUrl ?? `/player?code=${roomCode}`}>
                                            {joinUrl ? joinUrl.replace(/^https?:\/\//, '').split('?')[0] : `${roomCode}.local`}
                                        </a>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Tilted Framed QR Code (static 10° rotation, no animation) */}
                            <div className="flex justify-center items-center">
                                <div className="transform" style={{ transform: 'rotate(4deg)' }}>
                                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border-4 border-gray-300 dark:border-gray-700 p-2">
                                        <img src={qrDataUrl} alt={`QR code for ${roomCode}`} className="w-60 h-60 rounded" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </GenericCard>
                ) : (
                    <div className="text-center text-gray-600">
                        Generating QR code
                        <TrailingDots />
                    </div>
                )}

                {/* Players Card */}
                <GenericCard
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex flex-col z-10 h-fit max-h-[calc(100vh-300px)]"
                >
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-800">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Players</h3>
                        {process.env.NODE_ENV === 'development' && (
                            <Button variant="destructive" className="text-sm px-4 py-2" onClick={() => { if (roomCode) emit('message', { type: 'mock', roomCode }); }}>Load Mock Players</Button>
                        )}
                        <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full font-bold">{players.length} joined</span>
                    </div>

                    {players.length === 0 ? (
                        <motion.div
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="flex flex-col items-center justify-center py-8 px-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl"
                        >
                            <p className="text-base font-semibold text-gray-700 dark:text-gray-300">Waiting for players to join</p>
                        </motion.div>
                    ) : (
                        <div className="grid grid-cols-3 gap-4 overflow-y-auto pt-2 pb-2" style={{ maxHeight: 'calc(100vh - 450px)' }}>
                            <AnimatePresence mode='popLayout'>
                                {players.map((p, i) => (
                                    <motion.div
                                        key={p.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                                        transition={{ delay: i * 0.05 }}
                                        className="flex flex-col items-center gap-2 pt-2"
                                    >
                                        <PlayerAvatar
                                            avatarKey={p.avatar}
                                            variant="lobby"
                                            state={p.connected === false ? 'disconnected' : 'idle'}
                                            index={i}
                                        />
                                        <p className="font-bold text-sm text-gray-900 dark:text-white text-center truncate w-full">{p.name}</p>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </GenericCard>
            </motion.div>

            {/* Centered Start Button */}
            <Button
                variant="floatingAction"
                onClick={startGame}
                disabled={players.length === 0}
            >
                {players.length === 0 ? (
                    <span className="flex items-center gap-2">Waiting<TrailingDots /></span>
                ) : (
                    'Start Game'
                )}
            </Button>
        </div>
    );
}
