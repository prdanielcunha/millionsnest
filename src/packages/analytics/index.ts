import { eventBus, EventAction, EventBusPayload } from '../events/index.js';

export interface AnalyticsSession {
  id: string;
  startTime: number;
}

/**
 * Ecosystem Analytics Engine
 * Acts as an event bus middleware to batch and write events to the data warehouse / Firestore.
 */
export class AnalyticsEngine {
  private buffer: any[] = [];
  private flushIntervalMs = 15000;
  private maxBufferSize = 50;
  private session: AnalyticsSession | null = null;
  private timer: any;

  // Ideally this depends on a data layer adapter. For now, we mock the "db" layer interaction or allow dependency injection.
  private flushAdapter: ((events: any[]) => Promise<void>) | null = null;

  public initialize(flushAdapter: (events: any[]) => Promise<void>) {
    this.flushAdapter = flushAdapter;
    
    // Register as a middleware in the Global Event Bus
    eventBus.registerMiddleware(this.eventMiddleware);

    if (typeof window !== 'undefined') {
      let sid = sessionStorage.getItem('mn_session_id');
      if (!sid) {
        sid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem('mn_session_id', sid);
      }
      this.session = { id: sid, startTime: Date.now() };

      this.timer = setInterval(() => this.flush(), this.flushIntervalMs);
      
      window.addEventListener('beforeunload', () => {
        this.flush();
      });
    }
  }

  private eventMiddleware = async (action: EventAction, payload: EventBusPayload) => {
    this.buffer.push({
      action,
      sessionId: this.session?.id,
      timestamp: Date.now(),
      ...payload
    });

    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  };

  public async flush() {
    if (this.buffer.length === 0 || !this.flushAdapter) return;

    const batch = [...this.buffer];
    this.buffer = [];

    try {
      await this.flushAdapter(batch);
    } catch (err) {
      console.error('Analytics flush failed', err);
      // Soft failure, avoid re-adding to buffer to prevent infinite loops on permanent failure
      // Production implementations might put them in indexeddb queue
    }
  }
}

export const analytics = new AnalyticsEngine();
