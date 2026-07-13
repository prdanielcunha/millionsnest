import { planInvitationAcceptance } from './src/server/services/InvitationAcceptancePlanner.js';
console.log(planInvitationAcceptance({
  identity: { uid: 'u1', email: 'u1@test.com' },
  organization: { exists: true, status: 'active' },
  invitation: { exists: true, organizationId: 'org1', status: 'pending', email: null, role: 'member', maxUses: 10, useCount: 1, emailNormalized: null, expiresAtMs: undefined, revokedAtMs: undefined, acceptedBy: undefined },
  existingMembership: { exists: true, status: 'active', role: 'member' },
  capacity: { resolved: false }
}, 1000));
