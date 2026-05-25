import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { doc, getDoc, collection, query, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { useAuth } from "./AuthContext.js";

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
}

const OrganizationContext = createContext<OrganizationContextType>({
  organization: null,
  memberRole: null,
  loadingOrg: true,
});

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [memberRole, setMemberRole] = useState<MemberRole | null>(null);
  const [loadingOrg, setLoadingOrg] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadOrganization() {
      if (authLoading) return;
      
      if (!user || !profile || !profile.organizationId) {
        if (active) {
          setOrganization(null);
          setMemberRole(null);
          setLoadingOrg(false);
        }
        return;
      }

      setLoadingOrg(true);
      try {
        const orgId = profile.organizationId;
        const orgRef = doc(db, "organizations", orgId);
        const orgSnap = await getDoc(orgRef);

        let currentOrg = null;
        if (orgSnap.exists()) {
          currentOrg = { id: orgSnap.id, ...orgSnap.data() } as Organization;
        }

        // Fetch user's role in this organization
        // We look at /organizations/{orgId}/members/{uid}
        const memberRef = doc(db, `organizations/${orgId}/members`, user.uid);
        const memberSnap = await getDoc(memberRef);
        
        let roleData = null;
        if (memberSnap.exists()) {
          roleData = memberSnap.data() as MemberRole;
        } else {
          // Fallback checking legacy organization_members collection if migration not 100% complete
          const legacyMemberRef = doc(db, 'organization_members', `${user.uid}_${orgId}`);
          const legacySnap = await getDoc(legacyMemberRef);
          if (legacySnap.exists()) {
            roleData = legacySnap.data() as MemberRole;
          }
        }

        if (active) {
          setOrganization(currentOrg);
          setMemberRole(roleData);
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

  return (
    <OrganizationContext.Provider value={{ organization, memberRole, loadingOrg }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export const useOrganization = () => useContext(OrganizationContext);
