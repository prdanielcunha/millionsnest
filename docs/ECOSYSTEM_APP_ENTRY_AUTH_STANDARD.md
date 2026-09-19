# MillionsNest — Canonical App Entry & Authentication Standard

Status: CANÔNICO / DIRETRIZ VIGENTE
Version: 1.0
Date: 2026-09-19
Scope: MillionsNest Hub and every present or future ecosystem app

## 1. Product rule

Every standalone MillionsNest product must be easy to open directly from its own domain, installed PWA, home-screen shortcut, bookmark, notification or deep link.

A user must not be forced to visit the Hub only to restore a normal expired session.

The expected entry flow is:

1. open the app;
2. if a valid local session exists, continue immediately;
3. otherwise show a native app login surface;
4. primary action: Continue with Google;
5. secondary recovery action: Open MillionsNest / enter through Hub;
6. authenticate identity;
7. resolve organization and access using canonical MillionsNest authority;
8. if exactly one eligible organization exists, enter it automatically;
9. if more than one eligible organization exists, show an organization chooser;
10. preserve the requested safe return path;
11. if the account is not eligible, explain what happened and offer Switch account / Open MillionsNest / Request access where supported.

## 2. Architectural rule

Authentication and authorization are separate concerns.

- Firebase Authentication / Google proves WHO the person is.
- MillionsNest Hub canonical data decides WHAT the person may access.
- Google sign-in alone must never grant application permissions.
- Client-provided organizationId, role, permissions, scopes, e-mail, UID aliases or URL parameters are never authorization.
- Global authority comes only from the canonical system-role contract.
- Organization authority comes from canonical membership plus app entitlement/access policy.
- All sensitive writes and privileged reads remain protected server-side or by certified Firestore Rules.
- Products must not create parallel users, memberships, organizations, subscriptions, entitlements or RBAC sources.

## 3. Supported entry paths

Every app must support both paths without creating two identity systems.

### A. Direct app entry
Own domain/PWA -> local Firebase session -> Google if needed -> canonical app access resolution -> organization selection if needed -> app.

### B. Hub handoff
Hub -> canonical access resolution -> short-lived handoff/custom token -> app -> revalidation -> app.

Both paths converge on the same canonical authorization decision.

## 4. UX requirements

The login surface belongs visually to the product being opened. It should not look like an infrastructure screen.

Required behavior:
- product logo/name;
- short human sentence such as “Entre para continuar”;
- primary “Continuar com Google”;
- explicit “Usar outra conta” behavior where relevant;
- secondary “Abrir MillionsNest” recovery;
- loading state that says what is happening;
- no dead end;
- no raw auth/internal error codes as primary copy;
- account without access gets a useful recovery path;
- safe deep-link/returnTo is preserved;
- mobile/PWA first;
- PT/EN/ES from the first implementation.

## 5. Organization selection

After identity is authenticated:
- zero eligible organizations: access/recovery screen;
- one eligible organization: enter automatically;
- multiple eligible organizations: “Onde você quer trabalhar?” chooser;
- remember last valid organization as a preference only, never as authorization;
- revalidate remembered organization before use;
- CEOs/global admins may receive cross-organization navigation according to canonical global policy.

## 6. Session behavior

- Prefer Firebase browser persistence suitable for installed/PWA usage.
- A restored valid session should not flash a login page.
- Expired/revoked sessions recover through the app login surface.
- “Switch account” must sign out the local Firebase session before starting Google account selection.
- Logout clears app-local cached tenant/session context.
- A direct login must never depend on a Hub browser cookie being present.

## 7. Security invariants

Non-negotiable:
- fail closed;
- server-side/certified-Rules authorization;
- tenant isolation;
- entitlement validation;
- membership status validation;
- active organization validation;
- no hardcoded privileged e-mail/UID bypass;
- no role elevation from client claims;
- no raw handoff credential retained in browser history;
- no permanent cross-app credential in query strings;
- no authorization from localStorage/sessionStorage;
- safe allowlisted return paths only;
- audit security-sensitive transitions where the product contract requires it.

## 8. Current ecosystem conformance

- MillionsNest Hub: native Google login is the canonical identity home.
- MusicScale: native Google entry already exists; authorization must continue to converge on MillionsNest canonical context.
- NestLocal: native Google entry already exists; API authorization remains server-side and organization-scoped.
- NestFinance: must support native Google entry plus Hub handoff, converging on the canonical NestFinance resolver.
- NestJourney: must support native Google entry plus Hub handoff; Firestore Rules/canonical membership remain the authorization boundary.
- MillionsNest Connect: direct entry is required for the live product; until its direct-session bootstrap is certified, Hub handoff remains an allowed fallback but not the desired final UX.

## 9. Future app Definition of Done

No new MillionsNest app is considered production-ready unless:
- its own URL/PWA can recover authentication without forcing a manual Hub round-trip;
- Google identity entry is available unless a documented product/security exception is approved;
- Hub handoff is supported when the app participates in Hub launch;
- direct and Hub entry converge on the same authorization source;
- multiple organizations are handled correctly;
- account switching is recoverable;
- PT/EN/ES login/recovery copy exists;
- mobile and desktop flows are tested;
- expired, revoked, wrong-account and no-access states are tested;
- app launch has automated regression coverage.

## 10. Governing principle

The Hub is the ecosystem authority, not a usability toll gate.

Products should feel independently excellent while sharing one identity, one organization model, one entitlement model and one authorization truth.
