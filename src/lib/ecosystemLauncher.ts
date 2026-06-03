import { auth } from '../lib/firebase.js';
import { ECOSYSTEM_APPS } from './apps.js';
import { resolveUserRoleDisplay } from './roleResolver.js';
import { isGlobalPrivilegedUser } from './permissionService.js';

export async function openEcosystemModule(
  moduleKey: string,
  user: any,
  profile: any,
  organization: any,
  currentUserPerms: Record<string, boolean>
) {
  if (!user || !organization || !profile) {
    console.error('[EcosystemLaunch] Missing required data', { hasUser: !!user, hasOrg: !!organization, hasProfile: !!profile });
    alert("Não foi possível iniciar o aplicativo agora. Verifique sua sessão.");
    return;
  }

  const app = ECOSYSTEM_APPS.find(a => a.id === moduleKey);
  if (!app) {
     console.error('[EcosystemLaunch] App not found', { moduleKey });
     alert("Aplicativo não encontrado.");
     return;
  }

  console.debug('[EcosystemLaunch] Starting module handoff launch', { moduleKey, uid: user.uid, orgId: organization.id });
  
  try {
     const idToken = await auth.currentUser!.getIdToken();
     const response = await fetch('/api/ecosystem/create-handoff', {
         method: 'POST',
         headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${idToken}`
         },
         body: JSON.stringify({ appId: moduleKey, orgId: organization.id })
     });
     
     if (!response.ok) {
         const errorData = await response.json();
         throw new Error(errorData.error || 'Falha ao obter contexto de handoff');
     }
     
     const handoff = await response.json();
     
     const roleDisplay = resolveUserRoleDisplay({
       userProfile: profile,
       organizationMember: { role: currentUserPerms?.owner ? 'owner' : (currentUserPerms?.admin ? 'admin' : 'member') } // approximate org role from perms if actual role not passed
     });

     const context = {
         appId: moduleKey,
         orgId: handoff.orgId,
         userId: handoff.uid,
         customToken: handoff.customToken,
         expiresAt: handoff.expiresAt,
         user: {
           uid: user.uid,
           email: user.email,
           displayName: user.displayName,
           systemRole: profile.systemRole || 'user',
           roleDisplay
         },
         organization: {
           id: organization.id,
           name: organization.name,
           organizationRole: roleDisplay.organizationRole
         },
         capabilities: {
           isGlobalPrivilegedUser: isGlobalPrivilegedUser(profile),
           canBypassBilling: isGlobalPrivilegedUser(profile),
           canUseAllFeatures: isGlobalPrivilegedUser(profile)
         },
         protocolVersion: '1.0.0'
     };
     
     const encodedContext = btoa(JSON.stringify(context));
     const url = new URL(app.url);
     url.searchParams.set('ecosystem_ctx', encodedContext);
     
     window.location.assign(url.toString());
  } catch (e: any) {
    console.error('[EcosystemLaunch] Failed to launch', e);
    alert(`Não foi possível iniciar o ${app.name} agora: ${e.message || 'Erro desconhecido'}`);
  }
}
