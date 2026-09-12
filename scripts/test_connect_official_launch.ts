import {
  CONNECT_HUB_LAUNCH_PATH,
  CONNECT_OFFICIAL_URL,
  buildConnectLoginPath,
  resolveCanonicalConnectOrganizationId,
  resolveSafePostLoginPath,
} from '../src/lib/connectLaunchPolicy.js';

let passed = 0;
function assert(value: unknown, message: string) {
  if (!value) throw new Error(message);
  passed += 1;
}

assert(CONNECT_OFFICIAL_URL === 'https://connect.millionsnest.com', 'Connect official URL is canonical');
assert(CONNECT_HUB_LAUNCH_PATH === '/connect/launch', 'Hub launch route is fixed');
assert(buildConnectLoginPath() === '/login?next=%2Fconnect%2Flaunch', 'login return path is encoded and internal');
assert(resolveSafePostLoginPath('?next=%2Fconnect%2Flaunch') === '/connect/launch', 'Connect launch return is allowed');
assert(resolveSafePostLoginPath('?next=https%3A%2F%2Fevil.example') === null, 'external login return is rejected');
assert(resolveSafePostLoginPath('?next=%2F%2Fevil.example') === null, 'protocol-relative login return is rejected');
assert(resolveSafePostLoginPath('?next=%2Fdashboard%2Foverview') === null, 'unrelated internal return is rejected by narrow policy');
assert(resolveCanonicalConnectOrganizationId({ activeOrganizationId: ' org-1 ' }) === 'org-1', 'canonical active organization is normalized');
assert(resolveCanonicalConnectOrganizationId({}) === null, 'launch fails closed without canonical active organization');

console.log(`✅ Connect official launch policy: ${passed} / 9`);
