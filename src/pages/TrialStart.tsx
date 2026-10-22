import {useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../contexts/AuthContext.js';
import {MillionsNestLogo} from '../components/MillionsNestLogo.js';

const copy={
  pt:{title:'Conheça o MusicScale por 7 dias.',subtitle:'Sem cartão. Sem pagamento para começar. Sem cobrança automática.',
    description:'Experimente os recursos Pro para organizar o louvor: escalas, repertórios, cifras, ferramentas musicais e inteligência artificial com limites de uso.',
    limits:'Até 20 importações da Biblioteca Viva durante a avaliação. Até 10 consultas assistidas por IA durante os 7 dias. Você escolhe Starter, Advanced ou Pro quando decidir assinar.',
    start:'Começar 7 dias grátis',signup:'Criar conta e experimentar',loading:'Verificando sua avaliação…',working:'Ativando seus 7 dias…',
    active:'Sua avaliação já está ativa.',open:'Abrir MusicScale',unavailable:'Esta conta ou organização já possui acesso ou histórico de avaliação. Entre no aplicativo ou consulte sua assinatura.',
    error:'Não foi possível confirmar a avaliação agora. Tente novamente; nenhum pagamento foi iniciado.',retry:'Tentar novamente',
    organization:'Escolha sua organização no painel para continuar.',dashboard:'Abrir painel',paid:'Ver planos de assinatura',
    end:'Ao fim dos 7 dias, você decide se quer assinar. Seus dados são preservados. Nada será cobrado automaticamente.',back:'Voltar ao site'},
  en:{title:'Discover MusicScale for 7 days.',subtitle:'No card. No payment to start. No automatic charge.',
    description:'Try Pro features to organize worship: schedules, setlists, chords, musical tools and AI with usage limits.',
    limits:'Up to 20 Live Library imports during the trial. Up to 10 AI-assisted queries during the 7 days. Choose Starter, Advanced or Pro when you decide to subscribe.',
    start:'Start 7 free days',signup:'Create account and try',loading:'Checking your trial…',working:'Starting your 7 days…',
    active:'Your trial is already active.',open:'Open MusicScale',unavailable:'This account or organization already has access or trial history. Open the app or review your subscription.',
    error:'We could not confirm your trial. Please try again; no payment was initiated.',retry:'Try again',
    organization:'Choose your organization in the dashboard to continue.',dashboard:'Open dashboard',paid:'View subscription plans',
    end:'After 7 days, you decide whether to subscribe. Your data is preserved. You will not be charged automatically.',back:'Back to website'},
  es:{title:'Conoce MusicScale durante 7 días.',subtitle:'Sin tarjeta. Sin pago para empezar. Sin cobro automático.',
    description:'Prueba las funciones Pro para organizar la alabanza: turnos, repertorios, acordes, herramientas musicales e IA con límites de uso.',
    limits:'Hasta 20 importaciones de la Biblioteca Viva durante la prueba. Hasta 10 consultas asistidas por IA durante los 7 días. Elige Starter, Advanced o Pro cuando decidas suscribirte.',
    start:'Comenzar 7 días gratis',signup:'Crear cuenta y probar',loading:'Verificando tu prueba…',working:'Activando tus 7 días…',
    active:'Tu prueba ya está activa.',open:'Abrir MusicScale',unavailable:'Esta cuenta u organización ya tiene acceso o historial de prueba. Abre la aplicación o consulta tu suscripción.',
    error:'No pudimos confirmar la prueba. Inténtalo de nuevo; no se inició ningún pago.',retry:'Intentar de nuevo',
    organization:'Elige tu organización en el panel para continuar.',dashboard:'Abrir panel',paid:'Ver planes de suscripción',
    end:'Después de 7 días, tú decides si deseas suscribirte. Tus datos se conservan. No se cobrará automáticamente.',back:'Volver al sitio'},
};
type Offer={available:boolean;active?:boolean;code?:string};
export default function TrialStart(){
  const {user,profile,canonicalContext,loading}=useAuth();
  const {i18n}=useTranslation();
  const c=copy[String(i18n.language).slice(0,2) as keyof typeof copy]||copy.pt;
  const navigate=useNavigate();
  const orgId=canonicalContext?.activeOrganizationId||profile?.activeOrganizationId||profile?.primaryOrganizationId||profile?.organizationId;
  const [offer,setOffer]=useState<Offer|null>(null);
  const [error,setError]=useState(false),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let cancelled=false;
    setOffer(null);setError(false);
    if(!user||!orgId)return;
    (async()=>{
      try{
        const token=await user.getIdToken();
        const response=await fetch('/api/v1/billing/trial/offer?'+new URLSearchParams({appId:'musicscale',organizationId:orgId}),
          {headers:{Authorization:'Bearer '+token},cache:'no-store'});
        if(!response.ok)throw Error('offer');
        const data=await response.json();
        if(!cancelled){if(data.code==='TRIAL_COHORT_DISABLED')setError(true);else setOffer(data);}
      }catch{if(!cancelled)setError(true);}
    })();
    return()=>{cancelled=true};
  },[user,orgId,attempt]);
  async function start(){
    if(busy)return;
    if(!user){
      sessionStorage.removeItem('purchase_intent');
      sessionStorage.setItem('purchase_app','musicscale');
      navigate('/login?next=%2Ftrial');return;
    }
    if(!orgId||!offer?.available)return;
    setBusy(true);setError(false);
    try{
      const token=await user.getIdToken();
      const response=await fetch('/api/v1/billing/trial/activate',{
        method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({appId:'musicscale',organizationId:orgId}),
      });
      if(!response.ok)throw Error('activation');
      sessionStorage.removeItem('purchase_intent');
      navigate('/apps/musicscale/launch',{replace:true});
    }catch{setError(true);}finally{setBusy(false);}
  }
  const checking=loading||Boolean(user&&orgId&&!offer&&!error);
  return <main className="min-h-screen bg-[#090c12] px-5 py-8 text-white sm:py-12">
    <div className="mx-auto max-w-2xl">
      <MillionsNestLogo className="mx-auto mb-12 h-9 w-auto"/>
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#152237] to-[#0e131d] p-6 shadow-2xl sm:p-10">
        <p className="mb-4 text-sm font-semibold tracking-widest text-emerald-300">MusicScale · 7 {String(i18n.language).startsWith('en')?'days':'dias'}</p>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">{c.title}</h1>
        <p className="mt-5 text-lg text-emerald-200">{c.subtitle}</p>
        <p className="mt-6 leading-relaxed text-slate-300">{c.description}</p>
        <p className="mt-4 rounded-2xl border border-white/10 p-4 text-sm leading-relaxed text-slate-400">{c.limits}</p>
        {error&&<p role="alert" className="mt-5 text-sm text-amber-200">{c.error}</p>}
        {offer?.active&&<p className="mt-5 text-emerald-200">{c.active}</p>}
        {offer&&!offer.available&&!offer.active&&<p className="mt-5 text-sm text-slate-300">{c.unavailable}</p>}
        {!loading&&user&&!orgId&&<p className="mt-5 text-sm text-slate-300">{c.organization}</p>}
        <div className="mt-7 space-y-3">
          {checking?<p role="status" className="py-4 text-center text-slate-300">{c.loading}</p>:
            error?<button onClick={()=>{setError(false);setAttempt(x=>x+1)}} className="w-full rounded-xl bg-white px-5 py-4 font-semibold text-black">{c.retry}</button>:
            user&&!orgId?<button onClick={()=>navigate('/dashboard')} className="w-full rounded-xl bg-white px-5 py-4 font-semibold text-black">{c.dashboard}</button>:
            offer&&!offer.available?<button onClick={()=>navigate('/apps/musicscale/launch')} className="w-full rounded-xl bg-emerald-300 px-5 py-4 font-semibold text-emerald-950">{c.open}</button>:
            <button onClick={start} disabled={busy} className="w-full rounded-xl bg-emerald-300 px-5 py-4 font-semibold text-emerald-950 transition hover:bg-emerald-200 disabled:opacity-50">{busy?c.working:user?c.start:c.signup}</button>}
          {offer&&!offer.available&&<button onClick={()=>navigate('/checkout?app=musicscale&intent=paid')} className="w-full py-3 text-sm text-slate-300 underline">{c.paid}</button>}
        </div>
        <p className="mt-5 text-center text-xs leading-relaxed text-slate-400">{c.end}</p>
      </section>
      <button onClick={()=>navigate('/musicscale')} className="mt-6 py-2 text-sm text-slate-400">{c.back}</button>
    </div>
  </main>;
}
