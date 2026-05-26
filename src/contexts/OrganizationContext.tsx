import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { useAuth } from "./AuthContext.js";
import { withTimeout } from "../lib/utils.js";

interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerUid: string;
  enabledApps: string[];
  subscriptionPlan: string;
  subscriptionStatus: string;
  createdAt: any;
}

interface MemberPermissions {
  [key: string]: boolean;
}

interface MemberRole {
  role: string;
  permissions: MemberPermissions;
  permissionsVersion: number;
}

interface OrganizationContextType {
  organization: Organization | null;
  memberRole: MemberRole | null;
  loadingOrg: boolean;
  hasPermission: (permissionName: string) => boolean;
}

const OrganizationContext = createContext<OrganizationContextType>({
  organization: null,
  memberRole: null,
  loadingOrg: true,
  hasPermission: () => false,
});

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();
  
  // Try to load cached values to avoid wait times and flash of empty content
  const cachedContext = useMemo(() => {
    try {
      const stored = localStorage.getItem('mn_org_context');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const [organization, setOrganization] = useState<Organization | null>(cachedContext?.organization || null);
  const [memberRole, setMemberRole] = useState<MemberRole | null>(cachedContext?.memberRole || null);
  const [loadingOrg, setLoadingOrg] = useState(!cachedContext);

  useEffect(() => {
    let active = true;

    async function loadOrganization() {
      if (authLoading) return;
      
      if (!user || !profile || !profile.organizationId) {
        if (active) {
          setOrganization(null);
          setMemberRole(null);
          setLoadingOrg(false);
          localStorage.removeItem('mn_org_context');
        }
        return;
      }

      setLoadingOrg(true);
      try {
        const orgId = profile.organizationId;
        const orgRef = doc(db, "organizations", orgId);
        const orgSnap = await withTimeout(getDoc(orgRef), 8000, "Firestore timeout loading org");

        let currentOrg = null;
        if (orgSnap.exists()) {
          currentOrg = { id: orgSnap.id, ...orgSnap.data() } as Organization;
        }

        // Fetch user's role in this organization
        // We look at /organizations/{orgId}/members/{uid}
        const memberRef = doc(db, `organizations/${orgId}/members`, user.uid);
        const memberSnap = await withTimeout(getDoc(memberRef), 8000, "Firestore timeout loading member");
        
        let roleData = null;
        if (memberSnap.exists()) {
          roleData = memberSnap.data() as MemberRole;
        } else {
          // Fallback checking legacy organization_members collection if migration not 100% complete
          const legacyMemberRef = doc(db, 'organization_members', `${user.uid}_${orgId}`);
          const legacySnap = await withTimeout(getDoc(legacyMemberRef), 8000, "Firestore timeout loading legacy member");
          if (legacySnap.exists()) {
            roleData = legacySnap.data() as MemberRole;
          }
        }

        if (active) {
          setOrganization(currentOrg);
          setMemberRole(roleData);
          localStorage.setItem('mn_org_context', JSON.stringify({
            organization: currentOrg,
            memberRole: roleData
          }));
        }
      } catch (error) {
        console.error("Error loading organization context:", error);
      } finally {
        if (active) setLoadingOrg(false);
      }
    }

    loadOrganization();

    return () => {
      active = false;
    };
  }, [user, profile, authLoading]);

  const hasPermission = useCallback((permissionName: string) => {
    // If the user is a global 'ceo', they might bypass some checks globally or within the org
    if (profile?.systemRole === 'ceo' || profile?.systemRole === 'admin') {
      return true;
    }
    
    // Otherwise fallback to memberRole permissions
    if (!memberRole?.permissions) return false;
    return !!memberRole.permissions[permissionName];
  }, [profile?.systemRole, memberRole?.permissions]);

  const contextValue = useMemo(() => ({
    organization,
    memberRole,
    loadingOrg,
    hasPermission
  }), [organization, memberRole, loadingOrg, hasPermission]);

  return (
    <OrganizationContext.Provider value={contextValue}>
      {children}
    </OrganizationContext.Provider>
  );
}

export const useOrganization = () => useContext(OrganizationContext);
