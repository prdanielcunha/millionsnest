import React from 'react';
import { cn } from '../lib/utils.js';

type LogoProps = {
  /** Foreground color: light for dark surfaces, dark for light surfaces. */
  variant?: 'dark' | 'light';
  markOnly?: boolean;
  className?: string;
  loading?: 'eager' | 'lazy';
  decoding?: 'sync' | 'async';
};

export function MillionsNestLogo({ variant = 'light', markOnly = false, className = '', loading, decoding }: LogoProps) {
  const src = markOnly
    ? '/brand/millionsnest/v1/mark-192.png'
    : `/brand/millionsnest/v1/logo-on-${variant === 'light' ? 'dark' : 'light'}.png`;
  return <img
    src={src}
    alt="MillionsNest"
    width={markOnly ? 192 : 1400}
    height={markOnly ? 192 : 282}
    loading={loading}
    decoding={decoding}
    className={cn('block max-w-full shrink-0 object-contain', className)}
  />;
}
