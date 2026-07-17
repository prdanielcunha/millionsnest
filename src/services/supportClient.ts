import { 
  SupportTicketRequest, 
  SupportTicketSuccessResponse, 
  SupportTicketFailureResponse,
  SupportCapabilitiesSuccessResponse,
  SupportCapabilitiesFailureResponse
} from '../lib/supportContracts.js';

export interface SubmitSupportTicketParams {
  user: {
    getIdToken: () => Promise<string>;
  };
  request: SupportTicketRequest;
  signal?: AbortSignal;
}

export interface LoadSupportCapabilitiesParams {
  user: {
    getIdToken: () => Promise<string>;
  };
  organizationId: string;
  signal?: AbortSignal;
}

export async function loadSupportCapabilities(
  params: LoadSupportCapabilitiesParams
): Promise<SupportCapabilitiesSuccessResponse | SupportCapabilitiesFailureResponse> {
  const { user, organizationId, signal } = params;

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
      return {
        success: true,
        supportTier: data.supportTier,
        hasPrioritySupport: data.hasPrioritySupport,
        canUseWhatsAppSupport: data.canUseWhatsAppSupport,
        hasGlobalEntitlementOverride: data.hasGlobalEntitlementOverride
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
