import React from 'react';

interface BadgeWithIconProps {
  icon: React.ReactNode;
  text: string;
  variant?: 'overlay' | 'inline' | 'tag';
  className?: string;
  iconClass?: string;
}

export default function BadgeWithIcon({ icon, text, variant = 'overlay', className = '', iconClass = '' }: BadgeWithIconProps) {
  const baseClass = variant === 'overlay'
    ? 'rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md border border-white/20 shadow-lg'
    : variant === 'inline'
    ? 'text-lg font-semibold'
    : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-full text-sm font-medium';

  return (
    <div className={`flex items-center gap-2 ${baseClass} ${className}`}>
      <span className={iconClass}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}