import { eventBus } from '../events/index.js';
import { throttle } from '../core/utils.js';

export interface PerformanceBudgets {
  minFPS: number;
  maxMemoryMB: number;
  maxLongTaskMs: number;
  maxLayoutShift: number;
}

export interface SystemPerformanceMetrics {
  fps: number;
  memoryUsageMB?: number;
  clsScore: number;
  uxScore: number;
}

/**
 * Ecosystem Continuous Performance Auditor
 * Detects rendering drops, memory leaks, high JS cost, and warns of degradation
 */
export class PerformanceEngine {
  private orgId: string = '';
  private userId: string = '';
  private isMonitoring: boolean = false;
  
  private frameCount = 0;
  private lastFpsTime = 0;
  private currentFps = 60;
  private animationFrameId: number = 0;
  private clsScore = 0;
  
  private budgets: PerformanceBudgets = {
    minFPS: 45, // Alert if consistently below
    maxMemoryMB: 250, // Alert if exceeds
    maxLongTaskMs: 100, // Render spike limit
    maxLayoutShift: 0.1 // Cumulative UX threshold
  };

  private alertCooldowns: Record<string, number> = {};
  
  public initialize(userId: string, orgId: string) {
    if (typeof window === 'undefined') return;
    this.userId = userId;
    this.orgId = orgId;
    this.isMonitoring = true;

    this.startFPSMonitor();
    this.observeVitals();
    this.scheduleRoutineCheck();
  }

  public teardown() {
    this.isMonitoring = false;
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
  }

  private startFPSMonitor() {
    this.lastFpsTime = performance.now();
    const tick = (now: number) => {
      if (!this.isMonitoring) return;
      this.frameCount++;
      if (now - this.lastFpsTime >= 1000) {
        this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
        this.frameCount = 0;
        this.lastFpsTime = now;
        this.checkBudgets();
      }
      this.animationFrameId = requestAnimationFrame(tick);
    };
    this.animationFrameId = requestAnimationFrame(tick);
  }

  private observeVitals() {
    try {
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            this.clsScore += (entry as any).value;
            this.checkBudgets();
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });

      const taskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > this.budgets.maxLongTaskMs) {
            this.triggerAlert('render_spike', `Render spike detected: ${Math.round(entry.duration)}ms processing time. Potential heavy component or animation cost.`);
          }
        }
      });
      taskObserver.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      // Environments that do not support PerformanceObserver
    }
  }

  private getMemory(): number | undefined {
    const mem = (performance as any).memory;
    if (mem) {
      return Math.round(mem.usedJSHeapSize / (1024 * 1024));
    }
    return undefined;
  }

  private checkBudgets() {
    if (this.currentFps < this.budgets.minFPS) {
      this.triggerAlert('low_fps', `FPS dropped to ${this.currentFps}. Complex DOM, heavy blur, or excessive motion detected.`);
    }

    const memMb = this.getMemory();
    if (memMb && memMb > this.budgets.maxMemoryMB) {
      this.triggerAlert('high_memory', `JS Heap is at ${memMb}MB. Potential memory leak or large payload.`);
    }

    if (this.clsScore > this.budgets.maxLayoutShift) {
      this.triggerAlert('layout_thrashing', `Cumulative Layout Shift threshold exceeded (${this.clsScore.toFixed(3)}). Unstable rendering.`);
    }
  }

  private calculateUXScore(): number {
    let score = 100;
    if (this.currentFps < 50) score -= (50 - this.currentFps) * 2;
    if (this.clsScore > 0.1) score -= 20;
    if (this.clsScore > 0.25) score -= 30; // Further penalize
    const memMb = this.getMemory();
    if (memMb && memMb > 150) score -= 10;
    return Math.max(0, Math.min(100, score));
  }

  private triggerAlert(type: string, details: string) {
    if (!this.orgId || !this.userId) return;

    // Cooldown mechanism (1 alert per type every 60 seconds)
    const now = Date.now();
    if (this.alertCooldowns[type] && now - this.alertCooldowns[type] < 60000) return;
    this.alertCooldowns[type] = now;

    // We report this internally. In production, this can be funneled to AI-Ops for automatic action
    eventBus.publish('system.telemetry.performance_alert' as any, {
      organizationId: this.orgId,
      userId: this.userId,
      appSource: 'core',
      metadata: { 
        issueType: type,
        details: details,
        currentUXScore: this.calculateUXScore(),
        path: window.location.pathname
      }
    });
    
    console.warn(`[Performance Budget Exceeded] ${details}`);
  }

  private scheduleRoutineCheck = throttle(() => {
    // Allows periodic polling if needed
  }, 10000);

  public getMetrics(): SystemPerformanceMetrics {
    return {
      fps: this.currentFps,
      memoryUsageMB: this.getMemory(),
      clsScore: this.clsScore,
      uxScore: this.calculateUXScore()
    };
  }
}

export const performanceEngine = new PerformanceEngine();
