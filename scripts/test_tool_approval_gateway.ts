import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  requestToolApproval,
  decideToolApproval,
  getToolApproval
} from '../src/server/services/ToolApprovalCommandService.js';
import {
  validateToolApprovalForExecution,
  DEFAULT_TOOL_APPROVAL_TTL_MS
} from '../src/lib/toolApproval.js';

class FakeResponse {
  statusCode = 200;
  body: any = null;
  headers = new Map<string, string>();

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(body: unknown) {
    this.body = body;
    return this;
  }

  setHeader(name: string, value: string) {
    this.headers.set(name, value);
  }
}

class FakeDocumentReference {
  constructor(
    private readonly path: string,
    private readonly store: Map<string, any>
  ) {}

  async get() {
    const data = this.store.get(this.path);
    return {
      exists: data !== undefined,
      data: () => data
    };
  }

  async set(
    data: any,
    options?: { merge?: boolean }
  ) {
    if (
      options?.merge &&
      this.store.has(this.path)
    ) {
      this.store.set(this.path, {
        ...this.store.get(this.path),
        ...data
      });
      return;
    }

    this.store.set(this.path, data);
  }
}

class FakeFirestore {
  constructor(
    readonly store = new Map<string, any>()
  ) {}

  doc(path: string) {
    return new FakeDocumentReference(
      path,
      this.store
    );
  }
}

const store = new Map<string, any>([
  [
    'users/ceo-1',
    {
      systemRole: 'ceo',
      status: 'active'
    }
  ],
  [
    'users/member-1',
    {
      systemRole: 'user',
      status: 'active'
    }
  ],
  [
    'users/admin-1',
    {
      systemRole: 'user',
      status: 'active'
    }
  ],
  [
    'organizations/org-1',
    {
      status: 'active',
      enabledApps: []
    }
  ],
  [
    'organizations/org-2',
    {
      status: 'active',
      enabledApps: ['connect']
    }
  ],
  [
    'organizations/org-2/members/member-1',
    {
      status: 'active',
      role: 'member',
      permissions: []
    }
  ],
  [
    'organizations/org-2/members/admin-1',
    {
      status: 'active',
      role: 'admin',
      permissions: []
    }
  ]
]);

const db = new FakeFirestore(store);

const makeRequest = (
  actorUid: string,
  organizationId: string,
  body: any,
  approvalId?: string
) =>
  ({
    headers: {
      authorization: 'Bearer token'
    },
    params: {
      organizationId,
      ...(approvalId
        ? { approvalId }
        : {})
    },
    body
  }) as any;

const deps = (
  actorUid: string,
  nowMs = 10_000
) => ({
  verifyIdToken: async () => ({
    uid: actorUid
  }),
  getFirestore: () => db as any,
  now: () => nowMs
});

const connectRequest = {
  toolId: 'connect.message.send',
  idempotencyKey: 'message-approval-1',
  input: {
    channel: 'whatsapp',
    recipientRef: 'person-1',
    templateId: 'follow-up-1',
    locale: 'pt-BR'
  },
  source: {
    dedupeKey: 'journey:follow-up:person-1',
    fingerprint: 'source-fingerprint-1',
    signalType: 'follow_up_due'
  }
};

const createResponse = new FakeResponse();
await requestToolApproval(
  makeRequest(
    'ceo-1',
    'org-1',
    connectRequest
  ),
  createResponse as any,
  deps('ceo-1') as any
);

assert.equal(createResponse.statusCode, 201);
assert.equal(createResponse.body.success, true);
assert.equal(
  createResponse.body.approval.status,
  'pending'
);
assert.equal(
  createResponse.body.approval.toolId,
  'connect.message.send'
);
assert.equal(
  createResponse.body.approval.executionReady,
  false,
  'approval foundation must not activate the pending Connect adapter'
);
assert.equal(
  createResponse.body.approval.executionState,
  'adapter_pending'
);
assert.equal(
  createResponse.body.approval.expiresAtMs -
    createResponse.body.approval.requestedAtMs,
  DEFAULT_TOOL_APPROVAL_TTL_MS
);

const approvalId =
  createResponse.body.approval.approvalId;
const approvalPath =
  `organizations/org-1/toolApprovals/${approvalId}`;

assert.ok(
  store.has(approvalPath),
  'approval must be persisted inside the organization boundary'
);
assert.equal(
  store.get(approvalPath).requesterUid,
  'ceo-1'
);
assert.equal(
  store.get(approvalPath).requesterAccessSource,
  'global_system_role'
);

const readResponse = new FakeResponse();
await getToolApproval(
  makeRequest(
    'ceo-1',
    'org-1',
    {},
    approvalId
  ),
  readResponse as any,
  deps('ceo-1') as any
);
assert.equal(readResponse.statusCode, 200);
assert.equal(
  readResponse.body.approval.approvalId,
  approvalId
);

const retryResponse = new FakeResponse();
await requestToolApproval(
  makeRequest(
    'ceo-1',
    'org-1',
    connectRequest
  ),
  retryResponse as any,
  deps('ceo-1') as any
);
assert.equal(retryResponse.statusCode, 200);
assert.equal(
  retryResponse.body.fromCache,
  true,
  'same idempotency key and request fingerprint must reuse the approval'
);

const conflictResponse =
  new FakeResponse();
await requestToolApproval(
  makeRequest(
    'ceo-1',
    'org-1',
    {
      ...connectRequest,
      input: {
        ...connectRequest.input,
        templateId: 'different-template'
      }
    }
  ),
  conflictResponse as any,
  deps('ceo-1') as any
);
assert.equal(conflictResponse.statusCode, 409);
assert.equal(
  conflictResponse.body.reasonCode,
  'TOOL_APPROVAL_IDEMPOTENCY_CONFLICT'
);

const approveResponse = new FakeResponse();
await decideToolApproval(
  makeRequest(
    'ceo-1',
    'org-1',
    {
      decision: 'approved',
      note: 'Mensagem revisada.'
    },
    approvalId
  ),
  approveResponse as any,
  deps('ceo-1', 20_000) as any
);

assert.equal(approveResponse.statusCode, 200);
assert.equal(
  approveResponse.body.approval.status,
  'approved'
);
assert.equal(
  approveResponse.body.approval.approverUid,
  'ceo-1'
);
assert.equal(
  store.get(approvalPath).approverAccessSource,
  'global_system_role'
);

const exactApprovalDecision =
  validateToolApprovalForExecution({
    approval:
      approveResponse.body.approval,
    organizationId: 'org-1',
    toolId: 'connect.message.send',
    requestFingerprint:
      approveResponse.body.approval
        .requestFingerprint,
    nowMs: 21_000
  });

assert.deepEqual(
  exactApprovalDecision,
  { allowed: true },
  'one approval must authorize only its exact request while valid'
);

assert.equal(
  validateToolApprovalForExecution({
    approval:
      approveResponse.body.approval,
    organizationId: 'org-2',
    toolId: 'connect.message.send',
    requestFingerprint:
      approveResponse.body.approval
        .requestFingerprint,
    nowMs: 21_000
  }).allowed,
  false,
  'approval must never cross tenant boundaries'
);

assert.equal(
  validateToolApprovalForExecution({
    approval:
      approveResponse.body.approval,
    organizationId: 'org-1',
    toolId: 'connect.message.send',
    requestFingerprint: 'different',
    nowMs: 21_000
  }).allowed,
  false,
  'approval must be bound to the exact payload fingerprint'
);

assert.equal(
  validateToolApprovalForExecution({
    approval:
      approveResponse.body.approval,
    organizationId: 'org-1',
    toolId: 'connect.message.send',
    requestFingerprint:
      approveResponse.body.approval
        .requestFingerprint,
    nowMs:
      approveResponse.body.approval
        .expiresAtMs + 1
  }).allowed,
  false,
  'stale approval must not authorize future execution'
);

const replayDecision =
  new FakeResponse();
await decideToolApproval(
  makeRequest(
    'ceo-1',
    'org-1',
    { decision: 'approved' },
    approvalId
  ),
  replayDecision as any,
  deps('ceo-1', 22_000) as any
);
assert.equal(replayDecision.statusCode, 200);
assert.equal(
  replayDecision.body.fromCache,
  true,
  'same final decision must be idempotent'
);

const memberDenied =
  new FakeResponse();
await requestToolApproval(
  makeRequest(
    'member-1',
    'org-2',
    {
      ...connectRequest,
      idempotencyKey: 'member-attempt'
    }
  ),
  memberDenied as any,
  deps('member-1') as any
);
assert.equal(memberDenied.statusCode, 403);
assert.equal(
  memberDenied.body.reasonCode,
  'CONNECT_APPROVAL_REQUEST_AUTHORITY_REQUIRED'
);

const adminCreate =
  new FakeResponse();
await requestToolApproval(
  makeRequest(
    'admin-1',
    'org-2',
    {
      ...connectRequest,
      idempotencyKey: 'admin-message-1'
    }
  ),
  adminCreate as any,
  deps('admin-1', 30_000) as any
);
assert.equal(adminCreate.statusCode, 201);
assert.equal(
  store.get(
    `organizations/org-2/toolApprovals/${adminCreate.body.approval.approvalId}`
  ).requesterAccessSource,
  'organization_membership'
);

const adminApprove =
  new FakeResponse();
await decideToolApproval(
  makeRequest(
    'admin-1',
    'org-2',
    { decision: 'approved' },
    adminCreate.body.approval.approvalId
  ),
  adminApprove as any,
  deps('admin-1', 31_000) as any
);
assert.equal(adminApprove.statusCode, 200);
assert.equal(
  adminApprove.body.approval.status,
  'approved'
);

const expiringCreate =
  new FakeResponse();
await requestToolApproval(
  makeRequest(
    'ceo-1',
    'org-1',
    {
      ...connectRequest,
      idempotencyKey: 'expiring-message'
    }
  ),
  expiringCreate as any,
  deps('ceo-1', 100_000) as any
);
assert.equal(expiringCreate.statusCode, 201);

const expiredDecision =
  new FakeResponse();
await decideToolApproval(
  makeRequest(
    'ceo-1',
    'org-1',
    { decision: 'approved' },
    expiringCreate.body.approval
      .approvalId
  ),
  expiredDecision as any,
  deps(
    'ceo-1',
    100_000 +
      DEFAULT_TOOL_APPROVAL_TTL_MS +
      1
  ) as any
);
assert.equal(expiredDecision.statusCode, 409);
assert.equal(
  expiredDecision.body.reasonCode,
  'TOOL_APPROVAL_EXPIRED'
);

const noApprovalNeeded =
  new FakeResponse();
await requestToolApproval(
  makeRequest(
    'ceo-1',
    'org-1',
    {
      toolId: 'musicscale.scale.review',
      idempotencyKey: 'review-1',
      input: {
        scaleId: 'scale-1'
      }
    }
  ),
  noApprovalNeeded as any,
  deps('ceo-1') as any
);
assert.equal(noApprovalNeeded.statusCode, 409);
assert.equal(
  noApprovalNeeded.body.reasonCode,
  'TOOL_APPROVAL_NOT_REQUIRED'
);

const unfinishedFinance =
  new FakeResponse();
await requestToolApproval(
  makeRequest(
    'ceo-1',
    'org-1',
    {
      toolId:
        'nestfinance.payment.mutate',
      idempotencyKey: 'finance-1',
      input: {
        paymentId: 'payment-1',
        operation: 'reverse'
      }
    }
  ),
  unfinishedFinance as any,
  deps('ceo-1') as any
);
assert.equal(unfinishedFinance.statusCode, 409);
assert.equal(
  unfinishedFinance.body.reasonCode,
  'TOOL_UNAVAILABLE',
  'unfinished NestFinance must remain fail-closed even for approval requests'
);

const serverSource = readFileSync(
  'server.ts',
  'utf8'
);
const gatewaySource = readFileSync(
  'src/server/services/ToolGatewayService.ts',
  'utf8'
);
const rulesSource = readFileSync(
  'firestore.rules',
  'utf8'
);

assert.match(
  serverSource,
  /tool-approvals\/request/
);
assert.match(
  serverSource,
  /tool-approvals\/:approvalId\/decision/
);
assert.match(
  gatewaySource,
  /createToolRequestFingerprint/,
  'execution and approval must share one canonical request fingerprint'
);
assert.equal(
  rulesSource.includes(
    'match /toolApprovals/'
  ),
  false,
  'approval records must remain backend-only under default-deny Firestore rules'
);

console.log(
  'Tool approval lifecycle, tenant, authority, expiry and idempotency checks passed.'
);
