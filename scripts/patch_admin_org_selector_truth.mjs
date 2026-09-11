import fs from 'node:fs';

const file = 'src/components/OrganizationManager.tsx';
let source = fs.readFileSync(file, 'utf8');

const importAnchor = "import { isGlobalPrivilegedUser, canEnterAnyOrganization, resolveEcosystemPrivilegePolicy } from '../lib/permissionService.js';";
const selectorImport = "import { getAdminHomeOrganizationLabel, isAdminOrganizationVisible } from '../lib/adminOrganizationSelector.js';";

if (!source.includes(selectorImport)) {
  if (!source.includes(importAnchor)) throw new Error('IMPORT_ANCHOR_NOT_FOUND');
  source = source.replace(importAnchor, `${importAnchor}\n${selectorImport}`);
}

const oldOption = "<option value={profile?.organizationId || ''}>Voltar à sua organização</option>";
const newOption = `<option value={profile?.organizationId || ''}>\n               {getAdminHomeOrganizationLabel({\n                 homeOrganizationId: profile?.organizationId,\n                 selectedOrganizationId: adminSelectedOrgId,\n                 currentOrganizationName: organization?.name,\n                 organizations: adminOrgs\n               })}\n             </option>`;
if (!source.includes(oldOption)) throw new Error('HOME_OPTION_ANCHOR_NOT_FOUND');
source = source.replace(oldOption, newOption);

const oldFilter = "{adminOrgs.filter(o => o.id !== profile?.organizationId).map(org => (";
const newFilter = "{adminOrgs.filter(o => isAdminOrganizationVisible(o, profile?.organizationId)).map(org => (";
if (!source.includes(oldFilter)) throw new Error('ADMIN_FILTER_ANCHOR_NOT_FOUND');
source = source.replace(oldFilter, newFilter);

fs.writeFileSync(file, source, 'utf8');
console.log('ADMIN_ORG_SELECTOR_TRUTH_PATCH_OK');
