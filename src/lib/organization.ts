import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase.js";

// Helper to reliably resolve an organization context server-side or purely via ID
export async function resolveOrganization(orgId: string) {
  if (!orgId) return null;
  
  try {
    const orgRef = doc(db, "organizations", orgId);
    const orgSnap = await getDoc(orgRef);
    if (!orgSnap.exists()) {
      return null;
    }
    return { id: orgSnap.id, ...orgSnap.data() };
  } catch (error) {
    console.error(`Failed to resolve organization ${orgId}:`, error);
    return null;
  }
}
