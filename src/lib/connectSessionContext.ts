export interface ConnectSessionUser {
  uid: string;
  displayName: string | null;
  photoUrl: string | null;
  locale: string | null;
  systemRole: string | null;
  capabilities: string[];
}

export interface ConnectSessionOrganization {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  accessSource: "organization_membership" | "global_system_role";
  organizationRole: string | null;
  membershipStatus: string | null;
  permissions: string[];
  capabilities: string[];
}

export interface MusicScaleEntitlement {
  canonicalStatus: string;
  cancellationScheduled: boolean;
  currentPeriodEndMs: number | null;
  individualAccessSource: string;
}

export interface ConnectSessionAppAccess {
  appId: "musicscale";
  organizationId: string;
  accessible: boolean;
  isGlobalAccess: boolean;
  accessSource: string;
  decisionState: "granted" | "denied";
  denialReason: string | null;
  catalogState: string;
  entitlement: MusicScaleEntitlement | null;
}

export interface ConnectSessionContextResponse {
  success: boolean;
  protocolVersion: string; // "1.0.0"
  generatedAtMs: number;
  user: ConnectSessionUser;
  globalAccess: boolean;
  activeOrganizationId: string | null;
  activeOrganization: ConnectSessionOrganization | null;
  organizations: ConnectSessionOrganization[];
  appAccess: {
    musicscale: ConnectSessionAppAccess;
  } | null;
}
