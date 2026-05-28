import { ecosystemPlatform } from '../sdk/ecosystem.js';
import { ECOSYSTEM_APPS } from './apps.js';

export async function openEcosystemModule(
  moduleKey: string,
  user: any,
  profile: any,
  organization: any,
  currentUserPerms: Record<string, boolean>
) {
  if (!user || !organization || !profile) {
    console.error('[EcosystemLaunch] Missing required data', { hasUser: !!user, hasOrg: !!organization, hasProfile: !!profile });
    alert("Não foi possível iniciar o MusicScale agora. Verifique sua sessão.");
    return;
  }

  const app = ECOSYSTEM_APPS.find(a => a.id === moduleKey);
  if (!app) {
     console.error('[EcosystemLaunch] App not found', { moduleKey });
     alert("Aplicativo não encontrado.");
     return;
  }

  console.debug('[EcosystemLaunch] Starting module launch', { moduleKey, uid: user.uid, orgId: organization.id });
  
  try {
     await ecosystemPlatform.launchModule(app.id, app.url, user, profile, organization, currentUserPerms || {});
  } catch (e: any) {
    console.error('[EcosystemLaunch] Failed to launch', e);
    alert(`Não foi possível iniciar o ${app.name} agora: ${e.message || 'Erro desconhecido'}`);
  }
}
