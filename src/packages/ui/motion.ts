/**
 * Shared Motion Tokens for MillionsNest Ecosystem
 */

export const easings = {
  // Snappy but smooth, intended for UI elements like modals, drawers
  spring: {
    type: 'spring',
    damping: 20,
    stiffness: 300
  },
  // Smooth CSS-like transition for color/opacity
  easeOut: [0.25, 1, 0.5, 1],
  easeInOut: [0.65, 0, 0.35, 1],
  // Premium feel for large layout shifts
  premium: [0.32, 0.72, 0, 1]
};

export const durations = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
  layout: 0.6
};

export const framerTokens = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: durations.base, ease: easings.easeOut }
  },
  slideUp: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
    transition: { type: 'spring', damping: 25, stiffness: 300 }
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { type: 'spring', damping: 25, stiffness: 350 }
  }
};
