export type SupportLocale = 'pt' | 'en' | 'es';

export type SupportChannel = 'form';

export type SupportCategory =
  | 'general'
  | 'access'
  | 'billing'
  | 'organization'
  | 'musicscale'
  | 'bug'
  | 'other';

export type SupportTier = 'standard' | 'basic_priority' | 'priority';

export interface SupportTicketRequest {
  requestId: string;
  organizationId: string;
  category: SupportCategory;
  message: string;
  whatsapp?: string;
  appId?: string;
  pagePath?: string;
  locale: SupportLocale;
}

export interface SupportTicketSuccessResponse {
  success: true;
  ticketId: string;
  reference: string;
  status: 'open';
}

export interface SupportTicketFailureResponse {
  success: false;
  reasonCode: string;
}

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  'general',
  'access',
  'billing',
  'organization',
  'musicscale',
  'bug',
  'other'
];
