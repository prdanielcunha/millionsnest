import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";

interface AuditLogPayload {
  actorUid: string;
  actorRole?: string;
  action: string;
  targetId?: string;
  organizationId: string;
  app?: string;
  metadata?: any;
}

export async function createAuditLog(payload: AuditLogPayload) {
  try {
    await addDoc(collection(db, "audit_logs"), {
      ...payload,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
    // Non-blocking for the app, just log error
  }
}
