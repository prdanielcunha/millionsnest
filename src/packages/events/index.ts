export type EventAction = 
  // Identity & Org
  | 'user.login'
  | 'user.signup'
  | 'org.created'
  | 'org.member_joined'
  // Ministry Operations
  | 'scale.created'
  | 'scale.published'
  | 'scale.confirmed'
  | 'scale.declined'
  | 'rehearsal.scheduled'
  | 'rehearsal.confirmed'
  | 'worship.started'
  | 'worship.ended'
  | 'volunteer.assigned'
  // Music & Assets
  | 'song.created'
  | 'song.opened'
  | 'resource.uploaded'
  | 'ai.import_started'
  | 'ai.import_success'
  | 'ai.import_failed'
  // Billing
  | 'billing.checkout_started'
  | 'billing.upgraded'
  | string; // Keep extensible for dynamic features

export interface EventBusPayload {
  organizationId: string;
  userId: string;
  appSource: 'core' | 'musicscale' | 'cultoflow' | 'cells' | string;
  metadata?: Record<string, any>;
  targetEntityId?: string;
}

export type EventMiddleware = (action: EventAction, payload: EventBusPayload) => Promise<boolean | void>;

/**
 * Ecosystem Global Event Bus
 * Pub/Sub system to decouple app actions from Analytics, Timeline, and sync logic.
 */
class EcosystemEventBus {
  private middlewares: EventMiddleware[] = [];
  private static instance: EcosystemEventBus;

  private constructor() {}

  public static getInstance(): EcosystemEventBus {
    if (!EcosystemEventBus.instance) {
      EcosystemEventBus.instance = new EcosystemEventBus();
    }
    return EcosystemEventBus.instance;
  }

  /**
   * Register a middleware to intercept or process all events (e.g. Analytics Engine, Timeline Engine)
   */
  public registerMiddleware(middleware: EventMiddleware) {
    this.middlewares.push(middleware);
  }

  /**
   * Publish an event to the ecosystem
   */
  public async publish(action: EventAction, payload: EventBusPayload) {
    // Inject automatically if missing
    const enrichedPayload = {
      ...payload,
      timestamp: Date.now()
    };

    // Run through middlewares concurrently
    await Promise.allSettled(
      this.middlewares.map(mw =>
        Promise.resolve().then(() => mw(action, enrichedPayload))
      )
    );
  }
}

export const eventBus = EcosystemEventBus.getInstance();
