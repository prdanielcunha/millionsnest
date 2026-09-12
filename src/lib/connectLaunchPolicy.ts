import {
  buildEcosystemLoginPath,
  resolveCanonicalEcosystemOrganizationId,
  resolveSafeEcosystemPostLoginPath,
} from './ecosystemLaunchPolicy.js';

export const CONNECT_OFFICIAL_URL = 'https://connect.millionsnest.com';
export const CONNECT_HUB_LAUNCH_PATH = '/connect/launch';

/** Backward-compatible name now backed by the ecosystem-wide allowlist. */
export function resolveSafePostLoginPath(search: string): string | null {
  return resolveSafeEcosystemPostLoginPath(search);
}

export function buildConnectLoginPath(): string {
  return buildEcosystemLoginPath('connect');
}

export function resolveCanonicalConnectOrganizationId(
  canonicalContext: any,
): string | null {
  return resolveCanonicalEcosystemOrganizationId(canonicalContext);
}
