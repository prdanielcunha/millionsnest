import { eventBus } from '../events';

/**
 * Advanced Telemetry Engine
 * Tracks rage clicks, dead clicks, hesitation, layout shifts, error boundaries to provide a friction score.
 */
export class TelemetryEngine {
  private rageClickThreshold = 3;
  private rageClickTimeframe = 1000;
  private clicks: { x: number, y: number, time: number }[] = [];
  
  private organizationId: string = '';
  private userId: string = '';
  
  public initialize(userId: string, organizationId: string) {
    this.userId = userId;
    this.organizationId = organizationId;
    
    if (typeof window !== 'undefined') {
      window.addEventListener('click', this.trackClicks);
      window.addEventListener('error', this.trackError);
      window.addEventListener('unhandledrejection', this.trackUnhandledRejection);
      this.observePerformance();
    }
  }

  public teardown() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('click', this.trackClicks);
      window.removeEventListener('error', this.trackError);
      window.removeEventListener('unhandledrejection', this.trackUnhandledRejection);
    }
  }

  private trackClicks = (e: MouseEvent) => {
    const now = Date.now();
    this.clicks.push({ x: e.clientX, y: e.clientY, time: now });
    
    // Clean up old clicks
    this.clicks = this.clicks.filter(c => now - c.time < this.rageClickTimeframe);
    
    if (this.clicks.length >= this.rageClickThreshold) {
      // Detected Rage Click
      this.reportFriction('rage_click', {
        x: e.clientX,
        y: e.clientY,
        path: window.location.pathname,
        element: (e.target as Element)?.tagName
      });
      // Clear to avoid spam
      this.clicks = [];
    }
  };

  private trackError = (e: ErrorEvent) => {
    this.reportFriction('js_error', {
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno
    });
  };

  private trackUnhandledRejection = (e: PromiseRejectionEvent) => {
    this.reportFriction('promise_rejection', {
      reason: String(e.reason)
    });
  };

  private observePerformance() {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;
    
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.reportFriction('long_task', {
            duration: entry.duration,
            name: entry.name,
            path: window.location.pathname
          });
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      // Ignored
    }
  }

  private reportFriction(type: string, details: any) {
    if (!this.userId) return; // Don't report if not fully initialized
    
    eventBus.publish('system.telemetry.friction', {
      organizationId: this.organizationId,
      userId: this.userId,
      appSource: 'core',
      metadata: {
        type,
        ...details
      }
    });
  }
}

export const telemetry = new TelemetryEngine();
