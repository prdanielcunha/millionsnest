import { debounce } from "../core/utils.js";

// Types
export interface SyncOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'CUSTOM';
  collection: string;
  docId?: string;
  payload: any;
  timestamp: number;
  retryCount: number;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
  error?: string;
}

export interface OfflineConfig {
  dbName: string;
  dbVersion: number;
  syncIntervalMs: number;
  maxRetries: number;
}

const DEFAULT_CONFIG: OfflineConfig = {
  dbName: 'MN_OfflineDB',
  dbVersion: 1,
  syncIntervalMs: 15000,
  maxRetries: 5
};

/**
 * Offline Sync Engine
 * Handles IndexedDB persistence, background sync queue, and conflict resolution.
 */
export class OfflineEngine {
  private config: OfflineConfig;
  private db: IDBDatabase | null = null;
  private syncTimer: any = null;
  private isOnline: boolean = true;
  private syncHandlers: Map<string, (op: SyncOperation) => Promise<void>> = new Map();

  constructor(config: Partial<OfflineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  public async initialize(): Promise<void> {
    if (typeof window === 'undefined') return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.dbVersion);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = request.result;
        if (!db.objectStoreNames.contains('sync_queue')) {
          const store = db.createObjectStore('sync_queue', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.startSyncLoop();
        resolve();
      };

      request.onerror = () => {
        console.error("OfflineEngine: Failed to open IndexedDB", request.error);
        reject(request.error);
      };
    });
  }

  private handleOnline = () => {
    this.isOnline = true;
    this.processQueue();
  };

  private handleOffline = () => {
    this.isOnline = false;
  };

  private startSyncLoop() {
    this.syncTimer = setInterval(() => {
      if (this.isOnline) {
        this.processQueue();
      }
    }, this.config.syncIntervalMs);
  }

  /**
   * Registers a handler for a specific collection's sync operations
   */
  public registerHandler(collection: string, handler: (op: SyncOperation) => Promise<void>) {
    this.syncHandlers.set(collection, handler);
  }

  /**
   * Adds an operation to the queue for background sync
   */
  public async queueOperation(collection: string, type: SyncOperation['type'], payload: any, docId?: string): Promise<string> {
    const op: SyncOperation = {
      id: crypto.randomUUID(),
      type,
      collection,
      docId,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'PENDING'
    };

    await this.saveToQueue(op);
    
    // Attempt immediate sync if online
    if (this.isOnline) {
      debounce(() => this.processQueue(), 500)();
    }
    
    return op.id;
  }

  private async saveToQueue(op: SyncOperation): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      const req = store.put(op);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private async getPendingOperations(): Promise<SyncOperation[]> {
    if (!this.db) return [];
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('sync_queue', 'readonly');
      const store = tx.objectStore('sync_queue');
      const index = store.index('status');
      const req = index.getAll('PENDING');
      
      req.onsuccess = () => {
        // Sort by timestamp
        const results = (req.result as SyncOperation[]).sort((a, b) => a.timestamp - b.timestamp);
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  private async removeOperation(id: string): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Processes the queue sequentially to respect ordering
   */
  public async processQueue(): Promise<void> {
    if (!this.isOnline || !this.db) return;

    const pending = await this.getPendingOperations();
    if (pending.length === 0) return;

    for (const op of pending) {
      if (!this.isOnline) break; // Network went down during processing
      
      op.status = 'SYNCING';
      await this.saveToQueue(op);

      const handler = this.syncHandlers.get(op.collection);
      
      if (!handler) {
        console.warn(`No sync handler registered for collection: ${op.collection}`);
        op.status = 'FAILED';
        op.error = 'No handler registered';
        await this.saveToQueue(op);
        continue;
      }

      try {
        await handler(op);
        // Success -> Remove from queue
        await this.removeOperation(op.id);
      } catch (err: any) {
        console.error(`Sync operation failed for ${op.collection}`, err);
        op.retryCount++;
        op.error = err.message || 'Unknown error';
        
        if (op.retryCount >= this.config.maxRetries) {
          op.status = 'FAILED';
          // Move to failed dead-letter queue or just mark as failed
        } else {
          op.status = 'PENDING';
        }
        await this.saveToQueue(op);
      }
    }
  }

  // --- Flexible Cache API ---

  public async setCache<T>(key: string, data: T, ttlMs: number = 1000 * 60 * 60 * 24): Promise<void> {
    if (!this.db) return;
    const expiresAt = Date.now() + ttlMs;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('cache', 'readwrite');
      const store = tx.objectStore('cache');
      const req = store.put({ key, data, expiresAt });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getCache<T>(key: string): Promise<T | null> {
    if (!this.db) return null;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('cache', 'readonly');
      const store = tx.objectStore('cache');
      const req = store.get(key);
      
      req.onsuccess = () => {
        const item = req.result;
        if (!item) return resolve(null);
        if (Date.now() > item.expiresAt) {
          this.invalidateCache(key);
          return resolve(null);
        }
        resolve(item.data as T);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async invalidateCache(key: string): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('cache', 'readwrite');
      const store = tx.objectStore('cache');
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

}

// Singleton export
export const offlineEngine = new OfflineEngine();
