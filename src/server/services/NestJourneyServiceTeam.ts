/**
 * NestJourney-only service team metadata.
 * This never changes MillionsNest organization roles or other apps' entitlements.
 * A team choice is an assignment/preference, not a grant to see sensitive records.
 */
export const JOURNEY_SERVICE_AREAS = ['presence', 'table', 'care', 'house', 'discipleship', 'support'] as const;
export const JOURNEY_SERVICE_ROLES = ['leader', 'integrant', 'auxiliary', 'trainee', 'other'] as const;
export type JourneyServiceArea = typeof JOURNEY_SERVICE_AREAS[number];
export type JourneyServiceRole = typeof JOURNEY_SERVICE_ROLES[number];
export type JourneyServiceTeam = {
  version: 1;
  primaryArea: JourneyServiceArea;
  teamRole: JourneyServiceRole;
  supportAreas: Exclude<JourneyServiceArea, 'support'>[];
  otherLabel?: string;
};
const AREA_SET = new Set<string>(JOURNEY_SERVICE_AREAS);
const ROLE_SET = new Set<string>(JOURNEY_SERVICE_ROLES);
const WORK_AREAS = new Set<string>(JOURNEY_SERVICE_AREAS.filter(x => x !== 'support'));

export function parseJourneyServiceTeam(value: unknown): JourneyServiceTeam | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (!AREA_SET.has(String(data.primaryArea)) || !ROLE_SET.has(String(data.teamRole))) return null;
  const primaryArea = data.primaryArea as JourneyServiceArea;
  const teamRole = data.teamRole as JourneyServiceRole;
  if (primaryArea === 'support' && teamRole === 'leader') return null;
  if (!Array.isArray(data.supportAreas) || data.supportAreas.length > 5) return null;
  if (!data.supportAreas.every((area: unknown) => typeof area === 'string' && WORK_AREAS.has(area))) return null;
  const supportAreas = [...new Set(data.supportAreas)] as Exclude<JourneyServiceArea, 'support'>[];
  if (supportAreas.length !== data.supportAreas.length) return null;
  const otherLabel = typeof data.otherLabel === 'string' ? data.otherLabel.trim() : '';
  if (data.otherLabel !== undefined && typeof data.otherLabel !== 'string') return null;
  if (otherLabel.length > 80 || (teamRole === 'other' && !otherLabel)) return null;
  if (teamRole !== 'other' && otherLabel) return null;
  return {
    version: 1,
    primaryArea,
    teamRole,
    supportAreas,
    ...(otherLabel ? { otherLabel } : {}),
  };
}

/** Only explicit leaders may acquire the existing operational capability for ONE front. */
export function journeyResponsibilityForTeam(team: JourneyServiceTeam) {
  if (team.teamRole !== 'leader') return 'member' as const;
  const map = {
    presence: 'presence_host', table: 'mesa_team', care: 'caregiver',
    house: 'group_leader', discipleship: 'discipler', support: 'member',
  } as const;
  return map[team.primaryArea];
}
