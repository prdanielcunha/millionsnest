import { useState, useEffect, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../contexts/AuthContext.js";
import { Navigate, useNavigate, useParams, useLocation, useSearchParams } from "react-router-dom";
import { 
  Music, ArrowRight, Settings, ExternalLink, ShieldCheck, 
  CreditCard, LayoutGrid, User, Clock, AlertCircle, ChevronRight, Building2,
  Star, Zap, Headphones, Video, ListMusic, Check, Users, Link, Mail, Plus, X, Loader2, Copy, Wallet
} from "lucide-react";
import { Navbar } from "../components/Navbar.js";
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, collection, getDocs, query, where, addDoc, deleteDoc, limit, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { auth } from "../lib/firebase.js";
import { sendPasswordResetEmail } from "firebase/auth";
import { getDefaultPermissions, normalizePermissions, CURRENT_PERMISSIONS_VERSION } from "../lib/rbac.js";
import { analytics } from "../lib/analytics.js";
import { eventBus } from "../packages/events/index.js";
import { feedback } from '../packages/ui/feedback.js';
import { openEcosystemModule } from '../lib/ecosystemLauncher.js';
import { resolveMusicScaleEntitlements, calculateOccupiedSlots } from "../lib/musicScalePlans.js";
import { canPurchasePlanAgain, isSubscriptionValid, normalizeDateToMs } from "../lib/subscriptionHelpers.js";
import { isGlobalPrivilegedUser } from "../lib/permissionService.js";
import { resolveUserRoleDisplay } from "../lib/roleResolver.js";
import { createAuditLog } from "../lib/audit.js";
import { getInviteableOrganizationRolesForActor, getOrganizationRoleLabel } from "../lib/organizationRoles.js";

import { PremiumEmptyState } from "../packages/ui/empty-state.js";
import { EcosystemShell } from "../components/EcosystemShell.js";
import { EcosystemWorkspaceHome } from "../components/dashboard/EcosystemWorkspaceHome.js";
import { OrganizationManager } from "../components/OrganizationManager.js";
import { InviteModal } from "../components/InviteModal.js";
import { UnifiedTimeline } from "../components/UnifiedTimeline.js";
import { ECOSYSTEM_APPS, EcosystemApp } from "../lib/apps.js";
import { ecosystemPlatform } from "../sdk/ecosystem.js";
import { SupportHubProvider } from "../components/support/SupportHubContext.js";
import { SupportHub } from "../components/support/SupportHub.js";
import { MusicScaleAccessProjection } from "../lib/ecosystemAccessProjection.js";

type Tab = "overview" | "organization" | "account" | "billing";

const nestFinanceLaunchEnabled = import.meta.env.VITE_NESTFINANCE_LAUNCH_ENABLED === 'true';

const getVisualState = (sub: any) => {
  if (!sub) return 'none';
  const status = sub.status || '';
  const cancelAtPeriodEnd = sub.cancelAtPeriodEnd === true;
  
  if (status === 'trialing') {
     if (cancelAtPeriodEnd) return 'cancel_scheduled';
     return 'trialing';
  }
  if (status === 'active') {
     if (cancelAtPeriodEnd) return 'cancel_scheduled';
     return 'active';
  }
  if (status === 'canceled') {
     return 'canceled_expired';
  }
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') {
     return 'past_due';
  }
  
  return status; // fallback
};

export function Dashboard() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { user, profile, loading, logout, switchOrganization, canonicalContext } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSection = searchParams.get('section');
  const validSections = ['overview', 'resources', 'getting-started'];
  const activeSection = validSections.includes(rawSection) ? rawSection : 'overview';
  
  const handleSelectMusicScaleSection = (section: 'overview' | 'resources' | 'getting-started') => {
    setSearchParams({ section });
  };
  
  const onNavigateToOrganizationSettings = () => {
    navigate('/dashboard/organization');
  };
  const { tab, subTab } = useParams();
  
  const activeOrgId = canonicalContext?.activeOrganizationId || profile?.organizationId;
  const userOrgs = canonicalContext?.organizations || 
     (profile?.organizations ? profile.organizations.map((id: string) => ({ id, name: `Org ID: ${id.substring(0,8)}` })) : []);
  
  // Mapping specific routes to internal tabs
  let initialTab: Tab = "overview";
  if (tab === "organization" || tab === "team") initialTab = "organization";
  else if (tab === "billing") initialTab = "billing";
  else if (tab === "account") initialTab = "account";
  else if (tab === "apps") initialTab = "overview";

  const [activeTab, setActiveTabInternal] = useState<Tab>(initialTab);
  
  // Custom setter to update URL
  const setActiveTab = (newTab: Tab) => {
    setActiveTabInternal(newTab);
    navigate(`/dashboard/${newTab}`);
  };

  useEffect(() => {
    if (tab && initialTab !== activeTab) {
      setActiveTabInternal(initialTab);
    }
    
    
  }, [tab]);

  const [subscription, setSubscription] = useState<any>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [musicScaleProjection, setMusicScaleProjection] = useState<MusicScaleAccessProjection | null>(null);
  const [musicScaleProjectionLoading, setMusicScaleProjectionLoading] = useState(false);
  const [musicScaleProjectionError, setMusicScaleProjectionError] = useState<string | null>(null);
  const musicScaleProjectionAbortControllerRef = useRef<AbortController | null>(null);
  const musicScaleProjectionSeqRef = useRef<number>(0);
  const musicScaleExpectedOrgRef = useRef<string | null>(null);

  const refreshMusicScaleAccessProjection = async (orgId: string) => {
    if (!user || !orgId) return;

    if (musicScaleProjectionAbortControllerRef.current) {
      musicScaleProjectionAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    musicScaleProjectionAbortControllerRef.current = abortController;
    const reqSeq = ++musicScaleProjectionSeqRef.current;
    musicScaleExpectedOrgRef.current = orgId;

    setMusicScaleProjectionLoading(true);
    setMusicScaleProjectionError(null);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/ecosystem/access-projection', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        },
        body: JSON.stringify({ organizationId: orgId }),
        signal: abortController.signal
      });

      if (!res.ok) {
        throw new Error('Falha ao obter projeção');
      }

      const data = await res.json();
      
      if (abortController.signal.aborted || reqSeq !== musicScaleProjectionSeqRef.current || musicScaleExpectedOrgRef.current !== orgId) return;
      
      if (data.success && data.organizationId === orgId && data.apps?.musicscale?.appId === 'musicscale' && data.apps.musicscale.organizationId === orgId) {
        setMusicScaleProjection(data.apps.musicscale);
      } else {
        throw new Error('Projeção inválida');
      }
    } catch (e: any) {
      if (abortController.signal.aborted || reqSeq !== musicScaleProjectionSeqRef.current || musicScaleExpectedOrgRef.current !== orgId) return;
      setMusicScaleProjectionError(e.message || 'Erro');
      setMusicScaleProjection(null);
    } finally {
      if (!abortController.signal.aborted && reqSeq === musicScaleProjectionSeqRef.current && musicScaleExpectedOrgRef.current === orgId) {
        setMusicScaleProjectionLoading(false);
      }
    }
  };
  
  // Organization Edit States
  const [isEditingOrg, setIsEditingOrg] = useState(false);
  const [orgNameInput, setOrgNameInput] = useState("");
  const [orgSlugInput, setOrgSlugInput] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);
  
  // Profile Edit States
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Edit Member States
  const [editingMember, setEditingMember] = useState<any>(null);
  const [editingMemberName, setEditingMemberName] = useState("");
  const [editingMemberPhoto, setEditingMemberPhoto] = useState("");
  const [editingMemberRole, setEditingMemberRole] = useState("");
  const [editingMemberAppRole, setEditingMemberAppRole] = useState("");
  const [editingMemberSaving, setEditingMemberSaving] = useState(false);

  const [configAppModal, setConfigAppModal] = useState<EcosystemApp | null>(null);

  const [repairing, setRepairing] = useState(false);
  const [subscriptionRepairAvailable, setSubscriptionRepairAvailable] = useState(false);

  const [subscriptionBlockedApp, setSubscriptionBlockedApp] = useState<EcosystemApp | null>(null);
  const [subscriptionBlockedReason, setSubscriptionBlockedReason] = useState<string | null>(null);
  const [verifyingStripe, setVerifyingStripe] = useState(false);

  const handleLaunchEcosystemApp = async (app: EcosystemApp, permsMap: Record<string, boolean>) => {
    analytics.track('app_usage', { userId: user?.uid, organizationId: profile?.organizationId, app: app.id });
    if (!profile || !organization) {
      feedback.error('Erro de Sessão: Sessão do ecossistema inválida ou expirada.');
      return;
    }
    
    if (app.id === 'musicscale') {
      if (
        !musicScaleProjection ||
        musicScaleProjection.organizationId !== activeContextOrgId ||
        !musicScaleProjection.accessible ||
        musicScaleProjectionLoading ||
        musicScaleProjectionError
      ) {
        feedback.error('Acesso indisponível ao MusicScale.');
        return;
      }
    } else if (!organization?.enabledApps?.includes(app.id)) {
       feedback.error(`Módulo Indisponível: O aplicativo ${app.name} não está habilitado para a sua organização.`);
       return;
    }
    
    // Mostrando feedback enquanto processa o handoff
    const toastId = feedback.loading(`Verificando credenciais para o ${app.name}...`);
    try {
      if (isGlobalAdmin && profile?.organizationRole !== 'owner' && app.id !== 'musicscale') {
         createAuditLog({
           actorUid: user!.uid,
           actorEmail: user!.email || '',
           actorSystemRole: profile?.systemRole,
           action: 'admin_bypassed_app_launch',
           targetOrganizationId: activeContextOrgId,
           appKey: app.id,
           source: 'global_admin'
         });
      }
      await openEcosystemModule(app.id, user, profile, organization, permsMap);
      feedback.dismiss(toastId);
    } catch (e: any) {
      feedback.dismiss(toastId);
      if (app.id !== 'musicscale' && isGlobalAdmin) {
        feedback.error(`Erro ao abrir: ${e.message || 'Falha ao iniciar módulo.'}`);
      } else {
        setSubscriptionBlockedApp(app);
        setSubscriptionBlockedReason(e.message || 'Assinatura inválida ou inativa.');
      }
    }
  };

  useEffect(() => {
    if (user) {
      analytics.track('page_view', {
        userId: user.uid,
        organizationId: profile?.organizationId,
        metadata: { path: '/dashboard' }
      });
    }
  }, [user]);

  const [nestFinanceLaunching, setNestFinanceLaunching] = useState(false);

  const handleLaunchNestFinance = async () => {
    if (!user || !activeContextOrgId || nestFinanceLaunching) return;

    setNestFinanceLaunching(true);
    const toastId = feedback.loading("Preparando acesso...");
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/ecosystem/nestfinance/handoff/issue', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store'
        },
        body: JSON.stringify({ organizationId: activeContextOrgId })
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("Sua sessão expirou. Entre novamente.");
        if (res.status === 403) throw new Error("Você não possui acesso ao NestFinance.");
        if (res.status === 503) throw new Error("O NestFinance está temporariamente indisponível.");
        throw new Error("Não foi possível abrir o NestFinance.");
      }

      const data = await res.json();
      if (!data.redirectUrl || typeof data.redirectUrl !== 'string') {
        throw new Error("Não foi possível abrir o NestFinance.");
      }

      const urlObj = new URL(data.redirectUrl);
      const isHttps = urlObj.protocol === 'https:';
      const isLocalhost = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1';
      
      if (!isHttps && !(import.meta.env.DEV && isLocalhost)) {
        throw new Error("Não foi possível abrir o NestFinance.");
      }
      
      if (!urlObj.pathname.endsWith('/auth/handoff')) {
         throw new Error("Não foi possível abrir o NestFinance.");
      }

      const codeParam = urlObj.searchParams.get('code');
      if (!codeParam || Array.from(urlObj.searchParams.keys()).length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(codeParam)) {
          throw new Error("Não foi possível abrir o NestFinance.");
      }

      window.location.assign(data.redirectUrl);
    } catch (e: any) {
      feedback.error(e.message || "Não foi possível abrir o NestFinance.");
    } finally {
      setNestFinanceLaunching(false);
      feedback.dismiss(toastId);
    }
  };

  const handleRepairAccount = async () => {
    if (!user) return;
    setRepairing(true);
    try {
      const token = await user.getIdToken(true);
      if (!activeContextOrgId) { feedback.error("Nenhuma organização ativa encontrada."); return; }
      const res = await fetch(`/api/repair/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success || data.repaired) {
        feedback.success("Assinatura sincronizada com sucesso.");
        if(activeContextOrgId) syncSubscriptionWithStripe(activeContextOrgId); // Sincroniza estado sem reload
      } else {
        feedback.error(`Falha ao sincronizar: ${data.message || data.error || 'A conta não possui assinaturas ativas para serem verificadas.'}`);
        console.error("Repair response:", data);
      }
    } catch (e: any) {
      feedback.error(`Falha na comunicação para verificar a conta: ${e.message}`);
    } finally {
      setRepairing(false);
    }
  };

  // Invite Link states
  const [copiedLink, setCopiedLink] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const [prices, setPrices] = useState({ 
    starter_monthly: 0,
    starter_annual: 0,
    advanced_monthly: 0,
    advanced_annual: 0,
    pro_monthly: 0, 
    pro_annual: 0,
    setup_premium: 0,
    training_express: 0,
    worship_100: 0,
    music_pack_10: 0
  });
  const [plansData, setPlansData] = useState<any[]>([]);
  const [addonsData, setAddonsData] = useState<any[]>([]);
  const [isAnnual, setIsAnnual] = useState(true);

  const [adminSelectedOrgId, setAdminSelectedOrgId] = useState<string | null>(null);
  const isGlobalAdmin = isGlobalPrivilegedUser(profile);
  const activeContextOrgId = isGlobalAdmin && adminSelectedOrgId 
    ? adminSelectedOrgId 
    : canonicalContext?.activeOrganizationId 
      || profile?.activeOrganizationId 
      || profile?.primaryOrganizationId 
      || profile?.organizationId;
    
  const canLaunchNestFinance = isGlobalAdmin && nestFinanceLaunchEnabled && !nestFinanceLaunching;

  useEffect(() => {
    if (isGlobalAdmin && adminSelectedOrgId && user) {
       createAuditLog({
         actorUid: user.uid,
         actorEmail: user.email || '',
         actorSystemRole: profile?.systemRole,
         action: 'admin_accessed_organization',
         targetOrganizationId: adminSelectedOrgId,
         source: 'global_admin'
       });
    }
  }, [adminSelectedOrgId, isGlobalAdmin, user?.uid]);

  const openBillingPortal = async () => {
    if (!user) return;
    try {
      setCheckoutLoading(true);
      analytics.track('checkout_started', {
        userId: user.uid,
        organizationId: profile?.organizationId,
        metadata: { type: 'portal' }
      });
      const res = await fetch('/api/v1/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        if (res.status === 404 || res.status === 500 || data.error?.includes('Stripe não encontrado') || data.error?.includes('No such customer')) {
          feedback.success('Inconsistência identificada na conta. Sincronizando e reparando acesso...');
          if(activeContextOrgId) await syncSubscriptionWithStripe(activeContextOrgId);
          return;
        }
        feedback.error(data.error || 'Erro ao carregar o portal. Verifique sua assinatura.');
      }
    } catch (e) {
      console.error(e);
      feedback.error('Erro de comunicação.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const reactivateSubscription = async () => {
    if (!user) return;
    try {
      setCheckoutLoading(true);
      const token = await user.getIdToken();
      const organizationId = activeContextOrgId;
      
      const res = await fetch('/api/v1/billing/reactivate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ organizationId })
      });
      
      if (res.status === 401) {
        feedback.error('Sua sessão expirou. Atualize a página e tente novamente.');
        setCheckoutLoading(false);
        return;
      }
      const data = await res.json();
      
      if (data.action === 'checkout_required') {
         const plan = subscription?.plan || 'pro';
         window.location.href = `/checkout?plan=musicscale_${plan}_monthly`;
         return;
      }
      
      if (data.action === 'payment_required') {
         openBillingPortal(); // Send to portal to update card
         return;
      }

      if (res.ok) {
        feedback.success('Sua assinatura continuará ativa.');
        if(activeContextOrgId) await syncSubscriptionWithStripe(activeContextOrgId);
      } else {
        feedback.error(data.error || 'Erro ao reativar assinatura.');
      }
    } catch (e) {
      console.error(e);
      feedback.error('Erro de comunicação ao reativar.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const requestSequenceRef = useRef<number>(0);
  const currentActiveOrgIdRef = useRef<string | null>(null);

  const loadOrganizationData = async (orgId: string, requestId: number) => {
    if (!user || !orgId) return;
    try {
      const subRef = doc(db, "subscriptions", orgId);
      const subSnap = await getDoc(subRef);

      if (requestId !== requestSequenceRef.current || orgId !== currentActiveOrgIdRef.current) return;

      let currentSubData = null;
      if (subSnap.exists()) {
         currentSubData = subSnap.data();
         setSubscription(currentSubData as any);
      } else {
         setSubscription(null);
      }

      let currentOrgData: any = null;
      let currentMembers: any[] = [];
      const orgRef = doc(db, "organizations", orgId);
      const orgSnap = await getDoc(orgRef);
      
      if (orgSnap.exists()) {
          currentOrgData = { id: orgSnap.id, ...orgSnap.data() };
          try {
            const membersRef = collection(db, `organizations/${orgId}/members`);
            const membersSnap = await getDocs(membersRef);
            const memsPromises = membersSnap.docs.map(async (d): Promise<any> => {
               let data = d.data();
               let userData = {};
               try {
                 let userSnap = await getDoc(doc(db, "users", data.uid || d.id));
                 if (userSnap.exists()) userData = userSnap.data();
               } catch (userErr: any) {}
               return { id: d.id, ...userData, ...data };
            });
            currentMembers = await Promise.all(memsPromises);
          } catch (memErr) {
            if (isGlobalAdmin) {
              const token = await user.getIdToken();
              const memRes = await fetch(`/api/admin/organizations/${orgId}/members`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (memRes.ok) {
                const { members: adminMembers } = await memRes.json();
                currentMembers = adminMembers;
              }
            }
          }
      } else if (isGlobalAdmin) {
           const token = await user.getIdToken();
           const res = await fetch(`/api/admin/organizations`, {
              headers: { 'Authorization': `Bearer ${token}` }
           });
           if (res.ok) {
             const { organizations: adminOrgs } = await res.json();
             const found = adminOrgs.find((o: any) => o.id === orgId);
             if (found) {
               currentOrgData = found;
               const memRes = await fetch(`/api/admin/organizations/${orgId}/members`, {
                  headers: { 'Authorization': `Bearer ${token}` }
               });
               if (memRes.ok) {
                  const { members: adminMembers } = await memRes.json();
                  currentMembers = adminMembers;
               }
             }
           }
      }

      if (requestId !== requestSequenceRef.current || orgId !== currentActiveOrgIdRef.current) return;
      if (currentOrgData) setOrganization(currentOrgData);

      if (currentMembers.length > 0) {
        let currentUserMem = currentMembers.find(m => m.id === user.uid);
        const isOwnerUid = currentOrgData?.ownerUid === user.uid;
        if (currentUserMem && isOwnerUid && currentUserMem.role !== 'owner') {
            currentUserMem.role = 'owner';
            setDoc(doc(db, `organizations/${orgId}/members`, user.uid), { role: 'owner', organizationRole: 'owner' }, { merge: true }).catch(console.error);
        } else if (!currentUserMem && isOwnerUid) {
            const currentUserSnap = await getDoc(doc(db, "users", user.uid));
            const currentUserProfile = currentUserSnap.exists() ? currentUserSnap.data() : {};
            currentMembers.push({
              id: user.uid, uid: user.uid, role: 'owner', ...currentUserProfile
            });
            setDoc(doc(db, `organizations/${orgId}/members`, user.uid), {
              uid: user.uid, role: 'owner', organizationRole: 'owner', addedAt: new Date()
            }, { merge: true }).catch(console.error);
        }
        setMembers(currentMembers);
      } else {
        setMembers([]);
      }

      try {
        const invitesRef = collection(db, `organizations/${orgId}/invites`);
        const invitesQ = query(invitesRef, where('status', '==', 'pending'));
        const invitesSnap = await getDocs(invitesQ);
        setPendingInvites(invitesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {}

      try {
        const joinReqRef = collection(db, `organizations/${orgId}/join_requests`);
        const joinReqQ = query(joinReqRef, where('status', '==', 'pending'));
        const joinReqSnap = await getDocs(joinReqQ);
        setJoinRequests(joinReqSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {}

      try {
        const auditRef = collection(db, `organizations/${orgId}/audit_logs`);
        const auditQ = query(auditRef, limit(5));
        const auditSnap = await getDocs(auditQ);
        const audits = auditSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        audits.sort((a: any, b: any) => {
          const tA = a.timestamp?.seconds || 0;
          const tB = b.timestamp?.seconds || 0;
          return tB - tA;
        });
        setAuditLogs(audits);
      } catch(err) {}

    } catch (error) {
      if (requestId === requestSequenceRef.current && orgId === currentActiveOrgIdRef.current) {
        setSubscription(null);
        setOrganization(null);
      }
    } finally {
      if (requestId === requestSequenceRef.current && orgId === currentActiveOrgIdRef.current) {
        setLoadingSub(false);
        window.performance?.mark?.('dashboard_interactive');
      }
    }
  };

  const syncSubscriptionWithStripe = async (orgId: string, passedSessionId?: string) => {
     if (!user || !orgId) return;
     const requestId = ++requestSequenceRef.current;
     currentActiveOrgIdRef.current = orgId;
     
     setLoadingSub(true);
     try {
         const token = await user.getIdToken();
         const syncRes = await fetch('/api/v1/billing/sync', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ organizationId: orgId, sessionId: passedSessionId })
         });
         
         if (syncRes.ok) {
            const syncData = await syncRes.json();
            if (syncData.organizationId === orgId) {
               // Success
            }
         }
     } catch (e) {
         console.error("[Dashboard] Background sync failed.");
     }

     await loadOrganizationData(orgId, requestId);
     await refreshMusicScaleAccessProjection(orgId);
  };
  useEffect(() => {
    if (organization?.name) {
      setOrgNameInput(organization.name);
    }
    if (organization?.slug) {
      setOrgSlugInput(organization.slug);
    }
  }, [organization]);

  useEffect(() => {
    if (profile?.displayName) {
      setProfileNameInput(profile.displayName);
    }
  }, [profile]);
  
  const handleSaveOrg = async () => {
    if (!user || !orgNameInput.trim()) return;
    setSavingOrg(true);
    try {
      const orgId = activeContextOrgId;
      const token = await user.getIdToken();
      const res = await fetch('/api/user/organization', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ orgId, name: orgNameInput, slug: orgSlugInput })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setOrganization({ ...organization, name: orgNameInput, slug: orgSlugInput });
      setIsEditingOrg(false);
      try {
        const stored = localStorage.getItem('mn_org_context');
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.organization = { ...parsed.organization, name: orgNameInput, slug: orgSlugInput };
          localStorage.setItem('mn_org_context', JSON.stringify(parsed));
        }
      } catch (lsErr) {
        console.warn("[Dashboard] Silently caught cache update failure:", lsErr);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao salvar organização: ${e.message}`);
    } finally {
      setSavingOrg(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user || !profileNameInput.trim()) return;
    setSavingProfile(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { displayName: profileNameInput });
      setIsEditingProfile(false);
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar perfil.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    try {
      const targetMember = members.find(m => m.id === memberId);
      if (!targetMember) return;
      if (!user) return;

      const token = await user.getIdToken();
      const orgId = activeContextOrgId;
      
      const res = await fetch(`/api/organizations/${orgId}/members/${memberId}/role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newRole })
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(`Erro: ${errorData.error}`);
        return;
      }

      const perms = getDefaultPermissions(newRole);
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole, permissions: perms, permissionsVersion: CURRENT_PERMISSIONS_VERSION } : m));
    } catch (e) {
      console.error("Erro ao atualizar função", e);
      alert("Houve um problema ao tentar atualizar a função do membro. Verifique suas permissões.");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const targetMember = members.find(m => m.id === memberId);
      if (!targetMember) return;

      if (targetMember.role === 'owner') {
         if (profile?.organizationRole !== 'owner' && !isGlobalAdmin) {
            alert("Ação negada: Somente o dono ou o suporte global pode remover um dono da organização.");
            return;
         }

         const ownersCount = members.filter(m => m.role === 'owner').length;
         if (ownersCount <= 1) {
            alert("Ação negada: Não é possível remover o único dono da organização. Transfira a posse antes.");
            return;
         }
      }

      if (memberId === user?.uid) {
         if (!confirm("Tem certeza que deseja sair desta organização? Você perderá acesso aos módulos.")) {
            return;
         }
      } else {
         if (!confirm(`Remover ${targetMember.displayName || 'este usuário'} da organização?`)) {
            return;
         }
      }

      const orgId = activeContextOrgId;
      
      // Remove from new architecture
      await deleteDoc(doc(db, `organizations/${orgId}/members`, memberId));
      
      // Also clean legacy
      await deleteDoc(doc(db, "organization_members", `${memberId}_${orgId}`));

      // Also remove org from user's array
      const userRef = doc(db, "users", memberId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
         const userData = userSnap.data();
         if (userData.organizations) {
            const orgs = userData.organizations.filter((id: string) => id !== orgId);
            await updateDoc(userRef, { organizations: orgs });
         }
      }

      setMembers(prev => prev.filter(m => m.id !== memberId));

      if (isGlobalAdmin && profile?.organizationRole !== 'owner') {
        createAuditLog({
           actorUid: user!.uid,
           actorEmail: user!.email || '',
           actorSystemRole: profile?.systemRole,
           action: 'admin_removed_member',
           targetOrganizationId: orgId,
           targetUserId: memberId,
           metadata: { removedRole: targetMember.role },
           source: 'global_admin'
        });
      }
      
      if (memberId === user?.uid) {
         // User removed themselves, redirect or clear org
         window.location.href = '/dashboard';
      }
    } catch (e) {
      console.error("Erro ao remover membro", e);
      alert("Houve um problema ao remover o membro. Verifique suas permissões.");
    }
  };

  const handleSaveMemberEdit = async () => {
    if (!editingMember || !user) return;
    setEditingMemberSaving(true);
    try {
      const orgId = activeContextOrgId;
      const token = await user.getIdToken();
      const res = await fetch(`/api/organizations/${orgId}/members/${editingMember.id}/profile`, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
         body: JSON.stringify({ 
           displayName: editingMemberName,
           photoURL: editingMemberPhoto,
           role: editingMemberRole,
           appRole: editingMemberAppRole
         })
      });

      if (!res.ok) {
         const errorData = await res.json();
         alert(`Erro: ${errorData.error}`);
         return;
      }
      
      setMembers(prev => prev.map(m => m.id === editingMember.id ? { 
        ...m, 
        displayName: editingMemberName, 
        photoURL: editingMemberPhoto,
        role: editingMemberRole,
        appRole: editingMemberAppRole
      } : m));
      setEditingMember(null);
      feedback.success("Dados do membro atualizados.");
    } catch (e) {
      console.error(e);
      alert("Erro ao atualizar o membro.");
    } finally {
      setEditingMemberSaving(false);
    }
  };

  const handleSendMemberPasswordReset = async () => {
    if (!editingMember?.email) return;
    try {
      await sendPasswordResetEmail(auth, editingMember.email);
      feedback.success(`E-mail de redefinição de senha enviado para ${editingMember.email}.`);
    } catch (e: any) {
      console.error(e);
      alert("Erro ao enviar e-mail de redefinição de senha.");
    }
  };

  const handleCreateInvite = async (
    role: "admin" | "member",
    email: string,
    overrideOrgId?: string
  ): Promise<{
    inviteUrl: string;
    invitation: {
      id: string;
      organizationId: string;
      organizationName: string;
      email: string;
      role: "admin" | "member";
      status: "pending";
      expiresAtMs: number;
    };
  }> => {
    if (!user) throw new Error("UNAUTHENTICATED");
    const orgId = overrideOrgId || activeContextOrgId;
    if (!email) throw new Error("INVALID_INVITE_EMAIL");

    const idToken = await user.getIdToken();
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 10000);

    let res;
    try {
      res = await fetch('/api/v1/invitations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId: orgId,
          email,
          role
        }),
        signal: abortController.signal
      });
    } catch (e: any) {
      if (e.name === 'AbortError') {
         throw new Error("TIMEOUT");
      }
      throw new Error("GENERIC");
    } finally {
      clearTimeout(timeoutId);
    }

    const data = await res.json();
    if (!res.ok || data.success !== true) {
      throw new Error(data.reasonCode || "GENERIC");
    }

    if (typeof data.invitePath !== 'string' || !data.invitePath.startsWith('/join/')) {
       throw new Error("GENERIC");
    }
    
    if (!data.invitation || !data.invitation.id || !data.invitation.organizationId) {
       throw new Error("GENERIC");
    }

    const finalUrl = new URL(data.invitePath, window.location.origin);
    if (finalUrl.origin !== window.location.origin) {
       throw new Error("GENERIC");
    }

    setPendingInvites(prev => {
      if (prev.some(inv => inv.id === data.invitation.id)) return prev;
      return [...prev, data.invitation];
    });

    return {
      inviteUrl: finalUrl.toString(),
      invitation: data.invitation
    };
  };

  const handleAcceptJoinRequest = async (requestId: string) => {
    try {
      const orgId = activeContextOrgId;
      const requestRef = doc(db, `organizations/${orgId}/join_requests`, requestId);
      const reqSnap = await getDoc(requestRef);
      if (!reqSnap.exists()) return;
      
      const reqData = reqSnap.data();
      
      // Enforce user limits client-side securely
      const entitlements = resolveMusicScaleEntitlements({ subscription, organization, userProfile: profile });
      const maxUsersLimit = entitlements?.limits?.users ?? 10;
      const occupiedSlots = calculateOccupiedSlots(members, pendingInvites);
      
      if (maxUsersLimit !== -1 && occupiedSlots >= maxUsersLimit) {
        alert(`Limite de usuários atingido! Faça o upgrade do seu plano para liberar mais vagas.`);
        return;
      }

      await updateDoc(requestRef, {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: user?.uid
      });

      const memberRef = doc(db, `organizations/${orgId}/members`, requestId);
      await setDoc(memberRef, {
        uid: requestId,
        email: reqData.email || '',
        displayName: reqData.displayName || '',
        photoURL: reqData.photoURL || '',
        role: 'member',
        organizationRole: 'member',
        permissionsVersion: CURRENT_PERMISSIONS_VERSION,
        permissions: getDefaultPermissions('member'),
        status: 'active',
        joinedAt: serverTimestamp(),
        invitedBy: user?.uid || 'system'
      }, { merge: true });

      const legacyMemberRef = doc(db, "organization_members", `${requestId}_${orgId}`);
      await setDoc(legacyMemberRef, {
        role: 'member',
        organizationRole: 'member',
        permissionsVersion: CURRENT_PERMISSIONS_VERSION,
        permissions: getDefaultPermissions('member'),
        addedAt: serverTimestamp()
      }, { merge: true });

      // Modifies target user's organizations array
      const userRef = doc(db, "users", requestId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
         const userData = userSnap.data();
         const orgs = userData.organizations || [];
         if (!orgs.includes(orgId)) {
            await updateDoc(userRef, {
               organizations: [...orgs, orgId]
            });
         }
      }

      setJoinRequests(prev => prev.filter(r => r.id !== requestId));
      
      // refresh members
      const newMemberSnap = await getDoc(memberRef);
      if (newMemberSnap.exists()) {
        setMembers(prev => [...prev, { id: newMemberSnap.id, ...newMemberSnap.data() }]);
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao aceitar solicitação.");
    }
  };

  const handleRejectJoinRequest = async (requestId: string) => {
    try {
      const orgId = activeContextOrgId;
      const requestRef = doc(db, `organizations/${orgId}/join_requests`, requestId);
      await updateDoc(requestRef, {
        status: 'rejected',
        rejectedAt: serverTimestamp(),
        rejectedBy: user?.uid
      });
      setJoinRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (e) {
      console.error(e);
      alert("Erro ao rejeitar solicitação.");
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      const orgId = activeContextOrgId;
      const inviteRef = doc(db, `organizations/${orgId}/invites`, inviteId);
      await updateDoc(inviteRef, {
        status: 'revoked',
        revokedAt: serverTimestamp(),
        revokedBy: user?.uid
      });
      setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch (e) {
      console.error(e);
      alert("Erro ao revogar convite.");
    }
  };

  useEffect(() => {
    const handleInviteAction = () => {
       setIsInviteModalOpen(true);
       setActiveTab("organization"); // Switch to team/org view
    };
    eventBus.subscribe('action.contextual.invite_member', handleInviteAction);
    return () => {
       eventBus.unsubscribe('action.contextual.invite_member', handleInviteAction);
    };
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const addonSuccess = urlParams.get('addon_success');

    if (addonSuccess) {
      window.history.replaceState({}, document.title, window.location.pathname);
      console.log('Returned from Addon checkout:', addonSuccess);
      
      analytics.track('checkout_completed', {
        userId: user?.uid,
        organizationId: profile?.organizationId,
        metadata: { type: 'addon', product: addonSuccess }
      });

      eventBus.publish('billing.subscription.upgraded' as any, {
        organizationId: profile?.organizationId || '',
        userId: user?.uid || '',
        appSource: 'core',
        isPublicTimeline: true,
        title: 'Resource Add-on Adquirido',
        description: addonSuccess.replace(/_/g, ' ')
      });
      
      alert(`Compra de ${addonSuccess.replace(/_/g, ' ')} concluída com sucesso! Obrigado!`);
      setLoadingSub(true);
      if(activeContextOrgId) syncSubscriptionWithStripe(activeContextOrgId);
      return;
    }

    if (sessionId) {
      window.history.replaceState({}, document.title, window.location.pathname);
      console.log('Returned from Stripe session:', sessionId);
      
      analytics.track('checkout_completed', {
        userId: user?.uid,
        organizationId: profile?.organizationId,
        metadata: { type: 'subscription', sessionId }
      });

      eventBus.publish('billing.subscription.upgraded' as any, {
        organizationId: profile?.organizationId || '',
        userId: user?.uid || '',
        appSource: 'core',
        isPublicTimeline: true,
        title: 'Assinatura Atualizada',
        description: 'Nova configuração de plano ativada'
      });
      
      // TODO: Criar suporte visual futuro no MillionsNest: "Cupom aplicado com sucesso"
      // Aqui podemos checar se houve desconto na session e exibir uma notificação.
      setLoadingSub(true);
      if(activeContextOrgId) syncSubscriptionWithStripe(activeContextOrgId, sessionId); // Forçar sync total ao voltar do Stripe
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    if (!activeContextOrgId) {
      setSubscription(null);
      setOrganization(null);
      setMembers([]);
      setPendingInvites([]);
      setJoinRequests([]);
      setAuditLogs([]);
      setMusicScaleProjection(null);
      setMusicScaleProjectionError(null);
      if (musicScaleProjectionAbortControllerRef.current) {
        musicScaleProjectionAbortControllerRef.current.abort();
      }
      musicScaleExpectedOrgRef.current = null;
      return;
    }

    setSubscription(null);
    setOrganization(null);
    setMembers([]);
    setPendingInvites([]);
    setJoinRequests([]);
    setAuditLogs([]);
    setLoadingSub(true);
    setMusicScaleProjection(null);
    setMusicScaleProjectionError(null);
    
    const requestId = ++requestSequenceRef.current;
    currentActiveOrgIdRef.current = activeContextOrgId;
    loadOrganizationData(activeContextOrgId, requestId);
    refreshMusicScaleAccessProjection(activeContextOrgId);
    // Subscribe to real-time organization updates for immediate database sync
    const orgId = activeContextOrgId;
    const orgRef = doc(db, "organizations", orgId);
    
    const unsubscribeOrg = onSnapshot(orgRef, (snap) => {
      if (snap.exists()) {
        const orgData = { id: snap.id, ...snap.data() };
        setOrganization(orgData);
      }
    }, (err) => {
      console.warn("[Dashboard] Real-time organization update failed, falling back to manual fetches:", err);
    });

    return () => {
      unsubscribeOrg();
      if (musicScaleProjectionAbortControllerRef.current) {
        musicScaleProjectionAbortControllerRef.current.abort();
      }
    };
  }, [user, activeContextOrgId]);

  useEffect(() => {
    fetch('/api/v1/billing/products')
      .then(res => res.json())
      .then(data => {
         if (data.plans) setPlansData(data.plans);
         if (data.addons) setAddonsData(data.addons);
         
         setPrices(prev => {
           const newPrices = { ...prev };
           
           // Extract plans (strictly by lookupKey)
           const starterMonthly = data.plans?.find((p: any) => p.lookupKey === 'musicscale_starter_monthly');
           const starterAnnual = data.plans?.find((p: any) => p.lookupKey === 'musicscale_starter_yearly');
            const advancedMonthly = data.plans?.find((p: any) => p.lookupKey === 'musicscale_advanced_monthly');
            const advancedAnnual = data.plans?.find((p: any) => p.lookupKey === 'musicscale_advanced_yearly');
           const proMonthly = data.plans?.find((p: any) => p.lookupKey === 'musicscale_pro_monthly');
           const proAnnual = data.plans?.find((p: any) => p.lookupKey === 'musicscale_pro_yearly');
           
           if (starterMonthly) newPrices.starter_monthly = starterMonthly.price;
           if (starterAnnual) newPrices.starter_annual = starterAnnual.price;
            if (advancedMonthly) newPrices.advanced_monthly = advancedMonthly.price;
            if (advancedAnnual) newPrices.advanced_annual = advancedAnnual.price;
           if (proMonthly) newPrices.pro_monthly = proMonthly.price;
           if (proAnnual) newPrices.pro_annual = proAnnual.price;
           
           // Extract addons (strictly by lookupKey)
           data.addons?.forEach((addon: any) => {
             if (addon.lookupKey === 'musicscale_setup_premium') newPrices.setup_premium = addon.price;
             if (addon.lookupKey === 'musicscale_training_express') newPrices.training_express = addon.price;
             if (addon.lookupKey === 'musicscale_worship_100') newPrices.worship_100 = addon.price;
             if (addon.lookupKey === 'musicscale_music_pack_10') newPrices.music_pack_10 = addon.price;
           });
           
           return newPrices;
         });
      })
      .catch(err => console.error(err));
  }, [user, profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-white/10 border-t-[#2B85EB] rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const msIsInstalled = musicScaleProjection?.accessible === true;

  const installedApps = ECOSYSTEM_APPS.filter(app => {
    if (app.id === 'nestfinance' && !isGlobalAdmin) return false;
    if (app.id === 'musicscale') return msIsInstalled;
    return organization?.enabledApps?.includes(app.id);
  });
  const musicScaleApp = ECOSYSTEM_APPS.find(a => a.id === 'musicscale');
  const entitlements = resolveMusicScaleEntitlements({ subscription, organization, userProfile: profile });
  const maxUsersLimit = entitlements?.limits?.users ?? 10;
  const occupiedSlots = calculateOccupiedSlots(members, pendingInvites);

  const selectedWorkspace = (() => {
    if (activeTab === "overview") {
      if (tab === "apps" && subTab) {
         if (subTab === 'musicscale') {
           if (musicScaleProjectionLoading) return 'musicscale'; // Let it render loading state
           if (!msIsInstalled) {
             // Se estivermos na URL /dashboard/apps/musicscale mas não temos acesso, voltamos para home
             return "home";
           }
         }
         return installedApps.some(a => a.id === subTab) ? subTab : "home"; 
      } else if (tab === "overview") {
         return "home";
      } else {
         if (installedApps.length === 1) {
            return installedApps[0].id;
         }
         return "home";
      }
    }
    return "home";
  })();

  const handleSelectWorkspace = (workspaceId: string) => {
    if(workspaceId !== 'musicscale' && searchParams.has('section')) {
      searchParams.delete('section');
      setSearchParams(searchParams);
    }
    if (workspaceId === "home") {
      navigate('/dashboard/overview');
    } else {
      navigate(`/dashboard/apps/${workspaceId}`);
    }
  };

  const formattedRenewal = subscription?.currentPeriodEnd 
    ? new Date(normalizeDateToMs(subscription.currentPeriodEnd)).toLocaleDateString('pt-BR') 
    : null;

  const handleAddonCheckout = async (lookupKey: string) => {
    navigate(`/checkout?plan=${lookupKey}`);
  };

  const handleSubscribe = async (lookupKey: string) => {
    const check = canPurchasePlanAgain({
      desiredPlan: lookupKey,
      existingSubscription: subscription,
      appKey: 'musicscale'
    });

    if (!check.allowed) {
      if (check.action === 'blocked' || check.action === 'manage_existing') {
          feedback.error(check.userMessage);
      } else {
          feedback.success(check.userMessage);
      }
      return;
    }

    navigate(`/checkout?plan=${lookupKey}`);
  };

  const currentUserData = members.find(m => m.id === user?.uid);
  const resolvedRole = resolveUserRoleDisplay({
    userProfile: profile,
    organizationMember: currentUserData
  });
  const currentUserPerms = isGlobalAdmin
    ? normalizePermissions(undefined, 'owner', undefined)
    : normalizePermissions(currentUserData?.permissions, currentUserData?.role || 'member', currentUserData?.permissionsVersion);

  const handleSyncStripeOnBlockedModal = async () => {
    if (!user || verifyingStripe) return;
    setVerifyingStripe(true);
    const toastId = feedback.loading("Sincronizando assinatura em tempo real com o Stripe...");
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/v1/billing/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ organizationId: activeContextOrgId })
      });
      const data = await res.json();
      
      if (activeContextOrgId) {
        await syncSubscriptionWithStripe(activeContextOrgId);
      }
      
      if (data.organizationId === activeContextOrgId && data.ok && data.accessAllowed) {
        feedback.dismiss(toastId);
        feedback.success("Assinatura ativa identificada com sucesso!");
        setSubscriptionBlockedApp(null);
        setSubscriptionBlockedReason(null);
        if (subscriptionBlockedApp) {
            handleLaunchEcosystemApp(subscriptionBlockedApp, currentUserPerms);
        }
      } else {
        feedback.dismiss(toastId);
        feedback.error("Não encontramos nenhuma assinatura ativa no Stripe para esta organização. Certifique-se de convalidar o pagamento ou assinar um plano.");
      }
    } catch (err: any) {
      feedback.dismiss(toastId);
      feedback.error(`Erro ao sincronizar: ${err.message || "Tente novamente mais tarde."}`);
    } finally {
      setVerifyingStripe(false);
    }
  };

  const breadcrumbs = [];
  if (activeTab === 'overview') {
    if (selectedWorkspace === 'home') {
       breadcrumbs.push({ label: t('dashboard.navigation.home', 'Início') });
    } else {
       const app = installedApps.find(a => a.id === selectedWorkspace);
       breadcrumbs.push({ label: t('dashboard.navigation.my_apps', 'Meus aplicativos') });
       breadcrumbs.push({ label: app ? app.name : selectedWorkspace });
    }
  } else if (activeTab === 'organization') {
    breadcrumbs.push({ label: 'Organização', path: '/dashboard/organization' });
    if (tab === 'team' || subTab === 'members') breadcrumbs.push({ label: 'Equipe' });
    else breadcrumbs.push({ label: 'Ajustes' });
  } else if (activeTab === 'billing') {
    breadcrumbs.push({ label: 'Faturamento' });
  } else if (activeTab === 'account') {
    breadcrumbs.push({ label: 'Minha Conta' });
  }

  return (
    <SupportHubProvider organizationId={activeContextOrgId || null} organizationName={organization?.name || null} appId="core">
    <EcosystemShell activeAppId="core" breadcrumbList={breadcrumbs}>
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-[#2B85EB]/5 blur-[150px] rounded-full pointer-events-none" />
      
      {/* Secondary Navigation */}
      <div className="bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 pt-4 md:pt-6 px-6 sticky top-14 z-40">
        <div className="max-w-7xl mx-auto flex items-center gap-8 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab("overview")}
            className={`pb-4 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === "overview" ? "border-[#2B85EB] text-[#F5F7FA]" : "border-transparent text-[#A0A7B5] hover:text-[#F5F7FA]"}`}
          >
            {t('dashboard.navigation.overview', 'Início')}
          </button>
          {(currentUserPerms['organization.settings.update'] || isGlobalAdmin) && (
            <button 
              onClick={() => setActiveTab("organization")}
              className={`pb-4 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === "organization" ? "border-[#2B85EB] text-[#F5F7FA]" : "border-transparent text-[#A0A7B5] hover:text-[#F5F7FA]"}`}
            >
              Organização
            </button>
          )}
          {currentUserPerms['organization.billing.manage'] && (
            <button 
              onClick={() => setActiveTab("billing")}
              className={`pb-4 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === "billing" ? "border-[#2B85EB] text-[#F5F7FA]" : "border-transparent text-[#A0A7B5] hover:text-[#F5F7FA]"}`}
            >
              Valores e Assinatura
            </button>
          )}
          <button 
            onClick={() => setActiveTab("account")}
            className={`pb-4 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === "account" ? "border-[#2B85EB] text-[#F5F7FA]" : "border-transparent text-[#A0A7B5] hover:text-[#F5F7FA]"}`}
          >
            Minha Conta
          </button>
          
          {isGlobalAdmin && (
            <button 
              onClick={() => navigate("/admin/ecosystem")}
              className={`pb-4 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap border-transparent text-[#2B85EB] hover:text-[#3B95FB] flex items-center gap-2`}
            >
              <ShieldCheck className="w-4 h-4" />
              Ecossistema
            </button>
          )}
        </div>
      </div>
      
      <main className="py-12 max-w-7xl mx-auto px-6 relative z-10">
        <header className="mb-12">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-5 mb-2"
          >
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="Profile" loading="lazy" decoding="async" className="w-16 h-16 rounded-2xl border border-white/10 shadow-sm" />
            ) : (
              <div className="w-16 h-16 bg-[#0B0F19] rounded-2xl flex items-center justify-center text-[#F5F7FA] font-bold text-2xl border border-white/10 shadow-sm">
                {profile?.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h1 className="text-2xl md:text-3xl font-semibold text-[#F5F7FA] tracking-tight flex items-center gap-2">
                    Olá, {profile?.displayName?.split(' ')[0] || user.email?.split('@')[0]}
                  </h1>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <div className="flex items-center gap-2">
                     {resolvedRole.badges.map((badge, idx) => {
                       let bgClass = "bg-white/10";
                       let textClass = "text-[#F5F7FA]";
                       let borderClass = "border-white/10";
                       
                       if (badge.tone === 'gold') {
                         bgClass = "bg-yellow-500/10";
                         textClass = "text-yellow-400";
                         borderClass = "border-yellow-500/20";
                       } else if (badge.tone === 'blue') {
                         bgClass = "bg-blue-500/10";
                         textClass = "text-blue-400";
                         borderClass = "border-blue-500/20";
                       } else if (badge.tone === 'purple') {
                         bgClass = "bg-purple-500/10";
                         textClass = "text-purple-400";
                         borderClass = "border-purple-500/20";
                       }
                       
                       return (
                         <span key={idx} className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${bgClass} ${textClass} border ${borderClass}`}>
                           {badge.label}
                         </span>
                       );
                     })}
                  </div>
                  <div className="hidden md:block w-px h-4 bg-white/10" />
                  <p className="text-[#A0A7B5] text-sm">
                    Painel Central do Sistema
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.section
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <EcosystemWorkspaceHome 
                selectedWorkspace={selectedWorkspace}
                installedApps={installedApps}
                organization={organization}
                subscription={subscription}
                members={members}
                pendingInvites={pendingInvites}
                currentUserPerms={currentUserPerms}
                isGlobalAdmin={isGlobalAdmin}
                musicScaleAccess={{
                  accessible: musicScaleProjection?.accessible === true,
                  catalogState: musicScaleProjectionError ? 'error' : musicScaleProjectionLoading ? 'loading' : musicScaleProjection?.catalogState || 'available'
                }}
                musicScaleApp={musicScaleApp}
                occupiedSlots={occupiedSlots}
                maxUsersLimit={maxUsersLimit}
                onSelectWorkspace={handleSelectWorkspace}
                onLaunchApp={(app) => handleLaunchEcosystemApp(app, currentUserPerms)}
                onOpenInviteModal={() => setIsInviteModalOpen(true)}
                onNavigateToOrganizationMembers={() => navigate('/dashboard/organization/members')}
                onNavigateToBilling={() => setActiveTab('billing')}
                onNavigateToOrganizationSettings={onNavigateToOrganizationSettings}
                activeSection={activeSection as 'overview' | 'resources' | 'getting-started'}
                onSelectMusicScaleSection={handleSelectMusicScaleSection}
              />

              {selectedWorkspace === 'home' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Main Content */}
                <div className="col-span-1 lg:col-span-2 space-y-6">
                  
                  {/* Organization Current Status */}
                  <div className="bg-[#0B0F19]/50 backdrop-blur-xl rounded-[2rem] p-6 lg:p-8 border border-white/5 shadow-2xl relative overflow-hidden group">
                     {/* Ambient decoration */}
                     <div className="absolute top-0 right-0 w-64 h-64 bg-[#2B85EB]/5 rounded-full blur-[80px] -z-10 group-hover:scale-110 transition-transform duration-700" />
                     
                     <div className="flex items-start justify-between mb-8">
                       <div className="flex items-center gap-4">
                         <div className="w-14 h-14 rounded-2xl bg-[#050505] flex items-center justify-center border border-white/10 shadow-inner">
                           <Building2 className="w-6 h-6 text-[#F5F7FA]" />
                         </div>
                         <div>
                           <p className="text-[#A0A7B5] text-xs font-bold uppercase tracking-widest mb-1">Organização Ativa</p>
                           <h2 className="text-xl md:text-2xl font-semibold text-[#F5F7FA] tracking-tight">{organization?.name || "Carregando..."}</h2>
                         </div>
                       </div>
                       
                       <div className="flex items-center gap-3">
                         {organization?.slug && (
                            <a 
                               href={`/${organization.slug}`} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="px-3 py-1.5 bg-[#2B85EB]/10 border border-[#2B85EB]/20 text-[#2B85EB] text-[10px] font-bold rounded-full flex items-center gap-1.5 uppercase tracking-widest shadow-sm hover:bg-[#2B85EB]/20 transition-colors"
                            >
                               <Link className="w-3.5 h-3.5" /> Site
                            </a>
                         )}
                         {getVisualState(subscription) === 'trialing' ? (
                           <span className="px-3 py-1 bg-[#F59E0B]/10 text-[#F59E0B] text-[10px] font-bold rounded-full border border-[#F59E0B]/20 flex items-center gap-1.5 uppercase tracking-widest shadow-sm">
                             <Clock className="w-3.5 h-3.5" /> Trial Ativo
                           </span>
                         ) : getVisualState(subscription) === 'active' || getVisualState(subscription) === 'cancel_scheduled' ? (
                           <span className="px-3 py-1 bg-[#10B981]/10 text-[#10B981] text-[10px] font-bold rounded-full border border-[#10B981]/20 flex items-center gap-1.5 uppercase tracking-widest shadow-sm">
                             <ShieldCheck className="w-3.5 h-3.5" /> Ativo
                           </span>
                         ) : (
                           <span className="px-3 py-1 bg-white/5 text-[#A0A7B5] text-[10px] font-bold rounded-full border border-white/10 uppercase tracking-widest shadow-sm">
                             Sem Assinatura
                           </span>
                         )}
                       </div>
                     </div>

                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-[#050505] rounded-2xl p-4 border border-white/5 shadow-inner">
                          <p className="text-[#A0A7B5] text-[10px] uppercase font-bold tracking-widest mb-2 flex items-center gap-2">
                             <Users className="w-3.5 h-3.5" /> Membros
                          </p>
                          {(() => {
                            const entitlements = resolveMusicScaleEntitlements({ subscription, organization, userProfile: profile });
                            const maxUsersLimit = entitlements?.limits?.users ?? 10;
                            const occupiedSlots = calculateOccupiedSlots(members, pendingInvites);
                            const limitStr = maxUsersLimit === -1 ? 'Ilimitado' : maxUsersLimit;
                            return (
                              <p className="text-2xl font-semibold text-[#F5F7FA]">
                                {occupiedSlots}<span className="text-xs text-[#A0A7B5] ml-1">/ {limitStr}</span>
                              </p>
                            );
                          })()}
                        </div>
                        <div className="bg-[#050505] rounded-2xl p-4 border border-white/5 shadow-inner">
                          <p className="text-[#A0A7B5] text-[10px] uppercase font-bold tracking-widest mb-2 flex items-center gap-2">
                             <LayoutGrid className="w-3.5 h-3.5" /> Apps Ativos
                          </p>
                          <p className="text-2xl font-semibold text-[#F5F7FA]">{organization?.enabledApps?.length || (msIsInstalled ? 1 : 0)}</p>
                        </div>
                        <div className="bg-[#050505] rounded-2xl p-4 border border-white/5 shadow-inner">
                          <p className="text-[#A0A7B5] text-[10px] uppercase font-bold tracking-widest mb-2 flex items-center gap-2">
                             <ListMusic className="w-3.5 h-3.5" /> Plano Atual
                          </p>
                          <p className="text-sm font-semibold text-[#F5F7FA] mt-1 capitalize">{subscription?.plan || subscription?.tier || organization?.subscriptionPlan || 'Gratuito'}</p>
                        </div>
                        <div className="bg-[#050505] rounded-2xl p-4 border border-white/5 shadow-inner">
                          <p className="text-[#A0A7B5] text-[10px] uppercase font-bold tracking-widest mb-2 flex items-center gap-2">
                             <CreditCard className="w-3.5 h-3.5" /> Vencimento
                          </p>
                          <p className="text-sm font-semibold text-[#F5F7FA] mt-1">{formattedRenewal || "---"}</p>
                        </div>
                     </div>
                  </div>

                  {/* Timeline Ministerial */}
                  <UnifiedTimeline />

                  {/* Active Ecosystem Apps */}
                  <div id="apps-catalog">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-[#F5F7FA] flex items-center gap-2">
                        <LayoutGrid className="w-5 h-5 text-[#A0A7B5]" />
                        Catálogo de Aplicativos
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {ECOSYSTEM_APPS.filter(app => {
                        // Restrict NestFinance preview to global admins
                        if (app.id === 'nestfinance' && !isGlobalAdmin) return false;
                        return true;
                      }).map(app => {
                        const isMusicScale = app.id === 'musicscale';
                        const isInstalled = isMusicScale ? msIsInstalled : organization?.enabledApps?.includes(app.id);

                        let cardStatusText = t('dashboard.apps.available', 'Disponível');
                        let isWarningState = false;

                        if (isMusicScale) {
                           if (musicScaleProjectionError) {
                               cardStatusText = t('error', 'Erro');
                               isWarningState = true;
                           } else if (musicScaleProjectionLoading) {
                               cardStatusText = t('loading', 'Carregando...');
                           } else {
                               switch (musicScaleProjection?.catalogState) {
                                  case 'trialing': cardStatusText = t('dashboard.apps.trialing', 'Em teste'); break;
                                  case 'active': cardStatusText = t('dashboard.apps.active', 'Ativo'); break;
                                  case 'cancel_scheduled': cardStatusText = t('dashboard.apps.cancel_scheduled', 'Cancelamento agendado'); break;
                                  case 'payment_issue': 
                                     cardStatusText = t('dashboard.apps.payment_issue', 'Pagamento pendente'); 
                                     isWarningState = true;
                                     break;
                                  case 'administrative': cardStatusText = t('dashboard.apps.administrative', 'Acesso administrativo'); break;
                                  case 'available': cardStatusText = t('dashboard.apps.available', 'Disponível'); break;
                                  case 'unavailable': cardStatusText = t('dashboard.apps.unavailable', 'Acesso indisponível'); break;
                                  default: cardStatusText = t('dashboard.apps.available', 'Disponível'); break;
                               }
                           }
                        } else {
                           cardStatusText = isInstalled ? 'Instalado' : 
                                            (app.id === 'nestfinance' && nestFinanceLaunchEnabled) ? 'Disponível' :
                                            app.category === 'beta' ? 'Em Breve' : 'Disponível';
                        }

                        // Map internal icon string to lucide icons
                        const Icon = app.icon === 'Music' ? Music : 
                                     app.icon === 'Users' ? Users : 
                                     app.icon === 'ShieldCheck' ? ShieldCheck : 
                                     app.icon === 'CreditCard' ? CreditCard : 
                                     app.icon === 'Wallet' ? Wallet : LayoutGrid;

                        return (
                          <div key={app.id} className="bg-[#050505] rounded-3xl p-5 border border-white/10 shadow-lg flex flex-col transition-all hover:border-white/20 relative overflow-hidden group">
                            {isInstalled && <div className="absolute inset-0 bg-gradient-to-br from-[#2B85EB]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-0" />}
                            <div className="relative z-10 flex items-start justify-between mb-4">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${isInstalled ? 'bg-[#2B85EB]/10 border-[#2B85EB]/20 text-[#2B85EB]' : isWarningState ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-white/5 border-white/10 text-[#A0A7B5]'}`}>
                                {app.id === 'musicscale' ? (
                                  <img src="/LogoIconMusicScale-1.png" alt="MusicScale" className="w-7 h-7 object-contain" />
                                ) : (
                                  <Icon className="w-5 h-5" />
                                )}
                              </div>
                              <span className={`px-2 py-1 text-[9px] font-bold rounded-md border uppercase tracking-widest shadow-sm ${
                                isInstalled ? 'bg-[#2B85EB]/10 text-[#2B85EB] border-[#2B85EB]/20' : 
                                isWarningState ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                (app.id === 'nestfinance' && nestFinanceLaunchEnabled) ? 'bg-[#F5F7FA]/10 text-[#F5F7FA] border-[#F5F7FA]/20' :
                                'bg-white/5 text-[#A0A7B5] border-white/10'
                              }`}>
                                {cardStatusText}
                              </span>
                            </div>
                            <h4 className="text-lg font-semibold text-[#F5F7FA] mb-1">{app.name}</h4>
                            <p className="text-[#A0A7B5] text-xs leading-relaxed mb-6 flex-1">
                              {app.description}
                              {isMusicScale && musicScaleProjection?.catalogState === 'cancel_scheduled' && formattedRenewal && (
                                <span className="block mt-2 text-white/40">Acesso até {formattedRenewal}</span>
                              )}
                            </p>
                            
                            <div className="relative z-10 flex items-center gap-3">
                              {app.id === 'nestfinance' ? (
                                nestFinanceLaunchEnabled ? (
                                  <button
                                    onClick={handleLaunchNestFinance}
                                    disabled={!canLaunchNestFinance}
                                    className="flex-1 w-full py-2.5 bg-[#F5F7FA] text-[#050505] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-white transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-wait"
                                  >
                                    {nestFinanceLaunching ? 'Preparando acesso...' : 'Abrir NestFinance'} <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    disabled
                                    className="flex-1 py-2.5 bg-white/5 text-[#A0A7B5] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed border border-white/5"
                                  >
                                    Em preparação
                                  </button>
                                )
                              ) : isMusicScale ? (
                                musicScaleProjectionError ? (
                                  <button
                                    onClick={() => refreshMusicScaleAccessProjection(activeContextOrgId!)}
                                    className="flex-1 w-full py-2.5 bg-white/5 text-[#A0A7B5] border border-white/5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-white/10 transition-all shadow-sm active:scale-95"
                                  >
                                    Tentar novamente
                                  </button>
                                ) : musicScaleProjectionLoading ? (
                                  <button
                                    disabled
                                    className="flex-1 py-2.5 bg-white/5 text-[#A0A7B5] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-wait border border-white/5"
                                  >
                                    <div className="w-3.5 h-3.5 border border-[#A0A7B5]/30 border-t-[#A0A7B5] rounded-full animate-spin" />
                                    {t('loading', 'Carregando...')}
                                  </button>
                                ) : musicScaleProjection?.catalogState === 'payment_issue' ? (
                                  <button
                                    onClick={() => navigate('/dashboard/billing')}
                                    className="flex-1 w-full py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-red-500/20 transition-all shadow-sm active:scale-95"
                                  >
                                    {t('dashboard.apps.resolve_payment', 'Regularizar pagamento')}
                                  </button>
                                ) : isInstalled ? (
                                  <button
                                    onClick={() => handleLaunchEcosystemApp(app, currentUserPerms)}
                                    className="flex-1 w-full py-2.5 bg-[#F5F7FA] text-[#050505] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-white transition-all shadow-sm active:scale-95"
                                  >
                                    Abrir App <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => navigate('/checkout')}
                                    className="flex-1 py-2.5 bg-[#2B85EB]/10 text-[#2B85EB] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-[#2B85EB]/20 hover:bg-[#2B85EB]/20 transition-colors"
                                  >
                                    Ver planos
                                  </button>
                                )
                              ) : isInstalled ? (
                                <button
                                  onClick={() => handleLaunchEcosystemApp(app, currentUserPerms)}
                                  className="flex-1 w-full py-2.5 bg-[#F5F7FA] text-[#050505] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-white transition-all shadow-sm active:scale-95"
                                >
                                  Abrir App <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="flex-1 py-2.5 bg-white/5 text-[#A0A7B5] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed border border-white/5"
                                >
                                  {app.requiredPlan !== 'free' ? `Requer plano ${app.requiredPlan}` : 'Em breve'}
                                </button>
                              )}
                              {((isInstalled && !isMusicScale && app.id !== 'nestfinance') || (isMusicScale && msIsInstalled)) && (isGlobalAdmin || currentUserPerms['organization.billing.manage']) && (
                                <button
                                   onClick={() => setConfigAppModal(app)}
                                   className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-[#A0A7B5] hover:text-[#F5F7FA] hover:bg-white/10 transition-colors shrink-0"
                                >
                                   <Settings className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* Right Column: Activity & Team summary */}
                <div className="space-y-6">
                  {/* Recent Activity */}
                  <div className="bg-[#0B0F19]/50 backdrop-blur-xl rounded-[2rem] p-6 border border-white/5 shadow-2xl h-fit">
                    <h3 className="text-base font-semibold text-[#F5F7FA] flex items-center justify-between mb-6">
                      <span className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-[#2B85EB]" /> Atividade Recente
                      </span>
                    </h3>
                    
                    <div className="space-y-4">
                      {auditLogs.length > 0 ? auditLogs.map(log => (
                        <div key={log.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-[#2B85EB]" />
                            <div className="w-px h-full bg-white/5 my-1" />
                          </div>
                          <div className="pb-4">
                            <p className="text-sm text-[#F5F7FA]">{log.action}</p>
                            <p className="text-[10px] text-[#A0A7B5] mt-0.5">
                              {log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString('pt-BR') : 'Agora'}
                              {log.actorUid && ` • Usuario: ${members.find(m => m.id === log.actorUid)?.displayName || log.actorUid.substring(0, 5) + "..."}`}
                            </p>
                          </div>
                        </div>
                      )) : (
                        <div className="py-2">
                           <PremiumEmptyState 
                             icon={<Check className="w-6 h-6" />}
                             title="Sem Logs Recentes"
                             description="Nenhuma atividade operacional registrada."
                           />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Team Members Short summary */}
                  <div className="bg-[#0B0F19]/50 backdrop-blur-xl rounded-[2rem] p-6 border border-white/5 shadow-2xl">
                    <h3 className="text-base font-semibold text-[#F5F7FA] flex items-center justify-between mb-6">
                      <span className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#A0A7B5]" /> Equipe
                      </span>
                      {(currentUserPerms['organization.members.manage'] || isGlobalAdmin) && (
                        <button onClick={() => setActiveTab('organization')} className="text-xs font-medium text-[#2B85EB] hover:text-[#3B95FB]">
                          Gerenciar
                        </button>
                      )}
                    </h3>
                    <div className="space-y-3">
                      {members.slice(0, 5).map(m => (
                        <div key={m.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors cursor-default">
                          <div className="flex items-center gap-3">
                            {m.photoURL ? (
                              <img src={m.photoURL} className="w-8 h-8 rounded-lg border border-white/10" alt="" />
                            ) : (
                              <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-[#F5F7FA] text-xs font-bold border border-white/10">
                                {m.displayName?.charAt(0) || m.email?.charAt(0)}
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-semibold text-[#F5F7FA]">{m.displayName || "Usuário"}</p>
                              <p className="text-[10px] text-[#A0A7B5] truncate max-w-[120px]">{m.email}</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 bg-white/5 text-[#A0A7B5] text-[9px] font-bold rounded-md border border-white/10 uppercase tracking-widest">
                            {m.role || 'Membro'}
                          </span>
                        </div>
                      ))}
                      {members.length > 5 && (
                        <button onClick={() => setActiveTab('organization')} className="w-full py-2 mt-2 bg-white/5 text-[#A0A7B5] text-xs font-semibold rounded-xl hover:bg-white/10 transition-colors border border-white/5">
                          Ver Todos ({members.length})
                        </button>
                      )}
                  </div>
                </div>
                  </div>
                </div>
              )}
            </motion.section>
          )}
          {activeTab === "organization" && (
            <motion.section
              key="organization"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="max-w-6xl"
            >
              <OrganizationManager 
                organization={organization}
                members={members}
                currentUserPerms={currentUserPerms}
                currentUserRole={currentUserData?.role || 'member'}
                user={user}
                profile={profile}
                onSaveOrg={handleSaveOrg}
                handleUpdateMemberRole={handleUpdateMemberRole}
                handleRemoveMember={handleRemoveMember}
                onEditMember={(member) => {
                  setEditingMember(member);
                  setEditingMemberName(member.displayName || "");
                  setEditingMemberPhoto(member.photoURL || "");
                  setEditingMemberRole(member.role || "member");
                  setEditingMemberAppRole(member.appRole || "Membro");
                }}
                isEditingOrg={isEditingOrg}
                setIsEditingOrg={setIsEditingOrg}
                adminSelectedOrgId={adminSelectedOrgId}
                setAdminSelectedOrgId={setAdminSelectedOrgId}
                orgNameInput={orgNameInput}
                setOrgNameInput={setOrgNameInput}
                orgSlugInput={orgSlugInput}
                setOrgSlugInput={setOrgSlugInput}
                savingOrg={savingOrg}
                handleCreateInvite={handleCreateInvite}
                handleRevokeInvite={handleRevokeInvite}
                handleAcceptJoinRequest={handleAcceptJoinRequest}
                handleRejectJoinRequest={handleRejectJoinRequest}
                onOpenInviteModal={() => setIsInviteModalOpen(true)}
                pendingInvites={pendingInvites}
                joinRequests={joinRequests}
                setJoinRequests={setJoinRequests}
                copiedLink={copiedLink}
                auditLogs={auditLogs}
                setActiveDashboardTab={setActiveTab}
                initialTab={tab === 'team' ? 'members' : subTab}
              />
            </motion.section>
          )}

          {activeTab === "account" && (
            <motion.section
              key="account"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="max-w-2xl"
            >
              <div className="bg-[#0B0F19]/50 backdrop-blur-xl rounded-[2rem] p-8 border border-white/5 shadow-2xl">
                <h2 className="text-xl font-semibold text-[#F5F7FA] flex items-center gap-3 mb-8 border-b border-white/5 pb-6">
                   <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                    <User className="w-4 h-4 text-[#A0A7B5]" />
                  </span>
                  Dados da Conta
                </h2>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-6 border-b border-white/5">
                    <div className="flex-1">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-2">Nome de Exibição</p>
                      {isEditingProfile ? (
                        <div className="flex items-center gap-2 mt-1">
                          <input 
                            title="Nome de Exibição"
                            type="text" 
                            value={profileNameInput} 
                            onChange={(e) => setProfileNameInput(e.target.value)} 
                            className="bg-[#050505] border border-white/10 rounded-xl px-4 py-2 text-sm text-[#F5F7FA] outline-none focus:border-[#2B85EB] transition-colors w-full max-w-[250px]"
                          />
                          <button disabled={savingProfile} onClick={handleSaveProfile} className="p-2 bg-[#2B85EB]/10 text-[#2B85EB] rounded-xl hover:bg-[#2B85EB]/20 transition-colors">
                            {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button disabled={savingProfile} onClick={() => { setIsEditingProfile(false); setProfileNameInput(profile?.displayName || ""); }} className="p-2 bg-white/5 text-[#A0A7B5] rounded-xl hover:bg-white/10 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <p className="text-base font-semibold text-[#F5F7FA]">{profileNameInput || profile?.displayName || "Não informado"}</p>
                          <button onClick={() => setIsEditingProfile(true)} className="text-xs font-medium text-[#2B85EB] hover:text-[#3B95FB]">Editar</button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pb-6 border-b border-white/5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-2">Email</p>
                      <p className="text-base font-semibold text-[#F5F7FA]">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-col pb-6 border-b border-white/5">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-4">Trocar Organização Ativa</p>
                    {userOrgs.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {userOrgs.map((org: any) => (
                           <button 
                             key={org.id}
                             disabled={activeOrgId === org.id}
                             onClick={async () => {
                               const toastId = feedback.loading("Alternando organização ativa...");
                               try {
                                 const res = await switchOrganization(org.id);
                                 feedback.dismiss(toastId);
                                 if (res.success) {
                                   feedback.success("Organização alterada com sucesso!");
                                 } else {
                                   feedback.error(`Não foi possível alterar a organização: ${res.error || "Erro desconhecido"}`);
                                 }
                               } catch (err: any) {
                                 feedback.dismiss(toastId);
                                 feedback.error(`Não foi possível alterar a organização: ${err.message || "Erro desconhecido"}`);
                               }
                             }}
                             className={`flex items-center justify-between p-4 rounded-xl border transition-all text-left ${activeOrgId === org.id ? 'bg-[#2B85EB]/10 border-[#2B85EB]/20 cursor-default' : 'bg-[#050505] border-white/5 hover:border-white/10 cursor-pointer'}`}
                           >
                             <div>
                               <p className="text-sm font-semibold text-[#F5F7FA]">
                                 {org.name || `ID: ${org.id}`}
                                 {activeOrgId === org.id && <span className="ml-2 text-[10px] bg-[#2B85EB]/20 text-[#2B85EB] uppercase tracking-widest px-2 py-0.5 rounded font-bold">Ativa</span>}
                               </p>
                               {org.name && <p className="text-xs text-[#A0A7B5] mt-1 font-mono">{org.id}</p>}
                             </div>
                             {activeOrgId !== org.id && (
                                <span className="text-xs text-[#A0A7B5] group-hover:text-white transition-colors flex items-center gap-1 font-medium bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">Acessar</span>
                             )}
                           </button>
                        ))}
                      </div>
                    ) : (
                       <p className="text-sm text-[#A0A7B5] bg-[#050505] p-4 rounded-xl border border-white/5">Você não possui organizações vinculadas.</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pb-6 border-b border-white/5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-2">ID Central</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs font-mono text-[#A0A7B5] bg-[#050505] px-2 py-1 rounded-md border border-white/5">{user.uid}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6">
                    <button 
                      onClick={logout}
                      className="text-[#EF4444] font-semibold hover:text-[#FCA5A5] transition-colors text-sm px-5 py-2.5 bg-[#EF4444]/10 rounded-xl hover:bg-[#EF4444]/20 border border-[#EF4444]/20 active:scale-95"
                    >
                      Encerrar Sessão
                    </button>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {activeTab === "billing" && (
            <motion.section
              key="billing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="max-w-4xl"
            >
              <div className="bg-[#0B0F19]/50 backdrop-blur-xl rounded-[2rem] p-10 border border-white/5 shadow-2xl">
                <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#050505] rounded-xl flex items-center justify-center border border-white/10 shadow-inner">
                      <CreditCard className="w-6 h-6 text-[#2B85EB]" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold text-[#F5F7FA]">Plano e Assinatura</h2>
                      <p className="text-[#A0A7B5] text-sm font-normal">Gerencie seu faturamento centralizado.</p>
                    </div>
                  </div>
                  {loadingSub && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 animate-pulse">
                       <div className="w-2.5 h-2.5 border-2 border-white/20 border-t-[#2B85EB] rounded-full animate-spin"></div>
                       <span className="text-[10px] font-medium text-[#A0A7B5] uppercase tracking-widest">Sincronizando...</span>
                    </div>
                  )}
                </div>
                
                {subscription && subscription.status !== 'none' ? (
                  <div className="space-y-6">
                    <div className="bg-[#050505] rounded-2xl p-6 border border-white/5 shadow-inner">
                      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                        <div>
                           <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-2">Plano Atual</p>
                           <h3 className="text-xl font-semibold text-[#F5F7FA] capitalize">{subscription?.plan || 'Mensal'} - MusicScale</h3>
                        </div>
                        <div className="text-left md:text-right">
                           <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-2">Status</p>
                           {(() => {
                             const visualState = getVisualState(subscription);
                             const styles: Record<string, string> = {
                               active: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20',
                               cancel_scheduled: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20',
                               canceled_with_access: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20',
                               canceled_expired: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20',
                               past_due: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20',
                               trialing: 'bg-[#2B85EB]/10 text-[#2B85EB] border-[#2B85EB]/20',
                             };
                             const labels: Record<string, string> = {
                               active: 'Ativa',
                               cancel_scheduled: 'Cancelamento Agendado',
                               canceled_with_access: 'Assinatura Encerrada',
                               canceled_expired: 'Encerrada',
                               past_due: 'Pagamento Pendente',
                               trialing: 'Período de Avaliação',
                             };
                             return (
                               <span className={`inline-flex px-3 py-1 text-[10px] font-bold rounded-full border uppercase tracking-widest shadow-sm ${styles[visualState] || styles.active}`}>
                                 {labels[visualState] || visualState}
                               </span>
                             );
                           })()}
                        </div>
                      </div>

                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pt-6 border-t border-white/5 gap-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-1">
                            {(() => {
                              const visualState = getVisualState(subscription);
                              if (visualState === 'trialing') return 'Fim do Trial';
                              if (visualState === 'cancel_scheduled') return 'Sua assinatura continua ativa até';
                              if (visualState === 'canceled_with_access') return 'Seu acesso permanece disponível até';
                              if (visualState === 'canceled_expired') return 'Acesso Expirado em';
                              return 'Próxima Cobrança';
                            })()}
                          </p>
                          <p className="text-sm font-semibold text-[#F5F7FA]">{formattedRenewal}</p>
                        </div>
                        {subscription.status === 'trialing' && subscription.trialEndsAt && (
                          <div className="text-left md:text-right">
                            <p className="text-[11px] font-medium text-[#2B85EB] flex items-center gap-1.5 bg-[#2B85EB]/10 px-3 py-1.5 rounded-lg border border-[#2B85EB]/20">
                              <Clock className="w-3.5 h-3.5" />
                              Faltam {Math.max(0, Math.ceil((new Date(subscription.trialEndsAt.seconds * 1000).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} dias
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-[#A0A7B5] text-sm font-normal text-center pt-2">
                      Faturamento e ciclo de vida gerenciados de forma segura pelo Stripe.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                      {(() => {
                         const visualState = getVisualState(subscription);
                         if (visualState === 'cancel_scheduled') {
                           return (
                             <>
                               <button 
                                 onClick={openBillingPortal}
                                 className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#F5F7FA] text-[#050505] rounded-xl font-semibold hover:bg-white transition-all shadow-sm active:scale-95"
                               >
                                 <Settings className="w-4 h-4 ml-1" /> Gerenciar Assinatura
                               </button>
                               <button 
                                 onClick={reactivateSubscription}
                                 className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#2B85EB] text-white rounded-xl font-semibold hover:bg-[#2B85EB]/90 transition-all shadow-sm active:scale-95"
                               >
                                 Continuar com a assinatura
                               </button>
                             </>
                           );
                         }
                         if (visualState === 'canceled_with_access' || visualState === 'canceled_expired') {
                           return (
                             <>
                               <button 
                                 onClick={openBillingPortal}
                                 className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#F5F7FA] text-[#050505] rounded-xl font-semibold hover:bg-white transition-all shadow-sm active:scale-95"
                               >
                                 <Settings className="w-4 h-4 ml-1" /> Histórico de Faturas
                               </button>
                               <button 
                                 onClick={() => navigate('/checkout')}
                                 className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#2B85EB] text-white rounded-xl font-semibold hover:bg-[#2B85EB]/90 transition-all shadow-sm active:scale-95"
                               >
                                 Assinar novamente
                               </button>
                             </>
                           );
                         }
                         if (visualState === 'past_due') {
                           return (
                             <>
                               <button 
                                 onClick={openBillingPortal}
                                 className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#F5F7FA] text-[#050505] rounded-xl font-semibold hover:bg-white transition-all shadow-sm active:scale-95"
                               >
                                 <Settings className="w-4 h-4 ml-1" /> Gerenciar Assinatura
                               </button>
                               <button 
                                 onClick={openBillingPortal}
                                 className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#EF4444] text-white rounded-xl font-semibold hover:bg-[#EF4444]/90 transition-all shadow-sm active:scale-95"
                               >
                                 {t('dashboard.apps.resolve_payment', 'Regularizar pagamento')}
                               </button>
                             </>
                           );
                         }
                         // Active, trialing
                         return (
                           <>
                             <button 
                               onClick={openBillingPortal}
                               className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#F5F7FA] text-[#050505] rounded-xl font-semibold hover:bg-white transition-all shadow-sm active:scale-95"
                             >
                               <Settings className="w-4 h-4 ml-1" /> Gerenciar Assinatura
                             </button>
                             <button 
                               onClick={openBillingPortal}
                               className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-white/5 text-[#F5F7FA] border border-white/10 rounded-xl font-semibold hover:bg-white/10 transition-all shadow-sm active:scale-95"
                             >
                               Fazer Upgrade / Downgrade
                             </button>
                           </>
                         );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-8">
                       <div>
                         <h3 className="text-xl font-semibold text-[#F5F7FA]">Escolha seu Plano</h3>
                         <p className="text-[#A0A7B5] text-sm">Assinatura unificada para todo o ministério.</p>
                         {subscription && subscription.status !== 'none' && getVisualState(subscription) === 'canceled_expired' && (
                           <button onClick={openBillingPortal} className="mt-2 text-xs text-[#2B85EB] hover:text-[#3B95FB] underline flex items-center gap-1">
                             <Settings className="w-3.5 h-3.5" /> Ver histórico de faturas
                           </button>
                         )}
                       </div>
                       <div className="bg-[#0B0F19] p-1.5 rounded-xl border border-white/10 flex relative shadow-sm">
                         <button 
                           onClick={() => setIsAnnual(false)}
                           className={`relative z-10 px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${!isAnnual ? 'text-[#050505]' : 'text-[#A0A7B5] hover:text-[#F5F7FA]'}`}
                         >
                           Mensal
                         </button>
                         <button 
                           onClick={() => setIsAnnual(true)}
                           className={`relative z-10 px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${isAnnual ? 'text-[#050505]' : 'text-[#A0A7B5] hover:text-[#F5F7FA]'}`}
                         >
                           Anual
                         </button>
                         <div 
                           className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-[#F5F7FA] rounded-lg transition-transform duration-300 ease-in-out"
                           style={{ transform: isAnnual ? 'translateX(calc(100% + 6px))' : 'translateX(6px)' }}
                         />
                       </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                      {/* STARTER */}
                      <div className="bg-[#0B0F19] rounded-[2rem] p-6 border border-white/5 relative flex flex-col hover:border-white/10 transition-colors">
                        <h3 className="text-sm font-bold text-[#A0A7B5] mb-2 uppercase tracking-widest">Starter</h3>
                        <p className="text-[#A0A7B5] text-[11px] md:text-xs mb-4 min-h-[40px]">
                          Ideal para pequenas equipes que desejam começar a organizar o ministério com excelência.
                        </p>
                        
                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-3xl md:text-4xl font-semibold text-[#F5F7FA] tracking-tight">
                            R$ {prices.starter_monthly > 0 ? (isAnnual ? (prices.starter_annual / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : prices.starter_monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : "19,90"}
                          </span>
                          <span className="text-[#A0A7B5] font-normal text-xs md:text-sm">/mês</span>
                        </div>
                        
                        {isAnnual ? (
                          <div className="flex items-center gap-2 mb-6 text-xs font-medium">
                            {prices.starter_monthly > 0 && <span className="text-[#A0A7B5]/50 line-through">R$ {(prices.starter_monthly * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                            {prices.starter_monthly > 0 && prices.starter_annual > 0 && <span className="text-[#2B85EB] font-semibold bg-[#2B85EB]/10 border border-[#2B85EB]/20 px-2 py-0.5 rounded-md text-[10px]">{(100 - (prices.starter_annual / (prices.starter_monthly * 12)) * 100).toFixed(0)}% OFF</span>}
                          </div>
                        ) : (
                          <div className="h-5 md:h-6 mb-6" />
                        )}
                        
                        {(() => {
                          const starterCheck = canPurchasePlanAgain({ desiredPlan: 'starter', existingSubscription: subscription, appKey: 'musicscale' });
                          return (
                            <button 
                              onClick={() => starterCheck.action === 'checkout' ? handleSubscribe(isAnnual ? 'musicscale_starter_yearly' : 'musicscale_starter_monthly') : openBillingPortal()}
                              disabled={checkoutLoading || starterCheck.action === 'blocked'}
                              className={`w-full py-3.5 px-4 rounded-xl border text-center font-semibold text-sm transition-all shadow-sm active:scale-95 mb-6 block ${starterCheck.action === 'checkout' ? 'bg-white/5 border-white/10 text-[#F5F7FA] hover:bg-white/10' : 'bg-transparent border-white/10 text-[#A0A7B5] hover:text-[#F5F7FA]'}`}
                            >
                              {checkoutLoading ? "Processando..." : (starterCheck.action === 'checkout' ? "Assinar MusicScale Starter" : starterCheck.action === 'manage_existing' ? "Plano Atual (Gerenciar)" : "Gerenciar Assinatura")}
                            </button>
                          );
                        })()}
                        
                        <ul className="space-y-3 flex-1 pt-4 border-t border-white/5">
                          {[
                            "Até 10 pessoas por organização",
                            "Músicas e escalas ilimitadas",
                            "Campos de músicas essenciais",
                            "Sincronização em nuvem segura",
                            "Compartilhamento público de escalas",
                            "Suporte básico por e-mail"
                          ].map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-[#A0A7B5]">
                              <Check className="w-3.5 h-3.5 text-[#2B85EB] flex-shrink-0 mt-0.5" />
                              <span className="font-normal text-xs">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* ADVANCED */}
                      <div className="bg-[#0B0F19] rounded-[2rem] p-6 border border-white/10 relative flex flex-col hover:border-white/20 transition-all group">
                        <div className="absolute top-4 right-4 md:right-6">
                          <span className="text-[9px] font-bold text-[#F5F7FA] bg-white/10 border border-white/10 px-2.5 py-1 rounded-full uppercase tracking-widest">
                            Recomendado
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-[#F5F7FA] mb-2 uppercase tracking-widest mt-4 md:mt-0">Advanced</h3>
                        <p className="text-[#A0A7B5] text-[11px] md:text-xs mb-4 min-h-[40px]">
                          Para ministérios estruturados com equipe em expansão e acesso à biblioteca.
                        </p>
                        
                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-3xl md:text-4xl font-semibold text-[#F5F7FA] tracking-tight">
                            R$ {prices.advanced_monthly > 0 ? (isAnnual ? (prices.advanced_annual / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : prices.advanced_monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : "29,90"}
                          </span>
                          <span className="text-[#A0A7B5] font-normal text-xs md:text-sm">/mês</span>
                        </div>
                        
                        {isAnnual ? (
                          <div className="flex items-center gap-2 mb-6 text-xs font-medium">
                            {prices.advanced_monthly > 0 && <span className="text-[#A0A7B5]/50 line-through">R$ {(prices.advanced_monthly * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                            {prices.advanced_monthly > 0 && prices.advanced_annual > 0 && <span className="text-[#2B85EB] font-semibold bg-[#2B85EB]/10 border border-[#2B85EB]/20 px-2 py-0.5 rounded-md text-[10px]">{(100 - (prices.advanced_annual / (prices.advanced_monthly * 12)) * 100).toFixed(0)}% OFF</span>}
                          </div>
                        ) : (
                          <div className="h-5 md:h-6 mb-6" />
                        )}
                        
                        {(() => {
                          const advCheck = canPurchasePlanAgain({ desiredPlan: 'advanced', existingSubscription: subscription, appKey: 'musicscale' });
                          return (
                            <button 
                              onClick={() => advCheck.action === 'checkout' ? handleSubscribe(isAnnual ? 'musicscale_advanced_yearly' : 'musicscale_advanced_monthly') : openBillingPortal()}
                              disabled={checkoutLoading || advCheck.action === 'blocked'}
                              className={`w-full py-3.5 px-4 rounded-xl text-center font-semibold text-sm transition-all shadow-sm active:scale-95 mb-6 block ${advCheck.action === 'checkout' ? 'bg-white/10 border border-white/10 text-[#F5F7FA] hover:bg-white/20' : 'bg-transparent border border-white/10 text-[#A0A7B5] hover:text-[#F5F7FA]'}`}
                            >
                              {checkoutLoading ? "Processando..." : (advCheck.action === 'checkout' ? "Assinar MusicScale Advanced" : advCheck.action === 'manage_existing' ? "Plano Atual (Gerenciar)" : "Gerenciar Assinatura")}
                            </button>
                          );
                        })()}
                        
                        <ul className="space-y-3 flex-1 pt-4 border-t border-white/5">
                          {[
                            "Até 20 pessoas por organização",
                            "Músicas e escalas ilimitadas",
                            "Acesso limitado à Biblioteca Viva",
                            "Até 10 importações por mês",
                            "Personalização avançada de repertório",
                            "Histórico completo de alterações",
                            "Suporte prioritário básico (resposta até 24h)"
                          ].map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-[#F5F7FA]">
                              <Check className="w-3.5 h-3.5 text-[#2B85EB] flex-shrink-0 mt-0.5" />
                              <span className="font-normal text-xs opacity-90">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* PRO */}
                      <div className="bg-[#050505] rounded-[2rem] p-6 border border-[#2B85EB]/35 relative flex flex-col premium-shadow group">
                        <div className="absolute inset-0 bg-gradient-to-b from-[#2B85EB]/5 to-transparent pointer-events-none rounded-[2rem]" />
                        <div className="absolute top-4 right-4 md:right-6">
                          <div className="bg-[#2B85EB] text-white text-[9px] font-bold px-3 py-1 rounded-full shadow-sm uppercase tracking-widest flex items-center gap-1">
                            <Star className="w-3 h-3 text-white fill-white" /> Popular
                          </div>
                        </div>

                        <h3 className="text-sm font-bold text-[#F5F7FA] mb-2 uppercase tracking-widest relative z-10 mt-4 md:mt-0">Pro</h3>
                        <p className="text-[#A0A7B5] text-[11px] md:text-xs mb-4 min-h-[40px] relative z-10">
                          Para ministérios grandes e exigentes que buscam poder absoluto, automações e IA.
                        </p>
                        
                        <div className="flex items-baseline gap-1 mb-1 relative z-10">
                          <span className="text-3xl md:text-4xl font-semibold text-[#F5F7FA] tracking-tight">
                            R$ {prices.pro_monthly > 0 ? (isAnnual ? (prices.pro_annual / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : prices.pro_monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : "34,90"}
                          </span>
                          <span className="text-[#A0A7B5] font-normal text-xs md:text-sm">/mês</span>
                        </div>
                        
                        {isAnnual ? (
                          <div className="flex items-center gap-2 mb-6 text-xs font-medium relative z-10">
                             {prices.pro_monthly > 0 && <span className="text-[#A0A7B5]/50 line-through">R$ {(prices.pro_monthly * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                             {prices.pro_monthly > 0 && prices.pro_annual > 0 && <span className="text-[#2B85EB] font-semibold bg-[#2B85EB]/10 border border-[#2B85EB]/20 px-2 py-0.5 rounded-md text-[10px]">{(100 - (prices.pro_annual / (prices.pro_monthly * 12)) * 100).toFixed(0)}% OFF</span>}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mb-6 text-xs font-medium relative z-10">
                             <span className="text-[#A0A7B5]/50 line-through">R$ 44,90</span>
                             <span className="text-[#2B85EB] font-semibold bg-[#2B85EB]/10 border border-[#2B85EB]/20 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-widest">Lançamento</span>
                          </div>
                        )}
                        
                        {(() => {
                          const proCheck = canPurchasePlanAgain({ desiredPlan: 'pro', existingSubscription: subscription, appKey: 'musicscale' });
                          return (
                            <button 
                              onClick={() => proCheck.action === 'checkout' ? handleSubscribe(isAnnual ? 'musicscale_pro_yearly' : 'musicscale_pro_monthly') : openBillingPortal()}
                              disabled={checkoutLoading || proCheck.action === 'blocked'}
                              className={`w-full py-3.5 px-4 rounded-xl text-center font-semibold text-sm transition-all shadow-[0_0_20px_rgba(245,247,250,0.1)] active:scale-95 mb-6 block relative z-10 ${proCheck.action === 'checkout' ? 'bg-[#F5F7FA] text-[#050505] hover:bg-white hover:shadow-[0_0_30px_rgba(245,247,250,0.2)]' : 'bg-transparent border border-white/10 text-[#A0A7B5] hover:text-[#F5F7FA]'}`}
                            >
                              {checkoutLoading ? "Processando..." : (proCheck.action === 'checkout' ? "Assinar MusicScale Pro" : proCheck.action === 'manage_existing' ? "Plano Atual (Gerenciar)" : "Gerenciar Assinatura")}
                            </button>
                          );
                        })()}
                        
                        <ul className="space-y-3 flex-1 pt-4 border-t border-white/5 relative z-10">
                          {[
                            "Pessoas organizacionais ILIMITADAS",
                            "Músicas e escalas ilimitadas",
                            "Biblioteca Viva Completa ILIMITADA",
                            "Importações inteligentes via IA",
                            "Estruturação e sugestões por IA",
                            "Clonagem instantânea de escalas",
                            "Acesso prioritário a novos recursos",
                            "Suporte prioritário"
                          ].map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-[#F5F7FA]">
                              <Zap className="w-3.5 h-3.5 text-[#2B85EB] flex-shrink-0 mt-0.5" />
                              <span className="font-normal text-xs opacity-90">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- MARKETPLACE / SERVIÇOS PREMIUM --- */}
                <div className="mt-16 pt-12 border-t border-white/5">
                  <div className="mb-10 text-center md:text-left">
                     <h3 className="text-xl font-semibold text-[#F5F7FA] mb-2">Serviços e Adicionais</h3>
                     <p className="text-[#A0A7B5] text-sm">Complemente sua assinatura com ferramentas e serviços premium estruturados para o seu ministério.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                    {/* Setup Premium */}
                    <div className="bg-[#050505] rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-colors flex flex-col group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 bg-[#0B0F19] rounded-xl border border-white/5 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <Settings className="w-5 h-5 text-[#2B85EB]" />
                        </div>
                        <div className="text-right">
                          <div className="text-[#F5F7FA] font-mono text-sm">
                             R$ {prices.setup_premium > 0 ? prices.setup_premium.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "..."} <span className="text-[#A0A7B5] text-xs font-sans">/único</span>
                          </div>
                        </div>
                      </div>
                      <h4 className="text-[#F5F7FA] font-semibold text-base mb-1">Setup Premium</h4>
                      <p className="text-[#A0A7B5] text-xs mb-6 flex-1">
                        Configuração inicial assistida para estruturar rapidamente sua equipe no MusicScale.
                      </p>
                      <ul className="space-y-3 mb-6">
                        <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Onboarding assistido</li>
                        <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Organização de equipe estruturada</li>
                      </ul>
                      <button 
                        onClick={() => handleAddonCheckout('musicscale_setup_premium')}
                        disabled={checkoutLoading}
                        className="w-full py-2.5 px-4 rounded-lg bg-white/5 border border-white/10 text-[#F5F7FA] text-xs text-center font-semibold hover:bg-[#2B85EB]/10 hover:text-[#2B85EB] transition-colors disabled:opacity-50"
                      >
                        {checkoutLoading ? "Processando..." : "Solicitar Setup"}
                      </button>
                    </div>

                    {/* Treinamento Express */}
                    <div className="bg-[#050505] rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-colors flex flex-col group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 bg-[#0B0F19] rounded-xl border border-white/5 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <Video className="w-5 h-5 text-[#2B85EB]" />
                        </div>
                        <div className="text-right">
                          <div className="text-[#F5F7FA] font-mono text-sm">
                             R$ {prices.training_express > 0 ? prices.training_express.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "..."} <span className="text-[#A0A7B5] text-xs font-sans">/único</span>
                          </div>
                        </div>
                      </div>
                      <h4 className="text-[#F5F7FA] font-semibold text-base mb-1">Treinamento Express</h4>
                      <p className="text-[#A0A7B5] text-xs mb-6 flex-1">
                        Treinamento online prático para aprender rapidamente o fluxo do MusicScale.
                      </p>
                      <ul className="space-y-3 mb-6">
                        <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Sessão de grupo online</li>
                        <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Gravação completa disponível</li>
                      </ul>
                      <button 
                        onClick={() => handleAddonCheckout('musicscale_training_express')}
                        disabled={checkoutLoading}
                        className="w-full py-2.5 px-4 rounded-lg bg-white/5 border border-white/10 text-[#F5F7FA] text-xs text-center font-semibold hover:bg-[#2B85EB]/10 hover:text-[#2B85EB] transition-colors disabled:opacity-50"
                      >
                        {checkoutLoading ? "Processando..." : "Quero Participar"}
                      </button>
                    </div>

                    {/* Acervo Inicial */}
                    <div className="bg-[#050505] rounded-2xl p-6 border border-[#2B85EB]/20 hover:border-[#2B85EB]/40 transition-colors flex flex-col group relative overflow-hidden">
                      {addonsData?.find(a => a.lookupKey === 'musicscale_worship_100')?.featured && (
                        <div className="absolute top-0 right-0 p-3">
                          <div className="bg-[#2B85EB]/10 text-[#2B85EB] text-[9px] font-bold px-2 py-0.5 rounded-md border border-[#2B85EB]/20 uppercase tracking-widest flex items-center gap-1">
                            <Star className="w-2.5 h-2.5" /> Popular
                          </div>
                        </div>
                      )}
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 bg-[#2B85EB]/10 rounded-xl border border-[#2B85EB]/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <ListMusic className="w-5 h-5 text-[#2B85EB]" />
                        </div>
                        <div className="text-right pt-6 mt-1">
                          <div className="text-[#F5F7FA] font-mono text-sm">
                             R$ {prices.worship_100 > 0 ? prices.worship_100.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "..."} <span className="text-[#A0A7B5] text-xs font-sans">/único</span>
                          </div>
                        </div>
                      </div>
                      <h4 className="text-[#F5F7FA] font-semibold text-base mb-1">Acervo Inicial Worship</h4>
                      <p className="text-[#A0A7B5] text-xs mb-6 flex-1">
                        Comece com 100 músicas cadastradas, incluindo cifra e letra.
                      </p>
                      <ul className="space-y-3 mb-6">
                        <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> 100 músicas formatadas</li>
                        <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Implantação imediata</li>
                      </ul>
                      <button 
                        onClick={() => handleAddonCheckout('musicscale_worship_100')}
                        disabled={checkoutLoading}
                        className="w-full py-2.5 px-4 rounded-lg bg-[#2B85EB] text-white text-xs text-center font-semibold hover:bg-[#2B85EB]/90 transition-colors shadow-sm active:scale-95 disabled:opacity-50"
                      >
                        {checkoutLoading ? "Processando..." : "Comprar Acervo"}
                      </button>
                    </div>

                    {/* Music Pack 10 */}
                    <div className="bg-[#050505] rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-colors flex flex-col group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 bg-[#0B0F19] rounded-xl border border-white/5 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <Headphones className="w-5 h-5 text-[#2B85EB]" />
                        </div>
                        <div className="text-right">
                          <div className="text-[#F5F7FA] font-mono text-sm">
                             R$ {prices.music_pack_10 > 0 ? prices.music_pack_10.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "..."} <span className="text-[#A0A7B5] text-xs font-sans">/único</span>
                          </div>
                        </div>
                      </div>
                      <h4 className="text-[#F5F7FA] font-semibold text-base mb-1">Music Pack +10</h4>
                      <p className="text-[#A0A7B5] text-xs mb-6 flex-1">
                        Pacote avulso para adicionar até 10 novas músicas ao seu acervo.
                      </p>
                      <ul className="space-y-3 mb-6">
                        <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Até 10 novas adições</li>
                        <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Cifras e letras nativas</li>
                      </ul>
                      <button 
                        onClick={() => handleAddonCheckout('musicscale_music_pack_10')}
                        disabled={checkoutLoading}
                        className="w-full py-2.5 px-4 rounded-lg bg-white/5 border border-white/10 text-[#F5F7FA] text-xs text-center font-semibold hover:bg-[#2B85EB]/10 hover:text-[#2B85EB] transition-colors disabled:opacity-50"
                      >
                        {checkoutLoading ? "Processando..." : "Comprar Pacote"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* App Config Modal */}
      <AnimatePresence>
        {configAppModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#050505] border border-white/10 rounded-2xl p-6 shadow-2xl relative"
            >
              <button
                onClick={() => setConfigAppModal(null)}
                className="absolute top-4 right-4 text-[#A0A7B5] hover:text-white transition-colors"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#2B85EB]/10 border border-[#2B85EB]/20 text-[#2B85EB] flex items-center justify-center">
                  <LayoutGrid className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">{configAppModal.name}</h3>
                  <p className="text-sm text-[#A0A7B5]">Módulo Instalado</p>
                </div>
              </div>
              
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-[#A0A7B5]">Status</span>
                  <span className="text-sm font-semibold text-emerald-400">Ativo</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-[#A0A7B5]">Plano</span>
                  <span className="text-sm font-semibold text-white uppercase">{subscription?.plan || 'Free'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-[#A0A7B5]">Organização</span>
                  <span className="text-sm font-semibold text-white">{organization?.name}</span>
                </div>
              </div>
              
              <p className="text-xs text-[#A0A7B5] mb-6 text-center">
                Painel de configurações avançadas estará disponível em breve.
              </p>
              
              <button
                onClick={() => {
                  setConfigAppModal(null);
                  handleLaunchEcosystemApp(configAppModal, currentUserPerms);
                }}
                className="w-full py-3 bg-[#F5F7FA] text-[#050505] rounded-xl text-sm font-semibold hover:bg-white transition-colors"
              >
                Abrir {configAppModal.name}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium Subscription Blocked Modal */}
      <AnimatePresence>
        {subscriptionBlockedApp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="w-full max-w-xl bg-gradient-to-b from-[#0F111E] to-[#050505] border border-white/10 rounded-3xl p-8 shadow-[0_0_50px_rgba(43,133,235,0.15)] relative overflow-hidden"
            >
              {/* Decorative radial background */}
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#2B85EB]/20 rounded-full blur-[80px] pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#2B85EB]/10 rounded-full blur-[80px] pointer-events-none" />

              <button
                onClick={() => {
                  setSubscriptionBlockedApp(null);
                  setSubscriptionBlockedReason(null);
                }}
                className="absolute top-6 right-6 text-[#A0A7B5] hover:text-white transition-colors p-1"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center text-center mt-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2B85EB]/20 to-[#2B85EB]/5 border border-[#2B85EB]/30 text-[#2B85EB] flex items-center justify-center mb-6 shadow-lg shadow-[#2B85EB]/5">
                  <Music className="w-8 h-8 animate-pulse" />
                </div>

                <div className="mb-2">
                  <span className="text-[10px] font-bold text-[#2B85EB] bg-[#2B85EB]/10 border border-[#2B85EB]/20 px-3.5 py-1 rounded-full uppercase tracking-widest">
                    Excelência Ministerial
                  </span>
                </div>

                <h3 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight max-w-md">
                  Não encontramos uma assinatura ativa
                </h3>
                
                <p className="text-[#A0A7B5] text-sm md:text-base leading-relaxed mt-4 max-w-lg">
                  Parece que sua assinatura do <strong className="text-white">{subscriptionBlockedApp.name}</strong> está cancelada, expirada ou ainda não foi ativada. Você pode escolher um plano novamente e continuar usando o ecossistema normalmente.
                </p>

                {/* Live Stripe Validation status card */}
                <div className="w-full bg-[#141829]/50 border border-white/5 rounded-2xl p-5 my-6 text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-[#2B85EB]/5 to-transparent pointer-events-none" />
                  
                  <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/5">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                    </span>
                    <span className="text-xs font-semibold text-[#A0A7B5] uppercase tracking-wider">
                      Stripe Gateway (Conexão Segura Ativa)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] text-[#A0A7B5]/60 uppercase tracking-widest mb-0.5">Validação em Tempo Real</p>
                      <p className="text-xs font-semibold text-emerald-400">Verificado com Sucesso</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#A0A7B5]/60 uppercase tracking-widest mb-0.5">Status da Assinatura</p>
                      <p className="text-xs font-semibold text-red-500 flex items-center gap-1.5 uppercase">
                        {subscription?.status === 'canceled' ? 'Cancelada' : 'Pendente / Inativa'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="w-full space-y-3.5">
                  <button
                    onClick={handleSyncStripeOnBlockedModal}
                    disabled={verifyingStripe}
                    className="w-full py-4 bg-[#2B85EB] hover:bg-[#3d92fb] active:scale-[0.98] text-white rounded-xl text-sm font-semibold transition-all shadow-[0_0_30px_rgba(43,133,235,0.3)] hover:shadow-[0_0_40px_rgba(43,133,235,0.5)] flex items-center justify-center gap-2 disabled:opacity-75"
                  >
                    {verifyingStripe ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        Atualizar status
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setSubscriptionBlockedApp(null);
                        setSubscriptionBlockedReason(null);
                        navigate('/checkout');
                      }}
                      className="flex-1 py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 active:scale-[0.98] text-white rounded-xl text-xs font-semibold transition-all"
                    >
                      Ver planos
                    </button>
                    <button
                      onClick={() => {
                        setSubscriptionBlockedApp(null);
                        setSubscriptionBlockedReason(null);
                      }}
                      className="flex-1 py-3.5 bg-transparent border border-transparent hover:text-white text-[#A0A7B5] text-xs font-semibold transition-all"
                    >
                      Voltar ao painel
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-[#A0A7B5]/40 mt-6 max-w-sm">
                  Se você acabou de realizar o pagamento, clique em "Sincronizar" para liberar instantaneamente o seu acesso ou fale com o nosso suporte.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {(() => {
        const entitlements = resolveMusicScaleEntitlements({ subscription, organization, userProfile: profile });
        const maxUsersLimit = entitlements?.limits?.users ?? 10;
        const occupiedSlots = calculateOccupiedSlots(members, pendingInvites);
        const isAtLimit = maxUsersLimit !== -1 && occupiedSlots >= maxUsersLimit;

        return (
          <InviteModal
            isOpen={isInviteModalOpen}
            onClose={() => setIsInviteModalOpen(false)}
            handleCreateInvite={handleCreateInvite}
            isAtLimit={isAtLimit}
            occupiedSlots={occupiedSlots}
            maxUsersLimit={maxUsersLimit}
            onUpgradeClick={() => setActiveTab("billing")}
            canInvite={Boolean(currentUserPerms['organization.members.invite'] || isGlobalAdmin)}
          />
        );
      })()}
      {/* Edit Member Modal */}
      <AnimatePresence>
        {editingMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0A0A0A] border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden"
            >
              <button 
                onClick={() => setEditingMember(null)}
                className="absolute top-4 right-4 text-[#A0A7B5] hover:text-white transition-colors p-2"
              >
                <X className="w-5 h-5" />
              </button>

               <h3 className="text-xl font-semibold text-white mb-6">Editar Membro</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[#A0A7B5] mb-1.5 block">E-mail</label>
                  <input
                    type="text"
                    value={editingMember.email || ""}
                    disabled
                    className="w-full bg-[#1A1D24]/50 border border-white/5 rounded-xl px-4 py-3 text-white text-sm outline-none opacity-70 cursor-not-allowed text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-[#A0A7B5] mb-1.5 block">Nome de Exibição</label>
                  <input
                    type="text"
                    value={editingMemberName}
                    onChange={(e) => setEditingMemberName(e.target.value)}
                    className="w-full bg-[#1A1D24] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#2B85EB] transition-colors"
                    placeholder="Nome do usuário"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-[#A0A7B5] mb-1.5 block">Foto do Membro (URL)</label>
                  <div className="flex gap-3 items-center">
                    {editingMemberPhoto ? (
                      <img 
                        src={editingMemberPhoto} 
                        alt="Preview" 
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-full object-cover border border-white/10 bg-white/5"
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'; }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full border border-dashed border-white/20 bg-white/5 flex items-center justify-center text-[#A0A7B5] text-xs">
                        Foto
                      </div>
                    )}
                    <input
                      type="text"
                      value={editingMemberPhoto}
                      onChange={(e) => setEditingMemberPhoto(e.target.value)}
                      className="flex-1 bg-[#1A1D24] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#2B85EB] transition-colors text-xs"
                      placeholder="https://exemplo.com/foto.jpg"
                    />
                  </div>
                </div>

                {(profile?.systemRole === 'ceo' || profile?.systemRole === 'admin' || profile?.systemRole === 'global_admin' || profile?.organizationRole === 'owner' || profile?.organizationRole === 'admin') && (
                  <div>
                    <label className="text-xs font-medium text-[#A0A7B5] mb-1.5 block">Nível de acesso na Organização</label>
                    {editingMember?.role === 'owner' ? (
                       <div className="w-full bg-[#1A1D24] border border-white/10 rounded-xl px-4 py-3 text-[#A0A7B5] text-sm opacity-70 cursor-not-allowed">
                         {t('dashboard.invite.role_owner', 'Proprietário')}
                       </div>
                    ) : (
                       <select
                         value={editingMemberRole}
                         onChange={(e) => setEditingMemberRole(e.target.value)}
                         className="w-full bg-[#1A1D24] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#2B85EB] transition-colors"
                       >
                         {getInviteableOrganizationRolesForActor({
                           systemRole: profile?.systemRole,
                           organizationRole: profile?.organizationRole
                         }).map((r) => (
                           <option key={r} value={r}>
                             {getOrganizationRoleLabel(r)}
                           </option>
                         ))}
                       </select>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-[#A0A7B5] mb-1.5 block">Função no App MusicScale</label>
                  <select
                    value={["Membro", "Administrador", "Ministro / Líder", "Cantor", "Instrumentista", "Operador de Som", "Operador de Projeção"].includes(editingMemberAppRole) ? editingMemberAppRole : "Custom"}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "Custom") {
                        setEditingMemberAppRole("Outro");
                      } else {
                        setEditingMemberAppRole(val);
                      }
                    }}
                    className="w-full bg-[#1A1D24] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#2B85EB] transition-colors"
                  >
                    {["Membro", "Administrador", "Ministro / Líder", "Cantor", "Instrumentista", "Operador de Som", "Operador de Projeção"].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                    <option value="Custom">Outra (Personalizada)...</option>
                  </select>
                  
                  {(!["Membro", "Administrador", "Ministro / Líder", "Cantor", "Instrumentista", "Operador de Som", "Operador de Projeção"].includes(editingMemberAppRole) || editingMemberAppRole === "Outro") && (
                    <input
                      type="text"
                      value={editingMemberAppRole === "Outro" ? "" : editingMemberAppRole}
                      onChange={(e) => setEditingMemberAppRole(e.target.value)}
                      className="w-full mt-2 bg-[#1A1D24] border border-white/10 rounded-xl px-4 py-3 text-[#2B85EB] text-sm outline-none border-[#2B85EB]/30 focus:border-[#2B85EB] transition-colors"
                      placeholder="Digite a função personalizada no MusicScale"
                    />
                  )}
                </div>

                <div className="pt-2 border-t border-white/5 mt-4">
                  <button
                    type="button"
                    onClick={handleSendMemberPasswordReset}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition-all bg-white/5 text-[#A0A7B5] hover:bg-white/10 border border-white/10 text-xs"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Enviar Link de Redefinição de Senha
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setEditingMember(null)}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold text-white bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveMemberEdit}
                  disabled={editingMemberSaving}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold text-white bg-[#2B85EB] hover:bg-[#1E6FD6] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {editingMemberSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                    </>
                  ) : (
                    "Salvar Alterações"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </EcosystemShell>
    <SupportHub />
    </SupportHubProvider>
  );
}
