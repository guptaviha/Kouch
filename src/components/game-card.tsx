"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { MdPhoneIphone } from 'react-icons/md';
import { GameDetails } from "@/types/game-details";
import { GamePack } from "@/types/games";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store";
import { useState } from "react";

interface GameCardProps {
  game: GameDetails;
}

export default function GameCard({ game }: GameCardProps) {
  const router = useRouter();
  const setSelectedPack = useGameStore((s) => s.setSelectedPack);
  const [isHovered, setIsHovered] = useState(false);

  const handlePlayGame = (pack: GamePack) => {
    setSelectedPack(pack);
    router.push(`/host/${pack}`);
  };

  const colorClass = game.id === 'trivia' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400';
  const bgClass = game.id === 'trivia' ? 'bg-purple-100 dark:bg-purple-900/20' : 'bg-orange-100 dark:bg-orange-900/20';
  const btnClass = game.id === 'trivia' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-orange-600 hover:bg-orange-700';
  const shadowClass = game.id === 'trivia' ? 'hover:shadow-purple-500/10' : 'hover:shadow-orange-500/10';

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className={`relative overflow-hidden rounded-3xl border border-border bg-card hover:shadow-2xl ${shadowClass} transition-all duration-300 cursor-pointer h-[36rem]`}
      onClick={() => handlePlayGame(game.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={game.imageUrl}
          alt={`${game.title} game`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 pt-8 pr-8 pl-8 h-full flex flex-col justify-between">
        {/* Top Section */}
        <div className="flex items-start justify-between">
          <div className={`p-4 ${bgClass} rounded-2xl backdrop-blur-sm bg-white/20 border border-white/20 flex items-center justify-center shadow-lg`}>
            <MdPhoneIphone className={`w-12 h-12 ${colorClass} drop-shadow-lg`} />
          </div>
          <div className="flex flex-col gap-2 bg-black/60 rounded-2xl px-6 py-3 border border-white/20 w-fit ml-auto text-white text-2xl font-bold shadow-lg">
            <div className="flex items-center justify-center">
              <span className="text-xl font-semibold">{game.estimatedTime}</span>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div>
          {/* Description - Only visible on hover */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 10 }}
            transition={{ duration: 0.2 }}
            className="transition-opacity duration-300"
          >
            <div className="bg-black/40 backdrop-blur-sm rounded-xl p-4 border border-white/20 -mx-8 w-[calc(100%+4rem)]">
              <h3 className="text-3xl font-bold text-white mb-3 drop-shadow-lg">
                {game.title}
              </h3>
              <p className="text-white/90 text-xl leading-relaxed">
                {game.description}
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}