import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase.js";

/**
 * Organization Graph Models & Fetchers
 */

export interface MNGraphNode {
  id: string;
  type: 'user' | 'ministry' | 'team' | 'cell' | 'activity';
  label: string;
  metadata?: Record<string, any>;
}

export interface MNGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: 'leads' | 'member_of' | 'scheduled_for' | 'parent_of';
  metadata?: Record<string, any>;
}

export class MNGraph {
  
  /**
   * Fetches the structural dependencies of an organization level.
   * Future-proofing the architecture to allow deeply nested and queryable
   * organizational charts.
   */
  public static async queryNodeRelations(orgId: string, nodeId: string): Promise<MNGraphEdge[]> {
    try {
      const edgesRef = collection(db, `organizations/${orgId}/graph_edges`);
      const q = query(edgesRef, where("sourceId", "==", nodeId));
      const snap = await getDocs(q);
      
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as MNGraphEdge);
    } catch (error) {
      console.warn("Graph query failed (possibly uninitialized structure)", error);
      return [];
    }
  }

}
