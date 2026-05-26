/**
 * Shared Authenticaton primitives for MillionsNest OS
 */

export interface MNUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  systemRole: 'ceo' | 'global_admin' | 'user';
}

export interface MNOrganizationSession {
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: string; // From permissions module
  subscriptionStatus: 'active' | 'past_due' | 'canceled' | 'trialing';
}

/**
 * Normalizes multi-tenant identities, providing standard helpers
 * without hard-coupling to Firebase Auth specifically.
 */
export class AuthSessionManager {
  
  /**
   * Retrieves the current strictly active session combination
   */
  public static getCurrentContext(): { user: MNUser | null, orgContext: MNOrganizationSession | null } {
    if (typeof window === 'undefined') return { user: null, orgContext: null };
    
    try {
      const userStr = localStorage.getItem('mn_user');
      const orgStr = localStorage.getItem('mn_org_context');
      
      return {
        user: userStr ? JSON.parse(userStr) : null,
        orgContext: orgStr ? JSON.parse(orgStr) : null
      };
    } catch {
      return { user: null, orgContext: null };
    }
  }

  /**
   * Persist context for high-performance retrieval (preventing waterfall DB queries)
   */
  public static setContext(user: MNUser, orgContext: MNOrganizationSession | null) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('mn_user', JSON.stringify(user));
    if (orgContext) {
      localStorage.setItem('mn_org_context', JSON.stringify(orgContext));
    }
  }

  public static clear() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('mn_user');
    localStorage.removeItem('mn_org_context');
    sessionStorage.removeItem('mn_session_id');
  }
}
