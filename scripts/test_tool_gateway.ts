import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ECOSYSTEM_TOOL_REGISTRY,
  planToolAction,
  toolNeedsHumanApproval
} from '../src/lib/toolGateway.js';
import {
  buildActionToolRequest,
  parseToolNavigationResult
} from '../src/lib/actionToolGatewayBridge.js';
import {
  executeToolAction
} from '../src/server/services/ToolGatewayService.js';
import type { ReadOnlyHubAction } from '../src/lib/actionCenter.js';

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

  async set(data: unknown) {
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

const managedAction: ReadOnlyHubAction = {
  id: 'pending:scale-1',
  dedupeKey: 'pending:scale-1',
  fingerprint: 'fingerprint-1',
  sourceApp: 'musicscale',
  signalType: 'musicscale_pending_responses',
  priority: 'high',
  titleKey: 'title',
  descriptionKey: 'description',
  destination: {
    kind: 'app',
    appId: 'musicscale',
    path: '/scales/scale-1'
  }
};

const request = buildActionToolRequest(
  managedAction
);

assert.ok(request);
assert.equal(
  request?.toolId,
  'musicscale.scale.review'
);
assert.equal(
  request?.input.scaleId,
  'scale-1'
);

assert.equal(
  buildActionToolRequest({
    ...managedAction,
    signalType:
      'musicscale_personal_confirmation'
  }),
  null,
  'personal confirmation must keep its normal direct-open flow'
);

assert.equal(
  buildActionToolRequest({
    ...managedAction,
    destination: {
      kind: 'app',
      appId: 'musicscale',
      path: '/songs'
    }
  }),
  null,
  'only a concrete scale deep link may become a review tool request'
);

assert.deepEqual(
  parseToolNavigationResult({
    result: {
      code: 'NAVIGATION_READY',
      destination: {
        appId: 'musicscale',
        path: '/scales/scale-1'
      }
    }
  }),
  {
    appId: 'musicscale',
    path: '/scales/scale-1'
  }
);

assert.equal(
  ECOSYSTEM_TOOL_REGISTRY[
    'musicscale.scale.review'
  ].risk,
  'low'
);
assert.equal(
  planToolAction(
    ECOSYSTEM_TOOL_REGISTRY[
      'musicscale.scale.review'
    ]
  ).decision,
  'execute_now'
);

assert.equal(
  toolNeedsHumanApproval(
    'connect.message.send'
  ),
  true,
  'outbound messaging must require human approval'
);
assert.equal(
  ECOSYSTEM_TOOL_REGISTRY[
    'connect.message.send'
  ].availability,
  'adapter_pending',
  'Connect send must fail closed until a real adapter exists'
);

assert.equal(
  toolNeedsHumanApproval(
    'nestfinance.payment.mutate'
  ),
  true,
  'financial mutation must require human approval'
);
assert.equal(
  ECOSYSTEM_TOOL_REGISTRY[
    'nestfinance.payment.mutate'
  ].availability,
  'product_not_operational',
  'unfinished NestFinance cannot expose a live mutation tool'
);

const store = new Map<string, any>([
  [
    'scales/scale-1',
    {
      organizationId: 'org-1',
      status: 'published'
    }
  ],
  [
    'scales/other-scale',
    {
      organizationId: 'org-2',
      status: 'published'
    }
  ]
]);
const db = new FakeFirestore(store);

const grantedAccess = {
  appId: 'musicscale' as const,
  organizationId: 'org-1',
  accessible: true,
  isGlobalAccess: false,
  accessSource:
    'organization_membership' as const,
  organizationRole: 'leader',
  roles: ['leader'],
  permissions: [
    'scaleResponses.readManaged'
  ],
  decisionState: 'granted' as const
};

const deps = {
  verifyIdToken: async () => ({
    uid: 'leader-1'
  }),
  getFirestore: () => db as any,
  resolveAccess: async () =>
    grantedAccess,
  now: () => 123456
};

const makeRequest = (
  body: any
) =>
  ({
    headers: {
      authorization: 'Bearer token'
    },
    params: {
      organizationId: 'org-1'
    },
    body
  }) as any;

const firstResponse =
  new FakeResponse();

await executeToolAction(
  makeRequest(request),
  firstResponse as any,
  deps as any
);

assert.equal(firstResponse.statusCode, 200);
assert.equal(
  firstResponse.body.success,
  true
);
assert.equal(
  firstResponse.body.fromCache,
  false
);
assert.equal(
  firstResponse.body.result.destination.path,
  '/scales/scale-1'
);

const toolActionEntries =
  [...store.entries()].filter(
    ([path]) =>
      path.startsWith(
        'organizations/org-1/toolActions/'
      )
  );

assert.equal(
  toolActionEntries.length,
  1,
  'one audit/action receipt must be persisted'
);
assert.equal(
  toolActionEntries[0][1].actorUid,
  'leader-1'
);
assert.equal(
  toolActionEntries[0][1].organizationId,
  'org-1'
);
assert.equal(
  toolActionEntries[0][1].toolId,
  'musicscale.scale.review'
);
assert.equal(
  toolActionEntries[0][1].source.signalType,
  'musicscale_pending_responses'
);

const cachedResponse =
  new FakeResponse();

await executeToolAction(
  makeRequest(request),
  cachedResponse as any,
  deps as any
);

assert.equal(cachedResponse.statusCode, 200);
assert.equal(
  cachedResponse.body.fromCache,
  true,
  'same idempotency key and fingerprint must reuse the result'
);
assert.equal(
  [...store.keys()].filter(path =>
    path.startsWith(
      'organizations/org-1/toolActions/'
    )
  ).length,
  1,
  'retry must not duplicate the action receipt'
);

const conflictResponse =
  new FakeResponse();

await executeToolAction(
  makeRequest({
    ...request,
    source: {
      ...request!.source,
      fingerprint: 'different'
    }
  }),
  conflictResponse as any,
  deps as any
);

assert.equal(conflictResponse.statusCode, 409);
assert.equal(
  conflictResponse.body.reasonCode,
  'TOOL_IDEMPOTENCY_CONFLICT'
);

const tenantResponse =
  new FakeResponse();

await executeToolAction(
  makeRequest({
    ...request,
    idempotencyKey:
      'different-idempotency',
    input: {
      scaleId: 'other-scale'
    }
  }),
  tenantResponse as any,
  deps as any
);

assert.equal(tenantResponse.statusCode, 403);
assert.equal(
  tenantResponse.body.reasonCode,
  'TOOL_TARGET_TENANT_MISMATCH'
);

const globalResponse =
  new FakeResponse();

await executeToolAction(
  makeRequest({
    ...request,
    idempotencyKey:
      'global-idempotency'
  }),
  globalResponse as any,
  {
    ...deps,
    resolveAccess: async () => ({
      ...grantedAccess,
      isGlobalAccess: true,
      accessSource:
        'global_system_role' as const,
      organizationRole: undefined,
      roles: ['ceo'],
      permissions: ['*']
    })
  } as any
);

assert.equal(globalResponse.statusCode, 403);
assert.equal(
  globalResponse.body.reasonCode,
  'WORSHIP_TOOL_AUTHORITY_REQUIRED',
  'global governance alone must not become Worship operational authority'
);

const sensitiveResponse =
  new FakeResponse();

await executeToolAction(
  makeRequest({
    toolId: 'connect.message.send',
    idempotencyKey: 'message-1',
    input: {
      channel: 'whatsapp',
      recipientRef: 'person-1',
      templateId: 'template-1',
      locale: 'pt-BR'
    }
  }),
  sensitiveResponse as any,
  deps as any
);

assert.equal(sensitiveResponse.statusCode, 409);
assert.equal(
  sensitiveResponse.body.reasonCode,
  'TOOL_UNAVAILABLE'
);
assert.equal(
  sensitiveResponse.body.approvalPolicy,
  'human_required'
);

const serverSource = readFileSync(
  'server.ts',
  'utf8'
);
const gatewaySource = readFileSync(
  'src/server/services/ToolGatewayService.ts',
  'utf8'
);
const dashboardSource = readFileSync(
  'src/pages/Dashboard.tsx',
  'utf8'
);
const homeSource = readFileSync(
  'src/components/dashboard/EcosystemWorkspaceHome.tsx',
  'utf8'
);
const firestoreRules = readFileSync(
  'firestore.rules',
  'utf8'
);

assert.match(
  serverSource,
  /tool-gateway\/catalog/
);
assert.match(
  serverSource,
  /tool-actions\/execute/
);
assert.match(
  gatewaySource,
  /TOOL_TARGET_TENANT_MISMATCH/
);
assert.match(
  gatewaySource,
  /requestFingerprint/
);
assert.match(
  gatewaySource,
  /FieldValue\.serverTimestamp\(\)/
);
assert.match(
  dashboardSource,
  /buildActionToolRequest/
);
assert.match(
  dashboardSource,
  /tool-actions\/execute/
);
assert.match(
  homeSource,
  /onExecuteActionTool/
);
assert.equal(
  firestoreRules.includes(
    'match /toolActions/'
  ),
  false,
  'tool action receipts remain backend-only under the default-deny Firestore rules'
);
assert.equal(
  /openai|gemini|llm\s*\./i.test(
    gatewaySource
  ),
  false,
  'Tool Gateway v1 must not invoke a model'
);

console.log(
  'Tool Gateway safety, idempotency, tenant and approval checks passed.'
);
