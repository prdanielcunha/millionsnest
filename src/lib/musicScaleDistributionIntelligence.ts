export const WORSHIP_DISTRIBUTION_WINDOW_DAYS = 30;
export const WORSHIP_DISTRIBUTION_WINDOW_MS =
  WORSHIP_DISTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export interface MusicScaleDistributionAssignmentInput {
  eventAssignmentId?: string | null;
  userId?: string | null;
  functionName?: string | null;
  active?: boolean | null;
}

export interface MusicScaleDistributionScaleInput {
  id: string;
  status?: string | null;
  startsAtMs: number;
  eventAssignments?: readonly MusicScaleDistributionAssignmentInput[] | null;
}

export interface MusicScaleFunctionDistribution {
  functionName: string;
  assignmentCount: number;
  uniquePeople: number;
  minAssignmentsPerPerson: number;
  maxAssignmentsPerPerson: number;
  averageAssignmentsPerPerson: number;
}

export interface MusicScaleAssignmentDistributionSnapshot {
  windowDays: number;
  windowStartMs: number;
  windowEndMs: number;
  completedScheduleCount: number;
  assignmentCount: number;
  uniquePeople: number;
  byFunction: MusicScaleFunctionDistribution[];
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteTimestamp(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function normalizeAverage(value: number): number {
  return Math.round(value * 10) / 10;
}

function assignmentIdentity(
  scaleId: string,
  assignment: MusicScaleDistributionAssignmentInput
): string | null {
  const explicitId = clean(assignment.eventAssignmentId);
  if (explicitId) return `${scaleId}:assignment:${explicitId}`;

  const userId = clean(assignment.userId);
  const functionName = clean(assignment.functionName);
  if (!userId || !functionName) return null;

  // Compatibility fallback for older assignment records without an explicit
  // eventAssignmentId. One person/function pair counts once per completed scale.
  return `${scaleId}:person-function:${userId}:${functionName}`;
}

/**
 * Descriptive Worship Operations intelligence over already-loaded MusicScale
 * schedules.
 *
 * This deliberately measures only recorded assignments on schedules explicitly
 * marked "completed". It does not claim attendance, actual service completion,
 * effort, preference, performance or wellbeing.
 */
export function deriveMusicScaleAssignmentDistribution(
  scales: readonly MusicScaleDistributionScaleInput[],
  nowMs: number = Date.now()
): MusicScaleAssignmentDistributionSnapshot {
  const safeNow = finiteTimestamp(nowMs) ?? Date.now();
  const windowStartMs = Math.max(
    0,
    safeNow - WORSHIP_DISTRIBUTION_WINDOW_MS
  );

  const eligibleScaleById = new Map<
    string,
    MusicScaleDistributionScaleInput
  >();

  for (const scale of scales) {
    const scaleId = clean(scale?.id);
    const startsAtMs = finiteTimestamp(scale?.startsAtMs);
    if (!scaleId || startsAtMs === null) continue;

    if (
      clean(scale.status).toLowerCase() !== 'completed' ||
      startsAtMs < windowStartMs ||
      startsAtMs > safeNow
    ) {
      continue;
    }

    if (!eligibleScaleById.has(scaleId)) {
      eligibleScaleById.set(scaleId, scale);
    }
  }

  const eligibleScales = Array.from(eligibleScaleById.values());

  const seenAssignments = new Set<string>();
  const allPeople = new Set<string>();
  const assignmentsByFunction = new Map<
    string,
    Map<string, number>
  >();

  for (const scale of eligibleScales) {
    const scaleId = clean(scale.id);
    if (!scaleId) continue;

    const assignments = Array.isArray(scale.eventAssignments)
      ? scale.eventAssignments
      : [];

    for (const assignment of assignments) {
      if (assignment?.active === false) continue;

      const userId = clean(assignment.userId);
      const functionName = clean(assignment.functionName);
      if (!userId || !functionName) continue;

      const identity = assignmentIdentity(scaleId, assignment);
      if (!identity || seenAssignments.has(identity)) continue;
      seenAssignments.add(identity);

      allPeople.add(userId);

      const functionPeople =
        assignmentsByFunction.get(functionName) ??
        new Map<string, number>();

      functionPeople.set(
        userId,
        (functionPeople.get(userId) ?? 0) + 1
      );
      assignmentsByFunction.set(functionName, functionPeople);
    }
  }

  const byFunction = Array.from(assignmentsByFunction.entries())
    .map(([functionName, people]) => {
      const counts = Array.from(people.values());
      const assignmentCount = counts.reduce(
        (total, count) => total + count,
        0
      );

      return {
        functionName,
        assignmentCount,
        uniquePeople: people.size,
        minAssignmentsPerPerson: counts.length
          ? Math.min(...counts)
          : 0,
        maxAssignmentsPerPerson: counts.length
          ? Math.max(...counts)
          : 0,
        averageAssignmentsPerPerson: counts.length
          ? normalizeAverage(assignmentCount / counts.length)
          : 0
      };
    })
    .sort((a, b) =>
      a.functionName.localeCompare(b.functionName)
    );

  return {
    windowDays: WORSHIP_DISTRIBUTION_WINDOW_DAYS,
    windowStartMs,
    windowEndMs: safeNow,
    completedScheduleCount: eligibleScales.length,
    assignmentCount: seenAssignments.size,
    uniquePeople: allPeople.size,
    byFunction
  };
}

export function hasMusicScaleDistributionData(
  snapshot: MusicScaleAssignmentDistributionSnapshot
): boolean {
  return (
    snapshot.completedScheduleCount > 0 &&
    snapshot.assignmentCount > 0 &&
    snapshot.byFunction.length > 0
  );
}
