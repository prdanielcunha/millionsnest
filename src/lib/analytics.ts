import { collection, writeBatch, doc } from "firebase/firestore";
import { db } from "./firebase.js";

export type AnalyticsEventType = 
  | 'login'
  | 'signup'
  | 'app_usage'
  | 'create_scale'
  | 'create_song'
  | 'ai_import'
  | 'invite_sent'
  | 'invite_accepted'
  | 'page_view'
  | 'checkout_started'
  | 'checkout_completed'
  | 'error'
  | 'performance_metric'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'song_import_started'
  | 'ai_processing_started'
  | 'ai_processing_completed'
  | 'ai_processing_failed'
  | 'import_abandoned'
  | 'scale_creation_started'
  | 'scale_creation_completed'
  | 'performance_mode_started'
  | 'performance_mode_ended'
  | 'trial_cta_clicked';

interface AnalyticsEvent {
  eventType: AnalyticsEventType;
  organizationId?: string;
  userId?: string;
  sessionId?: string;
  app?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

class AnalyticsManager {
  private buffer: AnalyticsEvent[] = [];
  private flushInterval: any = null;
  private readonly MAX_BUFFER_SIZE = 20;
  private readonly FLUSH_INTERVAL_MS = 10000; // 10 seconds
  private sessionId: string = '';

  constructor() {
    if (typeof window !== 'undefined') {
      let sid = sessionStorage.getItem('mn_session_id');
      if (!sid) {
        sid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem('mn_session_id', sid);
      }
      this.sessionId = sid;
    }

    this.startInterval();
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        // synchronously best effort or keepalive
        this.flush();
      });

      // Track unhandled errors
      window.addEventListener('error', (event) => {
        this.track('error', {
          metadata: {
            message: event.message,
            source: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error?.stack
          }
        });
      });

      // Track unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.track('error', {
          metadata: {
            message: event.reason?.message || 'Unhandled Promise Rejection',
            reason: String(event.reason)
          }
        });
      });

      // Basic performance observer for Long Tasks (if supported)
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
              this.track('performance_metric', {
                metadata: {
                  metric: 'long_task',
                  duration: entry.duration,
                  name: entry.name
                }
              });
            });
          });
          observer.observe({ entryTypes: ['longtask'] });
        } catch (e) {
          // Ignore
        }
      }
    }
  }

  private isAllowedAnonymousRootEvent(event: AnalyticsEvent): boolean {
    if (
      event.organizationId !== 'none' ||
      event.userId !== 'none' ||
      event.app !== 'musicscale'
    ) {
      return false;
    }

    const metadata = event.metadata || {};
    const hasExactKeys = (expected: string[]) => {
      const actual = Object.keys(metadata).sort();
      const wanted = [...expected].sort();
      return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
    };

    if (event.eventType === 'page_view') {
      return hasExactKeys(['page']) && metadata.page === 'sales_landing';
    }

    if (event.eventType === 'trial_cta_clicked') {
      return (
        hasExactKeys(['action', 'source']) &&
        metadata.action === 'choose_plan' &&
        metadata.source === 'sales_landing_primary'
      );
    }

    if (event.eventType === 'app_usage') {
      const openedDemo =
        hasExactKeys(['action', 'source']) &&
        metadata.action === 'sales_demo_opened' &&
        metadata.source === 'sales_landing';

      const selectedStep =
        hasExactKeys(['action', 'step']) &&
        metadata.action === 'sales_demo_step_selected' &&
        Number.isInteger(metadata.step) &&
        metadata.step >= 1 &&
        metadata.step <= 5;

      return openedDemo || selectedStep;
    }

    return false;
  }

  private startInterval() {
    if (typeof window !== 'undefined') {
      this.flushInterval = setInterval(() => {
        this.flush();
      }, this.FLUSH_INTERVAL_MS);
    }
  }

  /**
   * Tracks an event in the MillionsNest ecosystem.
   * Events are buffered and sent in batches to reduce Firestore write costs.
   */
  public track(
    eventType: AnalyticsEventType, 
    payload: { 
      organizationId?: string, 
      userId?: string, 
      sessionId?: string,
      app?: string, 
      metadata?: Record<string, any> 
    } = {}
  ) {
    this.buffer.push({
      eventType,
      organizationId: payload.organizationId || 'none',
      userId: payload.userId || 'none',
      sessionId: payload.sessionId || this.sessionId,
      app: payload.app || 'millionsnest_core',
      metadata: payload.metadata || {},
      timestamp: new Date()
    });

    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      this.flush();
    }
  }

  public async flush() {
    if (this.buffer.length === 0) return;

    const eventsToFlush = [...this.buffer];
    this.buffer = [];

    try {
      const batch = writeBatch(db);
      // Group events by organizationId
      const orgEvents: Record<string, typeof eventsToFlush> = {};
      const rootEvents: typeof eventsToFlush = [];

      eventsToFlush.forEach(event => {
        if (event.organizationId && event.organizationId !== 'none') {
           if (!orgEvents[event.organizationId]) orgEvents[event.organizationId] = [];
           orgEvents[event.organizationId].push(event);
        } else {
           const hasAuthenticatedAttribution = event.userId !== 'none';
           if (hasAuthenticatedAttribution || this.isAllowedAnonymousRootEvent(event)) {
             rootEvents.push(event);
           }
        }
      });

      // Write organization-scoped events
      for (const [orgId, evts] of Object.entries(orgEvents)) {
        const orgEventsRef = collection(db, `organizations/${orgId}/analytics`);
        evts.forEach(event => {
          const newRef = doc(orgEventsRef);
          batch.set(newRef, event);
        });
      }

      // Write root events (fallback)
      if (rootEvents.length > 0) {
        const rootEventsRef = collection(db, "analytics_events");
        rootEvents.forEach(event => {
          const newRef = doc(rootEventsRef);
          batch.set(newRef, event);
        });
      }

      await batch.commit();
    } catch (error: any) {
      if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
        // Soft fail to not interrupt UX. Log as warning only if needed, but avoid spamming.
        if (process.env.NODE_ENV === 'development') {
          console.warn("Analytics flush skipped: Missing or insufficient permissions.");
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.error("Failed to flush analytics events:", error);
        }
      }
      // Drop events that couldn't be flushed to avoid infinite loops
    }
  }
}

export const analytics = new AnalyticsManager();
