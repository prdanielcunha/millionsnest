from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, got {count}')
    return text.replace(old, new, 1)

# 1) Fix authorization ordering in the new service: even ALREADY_ROLE requires actor authority.
p = Path('src/server/services/OrganizationRoleCommandService.ts')
s = p.read_text()
old = '''      if (targetMembership.role === newRole) {
        return { success: true as const, reasonCode: 'ALREADY_ROLE', previousOrganizationRole: targetMembership.role, organizationRole: newRole };
      }

      const actorGlobal = isCanonicalGlobalRole(actorUserSnap.data()?.systemRole);
      const actorMetadataOwner = organizationOwnerMatches(organization, actorUid);
      const actorMembership = classifyMembership(actorMemberSnap.data());
      const decision = roleDecision({
        actorGlobal,
        actorMetadataOwner,
        actorMembership,
        targetRole: targetMembership.role,
        newRole: newRole as AssignableRole
      });
      if (decision.allowed === false) return { success: false as const, reasonCode: decision.reasonCode };

      const permissions = getDefaultPermissions(newRole);
'''
new = '''      const actorGlobal = isCanonicalGlobalRole(actorUserSnap.data()?.systemRole);
      const actorMetadataOwner = organizationOwnerMatches(organization, actorUid);
      const actorMembership = classifyMembership(actorMemberSnap.data());
      const decision = roleDecision({
        actorGlobal,
        actorMetadataOwner,
        actorMembership,
        targetRole: targetMembership.role,
        newRole: newRole as AssignableRole
      });
      if (decision.allowed === false) return { success: false as const, reasonCode: decision.reasonCode };

      if (targetMembership.role === newRole) {
        return { success: true as const, reasonCode: 'ALREADY_ROLE', previousOrganizationRole: targetMembership.role, organizationRole: newRole };
      }

      const permissions = getDefaultPermissions(newRole);
'''
s = replace_once(s, old, new, 'service replay authorization ordering')
p.write_text(s)

# 2) server.ts: import canonical command and add versioned endpoint.
p = Path('server.ts')
s = p.read_text()
old_import = "import { removeOrganizationMember } from './src/server/services/MemberRemovalCommandService.js';\n"
new_import = old_import + "import { updateOrganizationMemberRole } from './src/server/services/OrganizationRoleCommandService.js';\n"
s = replace_once(s, old_import, new_import, 'server import')

old_route = "  app.delete('/api/v1/organizations/:organizationId/members/:memberId', (req, res) => removeOrganizationMember(req, res));\n"
new_route = old_route + "  app.patch('/api/v1/organizations/:organizationId/members/:memberId/role', express.json({ limit: '8kb' }), (req, res) => updateOrganizationMemberRole(req, res));\n"
s = replace_once(s, old_route, new_route, 'canonical role route')

# 3) Profile endpoint must not remain a parallel role/appRole authority.
profile_anchor = "      const { displayName, photoURL, role, appRole } = req.body;\n      \n      if (!db) return res.status(500).json({ error: 'Database not initialized' });\n"
profile_new = "      const { displayName, photoURL, role, appRole } = req.body;\n      if (role !== undefined || appRole !== undefined) {\n        return res.status(400).json({ success: false, reasonCode: 'ROLE_MUTATION_REQUIRES_CANONICAL_COMMAND' });\n      }\n      \n      if (!db) return res.status(500).json({ error: 'Database not initialized' });\n"
s = replace_once(s, profile_anchor, profile_new, 'profile role mutation gate')

# 4) Replace the unsafe legacy role implementation with a compatibility delegate.
pattern = r"  app\.post\('/api/organizations/:orgId/members/:memberId/role', express\.json\(\), async \(req: any, res\) => \{.*?\n  \}\);\n\n(?=  app\.)"
replacement = "  app.post('/api/organizations/:orgId/members/:memberId/role', express.json({ limit: '8kb' }), (req: any, res) => updateOrganizationMemberRole(req, res));\n\n"
s, count = re.subn(pattern, replacement, s, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'legacy role route: expected one structural match, got {count}')
p.write_text(s)

print('canonical organization role P0 guarded patch applied')
