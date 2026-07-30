#!/bin/bash
set -x
npm run lint
npx tsx scripts/test_mn_access_02_musicscale_handoff.ts
npx tsx scripts/test_mn_access_03_dashboard_projection.ts
npx tsx scripts/test_mn_access_04_launcher_contract.ts
npx tsx scripts/test_mn_connect_01_catalog_contract.ts
npx tsx scripts/test_mn_connect_02_brand_catalog.ts
npx tsx scripts/test_ux_foundation_1b1_guided_musicscale_center.ts
npm run build
