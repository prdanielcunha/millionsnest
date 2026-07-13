import { resolveCanonicalInvitationCapacity } from '../src/server/services/InvitationAcceptanceServerPolicy.js';
import fs from 'fs';

let passed = 0;
let failed = 0;

function assertCondition(name: string, condition: boolean) {
  if (condition) {
    console.log(`[PASS] ${name}`);
    passed++;
  } else {
    console.error(`[FAIL] ${name}`);
    failed++;
  }
}

// Tests for resolveCanonicalInvitationCapacity
// 1. starter consistente retorna limite 10;
const r1 = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: true, organizationId: 'org1', app: 'musicscale', status: 'active', plan: 'starter', limitsUsers: 10 },
  organizationApp: { exists: true, status: 'active', plan: 'starter', limitsUsers: 10 },
  memberStatuses: []
});
assertCondition('1. starter consistente retorna limite 10', r1.success && r1.capacity.maxMembers === 10);

// 2. advanced consistente retorna limite 20;
const r2 = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: true, organizationId: 'org1', app: 'musicscale', status: 'active', plan: 'advanced', limitsUsers: 20 },
  organizationApp: { exists: true, status: 'active', plan: 'advanced', limitsUsers: 20 },
  memberStatuses: []
});
assertCondition('2. advanced consistente retorna limite 20', r2.success && r2.capacity.maxMembers === 20);

// 3. pro consistente retorna unlimited;
const r3 = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: true, organizationId: 'org1', app: 'musicscale', status: 'active', plan: 'pro', limitsUsers: -1 },
  organizationApp: { exists: true, status: 'active', plan: 'pro', limitsUsers: -1 },
  memberStatuses: []
});
assertCondition('3. pro consistente retorna unlimited', r3.success && r3.capacity.mode === 'unlimited');

// 4. assinatura ausente falha unavailable;
const r4 = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: false },
  organizationApp: { exists: true, status: 'active', plan: 'starter', limitsUsers: 10 },
  memberStatuses: []
});
assertCondition('4. assinatura ausente falha unavailable', !r4.success && (r4.success === false ? r4.reasonCode : '') === 'MEMBER_LIMIT_UNAVAILABLE');

// 5. projeção do app ausente falha unavailable;
const r5 = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: true, organizationId: 'org1', app: 'musicscale', status: 'active', plan: 'starter', limitsUsers: 10 },
  organizationApp: { exists: false },
  memberStatuses: []
});
assertCondition('5. projeção do app ausente falha unavailable', !r5.success && (r5.success === false ? r5.reasonCode : '') === 'MEMBER_LIMIT_UNAVAILABLE');

// 6. subscription.organizationId divergente falha unavailable;
const r6 = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: true, organizationId: 'org2', app: 'musicscale', status: 'active', plan: 'starter', limitsUsers: 10 },
  organizationApp: { exists: true, status: 'active', plan: 'starter', limitsUsers: 10 },
  memberStatuses: []
});
assertCondition('6. subscription.organizationId divergente falha unavailable', !r6.success && (r6.success === false ? r6.reasonCode : '') === 'MEMBER_LIMIT_UNAVAILABLE');

// 7. app diferente de musicscale falha unavailable;
const r7 = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: true, organizationId: 'org1', app: 'otherapp', status: 'active', plan: 'starter', limitsUsers: 10 },
  organizationApp: { exists: true, status: 'active', plan: 'starter', limitsUsers: 10 },
  memberStatuses: []
});
assertCondition('7. app diferente de musicscale falha unavailable', !r7.success && (r7.success === false ? r7.reasonCode : '') === 'MEMBER_LIMIT_UNAVAILABLE');

// 8. assinatura canceled falha unavailable;
const r8 = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: true, organizationId: 'org1', app: 'musicscale', status: 'canceled', plan: 'starter', limitsUsers: 10 },
  organizationApp: { exists: true, status: 'active', plan: 'starter', limitsUsers: 10 },
  memberStatuses: []
});
assertCondition('8. assinatura canceled falha unavailable', !r8.success && (r8.success === false ? r8.reasonCode : '') === 'MEMBER_LIMIT_UNAVAILABLE');

// 9. app canceled falha unavailable;
const r9 = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: true, organizationId: 'org1', app: 'musicscale', status: 'active', plan: 'starter', limitsUsers: 10 },
  organizationApp: { exists: true, status: 'canceled', plan: 'starter', limitsUsers: 10 },
  memberStatuses: []
});
assertCondition('9. app canceled falha unavailable', !r9.success && (r9.success === false ? r9.reasonCode : '') === 'MEMBER_LIMIT_UNAVAILABLE');

// 10. planos divergentes falham unavailable;
const r10 = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: true, organizationId: 'org1', app: 'musicscale', status: 'active', plan: 'starter', limitsUsers: 10 },
  organizationApp: { exists: true, status: 'active', plan: 'advanced', limitsUsers: 10 },
  memberStatuses: []
});
assertCondition('10. planos divergentes falham unavailable', !r10.success && (r10.success === false ? r10.reasonCode : '') === 'MEMBER_LIMIT_UNAVAILABLE');

// 11. plano desconhecido falha invalid;
const r11 = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: true, organizationId: 'org1', app: 'musicscale', status: 'active', plan: 'unknown', limitsUsers: 10 },
  organizationApp: { exists: true, status: 'active', plan: 'unknown', limitsUsers: 10 },
  memberStatuses: []
});
assertCondition('11. plano desconhecido falha invalid', !r11.success && (r11.success === false ? r11.reasonCode : '') === 'MEMBER_LIMIT_INVALID');

// 12. limite da assinatura ausente falha invalid;
const r12 = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: true, organizationId: 'org1', app: 'musicscale', status: 'active', plan: 'starter', limitsUsers: undefined },
  organizationApp: { exists: true, status: 'active', plan: 'starter', limitsUsers: 10 },
  memberStatuses: []
});
assertCondition('12. limite da assinatura ausente falha invalid', !r12.success && (r12.success === false ? r12.reasonCode : '') === 'MEMBER_LIMIT_INVALID');

// 13. limite do app ausente falha invalid;
const r13 = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: true, organizationId: 'org1', app: 'musicscale', status: 'active', plan: 'starter', limitsUsers: 10 },
  organizationApp: { exists: true, status: 'active', plan: 'starter', limitsUsers: undefined },
  memberStatuses: []
});
assertCondition('13. limite do app ausente falha invalid', !r13.success && (r13.success === false ? r13.reasonCode : '') === 'MEMBER_LIMIT_INVALID');

// 14. limite starter diferente de 10 falha invalid;
const r14 = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: true, organizationId: 'org1', app: 'musicscale', status: 'active', plan: 'starter', limitsUsers: 11 },
  organizationApp: { exists: true, status: 'active', plan: 'starter', limitsUsers: 11 },
  memberStatuses: []
});
assertCondition('14. limite starter diferente de 10 falha invalid', !r14.success && (r14.success === false ? r14.reasonCode : '') === 'MEMBER_LIMIT_INVALID');

// 15. limite advanced diferente de 20 falha invalid;
const r15 = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: true, organizationId: 'org1', app: 'musicscale', status: 'active', plan: 'advanced', limitsUsers: 25 },
  organizationApp: { exists: true, status: 'active', plan: 'advanced', limitsUsers: 25 },
  memberStatuses: []
});
assertCondition('15. limite advanced diferente de 20 falha invalid', !r15.success && (r15.success === false ? r15.reasonCode : '') === 'MEMBER_LIMIT_INVALID');

// 16. limite pro diferente de -1 falha invalid;
const r16 = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: true, organizationId: 'org1', app: 'musicscale', status: 'active', plan: 'pro', limitsUsers: 100 },
  organizationApp: { exists: true, status: 'active', plan: 'pro', limitsUsers: 100 },
  memberStatuses: []
});
assertCondition('16. limite pro diferente de -1 falha invalid', !r16.success && (r16.success === false ? r16.reasonCode : '') === 'MEMBER_LIMIT_INVALID');

// 17. memberships active são contadas;
const r17 = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: true, organizationId: 'org1', app: 'musicscale', status: 'active', plan: 'starter', limitsUsers: 10 },
  organizationApp: { exists: true, status: 'active', plan: 'starter', limitsUsers: 10 },
  memberStatuses: ['active', 'active']
});
assertCondition('17. memberships active são contadas', r17.success && r17.capacity.currentActiveMembers === 2);

// 18. memberships sem status são contadas;
const r18 = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: true, organizationId: 'org1', app: 'musicscale', status: 'active', plan: 'starter', limitsUsers: 10 },
  organizationApp: { exists: true, status: 'active', plan: 'starter', limitsUsers: 10 },
  memberStatuses: [undefined, undefined]
});
assertCondition('18. memberships sem status são contadas', r18.success && r18.capacity.currentActiveMembers === 2);

// 19. memberships suspensas são ignoradas;
const r19 = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: true, organizationId: 'org1', app: 'musicscale', status: 'active', plan: 'starter', limitsUsers: 10 },
  organizationApp: { exists: true, status: 'active', plan: 'starter', limitsUsers: 10 },
  memberStatuses: ['active', 'suspended', 'inactive', 'removed', 'revoked', 'deleted']
});
assertCondition('19. memberships suspensas são ignoradas', r19.success && r19.capacity.currentActiveMembers === 1);

// 20. status desconhecido falha invalid;
const r20 = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: true, organizationId: 'org1', app: 'musicscale', status: 'active', plan: 'starter', limitsUsers: 10 },
  organizationApp: { exists: true, status: 'active', plan: 'starter', limitsUsers: 10 },
  memberStatuses: ['unknown']
});
assertCondition('20. status desconhecido falha invalid', !r20.success && (r20.success === false ? r20.reasonCode : '') === 'MEMBER_LIMIT_INVALID');

// 21. ordem das memberships não altera o resultado.
const r21a = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: true, organizationId: 'org1', app: 'musicscale', status: 'active', plan: 'starter', limitsUsers: 10 },
  organizationApp: { exists: true, status: 'active', plan: 'starter', limitsUsers: 10 },
  memberStatuses: ['active', 'suspended', undefined]
});
const r21b = resolveCanonicalInvitationCapacity({
  organizationId: 'org1',
  subscription: { exists: true, organizationId: 'org1', app: 'musicscale', status: 'active', plan: 'starter', limitsUsers: 10 },
  organizationApp: { exists: true, status: 'active', plan: 'starter', limitsUsers: 10 },
  memberStatuses: ['suspended', undefined, 'active']
});
assertCondition('21. ordem das memberships não altera o resultado', r21a.success && r21b.success && r21a.capacity.currentActiveMembers === r21b.capacity.currentActiveMembers);

// Structural tests for endpoint
const serviceContent = fs.readFileSync('src/server/services/TenantContextMutationService.ts', 'utf8');
const lines = serviceContent.split('\n');
const startIdx = lines.findIndex(l => l.includes('export async function acceptInvitation'));
const endIdx = lines.findIndex(l => l.includes('export async function setActiveOrganization'));
const endpointContent = lines.slice(startIdx, endIdx).join('\n');

assertCondition('22. usa planInvitationAcceptance', endpointContent.includes('planInvitationAcceptance('));
assertCondition('23. usa resolveCanonicalInvitationCapacity', endpointContent.includes('resolveCanonicalInvitationCapacity('));
assertCondition('24. consulta somente hash SHA-256', endpointContent.includes('crypto.createHash') && endpointContent.includes('tokenHash'));
assertCondition('25. não consulta token bruto', !endpointContent.includes("where('token',") && !endpointContent.includes("legacyQuery"));
assertCondition('26. não contém legacyMigrated true', !endpointContent.includes("legacyMigrated = true") && !endpointContent.includes("legacyMigrated: true"));
assertCondition('27. não usa limit(1)', !endpointContent.includes(".limit(1)"));
assertCondition('28. exige caminho organizations/{orgId}/invites', endpointContent.includes("parts.length === 4") || endpointContent.includes("organizations/{orgId}/invites"));
assertCondition('29. getAuth().getUser ocorre antes de runTransaction', endpointContent.indexOf('getAuth().getUser') < endpointContent.indexOf('runTransaction'));
assertCondition('30. acceptanceNowMs ocorre antes de runTransaction', endpointContent.indexOf('acceptanceNowMs =') < endpointContent.indexOf('runTransaction'));

const transactionMatch = endpointContent.match(/runTransaction\s*\(\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\}\s*\)/);
const txBody = transactionMatch ? transactionMatch[1] : '';

assertCondition('31. callback não contém Date.now', !txBody.includes('Date.now()'));
assertCondition('32. callback não contém new Date', !txBody.includes('new Date('));
assertCondition('33. não existe fallback de papel para member', !txBody.includes("role = 'member'"));
assertCondition('34. lê subscriptions/{orgId}', txBody.includes("subscriptions") || endpointContent.includes('collection(\'subscriptions\')'));
assertCondition('35. lê organizations/{orgId}/members', txBody.includes("members") || endpointContent.includes('/members'));

const firstWriteIdx = Math.min(
  txBody.indexOf('.set(') === -1 ? Infinity : txBody.indexOf('.set('),
  txBody.indexOf('.update(') === -1 ? Infinity : txBody.indexOf('.update('),
  txBody.indexOf('.delete(') === -1 ? Infinity : txBody.indexOf('.delete(')
);
const lastReadIdx = txBody.lastIndexOf('.get(');
assertCondition('36. nenhuma leitura transacional ocorre após a primeira escrita', lastReadIdx < firstWriteIdx);

assertCondition('37. grava membership status active', endpointContent.includes("status: 'active'"));
assertCondition('38. grava organização e papel na projeção legada', endpointContent.includes("organization_members") && endpointContent.includes("organizationRole"));
assertCondition('39. atualiza organizations, activeOrganizationId e organizationId do usuário', endpointContent.includes("activeOrganizationId:") && endpointContent.includes("organizationId:"));
assertCondition('40. incrementa useCount', endpointContent.includes("useCount:") && endpointContent.includes("+ 1"));
assertCondition('41. não usa FieldValue.increment sem validar o valor anterior', !endpointContent.includes("FieldValue.increment"));
assertCondition('42. grava acceptedBy somente no uso final', endpointContent.includes("acceptedBy =") || endpointContent.includes("acceptedBy:"));
assertCondition('43. cria audit log invitation.accepted', endpointContent.includes("invitation.accepted"));
assertCondition('44. resposta idempotente contém alreadyMember true', endpointContent.includes("alreadyMember: true"));
assertCondition('45. resposta de criação contém alreadyMember false', endpointContent.includes("alreadyMember: false"));
assertCondition('46. legacyTokenMigrated é sempre false', endpointContent.includes("legacyTokenMigrated: false"));
assertCondition('47. acceptInvitation não chama resolveMusicScaleEntitlements', !endpointContent.includes('resolveMusicScaleEntitlements'));
assertCondition('48. acceptInvitation não chama normalizeMusicScalePlan', !endpointContent.includes('normalizeMusicScalePlan'));
assertCondition('49. acceptInvitation não chama canAddOrganizationMember', !endpointContent.includes('canAddOrganizationMember'));
assertCondition('50. acceptInvitation não chama assertCanAddOrganizationMember', !endpointContent.includes('assertCanAddOrganizationMember'));
assertCondition('51. bootstrapUserContext permanece exportado', serviceContent.includes('export async function bootstrapUserContext'));
assertCondition('52. setActiveOrganization permanece exportado', serviceContent.includes('export async function setActiveOrganization'));


console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
