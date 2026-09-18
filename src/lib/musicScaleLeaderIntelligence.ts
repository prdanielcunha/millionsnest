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

export interface MusicScaleDeclinedFunctionGap {
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

function terminalStatusesByAssignment(
  responses: readonly MusicScaleResponseObservation[]
): Map<string, Set<string>> {
  const statuses = new Map<string, Set<string>>();

  for (const response of responses) {
    if (response?.active === false) continue;

    const id = responseAssignmentId(response);
    if (!id) continue;

    const status = clean(response.status || 'pending').toLowerCase();
    if (!TERMINAL_RESPONSE_STATUSES.has(status)) continue;

    const assignmentStatuses = statuses.get(id) || new Set<string>();
    assignmentStatuses.add(status);
    statuses.set(id, assignmentStatuses);
  }

  return statuses;
}

function declinedAssignmentIds(
  assignments: readonly MusicScaleAssignmentObservation[],
  responses: readonly MusicScaleResponseObservation[]
): Set<string> {
  const terminalStatuses = terminalStatusesByAssignment(responses);
  const declined = new Set<string>();

  for (const assignment of assignments) {
    if (assignment?.active === false) continue;

    const id = assignmentId(assignment);
    if (!id) continue;

    const statuses = terminalStatuses.get(id);
    if (
      statuses?.size === 1 &&
      statuses.has('declined')
    ) {
      declined.add(id);
    }
  }

  return declined;
}

export function countDeclinedConfirmations(
  assignments: readonly MusicScaleAssignmentObservation[],
  responses: readonly MusicScaleResponseObservation[]
): number {
  return declinedAssignmentIds(assignments, responses).size;
}

export function deriveDeclinedConfirmationGapsByFunction(
  assignments: readonly MusicScaleAssignmentObservation[],
  responses: readonly MusicScaleResponseObservation[]
): MusicScaleDeclinedFunctionGap[] {
  const declinedIds = declinedAssignmentIds(assignments, responses);
  const counts = new Map<string, number>();

  for (const assignment of assignments) {
    if (assignment?.active === false) continue;

    const id = assignmentId(assignment);
    if (!id || !declinedIds.has(id)) continue;

    const functionName = clean(assignment.functionName);
    if (!functionName) continue;

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

export function summarizeDeclinedConfirmationFunctions(
  gaps: readonly MusicScaleDeclinedFunctionGap[]
): string[] {
  return gaps
    .filter(gap => gap.count > 0 && clean(gap.functionName))
    .map(gap =>
      gap.count > 1
        ? `${gap.functionName} (${gap.count})`
        : gap.functionName
    );
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
function pendingAssignmentIds(
  assignments: readonly MusicScaleAssignmentObservation[],
  responses: readonly MusicScaleResponseObservation[]
): Set<string> {
  const activeAssignments = assignments.filter(
    assignment => assignment?.active !== false
  );
  const activeResponses = responses.filter(
    response => response?.active !== false
  );

  const terminalAssignmentIds = new Set<string>();
  const responseAssignmentIds = new Set<string>();
  const pendingResponseAssignmentIds = new Set<string>();

  for (const response of activeResponses) {
    const id = responseAssignmentId(response);
    if (!id) continue;

    responseAssignmentIds.add(id);
    const status = clean(response.status || 'pending').toLowerCase();

    if (TERMINAL_RESPONSE_STATUSES.has(status)) {
      terminalAssignmentIds.add(id);
      pendingResponseAssignmentIds.delete(id);
    } else if (!terminalAssignmentIds.has(id)) {
      pendingResponseAssignmentIds.add(id);
    }
  }

  const pending = new Set<string>();

  activeAssignments.forEach((assignment, index) => {
    const id = assignmentId(assignment);
    const stableId = id || `__missing_assignment_id__:${index}`;

    if (
      !id ||
      (
        !terminalAssignmentIds.has(id) &&
        (
          pendingResponseAssignmentIds.has(id) ||
          !responseAssignmentIds.has(id)
        )
      )
    ) {
      pending.add(stableId);
    }
  });

  return pending;
}

export function countPendingConfirmations(
  assignments: readonly MusicScaleAssignmentObservation[],
  responses: readonly MusicScaleResponseObservation[]
): number {
  return pendingAssignmentIds(assignments, responses).size;
}

export function derivePendingConfirmationGapsByFunction(
  assignments: readonly MusicScaleAssignmentObservation[],
  responses: readonly MusicScaleResponseObservation[]
): MusicScalePendingFunctionGap[] {
  const activeAssignments = assignments.filter(
    assignment => assignment?.active !== false
  );
  const pendingIds = pendingAssignmentIds(assignments, responses);
  const counts = new Map<string, number>();

  activeAssignments.forEach((assignment, index) => {
    const functionName = clean(assignment.functionName);
    if (!functionName) return;

    const id = assignmentId(assignment);
    const stableId = id || `__missing_assignment_id__:${index}`;
    if (!pendingIds.has(stableId)) return;

    counts.set(functionName, (counts.get(functionName) || 0) + 1);
  });

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
