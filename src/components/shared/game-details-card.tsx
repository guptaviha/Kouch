"use client";

import { GameDetails } from '@/types/game-details';
import { FaClock, FaUsers, FaTag } from 'react-icons/fa';
import GenericCard from './generic-card';
import BadgeWithIcon from './badge-with-icon';

interface GameDetailsCardProps {
  gameDetails: GameDetails;
};

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
            <BadgeWithIcon variant="inline" icon={<FaClock />} text={gameDetails.estimatedTime} className="text-blue-700 dark:text-blue-300" />
            <BadgeWithIcon variant="inline" icon={<FaUsers />} text={`${gameDetails.minPlayers}-${gameDetails.maxPlayers} Players`} className="text-purple-700 dark:text-purple-300" />
          </div>
        </div>
      </div>

      {/* Description and Tags Section */}

      <p className="my-4 text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
        {gameDetails.description}
      </p>
      <div className="flex flex-wrap gap-3">
        {gameDetails.features.map((feature) => (
          <BadgeWithIcon key={feature} variant="tag" icon={<FaTag />} text={feature} iconClass="text-gray-500 dark:text-gray-400" />
        ))}
      </div>
    </GenericCard>
  );
}
