import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, collection } from "firebase/firestore";
import { auth, db } from "../lib/firebase.js";
import { getDefaultPermissions, CURRENT_PERMISSIONS_VERSION } from "../lib/rbac.js";
import { analytics } from "../lib/analytics.js";
import { withTimeout } from "../lib/utils.js";
import { sanitizeForFirestore } from "../lib/firestoreUtils.js";
import { parseInvitationRedirectPath } from "../lib/InvitationRedirectPolicy.js";

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  products: string[]; // Legacy
  organizationId?: string; // Active Org
  defaultOrganizationId?: string;
  primaryOrganizationId?: string;
  activeOrganizationId?: string;
  organizations?: string[]; // Standardized ecosystem field
  subscriptionStatus?: string; // Standardized ecosystem field
  systemRole?: 'ceo' | 'global_admin' | 'ecosystem_owner' | 'founder' | 'ecosystem_support' | 'user';
  lastLoginAt: any;
  createdAt: any;
  updatedAt?: any;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  canonicalContext: any | null;
  loading: boolean;
  logout: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<{ success: boolean; activeOrganizationId?: string; error?: string }>;
  switchingOrganizationId: string | null;
  organizationSwitchError: string | null;
  clearOrganizationSwitchError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  canonicalContext: null,
  loading: true,
  logout: async () => {},
  switchOrganization: async () => ({ success: false }),
  switchingOrganizationId: null,
  organizationSwitchError: null,
  clearOrganizationSwitchError: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [canonicalContext, setCanonicalContext] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const cached = localStorage.getItem('mn_user_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [switchingOrganizationId, setSwitchingOrganizationId] = useState<string | null>(null);
  const [organizationSwitchError, setOrganizationSwitchError] = useState<string | null>(null);

  const clearOrganizationSwitchError = () => setOrganizationSwitchError(null);

  const switchOrganization = async (orgId: string): Promise<{ success: boolean; activeOrganizationId?: string; error?: string }> => {
    if (!user || !profile || !canonicalContext) {
      return { success: false, error: 'User not authenticated or context not loaded' };
    }
    
    if (!orgId) {
      return { success: false, error: 'Invalid organization ID' };
    }
    
    const existsInContext = canonicalContext.organizations?.some((org: any) => org.id === orgId);
    if (!existsInContext) {
      return { success: false, error: 'User does not belong to this organization' };
    }
    
    if (canonicalContext.activeOrganizationId === orgId) {
      return { success: true, activeOrganizationId: orgId };
    }
    
    if (switchingOrganizationId) {
       return { success: false, error: 'Another switch is in progress' };
    }
    
    setSwitchingOrganizationId(orgId);
    setOrganizationSwitchError(null);
    
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/v1/user/active-organization', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
         },
         body: JSON.stringify({ organizationId: orgId })
      });
      
      const jsonRes = await res.json();
      
      if (!res.ok || !jsonRes.success || jsonRes.activeOrganizationId !== orgId) {
         throw new Error(jsonRes.reasonCode || 'Failed to switch active organization');
      }

      const ctxRes = await fetch('/api/user/organization-context', {
         headers: { 'Authorization': `Bearer ${idToken}` }
      });
      
      if (!ctxRes.ok) {
         throw new Error('Failed to load updated organization context');
      }
      
      const updatedCtx = await ctxRes.json();
      
      if (updatedCtx.activeOrganizationId !== orgId) {
         throw new Error('Server confirmed switch but returned incorrect context');
      }

      setCanonicalContext(updatedCtx);

      const updatedProfile = { 
        ...profile, 
        organizationId: orgId, 
        activeOrganizationId: orgId,
        primaryOrganizationId: updatedCtx.primaryOrganizationId
      };
      setProfile(updatedProfile);
      localStorage.setItem('mn_user_profile', JSON.stringify(updatedProfile));
      
      localStorage.removeItem('mn_org_context');
      localStorage.removeItem('mn_support_session');
      localStorage.removeItem('musicscale_active_tab');
      localStorage.removeItem('musicscale_selected_scale_id');
      localStorage.removeItem('musicscale_selected_song_id');
      
      window.dispatchEvent(new CustomEvent('mn_tenant_switched', { detail: { organizationId: orgId } }));

      try {
        analytics.track('app_usage', {
          userId: user.uid,
          organizationId: orgId,
          metadata: { action: 'switch_organization' }
        });
      } catch {}

      return { success: true, activeOrganizationId: orgId };
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Não foi possível alterar a organização.';
      setOrganizationSwitchError(errorMessage);
      console.error("Failed to switch organization", err);
      return { success: false, error: errorMessage };
    } finally {
      setSwitchingOrganizationId(null);
    }
  };

  useEffect(() => {
    if (!auth) {
      console.warn("Firebase Auth not initialized. Missing API Key.");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Obter ou criar o perfil do usuário no Firestore
        const userRef = doc(db, "users", currentUser.uid);
        
        try {
          const userSnap = await withTimeout(getDoc(userRef), 8000, "Firestore timeout loading user");
          
          if (userSnap.exists()) {
            const userData = userSnap.data() as UserProfile;
            let mergeData: any = { lastLoginAt: serverTimestamp() };
            
            try {
              const idToken = await currentUser.getIdToken();
              const res = await fetch('/api/user/organization-context', {
                headers: { 'Authorization': `Bearer ${idToken}` }
              });
              if (res.ok) {
                const canonicalCtx = await res.json();
                setCanonicalContext(canonicalCtx);
                if (canonicalCtx.activeOrganizationId && canonicalCtx.activeOrganizationId !== userData.activeOrganizationId) {
                  userData.activeOrganizationId = canonicalCtx.activeOrganizationId;
                }
                if (canonicalCtx.primaryOrganizationId && canonicalCtx.primaryOrganizationId !== userData.primaryOrganizationId) {
                  userData.primaryOrganizationId = canonicalCtx.primaryOrganizationId;
                }
                if (canonicalCtx.activeOrganizationId) {
                  userData.organizationId = canonicalCtx.activeOrganizationId;
                }
              }
            } catch (ctxErr) {
              console.error('Falha ao buscar contexto canônico no AuthContext:', ctxErr);
            }

            // Automatic promotion by email and localStorage invites removed per security audit P0-A
            setDoc(userRef, sanitizeForFirestore(mergeData), { merge: true }).catch(err => {
               console.error("Falha silenciosa ao atualizar lastLoginAt:", err);
            });
            
            const updatedProfile = { ...userData, lastLoginAt: new Date() };
            setProfile(updatedProfile);
            localStorage.setItem('mn_user_profile', JSON.stringify(updatedProfile));
            
            // Fire and forget analytics
            Promise.resolve().then(() => {
              analytics.track('login', {
                userId: currentUser.uid,
                organizationId: updatedProfile.activeOrganizationId || updatedProfile.organizationId
              });
            });
          } else {
            // New user without profile
            const inviteRedirect = sessionStorage.getItem('mn_invite_redirect');
            const parsedRedirect = parseInvitationRedirectPath(inviteRedirect);
            
            if (parsedRedirect.valid) {
                // Let Login/App handle the redirect to /join
                // Do not bootstrap automatically. Just set loading false and return.
                setProfile(null); // Or minimal profile if needed, but null forces them to stay in the flow
            } else {
                if (inviteRedirect !== null) {
                    sessionStorage.removeItem('mn_invite_redirect');
                }
                try {
                   const idToken = await currentUser.getIdToken(true);
                   const bootRes = await fetch('/api/v1/onboarding/bootstrap', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${idToken}` }
                   });
                   if (bootRes.ok) {
                      // Re-fetch user profile
                      const newUserSnap = await getDoc(userRef);
                      if (newUserSnap.exists()) {
                         const newProfileData = newUserSnap.data() as UserProfile;
                         setProfile(newProfileData);
                         localStorage.setItem('mn_user_profile', JSON.stringify(newProfileData));
                         
                         Promise.resolve().then(() => {
                           analytics.track('signup', {
                             userId: currentUser.uid,
                             organizationId: newProfileData.activeOrganizationId
                           });
                         });
                      }
                   }
                } catch (bootErr) {
                   console.error("Erro no bootstrap do usuário:", bootErr);
                }
            }
            
            // Cleanup any residual local storage invites just in case
            localStorage.removeItem('invite_org_id');
            localStorage.removeItem('invite_role');
          }
        } catch (error) {
          console.error("Erro ao carregar ou criar perfil do usuário:", error);
        }
      } else {
        setProfile(null);
        localStorage.removeItem('mn_user_profile');
        localStorage.removeItem('mn_org_context');
      }
      
      setLoading(false);
      window.performance?.mark?.('auth_restored');
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    localStorage.removeItem('mn_user_profile');
    localStorage.removeItem('mn_org_context');
    localStorage.removeItem('mn_support_session');
    await signOut(auth);
  };

  const contextValue = useMemo(() => ({
    user,
    profile,
    canonicalContext,
    loading,
    logout,
    switchOrganization,
    switchingOrganizationId,
    organizationSwitchError,
    clearOrganizationSwitchError,
  }), [user, profile, canonicalContext, loading, switchingOrganizationId, organizationSwitchError]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
