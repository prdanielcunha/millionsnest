# MillionsNest Action OS — Product Blueprint 2026

**Status:** strategic foundation approved for validation  
**Date:** 2026-09-08  
**Scope:** MillionsNest Hub first, church-first go-to-market, architecture extensible to other organizations later.

## 1. Product decision

MillionsNest should not become another generic ChMS and should not launch a generic "AI for churches" product.

The opportunity is to evolve the Hub into an **Action OS**: a layer above the ecosystem that detects operational signals, turns them into clear next actions, assigns responsibility, tracks resolution and helps leaders avoid forgotten people, tasks and preparation gaps.

Core promise:

> **MillionsNest helps the organization see what needs attention now — and act before something or someone falls through the cracks.**

Churches are the first and primary market. The architecture must remain organization-generic enough to support future vertical packs (ministries, missions, nonprofits and other community organizations), but no generic positioning should be launched before church product-market fit.

## 2. Why this belongs in the Hub

The current repository already defines MillionsNest as Auth Central, Billing Central, Organization Central and App Launcher.

The Action OS should become a new orchestration layer in the Hub, not a separate billing/auth/tenant stack.

Existing products remain specialists:
- MusicScale: worship/music team signals.
- NestJourney: people/journey/follow-up signals.
- Connect: conversation and relationship signals.
- NestFinance: authorized operational/administrative signals.
- Future apps: expose signals through the same contract.

The Hub becomes the place where the organization sees:
- what needs attention;
- why it appeared;
- who owns it;
- what can be done now;
- what was resolved;
- what was delegated, snoozed or dismissed.

## 3. UX principle

The primary Hub experience should move from an app-launcher mindset toward:

### Hoje

A premium, calm, highly legible workspace that prioritizes action over dashboards.

Example cards:
- 3 visitors have not received follow-up.
- 2 musicians have not confirmed the next service.
- 4 conversations are waiting for a reply.
- 1 journey step is overdue.
- 1 event has no responsible person.

Every action must show:
- human-readable reason;
- source app;
- organization;
- priority;
- due/age information when relevant;
- responsible person when assigned;
- primary action;
- secondary actions: delegate, snooze, dismiss with reason;
- audit history.

No technical event names are shown to end users.

## 4. Progressive disclosure

### Simple mode
For pastors, volunteers and non-technical users.
- Today's attention list.
- Clear actions.
- Large touch targets.
- Minimal jargon.
- Explain why each item exists.

### Advanced mode
For admins/leaders.
- filters;
- source apps;
- ownership;
- policies;
- thresholds;
- action rules;
- analytics;
- audit;
- integration health.

Do not expose engineering concepts in the simple experience.

## 5. MVP — Phase 1

The first MVP must validate one hypothesis only:

> Do leaders repeatedly use a unified action feed to solve work they otherwise would have forgotten or discovered too late?

Initial action types:
1. MusicScale: upcoming scale with pending confirmations.
2. Generic Hub: pending invitations / organization tasks already supported by current data.
3. NestJourney signal adapter when its data contract is available.
4. Connect unanswered-conversation signal adapter when its data contract is available.
5. Manual action created by an authorized leader.

The first release does **not** require generative AI.

## 6. Core domain model

All records are tenant-scoped.

Organization-level action lifecycle (future persistent/manual/assigned actions):
```
organizations/{organizationId}/actionCenter/{actionId}
```

User-scoped interaction preferences for derived actions:
```
organizations/{organizationId}/actionCenterUsers/{uid}/preferences/{preferenceId}
```

Persistent action:
- id
- organizationId
- type
- sourceApp
- sourceEntityType
- sourceEntityId
- titleKey / localized title payload
- descriptionKey / localized description payload
- status: open | in_progress | resolved
- priority: low | normal | high | urgent
- ownerUid | null
- createdAt
- updatedAt
- dueAt | null
- resolvedAt | null
- resolvedByUid | null
- fingerprint
- dedupeKey
- metadata (strict allowlist, non-sensitive where possible)
- visibilityScope / requiredPermission
- policyVersion

Derived-action preference:
- actorUid (always server-derived)
- dedupeKey
- fingerprint
- mode: snoozed | dismissed
- snoozedUntil | null
- createdAt
- updatedAt

Action history for persistent/manual actions:
```
organizations/{organizationId}/actionCenter/{actionId}/history/{eventId}
```

Important lifecycle rule:
- derived actions are source-driven and are not marked resolved merely because a user clicks a button;
- they disappear when the underlying condition is actually resolved;
- snooze/dismiss are initially user-scoped so one leader cannot hide an issue for everyone;
- when an action fingerprint changes materially, a previous snooze/dismiss no longer suppresses it.

History events for persistent/manual actions:
- created
- assigned
- reassigned
- started
- reopened
- resolved
- source_changed

## 7. Signal contract

Apps should not write arbitrary UI cards directly.

They should expose or produce normalized signals through an adapter contract.

Conceptually:

```ts
type EcosystemSignal = {
  organizationId: string;
  sourceApp: string;
  signalType: string;
  sourceEntityType: string;
  sourceEntityId: string;
  occurredAt: number;
  dedupeKey: string;
  payload: Record<string, unknown>;
};
```

A deterministic policy layer converts signals into actions.

This prevents UI coupling, duplicate cards and vendor-specific logic in the Hub.

## 8. Deterministic first, AI later

Phase 1 should use deterministic rules.

Examples:
- scale starts within configured window AND pending responses > 0 -> open action.
- visitor age > follow-up threshold AND no completed follow-up -> open action.
- incoming conversation unanswered beyond threshold -> open action.
- journey step overdue -> open action.
- organization item requires owner AND owner missing -> open action.

AI is optional in later phases for:
- concise summaries;
- suggested wording;
- prioritization assistance;
- natural-language search;
- explanation of trends;
- grouping related actions.

AI must never be final authority for permissions, financial operations, sensitive pastoral conclusions or spiritual scoring.

## 9. Privacy and pastoral safety

Religious affiliation and pastoral context can be sensitive personal data.

Non-negotiables:
- strict organization isolation;
- backend/rules authorization;
- permission-scoped action visibility;
- audit trail;
- data minimization;
- no spiritual score;
- no "faith risk score";
- no pastoral diagnosis;
- no tithe/offering data used to infer spirituality, engagement or pastoral risk;
- financial signals remain administrative and visible only to authorized roles;
- dismissal and resolution reasons must avoid unnecessary sensitive free text where possible.

## 10. Internationalization

All user-facing text must support:
- pt-BR
- en
- es

Action types should use translation keys, not hardcoded customer-facing Portuguese in domain records.

## 11. Cost strategy

Goal: validate with near-zero incremental cost.

Phase 1:
- reuse existing Firebase/Auth/Firestore architecture;
- no external generative AI API required;
- no WhatsApp paid messaging required;
- no new billing stack;
- no new standalone backend if current architecture can safely support the action read model.

Paid infrastructure is introduced only after demand proves it is necessary.

## 12. Commercial positioning

Do not market the MVP as "AI for church".

Lead with outcomes:
- no visitor forgotten;
- no important follow-up lost;
- no preparation gap hidden;
- no leader forced to search five apps to know what needs attention.

Potential product language:
- "Tudo que precisa da sua atenção, em um só lugar."
- "Menos coisas esquecidas. Mais pessoas cuidadas."
- "Do dado à ação."

Final commercial naming is deliberately not locked by this document.

## 13. Competitive strategy

Do not compete by duplicating full ChMS feature sets.

Differentiators to validate:
1. action-first UX rather than dashboard-first;
2. extremely simple church-native experience;
3. ecosystem-native context;
4. interoperability path for external stacks;
5. deterministic reliability before AI;
6. safe, explainable action generation;
7. PT/EN/ES from foundation;
8. mobile-first / desktop-excellent premium design;
9. progressive disclosure for volunteers vs administrators.

## 14. Future interoperability

Native MillionsNest apps should provide the best experience, but future architecture must allow external adapters.

Priority should be decided by real customer usage, not by feature-count competition.

Potential future adapter classes:
- church management platforms;
- calendar;
- messaging;
- forms;
- giving/finance summaries where legally and ethically appropriate;
- event systems.

No external integration should be added before a validated customer need.

## 15. MVP success metrics

Validation gate:
- 10 real organizations in pilot;
- repeated weekly use;
- measurable action resolution from the feed;
- meaningful percentage of detected actions handled before their original deadline;
- leaders report that the feed surfaces work they would otherwise miss;
- at least 5 pilot organizations willing to pay to keep the capability.

Primary product metrics:
- actions surfaced;
- actions resolved;
- time-to-action;
- time-to-resolution;
- resolution before due date;
- actions delegated;
- recurring weekly active leaders;
- source signal quality;
- false-positive rate;
- duplicate-action rate.

## 16. Anti-goals

Do not:
- rebuild a full church management system;
- add unrelated modules;
- redesign billing/auth/RBAC;
- add spiritual scoring;
- use financial behavior as a pastoral engagement score;
- introduce generative AI merely for marketing;
- require every MillionsNest product for the feature to work;
- force migration from other church platforms at launch;
- add expensive infrastructure before validation.

## 17. Technical implementation sequence

### Slice 0 — repository audit
- map current Dashboard / EcosystemWorkspaceHome;
- map current MusicScale summary and access projection;
- map audit/event primitives;
- locate current i18n setup;
- identify existing tests;
- design action contract without changing critical auth/billing flows.

### Slice 1 — local/read-only action projection
- create normalized action types;
- derive first MusicScale pending-confirmation action from data already loaded by Hub;
- render a non-persistent "Hoje" preview;
- no Firestore schema change yet;
- no backend critical change.

### Slice 2 — interaction state
- user-scoped snooze/dismiss for derived actions;
- source-driven resolution semantics (no false "resolved" state);
- fingerprint-aware resurfacing when a signal materially changes;
- tenant-scoped persistence behind authenticated backend commands;
- assignment/manual-action lifecycle only after the derived-action interaction model is stable;
- audit history for persistent organization-level actions;
- tests and explicit backend authorization.

### Slice 3 — adapter boundary
- extract source adapters;
- preserve deterministic policies;
- add second source only after Slice 1/2 are stable.

### Slice 4 — pilot analytics
- action quality;
- false positives;
- resolution rates;
- feedback.

### Slice 5 — intelligence assistance
Only after product behavior is proven:
- summaries;
- suggested replies;
- prioritization suggestions;
- natural-language query.

## 18. Engineering constraints from current repository

Must preserve:
- React/Vite/Tailwind design system;
- existing AuthContext and OrganizationContext behavior;
- EcosystemAccessResolver contracts;
- centralized billing/Stripe;
- membership and RBAC;
- Firestore tenant isolation;
- current app handoff flows;
- current main/production discipline;
- existing tests and source-of-truth hierarchy.

Do not modify critical files casually.

## 19. Development workflow

Current workflow for this initiative:
- ChatGPT Plus for architecture, product analysis, review and orchestration;
- Codex when implementation depth or repository changes require it;
- GitHub as source of truth;
- small reversible changes;
- main for development/homologation according to project policy;
- production only after evidence and approval.

No Google AI Studio dependency.

## 20. Current implementation state

The Hub already has a premium **Hoje / Today / Hoy** section backed by deterministic, permission-scoped signals. It currently covers organization readiness, pending invitations and MusicScale pending confirmations.

User-scoped snooze/dismiss interaction state is also implemented behind authenticated backend commands. A source condition is never falsely marked resolved by a UI click, and materially changed fingerprints resurface automatically.

The first **Commitments** lane is now implemented in `main`: normal participation that matters to the current user but is not a problem. Its first adapter projects the authenticated user's next MusicScale assignment from data already loaded by the Hub, without a new collection or paid service.

Personal responsibility on top of that commitment is also implemented in `main`. A MusicScale assignment can therefore produce two different truths at the same time:
- **Commitment:** “you are scheduled”;
- **Action:** “you still need to confirm”.

Leader-wide pending confirmations remain a third, separate responsibility. This prevents a pastor who is also a musician from losing either their personal task or their leadership view.

The next semantic lane under certification is **Changes**. The first adapter consumes only recipient-scoped `music_scale_changed` notifications produced by MusicScale itself, including its deterministic `preparationChangeSummary`. The Hub does not infer changes from timestamps or guess what changed.

## 21. Semantic lanes: Actions, Commitments and Changes

The Hub must not flatten every fact into an alert. The product language is:

### Actions — “Hoje”
Something requires an intervention.

Examples:
- a scale has pending confirmations;
- an invitation is still incomplete;
- organization setup is missing;
- a future app detects an overdue follow-up.

Actions may be snoozed or hidden by the current user, but source truth always wins.

### Commitments — “O que vem a seguir para você”
The current user is expected to participate in something, even when everything is healthy.

Examples:
- a musician is scheduled for the next service;
- a leader has a confirmed meeting or duty;
- a future NestJourney user has a scheduled discipleship session.

Commitments are informational and should never be presented as operational failure.

### Changes — “O que mudou recentemente”
Previously known truth changed materially and the user may need to review it. The first MusicScale adapter is implemented behind the current certification branch.

Examples:
- repertoire/key/order changed after preparation;
- event time/location changed;
- responsibility changed.

Changes only enter the Hub when the source app exposes an exact, permission-safe, user-relevant change contract. The Hub does not infer a change from timestamps or revision counters alone.

For MusicScale:
- the source is the user's own `music_scale_changed` notification;
- `preparationChangeSummary.codes` supplies the factual change categories;
- `functionsChanged` covers assignment-function changes;
- the Hub shows only recent changes (14-day horizon, maximum 3 cards);
- clicking **Review change** marks only that source notification as read and then deep-links to MusicScale for exact details;
- another organization member cannot read the notification merely because they belong to the same tenant.

This separation is a core product invariant. It reduces alert fatigue and lets MillionsNest become an operational layer without turning normal church life into a list of “problems”.

## 22. Immediate next step

1. Certify and merge the private MusicScale **Changes** adapter and notification-rule hardening into `main`.
2. Keep exact song-level review inside MusicScale; the Hub summarizes only source-owned change categories and deep-links to the specialist app.
3. Add lightweight Action OS quality telemetry for pilot validation (surfaced/opened/snoozed/dismissed, without sensitive pastoral inference) before expanding to another app.
4. Add the next source only when NestJourney, Connect or another product exposes a factual signal/commitment/change contract; do not hardcode app-specific UI cards.
5. Validate weekly use with real organizations before adding generative intelligence or expensive infrastructure.

### Current invariant for the same event

One event may appear in more than one semantic lane only when the meanings are different:

- **Hoje:** “I must do something.”
- **Compromissos:** “I am participating.”
- **Leadership action:** “My team needs something from me.”
- **Mudanças:** “Something I previously knew changed.”

That is intentional context, not duplicated UI.
