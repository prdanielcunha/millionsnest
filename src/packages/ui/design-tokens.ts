/**
 * Enterprise Design Tokens for MillionsNest Ecosystem
 * These can be mapped to Tailwind config or consumed directly in JS-driven canvas engines.
 */

export const colors = {
  background: '#0B0F19',
  surface: '#111827',
  surfaceHover: '#1F2937',
  border: 'rgba(255, 255, 255, 0.1)',
  borderHover: 'rgba(255, 255, 255, 0.2)',
  
  primary: '#2B85EB',
  primaryHover: '#3B82F6',
  
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  
  text: {
    primary: '#F5F7FA',
    secondary: '#A0A7B5',
    muted: '#6B7280'
  }
};

export const radii = {
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.5rem',
  '3xl': '2rem',
  full: '9999px'
};

export const elevations = {
  base: '0 1px 3px rgba(0,0,0,0.1)',
  glass: '0 4px 30px rgba(0, 0, 0, 0.1)',
  deep: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
};

/**
 * Returns consistent glassmorphism styles directly when needed via styled-components or standard React style tags.
 */
export const getGlassStyles = (opacity: number = 0.5) => ({
  background: `rgba(11, 15, 25, ${opacity})`,
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${colors.border}`
});
