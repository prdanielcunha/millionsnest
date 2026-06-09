import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, collection } from "firebase/firestore";
import { auth, db } from "../lib/firebase.js";
import { getDefaultPermissions, CURRENT_PERMISSIONS_VERSION } from "../lib/rbac.js";
import { analytics } from "../lib/analytics.js";
import { withTimeout } from "../lib/utils.js";
import { sanitizeForFirestore } from "../lib/firestoreUtils.js";

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
  systemRole?: 'ceo' | 'admin' | 'global_admin' | 'user';
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
  switchOrganization: (orgId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  canonicalContext: null,
  loading: true,
  logout: async () => {},
  switchOrganization: async () => {},
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

  const switchOrganization = async (orgId: string) => {
    if (!user || !profile) return;
    try {
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, { 
        organizationId: orgId,
        activeOrganizationId: orgId
      }, { merge: true });
      const updatedProfile = { ...profile, organizationId: orgId, activeOrganizationId: orgId };
      setProfile(updatedProfile);
      localStorage.setItem('mn_user_profile', JSON.stringify(updatedProfile));
      localStorage.removeItem('mn_support_session');
      
      // We must reload the page or tell OrganizationContext to refetch, changing profile.organizationId should trigger OrganizationContext's useEffect
      
      analytics.track('app_usage', {
        userId: user.uid,
        organizationId: orgId,
        metadata: { action: 'switch_organization' }
      });
    } catch (e) {
      console.error("Failed to switch organization", e);
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
              const idToken = await currentUser.getIdToken(true);
              const res = await fetch('/api/user/organization-context', {
                headers: { 'Authorization': `Bearer ${idToken}` }
              });
              if (res.ok) {
                const canonicalCtx = await res.json();
                setCanonicalContext(canonicalCtx);
                if (canonicalCtx.activeOrganizationId && canonicalCtx.activeOrganizationId !== userData.activeOrganizationId) {
                  mergeData.activeOrganizationId = canonicalCtx.activeOrganizationId;
                  userData.activeOrganizationId = canonicalCtx.activeOrganizationId;
                }
                if (canonicalCtx.primaryOrganizationId && canonicalCtx.primaryOrganizationId !== userData.primaryOrganizationId) {
                  mergeData.primaryOrganizationId = canonicalCtx.primaryOrganizationId;
                  userData.primaryOrganizationId = canonicalCtx.primaryOrganizationId;
                }
                // Avoid using legacy userData.organizationId locally if activeOrganizationId exists
                if (canonicalCtx.activeOrganizationId) {
                  mergeData.organizationId = canonicalCtx.activeOrganizationId;
                  userData.organizationId = canonicalCtx.activeOrganizationId;
                }
              }
            } catch (ctxErr) {
              console.error('Falha ao buscar contexto canônico no AuthContext:', ctxErr);
            }

            const inviteOrgId = localStorage.getItem('invite_org_id');
            const inviteRole = localStorage.getItem('invite_role') || 'member';

            // Auto-assign CEO role to specific email
            if (currentUser.email === 'pastordanielpcunha@gmail.com') {
              if (userData.systemRole !== 'ceo') {
                mergeData.systemRole = 'ceo';
                userData.systemRole = 'ceo';
              }
            }

            if (inviteOrgId) {
              const currentOrgs = userData.organizations || [];
              if (!currentOrgs.includes(inviteOrgId)) {
                mergeData.organizations = [...currentOrgs, inviteOrgId];
                userData.organizations = mergeData.organizations;
                
                // Add member doc to org
                const orgMemberRef = doc(db, 'organization_members', `${currentUser.uid}_${inviteOrgId}`);
                const newMemberRef = doc(db, `organizations/${inviteOrgId}/members`, currentUser.uid);
                const memberData = sanitizeForFirestore({
                  uid: currentUser.uid,
                  organizationId: inviteOrgId,
                  role: inviteRole,
                  permissionsVersion: CURRENT_PERMISSIONS_VERSION,
                  permissions: getDefaultPermissions(inviteRole),
                  createdAt: serverTimestamp()
                });
                await setDoc(orgMemberRef, memberData, { merge: true });
                await setDoc(newMemberRef, memberData, { merge: true });
              }
              // Switch active org to the invited org
              mergeData.organizationId = inviteOrgId;
              mergeData.activeOrganizationId = inviteOrgId;
              mergeData.primaryOrganizationId = inviteOrgId;
              userData.organizationId = inviteOrgId;
              userData.activeOrganizationId = inviteOrgId;
              userData.primaryOrganizationId = inviteOrgId;
              localStorage.removeItem('invite_org_id');
              localStorage.removeItem('invite_role');
            }

            await setDoc(userRef, sanitizeForFirestore(mergeData), { merge: true });
            
            const updatedProfile = { ...userData, lastLoginAt: new Date() };
            setProfile(updatedProfile);
            localStorage.setItem('mn_user_profile', JSON.stringify(updatedProfile));
            
            analytics.track('login', {
              userId: currentUser.uid,
              organizationId: updatedProfile.activeOrganizationId || updatedProfile.organizationId
            });
          } else {
            // Criar novo usuário e usa um ID único para seu workspace pessoal
            const targetOrgId = doc(collection(db, 'organizations')).id;

            const newProfile: Partial<UserProfile> = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              products: [],
              lastLoginAt: serverTimestamp(),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              organizationId: targetOrgId,
              primaryOrganizationId: targetOrgId,
              activeOrganizationId: targetOrgId,
              organizations: [targetOrgId],
              subscriptionStatus: 'none',
              systemRole: currentUser.email === 'pastordanielpcunha@gmail.com' ? 'ceo' : 
                          currentUser.email === 'danielcunhapastor@gmail.com' ? 'admin' : undefined
            };
            
            await setDoc(userRef, sanitizeForFirestore(newProfile));

            // Cria a organization default dele
            const orgRef = doc(db, 'organizations', targetOrgId as string);
            await setDoc(orgRef, sanitizeForFirestore({
              id: targetOrgId,
              name: `Organização de ${currentUser.displayName || currentUser.email?.split('@')[0]}`,
              slug: targetOrgId, // default slug
              ownerUid: currentUser.uid, // standardized field
              enabledApps: ['musicscale'], // default apps access
              subscriptionPlan: 'monthly',
              subscriptionStatus: 'none',
              status: 'active',
              createdAt: serverTimestamp()
            }), { merge: true });

            const orgMemberRef = doc(db, 'organization_members', `${currentUser.uid}_${targetOrgId}`);
            const newMemberRef = doc(db, `organizations/${targetOrgId}/members`, currentUser.uid);
            const memberData = sanitizeForFirestore({
              uid: currentUser.uid,
              organizationId: targetOrgId,
              role: 'owner',
              permissionsVersion: CURRENT_PERMISSIONS_VERSION,
              permissions: getDefaultPermissions('owner'),
              createdAt: serverTimestamp()
            });
            await setDoc(orgMemberRef, memberData, { merge: true });
            await setDoc(newMemberRef, memberData, { merge: true });

            setProfile(newProfile as UserProfile);
            localStorage.setItem('mn_user_profile', JSON.stringify(newProfile));
            
            // Cleanup any residual local storage invites
            localStorage.removeItem('invite_org_id');
            localStorage.removeItem('invite_role');

            analytics.track('signup', {
              userId: currentUser.uid,
              organizationId: targetOrgId
            });
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
    switchOrganization
  }), [user, profile, canonicalContext, loading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
