import { eventBus } from '../events';
import { offlineEngine } from '../offline';
import { telemetry } from '../telemetry';
import { analytics } from '../analytics';

export interface MNOSConfig {
  analyticsFlushAdapter?: (events: any[]) => Promise<void>;
  enableTelemetry?: boolean;
}

/**
 * MillionsNest OS Core Orchestrator
 * Bootstraps the shared architectures ensuring they communicate correctly.
 */
class MNOSCore {
  private initialized = false;

  public async bootstrap(config: MNOSConfig, userId: string, orgId: string) {
    if (this.initialized) return;

    // 1. Initialize Event Bus (Central Hub)
    // Implicitly initialized as Singleton

    // 2. Initialize Telemetry Engine (Hooks up to DOM)
    if (config.enableTelemetry !== false) {
      telemetry.initialize(userId, orgId);
    }

    // 3. Initialize Analytics Engine (Batch processing)
    if (config.analyticsFlushAdapter) {
      analytics.initialize(config.analyticsFlushAdapter);
    }

    // 4. Initialize Offline Engine (IndexedDB & Background Sync)
    try {
      await offlineEngine.initialize();
    } catch (err) {
      console.warn('MNOS: Offline Engine failed to boot, running in degrade mode.', err);
    }

    this.initialized = true;
    
    // Announce boot
    eventBus.publish('system.boot', {
      organizationId: orgId,
      userId: userId,
      appSource: 'core',
      metadata: { os_version: '1.0.0' }
    });
  }
}

export const osCore = new MNOSCore();
