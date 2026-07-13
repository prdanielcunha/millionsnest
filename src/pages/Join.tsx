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
  
  const [status, setStatus] = useState<'loading' | 'validating' | 'success' | 'error' | 'already_member'>('validating');
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



  const validateAndAcceptInvite = async () => {
    if (!user) {
      setStatus('error');
      setErrorMessage('Erro de sessão');
      return;
    }

    try {
      const idToken = await user.getIdToken();
      
      const res = await fetch('/api/v1/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ token })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setInviteData({ organizationName: data.organizationName });
        if (data.alreadyMember) {
           setStatus('already_member');
        } else {
           setStatus('success');
        }
        sessionStorage.removeItem('mn_invite_redirect');
        
        setTimeout(() => {
          // Tell context to refresh or just reload to get new profile 
          // For now window.location.href forces full bootstrap check with new member
          window.location.href = '/dashboard';
        }, 3000);
      } else {
        setStatus('error');
        if (data.reasonCode === 'INVITE_EXPIRED') setErrorMessage('Este convite expirou.');
        else if (data.reasonCode === 'INVITE_REVOKED') setErrorMessage('Este convite foi revogado.');
        else if (data.reasonCode === 'INVITE_ALREADY_CONSUMED') setErrorMessage('Este convite já foi utilizado.');
        else if (data.reasonCode === 'INVITE_IDENTITY_MISMATCH') setErrorMessage('Este convite não pertence a este email.');
        else if (data.reasonCode === 'MEMBER_LIMIT_REACHED') setErrorMessage('Esta organização atingiu o limite de membros do plano.');
        else if (data.reasonCode === 'INVITE_NOT_FOUND') setErrorMessage('Convite não encontrado ou inválido.');
        else if (data.reasonCode === 'ORGANIZATION_INACTIVE') setErrorMessage('A organização está inativa.');
        else setErrorMessage('Ocorreu um erro ao processar o convite.');
      }
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setErrorMessage('Erro de comunicação. Tente novamente.');
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


      </motion.div>
    </div>
  );
}
