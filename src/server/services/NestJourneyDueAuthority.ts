import type { Firestore } from 'firebase-admin/firestore';
import type { NestJourneyConnectFollowupSource } from './NestJourneyFollowupEventPublisher.js';

const safe = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() === value &&
  value.length > 0 && value.length <= 180 &&
  value !== '.' && value !== '..' && !/[\\/\u0000-\u001f\u007f]/.test(value);
const clean = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';
const active = (fields: Record<string, any> | undefined): boolean =>
  !!fields && !['inactive', 'suspended', 'revoked', 'removed', 'deleted', 'disabled', 'archived', 'pending']
    .includes(clean(fields.status).toLowerCase()) && fields.disabled !== true && fields.isActive !== false;
const careRoles = new Set(['owner', 'admin', 'pastor', 'care']);
const broadRoles = new Set(['owner', 'admin', 'pastor']);

/**
 * Recheck LIVE church and contact authority after the initial authorized
 * GET and immediately before creating a signed Connect operator event.
 * Everything comes from the Hub's canonical Firestore hierarchy, never
 * caller-selected IDs, Web tokens, client claims, phone numbers or PII.
 *
 * Fail closed for missing/inactive data. This check does not authorize
 * outbound Meta messages or circumvent Connect's own Inbox permissions.
 */
export async function verifyCurrentNestJourneyDueAuthority(input: {
  db: Pick<Firestore, 'doc'>;
  event: NestJourneyConnectFollowupSource;
  now?: () => number;
}): Promise<boolean> {
  const { event, db } = input;
  if (![event.organizationId, event.followupId, event.ownerUid].every(safe) ||
      typeof event.dueAt !== 'string') return false;
  const now = (input.now ?? Date.now)();
  const due = Date.parse(event.dueAt);
  if (!Number.isSafeInteger(now) || !Number.isFinite(due) ||
      due > now || due < now - 7 * 86400000) return false;
  try {
    const prefix = `organizations/${event.organizationId}`;
    const journey = `${prefix}/products/raiz_e_mesa`;
    const [orgSnap, memberSnap, followupSnap] = await Promise.all([
      db.doc(prefix).get(),
      db.doc(`${prefix}/members/${event.ownerUid}`).get(),
      db.doc(`${journey}/followups/${event.followupId}`).get(),
    ]);
    if (!orgSnap.exists || !followupSnap.exists) return false;
    const org = orgSnap.data() ?? {}, member = memberSnap.data() ?? {};
    const followup = followupSnap.data() ?? {};
    if (org.archived === true ||
        ['inactive', 'suspended', 'disabled', 'archived'].includes(clean(org.status).toLowerCase())) return false;
    const configuredApp = org.apps?.nestjourney ?? org.apps?.raiz_e_mesa;
    const appStatus = typeof configuredApp === 'string' ? configuredApp : configuredApp?.status;
    if (['inactive', 'suspended', 'disabled', 'cancelled', 'canceled']
      .includes(clean(appStatus).toLowerCase())) return false;
    const churchOwner = [org.ownerUid, org.ownerId].some(ref => clean(ref) === event.ownerUid);
    if (!churchOwner && (!memberSnap.exists || !active(member))) return false;
    const role = churchOwner ? 'owner' : clean(member.organizationRole || member.role).toLowerCase();
    const canCare = churchOwner || careRoles.has(role) || (active(member) && member.permissions?.canManageCare === true);
    if (!canCare) return false;
    const congregationId = clean(followup.congregationId);
    if (!safe(congregationId) || (!churchOwner && !broadRoles.has(role) &&
      (!Array.isArray(member.congregationIds) || !member.congregationIds.includes(congregationId)))) return false;
    const dueAt = followup.dueAt;
    const recorded = typeof dueAt === 'string' ? Date.parse(dueAt) :
      dueAt && typeof dueAt.toMillis === 'function' ? dueAt.toMillis() :
      dueAt && typeof dueAt.toDate === 'function' ? +dueAt.toDate() : NaN;
    if (recorded !== due || clean(followup.organizationId) !== event.organizationId ||
        clean(followup.kind) !== 'first_contact' || clean(followup.status) !== 'pending' ||
        clean(followup.ownerRef) !== event.ownerUid ||
        !safe(followup.careRequestId) || !safe(followup.personId)) return false;
    const [careSnap, personSnap] = await Promise.all([
      db.doc(`${journey}/careRequests/${followup.careRequestId}`).get(),
      db.doc(`${journey}/people/${followup.personId}`).get(),
    ]);
    if (!careSnap.exists || !personSnap.exists) return false;
    const care = careSnap.data() ?? {}, person = personSnap.data() ?? {};
    return clean(care.organizationId) === event.organizationId &&
      clean(care.congregationId) === congregationId &&
      clean(care.personId) === clean(followup.personId) &&
      clean(care.careType) === 'first_contact' &&
      clean(care.status) === 'open' &&
      clean(care.ownerRef) === event.ownerUid &&
      clean(person.organizationId) === event.organizationId &&
      clean(person.congregationId) === congregationId &&
      person.consent === true &&
      person.consentRevokedAt == null &&
      clean(person.contactStatus) !== 'closed' &&
      clean(person.preferredContactChannel) === 'whatsapp' &&
      Boolean(clean(person.phone)) &&
      Boolean(clean(person.name));
  } catch {
    // A transient read/permission failure must NEVER be treated as consent.
    return false;
  }
}
