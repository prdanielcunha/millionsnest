import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
const workspace = readFileSync('src/components/dashboard/EcosystemWorkspaceHome.tsx', 'utf8');
const guide = readFileSync('src/components/dashboard/MusicScaleGuideCenter.tsx', 'utf8');
const organization = readFileSync('src/components/OrganizationManager.tsx', 'utf8');
const inviteModal = readFileSync('src/components/InviteModal.tsx', 'utf8');
const launcher = readFileSync('src/lib/ecosystemLauncher.ts', 'utf8');
const appExperienceRegistry = readFileSync('src/lib/appExperienceRegistry.ts', 'utf8');
const server = readFileSync('server.ts', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');
const locales = ['pt', 'en', 'es'].map(function (lang) {
  return readFileSync('src/packages/i18n/locales/' + lang + '.ts', 'utf8');
});

for (const marker of [
  'onSnapshot(orgRef',
  'onSnapshot(subscriptionRef',
  'onSnapshot(membersRef',
  'onSnapshot(joinRequestQuery',
  'onSnapshot(auditQuery'
]) {
  assert.ok(dashboard.includes(marker), 'missing realtime core listener: ' + marker);
}

for (const collectionName of ["collection(db, 'songs')", "collection(db, 'scales')", "collection(db, 'bandScales')"]) {
  assert.ok(dashboard.includes(collectionName), 'missing live MusicScale collection: ' + collectionName);
}
assert.match(dashboard, /musicscale_members/, 'MusicScale configured-member summary must be live');
assert.match(dashboard, /responseSummaryAvailable/, 'response privacy state must be explicit');
assert.match(dashboard, /responseSummaryAvailable: false/, 'response summary must default to unavailable');
assert.match(dashboard, /live\.responseSummaryAvailable = true;/, 'response summary becomes available only after a valid snapshot');
assert.match(dashboard, /live\.responseSummaryAvailable = false;[\s\S]*MusicScale response summary listener failed/, 'response listener errors must fail closed');
assert.match(dashboard, /refreshPendingInvites/, 'pending invites must refresh through the protected backend');
assert.match(dashboard, /\/api\/v1\/organizations\/.*\/invitations/, 'Hub must use protected invitation APIs');
assert.equal(dashboard.includes('onSnapshot(pendingInviteQuery'), false, 'Hub must not subscribe directly to secret invitation documents');

assert.match(workspace, /musicScaleSummary/, 'app workspace must consume real MusicScale summary');
assert.match(workspace, /Dados ao vivo/, 'MusicScale workspace must label live operational data');
assert.match(workspace, /if \(!experience\.plan\) return null;/, 'unknown app plan must remain unresolved instead of being invented');
assert.equal(workspace.includes("t('workspace.plan_starter', 'Starter')"), false, 'unknown plan fallback must not be Starter');

for (const route of ['/songs', '/scales', '/band-scales', '/users', '/profile', '/plan-usage']) {
  assert.ok(appExperienceRegistry.includes("'" + route + "'"), 'registry must safely allow MusicScale deep link: ' + route);
}
assert.match(launcher, /isAllowedAppDestinationPath/, 'launcher must validate deep links through the canonical app experience registry');
assert.match(launcher, /Destino do aplicativo inválido/, 'deep links must fail closed');
assert.match(appExperienceRegistry, /cleanPath\.includes\('\:\/\/'\)/, 'destination registry must reject absolute external URLs');
assert.match(appExperienceRegistry, /cleanPath\.includes\('\\\\'\)/, 'destination registry must reject backslash paths');

assert.equal(organization.includes('Cargos e Capabilities'), false, 'customer roles must not expose capabilities jargon');
assert.equal(organization.includes('Actor:'), false, 'customer audit must not expose raw actor IDs');
assert.equal(organization.includes('Target:'), false, 'customer audit must not expose raw metadata');
assert.equal(organization.includes('>Desativar<'), false, 'nonfunctional app disable control must not exist');
assert.match(organization, /handleLogoUpload/, 'logo selector must perform a real upload flow');
assert.match(organization, /handleReissueInvite/, 'pending invitations must support safe reissue');
assert.ok(organization.includes("onOpenMusicScale?.('/profile')"), 'MusicScale settings must open a real destination');

assert.match(inviteModal, /onEmail/, 'invites must support email');
assert.match(inviteModal, /onWhatsApp/, 'invites must support WhatsApp');
assert.match(inviteModal, /navigator\.clipboard/, 'invites must support copy link');
assert.match(inviteModal, /navigator\.share/, 'invites must support native share');
assert.match(inviteModal, /\/api\/v1\/invitations\/email/, 'email action must use the protected invite endpoint');

assert.match(server, /membershipData\.permissions\?\.\['organization\.settings\.update'\]/, 'organization updates must check settings permission');
assert.match(server, /Você não possui permissão para alterar esta organização/, 'organization update must fail closed');
assert.match(server, /\/api\/v1\/organizations\/:organizationId\/logo/, 'logo endpoint must exist');
assert.match(server, /\/api\/v1\/invitations\/email/, 'invite email endpoint must exist');
assert.match(server, /\/invitations\/:invitationId\/reissue/, 'safe invite reissue endpoint must exist');
assert.match(server, /app\.get\('\/api\/v1\/organizations\/:organizationId\/invitations'/, 'protected pending-invite endpoint must exist');
assert.match(server, /\/invitations\/:invitationId\/revoke/, 'protected invite revoke endpoint must exist');
assert.match(server, /tokenHash !== inviteData\.tokenHash/, 'email delivery must validate the raw invite URL against its stored token hash');

assert.ok(rules.includes('match /scales/{scaleId}/responses/{responseId}'), 'response reads require an explicit rule');
assert.ok(rules.includes("resource.data.get('userId', '') == request.auth.uid"), 'a member must retain access to their own response');
assert.ok(rules.includes("'canManageScales'"), 'team-wide response reads must require scale-management authority');
assert.ok(rules.includes('match /scales/{scaleId}/responseHistory/{historyId}'), 'response history must remain explicitly protected');
assert.match(rules, /match \/invites\/\{inviteId\} \{[\s\S]*allow read, create, update, delete: if false;/, 'invitation secrets must stay backend-only');

assert.match(guide, /completedByStep/, 'all onboarding steps must derive completion from live state');
assert.match(guide, /const nextStep = GUIDE_STEPS\.find/, 'onboarding must identify one next incomplete step');
assert.match(guide, /pathForStep/, 'onboarding actions must deep-link to the right MusicScale area');

for (const locale of locales) {
  for (const key of [
    'songs_title',
    'members_title',
    'responses_title',
    'live_label',
    'configured_members',
    'email_send',
    'share_failed',
    'plan_unknown'
  ]) {
    assert.ok(locale.includes(key + ':'), 'missing complete-hub i18n key: ' + key);
  }
}

console.log('PASS complete Hub: realtime, app summary, safe administration, invitations, registry-backed deep links and privacy');
