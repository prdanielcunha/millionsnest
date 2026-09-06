import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
const workspace = readFileSync('src/components/dashboard/EcosystemWorkspaceHome.tsx', 'utf8');
const guide = readFileSync('src/components/dashboard/MusicScaleGuideCenter.tsx', 'utf8');
const organization = readFileSync('src/components/OrganizationManager.tsx', 'utf8');
const inviteModal = readFileSync('src/components/InviteModal.tsx', 'utf8');
const launcher = readFileSync('src/lib/ecosystemLauncher.ts', 'utf8');
const server = readFileSync('server.ts', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');
const locales = ['pt', 'en', 'es'].map(function (lang) {
  return readFileSync('src/packages/i18n/locales/' + lang + '.ts', 'utf8');
});

for (const marker of [
  'onSnapshot(orgRef',
  'onSnapshot(subscriptionRef',
  'onSnapshot(membersRef',
  'onSnapshot(pendingInviteQuery',
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

assert.match(workspace, /musicScaleSummary/, 'app workspace must consume real MusicScale summary');
assert.match(workspace, /Dados ao vivo/, 'MusicScale workspace must label live operational data');
assert.match(workspace, /Plano não identificado/, 'unknown billing state must not pretend to be Starter');
assert.equal(workspace.includes("t('workspace.plan_starter', 'Starter')"), false, 'unknown plan fallback must not be Starter');

for (const route of ['/songs', '/scales', '/band-scales', '/users', '/profile', '/plan-usage']) {
  assert.ok(launcher.includes("'" + route + "'"), 'launcher must safely allow MusicScale deep link: ' + route);
}
assert.match(launcher, /Destino do aplicativo inválido/, 'deep links must fail closed');

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
assert.match(server, /tokenHash !== inviteData\.tokenHash/, 'email delivery must validate the raw invite URL against its stored token hash');

assert.ok(rules.includes('match /scales/{scaleId}/responses/{responseId}'), 'response summary reads require an explicit rule');
assert.ok(rules.includes('isOrgAdmin(get(/databases/$(database)/documents/scales/$(scaleId))'), 'response details must remain admin-scoped');

assert.match(guide, /completedByStep/, 'all onboarding steps must derive completion from live state');
assert.match(guide, /nextStepId/, 'onboarding must identify one next step');
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

console.log('PASS complete Hub: realtime, app summary, safe administration, invitations, deep links and privacy');
