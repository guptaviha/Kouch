"use client";

import React from 'react';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'default' | 'destructive';
  floating?: boolean;
};

export default function ActionButton({ children, variant = 'primary', className = '', floating = false, ...props }: Props) {
  const base = 'rounded-2xl shadow-2xl font-bold transition-all text-2xl active:scale-95 inline-flex items-center justify-center';
  const variants: Record<string, string> = {
    primary: 'px-12 py-6 bg-blue-600 hover:bg-blue-700 text-white',
    destructive: 'px-4 py-2 bg-red-600 text-white hover:brightness-95',
  };
  const floatingClass = floating ? 'fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40' : '';
  const cls = `${base} ${variants[variant] ?? variants.primary} ${floatingClass} ${className}`;

  return (
    <button className={`${cls} disabled:opacity-50 disabled:cursor-not-allowed`} {...props}>
      {children}
    </button>
  );
}
