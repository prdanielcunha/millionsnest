import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
const login = readFileSync('src/pages/Login.tsx', 'utf8');
const home = readFileSync('src/pages/Home.tsx', 'utf8');
const join = readFileSync('src/pages/Join.tsx', 'utf8');
const organization = readFileSync('src/components/OrganizationManager.tsx', 'utf8');

assert.match(dashboard, /navigate\('\/dashboard\/overview', \{ replace: true \}\)/, 'bare /dashboard must canonicalize to Hub Home');
assert.equal(dashboard.includes('installedApps.length === 1'), false, 'a single installed app must not bypass Hub Home');
assert.equal(dashboard.includes('configAppModal'), false, 'legacy app config modal must be removed');
assert.equal(dashboard.includes('Painel de configurações avançadas estará disponível em breve'), false, 'no fake app settings promise may remain');
assert.match(dashboard, /handleLaunchEcosystemApp\(app, currentUserPerms, '\/profile'\)/, 'MusicScale settings gear must open a real route');

assert.ok(login.includes("navigate('/dashboard/overview')"), 'login must land on Hub Home');
assert.ok(home.includes('<Navigate to="/dashboard/overview" replace />'), 'authenticated public home must land on Hub Home');
assert.ok(join.includes("window.location.href = '/dashboard/overview'"), 'accepted invitation must land on Hub Home');
assert.ok(join.includes('to="/dashboard/overview"'), 'invitation fallback action must return to Hub Home');

const memberSaveStart = dashboard.indexOf('const handleSaveMemberEdit');
const memberSaveEnd = dashboard.indexOf('const handleSendMemberPasswordReset', memberSaveStart);
assert.ok(memberSaveStart >= 0 && memberSaveEnd > memberSaveStart, 'member save handler must exist');
const memberSave = dashboard.slice(memberSaveStart, memberSaveEnd);
assert.match(memberSave, /\/api\/v1\/organizations\//, 'role updates must use canonical organization API');
assert.match(memberSave, /method: 'PATCH'/, 'role updates must use canonical PATCH command');
assert.match(memberSave, /organizationRole: editingMemberRole/, 'role changes must use canonical organizationRole payload');
const profileBodyStart = memberSave.indexOf("body: JSON.stringify({", memberSave.indexOf('/profile'));
assert.ok(profileBodyStart >= 0, 'profile update payload must exist');
const profileBody = memberSave.slice(profileBodyStart, profileBodyStart + 450);
assert.equal(profileBody.includes('role:'), false, 'profile endpoint must not receive role mutations');
assert.equal(profileBody.includes('appRole:'), false, 'profile endpoint must not receive app-role mutations');

const removalStart = dashboard.indexOf('const handleRemoveMember');
const removalEnd = dashboard.indexOf('const handleSaveMemberEdit', removalStart);
assert.ok(removalStart >= 0 && removalEnd > removalStart, 'member removal handler must exist');
const removal = dashboard.slice(removalStart, removalEnd);
assert.match(removal, /method: 'DELETE'/, 'member removal must use the canonical backend DELETE command');
assert.match(removal, /\/api\/v1\/organizations\//, 'member removal must be tenant-bound through the backend');
assert.equal(removal.includes('deleteDoc('), false, 'member removal must not mutate Firestore directly from the browser');

assert.equal(dashboard.includes('editingMemberAppRole'), false, 'Hub must not duplicate MusicScale ministry-role editing');
assert.match(dashboard, /Configurar equipe no MusicScale/, 'ministry-role editing must hand off to MusicScale');
assert.equal(dashboard.includes('alert('), false, 'Dashboard must not use native browser alerts');
assert.equal(organization.includes('alert('), false, 'Organization management must not use native browser alerts');

assert.match(login, /Não conseguimos terminar a configuração da conta/, 'login must provide profile bootstrap recovery');
assert.match(dashboard, /Não conseguimos preparar sua conta/, 'Hub must provide profile recovery');
assert.match(dashboard, /Sua organização ainda não apareceu/, 'Hub must provide organization-context recovery');

console.log('PASS Hub entry: canonical Home, no auto-app bypass, canonical member commands, no legacy settings modal, and recovery UX');
