import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";

export interface AuditLogPayload {
  actorUid: string;
  actorEmail?: string;
  actorRole?: string;
  actorSystemRole?: string;
  action: string;
  targetId?: string;
  targetUserId?: string;
  targetOrganizationId?: string;
  organizationId?: string;
  appKey?: string;
  app?: string;
  metadata?: any;
  source?: string;
}

export async function createAuditLog(payload: AuditLogPayload) {
  try {
    const colRef = payload.organizationId || payload.targetOrganizationId
      ? collection(db, `organizations/${payload.organizationId || payload.targetOrganizationId}/audit_logs`)
      : collection(db, "system_audit_logs");
      
    await addDoc(colRef, {
      ...payload,
      createdAt: serverTimestamp(),
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
    // Non-blocking for the app, just log error
  }
}
