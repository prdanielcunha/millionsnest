export function normalizeSlug(name: string): string {
  if (!name) return '';
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "") // remove special chars except space
    .replace(/\s+/g, "") // remove spaces (as requested by user "O sistema deve: tirar espaços")
    // Note: the prompt asks to "tirar espaços" (e.g. "Cunha Kept" -> "cunhakept", "OBPC Monte Castelo" -> "obpcmontecastelo")
    .replace(/-+/g, "-") // remove double hyphens if any
    .replace(/^-|-$/g, ""); // remove leading/trailing hyphens
}

export const RESERVED_PUBLIC_ROUTES = [
  'login', 'dashboard', 'pricing', 'checkout', 'invite', 'join', 
  'start', 'admin', 'api', 'support', 'billing', 'apps', 'settings',
  'termos-de-uso', 'politica-de-privacidade', 'politicas-de-reembolso', 'politicas-de-cancelamento',
  'upgrade', 'org', 'organizations', 'musicscale', 'millionsnest', 'api'
];

export function isReservedSlug(slug: string): boolean {
  return RESERVED_PUBLIC_ROUTES.includes(slug);
}
