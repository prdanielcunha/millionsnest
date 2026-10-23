/** Resolve only public contact information from the configured Connect provider. Never follows redirects or sends a message. */
export async function officialSupportDestination(input: { product: string; source: 'website' | 'hub'; topic: 'help' | 'sales'; locale: string }, message: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const product = ['musicscale', 'nestfinance', 'nestjourney', 'nestlocal', 'nestaffiliate'].includes(input.product) ? input.product : 'hub';
  const locale = input.locale === 'en' ? 'en-US' : input.locale === 'es' ? 'es-ES' : 'pt-BR';
  const endpoint = new URL('https://connect.millionsnest.com/api/core/support/contact');
  endpoint.search = new URLSearchParams({ product, source: input.source, topic: input.topic, locale, open: '1' }).toString();
  const response = await fetchImpl(endpoint, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
  if (response.status !== 302) throw new Error('OFFICIAL_SUPPORT_UNAVAILABLE');
  const url = new URL(response.headers.get('location') ?? '');
  const marker = `[mn-support:v1:${product}:${input.source}:${input.topic}]`;
  if (url.origin !== 'https://wa.me' || url.username || url.password || url.hash || !/^\/[1-9][0-9]{7,14}$/.test(url.pathname) ||
      [...url.searchParams.keys()].some(k => k !== 'text') || !url.searchParams.get('text')?.includes(marker)) throw new Error('OFFICIAL_SUPPORT_UNAVAILABLE');
  url.searchParams.set('text', `${message}\n\n${marker}`);
  return url.toString();
}
