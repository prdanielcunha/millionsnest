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

export interface SupportCapabilitiesSuccessResponse {
  success: true;
  supportTier: SupportTier;
  hasPrioritySupport: boolean;
  canUseWhatsAppSupport: boolean;
  isWhatsAppConfigured: boolean;
  hasGlobalEntitlementOverride: boolean;
}

export interface SupportCapabilitiesFailureResponse {
  success: false;
  reasonCode: string;
}

export interface SupportWhatsAppLinkRequest {
  organizationId: string;
  locale: SupportLocale;
  message: string;
  appId?: string;
  pagePath?: string;
}

export interface SupportWhatsAppLinkSuccessResponse {
  success: true;
  url: string;
}

export interface SupportWhatsAppLinkFailureResponse {
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

export type PublicSalesContactIntent =
  | 'pricing'
  | 'pre_sales_question'
  | 'partnership'
  | 'general';

export interface PublicSalesWhatsAppRequest {
  intent: PublicSalesContactIntent;
  locale: 'pt' | 'en' | 'es';
  message?: string;
  pagePath?: string;
}

export interface PublicSalesWhatsAppSuccessResponse {
  success: true;
  url: string;
}

export interface PublicSalesWhatsAppFailureResponse {
  success: false;
  reasonCode: string; // INVALID_INTENT, INVALID_LOCALE, INVALID_MESSAGE, INVALID_PAGE_PATH, SALES_WHATSAPP_NOT_CONFIGURED, INTERNAL_ERROR
}
