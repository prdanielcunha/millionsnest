import React from 'react';
import { nestFinanceBrand } from '../../brand/nestFinanceBrand.js';

type NestFinanceLogoProps = {
  surface?: 'dark' | 'light';
  layout?: 'horizontal' | 'vertical' | 'symbol';
  tagline?: boolean;
  compact?: boolean;
  width?: number | string;
  className?: string;
  priority?: boolean;
};

export const NestFinanceLogo: React.FC<NestFinanceLogoProps> = ({
  surface = 'light',
  layout = 'horizontal',
  tagline = true,
  compact = false,
  width,
  className = '',
  priority = false,
}) => {
  let src = '';
  let alt = '';

  if (layout === 'symbol') {
    src = nestFinanceBrand.symbols.gradient;
    alt = 'Símbolo NestFinance';
  } else if (layout === 'vertical') {
    src = surface === 'dark' 
      ? nestFinanceBrand.logos.dark.vertical 
      : nestFinanceBrand.logos.light.vertical;
    alt = 'NestFinance';
  } else {
    // horizontal
    if (compact || !tagline) {
      src = surface === 'dark' 
        ? nestFinanceBrand.logos.dark.horizontalCompact 
        : nestFinanceBrand.logos.light.horizontalCompact;
    } else {
      src = surface === 'dark' 
        ? nestFinanceBrand.logos.dark.horizontal 
        : nestFinanceBrand.logos.light.horizontal;
    }
    alt = 'NestFinance';
  }

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      className={`block object-contain object-left ${className}`}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      {...(priority ? { fetchpriority: 'high' } as any : {})}
    />
  );
};
