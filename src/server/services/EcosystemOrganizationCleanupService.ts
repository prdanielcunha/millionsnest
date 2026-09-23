import { createHash } from 'node:crypto';
import type { Auth } from 'firebase-admin/auth';
import {
  FieldValue,
  Timestamp,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

export const ECOSYSTEM_CLEANUP_PROTECTED_NAMES = [
  'familia obpc',
  'millionsnest demo',
  'organizacao de valdinei a pereira',
] as const;

const ABSOLUTE_PROTECTED_NAMES = new Set<string>(ECOSYSTEM_CLEANUP_PROTECTED_NAMES);

const PRIVILEGED_SYSTEM_ROLES = new Set([
  'ceo',
  'admin',
  'global_admin',
  'ecosystem_owner',
  'founder',
  'ecosystem_support',
]);

const ACTIVE_BILLING_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'incomplete',
  'paused',
]);

const EXPLICIT_JUNK_NAME_TOKENS = ['daniel', 'cunha', 'kept'];

const TECHNICAL_NAME_PATTERNS = [
  /^integration org$/,
  /^mock org\b/,
  /^org teste command api$/,
  /^org_test_/,
  /^test org$/,
  /^test org\b/,
];

const ACTIVITY_COLLECTIONS = [
  'actionCenter',
  'analytics',
  'analytics_events',
  'bandScales',
  'careRequests',
  'congregations',
  'discipleships',
  'feedbacks',
  'fixedBandScales',
  'followups',
  'groupAttendance',
  'groupEntryRequests',
  'groupMeetings',
  'groupMemberships',
  'groups',
  'implementationCycles',
  'invitations',
  'join_requests',
  'liveSessions',
  'mesaParticipations',
  'mesaPreparations',
  'pastoralHandoffs',
  'people',
  'presenceChecks',
  'presenceSessions',
  'retentionRequests',
  'scales',
  'schedules',
  'songs',
];

const ORG_SCOPED_COLLECTIONS_TO_DELETE = [
  'actionCenter',
  'analytics',
  'analytics_events',
  'bandScales',
  'careRequests',
  'congregations',
  'discipleships',
  'eventNames',
  'eventTypes',
  'feedbacks',
  'fixedBandScales',
  'followups',
  'groupAttendance',
  'groupEntryRequests',
  'groupMeetings',
  'groupMemberships',
  'groups',
  'implementationCycles',
  'instruments',
  'invitations',
  'join_requests',
  'liveSessions',
  'locations',
  'mesaParticipations',
  'mesaPreparations',
  'notifications',
  'pastoralHandoffs',
  'people',
  'presenceChecks',
  'presenceSessions',
  'retentionRequests',
  'roles',
  'scales',
  'schedules',
  'songs',
  'suggestions',
  'tags',
];

export type EcosystemCleanupReason =
  | 'protected'
  | 'active_billing'
  | 'explicit_junk_name'
  | 'technical_recent'
  | 'abandoned_empty_no_subscription'
  | 'keep_has_activity'
  | 'keep_has_members_or_invites'
  | 'keep_recent_or_unknown_age'
  | 'keep_nonbillable_other';

export type EcosystemCleanupAnalysis = {
  id: string;
  name: string;
  ownerUid: string | null;
  linkedUserIds: string[];
  memberCount: number;
  hasPendingInvites: boolean;
  hasMeaningfulActivity: boolean;
  billingProtected: boolean;
  subscriptionStatus: string | null;
  createdAtMs: number | null;
  updatedAtMs: number | null;
  ageDays: number | null;
  technical: boolean;
  explicitJunk: boolean;
  protected: boolean;
  delete: boolean;
  reason: EcosystemCleanupReason;
  shouldCaptureLead: boolean;
};

export type EcosystemCleanupPreview = {
  totalOrganizationsScanned: number;
  protectedOrganizations: number;
  activeBillingOrganizations: number;
  deleteCandidates: number;
  potentialRemarketingLeads: number;
  countsByReason: Record<string, number>;
  candidates: Array<{
    id: string;
    name: string;
    reason: EcosystemCleanupReason;
    ageDays: number | null;
    memberCount: number;
    subscriptionStatus: string | null;
  }>;
  protected: Array<{ id: string; name: string }>;
};

export type EcosystemCleanupApplyResult = EcosystemCleanupPreview & {
  organizationsDeleted: number;
  leadsCaptured: number;
  topLevelDocumentsDeleted: number;
  skippedBecauseBillingChanged: number;
  maintenanceRunId: string;
};

function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function toMillis(value: any): number | null {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1000 : value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function getOrgName(data: Record<string, any>): string {
  return firstString(data.name, data.displayName, data.organizationName, data.nome, data.title);
}

function getStatus(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, '_');
}

function collectBillingStatuses(subscription: Record<string, any> | null): string[] {
  if (!subscription) return [];
  const statuses = new Set<string>();
  const root = getStatus(subscription.status);
  if (root) statuses.add(root);

  const apps = subscription.apps;
  if (apps && typeof apps === 'object') {
    for (const app of Object.values(apps) as any[]) {
      const status = getStatus(app?.status);
      if (status) statuses.add(status);
    }
  }

  return [...statuses];
}

function hasActiveBilling(subscription: Record<string, any> | null): boolean {
  if (!subscription) return false;
  const statuses = collectBillingStatuses(subscription);
  if (statuses.some(status => ACTIVE_BILLING_STATUSES.has(status))) return true;

  const stripeIds = [
    subscription.stripeSubscriptionId,
    subscription.subscriptionId,
    subscription.stripe_subscription_id,
    ...(subscription.apps && typeof subscription.apps === 'object'
      ? Object.values(subscription.apps).flatMap((app: any) => [
          app?.stripeSubscriptionId,
          app?.subscriptionId,
          app?.stripe_subscription_id,
        ])
      : []),
  ].filter(Boolean);

  if (!stripeIds.length) return false;
  return !statuses.every(status =>
    ['canceled', 'cancelled', 'incomplete_expired', 'expired', 'ended'].includes(status),
  );
}

function hasActiveOrganizationEntitlement(organization: Record<string, any>): boolean {
  const explicitSubscriptionStatus = getStatus(
    organization.subscriptionStatus || organization.billingStatus,
  );
  if (explicitSubscriptionStatus && ACTIVE_BILLING_STATUSES.has(explicitSubscriptionStatus)) {
    return true;
  }

  const apps = organization.apps;
  if (apps && typeof apps === 'object') {
    for (const app of Object.values(apps) as any[]) {
      const status = getStatus(app?.status);
      if (status && ACTIVE_BILLING_STATUSES.has(status)) return true;

      const stripeId =
        app?.stripeSubscriptionId ||
        app?.subscriptionId ||
        app?.stripe_subscription_id;
      if (
        stripeId &&
        !['canceled', 'cancelled', 'incomplete_expired', 'expired', 'ended'].includes(status)
      ) {
        return true;
      }
    }
  }

  return false;
}

function isTechnicalName(normalizedName: string): boolean {
  return TECHNICAL_NAME_PATTERNS.some(pattern => pattern.test(normalizedName));
}

function isExplicitJunkName(normalizedName: string): boolean {
  return EXPLICIT_JUNK_NAME_TOKENS.some(token => normalizedName.includes(token));
}

function hashId(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}

async function queryHasAny(db: Firestore, collectionName: string, orgId: string): Promise<boolean> {
  const snap = await db.collection(collectionName).where('organizationId', '==', orgId).limit(1).get();
  return !snap.empty;
}

async function hasNestedOrganizationActivity(db: Firestore, orgId: string): Promise<boolean> {
  const orgRef = db.collection('organizations').doc(orgId);

  try {
    const nestedCollections = await orgRef.listCollections();

    for (const nested of nestedCollections) {
      // These collections are structural or independently checked below.
      if (['members', 'invites', 'audit_logs', 'monthly_usage', 'notifications'].includes(nested.id)) {
        continue;
      }

      if (nested.id === 'musicscale') {
        const docs = await nested.limit(10).get();
        for (const document of docs.docs) {
          // A bare settings document is created during bootstrap and is not proof of real use.
          if (document.id !== 'settings' && document.id !== 'usage') return true;

          const childCollections = await document.ref.listCollections();
          for (const child of childCollections) {
            const childDoc = await child.limit(1).get();
            if (!childDoc.empty) return true;
          }
        }
        continue;
      }

      // Product workspaces (NestJourney etc.) and any other non-structural
      // organization subcollection are considered meaningful tenant data.
      const doc = await nested.limit(1).get();
      if (!doc.empty) return true;
    }
  } catch {
    // Fail closed: uncertainty preserves the organization.
    return true;
  }

  return false;
}

async function hasMeaningfulActivity(db: Firestore, orgId: string): Promise<boolean> {
  for (const collectionName of ACTIVITY_COLLECTIONS) {
    try {
      if (await queryHasAny(db, collectionName, orgId)) return true;
    } catch {
      // Fail closed: an unexpected query problem preserves the organization.
      return true;
    }
  }

  return hasNestedOrganizationActivity(db, orgId);
}

async function loadLegacyMembers(db: Firestore, orgId: string) {
  try {
    return await db.collection('organization_members').where('organizationId', '==', orgId).get();
  } catch {
    return null;
  }
}

async function analyzeOrganization(params: {
  db: Firestore;
  orgDoc: QueryDocumentSnapshot;
  nowMs: number;
  minAbandonedAgeDays: number;
  technicalRecentDays: number;
  extraProtectedOrgIds: Set<string>;
}): Promise<EcosystemCleanupAnalysis> {
  const {
    db,
    orgDoc,
    nowMs,
    minAbandonedAgeDays,
    technicalRecentDays,
    extraProtectedOrgIds,
  } = params;
  const data = orgDoc.data() || {};
  const id = orgDoc.id;
  const name = getOrgName(data);
  const normalizedName = normalizeText(name);
  const protectedOrg =
    ABSOLUTE_PROTECTED_NAMES.has(normalizedName) || extraProtectedOrgIds.has(id);

  const [subscriptionDoc, membersSnap, pendingInvitesSnap, legacyMembersSnap] = await Promise.all([
    db.collection('subscriptions').doc(id).get(),
    orgDoc.ref.collection('members').limit(10).get(),
    orgDoc.ref.collection('invites').where('status', '==', 'pending').limit(1).get().catch(() => null),
    loadLegacyMembers(db, id),
  ]);

  const subscription = subscriptionDoc.exists ? (subscriptionDoc.data() || {}) : null;
  const billingProtected =
    hasActiveBilling(subscription) ||
    hasActiveOrganizationEntitlement(data);

  const linkedUserIds = new Set<string>();
  for (const memberDoc of membersSnap.docs) linkedUserIds.add(memberDoc.id);
  if (legacyMembersSnap) {
    for (const memberDoc of legacyMembersSnap.docs) {
      const memberData = memberDoc.data() || {};
      const uid = firstString(memberData.uid, memberData.user_id, memberData.userId);
      if (uid) linkedUserIds.add(uid);
    }
  }

  let ownerUid =
    firstString(
      data.ownerUid,
      data.ownerId,
      data.owner_user_id,
      data.ownerUserId,
      data.createdByUid,
      data.createdBy,
    ) || null;

  if (!ownerUid) {
    const ownerMember = membersSnap.docs.find(memberDoc => {
      const member = memberDoc.data() || {};
      const role = normalizeText(member.organizationRole || member.role);
      return role === 'owner' || role === 'dono';
    });
    if (ownerMember) ownerUid = ownerMember.id;
  }

  if (!ownerUid && linkedUserIds.size === 1) ownerUid = [...linkedUserIds][0];
  if (ownerUid) linkedUserIds.add(ownerUid);

  const createdAtMs =
    toMillis(data.createdAt) ??
    toMillis(data.created_at) ??
    toMillis(data.createdOn) ??
    toMillis(data.created);
  const updatedAtMs =
    toMillis(data.updatedAt) ??
    toMillis(data.updated_at) ??
    toMillis(data.lastUpdatedAt) ??
    createdAtMs;
  const ageDays = createdAtMs == null ? null : Math.floor((nowMs - createdAtMs) / 86_400_000);

  const technical = isTechnicalName(normalizedName);
  const explicitJunk = isExplicitJunkName(normalizedName);
  const memberCount = Math.max(membersSnap.size, linkedUserIds.size);
  const hasPendingInvites = Boolean(pendingInvitesSnap && !pendingInvitesSnap.empty);

  let activity = false;
  let reason: EcosystemCleanupReason = 'keep_nonbillable_other';
  let deleteOrg = false;

  if (protectedOrg) {
    reason = 'protected';
  } else if (billingProtected) {
    reason = 'active_billing';
  } else if (explicitJunk) {
    reason = 'explicit_junk_name';
    deleteOrg = true;
  } else {
    const referenceMs = updatedAtMs ?? createdAtMs;
    const recentTechnical =
      technical &&
      referenceMs != null &&
      nowMs - referenceMs <= technicalRecentDays * 86_400_000;

    if (recentTechnical) {
      reason = 'technical_recent';
    } else {
      activity = await hasMeaningfulActivity(db, id);

      if (activity) {
        reason = 'keep_has_activity';
      } else if (memberCount > 1 || hasPendingInvites) {
        reason = 'keep_has_members_or_invites';
      } else if (ageDays == null || ageDays < minAbandonedAgeDays) {
        reason = 'keep_recent_or_unknown_age';
      } else {
        reason = 'abandoned_empty_no_subscription';
        deleteOrg = true;
      }
    }
  }

  return {
    id,
    name,
    ownerUid,
    linkedUserIds: [...linkedUserIds],
    memberCount,
    hasPendingInvites,
    hasMeaningfulActivity: activity,
    billingProtected,
    subscriptionStatus: collectBillingStatuses(subscription)[0] || null,
    createdAtMs,
    updatedAtMs,
    ageDays,
    technical,
    explicitJunk,
    protected: protectedOrg,
    delete: deleteOrg,
    reason,
    shouldCaptureLead: !protectedOrg && !billingProtected && Boolean(ownerUid),
  };
}

function buildPreview(analyses: EcosystemCleanupAnalysis[]): EcosystemCleanupPreview {
  const countsByReason = analyses.reduce<Record<string, number>>((acc, analysis) => {
    acc[analysis.reason] = (acc[analysis.reason] || 0) + 1;
    return acc;
  }, {});

  return {
    totalOrganizationsScanned: analyses.length,
    protectedOrganizations: analyses.filter(analysis => analysis.protected).length,
    activeBillingOrganizations: analyses.filter(analysis => analysis.billingProtected).length,
    deleteCandidates: analyses.filter(analysis => analysis.delete).length,
    potentialRemarketingLeads: analyses.filter(analysis => analysis.shouldCaptureLead).length,
    countsByReason,
    candidates: analyses
      .filter(analysis => analysis.delete)
      .map(analysis => ({
        id: analysis.id,
        name: analysis.name || 'Sem nome',
        reason: analysis.reason,
        ageDays: analysis.ageDays,
        memberCount: analysis.memberCount,
        subscriptionStatus: analysis.subscriptionStatus,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    protected: analyses
      .filter(analysis => analysis.protected)
      .map(analysis => ({ id: analysis.id, name: analysis.name || 'Sem nome' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  };
}

export async function previewEcosystemOrganizationCleanup(params: {
  db: Firestore;
  nowMs?: number;
  minAbandonedAgeDays?: number;
  technicalRecentDays?: number;
  extraProtectedOrgIds?: string[];
}): Promise<{ preview: EcosystemCleanupPreview; analyses: EcosystemCleanupAnalysis[] }> {
  const nowMs = params.nowMs ?? Date.now();
  const minAbandonedAgeDays = params.minAbandonedAgeDays ?? 14;
  const technicalRecentDays = params.technicalRecentDays ?? 30;
  const extraProtectedOrgIds = new Set(params.extraProtectedOrgIds || []);

  const organizationsSnap = await params.db.collection('organizations').get();
  const analyses: EcosystemCleanupAnalysis[] = [];

  for (const orgDoc of organizationsSnap.docs) {
    analyses.push(
      await analyzeOrganization({
        db: params.db,
        orgDoc,
        nowMs,
        minAbandonedAgeDays,
        technicalRecentDays,
        extraProtectedOrgIds,
      }),
    );
  }

  return { preview: buildPreview(analyses), analyses };
}

function resolveMarketingConsent(userData: Record<string, any>) {
  const candidates = [
    userData.marketingConsent,
    userData.marketingOptIn,
    userData.emailMarketingConsent,
    userData.consents?.marketing,
    userData.consents?.emailMarketing,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'boolean') {
      return {
        marketingEligible: candidate,
        consentKnown: true,
        raw: candidate,
      };
    }
  }

  return {
    marketingEligible: false,
    consentKnown: false,
    raw: null,
  };
}

async function captureRemarketingLead(params: {
  db: Firestore;
  auth: Auth;
  analysis: EcosystemCleanupAnalysis;
}): Promise<boolean> {
  const { db, auth, analysis } = params;
  if (!analysis.ownerUid) return false;

  const userRef = db.collection('users').doc(analysis.ownerUid);
  const userDoc = await userRef.get();
  const userData = userDoc.exists ? (userDoc.data() || {}) : {};
  const systemRole = normalizeText(userData.systemRole);
  if (PRIVILEGED_SYSTEM_ROLES.has(systemRole)) return false;

  let authUser: any = null;
  try {
    authUser = await auth.getUser(analysis.ownerUid);
  } catch {
    // Firestore can still contain the contact data.
  }

  const email = firstString(userData.email, authUser?.email);
  const phone = firstString(userData.phone, userData.phoneNumber, userData.whatsapp, authUser?.phoneNumber);
  const displayName = firstString(
    userData.displayName,
    userData.name,
    userData.fullName,
    authUser?.displayName,
  );

  if (!email && !phone) return false;

  const consent = resolveMarketingConsent(userData);
  const leadId = hashId(`${analysis.ownerUid}:${analysis.id}`);
  const leadRef = db.collection('remarketing_prospects').doc(leadId);

  const lastSignInAt = authUser?.metadata?.lastSignInTime
    ? Timestamp.fromDate(new Date(authUser.metadata.lastSignInTime))
    : null;

  await leadRef.set(
    {
      source: 'ecosystem_organization_cleanup_2026_09_23',
      userId: analysis.ownerUid,
      organizationId: analysis.id,
      organizationName: analysis.name || null,
      email: email || null,
      phone: phone || null,
      displayName: displayName || null,
      locale: firstString(userData.locale, userData.language, userData.preferredLanguage) || null,
      marketingEligible: consent.marketingEligible,
      marketingConsentKnown: consent.consentKnown,
      marketingConsent: consent.raw,
      lastSignInAt,
      subscriptionStatus: analysis.subscriptionStatus,
      cleanupDisposition: analysis.delete ? 'organization_deleted' : 'organization_kept',
      cleanupReason: analysis.reason,
      capturedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return true;
}

async function collectUsersReferencingOrganization(
  db: Firestore,
  orgId: string,
  seedUids: string[],
): Promise<Set<string>> {
  const uids = new Set(seedUids.filter(Boolean));
  const users = db.collection('users');

  const queries = [
    users.where('organizationId', '==', orgId),
    users.where('activeOrganizationId', '==', orgId),
    users.where('primaryOrganizationId', '==', orgId),
    users.where('organizations', 'array-contains', orgId),
    users.where('organizationIds', 'array-contains', orgId),
  ];

  for (const query of queries) {
    try {
      const snap = await query.get();
      snap.docs.forEach(doc => uids.add(doc.id));
    } catch {
      // Continue with the canonical member references we already have.
    }
  }

  return uids;
}

async function chooseReplacementOrganization(
  db: Firestore,
  userData: Record<string, any>,
  deletedOrgId: string,
): Promise<string | null> {
  const candidates = new Set<string>();

  for (const key of ['organizations', 'organizationIds']) {
    const values = userData[key];
    if (Array.isArray(values)) {
      for (const value of values) {
        if (typeof value === 'string' && value && value !== deletedOrgId) candidates.add(value);
      }
    }
  }

  if (Array.isArray(userData.memberships)) {
    for (const membership of userData.memberships) {
      const candidate =
        typeof membership === 'string'
          ? membership
          : firstString(membership?.organizationId, membership?.orgId);
      if (candidate && candidate !== deletedOrgId) candidates.add(candidate);
    }
  }

  for (const candidate of candidates) {
    const org = await db.collection('organizations').doc(candidate).get();
    if (!org.exists) continue;
    const orgData = org.data() || {};
    if (!orgData.archived && normalizeText(orgData.status) !== 'archived') return candidate;
  }

  return null;
}

async function detachOrganizationFromUser(
  db: Firestore,
  uid: string,
  orgId: string,
): Promise<void> {
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  if (!userDoc.exists) return;

  const userData = userDoc.data() || {};
  const replacementOrgId = await chooseReplacementOrganization(db, userData, orgId);
  const updates: Record<string, any> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (Array.isArray(userData.organizations)) {
    updates.organizations = userData.organizations.filter((value: any) => value !== orgId);
  }
  if (Array.isArray(userData.organizationIds)) {
    updates.organizationIds = userData.organizationIds.filter((value: any) => value !== orgId);
  }
  if (Array.isArray(userData.memberships)) {
    updates.memberships = userData.memberships.filter((membership: any) => {
      if (typeof membership === 'string') return membership !== orgId;
      const membershipOrgId = firstString(membership?.organizationId, membership?.orgId);
      return membershipOrgId !== orgId;
    });
  }

  for (const key of ['organizationId', 'activeOrganizationId', 'primaryOrganizationId']) {
    if (userData[key] === orgId) {
      updates[key] = replacementOrgId || FieldValue.delete();
    }
  }

  await userRef.set(updates, { merge: true });
}

async function recursiveDeleteByOrganizationId(
  db: Firestore,
  collectionName: string,
  orgId: string,
): Promise<number> {
  const snap = await db.collection(collectionName).where('organizationId', '==', orgId).get();
  let deleted = 0;

  for (const doc of snap.docs) {
    await (db as any).recursiveDelete(doc.ref);
    deleted += 1;
  }

  return deleted;
}

async function deleteOrganization(
  db: Firestore,
  analysis: EcosystemCleanupAnalysis,
): Promise<number> {
  const orgRef = db.collection('organizations').doc(analysis.id);
  const legacyMembersSnap = await loadLegacyMembers(db, analysis.id);
  const userIds = await collectUsersReferencingOrganization(db, analysis.id, [
    ...analysis.linkedUserIds,
    ...(legacyMembersSnap
      ? legacyMembersSnap.docs
          .map(doc => {
            const data = doc.data() || {};
            return firstString(data.uid, data.user_id, data.userId);
          })
          .filter(Boolean)
      : []),
  ]);

  let deletedTopLevelDocs = 0;

  for (const collectionName of ORG_SCOPED_COLLECTIONS_TO_DELETE) {
    deletedTopLevelDocs += await recursiveDeleteByOrganizationId(db, collectionName, analysis.id);
  }

  if (legacyMembersSnap) {
    for (const doc of legacyMembersSnap.docs) {
      await doc.ref.delete();
      deletedTopLevelDocs += 1;
    }
  }

  for (const uid of userIds) {
    await Promise.all([
      db.collection('organization_members').doc(`${uid}_${analysis.id}`).delete().catch(() => undefined),
      db.collection('organization_members').doc(`${analysis.id}_${uid}`).delete().catch(() => undefined),
    ]);
  }

  await db.collection('subscriptions').doc(analysis.id).delete().catch(() => undefined);

  for (const uid of userIds) {
    await detachOrganizationFromUser(db, uid, analysis.id);
  }

  await (db as any).recursiveDelete(orgRef);
  return deletedTopLevelDocs;
}

export async function applyEcosystemOrganizationCleanup(params: {
  db: Firestore;
  auth: Auth;
  actorUid: string;
  actorSystemRole: string;
  confirmation: string;
  nowMs?: number;
  minAbandonedAgeDays?: number;
  technicalRecentDays?: number;
  extraProtectedOrgIds?: string[];
}): Promise<EcosystemCleanupApplyResult> {
  if (params.confirmation !== 'LIMPAR_ORGANIZACOES') {
    throw new Error('CONFIRMATION_REQUIRED');
  }

  const role = normalizeText(params.actorSystemRole);
  if (!['ceo', 'global_admin', 'ecosystem_owner', 'founder'].includes(role)) {
    throw new Error('FORBIDDEN_CLEANUP_ROLE');
  }

  const nowMs = params.nowMs ?? Date.now();
  const { preview, analyses } = await previewEcosystemOrganizationCleanup({
    db: params.db,
    nowMs,
    minAbandonedAgeDays: params.minAbandonedAgeDays,
    technicalRecentDays: params.technicalRecentDays,
    extraProtectedOrgIds: params.extraProtectedOrgIds,
  });

  let organizationsDeleted = 0;
  let leadsCaptured = 0;
  let topLevelDocumentsDeleted = 0;
  let skippedBecauseBillingChanged = 0;

  // Capture remarketing contacts before any destructive operation.
  for (const analysis of analyses.filter(item => item.shouldCaptureLead)) {
    try {
      if (
        await captureRemarketingLead({
          db: params.db,
          auth: params.auth,
          analysis,
        })
      ) {
        leadsCaptured += 1;
      }
    } catch (error) {
      if (analysis.delete) throw error;
    }
  }

  for (const analysis of analyses.filter(item => item.delete)) {
    // Billing safety is checked again immediately before deletion.
    const subDoc = await params.db.collection('subscriptions').doc(analysis.id).get();
    const latestSubscription = subDoc.exists ? (subDoc.data() || {}) : null;

    const latestOrgDoc = await params.db.collection('organizations').doc(analysis.id).get();
    const latestOrgData = latestOrgDoc.exists ? (latestOrgDoc.data() || {}) : {};

    if (
      hasActiveBilling(latestSubscription) ||
      hasActiveOrganizationEntitlement(latestOrgData)
    ) {
      skippedBecauseBillingChanged += 1;
      continue;
    }

    topLevelDocumentsDeleted += await deleteOrganization(params.db, analysis);
    organizationsDeleted += 1;
  }

  const maintenanceRunId = `ecosystem-org-cleanup-${new Date(nowMs).toISOString().replace(/[:.]/g, '-')}`;
  await params.db.collection('maintenance_runs').doc(maintenanceRunId).set({
    type: 'ecosystem_organization_cleanup',
    actorUid: params.actorUid,
    actorSystemRole: params.actorSystemRole,
    totalOrganizationsScanned: preview.totalOrganizationsScanned,
    protectedOrganizations: preview.protectedOrganizations,
    activeBillingOrganizations: preview.activeBillingOrganizations,
    deleteCandidates: preview.deleteCandidates,
    organizationsDeleted,
    potentialRemarketingLeads: preview.potentialRemarketingLeads,
    leadsCaptured,
    topLevelDocumentsDeleted,
    skippedBecauseBillingChanged,
    countsByReason: preview.countsByReason,
    completedAt: FieldValue.serverTimestamp(),
  });

  await params.db.collection('audit_logs').add({
    action: 'system.organization.cleanup.completed',
    actorUid: params.actorUid,
    actorSystemRole: params.actorSystemRole,
    maintenanceRunId,
    deleteCandidates: preview.deleteCandidates,
    organizationsDeleted,
    leadsCaptured,
    skippedBecauseBillingChanged,
    createdAt: FieldValue.serverTimestamp(),
  });

  return {
    ...preview,
    organizationsDeleted,
    leadsCaptured,
    topLevelDocumentsDeleted,
    skippedBecauseBillingChanged,
    maintenanceRunId,
  };
}

export async function listRemarketingProspects(params: {
  db: Firestore;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(params.limit ?? 500, 1000));
  const snap = await params.db
    .collection('remarketing_prospects')
    .orderBy('capturedAt', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map(doc => {
    const data = doc.data() || {};
    return {
      id: doc.id,
      displayName: data.displayName || null,
      email: data.email || null,
      phone: data.phone || null,
      organizationName: data.organizationName || null,
      marketingEligible: data.marketingEligible === true,
      marketingConsentKnown: data.marketingConsentKnown === true,
      cleanupDisposition: data.cleanupDisposition || null,
      cleanupReason: data.cleanupReason || null,
      subscriptionStatus: data.subscriptionStatus || null,
      capturedAt: data.capturedAt || null,
      lastSignInAt: data.lastSignInAt || null,
    };
  });
}
