import { diagnosticsEngine } from "./diagnostics.js";

interface SyncJob {
  id: string;
  payload: any;
  retryCount: number;
  timestamp: number;
  status: 'pending' | 'failed' | 'completed';
}

/**
 * Queue Integrity Engine & Cross-App Stability Layer
 */
class QueueIntegrityEngine {
  private static instance: QueueIntegrityEngine;
  private syncQueue: SyncJob[] = [];
  private readonly MAX_RETRIES = 5;
  private readonly BACKOFF_BASE_MS = 1000;

  private constructor() {
    this.restoreQueuePersisted();
  }

  public static getInstance() {
    if (!QueueIntegrityEngine.instance) {
      QueueIntegrityEngine.instance = new QueueIntegrityEngine();
    }
    return QueueIntegrityEngine.instance;
  }

  public enqueue(payload: any) {
    const job: SyncJob = {
      id: crypto.randomUUID(),
      payload,
      retryCount: 0,
      timestamp: Date.now(),
      status: 'pending'
    };
    this.syncQueue.push(job);
    this.persistQueue();
    this.processQueue();
  }

  private async processQueue() {
    const pendingJobs = this.syncQueue.filter(j => j.status === 'pending');
    for (const job of pendingJobs) {
      if (job.retryCount >= this.MAX_RETRIES) {
        job.status = 'failed';
        diagnosticsEngine.log(`Sync Job ${job.id} failed permanently (Queue Integrity)`, 'error', 'QueueLayer', { job });
        continue;
      }

      try {
        // Simulate execution
        await this.executeJob(job.payload);
        job.status = 'completed';
        this.removeFromQueue(job.id);
      } catch (err: any) {
        job.retryCount++;
        diagnosticsEngine.log(`Sync Job ${job.id} Failed: ${err.message}. Retrying...`, 'warn', 'QueueLayer', { job });
        
        // Safe backoff
        setTimeout(() => this.processQueue(), this.BACKOFF_BASE_MS * Math.pow(2, job.retryCount));
      }
      this.persistQueue();
    }
  }

  private async executeJob(payload: any) {
    // In actual implementation, this dispatches via eventBus or API
    return Promise.resolve();
  }

  private removeFromQueue(id: string) {
    this.syncQueue = this.syncQueue.filter(j => j.id !== id);
    this.persistQueue();
  }

  private persistQueue() {
    try {
      localStorage.setItem('mn_sync_queue', JSON.stringify({
        jobs: this.syncQueue,
        checksum: this.generateChecksum(this.syncQueue)
      }));
    } catch(e) {}
  }

  private restoreQueuePersisted() {
    try {
      const data = localStorage.getItem('mn_sync_queue');
      if (data) {
        const parsed = JSON.parse(data);
        const expectedChecksum = this.generateChecksum(parsed.jobs || []);
        
        // Queue Corruption Guards
        if (parsed.checksum !== expectedChecksum) {
          throw new Error('Queue integrity checksum mismatch. Data corruption detected.');
        }
        
        this.syncQueue = parsed.jobs || [];
        this.processQueue();
      }
    } catch(e: any) {
      diagnosticsEngine.log(`Failed to restore sync queue: ${e.message}`, 'fatal', 'QueueLayer');
      this.syncQueue = []; // Purge corrupted queue
    }
  }

  private generateChecksum(jobs: SyncJob[]): number {
    return jobs.reduce((acc, job) => acc + job.timestamp, 0);
  }

  public getQueueHealth() {
    return {
      size: this.syncQueue.length,
      pending: this.syncQueue.filter(j=>j.status==='pending').length,
      failed: this.syncQueue.filter(j=>j.status==='failed').length
    };
  }
}

export const queueIntegrity = QueueIntegrityEngine.getInstance();
