import { 
  SupportTicketRequest, 
  SupportTicketSuccessResponse, 
  SupportTicketFailureResponse,
  SupportCapabilitiesSuccessResponse,
  SupportCapabilitiesFailureResponse,
  SupportWhatsAppLinkRequest,
  SupportWhatsAppLinkSuccessResponse,
  SupportWhatsAppLinkFailureResponse
} from '../lib/supportContracts.js';

export interface SubmitSupportTicketParams {
  user: {
    getIdToken: () => Promise<string>;
    uid: string;
  };
  request: SupportTicketRequest;
  signal?: AbortSignal;
}

export interface LoadSupportCapabilitiesParams {
  user: {
    getIdToken: () => Promise<string>;
    uid: string;
  };
  organizationId: string;
  signal?: AbortSignal;
}

export interface CreateSupportWhatsAppLinkParams {
  user: {
    getIdToken: () => Promise<string>;
    uid: string;
  };
  request: SupportWhatsAppLinkRequest;
  signal?: AbortSignal;
}

interface CapabilitiesCacheEntry {
  data: SupportCapabilitiesSuccessResponse;
  expiresAt: number;
}

const capabilitiesCache = new Map<string, CapabilitiesCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function loadSupportCapabilities(
  params: LoadSupportCapabilitiesParams
): Promise<SupportCapabilitiesSuccessResponse | SupportCapabilitiesFailureResponse> {
  const { user, organizationId, signal } = params;
  const cacheKey = `${user.uid}:${organizationId}`;

  const cached = capabilitiesCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const token = await user.getIdToken();

    const response = await fetch(`/api/v1/support/capabilities?organizationId=${encodeURIComponent(organizationId)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Cache-Control': 'no-store'
      },
      signal
    });

    if (response.ok) {
      const data = await response.json();
      const successData: SupportCapabilitiesSuccessResponse = {
        success: true,
        supportTier: data.supportTier,
        hasPrioritySupport: data.hasPrioritySupport,
        canUseWhatsAppSupport: data.canUseWhatsAppSupport,
        isWhatsAppConfigured: data.isWhatsAppConfigured,
        hasGlobalEntitlementOverride: data.hasGlobalEntitlementOverride
      };
      
      capabilitiesCache.set(cacheKey, {
        data: successData,
        expiresAt: Date.now() + CACHE_TTL_MS
      });
      
      return successData;
    } else {
      try {
        const errorData = await response.json();
        return {
          success: false,
          reasonCode: errorData.reasonCode || 'INTERNAL_ERROR'
        };
      } catch (err) {
        return {
          success: false,
          reasonCode: 'INTERNAL_ERROR'
        };
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        reasonCode: 'TIMEOUT'
      };
    }
    return {
      success: false,
      reasonCode: 'INTERNAL_ERROR'
    };
  }
}

export async function createSupportWhatsAppLink(
  params: CreateSupportWhatsAppLinkParams
): Promise<SupportWhatsAppLinkSuccessResponse | SupportWhatsAppLinkFailureResponse> {
  const { user, request, signal } = params;

  try {
    const token = await user.getIdToken();

    const response = await fetch('/api/v1/support/whatsapp-link', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(request),
      signal
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        url: data.url
      };
    } else {
      try {
        const errorData = await response.json();
        return {
          success: false,
          reasonCode: errorData.reasonCode || 'INTERNAL_ERROR'
        };
      } catch (err) {
        return {
          success: false,
          reasonCode: response.status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR'
        };
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        reasonCode: 'TIMEOUT'
      };
    }
    return {
      success: false,
      reasonCode: 'INTERNAL_ERROR'
    };
  }
}

export async function submitSupportTicket(
  params: SubmitSupportTicketParams
): Promise<SupportTicketSuccessResponse | SupportTicketFailureResponse> {
  const { user, request, signal } = params;

  try {
    const token = await user.getIdToken();

    const response = await fetch('/api/v1/support/tickets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(request),
      signal
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        ticketId: data.ticketId,
        reference: data.reference,
        status: data.status
      };
    } else {
      try {
        const errorData = await response.json();
        return {
          success: false,
          reasonCode: errorData.reasonCode || 'INTERNAL_ERROR'
        };
      } catch (err) {
        return {
          success: false,
          reasonCode: response.status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR'
        };
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        reasonCode: 'TIMEOUT'
      };
    }
    return {
      success: false,
      reasonCode: 'INTERNAL_ERROR'
    };
  }
}
