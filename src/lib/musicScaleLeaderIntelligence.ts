export interface MusicScaleAssignmentObservation {
  eventAssignmentId?: string | null;
  functionName?: string | null;
  active?: boolean | null;
}

export interface MusicScaleResponseObservation {
  id?: string | null;
  eventAssignmentId?: string | null;
  status?: string | null;
  active?: boolean | null;
}

export interface MusicScalePendingFunctionGap {
  functionName: string;
  count: number;
}

const TERMINAL_RESPONSE_STATUSES = new Set([
  'accepted',
  'maybe',
  'declined'
]);

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function assignmentId(
  assignment: MusicScaleAssignmentObservation
): string {
  return clean(assignment.eventAssignmentId);
}

function responseAssignmentId(
  response: MusicScaleResponseObservation
): string {
  return clean(response.eventAssignmentId) || clean(response.id);
}

/**
 * Deterministic, privacy-safe leader intelligence.
 *
 * This projection answers only: which ministry functions still have response
 * slots pending? It never emits user names, user ids, inferred availability,
 * wellbeing state, preference or pastoral meaning.
 *
 * A terminal response (accepted/maybe/declined) wins over a stale duplicate
 * pending response for the same assignment, avoiding false pending gaps.
 */
export function derivePendingConfirmationGapsByFunction(
  assignments: readonly MusicScaleAssignmentObservation[],
  responses: readonly MusicScaleResponseObservation[]
): MusicScalePendingFunctionGap[] {
  const activeAssignments = assignments.filter(
    assignment => assignment?.active !== false
  );
  const activeResponses = responses.filter(
    response => response?.active !== false
  );

  const terminalAssignmentIds = new Set<string>();
  const pendingAssignmentIds = new Set<string>();

  for (const response of activeResponses) {
    const id = responseAssignmentId(response);
    if (!id) continue;

    const status = clean(response.status || 'pending').toLowerCase();
    if (TERMINAL_RESPONSE_STATUSES.has(status)) {
      terminalAssignmentIds.add(id);
      pendingAssignmentIds.delete(id);
    } else if (!terminalAssignmentIds.has(id)) {
      pendingAssignmentIds.add(id);
    }
  }

  const counts = new Map<string, number>();

  for (const assignment of activeAssignments) {
    const functionName = clean(assignment.functionName);
    if (!functionName) continue;

    const id = assignmentId(assignment);
    const isPending =
      !id ||
      (
        !terminalAssignmentIds.has(id) &&
        (
          pendingAssignmentIds.has(id) ||
          !activeResponses.some(
            response => responseAssignmentId(response) === id
          )
        )
      );

    if (!isPending) continue;

    counts.set(functionName, (counts.get(functionName) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([functionName, count]) => ({ functionName, count }))
    .sort((a, b) =>
      a.functionName < b.functionName
        ? -1
        : a.functionName > b.functionName
          ? 1
          : 0
    );
}

export function summarizePendingConfirmationFunctions(
  gaps: readonly MusicScalePendingFunctionGap[]
): string[] {
  return gaps
    .filter(gap => gap.count > 0 && clean(gap.functionName))
    .map(gap =>
      gap.count > 1
        ? `${gap.functionName} (${gap.count})`
        : gap.functionName
    );
}
