import type { HubAppExperience } from './hubAppExperience.js';
import {
  deriveCurrentHubLensAuthorization,
  type CurrentMusicScaleLensAuthority,
  type CurrentNestJourneyLensAuthority
} from './hubLensAuthorization.js';
import {
  resolveEntitledAppIds
} from './adaptiveEntitlements.js';
import type {
  HubLensAuthorizationProjection,
  HubResponsibility
} from './lensResolver.js';

export type CurrentContextNodeKind =
  | 'actor'
  | 'organization'
  | 'app'
  | 'domain'
  | 'responsibility';

export type CurrentContextEdgeRelation =
  | 'operates_in'
  | 'entitled_to'
  | 'authorized_for'
  | 'responsible_for'
  | 'owns_domain';

export interface CurrentContextNode {
  id: string;
  kind: CurrentContextNodeKind;
  key: string;
}

export interface CurrentContextEdge {
  from: string;
  to: string;
  relation: CurrentContextEdgeRelation;
}

export interface CurrentContextGraph {
  organizationId: string;
  nodes: readonly CurrentContextNode[];
  edges: readonly CurrentContextEdge[];
  entitledAppIds: readonly string[];
  authorizedDomains: HubLensAuthorizationProjection;
  responsibilities: readonly HubResponsibility[];
}

export interface CurrentContextGraphInput {
  organizationId: string;
  appExperiences: readonly HubAppExperience[];
  canManageOrganization: boolean;
  musicScaleAccess?: CurrentMusicScaleLensAuthority | null;
  nestJourneyAccess?: CurrentNestJourneyLensAuthority | null;
}

const ACTOR_NODE_ID = 'actor:current';

function nodeId(kind: Exclude<CurrentContextNodeKind, 'actor'>, key: string) {
  return `${kind}:${key}`;
}

function addNode(
  nodes: CurrentContextNode[],
  seen: Set<string>,
  node: CurrentContextNode
) {
  if (seen.has(node.id)) return;
  seen.add(node.id);
  nodes.push(node);
}

function addEdge(
  edges: CurrentContextEdge[],
  seen: Set<string>,
  edge: CurrentContextEdge
) {
  const identity = `${edge.from}|${edge.relation}|${edge.to}`;
  if (seen.has(identity)) return;
  seen.add(identity);
  edges.push(edge);
}

function resolveCurrentEntitlements(
  input: CurrentContextGraphInput
): string[] {
  const current = resolveEntitledAppIds(input.appExperiences).filter(appId => {
    if (appId === 'musicscale') {
      // A stale installed/catalog bit can never overrule the current
      // backend-authoritative MusicScale access decision.
      return (
        input.musicScaleAccess?.accessible === true &&
        input.musicScaleAccess?.decisionState === 'granted'
      );
    }

    if (appId === 'nestjourney') {
      return (
        input.nestJourneyAccess?.accessible === true &&
        input.nestJourneyAccess?.decisionState === 'granted' &&
        input.nestJourneyAccess?.isGlobalAccess !== true
      );
    }

    return true;
  });

  // NestJourney is still a controlled pilot in the public catalog. A canonical
  // backend grant plus operational Journey capability may therefore materialize
  // the product entitlement into this runtime graph even while the public card
  // remains marked as coming soon. Global governance alone never qualifies.
  if (
    input.nestJourneyAccess?.accessible === true &&
    input.nestJourneyAccess?.decisionState === 'granted' &&
    input.nestJourneyAccess?.canReadJourneyOperational === true &&
    input.nestJourneyAccess?.isGlobalAccess !== true &&
    !current.includes('nestjourney')
  ) {
    current.push('nestjourney');
  }

  return current;
}

function deriveCanonicalResponsibilities(
  authorizedDomains: HubLensAuthorizationProjection,
  entitledAppIds: readonly string[]
): HubResponsibility[] {
  const responsibilities: HubResponsibility[] = [];
  const entitlements = new Set(entitledAppIds);

  // Managed-response authority is the current canonical proxy for worship
  // leadership responsibility. Display names/titles are deliberately ignored.
  if (authorizedDomains.worship === true && entitlements.has('musicscale')) {
    responsibilities.push('worship_leadership');
  }

  if (authorizedDomains.journey === true && entitlements.has('nestjourney')) {
    responsibilities.push('journey_leadership');
  }

  if (authorizedDomains.administration === true) {
    responsibilities.push('organization_administration');
  }

  return responsibilities;
}

/**
 * Runtime Context Graph for the currently shipped Hub.
 *
 * It composes facts the Hub already knows authoritatively: active tenant,
 * operational product entitlement and domain capabilities. No display label,
 * title string or inferred ministry role can create an edge.
 *
 * This graph is read-only and in-memory in this phase. It is the bridge toward
 * the full Church Intelligence Context Graph without introducing a new
 * datastore or duplicating Hub RBAC.
 */
export function buildCurrentContextGraph(
  input: CurrentContextGraphInput
): CurrentContextGraph {
  const organizationId = input.organizationId.trim();

  if (!organizationId) {
    return {
      organizationId: '',
      nodes: [],
      edges: [],
      entitledAppIds: [],
      authorizedDomains: {
        pastoral: false,
        journey: false,
        worship: false,
        finance: false,
        administration: false
      },
      responsibilities: []
    };
  }

  const entitledAppIds = resolveCurrentEntitlements(input);
  const authorizedDomains = deriveCurrentHubLensAuthorization({
    canManageOrganization: input.canManageOrganization,
    musicScaleAccess: input.musicScaleAccess,
    nestJourneyAccess: input.nestJourneyAccess
  });
  const responsibilities = deriveCanonicalResponsibilities(
    authorizedDomains,
    entitledAppIds
  );

  const nodes: CurrentContextNode[] = [];
  const edges: CurrentContextEdge[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const organizationNodeId = nodeId('organization', organizationId);

  addNode(nodes, nodeIds, {
    id: ACTOR_NODE_ID,
    kind: 'actor',
    key: 'current'
  });
  addNode(nodes, nodeIds, {
    id: organizationNodeId,
    kind: 'organization',
    key: organizationId
  });
  addEdge(edges, edgeIds, {
    from: ACTOR_NODE_ID,
    to: organizationNodeId,
    relation: 'operates_in'
  });

  for (const appId of entitledAppIds) {
    const appNodeId = nodeId('app', appId);
    addNode(nodes, nodeIds, {
      id: appNodeId,
      kind: 'app',
      key: appId
    });
    addEdge(edges, edgeIds, {
      from: organizationNodeId,
      to: appNodeId,
      relation: 'entitled_to'
    });

    if (appId === 'musicscale') {
      const domainNodeId = nodeId('domain', 'worship');
      addNode(nodes, nodeIds, {
        id: domainNodeId,
        kind: 'domain',
        key: 'worship'
      });
      addEdge(edges, edgeIds, {
        from: appNodeId,
        to: domainNodeId,
        relation: 'owns_domain'
      });
    }

    if (appId === 'nestjourney') {
      const domainNodeId = nodeId('domain', 'journey');
      addNode(nodes, nodeIds, {
        id: domainNodeId,
        kind: 'domain',
        key: 'journey'
      });
      addEdge(edges, edgeIds, {
        from: appNodeId,
        to: domainNodeId,
        relation: 'owns_domain'
      });
    }
  }

  const authorizedDomainIds = (
    ['pastoral', 'journey', 'worship', 'finance', 'administration'] as const
  ).filter(domain => authorizedDomains[domain] === true);

  for (const domain of authorizedDomainIds) {
    const domainNodeId = nodeId('domain', domain);
    addNode(nodes, nodeIds, {
      id: domainNodeId,
      kind: 'domain',
      key: domain
    });
    addEdge(edges, edgeIds, {
      from: ACTOR_NODE_ID,
      to: domainNodeId,
      relation: 'authorized_for'
    });
  }

  for (const responsibility of responsibilities) {
    const responsibilityNodeId = nodeId('responsibility', responsibility);
    addNode(nodes, nodeIds, {
      id: responsibilityNodeId,
      kind: 'responsibility',
      key: responsibility
    });
    addEdge(edges, edgeIds, {
      from: ACTOR_NODE_ID,
      to: responsibilityNodeId,
      relation: 'responsible_for'
    });
  }

  return {
    organizationId,
    nodes,
    edges,
    entitledAppIds,
    authorizedDomains,
    responsibilities
  };
}

export function hasCurrentContextEdge(
  graph: CurrentContextGraph,
  relation: CurrentContextEdgeRelation,
  to: string
): boolean {
  return graph.edges.some(
    edge => edge.relation === relation && edge.to === to
  );
}
