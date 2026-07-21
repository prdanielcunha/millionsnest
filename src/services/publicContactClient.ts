import { PublicSalesWhatsAppRequest, PublicSalesWhatsAppSuccessResponse } from '../lib/supportContracts.js';

export function resolvePublicContactLocale(language?: string | null): 'pt' | 'en' | 'es' {
  if (!language) return 'pt';
  const normalized = language.replace(/_/g, '-').toLowerCase();
  if (normalized.startsWith('pt')) return 'pt';
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('es')) return 'es';
  return 'pt';
}

export async function createPublicSalesWhatsAppLink(
  request: PublicSalesWhatsAppRequest,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch('/api/v1/public/sales/whatsapp-link', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(request),
    signal
  });

  if (!response.ok) {
    let errorMsg = 'Failed to generate contact link';
    try {
      const errorData = await response.json();
      if (errorData && errorData.reasonCode) {
        errorMsg = errorData.reasonCode;
      }
    } catch (e) {
      // Ignore parsing error
    }
    throw new Error(errorMsg);
  }

  const data: PublicSalesWhatsAppSuccessResponse = await response.json();
  
  if (!data.success || !data.url) {
    throw new Error('Invalid response from server');
  }

  if (!data.url.startsWith('https://wa.me/')) {
    throw new Error('Invalid URL protocol returned from server');
  }

  return data.url;
}
