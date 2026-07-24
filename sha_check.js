const fs = require('fs');
const crypto = require('crypto');

function getGitBlobSha(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath);
  const header = `blob ${content.length}\0`;
  const store = Buffer.concat([Buffer.from(header), content]);
  return crypto.createHash('sha1').update(store).digest('hex');
}

console.log("dummy.sh:", getGitBlobSha('dummy.sh'));
console.log("EcosystemWorkspaceHome.tsx:", getGitBlobSha('src/components/dashboard/EcosystemWorkspaceHome.tsx'));
console.log("test_mn_access_03_dashboard_projection.ts:", getGitBlobSha('scripts/test_mn_access_03_dashboard_projection.ts'));
console.log("test_ux_foundation_1b1_guided_musicscale_center.ts:", getGitBlobSha('scripts/test_ux_foundation_1b1_guided_musicscale_center.ts'));
