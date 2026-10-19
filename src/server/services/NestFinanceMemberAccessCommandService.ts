import type { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { isCanonicalGlobalRole } from '../../lib/permissionService.js';
import { nextEcosystemSessionVersion } from './EcosystemSessionVersionService.js';

export const INDIVIDUAL_FINANCE_ACCESS = 'finance.access.individual_v1';
export const FINANCE_ACCESS_KEYS = ['enabled', 'count', 'register', 'review', 'approve', 'balance', 'manage'] as const;
export type FinanceMemberAccess = Record<typeof FINANCE_ACCESS_KEYS[number], boolean>;
const CAPABILITIES = {
  count: ['finance.view', 'finance.count.view', 'finance.count.execute'],
  register: ['finance.view', 'finance.treasury.view', 'finance.create_drafts', 'finance.submit_for_review'],
  review: ['finance.view', 'finance.treasury.view', 'finance.review'],
  approve: ['finance.view', 'finance.treasury.view', 'finance.approve_for_posting'],
  balance: ['finance.view', 'finance.treasury.view', 'finance.balance.view'],
  manage: ['finance.manage'],
} as const;
export function financePermissionsForAccess(access: FinanceMemberAccess): string[] {
  return [...new Set([INDIVIDUAL_FINANCE_ACCESS, ...Object.entries(CAPABILITIES)
    .flatMap(([key, grants]) => access[key as keyof typeof CAPABILITIES] ? [...grants] : [])])];
}
const safeId = (value: unknown): value is string => typeof value === 'string' &&
  value.length > 0 && value.length <= 256 && value !== '.' && value !== '..' && !/[\/\u0000-\u001f\u007f]/.test(value);
const active = (value: any) => !!value && value.enabled !== false && value.disabled !== true &&
  ['', 'active', 'ativo'].includes(String(value.status ?? '').toLowerCase());
const grantsOf = (member: any): string[] => Array.isArray(member?.appAccess?.nestFinance?.permissions)
  ? member.appAccess.nestFinance.permissions.filter((v: unknown) => typeof v === 'string') : [];
function legacyCountOnly(member: any): boolean {
  const grants = grantsOf(member);
  if (grants.includes(INDIVIDUAL_FINANCE_ACCESS)) return false;
  if (grants.some(grant => grant === 'finance.count.execute' || grant === 'finance.count.view')) {
    return grants.every(grant => ['finance.view', 'finance.create_drafts', 'finance.balance.view', 'organization.manage_team'].includes(grant) || grant.startsWith('finance.count.'));
  }
  const roles = [member?.role ?? member?.organizationRole, ...(Array.isArray(member?.appAccess?.nestFinance?.roles) ? member.appAccess.nestFinance.roles : [])]
    .map(role => String(role ?? '').trim().toLowerCase());
  const matches = (words: string[]) => roles.some(role => words.some(word => role.includes(word)));
  if (matches(['owner', 'admin', 'administrador', 'treasurer', 'tesoureiro', 'tesouraria', 'financeiro', 'finance_team', 'accountant', 'contador', 'contabil', 'contábil', 'accounting'])) return false;
  if (!matches(['count_team', 'counting_team', 'equipe_contagem', 'contagem', 'conferente', 'volunteer', 'voluntario', 'voluntário'])) return false;
  return !grants.some(grant => ['*', 'finance.manage', 'finance.review', 'finance.approve_for_posting', 'finance.post_transactions', 'finance.accountant.view_exports', 'organization.manage_entities', 'finance.accounts.manage', 'finance.accounts.repair', 'finance.funds.manage', 'finance.categories.manage'].includes(grant));
}
const fullFinance = (member: any) => {
  const grants = grantsOf(member);
  if (grants.includes('*') || grants.includes('finance.manage')) return true;
  if (grants.includes(INDIVIDUAL_FINANCE_ACCESS)) return false;
  // Match the restrictive canonical Count/team bridge before legacy role inheritance.
  const count = grants.some(g => g === 'finance.count.execute' || g === 'finance.count.view');
  if (count && grants.every(g => ['finance.view', 'finance.create_drafts', 'finance.balance.view', 'organization.manage_team'].includes(g) || g.startsWith('finance.count.'))) return false;
  if (grants.includes('organization.manage_team') && !grants.some(g => g.startsWith('finance.') && g !== 'finance.balance.view')) return false;
  return ['owner', 'admin'].includes(String(member?.role ?? member?.organizationRole ?? '').toLowerCase());
};
export function projectFinanceMemberAccess(member: any): FinanceMemberAccess {
  const grants = grantsOf(member);
  const full = fullFinance(member);
  const countOnly = legacyCountOnly(member);
  const legacyTeamOnly = !grants.includes(INDIVIDUAL_FINANCE_ACCESS) && grants.includes('organization.manage_team') &&
    !grants.some(grant => grant === '*' || grant === 'organization.manage_entities' || (grant.startsWith('finance.') && grant !== 'finance.balance.view'));
  return { enabled: member?.appAccess?.nestFinance?.enabled === true,
    count: full || grants.includes('finance.count.execute') || (countOnly && grants.includes('finance.view') && grants.includes('finance.create_drafts') && !grants.includes('finance.count.view')),
    register: full || (grants.includes('finance.create_drafts') && !countOnly),
    review: full || grants.includes('finance.review'), approve: full || grants.includes('finance.approve_for_posting'),
    balance: full || (!countOnly && !legacyTeamOnly && grants.includes('finance.balance.view')), manage: full };
}
type Dependencies = { verifyIdToken?: (token: string) => Promise<{ uid: string }>; getFirestore?: () => Firestore };
export async function nestFinanceMemberAccess(req: Request, res: Response, dependencies: Dependencies = {}) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'PATCH') return res.status(405).json({ success: false, reasonCode: 'METHOD_NOT_ALLOWED' });
  let actorUid: string;
  try {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) throw new Error('AUTH');
    actorUid = (await (dependencies.verifyIdToken ?? (token => getAuth().verifyIdToken(token, true)))(authorization.slice(7))).uid;
    if (!safeId(actorUid)) throw new Error('AUTH');
  } catch { return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' }); }
  const organizationId = req.params.organizationId, memberId = req.params.memberId;
  if (!safeId(organizationId) || !safeId(memberId)) return res.status(400).json({ success: false, reasonCode: 'INVALID_REQUEST' });
  if (req.method === 'PATCH') {
    const body = req.body;
    if (!body || Object.keys(body).some(key => !['access', 'expectedRevision', 'reason'].includes(key)) ||
      !body.access || Object.keys(body.access).length !== FINANCE_ACCESS_KEYS.length ||
      !FINANCE_ACCESS_KEYS.every(key => typeof body.access[key] === 'boolean') ||
      !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0 ||
      !['team_setup', 'responsibility_changed', 'access_removed'].includes(body.reason)) {
      return res.status(400).json({ success: false, reasonCode: 'INVALID_REQUEST' });
    }
  }
  try {
    const db = (dependencies.getFirestore ?? getFirestore)();
    const result = await db.runTransaction(async transaction => {
      const orgRef = db.doc(`organizations/${organizationId}`);
      const actorRef = db.doc(`users/${actorUid}`);
      const actorMemberRef = db.doc(`organizations/${organizationId}/members/${actorUid}`);
      const memberRef = db.doc(`organizations/${organizationId}/members/${memberId}`);
      const targetRef = db.doc(`users/${memberId}`);
      const [orgSnap, actorSnap, actorMemberSnap, memberSnap, targetSnap] = await Promise.all(
        [orgRef, actorRef, actorMemberRef, memberRef, targetRef].map(ref => transaction.get(ref)));
      const org = orgSnap.data(), actor = actorSnap.data(), actorMember = actorMemberSnap.data(), member = memberSnap.data(), target = targetSnap.data();
      if (!org || org.archived === true || !active(org) || !active(actor) || !active(member) || !active(target)) return { status: 403, reasonCode: 'ACCESS_UNAVAILABLE' };
      const global = isCanonicalGlobalRole(actor.systemRole);
      const entitlement = org.entitlements?.nestfinance;
      if (!Array.isArray(org.enabledApps) || !org.enabledApps.includes('nestfinance') ||
          !(entitlement?.active === true || entitlement?.status === 'active')) return { status: 403, reasonCode: 'APP_UNAVAILABLE' };
      const canManageMembers = active(actorMember) && (['owner', 'admin'].includes(String(actorMember?.role ?? actorMember?.organizationRole ?? '').toLowerCase()) || actorMember?.permissions?.['organization.roles.manage'] === true);
      if (!global && !(canManageMembers && actorMember?.appAccess?.nestFinance?.enabled === true && fullFinance(actorMember))) return { status: 403, reasonCode: 'PERMISSION_DENIED' };
      // A scoped administrator cannot change an unbounded or wider membership.
      const actorScope = actorMember?.appAccess?.nestFinance?.scopes;
      const targetScope = member.appAccess?.nestFinance?.scopes;
      if (!global && actorScope && Object.prototype.hasOwnProperty.call(actorScope, 'financeEntityIds') &&
          !(Array.isArray(actorScope['*']) && actorScope['*'].includes('*'))) {
        const ids = actorScope.financeEntityIds;
        if (!Array.isArray(ids) || (!ids.includes('*') && (!Array.isArray(targetScope?.financeEntityIds) ||
          (Array.isArray(targetScope?.['*']) && targetScope['*'].includes('*')) ||
          !targetScope.financeEntityIds.every((id: unknown) => typeof id === 'string' && ids.includes(id))))) return { status: 403, reasonCode: 'SCOPE_DENIED' };
      }
      const targetGlobal = isCanonicalGlobalRole(target.systemRole);
      const targetOwner = String(member.role ?? member.organizationRole ?? '').toLowerCase() === 'owner' ||
        [org.ownerUid, org.ownerId, org.owner_user_id, org.ownerUserId].includes(memberId);
      const editable = !targetGlobal && actorUid !== memberId && (global || !targetOwner);
      const previous = member.appAccess?.nestFinance ?? {};
      const revision = Number.isSafeInteger(previous.accessRevision) && previous.accessRevision >= 0 ? previous.accessRevision : 0;
      if (req.method === 'GET') return { status: 200, success: true, access: targetGlobal ? {
        enabled: true, count: true, register: true, review: true, approve: true, balance: true, manage: true,
      } : projectFinanceMemberAccess(member), revision, editable,
        inherited: targetGlobal, individual: grantsOf(member).includes(INDIVIDUAL_FINANCE_ACCESS) };
      if (!editable) return { status: 403, reasonCode: 'MEMBER_PROTECTED' };
      if (revision !== req.body.expectedRevision) return { status: 409, reasonCode: 'ACCESS_CHANGED' };
      if (revision >= Number.MAX_SAFE_INTEGER) throw new Error('REVISION_EXHAUSTED');
      const access: FinanceMemberAccess = req.body.access;
      const nextAccess = { ...previous, enabled: access.enabled,
        permissions: financePermissionsForAccess(access), accessRevision: revision + 1 };
      transaction.set(memberRef, { appAccess: { ...member.appAccess, nestFinance: nextAccess }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(targetRef, { ecosystemSessionVersion: nextEcosystemSessionVersion(target.ecosystemSessionVersion),
        ecosystemSessionVersionUpdatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(db.collection(`organizations/${organizationId}/audit_logs`).doc(), {
        action: 'nestfinance.member.permissions_updated', organizationId, actorUid, memberId,
        reason: req.body.reason, previousAccess: previous, nextAccess,
        timestamp: FieldValue.serverTimestamp(),
      });
      return { status: 200, success: true, access, revision: revision + 1, editable: true, individual: true, inherited: false };
    });
    const { status, ...body } = result;
    return res.status(status).json(body);
  } catch { return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' }); }
}
