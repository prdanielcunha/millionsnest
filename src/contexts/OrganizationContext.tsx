import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { useAuth } from "./AuthContext.js";
import { withTimeout } from "../lib/utils.js";
import { isGlobalPrivilegedUser } from "../lib/permissionService.js";
import { 
  MUSIC_SCALE_PLANS, 
  resolveMusicScalePlan, 
  MusicScalePlan 
} from "../lib/musicScalePlans.js";

interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerUid: string;
  enabledApps: string[];
  subscriptionPlan: string;
  subscriptionStatus: string;
  createdAt: any;
  apps?: {
    musicscale?: {
      plan?: string;
      access?: boolean;
      status?: string;
      features?: any;
      limits?: any;
    };
  };
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
  musicScalePlan: MusicScalePlan;
  musicScaleEntitlements: any;
}

const OrganizationContext = createContext<OrganizationContextType>({
  organization: null,
  memberRole: null,
  loadingOrg: true,
  hasPermission: () => false,
  musicScalePlan: 'starter',
  musicScaleEntitlements: MUSIC_SCALE_PLANS.starter,
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
  const [musicScalePlan, setMusicScalePlan] = useState<MusicScalePlan>(cachedContext?.musicScalePlan || 'starter');
  const [musicScaleEntitlements, setMusicScaleEntitlements] = useState<any>(cachedContext?.musicScaleEntitlements || MUSIC_SCALE_PLANS.starter);
  const [loadingOrg, setLoadingOrg] = useState(!cachedContext);

  useEffect(() => {
    let active = true;

    async function loadOrganization() {
      if (authLoading) return;
      
      if (!user || !profile || !profile.organizationId) {
        if (active) {
          setOrganization(null);
          setMemberRole(null);
          setMusicScalePlan('starter');
          setMusicScaleEntitlements(MUSIC_SCALE_PLANS.starter);
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

        // Fetch subscription details if any for the prioritized gate chain resolution
        let currentSub = null;
        try {
          const subRef = doc(db, "subscriptions", orgId);
          const subSnap = await withTimeout(getDoc(subRef), 8000, "Firestore timeout loading sub");
          if (subSnap.exists()) {
            currentSub = subSnap.data();
          }
        } catch (e) {
          console.warn("Silent recovery: subscriptions not loaded or lacked permission", e);
        }

        const resolvedPlan = resolveMusicScalePlan({
          subscription: currentSub,
          organization: currentOrg
        });
        const resolvedEntitlements = MUSIC_SCALE_PLANS[resolvedPlan];

        if (active) {
          setOrganization(currentOrg);
          setMemberRole(roleData);
          setMusicScalePlan(resolvedPlan);
          setMusicScaleEntitlements(resolvedEntitlements);
          localStorage.setItem('mn_org_context', JSON.stringify({
            organization: currentOrg,
            memberRole: roleData,
            musicScalePlan: resolvedPlan,
            musicScaleEntitlements: resolvedEntitlements
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
    if (isGlobalPrivilegedUser(profile)) {
      return true;
    }
    
    // Otherwise fallback to memberRole permissions
    if (!memberRole?.permissions) return false;
    return !!memberRole.permissions[permissionName];
  }, [profile, memberRole?.permissions]);

  const contextValue = useMemo(() => ({
    organization,
    memberRole,
    loadingOrg,
    hasPermission,
    musicScalePlan,
    musicScaleEntitlements
  }), [organization, memberRole, loadingOrg, hasPermission, musicScalePlan, musicScaleEntitlements]);

  return (
    <OrganizationContext.Provider value={contextValue}>
      {children}
    </OrganizationContext.Provider>
  );
}

export const useOrganization = () => useContext(OrganizationContext);
