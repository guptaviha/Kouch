"use client";

import React from 'react';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'default' | 'destructive';
};

export default function ActionButton({ children, variant = 'primary', className = '', ...props }: Props) {
  const base = 'rounded inline-flex items-center justify-center font-medium';
  const variants: Record<string, string> = {
    primary: 'px-6 py-3 bg-blue-600 text-white hover:brightness-95',
    default: 'px-4 py-2 bg-gray-100 text-gray-900 hover:brightness-95',
    destructive: 'px-4 py-2 bg-red-600 text-white hover:brightness-95',
  };

  const cls = `${base} ${variants[variant] ?? variants.primary} ${className}`;

  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}
