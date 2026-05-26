import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { analytics } from "../lib/analytics.js";

/**
 * Standardized Cross-App Event Types
 */
export type MNEventType = 
  | 'scale.created'
  | 'scale.published'
  | 'scale.confirmed'
  | 'scale.declined'
  | 'rehearsal.scheduled'
  | 'rehearsal.attended'
  | 'worship.started'
  | 'worship.ended'
  | 'member.onboarded'
  | 'member.assigned'
  | 'resource.created'
  | 'system.alert';

export interface MNEventPayload {
  organizationId: string;
  actorUid: string;
  appSource: string; // 'core', 'musicscale', 'cultoflow'
  targetId?: string;
  metadata?: Record<string, any>;
  isPublicTimeline?: boolean; // Se deve aparecer na timeline global da organização
  title?: string;
  description?: string;
}

/**
 * Central Ecosystem Event Bus
 * Handles Timeline distribution, internal analytics, and future webhook triggers.
 */
class MNEventBus {
  /**
   * Publishes an event to the unified OS architecture.
   */
  public async publish(eventType: MNEventType, payload: MNEventPayload) {
    
    // 1. Send semantic marker to behavioral analytics
    analytics.track(eventType, {
      userId: payload.actorUid,
      organizationId: payload.organizationId,
      app: payload.appSource,
      metadata: payload.metadata
    });

    // 2. Publish to the unified interactive Ministerial Timeline if applicable
    if (payload.isPublicTimeline) {
      try {
        const timelineRef = collection(db, `organizations/${payload.organizationId}/timeline`);
        await addDoc(timelineRef, {
          eventType,
          actorUid: payload.actorUid,
          appSource: payload.appSource,
          targetId: payload.targetId || null,
          title: payload.title || eventType,
          description: payload.description || '',
          metadata: payload.metadata || {},
          timestamp: serverTimestamp()
        });
      } catch (error) {
        console.error("Failed to publish to unified timeline", error);
        // Fire-and-forget, gracefully degrade
      }
    }
  }
}

export const eventBus = new MNEventBus();
