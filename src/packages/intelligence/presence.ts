import { doc, setDoc, onSnapshot, serverTimestamp, collection, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase.js";
import { throttle } from "../core/utils.js";

export interface PresenceState {
  userId: string;
  displayName: string;
  photoURL?: string;
  status: 'active' | 'idle' | 'editing';
  contextString?: string;
  lastActive: number;
}

/**
 * Ecosystem Presence Engine
 * Handles silent collaboration markers using low-frequency firestore sync 
 * to adhere strictly to the "No Excessive Writes" rule.
 */
export class PresenceEngine {
  private orgId: string = '';
  private user: any = null;
  private isActive: boolean = false;
  private heartbeatInterval: any = null;
  private unsubListeners: (() => void)[] = [];

  // Low frequency sync (max 1 write every 30 seconds per user locally)
  private syncPresenceDb = throttle(async () => {
    if (!this.orgId || !this.user?.uid) return;
    
    const presenceRef = doc(db, `organizations/${this.orgId}/presence/${this.user.uid}`);
    try {
      await setDoc(presenceRef, {
        userId: this.user.uid,
        displayName: this.user.displayName || this.user.email || 'Usuário',
        photoURL: this.user.photoURL || null,
        status: this.isActive ? 'active' : 'idle',
        lastActive: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.warn("[Presence] Could not sync", e);
    }
  }, 30000);

  public initialize(user: any, orgId: string) {
    if (!user || !orgId) return;
    this.user = user;
    this.orgId = orgId;
    this.isActive = true;

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', this.markActive);
      window.addEventListener('keydown', this.markActive);
      window.addEventListener('blur', this.markIdle);
      window.addEventListener('focus', this.markActive);

      // Heartbeat pulse every 2 minutes if active
      this.heartbeatInterval = setInterval(() => {
        if (this.isActive) this.syncPresenceDb();
      }, 120000); 
      
      this.syncPresenceDb();
    }
  }

  public teardown() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', this.markActive);
      window.removeEventListener('keydown', this.markActive);
      window.removeEventListener('blur', this.markIdle);
      window.removeEventListener('focus', this.markActive);
      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
      
      this.unsubListeners.forEach(fn => fn());
      this.unsubListeners = [];
    }
  }

  private markActive = () => {
    if (!this.isActive) {
      this.isActive = true;
      this.syncPresenceDb();
    }
  };

  private markIdle = () => {
    if (this.isActive) {
      this.isActive = false;
      this.syncPresenceDb();
    }
  };

  /**
   * Subscribe to live organization presence peers
   */
  public subscribeToPeers(orgId: string, callback: (peers: PresenceState[]) => void): () => void {
    const presenceRef = collection(db, `organizations/${orgId}/presence`);
    
    const unsub = onSnapshot(presenceRef, (snapshot) => {
      const peers: PresenceState[] = [];
      const now = Date.now();
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const lastTs = data.lastActive?.toMillis() || now;
        
        // Silent Collaboration: Only show peers active within the last 5 minutes
        if (now - lastTs < 5 * 60 * 1000) {
          peers.push({
             userId: data.userId,
             displayName: data.displayName,
             photoURL: data.photoURL,
             status: data.status,
             lastActive: lastTs,
          });
        }
      });
      callback(peers);
    });

    this.unsubListeners.push(unsub);
    return unsub;
  }
}

export const presenceEngine = new PresenceEngine();
