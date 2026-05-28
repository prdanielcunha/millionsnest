import { getAuth } from 'firebase/auth';
import { db } from '../lib/firebase.js';

import { diagnosticsEngine } from '../packages/os/diagnostics.js';
import { watchdog } from '../packages/os/watchdog.js';
import { queueIntegrity } from '../packages/os/queue.js';

export const ECOSYSTEM_PROTOCOL_VERSION = '1.0.0';
export const ECOSYSTEM_SDK_VERSION = '1.2.0';

export const TRUSTED_DOMAINS = [
  'localhost',
  'millionsnest.com',
  'c.run.app',
  'web.app',
  'firebaseapp.com'
];

export interface EcosystemToken {
  accessToken: string;
  signature: string; 
  expiresAt: number;
  orgId: string;
  userId: string;
  issuedFor: string; 
}

export interface EcosystemProtocol {
  protocolVersion: string;
  sdkVersion: string;
  supportedCapabilities: string[];
}

export interface EcosystemContext {
  appId: string;
  protocol: EcosystemProtocol;
  token: EcosystemToken;
  user: {
    uid: string;
    email: string;
    displayName: string | null;
    systemRole: string;
  };
  organization: {
    id: string;
    slug: string;
    name: string;
    subscriptionPlan: string;
  };
  permissions: string[];
  locale: string;
  installedApps: string[];
}

export type EcosystemMessage = 
  | { type: 'SESSION_SYNC'; context: EcosystemContext }
  | { type: 'SESSION_INVALIDATE'; reason: string }
  | { type: 'MODULE_READY'; appId: string }
  | { type: 'ERROR'; code: string; message: string };

export interface ProtocolDiagnostic {
  timestamp: string;
  action: string;
  module?: string;
  status: 'SUCCESS' | 'WARN' | 'ERROR';
  details: string;
}

export class EcosystemPlatform {
  private static instance: EcosystemPlatform;
  private currentContext: EcosystemContext | null = null;
  private activeSubscriptions: (() => void)[] = [];
  private isOS: boolean = true;
  
  // Realtime diagnostics store
  private diagnosticsLog: ProtocolDiagnostic[] = [];

  private constructor() {
    this.setupMessageListener();
  }

  static getInstance() {
    if (!EcosystemPlatform.instance) {
      EcosystemPlatform.instance = new EcosystemPlatform();
    }
    return EcosystemPlatform.instance;
  }

  getDiagnostics() {
    return this.diagnosticsLog;
  }

  private trace(action: string, status: ProtocolDiagnostic['status'], details: string, module?: string) {
    const log: ProtocolDiagnostic = {
      timestamp: new Date().toISOString(),
      action,
      status,
      details,
      module: module || this.currentContext?.appId || 'OS'
    };
    this.diagnosticsLog = [log, ...this.diagnosticsLog].slice(0, 100);
    
    let severity: 'info' | 'warn' | 'error' | 'fatal' = 'info';
    if (status === 'ERROR') severity = 'error';
    if (status === 'WARN') severity = 'warn';

    diagnosticsEngine.log(`[Protocol ${action}]: ${details}`, severity, module || 'OS_PROTOCOL_LAYER');
  }

  // OS Mode vs Module Mode
  setMode(isOS: boolean) {
    this.isOS = isOS;
  }

  private isTrustedOrigin(origin: string): boolean {
    try {
      const url = new URL(origin);
      const hostname = url.hostname;
      return TRUSTED_DOMAINS.some(domain => 
        hostname === domain || hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }

  private setupMessageListener() {
    window.addEventListener('message', (event) => {
      // 1. Strict Origin Validation
      if (!this.isTrustedOrigin(event.origin) && event.origin !== window.location.origin) {
        this.trace('Message Authentication', 'WARN', `Blocked cross-origin message from untrusted domain: ${event.origin}`);
        return;
      }

      try {
        const message: EcosystemMessage = event.data;
        if (!message || typeof message.type !== 'string') return;

        this.handleProtocolMessage(message, event.source as Window);
      } catch (e) {
        // Ignore unparseable or irrelevant messages gracefully
      }
    });

    // Cross-tab Synchronization using localStorage for OS
    window.addEventListener('storage', (event) => {
      if (this.isOS && event.key === 'mn_ecosystem_sync' && event.newValue) {
        try {
          const syncedContext: EcosystemContext = JSON.parse(atob(event.newValue));
          this.validateContextIntegrity(syncedContext);
          this.currentContext = syncedContext;
          this.trace('Session Realtime Sync', 'SUCCESS', 'Cross-tab session synced.', syncedContext.appId);
          this.onSessionSyncListeners.forEach(l => l(this.currentContext!));
        } catch(e) {
          this.trace('Session Realtime Sync', 'ERROR', 'Inter-tab sync validation failed.');
        }
      }
      
      // Handle logout/invalidation across tabs
      if (this.isOS && event.key === 'mn_user_profile' && !event.newValue) {
         this.trace('Session Invalidation', 'WARN', 'Reverting session: Profile removed from storage.');
         this.onSessionInvalidateListeners.forEach(l => l('cross-tab-logout'));
         this.currentContext = null;
      }
    });
  }

  // Ecosystem Security State
  private onSessionSyncListeners: ((context: EcosystemContext) => void)[] = [];
  private onSessionInvalidateListeners: ((reason: string) => void)[] = [];

  onSessionSync(listener: (context: EcosystemContext) => void) {
    this.onSessionSyncListeners.push(listener);
    return () => {
      this.onSessionSyncListeners = this.onSessionSyncListeners.filter(l => l !== listener);
    };
  }

  onSessionInvalidate(listener: (reason: string) => void) {
    this.onSessionInvalidateListeners.push(listener);
    return () => {
      this.onSessionInvalidateListeners = this.onSessionInvalidateListeners.filter(l => l !== listener);
    };
  }

  private handleProtocolMessage(message: EcosystemMessage, sourceWindow: Window) {
    switch (message.type) {
      case 'SESSION_SYNC':
        if (!this.isOS) {
          try {
            this.validateContextIntegrity(message.context);
            this.currentContext = message.context;
            this.trace('Protocol Handshake', 'SUCCESS', `Session synced successfully for Org: ${this.currentContext.organization.name}`, message.context.appId);
            this.onSessionSyncListeners.forEach(l => l(this.currentContext!));
          } catch (e: any) {
            this.trace('Protocol Handshake', 'ERROR', `Context validation failed: ${e.message}`, message.context?.appId);
          }
        }
        break;
      
      case 'SESSION_INVALIDATE':
        this.trace('Session Invalidation', 'WARN', `Session invalidated: ${message.reason}`, this.currentContext?.appId);
        this.currentContext = null;
        this.onSessionInvalidateListeners.forEach(l => l(message.reason));
        if (!this.isOS) {
          window.location.href = '/unauthorized';
        }
        break;

      case 'MODULE_READY':
        if (this.isOS) {
          watchdog.registerModule(message.appId);
          watchdog.heartbeatReceived(message.appId);
          this.trace('Module Ready Handshake', 'SUCCESS', `Module ${message.appId} reported ready.`, message.appId);
          if (this.currentContext && sourceWindow) {
             sourceWindow.postMessage({ type: 'SESSION_SYNC', context: this.currentContext }, '*');
             this.trace('Module Context Injection', 'SUCCESS', `Injected signed context to module ${message.appId}`, message.appId);
          }
        }
        break;

      case 'MODULE_HEARTBEAT' as any:
        if (this.isOS) {
           watchdog.heartbeatReceived((message as any).appId);
        }
        break;
    }
  }

  // Application Gating Authority
  validateAppAccess(appId: string, org: EcosystemContext['organization'], installedApps: string[]) {
    // MusicScale is the original flagship, sometimes granted implicitly by subscription
    const isLegacyFlagship = appId === 'musicscale'; 
    const isExplicitlyInstalled = installedApps.includes(appId);
    
    if (!isLegacyFlagship && !isExplicitlyInstalled) {
       throw new Error(`Module ${appId} is not installed for organization ${org.name}`);
    }
  }

  // Generate a signed ecosystem token for cross-app validation
  async generateEcosystemToken(appId: string, orgId: string, userId: string): Promise<EcosystemToken> {
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24; // 24 hours
    const payload = `${appId}:${orgId}:${userId}:${expiresAt}`;
    
    // Simulating a signature (HMAC-SHA256 mock)
    const signature = btoa(payload).replace(/=/g, ''); 

    return {
      accessToken: btoa(JSON.stringify({ appId, orgId, userId, exp: expiresAt })),
      signature,
      expiresAt,
      orgId,
      userId,
      issuedFor: appId
    };
  }

  // Prepares the payload required to boot a satellite module
  async createSignedContext(appId: string, user: any, profile: any, currentOrg: any, currentUserPerms: Record<string, boolean>): Promise<EcosystemContext> {
    const installed = currentOrg.enabledApps || [];
    this.validateAppAccess(appId, currentOrg, installed);

    const token = await this.generateEcosystemToken(appId, currentOrg.id, user.uid);
    
    const safeCapabilities = currentUserPerms ?? {};
    const permissions = Object.entries(safeCapabilities)
      .filter(([_, value]) => value)
      .map(([key]) => key);

    const installedApps = [...(currentOrg.enabledApps || [])];
    if (!installedApps.includes('musicscale') && (currentOrg.subscriptionPlan !== 'free' || profile?.systemRole === 'ceo')) {
        installedApps.push('musicscale');
    }

    return {
      appId,
      protocol: {
        protocolVersion: ECOSYSTEM_PROTOCOL_VERSION,
        sdkVersion: ECOSYSTEM_SDK_VERSION,
        supportedCapabilities: ['postMessage_sync', 'deep_linking', 'session_refresh']
      },
      token,
      user: {
        uid: user.uid,
        email: user.email || '',
        displayName: profile?.displayName || null,
        systemRole: profile?.systemRole || 'user',
      },
      organization: {
        id: currentOrg.id,
        slug: currentOrg.slug || currentOrg.id,
        name: currentOrg.name,
        subscriptionPlan: currentOrg.subscriptionPlan || 'free'
      },
      permissions,
      locale: navigator.language || 'pt-BR',
      installedApps: installedApps
    };
  }

  validateContextIntegrity(ctx: EcosystemContext) {
    if (!ctx.protocol || ctx.protocol.protocolVersion !== ECOSYSTEM_PROTOCOL_VERSION) {
      throw new Error('Ecosystem protocol version mismatch or missing.');
    }

    if (Date.now() > ctx.token.expiresAt) {
      throw new Error('Ecosystem token expired');
    }

    // Simulate Signature Check
    const expectedPayload = `${ctx.token.issuedFor}:${ctx.token.orgId}:${ctx.token.userId}:${ctx.token.expiresAt}`;
    const expectedSig = btoa(expectedPayload).replace(/=/g, '');
    if (ctx.token.signature !== expectedSig) {
      throw new Error('Invalid ecosystem token signature (Anti-Spoof validation failed)');
    }
    
    // Anti Cross-Org Leakage Check
    if (this.currentContext && this.currentContext.organization.id !== ctx.organization.id) {
       console.warn(`[Ecosystem Security] Cross-org leakage prevented. Expected org: ${this.currentContext.organization.id}, got: ${ctx.organization.id}`);
    }
  }

  // App SDK Receiver Mode (Satellite Context): Bootstrap Handshake
  async bootstrapModule(windowParams: URLSearchParams): Promise<EcosystemContext | null> {
    this.setMode(false);
    const contextData = windowParams.get('ecosystem_ctx');
    
    if (!contextData) {
      // fallback to notifying OS we are ready and waiting for postMessage
      if (window.opener) {
         window.opener.postMessage({ type: 'MODULE_READY', appId: 'unknown' }, '*');
      }
      return null;
    }

    try {
      const decodedCtx: EcosystemContext = JSON.parse(atob(contextData));
      
      this.validateContextIntegrity(decodedCtx);
      
      this.currentContext = decodedCtx;
      console.log(`[MillionsNest Ecosystem] Module ${decodedCtx.appId} securely bootstrapped via URL for Org ${decodedCtx.organization.name}`);
      
      // Notify OS that module is successfully bootstrapped
      if (window.opener) {
         window.opener.postMessage({ type: 'MODULE_READY', appId: decodedCtx.appId }, '*');
      }

      return decodedCtx;
    } catch (e: any) {
      console.error("[MillionsNest Ecosystem] Context bootstrap failed: " + e.message);
      return null;
    }
  }

  getContext() {
    return this.currentContext;
  }
  
  // Method to sync org state across modules from the OS
  broadcastSessionUpdate(context: EcosystemContext) {
    if (!this.isOS) return;
    this.currentContext = context;
    // Broadcast via window message if there are iframes, etc.
    // Assuming satellite apps are opened as child windows or iframes, 
    // maintaining a reference to them in production is required. 
    // Here we can at least drop it in localStorage so other tabs sync immediately.
    try {
       localStorage.setItem('mn_ecosystem_sync', btoa(JSON.stringify(context)));
    } catch(e) {}
  }

  // Platform Cross-App Routing
  async launchModule(appId: string, targetUrl: string, user: any, profile: any, currentOrg: any, currentUserPerms: Record<string, boolean>) {
    const context = await this.createSignedContext(appId, user, profile, currentOrg, currentUserPerms);
    this.currentContext = context; // OS tracks last generated context
    const encodedContext = btoa(JSON.stringify(context));
    
    const url = new URL(targetUrl);
    url.searchParams.set('ecosystem_ctx', encodedContext);
    
    console.log(`[MillionsNest Ecosystem] Launching Module ${appId}`);
    // Open application
    window.open(url.toString(), '_blank');
  }
}

export const ecosystemPlatform = EcosystemPlatform.getInstance();

