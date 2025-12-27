"use client";

import { motion } from "framer-motion";
import { FaClock, FaUsers } from "react-icons/fa";
import { Play } from "lucide-react";
import { GameDetails } from "@/types/game-details";
import { GamePack } from "@/types/games";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store";
import { Button } from "./ui/button";
import BadgeWithIcon from "./shared/badge-with-icon";

interface GameCardProps {
  game: GameDetails;
}

export default function GameCard({ game }: GameCardProps) {
  const router = useRouter();
  const setSelectedPack = useGameStore((s) => s.setSelectedPack);

  const handlePlayGame = (e: React.MouseEvent, pack: GamePack) => {
    e.stopPropagation();
    setSelectedPack(pack);
    router.push(`/host/${pack}`);
  };

  return (
    <motion.div
      initial="rest"
      whileHover="hover"
      animate="rest"
      className="group relative h-[32rem] w-auto aspect-[3/4] cursor-pointer overflow-hidden rounded-3xl bg-card shadow-xl transition-all hover:shadow-2xl mx-auto"
      onClick={(e) => handlePlayGame(e, game.id)}
    >
      {/* Background Image with Zoom Effect */}
      <motion.div
        variants={{
          rest: { scale: 1 },
          hover: { scale: 1.1 },
        }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="absolute inset-0"
      >
        <img
          src={game.imageUrl}
          alt={game.title}
          className="h-full w-full object-cover transition-opacity duration-500"
        />
        {/* Gradient Overlay - Darker at bottom for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-90 transition-opacity duration-300 group-hover:opacity-100" />
      </motion.div>

      {/* Top Badges */}
      <div className="absolute top-4 right-4 flex gap-2">
        <BadgeWithIcon variant="overlay" icon={<FaClock className="h-4 w-4" />} text={game.estimatedTime} />
        <BadgeWithIcon variant="overlay" icon={<FaUsers className="h-4 w-4" />} text={`${game.minPlayers}-${game.maxPlayers}`} />
      </div>

      {/* Content Section */}
      <div className="absolute bottom-0 left-0 w-full p-8 z-10">
        <motion.div
          variants={{
            rest: { y: 20 },
            hover: { y: 0 },
          }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {/* Title - Add distinct shadow for better readability */}
          <h3 className="mb-3 text-4xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {game.title}
          </h3>

          {/* Expanded Content (Description + Button) */}
          <motion.div
            variants={{
              rest: { opacity: 0, height: 0 },
              hover: { opacity: 1, height: "auto" },
            }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="overflow-hidden"
          >
            {/* Description - brightened text and added shadow */}
            <p className="mb-6 text-lg leading-relaxed text-gray-100 line-clamp-3 drop-shadow-md font-medium">
              {game.description}
            </p>

            <Button
              onClick={(e) => handlePlayGame(e, game.id)}
              className="w-full bg-white text-black hover:bg-gray-200 font-bold rounded-xl py-6 text-lg transition-transform active:scale-95"
            >
              <Play className="mr-2 h-5 w-5 fill-current" />
              Play Now
            </Button>
          </motion.div>
        </motion.div>

        {/* Placeholder for layout stability when hidden */}
        {/* This ensures the title position is consistent before hover */}
        {/* However, since we are moving the whole block up, it should be fine. 
            Actually, let's keep it simple. The transforms above handle the movement.
        */}
      </div>
    </motion.div>
  );
}