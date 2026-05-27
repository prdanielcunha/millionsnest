import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase.js";

/**
 * 1. OFFICIAL EVENT SCHEMA (namespace.entity.action)
 * 
 * Namespaces: ecosystem, organization, billing, musicscale
 * Entities: member, settings, scale, song, rehearsal
 * Actions: created, updated, deleted, invited, joined, opened
 */
export type EventAction = 
  // Ecosystem / Identity
  | 'ecosystem.user.login'
  | 'ecosystem.user.signup'
  
  // Organization / Governance
  | 'organization.tenant.created'
  | 'organization.member.invited'
  | 'organization.member.joined'
  | 'organization.member.role_updated'
  | 'organization.settings.updated'
  | 'organization.audit_log.viewed'

  // Billing
  | 'billing.checkout.started'
  | 'billing.subscription.upgraded'
  | 'billing.subscription.canceled'

  // MusicScale Integration
  | 'musicscale.scale.created'
  | 'musicscale.scale.published'
  | 'musicscale.scale.confirmed'
  | 'musicscale.scale.declined'
  | 'musicscale.rehearsal.scheduled'
  | 'musicscale.rehearsal.attended'
  | 'musicscale.song.created'
  | 'musicscale.song.opened'
  | 'musicscale.volunteer.assigned'

  // Open Extensibility
  | string;

export interface EventBusPayload {
  organizationId: string;
  userId: string;
  appSource: 'core' | 'musicscale' | 'cultoflow' | 'cells' | string;
  metadata?: Record<string, any>;
  targetEntityId?: string;
  
  // For Timeline / UI propagation
  isPublicTimeline?: boolean;
  title?: string;
  description?: string;
}

export type EventMiddleware = (action: EventAction, payload: EventBusPayload & { timestamp: number }) => Promise<boolean | void>;

/**
 * ORGANIZATIONAL ACTIVITY GRAPH
 * Persists high-level operations for timeline visualization
 */
const TimelineEngine: EventMiddleware = async (action, payload) => {
  if (payload.isPublicTimeline && payload.organizationId) {
    try {
      const timelineRef = collection(db, `organizations/${payload.organizationId}/timeline`);
      await addDoc(timelineRef, {
        eventType: action,
        actorUid: payload.userId,
        appSource: payload.appSource,
        targetId: payload.targetEntityId || null,
        title: payload.title || action,
        description: payload.description || '',
        metadata: payload.metadata || {},
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Failed to publish to unified timeline graph", error);
    }
  }
};

/**
 * EVENT VALIDATOR & ECOSYSTEM EVENT BUS
 * Central decoupled communication across all MillionsNest OS layers
 */
class EcosystemEventBus {
  private middlewares: EventMiddleware[] = [TimelineEngine];
  private listeners: Map<string, Set<(payload: EventBusPayload & { timestamp: number }) => void>> = new Map();
  private static instance: EcosystemEventBus;

  private constructor() {}

  public static getInstance(): EcosystemEventBus {
    if (!EcosystemEventBus.instance) {
      EcosystemEventBus.instance = new EcosystemEventBus();
    }
    return EcosystemEventBus.instance;
  }

  public registerMiddleware(middleware: EventMiddleware) {
    this.middlewares.push(middleware);
  }

  public subscribe(action: EventAction, callback: (payload: EventBusPayload & { timestamp: number }) => void) {
    if (!this.listeners.has(action)) {
      this.listeners.set(action, new Set());
    }
    this.listeners.get(action)!.add(callback);
  }

  public unsubscribe(action: EventAction, callback: (payload: EventBusPayload & { timestamp: number }) => void) {
    if (this.listeners.has(action)) {
      this.listeners.get(action)!.delete(callback);
    }
  }

  /**
   * AI Readiness / Event Integrity Validator
   * Prepares and validates structured events logically before emission
   */
  public async publish(action: EventAction, payload: EventBusPayload) {
    if (!payload.organizationId && !action.startsWith('ecosystem.user') && !action.startsWith('system.')) {
      console.warn(`[Event Integrity] Missing scope (organization) on event ${action}`);
    }

    const enrichedPayload = { ...payload, timestamp: Date.now() };

    // Standard local pub/sub
    if (this.listeners.has(action)) {
      this.listeners.get(action)!.forEach(fn => {
        try { fn(enrichedPayload) } catch (e) { console.error('Ecosystem event listener crash', e) }
      });
    }

    // Pass through architecture pipelines
    await Promise.allSettled(
      this.middlewares.map(mw =>
        Promise.resolve().then(() => mw(action, enrichedPayload))
      )
    );
  }
}

export const eventBus = EcosystemEventBus.getInstance();
