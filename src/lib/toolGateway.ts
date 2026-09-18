export type ToolRiskLevel =
  | 'low'
  | 'sensitive'
  | 'high_impact';

export type ToolApprovalPolicy =
  | 'none'
  | 'human_required';

export type ToolAvailability =
  | 'enabled'
  | 'adapter_pending'
  | 'product_not_operational';

export type EcosystemToolId =
  | 'musicscale.scale.review'
  | 'connect.message.send'
  | 'nestfinance.payment.mutate';

export interface EcosystemToolDefinition {
  id: EcosystemToolId;
  domain: 'musicscale' | 'connect' | 'nestfinance';
  operation: string;
  risk: ToolRiskLevel;
  approvalPolicy: ToolApprovalPolicy;
  availability: ToolAvailability;
  allowedInputKeys: readonly string[];
}

export const ECOSYSTEM_TOOL_REGISTRY:
  Readonly<Record<EcosystemToolId, EcosystemToolDefinition>> = {
    'musicscale.scale.review': {
      id: 'musicscale.scale.review',
      domain: 'musicscale',
      operation: 'review_scale',
      risk: 'low',
      approvalPolicy: 'none',
      availability: 'enabled',
      allowedInputKeys: ['scaleId']
    },
    'connect.message.send': {
      id: 'connect.message.send',
      domain: 'connect',
      operation: 'send_message',
      risk: 'sensitive',
      approvalPolicy: 'human_required',
      availability: 'adapter_pending',
      allowedInputKeys: [
        'channel',
        'recipientRef',
        'templateId',
        'locale'
      ]
    },
    'nestfinance.payment.mutate': {
      id: 'nestfinance.payment.mutate',
      domain: 'nestfinance',
      operation: 'mutate_payment',
      risk: 'high_impact',
      approvalPolicy: 'human_required',
      availability: 'product_not_operational',
      allowedInputKeys: [
        'paymentId',
        'operation'
      ]
    }
  };

export type ToolActionPlan =
  | {
      decision: 'execute_now';
      definition: EcosystemToolDefinition;
    }
  | {
      decision: 'require_approval';
      definition: EcosystemToolDefinition;
    }
  | {
      decision: 'unavailable';
      definition: EcosystemToolDefinition;
      reason:
        | 'adapter_pending'
        | 'product_not_operational';
    };

export function resolveToolDefinition(
  toolId: unknown
): EcosystemToolDefinition | null {
  if (typeof toolId !== 'string') return null;
  return (
    ECOSYSTEM_TOOL_REGISTRY[
      toolId as EcosystemToolId
    ] ?? null
  );
}

export function planToolAction(
  definition: EcosystemToolDefinition
): ToolActionPlan {
  if (definition.availability !== 'enabled') {
    return {
      decision: 'unavailable',
      definition,
      reason: definition.availability
    };
  }

  if (
    definition.approvalPolicy ===
    'human_required'
  ) {
    return {
      decision: 'require_approval',
      definition
    };
  }

  return {
    decision: 'execute_now',
    definition
  };
}

export function hasOnlyAllowedToolInputKeys(
  definition: EcosystemToolDefinition,
  input: unknown
): input is Record<string, unknown> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    return false;
  }

  const allowed = new Set(
    definition.allowedInputKeys
  );

  return Object.keys(
    input as Record<string, unknown>
  ).every(key => allowed.has(key));
}

export function toolNeedsHumanApproval(
  toolId: EcosystemToolId
): boolean {
  return (
    ECOSYSTEM_TOOL_REGISTRY[toolId]
      .approvalPolicy === 'human_required'
  );
}
