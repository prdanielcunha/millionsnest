import { auth } from '../lib/firebase.js';
import { ECOSYSTEM_APPS } from './apps.js';
import { resolveUserRoleDisplay } from './roleResolver.js';
import { isGlobalPrivilegedUser } from './permissionService.js';

export async function openEcosystemModule(
  moduleKey: string,
  user: any,
  profile: any,
  organization: any,
  currentUserData: any
) {
  if (!user || !organization || !profile) {
    console.error('[EcosystemLaunch] Missing required data', { hasUser: !!user, hasOrg: !!organization, hasProfile: !!profile });
    throw new Error("Sessão inválida ou dados incompletos. Tente recarregar a página.");
  }

  const app = ECOSYSTEM_APPS.find(a => a.id === moduleKey);
  if (!app) {
     console.error('[EcosystemLaunch] App not found', { moduleKey });
     throw new Error("Aplicativo não encontrado no catálogo.");
  }

  console.debug('[EcosystemLaunch] Starting module handoff launch', { moduleKey, uid: user.uid, orgId: organization.id });
  
  let attempts = 0;
  const maxAttempts = 5;
  const retryDelayMs = 3000;

  let isSupportMode = false;
  try {
     const supportStr = localStorage.getItem('mn_support_session');
     if (supportStr) {
        const supportObj = JSON.parse(supportStr);
        if (supportObj?.active && supportObj?.targetOrganizationId === organization.id) {
           isSupportMode = true;
        }
     }
  } catch (e) {}

  const attemptHandoff = async (): Promise<any> => {
    const idToken = await auth.currentUser!.getIdToken();
    const response = await fetch('/api/ecosystem/create-handoff', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ appId: moduleKey, orgId: organization.id, supportMode: isSupportMode })
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 403 && errorData.error?.includes('Subscription missing')) {
            if (attempts < maxAttempts) {
                attempts++;
                console.warn(`[EcosystemLaunch] Not ready yet, retrying in ${retryDelayMs}ms... (Attempt ${attempts}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                
                // Triggers a server-side sync request just in case
                await fetch('/api/v1/billing/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.uid })
                }).catch(() => {});
                
                return attemptHandoff();
            }
            throw new Error('Não encontramos uma assinatura ativa para esta organização. Se você acabou de assinar, estamos finalizando a ativação. Tente novamente em alguns segundos.');
        }
        
        throw new Error(errorData.error || 'Falha ao obter contexto de handoff');
    }
    
    return response.json();
  };

  try {
     const handoff = await attemptHandoff();
     
     const roleDisplay = resolveUserRoleDisplay({
       userProfile: profile,
       organizationMember: currentUserData
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
           organizationRole: roleDisplay.organizationRole,
           subscriptionPlan: organization.subscriptionPlan || organization.plan || 'none',
           subscriptionStatus: organization.subscriptionStatus || organization.status || 'none'
         },
         capabilities: {
           isGlobalPrivilegedUser: isGlobalPrivilegedUser(profile),
           canBypassBilling: isGlobalPrivilegedUser(profile),
           canUseAllFeatures: isGlobalPrivilegedUser(profile)
         },
         supportMode: isSupportMode,
         protocolVersion: '1.0.0'
     };
     
     const encodedContext = btoa(JSON.stringify(context));
     const url = new URL(app.url);
     url.searchParams.set('ecosystem_ctx', encodedContext);
     
     window.location.assign(url.toString());
  } catch (e: any) {
    console.error('[EcosystemLaunch] Failed to launch', e);
    throw new Error(`Não foi possível iniciar o ${app.name} agora: ${e.message || 'Erro desconhecido'}`);
  }
}
