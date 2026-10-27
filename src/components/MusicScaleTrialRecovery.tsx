import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../contexts/AuthContext.js';
/** Recover signup without activation. Offer discovery never grants access. */
export function MusicScaleTrialRecovery({organizationId}:{organizationId:string}){
 const {user}=useAuth(),{i18n}=useTranslation();
 const [offer,setOffer]=useState<{available?:boolean;active?:boolean}|null>(null);
 useEffect(()=>{
  const c=new AbortController();setOffer(null);
  if(!user||!organizationId)return;
  void(async()=>{try{
   const token=await user.getIdToken();
   const res=await fetch('/api/v1/billing/trial/offer?'+new URLSearchParams({appId:'musicscale',organizationId}),
    {headers:{Authorization:'Bearer '+token},signal:c.signal,cache:'no-store'});
   const data=await res.json();
   if(!c.signal.aborted&&res.ok&&data.organizationId===organizationId)setOffer(data);
  }catch{/* Existing launcher and support remain available. */}})();
  return()=>c.abort();
 },[user,organizationId]);
 if(!offer?.available&&!offer?.active)return null;
 const lang=String(i18n.language).slice(0,2);
 const text=lang==='en'?['Your MusicScale is ready to open','Finish entering MusicScale here. No card or automatic charge.','Continue to MusicScale']:
 lang==='es'?['Tu MusicScale está listo para abrir','Completa tu acceso aquí. Sin tarjeta ni cobro automático.','Continuar a MusicScale']:
 ['Seu MusicScale está pronto para começar','Conclua sua entrada por aqui. Sem cartão e sem cobrança automática.','Continuar para o MusicScale'];
 const action=offer.available?(lang==='en'?'Start 7 free days and open MusicScale':lang==='es'?'Activar 7 días gratis y abrir MusicScale':'Ativar 7 dias grátis e abrir o MusicScale'):text[2];
 return <section aria-label="MusicScale" className="mb-6 rounded-2xl border border-[#2B85EB]/30 bg-[#0B1422] p-5">
  <h2 className="text-lg font-semibold text-white">{text[0]}</h2>
  <p className="mt-2 text-sm leading-relaxed text-slate-300">{text[1]}</p>
  <Link to={offer.active?'/apps/musicscale/launch':'/trial'} onClick={()=>{if(offer.available)sessionStorage.setItem('mn_musicscale_trial_after_login','1');}} className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-[#2475D1] px-5 py-3 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4">{action}</Link>
 </section>;
}
