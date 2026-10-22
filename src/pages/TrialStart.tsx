import {useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../contexts/AuthContext.js';
import {MillionsNestLogo} from '../components/MillionsNestLogo.js';

const TRIAL_LOGIN_INTENT='mn_musicscale_trial_after_login';
const copy={
  pt:{
    headline:'Conheça o MusicScale por 7 dias.',sub:'Sem cartão. Sem pagamento para começar. Sem cobrança automática.',
    description:'Experimente os recursos Pro para organizar o louvor: escalas, repertórios, cifras, ferramentas musicais e inteligência artificial com limites de uso.',
    limits:'Até 20 importações da Biblioteca Viva e até 10 consultas assistidas por IA durante os 7 dias.',
    start:'Começar meus 7 dias grátis',signup:'Entrar com Google para experimentar',
    loading:'Conferindo sua conta com segurança…',working:'Ativando sua avaliação…',
    activeTitle:'Sua avaliação já está ativa',active:'Você já pode continuar usando o MusicScale. Seus dias restantes não serão reiniciados.',
    historyTitle:'Você já conhece o MusicScale',history:'Encontramos um cadastro, acesso ou avaliação anterior nesta organização ou conta. Seus dados continuam preservados. Confira seu acesso e, se desejar, escolha um plano para continuar.',
    ownerTitle:'Esta conta já participa de uma organização',owner:'A avaliação pode ser iniciada somente pelo titular da organização. Você pode abrir o MusicScale com seu acesso atual ou pedir ao titular para ativá-la.',
    inactiveTitle:'Sua organização precisa de atenção',inactive:'Não foi possível oferecer uma avaliação para esta conta ou organização. Consulte seu painel para conferir o cadastro.',
    unavailableTitle:'Avaliação temporariamente indisponível',unavailable:'Ainda não conseguimos disponibilizar a avaliação para esta organização. Nenhuma cobrança foi iniciada.',
    errorTitle:'Não conseguimos verificar sua conta agora',error:'Houve uma dificuldade de conexão ou verificação. Nenhum pagamento foi iniciado. Tente novamente.',
    newTitle:'Vamos preparar sua igreja',newOrg:'Para começar os 7 dias gratuitos, cadastre primeiro a sua organização no painel. Depois volte à avaliação.',
    choose:'Organização para usar o MusicScale',open:'Abrir meu MusicScale',dashboard:'Ir ao painel',plans:'Conhecer os planos',
    retry:'Tentar novamente',startNew:'Continuar com a avaliação',
    end:'Ao final dos 7 dias, você escolhe se quer assinar. Seus dados são preservados. Não há cobrança automática.',
    back:'Voltar ao site',days:'dias',
  },
  en:{
    headline:'Discover MusicScale for 7 days.',sub:'No card. No payment to start. No automatic charge.',
    description:'Explore Pro features for worship teams: schedules, setlists, chords, music tools and AI with usage limits.',
    limits:'Up to 20 Live Library imports and 10 AI-assisted queries during the 7-day trial.',
    start:'Start my 7 free days',signup:'Continue with Google to try',
    loading:'Checking your account securely…',working:'Activating your free trial…',
    activeTitle:'Your trial is already active',active:'You can continue using MusicScale. Your remaining days will not restart.',
    historyTitle:'Welcome back to MusicScale',history:'We found previous access, registration or a trial for this account or organization. Your data is preserved. Review your access or choose a plan to continue.',
    ownerTitle:'You already belong to an organization',owner:'Only an organization owner can start its trial. Open MusicScale with your existing access or ask the owner to activate it.',
    inactiveTitle:'Your organization needs attention',inactive:'A trial cannot be offered for this account or organization. Check your dashboard.',
    unavailableTitle:'Trial temporarily unavailable',unavailable:'The free trial is not available for this organization yet. No payment has started.',
    errorTitle:'We could not check your account',error:'There was a temporary connection or verification problem. No payment was started. Please retry.',
    newTitle:'Set up your church',newOrg:'Register your organization in the dashboard first, then return to start your 7 free days.',
    choose:'Organization for MusicScale',open:'Open my MusicScale',dashboard:'Open dashboard',plans:'View subscription plans',
    retry:'Try again',startNew:'Continue to free trial',end:'After 7 days, choose whether to subscribe. Your data stays safe, and there are no automatic charges.',back:'Back to website',days:'days',
  },
  es:{
    headline:'Conoce MusicScale durante 7 días.',sub:'Sin tarjeta. Sin pago inicial. Sin cobro automático.',
    description:'Explora las funciones Pro para alabanza: turnos, repertorios, acordes, herramientas musicales e IA con límites de uso.',
    limits:'Hasta 20 importaciones de Biblioteca Viva y 10 consultas asistidas por IA durante los 7 días.',
    start:'Comenzar mis 7 días gratis',signup:'Continuar con Google para probar',
    loading:'Verificando tu cuenta…',working:'Activando tu prueba gratuita…',
    activeTitle:'Tu prueba ya está activa',active:'Puedes seguir usando MusicScale. Los días restantes no volverán a comenzar.',
    historyTitle:'Bienvenido de nuevo a MusicScale',history:'Encontramos un acceso, registro o prueba anterior en esta cuenta u organización. Conservamos tus datos. Revisa tu acceso o elige un plan.',
    ownerTitle:'Ya perteneces a una organización',owner:'Solo el titular de la organización puede activar la prueba. Abre MusicScale o solicita al titular que la active.',
    inactiveTitle:'Tu organización necesita atención',inactive:'No podemos ofrecer la prueba a esta cuenta u organización. Revisa tu panel.',
    unavailableTitle:'Prueba temporalmente no disponible',unavailable:'La prueba todavía no está disponible para esta organización. No se ha iniciado ningún pago.',
    errorTitle:'No pudimos verificar tu cuenta',error:'Hubo un problema temporal de conexión o verificación. No se inició ningún pago. Inténtalo de nuevo.',
    newTitle:'Preparemos tu iglesia',newOrg:'Registra tu organización desde el panel y luego vuelve para activar los 7 días gratis.',
    choose:'Organización de MusicScale',open:'Abrir mi MusicScale',dashboard:'Abrir panel',plans:'Ver planes',
    retry:'Intentar de nuevo',startNew:'Continuar con la prueba',
    end:'Al terminar los 7 días, decides si deseas suscribirte. Tus datos se conservan sin cobros automáticos.',back:'Volver al sitio',days:'días',
  },
};
type Offer={available:boolean;active?:boolean;code?:string};
type Problem='network'|'owner'|'history'|'inactive'|'unavailable'|null;
const HISTORICAL=new Set(['TRIAL_USED','OWNER_TRIAL_USED','PRIOR_SUBSCRIPTION','PRIOR_ACCESS',
  'TRIAL_ALREADY_CONSUMED','OWNER_TRIAL_ALREADY_CONSUMED','PRIOR_MUSICSCALE_SUBSCRIPTION',
  'PRIOR_MUSICSCALE_ACCESS','PRIOR_MUSICSCALE_ENTITLEMENT']);
function reasonToProblem(code?:string,status?:number):Problem{
  if(code==='OWNER_REQUIRED'||status===403&&code==='NO_ORGANIZATION_ACCESS')return 'owner';
  if(code==='TRIAL_COHORT_DISABLED')return 'unavailable';
  if(code==='ORGANIZATION_INACTIVE'||code==='USER_INACTIVE')return 'inactive';
  if(HISTORICAL.has(code||''))return 'history';
  return 'network';
}

export default function TrialStart(){
  const {user,canonicalContext,profile,loading,switchOrganization}=useAuth();
  const {i18n}=useTranslation();
  const c=copy[String(i18n.language).slice(0,2) as keyof typeof copy]||copy.pt;
  const navigate=useNavigate();
  const owned=Array.isArray(canonicalContext?.ownedOrganizations)
    ? canonicalContext.ownedOrganizations.filter((org:any)=>org&&typeof org.id==='string'&&org.status!=='archived')
    : [];
  const activeOrgId=canonicalContext?.activeOrganizationId||profile?.activeOrganizationId||'';
  const [selectedOrgId,setSelectedOrgId]=useState('');
  const orgId=owned.some((org:any)=>org.id===selectedOrgId)?selectedOrgId:
    owned.some((org:any)=>org.id===activeOrgId)?activeOrgId:(owned[0]?.id||'');
  const [offer,setOffer]=useState<Offer|null>(null);
  const [problem,setProblem]=useState<Problem>(null);
  const [busy,setBusy]=useState(false);
  const [attempt,setAttempt]=useState(0);
  const autoAttempted=useRef(false);
  useEffect(()=>{
    let cancelled=false;
    setOffer(null);setProblem(null);
    if(!user||loading||!orgId)return;
    (async()=>{
      try{
        const token=await user.getIdToken();
        const response=await fetch('/api/v1/billing/trial/offer?'+new URLSearchParams({appId:'musicscale',organizationId:orgId}),
          {headers:{Authorization:'Bearer '+token},cache:'no-store'});
        const data=await response.json().catch(()=>({}));
        if(cancelled)return;
        if(!response.ok){setProblem(reasonToProblem(data.code,response.status));return;}
        setOffer(data);
        if(!data.available)sessionStorage.removeItem(TRIAL_LOGIN_INTENT);
        if(data.code==='TRIAL_COHORT_DISABLED')setProblem('unavailable');
        else if(!data.available&&!data.active)setProblem(reasonToProblem(data.code));
      }catch{if(!cancelled)setProblem('network');}
    })();
    return()=>{cancelled=true;};
  },[user,loading,orgId,attempt]);

  async function openApp(){
    setBusy(true);
    try{
      if(orgId&&activeOrgId!==orgId){
        const result=await switchOrganization(orgId);
        if(!result.success){setProblem('network');return;}
      }
      sessionStorage.removeItem(TRIAL_LOGIN_INTENT);
      sessionStorage.removeItem('purchase_intent');
      navigate('/apps/musicscale/launch',{replace:true});
    }finally{setBusy(false);}
  }

  async function start(){
    if(busy)return;
    if(!user){
      sessionStorage.removeItem('purchase_intent');
      sessionStorage.removeItem('purchase_app');
      sessionStorage.setItem(TRIAL_LOGIN_INTENT,'1');
      navigate('/login?next=%2Ftrial');return;
    }
    if(!orgId||!offer?.available)return;
    setBusy(true);setProblem(null);
    try{
      const token=await user.getIdToken();
      const response=await fetch('/api/v1/billing/trial/activate',{
        method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({appId:'musicscale',organizationId:orgId}),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok){
        sessionStorage.removeItem(TRIAL_LOGIN_INTENT);
        if(HISTORICAL.has(data.code)||data.code==='TRIAL_ALREADY_CONSUMED'){
          setProblem('history');setOffer({available:false,code:data.code});return;
        }
        setProblem(reasonToProblem(data.code,response.status));return;
      }
      await openAppAfterActivation();
    }catch{setProblem('network');}
    finally{setBusy(false);}
  }

  async function openAppAfterActivation(){
    if(orgId&&activeOrgId!==orgId){
      const result=await switchOrganization(orgId);
      if(!result.success){setProblem('network');return;}
    }
    sessionStorage.removeItem(TRIAL_LOGIN_INTENT);
    sessionStorage.removeItem('purchase_intent');
    navigate('/apps/musicscale/launch',{replace:true});
  }

  useEffect(()=>{
    // The person expressly clicked Start before Google login. Resume once only.
    // Never auto-activate on a normal visit or for an ineligible account.
    if(!user||!offer?.available||!orgId||busy||autoAttempted.current)return;
    if(sessionStorage.getItem(TRIAL_LOGIN_INTENT)!=='1')return;
    autoAttempted.current=true;
    sessionStorage.removeItem(TRIAL_LOGIN_INTENT);
    void start();
  },[user,orgId,offer?.available]);

  useEffect(()=>{
    // An existing member without an owner organization cannot silently start a
    // later trial just because a previous login left a pending session flag.
    if(user&&!loading&&owned.length===0)sessionStorage.removeItem(TRIAL_LOGIN_INTENT);
  },[user,loading,owned.length]);

  const hasOtherMembership=Boolean(user&&canonicalContext?.hasOrganization);
  const noOwner=Boolean(user&&!loading&&owned.length===0);
  const checking=loading||Boolean(user&&orgId&&!offer&&!problem);
  const view:Problem=noOwner?(hasOtherMembership?'owner':'inactive'):problem;
  const title=offer?.active?c.activeTitle:
    view==='history'?c.historyTitle:view==='owner'?c.ownerTitle:
    view==='unavailable'?c.unavailableTitle:view==='inactive'?(noOwner&&!hasOtherMembership?c.newTitle:c.inactiveTitle):
    view==='network'?c.errorTitle:c.headline;
  const message=offer?.active?c.active:
    view==='history'?c.history:view==='owner'?c.owner:
    view==='unavailable'?c.unavailable:view==='inactive'?(noOwner&&!hasOtherMembership?c.newOrg:c.inactive):
    view==='network'?c.error:c.description;
  const showPlans=Boolean(user&&view==='history');
  const showOpen=Boolean(user&&(offer?.active||view==='history'||view==='owner'));
  return <main className="min-h-screen bg-[#090c12] px-5 py-8 text-white sm:py-12">
    <div className="mx-auto max-w-2xl">
      <MillionsNestLogo className="mx-auto mb-12 h-9 w-auto"/>
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#152237] to-[#0e131d] p-6 shadow-2xl sm:p-10">
        <p className="mb-4 text-sm font-semibold tracking-widest text-emerald-300">MusicScale · 7 {c.days}</p>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">{title}</h1>
        {!view&&!offer?.active&&<p className="mt-5 text-lg text-emerald-200">{c.sub}</p>}
        <p className="mt-6 leading-relaxed text-slate-300" role={view?'status':undefined}>{message}</p>
        {!view&&!offer?.active&&<p className="mt-4 rounded-2xl border border-white/10 p-4 text-sm leading-relaxed text-slate-400">{c.limits}</p>}
        {user&&owned.length>1&&<label className="mt-6 block text-sm text-slate-200">
          <span className="mb-2 block">{c.choose}</span>
          <select value={orgId} onChange={e=>{setSelectedOrgId(e.target.value);autoAttempted.current=true;sessionStorage.removeItem(TRIAL_LOGIN_INTENT);}}
            className="w-full rounded-xl border border-white/20 bg-[#111827] p-3 text-white">
            {owned.map((org:any)=><option key={org.id} value={org.id}>{org.name||org.id}</option>)}
          </select>
        </label>}
        <div className="mt-7 space-y-3">
          {checking?<p role="status" className="py-4 text-center text-slate-300">{c.loading}</p>:
            busy?<p role="status" className="py-4 text-center text-slate-300">{c.working}</p>:
            showOpen?<button onClick={()=>void openApp()} className="w-full rounded-xl bg-emerald-300 px-5 py-4 font-semibold text-emerald-950">{c.open}</button>:
            noOwner?<button onClick={()=>navigate('/dashboard')} className="w-full rounded-xl bg-white px-5 py-4 font-semibold text-black">{c.dashboard}</button>:
            view==='network'?<button onClick={()=>{setProblem(null);setAttempt(n=>n+1);}} className="w-full rounded-xl bg-white px-5 py-4 font-semibold text-black">{c.retry}</button>:
            view==='unavailable'||view==='inactive'?<button onClick={()=>navigate('/dashboard')} className="w-full rounded-xl bg-white px-5 py-4 font-semibold text-black">{c.dashboard}</button>:
            <button onClick={()=>void start()} className="w-full rounded-xl bg-emerald-300 px-5 py-4 font-semibold text-emerald-950">{user?c.start:c.signup}</button>}
          {showPlans&&<button onClick={()=>navigate('/checkout?app=musicscale&intent=paid')} className="w-full py-3 text-sm text-slate-300 underline">{c.plans}</button>}
          {view==='owner'&&owned.length>0&&<button onClick={()=>navigate('/dashboard')} className="w-full py-3 text-sm text-slate-300 underline">{c.dashboard}</button>}
        </div>
        <p className="mt-5 text-center text-xs leading-relaxed text-slate-400">{c.end}</p>
      </section>
      <button onClick={()=>navigate('/musicscale')} className="mt-6 py-2 text-sm text-slate-400">{c.back}</button>
    </div>
  </main>;
}
