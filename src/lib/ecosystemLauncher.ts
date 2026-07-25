export interface EcosystemLauncherDependencies {
  getIdToken: () => Promise<string>;
  fetchFn: typeof fetch;
  sleep: (milliseconds: number) => Promise<void>;
  assign: (url: string) => void;
  now: () => number;
  readSupportSession: () => string | null;
  markPerformance: (name: string) => void;
}

export async function openEcosystemModule(
  moduleKey: string,
  user: any,
  profile: any,
  organization: any,
  currentUserData: any,
  injectedDependencies?: Partial<EcosystemLauncherDependencies>
) {
  if (!user || typeof user !== 'object' || typeof user.uid !== 'string' || user.uid.trim() === '') {
    console.error('[EcosystemLaunch] Missing required user data');
    throw new Error("Sessão inválida ou dados incompletos. Tente recarregar a página.");
  }
  if (!organization || typeof organization !== 'object' || typeof organization.id !== 'string' || organization.id.trim() === '') {
    console.error('[EcosystemLaunch] Missing required organization data');
    throw new Error("Sessão inválida ou dados incompletos. Tente recarregar a página.");
  }

  const expectedUid = user.uid.trim();
  const expectedOrganizationId = organization.id.trim();

  let ECOSYSTEM_APPS: any[] = [];
  try {
    const mod = await import('./apps.js');
    ECOSYSTEM_APPS = mod.ECOSYSTEM_APPS || [];
  } catch (e) {
    ECOSYSTEM_APPS = [{ id: 'musicscale', url: 'https://musicscale.millionsnest.com/start' }];
  }
  const app = ECOSYSTEM_APPS.find(a => a.id === moduleKey);
  if (!app) {
     console.error('[EcosystemLaunch] App not found', { moduleKey });
     throw new Error("Aplicativo não encontrado no catálogo.");
  }

  const deps: EcosystemLauncherDependencies = {
    getIdToken: injectedDependencies?.getIdToken || (async () => {
      const { auth } = await import('../lib/firebase.js');
      if (!auth || !auth.currentUser) throw new Error("Usuário não autenticado");
      return await auth.currentUser.getIdToken();
    }),
    fetchFn: injectedDependencies?.fetchFn || globalThis.fetch.bind(globalThis),
    sleep: injectedDependencies?.sleep || ((ms) => new Promise(resolve => setTimeout(resolve, ms))),
    assign: injectedDependencies?.assign || ((url) => window.location.assign(url)),
    now: injectedDependencies?.now || (() => Date.now()),
    readSupportSession: injectedDependencies?.readSupportSession || (() => {
      try { return localStorage.getItem('mn_support_session'); } catch (e) { return null; }
    }),
    markPerformance: injectedDependencies?.markPerformance || ((name) => {
      window.performance?.mark?.(name);
    })
  };

  let isSupportMode = false;
  try {
     const supportStr = deps.readSupportSession();
     if (supportStr) {
        const supportObj = JSON.parse(supportStr);
        if (supportObj?.active && supportObj?.targetOrganizationId === expectedOrganizationId) {
           isSupportMode = true;
        }
     }
  } catch (e) {}

  deps.markPerformance('handoff_started');
  const idToken = await deps.getIdToken();

  let handoff: any = null;
  const maxRequests = 2;
  for (let attempt = 1; attempt <= maxRequests; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    let response;
    try {
      response = await deps.fetchFn('/api/ecosystem/create-handoff', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ appId: moduleKey, orgId: expectedOrganizationId, supportMode: isSupportMode }),
          signal: controller.signal
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Tempo limite esgotado. Verifique sua conexão e tente novamente.');
      }
      throw new Error('Não foi possível preparar o acesso ao MusicScale.');
    }
    
    clearTimeout(timeoutId);
    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch (e) {}
      if (errorData.retryable === true && attempt < maxRequests && [403, 500, 503].includes(response.status)) {
        await deps.sleep(1000);
        continue;
      }
      
      if (response.status === 401) {
        throw new Error('Sua sessão expirou. Entre novamente e tente abrir o MusicScale.');
      } else if (response.status === 403) {
        if (errorData.reason === 'SUBSCRIPTION_PAYMENT_REQUIRED') {
          throw new Error('Existe uma pendência no pagamento desta organização.');
        } else {
          throw new Error('Não encontramos um acesso ativo ao MusicScale para esta organização.');
        }
      } else if (response.status === 500 || response.status === 503) {
        throw new Error('O MusicScale está temporariamente indisponível. Tente novamente em instantes.');
      } else {
        throw new Error('Não foi possível preparar o acesso ao MusicScale.');
      }
    }
    
    try {
      handoff = await response.json();
    } catch(e) {
      throw new Error('A resposta de acesso ao MusicScale é inválida. Tente novamente.');
    }
    
    break;
  }

  const validationNow = deps.now();

  if (!handoff || typeof handoff !== 'object' || 
       handoff.appId !== 'musicscale' || 
       handoff.protocolVersion !== '1.0.0' || 
       handoff.orgId !== expectedOrganizationId || 
       handoff.uid !== expectedUid || 
       !handoff.customToken || typeof handoff.customToken !== 'string' || handoff.customToken.trim() === '' || handoff.customToken.length > 16384 ||
      typeof handoff.expiresAt !== 'number' || !Number.isFinite(handoff.expiresAt) || 
       handoff.expiresAt <= validationNow || handoff.expiresAt > validationNow + 600000 ||
      typeof handoff.supportMode !== 'boolean') {
    throw new Error('A resposta de acesso ao MusicScale é inválida. Tente novamente.');
  }

  deps.markPerformance('handoff_completed');

  const context = {
      appId: handoff.appId,
      orgId: handoff.orgId,
      userId: handoff.uid,
      customToken: handoff.customToken,
      expiresAt: handoff.expiresAt,
      supportMode: handoff.supportMode,
      protocolVersion: handoff.protocolVersion
  };
  
  const encodedContext = btoa(JSON.stringify(context));
  const url = new URL(app.url);
  url.searchParams.set('ecosystem_ctx', encodedContext);
  
  deps.assign(url.toString());
}
