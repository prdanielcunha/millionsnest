/** Public contact only. No account, organization, page query or credential enters this URL. */
export function officialSupportUrl(language: string, product = 'hub', source: 'website' | 'hub' = 'website') {
  const locale = language.startsWith('en') ? 'en-US' : language.startsWith('es') ? 'es-ES' : 'pt-BR';
  const allowed = ['hub', 'musicscale', 'nestfinance', 'nestjourney', 'nestlocal', 'nestaffiliate'];
  const url = new URL('https://connect.millionsnest.com/api/core/support/contact');
  url.search = new URLSearchParams({ product: allowed.includes(product) ? product : 'hub', source, locale }).toString();
  return url.toString();
}
