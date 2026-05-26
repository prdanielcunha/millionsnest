import { throttle } from '../core/utils.js';

export interface MemoryContext {
  lastScreen: string;
  lastScaleId?: string;
  lastSongId?: string;
  lastOperationalContext?: string;
  preferences: Record<string, any>;
  timestamp: number;
}

/**
 * Ecosystem Context Memory Engine
 * Silently remembers user flows and operational context to enable cross-app continuity
 * without being visibly invasive.
 */
export class MemoryEngine {
  private getStorageKey(userId: string, orgId: string) {
    return `mn_memory_${orgId}_${userId}`;
  }

  private loadRaw(userId: string, orgId: string): MemoryContext {
    if (typeof window === 'undefined') return this.getDefaultContext();
    const raw = localStorage.getItem(this.getStorageKey(userId, orgId));
    if (!raw) return this.getDefaultContext();
    try {
      return JSON.parse(raw);
    } catch {
      return this.getDefaultContext();
    }
  }

  private saveRaw = throttle((userId: string, orgId: string, context: MemoryContext) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.getStorageKey(userId, orgId), JSON.stringify({
      ...context,
      timestamp: Date.now()
    }));
  }, 1000);

  private getDefaultContext(): MemoryContext {
    return {
      lastScreen: '/dashboard',
      preferences: {},
      timestamp: Date.now()
    };
  }

  /**
   * Records the user's current navigational context
   */
  public recordNavigation(userId: string, orgId: string, path: string) {
    if (!userId || !orgId) return;
    // Don't record login/auth routes as continuity paths
    if (path.includes('/login') || path === '/' || path.includes('/checkout')) return;

    const ctx = this.loadRaw(userId, orgId);
    
    // Specifically extract IDs if we are in contextual routes
    if (path.includes('/scales/')) {
      const match = path.match(/\/scales\/([a-zA-Z0-9_-]+)/);
      if (match && match[1] !== 'new') ctx.lastScaleId = match[1];
      ctx.lastOperationalContext = 'musicscale.scale';
    } else if (path.includes('/songs/')) {
      const match = path.match(/\/songs\/([a-zA-Z0-9_-]+)/);
      if (match && match[1] !== 'new') ctx.lastSongId = match[1];
      ctx.lastOperationalContext = 'musicscale.song';
    } else if (path.includes('/dashboard')) {
      ctx.lastOperationalContext = 'core.dashboard';
    }

    ctx.lastScreen = path;
    this.saveRaw(userId, orgId, ctx);
  }

  /**
   * Validates if the saved context is recent enough to justify a "Smart Resume"
   * e.g., less than 12 hours ago
   */
  public getResumableContext(userId: string, orgId: string): MemoryContext | null {
    if (!userId || !orgId) return null;
    const ctx = this.loadRaw(userId, orgId);
    const twelveHoursMs = 12 * 60 * 60 * 1000;
    
    if (Date.now() - ctx.timestamp < twelveHoursMs && ctx.lastScreen !== '/dashboard') {
      return ctx;
    }
    return null;
  }

  /**
   * Save a specific preference silently
   */
  public savePreference(userId: string, orgId: string, key: string, value: any) {
    if (!userId || !orgId) return;
    const ctx = this.loadRaw(userId, orgId);
    ctx.preferences[key] = value;
    this.saveRaw(userId, orgId, ctx);
  }

  /**
   * Retrieve a specific preference
   */
  public getPreference<T>(userId: string, orgId: string, key: string, defaultValue: T): T {
    if (!userId || !orgId) return defaultValue;
    const ctx = this.loadRaw(userId, orgId);
    return ctx.preferences[key] !== undefined ? ctx.preferences[key] : defaultValue;
  }
}

export const memoryEngine = new MemoryEngine();
