import React from 'react';
import { cn } from '../lib/utils.js';

type LogoProps = {
  variant?: 'dark' | 'light';
  className?: string;
  loading?: "eager" | "lazy";
  decoding?: "sync" | "async";
};

export function MillionsNestLogo({ variant = 'light', className = '', loading, decoding }: LogoProps) {
  const src = '/MillionsNest_Black.png';

  return (
    <div className={cn("bg-white p-1.5 rounded-lg flex items-center justify-center shadow-sm", className)}>
      <img
        src={src}
        alt="MillionsNest Logo"
        loading={loading}
        decoding={decoding}
        className="h-full w-auto object-contain"
      />
    </div>
  );
}
