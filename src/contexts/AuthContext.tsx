import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase.js";
import { getDefaultPermissions, CURRENT_PERMISSIONS_VERSION } from "../lib/rbac.js";
import { analytics } from "../lib/analytics.js";
import { withTimeout } from "../lib/utils.js";

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  products: string[]; // Legacy
  organizationId?: string; // Active Org
  defaultOrganizationId?: string;
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
  loading: boolean;
  logout: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  logout: async () => {},
  switchOrganization: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
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
      await setDoc(userRef, { organizationId: orgId }, { merge: true });
      const updatedProfile = { ...profile, organizationId: orgId };
      setProfile(updatedProfile);
      localStorage.setItem('mn_user_profile', JSON.stringify(updatedProfile));
      
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
            
            // Check for pending invite logic if needed locally?
            const inviteOrgId = localStorage.getItem('invite_org_id');
            const inviteRole = localStorage.getItem('invite_role') || 'member';
            let mergeData: any = { lastLoginAt: serverTimestamp() };
            
            // Auto-assign CEO role to specific email
            if (currentUser.email === 'pastordanielpcunha@gmail.com') {
              if (userData.systemRole !== 'ceo') {
                mergeData.systemRole = 'ceo';
                userData.systemRole = 'ceo';
              }
              const orgIdToHeal = userData.defaultOrganizationId || userData.organizationId || currentUser.uid;
              if (orgIdToHeal) {
                mergeData.organizationId = orgIdToHeal;
                mergeData.defaultOrganizationId = orgIdToHeal;
                userData.organizationId = orgIdToHeal;
                userData.defaultOrganizationId = orgIdToHeal;
                
                const healMemberData = {
                  uid: currentUser.uid,
                  email: currentUser.email,
                  organizationRole: 'owner',
                  role: 'owner',
                  status: 'active',
                  permissionsVersion: CURRENT_PERMISSIONS_VERSION,
                  permissions: getDefaultPermissions('owner')
                };
                await setDoc(doc(db, 'organization_members', `${currentUser.uid}_${orgIdToHeal}`), healMemberData, { merge: true });
                await setDoc(doc(db, `organizations/${orgIdToHeal}/members`, currentUser.uid), healMemberData, { merge: true });
                await setDoc(doc(db, 'organizations', orgIdToHeal), { ownerUid: currentUser.uid }, { merge: true });
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
                const memberData = {
                  uid: currentUser.uid,
                  organizationId: inviteOrgId,
                  role: inviteRole,
                  permissionsVersion: CURRENT_PERMISSIONS_VERSION,
                  permissions: getDefaultPermissions(inviteRole),
                  createdAt: serverTimestamp()
                };
                await setDoc(orgMemberRef, memberData, { merge: true });
                await setDoc(newMemberRef, memberData, { merge: true });
              }
              // Switch active org to the invited org
              mergeData.organizationId = inviteOrgId;
              userData.organizationId = inviteOrgId;
              localStorage.removeItem('invite_org_id');
              localStorage.removeItem('invite_role');
            }

            // Atualizar lastLoginAt e possível org
            await setDoc(userRef, mergeData, { merge: true });
            
            const updatedProfile = { ...userData, lastLoginAt: new Date() };
            setProfile(updatedProfile);
            localStorage.setItem('mn_user_profile', JSON.stringify(updatedProfile));
            
            analytics.track('login', {
              userId: currentUser.uid,
              organizationId: updatedProfile.organizationId || currentUser.uid
            });
          } else {
            // Criar novo usuário
            const inviteOrgId = localStorage.getItem('invite_org_id');
            const inviteRole = localStorage.getItem('invite_role') || 'member';
            const targetOrgId = inviteOrgId || currentUser.uid;

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
              organizations: [targetOrgId],
              subscriptionStatus: 'none',
              systemRole: currentUser.email === 'pastordanielpcunha@gmail.com' ? 'ceo' : undefined
            };
            
            await setDoc(userRef, newProfile);

            // Se é o dono dessa nova org (não foi convidado), cria a organization default dele
            if (!inviteOrgId) {
               const orgRef = doc(db, 'organizations', targetOrgId);
               await setDoc(orgRef, {
                 id: targetOrgId,
                 name: `Organização de ${currentUser.displayName || currentUser.email?.split('@')[0]}`,
                 slug: targetOrgId, // default slug
                 ownerUid: currentUser.uid, // standardized field
                 ownerId: currentUser.uid, // legacy field
                 enabledApps: ['musicscale'], // default apps access
                 subscriptionPlan: 'monthly',
                 subscriptionStatus: 'none',
                 createdAt: serverTimestamp()
               }, { merge: true });

               const orgMemberRef = doc(db, 'organization_members', `${currentUser.uid}_${targetOrgId}`);
               const newMemberRef = doc(db, `organizations/${targetOrgId}/members`, currentUser.uid);
               const memberData = {
                 uid: currentUser.uid,
                 organizationId: targetOrgId,
                 role: 'owner',
                 permissionsVersion: CURRENT_PERMISSIONS_VERSION,
                 permissions: getDefaultPermissions('owner'),
                 createdAt: serverTimestamp()
               };
               await setDoc(orgMemberRef, memberData, { merge: true });
               await setDoc(newMemberRef, memberData, { merge: true });
            } else {
               // Invited new user logic (member)
               const orgMemberRef = doc(db, 'organization_members', `${currentUser.uid}_${targetOrgId}`);
               const newMemberRef = doc(db, `organizations/${targetOrgId}/members`, currentUser.uid);
               const memberData = {
                 uid: currentUser.uid,
                 organizationId: targetOrgId,
                 role: inviteRole,
                 permissionsVersion: CURRENT_PERMISSIONS_VERSION,
                 permissions: getDefaultPermissions(inviteRole),
                 createdAt: serverTimestamp()
               };
               await setDoc(orgMemberRef, memberData, { merge: true });
               await setDoc(newMemberRef, memberData, { merge: true });
            }

            if (inviteOrgId) {
               localStorage.removeItem('invite_org_id');
               localStorage.removeItem('invite_role');
            }

            setProfile(newProfile as UserProfile);
            localStorage.setItem('mn_user_profile', JSON.stringify(newProfile));
            
            analytics.track('signup', {
              userId: currentUser.uid,
              organizationId: targetOrgId,
              metadata: { invite: !!inviteOrgId }
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
    await signOut(auth);
  };

  const contextValue = useMemo(() => ({
    user,
    profile,
    loading,
    logout,
    switchOrganization
  }), [user, profile, loading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
