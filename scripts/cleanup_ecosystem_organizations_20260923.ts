import { createHash } from 'node:crypto';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'millionsnest';
const MODE = process.argv.includes('--apply') ? 'apply' : 'dry-run';
const MIN_ABANDONED_AGE_DAYS = Number(process.env.MIN_ABANDONED_AGE_DAYS || '14');
const TECHNICAL_RECENT_DAYS = Number(process.env.TECHNICAL_RECENT_DAYS || '30');
const NOW_MS = Date.now();
const RUN_ID = process.env.MAINTENANCE_RUN_ID || `ecosystem-org-cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}`;

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
}

const db = getFirestore();
const auth = getAuth();

const ABSOLUTE_PROTECTED_NAMES = new Set([
  'familia obpc',
  'millionsnest demo',
  'organizacao de valdinei a pereira'
]);

const EXTRA_PROTECTED_ORG_IDS = new Set(
  String(process.env.EXTRA_PROTECTED_ORG_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);

const PRIVILEGED_SYSTEM_ROLES = new Set([
  'ceo',
  'admin',
  'global_admin',
  'ecosystem_owner',
  'founder',
  'ecosystem_support'
]);

const ACTIVE_BILLING_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'incomplete',
  'paused'
]);

const EXPLICIT_JUNK_NAME_TOKENS = ['daniel', 'cunha', 'kept'];

const TECHNICAL_NAME_PATTERNS = [
  /^integration org$/,
  /^mock org\b/,
  /^org teste command api$/,
  /^org_test_/,
  /^test org$/,
  /^test org\b/
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
  'songs'
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
  'tags'
];

type DecisionReason =
  | 'protected'
  | 'active_billing'
  | 'explicit_junk_name'
  | 'technical_recent'
  | 'abandoned_empty_no_subscription'
  | 'keep_has_activity'
  | 'keep_has_members_or_invites'
  | 'keep_recent_or_unknown_age'
  | 'keep_nonbillable_other';

type OrgAnalysis = {
  id: string;
  name: string;
  normalizedName: string;
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
  reason: DecisionReason;
  shouldCaptureLead: boolean;
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
  if (statuses.some((status) => ACTIVE_BILLING_STATUSES.has(status))) return true;

  const stripeIds = [
    subscription.stripeSubscriptionId,
    subscription.subscriptionId,
    subscription.stripe_subscription_id,
    ...(subscription.apps && typeof subscription.apps === 'object'
      ? Object.values(subscription.apps).flatMap((app: any) => [
          app?.stripeSubscriptionId,
          app?.subscriptionId,
          app?.stripe_subscription_id
        ])
      : [])
  ].filter(Boolean);

  if (!stripeIds.length) return false;
  return !statuses.every((status) =>
    ['canceled', 'cancelled', 'incomplete_expired', 'expired', 'ended'].includes(status)
  );
}

function isTechnicalName(normalizedName: string): boolean {
  return TECHNICAL_NAME_PATTERNS.some((pattern) => pattern.test(normalizedName));
}

function isExplicitJunkName(normalizedName: string): boolean {
  return EXPLICIT_JUNK_NAME_TOKENS.some((token) => normalizedName.includes(token));
}

function hashId(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}

async function queryHasAny(collectionName: string, orgId: string): Promise<boolean> {
  const snap = await db.collection(collectionName).where('organizationId', '==', orgId).limit(1).get();
  return !snap.empty;
}

async function hasMeaningfulActivity(orgId: string): Promise<boolean> {
  for (const collectionName of ACTIVITY_COLLECTIONS) {
    try {
      if (await queryHasAny(collectionName, orgId)) return true;
    } catch (error: any) {
      // A maintenance cleanup must fail closed: any unexpected query problem preserves the org.
      console.warn(`ACTIVITY_CHECK_PRESERVE collection=${collectionName} code=${error?.code || 'unknown'}`);
      return true;
    }
  }
  return false;
}

async function loadLegacyMembers(orgId: string) {
  try {
    return await db.collection('organization_members').where('organizationId', '==', orgId).get();
  } catch {
    return null;
  }
}

async function analyzeOrganization(orgDoc: FirebaseFirestore.QueryDocumentSnapshot): Promise<OrgAnalysis> {
  const data = orgDoc.data() || {};
  const id = orgDoc.id;
  const name = getOrgName(data);
  const normalizedName = normalizeText(name);
  const protectedByName = ABSOLUTE_PROTECTED_NAMES.has(normalizedName);
  const protectedById = EXTRA_PROTECTED_ORG_IDS.has(id);
  const protectedOrg = protectedByName || protectedById;

  const [subscriptionDoc, membersSnap, pendingInvitesSnap, legacyMembersSnap] = await Promise.all([
    db.collection('subscriptions').doc(id).get(),
    orgDoc.ref.collection('members').limit(10).get(),
    orgDoc.ref.collection('invites').where('status', '==', 'pending').limit(1).get().catch(() => null),
    loadLegacyMembers(id)
  ]);

  const subscription = subscriptionDoc.exists ? (subscriptionDoc.data() || {}) : null;
  const billingProtected = hasActiveBilling(subscription);

  const linkedUserIds = new Set<string>();
  for (const memberDoc of membersSnap.docs) linkedUserIds.add(memberDoc.id);
  if (legacyMembersSnap) {
    for (const memberDoc of legacyMembersSnap.docs) {
      const memberData = memberDoc.data() || {};
      const uid = firstString(memberData.uid, memberData.user_id, memberData.userId);
      if (uid) linkedUserIds.add(uid);
    }
  }

  let ownerUid = firstString(
    data.ownerUid,
    data.ownerId,
    data.owner_user_id,
    data.ownerUserId,
    data.createdByUid,
    data.createdBy
  ) || null;

  if (!ownerUid) {
    const ownerMember = membersSnap.docs.find((memberDoc) => {
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
  const ageDays = createdAtMs == null ? null : Math.floor((NOW_MS - createdAtMs) / 86_400_000);

  const technical = isTechnicalName(normalizedName);
  const explicitJunk = isExplicitJunkName(normalizedName);
  const memberCount = Math.max(membersSnap.size, linkedUserIds.size);
  const hasPendingInvites = Boolean(pendingInvitesSnap && !pendingInvitesSnap.empty);

  let activity = false;
  let reason: DecisionReason = 'keep_nonbillable_other';
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
      NOW_MS - referenceMs <= TECHNICAL_RECENT_DAYS * 86_400_000;

    if (recentTechnical) {
      reason = 'technical_recent';
    } else {
      activity = await hasMeaningfulActivity(id);

      if (activity) {
        reason = 'keep_has_activity';
      } else if (memberCount > 1 || hasPendingInvites) {
        reason = 'keep_has_members_or_invites';
      } else if (ageDays == null || ageDays < MIN_ABANDONED_AGE_DAYS) {
        reason = 'keep_recent_or_unknown_age';
      } else {
        reason = 'abandoned_empty_no_subscription';
        deleteOrg = true;
      }
    }
  }

  const subscriptionStatus = collectBillingStatuses(subscription)[0] || null;
  const shouldCaptureLead = !protectedOrg && !billingProtected && Boolean(ownerUid);

  return {
    id,
    name,
    normalizedName,
    ownerUid,
    linkedUserIds: [...linkedUserIds],
    memberCount,
    hasPendingInvites,
    hasMeaningfulActivity: activity,
    billingProtected,
    subscriptionStatus,
    createdAtMs,
    updatedAtMs,
    ageDays,
    technical,
    explicitJunk,
    protected: protectedOrg,
    delete: deleteOrg,
    reason,
    shouldCaptureLead
  };
}

function resolveMarketingConsent(userData: Record<string, any>): {
  marketingEligible: boolean;
  consentKnown: boolean;
  raw: boolean | null;
} {
  const candidates = [
    userData.marketingConsent,
    userData.marketingOptIn,
    userData.emailMarketingConsent,
    userData.consents?.marketing,
    userData.consents?.emailMarketing
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'boolean') {
      return { marketingEligible: candidate, consentKnown: true, raw: candidate };
    }
  }

  return { marketingEligible: false, consentKnown: false, raw: null };
}

async function captureRemarketingLead(analysis: OrgAnalysis): Promise<boolean> {
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
    // Firestore profile may still contain enough contact data.
  }

  const email = firstString(userData.email, authUser?.email);
  const phone = firstString(userData.phone, userData.phoneNumber, userData.whatsapp, authUser?.phoneNumber);
  const displayName = firstString(
    userData.displayName,
    userData.name,
    userData.fullName,
    authUser?.displayName
  );

  if (!email && !phone) return false;

  const consent = resolveMarketingConsent(userData);
  const leadId = hashId(`${analysis.ownerUid}:${analysis.id}`);
  const leadRef = db.collection('remarketing_prospects').doc(leadId);

  const lastSignInTime = authUser?.metadata?.lastSignInTime
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
      lastSignInAt: lastSignInTime,
      subscriptionStatus: analysis.subscriptionStatus,
      cleanupDisposition: analysis.delete ? 'organization_deleted' : 'organization_kept',
      cleanupReason: analysis.reason,
      capturedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return true;
}

async function collectUsersReferencingOrganization(orgId: string, seedUids: string[]): Promise<Set<string>> {
  const uids = new Set(seedUids.filter(Boolean));
  const users = db.collection('users');

  const queries = [
    users.where('organizationId', '==', orgId),
    users.where('activeOrganizationId', '==', orgId),
    users.where('primaryOrganizationId', '==', orgId),
    users.where('organizations', 'array-contains', orgId),
    users.where('organizationIds', 'array-contains', orgId)
  ];

  for (const query of queries) {
    try {
      const snap = await query.get();
      snap.docs.forEach((doc) => uids.add(doc.id));
    } catch (error: any) {
      console.warn(`USER_REFERENCE_SCAN_SKIPPED code=${error?.code || 'unknown'}`);
    }
  }

  return uids;
}

async function chooseReplacementOrganization(userData: Record<string, any>, deletedOrgId: string): Promise<string | null> {
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
    if (org.exists) {
      const orgData = org.data() || {};
      if (!orgData.archived && normalizeText(orgData.status) !== 'archived') return candidate;
    }
  }

  return null;
}

async function detachOrganizationFromUser(uid: string, orgId: string): Promise<void> {
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  if (!userDoc.exists) return;

  const userData = userDoc.data() || {};
  const replacementOrgId = await chooseReplacementOrganization(userData, orgId);
  const updates: Record<string, any> = {
    updatedAt: FieldValue.serverTimestamp()
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

async function recursiveDeleteByOrganizationId(collectionName: string, orgId: string): Promise<number> {
  const snap = await db.collection(collectionName).where('organizationId', '==', orgId).get();
  let deleted = 0;
  for (const doc of snap.docs) {
    await (db as any).recursiveDelete(doc.ref);
    deleted += 1;
  }
  return deleted;
}

async function deleteOrganization(analysis: OrgAnalysis): Promise<number> {
  const orgRef = db.collection('organizations').doc(analysis.id);
  const legacyMembersSnap = await loadLegacyMembers(analysis.id);
  const userIds = await collectUsersReferencingOrganization(
    analysis.id,
    [
      ...analysis.linkedUserIds,
      ...(legacyMembersSnap
        ? legacyMembersSnap.docs
            .map((doc) => {
              const data = doc.data() || {};
              return firstString(data.uid, data.user_id, data.userId);
            })
            .filter(Boolean)
        : [])
    ]
  );

  let deletedTopLevelDocs = 0;

  for (const collectionName of ORG_SCOPED_COLLECTIONS_TO_DELETE) {
    try {
      deletedTopLevelDocs += await recursiveDeleteByOrganizationId(collectionName, analysis.id);
    } catch (error: any) {
      throw new Error(
        `Failed deleting org-scoped collection ${collectionName}: ${error?.message || String(error)}`
      );
    }
  }

  if (legacyMembersSnap) {
    for (const doc of legacyMembersSnap.docs) {
      await doc.ref.delete();
      deletedTopLevelDocs += 1;
    }
  }

  // Catch both historical legacy membership ID conventions.
  for (const uid of userIds) {
    await Promise.all([
      db.collection('organization_members').doc(`${uid}_${analysis.id}`).delete().catch(() => undefined),
      db.collection('organization_members').doc(`${analysis.id}_${uid}`).delete().catch(() => undefined)
    ]);
  }

  await db.collection('subscriptions').doc(analysis.id).delete().catch(() => undefined);

  for (const uid of userIds) {
    await detachOrganizationFromUser(uid, analysis.id);
  }

  await (db as any).recursiveDelete(orgRef);
  return deletedTopLevelDocs;
}

async function run() {
  const organizationsSnap = await db.collection('organizations').get();
  const analyses: OrgAnalysis[] = [];

  for (const orgDoc of organizationsSnap.docs) {
    analyses.push(await analyzeOrganization(orgDoc));
  }

  const countsByReason = analyses.reduce<Record<string, number>>((acc, analysis) => {
    acc[analysis.reason] = (acc[analysis.reason] || 0) + 1;
    return acc;
  }, {});

  const deleteCandidates = analyses.filter((analysis) => analysis.delete);
  const protectedOrganizations = analyses.filter((analysis) => analysis.protected);
  const activeBillingOrganizations = analyses.filter((analysis) => analysis.billingProtected);
  const potentialLeads = analyses.filter((analysis) => analysis.shouldCaptureLead);

  let leadsCaptured = 0;
  let organizationsDeleted = 0;
  let topLevelDocumentsDeleted = 0;

  if (MODE === 'apply') {
    // Capture contact data first, then delete only high-confidence organizations.
    for (const analysis of potentialLeads) {
      try {
        if (await captureRemarketingLead(analysis)) leadsCaptured += 1;
      } catch (error: any) {
        // Lead capture failure must block deletion of that organization if it is a delete candidate.
        if (analysis.delete) {
          throw new Error(`Remarketing capture failed before delete for ${hashId(analysis.id)}: ${error?.message || error}`);
        }
        console.warn(`LEAD_CAPTURE_SKIPPED org=${hashId(analysis.id)}`);
      }
    }

    for (const analysis of deleteCandidates) {
      // Re-check billing immediately before destructive work.
      const subDoc = await db.collection('subscriptions').doc(analysis.id).get();
      const latestSubscription = subDoc.exists ? (subDoc.data() || {}) : null;
      if (hasActiveBilling(latestSubscription)) {
        console.warn(`DELETE_SKIPPED_ACTIVE_BILLING org=${hashId(analysis.id)}`);
        continue;
      }

      topLevelDocumentsDeleted += await deleteOrganization(analysis);
      organizationsDeleted += 1;
    }

    await db.collection('maintenance_runs').doc(RUN_ID).set({
      type: 'ecosystem_organization_cleanup',
      mode: MODE,
      projectId: PROJECT_ID,
      startedAtApprox: Timestamp.fromMillis(NOW_MS),
      completedAt: FieldValue.serverTimestamp(),
      totalOrganizationsScanned: analyses.length,
      protectedOrganizations: protectedOrganizations.length,
      activeBillingOrganizations: activeBillingOrganizations.length,
      deleteCandidates: deleteCandidates.length,
      organizationsDeleted,
      potentialRemarketingLeads: potentialLeads.length,
      leadsCaptured,
      topLevelDocumentsDeleted,
      countsByReason,
      policy: {
        absoluteProtectedNames: [...ABSOLUTE_PROTECTED_NAMES],
        minAbandonedAgeDays: MIN_ABANDONED_AGE_DAYS,
        technicalRecentDays: TECHNICAL_RECENT_DAYS,
        explicitJunkNameTokens: EXPLICIT_JUNK_NAME_TOKENS
      }
    });
  }

  const summary = {
    mode: MODE,
    runId: RUN_ID,
    projectId: PROJECT_ID,
    totalOrganizationsScanned: analyses.length,
    protectedOrganizations: protectedOrganizations.length,
    activeBillingOrganizations: activeBillingOrganizations.length,
    deleteCandidates: deleteCandidates.length,
    organizationsDeleted,
    potentialRemarketingLeads: potentialLeads.length,
    leadsCaptured,
    topLevelDocumentsDeleted,
    countsByReason
  };

  console.log(`CLEANUP_SUMMARY_JSON=${JSON.stringify(summary)}`);
}

run().catch((error) => {
  console.error('CLEANUP_FATAL', error?.stack || error);
  process.exit(1);
});
