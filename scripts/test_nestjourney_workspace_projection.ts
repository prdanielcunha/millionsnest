import assert from 'node:assert/strict';
import {
  clearInvitationEmulator,
  requireInvitationEmulator
} from './helpers/p0HandlerTestHarness.js';
import {
  handleNestJourneyWorkspaceProjectionRequest
} from '../src/server/services/NestJourneyWorkspaceProjectionService.js';
import type { ResolvedAppAccess } from '../src/server/services/EcosystemAccessResolver.js';

const db = requireInvitationEmulator();
const NOW = Date.UTC(2026, 8, 20, 12, 0, 0);

function granted(
  overrides: Partial<ResolvedAppAccess> = {}
): ResolvedAppAccess {
  return {
    appId: 'nestjourney',
    organizationId: 'org-1',
    accessible: true,
    isGlobalAccess: false,
    accessSource: 'organization_membership',
    organizationRole: 'member',
    roles: ['member'],
    permissions: [],
    decisionState: 'granted',
    ...overrides
  };
}

function request(
  actor: string | undefined,
  organizationId = 'org-1'
): any {
  return {
    headers: actor ? { authorization: `Bearer ${actor}` } : {},
    query: { organizationId }
  };
}

function response() {
  const state: any = {
    statusCode: 200,
    body: null,
    headers: {}
  };
  state.status = (code: number) => {
    state.statusCode = code;
    return state;
  };
  state.json = (body: unknown) => {
    state.body = body;
    return state;
  };
  state.setHeader = (key: string, value: string) => {
    state.headers[key] = value;
    return state;
  };
  return state;
}

async function seedMember(
  uid: string,
  input: {
    journeyRole?: string;
    role?: string;
    status?: string;
    congregationIds?: string[];
    permissions?: Record<string, boolean>;
  } = {}
) {
  await db.doc(`organizations/org-1/members/${uid}`).set({
    uid,
    organizationId: 'org-1',
    role: input.role ?? 'member',
    organizationRole: input.role ?? 'member',
    status: input.status ?? 'active',
    congregationIds: input.congregationIds ?? ['unit-a'],
    journeyRole: input.journeyRole ?? 'member',
    permissions: input.permissions ?? {}
  });
}

async function seedFollowup(
  id: string,
  input: Record<string, unknown>
) {
  await db.doc(
    `organizations/org-1/products/raiz_e_mesa/followups/${id}`
  ).set({
    organizationId: 'org-1',
    congregationId: 'unit-a',
    personId: 'person-secret',
    careRequestId: 'care-secret',
    kind: 'first_contact',
    status: 'pending',
    ownerRef: 'caregiver-1',
    dueAt: new Date(NOW + 3_600_000).toISOString(),
    privateNote: 'must never leave NestJourney',
    ...input
  });
}

async function seedCareRequest(
  id: string,
  input: Record<string, unknown>
) {
  await db.doc(
    `organizations/org-1/products/raiz_e_mesa/careRequests/${id}`
  ).set({
    organizationId: 'org-1',
    congregationId: 'unit-a',
    personId: 'person-secret',
    careType: 'first_contact',
    status: 'open',
    ownerRef: '',
    dueAt: new Date(NOW + 3_600_000).toISOString(),
    summary: 'must never leave NestJourney',
    ...input
  });
}

async function call(
  actor: string | undefined,
  access: ResolvedAppAccess
) {
  const res = response();
  await handleNestJourneyWorkspaceProjectionRequest(
    request(actor),
    res,
    {
      verifyIdToken: async (token: string) => {
        if (token === 'invalid') throw new Error('invalid');
        return { uid: token };
      },
      getDb: () => db,
      resolveAccess: async () => access,
      now: () => NOW,
      logger: console
    }
  );
  return res;
}

await clearInvitationEmulator();

let res = response();
await handleNestJourneyWorkspaceProjectionRequest(
  request(undefined),
  res,
  {
    verifyIdToken: async () => ({ uid: 'unused' }),
    getDb: () => db,
    resolveAccess: async () => granted(),
    now: () => NOW,
    logger: console
  }
);
assert.equal(res.statusCode, 401);

await clearInvitationEmulator();
res = await call('global-1', granted({
  isGlobalAccess: true,
  accessSource: 'global_system_role',
  organizationRole: undefined,
  roles: ['ceo'],
  permissions: ['*']
}));
assert.equal(res.statusCode, 200);
assert.equal(res.body.projection.accessible, true);
assert.equal(res.body.projection.isGlobalAccess, true);
assert.equal(res.body.projection.canReadJourneyOperational, false);
assert.equal(res.body.projection.assignedFirstContacts.count, 0);
assert.equal(res.body.projection.unassignedFirstContacts.count, 0);
assert.equal(
  res.body.projection.assignedFirstContacts.evidence.length,
  0,
  'global-only governance must not manufacture zero-count ministry evidence'
);
assert.equal(
  res.body.projection.unassignedFirstContacts.evidence.length,
  0
);
assert.equal(
  res.body.projection.assignedFirstContacts.complete,
  false
);
assert.equal(
  res.body.projection.unassignedFirstContacts.complete,
  false
);

await clearInvitationEmulator();
await seedMember('caregiver-1', {
  journeyRole: 'caregiver',
  congregationIds: ['unit-a'],
  permissions: {
    canManageCare: true,
    canManagePeople: true
  }
});
await seedFollowup('owned-overdue', {
  dueAt: new Date(NOW - 60_000).toISOString()
});
await seedFollowup('owned-upcoming', {
  dueAt: new Date(NOW + 3_600_000).toISOString()
});
await seedFollowup('completed', {
  status: 'completed',
  dueAt: new Date(NOW - 60_000).toISOString()
});
await seedFollowup('other-owner', {
  ownerRef: 'someone-else'
});
await seedFollowup('other-campus', {
  congregationId: 'unit-b',
  dueAt: new Date(NOW - 60_000).toISOString()
});
await seedCareRequest('unassigned-not-supervised', {
  dueAt: new Date(NOW - 60_000).toISOString()
});

res = await call('caregiver-1', granted());
assert.equal(res.statusCode, 200);
assert.equal(res.body.projection.canReadJourneyOperational, true);
assert.equal(res.body.projection.responsibility, 'caregiver');
assert.equal(res.body.projection.assignedFirstContacts.count, 2);
assert.equal(res.body.projection.assignedFirstContacts.overdueCount, 1);
assert.equal(res.body.projection.assignedFirstContacts.dueSoonCount, 1);
assert.equal(res.body.projection.unassignedFirstContacts.count, 0);
assert.equal(
  res.body.projection.unassignedFirstContacts.evidence.length,
  0,
  'caregiver without supervisory scope must see unavailable queue, not a proven zero'
);
assert.equal(res.body.projection.assignedFirstContacts.evidence.length, 1);
assert.equal(
  res.body.projection.assignedFirstContacts.complete,
  true
);
assert.equal(
  res.body.projection.unassignedFirstContacts.complete,
  false
);
assert.equal(
  res.body.projection.assignedFirstContacts.evidence[0].sourceApp,
  'nestjourney'
);
const serializedCaregiver = JSON.stringify(res.body);
for (const forbidden of [
  'person-secret',
  'care-secret',
  'privateNote',
  'must never leave NestJourney'
]) {
  assert.equal(
    serializedCaregiver.includes(forbidden),
    false,
    `Hub projection must not leak ${forbidden}`
  );
}

await clearInvitationEmulator();
await seedMember('coordinator-1', {
  journeyRole: 'coordinator',
  congregationIds: ['unit-a'],
  permissions: {
    canManageCare: true,
    canManagePeople: true,
    canCoordinateJourney: true
  }
});
await seedCareRequest('unassigned-overdue', {
  dueAt: new Date(NOW - 120_000).toISOString()
});
await seedCareRequest('unassigned-upcoming', {
  dueAt: new Date(NOW + 2 * 3_600_000).toISOString()
});
await seedCareRequest('already-owned', {
  ownerRef: 'caregiver-1'
});
await seedCareRequest('other-campus', {
  congregationId: 'unit-b',
  dueAt: new Date(NOW - 60_000).toISOString()
});
await seedCareRequest('wrong-care-type', {
  careType: 'pastoral_request'
});

res = await call('coordinator-1', granted());
assert.equal(res.statusCode, 200);
assert.equal(res.body.projection.unassignedFirstContacts.count, 2);
assert.equal(res.body.projection.unassignedFirstContacts.overdueCount, 1);
assert.equal(res.body.projection.unassignedFirstContacts.dueSoonCount, 1);
assert.equal(
  res.body.projection.unassignedFirstContacts.evidence[0].entityId,
  'unassigned:first_contact'
);
assert.equal(
  res.body.projection.unassignedFirstContacts.complete,
  true
);

await clearInvitationEmulator();
await seedMember('coordinator-empty', {
  journeyRole: 'coordinator',
  congregationIds: ['unit-a'],
  permissions: {
    canManageCare: true,
    canManagePeople: true,
    canCoordinateJourney: true
  }
});
res = await call('coordinator-empty', granted());
assert.equal(res.statusCode, 200);
assert.equal(
  res.body.projection.assignedFirstContacts.count,
  0
);
assert.equal(
  res.body.projection.assignedFirstContacts.evidence.length,
  1,
  'an authorized empty assigned queue must retain evidence proving zero'
);
assert.equal(
  res.body.projection.unassignedFirstContacts.count,
  0
);
assert.equal(
  res.body.projection.unassignedFirstContacts.evidence.length,
  1,
  'an authorized empty supervisory queue must retain evidence proving zero'
);
assert.equal(
  res.body.projection.assignedFirstContacts.complete,
  true
);
assert.equal(
  res.body.projection.unassignedFirstContacts.complete,
  true
);

await clearInvitationEmulator();
await seedMember('ordinary-1', {
  journeyRole: 'member',
  permissions: {}
});
res = await call('ordinary-1', granted());
assert.equal(res.statusCode, 200);
assert.equal(res.body.projection.accessible, true);
assert.equal(res.body.projection.canReadJourneyOperational, false);
assert.equal(res.body.projection.assignedFirstContacts.count, 0);

await clearInvitationEmulator();
res = await call('denied-1', granted({
  accessible: false,
  accessSource: 'denied',
  decisionState: 'denied',
  denialReason: 'ENTITLEMENT_INACTIVE'
}));
assert.equal(res.statusCode, 200);
assert.equal(res.body.projection.accessible, false);
assert.equal(res.body.projection.canReadJourneyOperational, false);

console.log('NestJourney workspace projection privacy and scope checks passed.');
