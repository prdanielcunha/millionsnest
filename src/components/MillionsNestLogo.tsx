import React from 'react';
import { cn } from '../lib/utils.js';

type LogoProps = {
  variant?: 'dark' | 'light';
  className?: string;
  loading?: "eager" | "lazy";
  decoding?: "sync" | "async";
};

export function MillionsNestLogo({ variant = 'light', className = '', loading, decoding }: LogoProps) {
  const src = variant === 'dark'
    ? '/MillionsNest_Black.png'
    : '/logo02.png';

  return (
    <img
      src={src}
      alt="MillionsNest Logo"
      loading={loading}
      decoding={decoding}
      className={cn('object-contain', className)}
    />
  );
}
