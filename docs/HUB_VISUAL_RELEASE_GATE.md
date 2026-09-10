# MillionsNest Hub — Visual Release Gate

Status: **required before commercial-ready certification**.

The Hub is not considered ready for sale merely because build, TypeScript and domain tests pass. Customer-facing UI must also survive realistic content and viewport pressure.

## Mandatory surfaces

- Public MillionsNest home and navigation.
- `/musicscale` sales landing, product proof and guided demo.
- Login / join / invitation flows.
- Checkout, billing success and payment/cancellation states.
- Hub overview, Actions/Hoje, Commitments and Changes.
- App launcher and organization switcher.
- Account/profile management.
- Organization administration: settings, members & invitations, roles & permissions, applications, subscription entry point, activity/security.
- Invite modal, member edit and ownership transfer states.
- Ecosystem admin data tables and diagnostics.

## Viewport matrix

Every release candidate must be checked at approximately 320, 390, 430, 768/834, 1024, 1280 and 1440 CSS pixels. Test long names, long e-mails, long organization names, PT/EN/ES, one item and many items.

## Non-negotiable rules

1. No unintended page-level horizontal scroll.
2. No clipped primary action.
3. Human identity never collapses into one-character-per-line text.
4. Controls wrap independently from identity.
5. Primary touch actions remain approximately 40–44 px high.
6. Modals are bounded by `100dvh` and safe-area aware on mobile.
7. Tables either adapt or live inside explicit horizontal overflow containers.
8. Destructive actions are visually distinct from routine role/settings controls.
9. Technical IDs may wrap aggressively only inside explicitly technical/admin detail areas.
10. A structural regression test accompanies every discovered visual failure.

## Current P0 regression

The Members & Invitations view previously changed to a horizontal member row at the viewport-level `sm` breakpoint while the administration sidebar had already consumed a large portion of the usable width. The identity column then shrank to only a few pixels and `break-all` rendered names/e-mails as vertical characters. The release gate now requires identity and controls to occupy separate regions and forbids `break-all` for member e-mail.

## Certification rule

Structural CI is necessary but not sufficient. Before promoting a visual release to production, review the affected surfaces in a real browser at the viewport matrix above. If any primary customer path looks improvised, crowded, clipped or materially inconsistent with `DESIGN_LANGUAGE.md`, the release remains blocked.
