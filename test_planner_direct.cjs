const planner = require('./dist/server/services/InvitationAcceptancePlanner.js');

const directIdemp1 = planner.planInvitationAcceptance({
  identity: { uid: 'u1', email: 'u1@test.com' },
  organization: { exists: true, status: 'active' },
  invitation: { exists: true, organizationId: 'org1', status: 'pending', email: null, role: 'member', maxUses: 10, useCount: 1, emailNormalized: null, expiresAtMs: undefined, revokedAtMs: undefined },
  existingMembership: { exists: true, status: 'active', role: 'member' },
  capacity: { resolved: false }
}, 1000);

console.log(directIdemp1);
