import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase.js";
import { getDefaultPermissions, CURRENT_PERMISSIONS_VERSION } from "../lib/rbac.js";

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  products: string[];
  organizationId?: string;
  lastLoginAt: any;
  createdAt: any;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      console.warn("Firebase Auth not initialized. Missing API Key.");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Obter ou criar o perfil do usuário no Firestore
        const userRef = doc(db, "users", currentUser.uid);
        
        try {
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data() as UserProfile;
            
            // Check for pending invite logic if needed locally?
            const inviteOrgId = localStorage.getItem('invite_org_id');
            let mergeData: any = { lastLoginAt: serverTimestamp() };
            if (inviteOrgId && !userData.organizationId) {
              mergeData.organizationId = inviteOrgId;
              userData.organizationId = inviteOrgId;
              localStorage.removeItem('invite_org_id');
            }

            // Atualizar lastLoginAt e possível org
            await setDoc(userRef, mergeData, { merge: true });
            
            setProfile({ ...userData, lastLoginAt: new Date() });
          } else {
            // Criar novo usuário
            const inviteOrgId = localStorage.getItem('invite_org_id');
            const targetOrgId = inviteOrgId || currentUser.uid;

            const newProfile: Partial<UserProfile> = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              products: [],
              lastLoginAt: serverTimestamp(),
              createdAt: serverTimestamp(),
              organizationId: targetOrgId
            };
            
            await setDoc(userRef, newProfile);

            // Se é o dono dessa nova org (não foi convidado), cria a organization default dele
            if (!inviteOrgId) {
               const orgRef = doc(db, 'organizations', targetOrgId);
               await setDoc(orgRef, {
                 name: `Organização de ${currentUser.displayName || currentUser.email?.split('@')[0]}`,
                 ownerId: currentUser.uid,
                 createdAt: serverTimestamp()
               }, { merge: true });

               const orgMemberRef = doc(db, 'organization_members', `${currentUser.uid}_${targetOrgId}`);
               await setDoc(orgMemberRef, {
                 uid: currentUser.uid,
                 organizationId: targetOrgId,
                 role: 'owner',
                 permissionsVersion: CURRENT_PERMISSIONS_VERSION,
                 permissions: getDefaultPermissions('owner')
               }, { merge: true });
            }

            if (inviteOrgId) {
               localStorage.removeItem('invite_org_id');
            }

            setProfile(newProfile as UserProfile);
          }
        } catch (error) {
          console.error("Erro ao carregar ou criar perfil do usuário:", error);
        }
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
