import { diagnosticsEngine } from "./diagnostics.js";
import { eventBus } from "../events/index.js";

interface ModuleHealth {
  appId: string;
  status: 'healthy' | 'degraded' | 'dead';
  lastPing: number;
  missedPings: number;
  restartCount: number;
}

/**
 * Ecosystem Watchdog: Continuous Monitoring & Degraded Mode Detection
 * Runtime Recovery Engine: Automatic Retry & Safe Reconnect
 */
class EcosystemWatchdog {
  private static instance: EcosystemWatchdog;
  private modules: Map<string, ModuleHealth> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly PING_RATE = 10000; // 10s
  private readonly MAX_MISSED_PINGS = 3;

  private isDegradedMode = false;

  private constructor() {
    this.startWatching();
  }

  public static getInstance() {
    if (!EcosystemWatchdog.instance) {
      EcosystemWatchdog.instance = new EcosystemWatchdog();
    }
    return EcosystemWatchdog.instance;
  }

  public registerModule(appId: string) {
    if (!this.modules.has(appId)) {
      this.modules.set(appId, {
        appId,
        status: 'healthy',
        lastPing: Date.now(),
        missedPings: 0,
        restartCount: 0
      });
      diagnosticsEngine.log(`Module registered in watchdog: ${appId}`, 'info', 'Watchdog');
    }
  }

  public heartbeatReceived(appId: string) {
    const mod = this.modules.get(appId);
    if (mod) {
      mod.lastPing = Date.now();
      mod.missedPings = 0;
      if (mod.status !== 'healthy') {
        diagnosticsEngine.log(`Module recovered: ${appId}`, 'info', 'Watchdog');
        mod.status = 'healthy';
        this.evaluateEcosystemHealth();
      }
    }
  }

  private startWatching() {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      let hasDeadModules = false;

      this.modules.forEach((mod) => {
        if (now - mod.lastPing > this.PING_RATE) {
          mod.missedPings++;
          if (mod.missedPings >= this.MAX_MISSED_PINGS && mod.status !== 'dead') {
            mod.status = 'dead';
            hasDeadModules = true;
            diagnosticsEngine.log(`Module marked as DEAD: ${mod.appId}`, 'fatal', 'Watchdog');
            this.attemptRecovery(mod);
          } else if (mod.missedPings === 2 && mod.status !== 'degraded') {
            mod.status = 'degraded';
            diagnosticsEngine.log(`Module operating in DEGRADED mode: ${mod.appId}`, 'warn', 'Watchdog');
          }
        }
      });

      if (hasDeadModules) {
        this.evaluateEcosystemHealth();
      }
    }, this.PING_RATE);
  }

  private async attemptRecovery(mod: ModuleHealth) {
    if (mod.restartCount >= 3) {
      diagnosticsEngine.log(`Module ${mod.appId} failed to recover after 3 retries (Safe Backoff)`, 'fatal', 'RecoveryEngine');
      return;
    }

    mod.restartCount++;
    diagnosticsEngine.log(`Attempting recovery for module: ${mod.appId} (Attempt ${mod.restartCount})`, 'warn', 'RecoveryEngine');
    
    // Simulate orchestration restart
    eventBus.publish('system.module.recovery_initiated' as any, {
      organizationId: 'sys',
      userId: 'sys',
      appSource: 'OS',
      metadata: { appId: mod.appId, attempt: mod.restartCount }
    });

    // Cleanup stale context logic could be triggered here via postMessage to iframe if we had one
  }

  private evaluateEcosystemHealth() {
    const allDead = Array.from(this.modules.values()).every(m => m.status === 'dead');
    const anyDegraded = Array.from(this.modules.values()).some(m => m.status !== 'healthy');

    if (allDead && this.modules.size > 0 && !this.isDegradedMode) {
      this.isDegradedMode = true;
      diagnosticsEngine.log(`ECOSYSTEM IS IN OFFLINE/DEGRADED MODE`, 'fatal', 'Watchdog');
    } else if (!anyDegraded && this.isDegradedMode) {
      this.isDegradedMode = false;
      diagnosticsEngine.log(`Ecosystem recovered fully.`, 'info', 'Watchdog');
    }
  }

  public getHealthStatus() {
    return {
      isDegraded: this.isDegradedMode,
      modules: Array.from(this.modules.entries())
    };
  }
}

export const watchdog = EcosystemWatchdog.getInstance();
