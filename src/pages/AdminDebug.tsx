import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext.js";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { Navbar } from "../components/Navbar.js";

export default function AdminDebug() {
  const { user, profile } = useAuth();
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInternalData() {
      if (!user || !profile?.organizationId) return;
      try {
        const orgId = profile.organizationId;
        const orgRef = await getDoc(doc(db, "organizations", orgId));
        const subRef = await getDoc(doc(db, "subscriptions", orgId));
        
        const membersReq = await getDocs(collection(db, "organization_members"));
        const relatedMembers = membersReq.docs.filter(d => d.data().organizationId === orgId).map(d => ({id: d.id, ...d.data()}));
        
        setDebugData({
          userId: user.uid,
          activeOrganizationId: orgId,
          organization: orgRef.exists() ? orgRef.data() : null,
          subscription: subRef.exists() ? subRef.data() : null,
          members: relatedMembers,
          userProfile: profile
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadInternalData();
  }, [user, profile]);

  if (!user) return <div className="p-8 text-white">Acesso restrito</div>;
  
  if (loading) return <div className="p-8 text-white">Carregando painel de diagnóstico...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-[#F5F7FA]">
      <Navbar />
      <div className="max-w-4xl mx-auto pt-20 p-8">
        <h1 className="text-xl font-bold mb-8">System Diagnostic Panel [Internal]</h1>
        
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 overflow-x-auto">
          <pre className="text-xs text-[#A0A7B5]">
            {JSON.stringify(debugData, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
