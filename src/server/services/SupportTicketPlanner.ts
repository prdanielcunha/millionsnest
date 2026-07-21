import { SupportCategory, SupportLocale, SUPPORT_CATEGORIES } from '../../lib/supportContracts.js';

export interface PlanSupportTicketRequestResult {
  success: boolean;
  reasonCode?: string;
  normalized?: {
    requestId: string;
    organizationId: string;
    category: SupportCategory;
    message: string;
    whatsapp: string | null;
    appId: string | null;
    pagePath: string | null;
    locale: SupportLocale;
  };
}

export function planSupportTicketRequest(input: any, nowMs: number): PlanSupportTicketRequestResult {
  if (!input || typeof input !== 'object') {
    return { success: false, reasonCode: 'INVALID_REQUEST' };
  }

  // 1. Validate requestId
  const { requestId } = input;
  if (!requestId || typeof requestId !== 'string') {
    return { success: false, reasonCode: 'INVALID_REQUEST_ID' };
  }
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const cleanRequestId = requestId.trim();
  if (cleanRequestId.length > 64 || cleanRequestId.includes(' ') || !uuidRegex.test(cleanRequestId)) {
    return { success: false, reasonCode: 'INVALID_REQUEST_ID' };
  }

  // 2. Validate organizationId
  const { organizationId } = input;
  if (!organizationId || typeof organizationId !== 'string') {
    return { success: false, reasonCode: 'INVALID_ORGANIZATION_ID' };
  }
  const cleanOrgId = organizationId.trim();
  if (
    !cleanOrgId ||
    cleanOrgId.length > 128 ||
    cleanOrgId.includes('/') ||
    cleanOrgId.includes('..') ||
    cleanOrgId.includes('http:') ||
    cleanOrgId.includes('https:') ||
    !/^[a-zA-Z0-9\-_]+$/.test(cleanOrgId)
  ) {
    return { success: false, reasonCode: 'INVALID_ORGANIZATION_ID' };
  }

  // 3. Validate category
  const { category } = input;
  if (!category || !SUPPORT_CATEGORIES.includes(category)) {
    return { success: false, reasonCode: 'INVALID_CATEGORY' };
  }

  // 4. Validate message
  const { message } = input;
  if (!message || typeof message !== 'string') {
    return { success: false, reasonCode: 'MESSAGE_TOO_SHORT' };
  }
  const trimmedMessage = message.trim();
  if (trimmedMessage.length < 20) {
    return { success: false, reasonCode: 'MESSAGE_TOO_SHORT' };
  }
  if (trimmedMessage.length > 4000) {
    return { success: false, reasonCode: 'MESSAGE_TOO_LONG' };
  }
  // Remove control characters except for tabs, newline, and carriage returns
  const cleanMsg = trimmedMessage.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');

  // 5. Validate whatsapp
  let whatsappValue: string | null = null;
  if (input.whatsapp !== undefined && input.whatsapp !== null && input.whatsapp !== '') {
    if (typeof input.whatsapp !== 'string') {
      return { success: false, reasonCode: 'INVALID_WHATSAPP' };
    }
    const cleanWp = input.whatsapp.trim();
    if (cleanWp.length > 30) {
      return { success: false, reasonCode: 'INVALID_WHATSAPP' };
    }
    // Accept only numbers, spaces, +, -, and parentheses
    if (!/^[0-9\s+\-()]+$/.test(cleanWp)) {
      return { success: false, reasonCode: 'INVALID_WHATSAPP' };
    }
    // Require plausible amount of digits (minimum 5 digits)
    const digitsOnly = cleanWp.replace(/\D/g, '');
    if (digitsOnly.length < 5) {
      return { success: false, reasonCode: 'INVALID_WHATSAPP' };
    }
    whatsappValue = cleanWp;
  }

  // 6. Validate appId
  let appIdValue: string | null = null;
  if (input.appId !== undefined && input.appId !== null && input.appId !== '') {
    if (typeof input.appId !== 'string') {
      return { success: false, reasonCode: 'INVALID_APP_ID' };
    }
    const cleanAppId = input.appId.trim();
    if (cleanAppId.length > 64 || !/^[a-z0-9\-_]+$/.test(cleanAppId)) {
      return { success: false, reasonCode: 'INVALID_APP_ID' };
    }
    appIdValue = cleanAppId;
  }

  // 7. Validate pagePath
  let pagePathValue: string | null = null;
  if (input.pagePath !== undefined && input.pagePath !== null && input.pagePath !== '') {
    if (typeof input.pagePath !== 'string') {
      return { success: false, reasonCode: 'INVALID_PAGE_PATH' };
    }
    let cleanPath = input.pagePath.trim();
    if (!cleanPath.startsWith('/') || cleanPath.startsWith('//') || cleanPath.length > 500) {
      return { success: false, reasonCode: 'INVALID_PAGE_PATH' };
    }
    const lowerPath = cleanPath.toLowerCase();
    if (lowerPath.includes('http:') || lowerPath.includes('https:') || lowerPath.includes('javascript:')) {
      return { success: false, reasonCode: 'INVALID_PAGE_PATH' };
    }
    // Remove excess query/hash fragments if extremely long or insecure, but keep safe path
    pagePathValue = cleanPath;
  }

  // 8. Validate locale
  const { locale } = input;
  if (locale !== 'pt' && locale !== 'en' && locale !== 'es') {
    return { success: false, reasonCode: 'INVALID_LOCALE' };
  }

  return {
    success: true,
    normalized: {
      requestId: cleanRequestId,
      organizationId: cleanOrgId,
      category,
      message: cleanMsg,
      whatsapp: whatsappValue,
      appId: appIdValue,
      pagePath: pagePathValue,
      locale
    }
  };
}
