import admin from 'firebase-admin';
import express from 'express';
import {
  resolveEcosystemAppAccess
} from './EcosystemAccessResolver.js';
import {
  capabilitiesFromMembership
} from './NestJourneyWorkspaceProjectionService.js';

export interface NestJourneyFollowupContextDependencies {
  verifyIdToken: (
    token: string
  ) => Promise<admin.auth.DecodedIdToken>;
  getDb: () =>
    admin.firestore.Firestore | null;
  resolveAccess?: typeof resolveEcosystemAppAccess;
  logger?: {
    info?: (
      message: string,
      meta?: Record<string, unknown>
    ) => void;
    warn?: (
      message: string,
      meta?: Record<string, unknown>
    ) => void;
    error?: (
      message: string,
      meta?: Record<string, unknown>
    ) => void;
  };
}

export interface NestJourneyFollowupConnectContext {
  success: true;
  organization: {
    id: string;
    name: string;
  };
  followup: {
    id: string;
    careRequestId: string;
    congregationId: string;
    dueAt: string | null;
  };
  person: {
    name: string;
    phone: string;
  };
  returnTo: string;
}

export class NestJourneyFollowupContextError
  extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code);
  }
}

const BROAD_ORGANIZATION_ROLES =
  new Set([
    'owner',
    'admin',
    'pastor',
    'data_admin'
  ]);
const INACTIVE_MEMBERSHIP_STATUSES =
  new Set([
    'suspended',
    'inactive',
    'removed',
    'revoked',
    'deleted',
    'archived',
    'disabled'
  ]);
const SAFE_ID =
  /^[A-Za-z0-9._:-]{1,220}$/;

function clean(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

function normalize(value: unknown): string {
  return clean(value).toLowerCase();
}

function validId(
  value: unknown
): string | null {
  const candidate = clean(value);
  return SAFE_ID.test(candidate)
    ? candidate
    : null;
}

function stringList(
  value: unknown
): string[] {
  return Array.isArray(value)
    ? value
        .filter(
          (item): item is string =>
            typeof item === 'string' &&
            Boolean(item.trim())
        )
        .map(item => item.trim())
    : [];
}

function activeMembership(
  value:
    | FirebaseFirestore.DocumentData
    | undefined
): boolean {
  if (!value) return false;
  return !INACTIVE_MEMBERSHIP_STATUSES.has(
    normalize(value.status)
  );
}

function toIso(
  value: unknown
): string | null {
  if (
    value instanceof
    admin.firestore.Timestamp
  ) {
    return value.toDate().toISOString();
  }
  if (
    typeof value === 'string' &&
    !Number.isNaN(Date.parse(value))
  ) {
    return new Date(value).toISOString();
  }
  return null;
}

function maskUid(uid: string): string {
  return uid.length > 6
    ? `${uid.slice(0, 3)}***${uid.slice(-3)}`
    : '***';
}

function noStore(
  res: express.Response
) {
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

export async function resolveNestJourneyFollowupConnectContext(
  input: {
    uid: string;
    organizationId: string;
    followupId: string;
  },
  dependencies: {
    db: admin.firestore.Firestore;
    resolveAccess?: typeof resolveEcosystemAppAccess;
    logger?: NestJourneyFollowupContextDependencies['logger'];
  }
): Promise<NestJourneyFollowupConnectContext> {
  const uid = validId(input.uid);
  const organizationId =
    validId(input.organizationId);
  const followupId =
    validId(input.followupId);

  if (
    !uid ||
    !organizationId ||
    !followupId
  ) {
    throw new NestJourneyFollowupContextError(
      400,
      'INVALID_REQUEST'
    );
  }

  const db = dependencies.db;
  const resolveAccess =
    dependencies.resolveAccess ??
    resolveEcosystemAppAccess;

  let appAccess;
  try {
    appAccess = await resolveAccess({
      uid,
      organizationId,
      appId: 'nestjourney',
      db
    });
  } catch {
    throw new NestJourneyFollowupContextError(
      503,
      'ACCESS_UNAVAILABLE'
    );
  }

  if (!appAccess.accessible) {
    throw new NestJourneyFollowupContextError(
      403,
      'NESTJOURNEY_ACCESS_DENIED'
    );
  }

  if (appAccess.isGlobalAccess === true) {
    throw new NestJourneyFollowupContextError(
      403,
      'NESTJOURNEY_OPERATIONAL_AUTHORITY_REQUIRED'
    );
  }

  const [
    orgDoc,
    memberDoc,
    followupDoc
  ] = await Promise.all([
    db.doc(
      `organizations/${organizationId}`
    ).get(),
    db.doc(
      `organizations/${organizationId}/members/${uid}`
    ).get(),
    db.doc(
      `organizations/${organizationId}/products/raiz_e_mesa/followups/${followupId}`
    ).get()
  ]);

  if (
    !orgDoc.exists ||
    !followupDoc.exists
  ) {
    throw new NestJourneyFollowupContextError(
      404,
      'FOLLOWUP_NOT_FOUND'
    );
  }

  const organization =
    orgDoc.data() ?? {};
  const membership =
    memberDoc.exists
      ? memberDoc.data() ?? {}
      : undefined;

  if (!activeMembership(membership)) {
    throw new NestJourneyFollowupContextError(
      403,
      'NESTJOURNEY_OPERATIONAL_AUTHORITY_REQUIRED'
    );
  }

  const capabilities =
    capabilitiesFromMembership(
      membership
    );

  if (
    capabilities.canManageCare !== true
  ) {
    throw new NestJourneyFollowupContextError(
      403,
      'CARE_CAPABILITY_REQUIRED'
    );
  }

  const followup =
    followupDoc.data() ?? {};
  const organizationRole = normalize(
    membership?.organizationRole ??
    membership?.role ??
    appAccess.organizationRole
  );
  const broad =
    BROAD_ORGANIZATION_ROLES.has(
      organizationRole
    );
  const congregationIds =
    stringList(
      membership?.congregationIds
    );
  const congregationId =
    clean(followup.congregationId);

  if (
    clean(followup.organizationId) !==
      organizationId ||
    clean(followup.kind) !==
      'first_contact' ||
    clean(followup.status) !==
      'pending' ||
    !congregationId
  ) {
    throw new NestJourneyFollowupContextError(
      409,
      'FOLLOWUP_NOT_ACTIONABLE'
    );
  }

  if (
    !broad &&
    !congregationIds.includes(
      congregationId
    )
  ) {
    throw new NestJourneyFollowupContextError(
      403,
      'FOLLOWUP_SCOPE_DENIED'
    );
  }

  // Oversight may read aggregate/queue state,
  // but communication preparation is owner-only.
  if (
    clean(followup.ownerRef) !== uid
  ) {
    throw new NestJourneyFollowupContextError(
      403,
      'FOLLOWUP_OWNER_REQUIRED'
    );
  }

  const careRequestId =
    validId(followup.careRequestId);
  const personId =
    validId(followup.personId);

  if (!careRequestId || !personId) {
    throw new NestJourneyFollowupContextError(
      409,
      'FOLLOWUP_SOURCE_INVALID'
    );
  }

  const [careDoc, personDoc] =
    await Promise.all([
      db.doc(
        `organizations/${organizationId}/products/raiz_e_mesa/careRequests/${careRequestId}`
      ).get(),
      db.doc(
        `organizations/${organizationId}/products/raiz_e_mesa/people/${personId}`
      ).get()
    ]);

  if (
    !careDoc.exists ||
    !personDoc.exists
  ) {
    throw new NestJourneyFollowupContextError(
      409,
      'FOLLOWUP_SOURCE_INVALID'
    );
  }

  const care =
    careDoc.data() ?? {};
  const person =
    personDoc.data() ?? {};
  const phone = clean(person.phone);
  const personName =
    clean(person.name);

  if (
    clean(care.organizationId) !==
      organizationId ||
    clean(care.congregationId) !==
      congregationId ||
    clean(care.personId) !==
      personId ||
    clean(care.careType) !==
      'first_contact' ||
    clean(care.status) !== 'open' ||
    clean(care.ownerRef) !==
      clean(followup.ownerRef) ||
    clean(person.organizationId) !==
      organizationId ||
    clean(person.congregationId) !==
      congregationId ||
    person.consent !== true ||
    !phone ||
    !personName
  ) {
    throw new NestJourneyFollowupContextError(
      409,
      'FOLLOWUP_SOURCE_INVALID'
    );
  }

  dependencies.logger?.info?.(
    'NESTJOURNEY_CONNECT_FOLLOWUP_CONTEXT',
    {
      maskedUid: maskUid(uid),
      organizationId,
      congregationId,
      result: 'success'
    }
  );

  return {
    success: true,
    organization: {
      id: organizationId,
      name:
        clean(organization.name) ||
        'Igreja'
    },
    followup: {
      id: followupId,
      careRequestId,
      congregationId,
      dueAt: toIso(followup.dueAt)
    },
    person: {
      name: personName,
      phone
    },
    returnTo:
      'https://nestjourney.millionsnest.com/followup-runtime?followup=' +
      encodeURIComponent(followupId)
  };
}

export async function handleNestJourneyFollowupContextRequest(
  req: express.Request,
  res: express.Response,
  deps: NestJourneyFollowupContextDependencies
) {
  noStore(res);

  const authorization =
    typeof req.headers.authorization ===
      'string'
      ? req.headers.authorization.trim()
      : '';

  if (
    !/^Bearer\s+\S+$/i.test(
      authorization
    )
  ) {
    return res.status(401).json({
      success: false,
      code: 'AUTH_REQUIRED'
    });
  }

  const organizationId =
    validId(req.query.organizationId);
  const followupId =
    validId(req.query.followupId);

  if (
    !organizationId ||
    !followupId
  ) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_REQUEST'
    });
  }

  let decoded:
    admin.auth.DecodedIdToken;
  try {
    decoded =
      await deps.verifyIdToken(
        authorization.replace(
          /^Bearer\s+/i,
          ''
        )
      );
  } catch {
    return res.status(401).json({
      success: false,
      code: 'AUTH_REQUIRED'
    });
  }

  const uid = clean(decoded.uid);
  if (!uid) {
    return res.status(401).json({
      success: false,
      code: 'AUTH_REQUIRED'
    });
  }

  const db = deps.getDb();
  if (!db) {
    return res.status(503).json({
      success: false,
      code: 'SERVICE_UNAVAILABLE'
    });
  }

  try {
    const context =
      await resolveNestJourneyFollowupConnectContext(
        {
          uid,
          organizationId,
          followupId
        },
        {
          db,
          resolveAccess:
            deps.resolveAccess,
          logger: deps.logger
        }
      );

    return res.status(200).json(
      context
    );
  } catch (error) {
    if (
      error instanceof
      NestJourneyFollowupContextError
    ) {
      return res
        .status(error.status)
        .json({
          success: false,
          code: error.code
        });
    }

    deps.logger?.error?.(
      'NESTJOURNEY_CONNECT_FOLLOWUP_CONTEXT_FAILED',
      {
        organizationId,
        code: 'INTERNAL_ERROR'
      }
    );

    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR'
    });
  }
}
