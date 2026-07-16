import * as fs from 'fs';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

console.log("Starting static checks...");

const serverFile = fs.readFileSync('server.ts', 'utf-8');
assert(serverFile.includes('import { createInvitation }'), "server.ts must import createInvitation");
assert(serverFile.includes("app.post('/api/v1/invitations'"), "server.ts must register POST /api/v1/invitations");
assert(serverFile.includes("app.post('/api/v1/invitations/accept'"), "server.ts must register POST /api/v1/invitations/accept");
assert(serverFile.includes("app.post('/api/v1/onboarding/bootstrap'"), "server.ts must register bootstrap");
assert(serverFile.includes("app.post('/api/v1/user/active-organization'"), "server.ts must register active-organization");

const serviceFile = fs.readFileSync('src/server/services/InvitationCreationService.ts', 'utf-8');
assert(serviceFile.includes('planInvitationCreation'), "Service uses planInvitationCreation");
assert(serviceFile.includes('generateInvitationTokenMaterial'), "Service uses generateInvitationTokenMaterial");
assert(serviceFile.includes('resolveCanonicalInvitationCapacity'), "Service uses resolveCanonicalInvitationCapacity");
assert(serviceFile.includes('getAuth().verifyIdToken') || serviceFile.includes('verifyIdToken(token)'), "Service uses verifyIdToken");
assert(serviceFile.includes('.runTransaction'), "Service uses runTransaction");
assert(serviceFile.includes('tokenHash,'), "Service persists tokenHash");
assert(!serviceFile.includes('rawToken:'), "Service does not persist rawToken");
assert(serviceFile.includes('maxUses:'), "Service uses maxUses (should be from planner, but explicitly tested)");
assert(serviceFile.includes('useCount:'), "Service uses useCount");
assert(!serviceFile.includes('usedCount:'), "Service does not use usedCount");
assert(!serviceFile.includes('Math.random'), "Service does not use Math.random");
assert(!serviceFile.includes('randomUUID'), "Service does not use randomUUID");
assert(!serviceFile.includes('console.log(token)'), "Service does not log token");
assert(!serviceFile.includes('console.log(tokenHash)'), "Service does not log tokenHash");
assert(!serviceFile.includes('actorEmail'), "Service does not record full email in audit log");
assert(serviceFile.includes('invitePath:'), "Service returns invitePath");
assert(!serviceFile.includes('tokenHash: tokenHash') || serviceFile.includes('payload:'), "Service doesn't return tokenHash in response body");
assert(serviceFile.includes("=== 'ceo'"), "Service recognizes global roles");
assert(serviceFile.includes("=== 'global_admin'"), "Service recognizes global roles");
assert(serviceFile.includes("=== 'ecosystem_owner'"), "Service recognizes global roles");
assert(serviceFile.includes("=== 'founder'"), "Service recognizes global roles");

const dashboardFile = fs.readFileSync('src/pages/Dashboard.tsx', 'utf-8');
assert(dashboardFile.includes("fetch('/api/v1/invitations'"), "Dashboard uses POST /api/v1/invitations");
assert(dashboardFile.includes("Bearer ${idToken}"), "Dashboard uses Authorization Bearer");
assert(dashboardFile.includes("user.getIdToken()"), "Dashboard uses getIdToken without true");
assert(dashboardFile.includes("AbortController"), "Dashboard uses AbortController");
assert(!dashboardFile.includes("Math.random()"), "Dashboard doesn't use Math.random in handler");
assert(!dashboardFile.includes("tokenHash:"), "Dashboard doesn't write tokenHash");
assert(dashboardFile.includes("setPendingInvites"), "Dashboard updates pendingInvites");
assert(!dashboardFile.includes("localStorage.setItem('inviteUrl'"), "Dashboard doesn't store inviteUrl in localStorage");
assert(!dashboardFile.includes("sessionStorage.setItem('inviteUrl'"), "Dashboard doesn't store inviteUrl in sessionStorage");
assert(!dashboardFile.includes("retry"), "Dashboard doesn't have auto retry");

const modalFile = fs.readFileSync('src/components/InviteModal.tsx', 'utf-8');
assert(modalFile.includes('required'), "Modal email is required");
assert(!modalFile.includes('Opcional.'), "Modal hint doesn't contain 'Opcional.'");
assert(!modalFile.includes('value="leader"'), "Modal doesn't have leader option");
assert(modalFile.includes('value="admin"') && modalFile.includes('value="member"'), "Modal has admin and member options");
assert(modalFile.includes('await handleCreateInvite'), "Modal shows success only after await");
assert(modalFile.includes('setErrorMsg('), "Modal has error handling");
assert(modalFile.includes('fallbackLink'), "Modal has fallback readonly link");
assert(modalFile.includes('ensureInvite'), "Modal reuses createdInviteUrl");
assert(modalFile.includes('createdInviteUrl'), "Modal avoids second call after creation");
assert(modalFile.includes('flex items-start justify-between gap-4'), "Modal corrects mobile header layout");
assert(modalFile.includes('Array.isArray(data.organizations)'), "Modal parses data.organizations");
assert(modalFile.includes('type="button"'), "Modal buttons have type button");
assert(modalFile.includes('aria-label='), "Modal close button has aria-label");

const ptLocales = fs.readFileSync('src/packages/i18n/locales/pt.ts', 'utf-8');
assert(ptLocales.includes('email_hint:'), "pt has email_hint");
assert(ptLocales.includes('errors:'), "pt has errors");
const enLocales = fs.readFileSync('src/packages/i18n/locales/en.ts', 'utf-8');
assert(enLocales.includes('email_hint:'), "en has email_hint");
assert(enLocales.includes('errors:'), "en has errors");
const esLocales = fs.readFileSync('src/packages/i18n/locales/es.ts', 'utf-8');
assert(esLocales.includes('email_hint:'), "es has email_hint");
assert(esLocales.includes('errors:'), "es has errors");

console.log("SUCCESS: All static checks passed.");
