"use client";

import { GameDetails } from '@/types/game-details';
import { FaClock, FaUsers, FaTag } from 'react-icons/fa';
import GenericCard from './generic-card';

interface GameDetailsCardProps {
  gameDetails: GameDetails;
}

export default function GameDetailsCard({ gameDetails }: GameDetailsCardProps) {
  return (
    <GenericCard
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="flex flex-col"
    >
      {/* Image and Title Section */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Image Section */}
        <div className="flex-shrink-0">
          <img
            src={gameDetails.imageUrl}
            alt={`${gameDetails.title} game`}
            className="w-72 h-117 object-cover rounded-lg shadow-md"
          />
        </div>

        {/* Title and Metadata Section */}
        <div className="flex flex-col flex-grow">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
            {gameDetails.title}
          </h1>
          <div className="flex flex-wrap gap-4 text-lg">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-semibold">
              <FaClock />
              <span>{gameDetails.estimatedTime}</span>
            </div>
            <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-semibold">
              <FaUsers />
              <span>{gameDetails.minPlayers}-{gameDetails.maxPlayers} Players</span>
            </div>
          </div>
        </div>
      </div>

      {/* Description and Tags Section */}

      <p className="my-4 text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
        {gameDetails.description}
      </p>
      <div className="flex flex-wrap gap-3">
        {gameDetails.features.map((feature) => (
          <div key={feature} className="flex items-center gap-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-full text-sm font-medium">
            <FaTag className="text-gray-500 dark:text-gray-400" />
            <span>{feature}</span>
          </div>
        ))}
      </div>
    </GenericCard>
  );
}
