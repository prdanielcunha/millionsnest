export type AdminOrganizationOption = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
};

const INTERNAL_FIXTURE_NAME = /^Mock Org ORG_(?:ALPHA|BETA)_/i;
const INTERNAL_FIXTURE_SLUG = /^ORG_(?:ALPHA|BETA)_/i;

export function isAdminOrganizationVisible(
  organization: AdminOrganizationOption,
  homeOrganizationId?: string | null,
): boolean {
  const id = String(organization?.id || '').trim();
  if (!id || (homeOrganizationId && id === homeOrganizationId)) return false;

  const name = String(organization?.name || '').trim();
  const slug = String(organization?.slug || '').trim();
  if (INTERNAL_FIXTURE_NAME.test(name) || INTERNAL_FIXTURE_SLUG.test(slug)) return false;

  return true;
}

export function getAdminHomeOrganizationLabel(input: {
  homeOrganizationId?: string | null;
  selectedOrganizationId?: string | null;
  currentOrganizationName?: string | null;
  organizations?: AdminOrganizationOption[] | null;
}): string {
  const homeId = String(input.homeOrganizationId || '').trim();
  const explicitHomeName = (input.organizations || []).find(
    organization => String(organization?.id || '').trim() === homeId,
  )?.name;

  if (typeof explicitHomeName === 'string' && explicitHomeName.trim()) {
    return explicitHomeName.trim();
  }

  if (!input.selectedOrganizationId && typeof input.currentOrganizationName === 'string') {
    const current = input.currentOrganizationName.trim();
    if (current) return current;
  }

  return 'Minha organização';
}
