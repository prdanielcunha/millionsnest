import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { MillionsNestLogo } from '../components/MillionsNestLogo.js';
import { CURRENT_PERMISSIONS_VERSION, getDefaultPermissions } from '../lib/rbac.js';
import { resolveMusicScaleEntitlements, calculateOccupiedSlots } from '../lib/musicScalePlans.js';

export function Join() {
  const { orgId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user, profile, switchOrganization, loading: authLoading } = useAuth();
  
  const [status, setStatus] = useState<'loading' | 'validating' | 'success' | 'error' | 'already_member' | 'requesting_access' | 'access_requested'>('validating');
  const [errorMessage, setErrorMessage] = useState('');
  const [inviteData, setInviteData] = useState<any>(null);
  const [requestLoading, setRequestLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    
    // Se não estiver logado, manda pro login com retorno
    if (!user) {
      sessionStorage.setItem('mn_invite_redirect', `/join/${orgId}${token ? `?token=${token}` : ''}`);
      navigate(`/login?org=${orgId}&invite=true`);
      return;
    }

    validateAndAcceptInvite();
  }, [user, authLoading, orgId, token]);

  const handleRequestAccess = async () => {
    if (!user || !orgId) return;
    setRequestLoading(true);
    try {
       // Check if already requested
       const reqRef = doc(db, `organizations/${orgId}/join_requests`, user.uid);
       const reqSnap = await getDoc(reqRef);
       if (reqSnap.exists() && reqSnap.data().status === 'pending') {
          setStatus('access_requested');
          return;
       }

       await setDoc(reqRef, {
         uid: user.uid,
         email: user.email,
         displayName: profile?.displayName || user.email?.split('@')[0],
         photoURL: profile?.photoURL || '',
         status: 'pending',
         requestedAt: serverTimestamp()
       });
       setStatus('access_requested');
    } catch (e: any) {
       console.error(e);
       setStatus('error');
       setErrorMessage('Erro ao solicitar acesso. Tente novamente mais tarde.');
    } finally {
       setRequestLoading(false);
    }
  };

  const validateAndAcceptInvite = async () => {
    if (!orgId) {
      setStatus('error');
      setErrorMessage('Link inválido. Organização não identificada.');
      return;
    }

    if (!token) {
      const orgRef = doc(db, 'organizations', orgId);
      const orgSnap = await getDoc(orgRef);
      if (!orgSnap.exists()) {
        setStatus('error');
        setErrorMessage('Organização não encontrada.');
        return;
      }
      setInviteData({ organizationName: orgSnap.data().name });
      setStatus('requesting_access');
      return;
    }

    try {
      // Find invite by token
      const invitesRef = collection(db, `organizations/${orgId}/invites`);
      const q = query(invitesRef, where('tokenHash', '==', token));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setStatus('error');
        setErrorMessage('Convite não encontrado ou inválido.');
        return;
      }
      
      const inviteDoc = snap.docs[0];
      const invite = inviteDoc.data();
      setInviteData(invite);

      if (invite.status !== 'pending') {
        setStatus('error');
        setErrorMessage(invite.status === 'accepted' ? 'Este convite já foi aceito e utilizado.' : 'Este convite foi revogado ou expirou.');
        return;
      }

      const isExpired = invite.expiresAt ? invite.expiresAt.toMillis() < Date.now() : false;
      // Also enforce 7 days limit manually if expiresAt is missing
      const is7DaysOld = invite.createdAt ? (Date.now() - invite.createdAt.toMillis()) > 7 * 24 * 60 * 60 * 1000 : false;
      
      if (isExpired || is7DaysOld) {
        setStatus('error');
        setErrorMessage('Este convite expirou. Solicite um novo convite ao administrador da organização.');
        return;
      }

      // Check if user is already a member
      const memberRef = doc(db, `organizations/${orgId}/members`, user!.uid);
      const memberSnap = await getDoc(memberRef);
      
      if (memberSnap.exists()) {
        // Just switch and redirect
        await switchOrganization(orgId);
        setStatus('already_member');
        setTimeout(() => navigate('/dashboard'), 2000);
        return;
      }

      // Enforce user limits client-side securely during admission
      const membersRefAll = collection(db, `organizations/${orgId}/members`);
      const membersSnapAll = await getDocs(membersRefAll);
      const currentOrgMembers = membersSnapAll.docs.map(d => ({ id: d.id, ...d.data() }));

      const invitesRefAll = collection(db, `organizations/${orgId}/invites`);
      const invitesQAll = query(invitesRefAll, where('status', '==', 'pending'));
      const invitesSnapAll = await getDocs(invitesQAll);
      const currentOrgInvites = invitesSnapAll.docs.map(d => ({ id: d.id, ...d.data() }));

      const orgRef = doc(db, 'organizations', orgId);
      const orgSnap = await getDoc(orgRef);
      const orgData = orgSnap.exists() ? orgSnap.data() : null;

      const subRef = doc(db, 'subscriptions', orgId);
      const subSnap = await getDoc(subRef);
      const subData = subSnap.exists() ? subSnap.data() : null;

      const entitlements = resolveMusicScaleEntitlements({ subscription: subData, organization: orgData });
      const maxUsersLimit = entitlements?.limits?.users ?? 10;

      if (maxUsersLimit !== -1) {
        const slotsOccupied = calculateOccupiedSlots(currentOrgMembers, currentOrgInvites);
        if (slotsOccupied >= maxUsersLimit) {
          setStatus('error');
          setErrorMessage(`Limite de usuários excedido! A organização "${orgData?.name || 'Musica'}" atingiu o limite de ${maxUsersLimit} usuários permitidos pelo atual plano (${entitlements.name}). A admissão de novos integrantes está temporariamente bloqueada. Solicite ao administrador global que realize o upgrade de plano da organização.`);
          return;
        }
      }

      // Add user to organization
      let assignedRole = invite.role || 'member';
      if (assignedRole === 'owner') {
        // Prevent invite as owner in common flow to avoid multiple owners issue
        assignedRole = 'admin';
      }

      await setDoc(memberRef, {
        uid: user!.uid,
        email: user!.email,
        displayName: profile?.displayName || user!.email?.split('@')[0] || '',
        photoURL: profile?.photoURL || '',
        role: assignedRole,
        organizationRole: assignedRole,
        permissionsVersion: CURRENT_PERMISSIONS_VERSION,
        permissions: getDefaultPermissions(assignedRole),
        status: 'active',
        joinedAt: serverTimestamp(),
        invitedBy: invite.createdBy || 'system'
      }, { merge: true });

      // Update old member collection for legacy compat
      const legacyMemberRef = doc(db, "organization_members", `${user!.uid}_${orgId}`);
      await setDoc(legacyMemberRef, {
        role: assignedRole,
        organizationRole: assignedRole,
        permissionsVersion: CURRENT_PERMISSIONS_VERSION,
        permissions: getDefaultPermissions(assignedRole),
        addedAt: serverTimestamp()
      }, { merge: true });

      // Add org to user profile
      const userRef = doc(db, "users", user!.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
         const userData = userSnap.data();
         const orgs = userData.organizations || [];
         if (!orgs.includes(orgId)) {
            await updateDoc(userRef, {
               organizations: [...orgs, orgId],
               organizationId: orgId // switch to new org automatically
            });
         }
      }

      // Mark invite as accepted or update usage
      const newUsedCount = (invite.usedCount || 0) + 1;
      const maxUses = invite.maxUses || 1;
      
      await updateDoc(inviteDoc.ref, {
        usedCount: newUsedCount,
        status: newUsedCount >= maxUses ? 'accepted' : 'pending',
        acceptedBy: user!.uid,
        acceptedAt: serverTimestamp()
      });

      setStatus('success');
      
      // Clear redirect
      sessionStorage.removeItem('mn_invite_redirect');
      
      setTimeout(() => {
        // Ensure context switches correctly
        window.location.href = '/dashboard';
      }, 3000);

    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setErrorMessage(e.message || 'Ocorreu um erro ao processar o convite.');
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-[#2B85EB]/5 to-transparent pointer-events-none rounded-[2rem]" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-[#0B0F19]/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative text-center"
      >
        <div className="flex justify-center mb-8">
           <MillionsNestLogo className="h-10 w-auto" />
        </div>

        {status === 'validating' && (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="w-12 h-12 text-[#2B85EB] animate-spin mb-4" />
            <h2 className="text-[#F5F7FA] font-semibold text-lg">Validando convite...</h2>
            <p className="text-[#A0A7B5] text-sm mt-2">Por favor, aguarde um momento.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-[#F5F7FA] font-bold text-xl mb-2">Convite Aceito com Sucesso!</h2>
            <p className="text-[#A0A7B5] text-sm mb-8">
              Você agora faz parte da organização <strong className="text-white">{inviteData?.organizationName || 'do ecossistema'}</strong>.
            </p>
            <p className="text-xs text-[#A0A7B5] flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Redirecionando para o painel...
            </p>
          </div>
        )}

        {status === 'already_member' && (
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 bg-[#2B85EB]/10 text-[#2B85EB] rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-[#F5F7FA] font-bold text-xl mb-2">Tudo Certo!</h2>
            <p className="text-[#A0A7B5] text-sm mb-8">
              Você já fazia parte desta organização.
            </p>
            <p className="text-xs text-[#A0A7B5] flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Redirecionando...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6">
              <XCircle className="w-8 h-8" />
            </div>
            <h2 className="text-[#F5F7FA] font-bold text-xl mb-2">Convite Inválido</h2>
            <p className="text-[#A0A7B5] text-sm mb-8">{errorMessage}</p>
            
            <Link 
              to="/dashboard"
              className="w-full py-3 bg-white/5 text-[#F5F7FA] text-sm font-semibold rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              Ir para o meu Painel <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {status === 'requesting_access' && (
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 bg-[#2B85EB]/10 text-[#2B85EB] rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-[#F5F7FA] font-bold text-xl mb-2">Solicitar Acesso</h2>
            <p className="text-[#A0A7B5] text-sm mb-8">
              Você está solicitando acesso à organização <strong className="text-white">{inviteData?.organizationName || 'do ecossistema'}</strong>.
            </p>
            
            <button 
              onClick={handleRequestAccess}
              disabled={requestLoading}
              className="w-full py-3 mb-4 bg-[#2B85EB] hover:bg-[#2B85EB]/90 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {requestLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar Solicitação de Acesso'}
            </button>
            <Link 
              to="/dashboard"
              className="text-xs text-[#A0A7B5] hover:text-white transition-colors"
            >
              Cancelar e voltar
            </Link>
          </div>
        )}

        {status === 'access_requested' && (
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-[#F5F7FA] font-bold text-xl mb-2">Solicitação Enviada!</h2>
            <p className="text-[#A0A7B5] text-sm mb-8">
              Sua solicitação de acesso foi enviada para os administradores. Você receberá acesso assim que for aprovada.
            </p>
            
            <Link 
              to="/dashboard"
              className="w-full py-3 bg-white/5 text-[#F5F7FA] text-sm font-semibold rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              Retornar ao Painel <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
