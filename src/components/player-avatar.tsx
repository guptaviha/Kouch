import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Check } from 'lucide-react';
// icon imports from react-icons
import { BsRobot } from 'react-icons/bs';
import { SiProbot } from 'react-icons/si';
import { PiDogFill } from 'react-icons/pi';
import { BiSolidCat } from 'react-icons/bi';
import { MdElderlyWoman, MdPregnantWoman, MdCatchingPokemon } from 'react-icons/md';
import { GiPyromaniac, GiMonkey, GiBatMask, GiSpiderMask, GiNinjaHead, GiSharkBite, GiDinosaurRex, GiSeaDragon, GiDirectorChair, GiWitchFlight, GiBirdTwitter } from 'react-icons/gi';
import { TbMichelinBibGourmand, TbMoodCrazyHappy } from 'react-icons/tb';
import { VscSnake } from 'react-icons/vsc';
import { RiAliensLine } from 'react-icons/ri';
import { FaUserAstronaut } from 'react-icons/fa';

const ICONS: Record<string, React.ComponentType<any>> = {
    BsRobot,
    SiProbot,
    PiDogFill,
    BiSolidCat,
    MdElderlyWoman,
    MdPregnantWoman,
    GiPyromaniac,
    TbMichelinBibGourmand,
    TbMoodCrazyHappy,
    GiMonkey,
    GiBatMask,
    GiSpiderMask,
    GiNinjaHead,
    VscSnake,
    GiSharkBite,
    GiDinosaurRex,
    GiSeaDragon,
    MdCatchingPokemon,
    GiDirectorChair,
    RiAliensLine,
    GiWitchFlight,
    FaUserAstronaut,
    GiBirdTwitter,
};

/**
 * Variant styling reference:
 * 
 * | Variant      | Size | Bounce | Background        | Ring               | Icon Size | Shadow | Notes                          |
 * |--------------|------|--------|-------------------|--------------------|-----------|--------|--------------------------------|
 * | default      | 48px | No     | Gray              | None               | 75%       | No     | Basic fallback style           |
 * | header       | 24px | No     | None              | None               | 100%      | No     | Minimal for navbar             |
 * | lobby        | 48px | Yes    | Gray/Purple ring  | Purple (2px)       | 80%       | Yes    | Waiting players, gentle bounce |
 * | game         | 64px | Yes*   | White             | Green/Blue/Gray    | 75%       | No     | Active play, bounce if waiting |
 * | winner       | 128px| No     | Yellow gradient   | Yellow (4px)       | 90%       | No     | Victory podium                 |
 * | leaderboard  | 48px | No     | Gray              | Blue (2px)         | 80%       | No     | Results display                |
 * | podium       | 64px | No     | Gray              | Gray (2px)         | 95%       | No     | 2nd+ place finishers           |
 */
export interface PlayerAvatarProps {
    avatarKey?: string;
    className?: string;
    variant?: 'default' | 'lobby' | 'game' | 'winner' | 'leaderboard' | 'header' | 'podium';
    state?: 'idle' | 'active' | 'disabled' | 'ready' | 'answered' | 'waiting';
    badge?: 'check' | 'hint' | number | string;
    showCrown?: boolean;
    index?: number; // For staggered animations in lists (lobby/game variants)
};

export default function PlayerAvatar({
    avatarKey,
    className = '',
    variant = 'default',
    state = 'idle',
    badge,
    showCrown = false,
    index = 0,
}: PlayerAvatarProps) {
    const key = typeof avatarKey === 'string' ? avatarKey.trim() : '';
    let Icon: React.ComponentType<any> | undefined = key ? ICONS[key] : undefined;
    
    if (!Icon && key) {
        const found = Object.keys(ICONS).find((k) => k.toLowerCase() === key.toLowerCase());
        if (found) Icon = ICONS[found];
    }

    // Size configuration based on variant
    let size = 48;
    switch (variant) {
        case 'header':
            size = 24;
            break;
        case 'lobby':
            size = 48;
            break;
        case 'game':
            size = 64;
            break;
        case 'winner':
            size = 128;
            break;
        case 'leaderboard':
            size = 48;
            break;
        case 'podium':
            size = 64;
            break;
        default:
            size = 48;
    }

    // Base container styles
    let containerClasses = 'rounded-full flex items-center justify-center relative transition-all duration-300 ';
    let iconSize = size * 0.75;
    let containerStyle: React.CSSProperties = { width: size, height: size };

    // Variant & State styles
    switch (variant) {
        case 'header':
            iconSize = size;
            break;
        case 'lobby':
            containerClasses += 'bg-gray-100 dark:bg-gray-800 shadow-inner ring-2 ring-purple-400 ';
            iconSize = size * 0.8;
            break;
        case 'game':
            containerClasses += 'bg-white dark:bg-gray-900 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 ';
            if (state === 'answered') {
                containerClasses += 'ring-green-500 ';
            } else if (state === 'active' || state === 'ready') {
                containerClasses += 'ring-blue-400 ';
            } else {
                containerClasses += 'ring-gray-300 opacity-70 ';
            }
            break;
        case 'winner':
            containerClasses += 'bg-yellow-200 dark:bg-yellow-900/30 ring-4 ring-yellow-400 shadow-xl ';
            iconSize = size * 0.9;
            break;
        case 'leaderboard':
            containerClasses += 'bg-gray-200 dark:bg-gray-700 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 ring-blue-400 ';
            iconSize = size * 0.8;
            break;
        case 'podium':
            containerClasses += 'bg-gray-200 dark:bg-gray-700 ring-2 ring-gray-300 dark:ring-gray-600 ';
            iconSize = size * 0.95;
            break;
        default:
            containerClasses += 'bg-gray-200 dark:bg-gray-700 ';
            if (state === 'disabled') containerClasses += 'opacity-50 grayscale ';
            break;
    }

    // Merge custom className
    containerClasses += className;

    // Bounce animation configuration based on variant and state
    const bounceDelay = index * 0.2; // Stagger based on index
    let bounceAnim = {};
    let bounceTransition = {};
    
    if (variant === 'lobby') {
        // Lobby: gentle continuous bounce for waiting players
        bounceAnim = { y: [0, -6, 0] };
        bounceTransition = {
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: bounceDelay,
        };
    } else if (variant === 'game' && state === 'waiting') {
        // Game: bounce only if waiting for answer
        bounceAnim = { y: [0, -6, 0] };
        bounceTransition = {
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: bounceDelay,
        };
    }

    // Shadow configuration - automatic for lobby variant
    const shouldShowShadow = variant === 'lobby';

    return (
        <div className="relative flex flex-col items-center">
            {showCrown && (
                <motion.div
                    animate={{ y: [-5, 0, -5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-4xl mb-2 absolute -top-12 z-20"
                >
                    👑
                </motion.div>
            )}
            
            <motion.div
                className={containerClasses}
                style={containerStyle}
                animate={bounceAnim}
                transition={bounceTransition}
            >
                <AnimatePresence>
                    {badge && (
                        <motion.div
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0 }}
                            className={`absolute -top-1 -right-1 z-10 shadow-lg border-2 border-white dark:border-gray-900 rounded-full flex items-center justify-center
                                ${badge === 'check' ? 'bg-green-500 text-white p-1' : 
                                  badge === 'hint' ? 'bg-yellow-400 text-yellow-900 p-1' : 
                                  'bg-gradient-to-br from-yellow-400 to-yellow-500 text-yellow-900 font-bold'}`}
                            style={typeof badge === 'number' || typeof badge === 'string' && badge !== 'check' && badge !== 'hint' ? {
                                width: size * 0.4,
                                height: size * 0.4,
                                fontSize: size * 0.2,
                                bottom: -size * 0.1,
                                right: -size * 0.1,
                                top: 'auto'
                            } : {}}
                        >
                            {badge === 'check' && <Check size={Math.max(12, size * 0.25)} />}
                            {badge === 'hint' && <Lightbulb size={Math.max(12, size * 0.25)} />}
                            {(typeof badge === 'number' || (typeof badge === 'string' && badge !== 'check' && badge !== 'hint')) && badge}
                        </motion.div>
                    )}
                </AnimatePresence>

                {Icon ? (
                    <Icon size={iconSize} />
                ) : (
                    <div style={{ width: iconSize, height: iconSize }} className="rounded-full bg-gray-300 dark:bg-gray-600" />
                )}
            </motion.div>

            {shouldShowShadow && (
                <div 
                    className="absolute -bottom-2 bg-black/10 rounded-[100%] blur-sm left-1/2 -translate-x-1/2 animate-pulse"
                    style={{ width: size * 0.6, height: size * 0.1 }}
                />
            )}
        </div>
    );
}
