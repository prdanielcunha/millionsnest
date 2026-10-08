import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext.js';
import {canExtendHubTrial} from '../lib/permissionService.js';
import {EcosystemShell} from '../components/EcosystemShell.js';

type TrialApp='musicscale'|'nestlocal';
type TrialStatus={
  ok:boolean; organizationId:string;organizationName:string;appId:TrialApp;
  canExtend:boolean;hasExistingSubscription:boolean;extensionRecorded:boolean;
  trial:null|{active:boolean;expired:boolean;extended:boolean;
    baseEndsAt:string|null;effectiveEndsAt:string;extensionDays:number};
};
function showDate(value:string|null|undefined) {
  if(!value)return '—';
  const d=new Date(value);
  return Number.isFinite(d.getTime())
    ?d.toLocaleString('pt-BR',{dateStyle:'medium',timeStyle:'short'}):'—';
}
export function TrialManagement(){
  const {user,profile,loading}=useAuth();
  const allowed=canExtendHubTrial(profile);
  const [appId,setAppId]=useState<TrialApp>('musicscale');
  const [organizationId,setOrganizationId]=useState('');
  const [status,setStatus]=useState<TrialStatus|null>(null);
  const [days,setDays]=useState(7);
  const [reason,setReason]=useState('');
  const [confirm,setConfirm]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  async function request(path:string,init?:RequestInit){
    if(!user)throw Error('Faça login no Hub.');
    const token=await user.getIdToken();
    const res=await fetch(path,{...init,headers:{
      Authorization:'Bearer '+token,'Content-Type':'application/json',...init?.headers,
    }});
    const payload=await res.json().catch(()=>({}));
    if(!res.ok)throw Error(payload.error||payload.code||'Operação não concluída.');
    return payload;
  }
  async function lookup(){
    if(!organizationId.trim())return;
    setBusy(true);setError('');setMessage('');setStatus(null);setConfirm(false);
    try {
      const query=new URLSearchParams({organizationId:organizationId.trim(),appId});
      setStatus(await request('/api/v1/billing/trial/admin/status?'+query) as TrialStatus);
    }catch(e){setError(e instanceof Error?e.message:'Erro inesperado.')}
    finally{setBusy(false)}
  }
  async function extend(){
    if(!status?.canExtend||!confirm||reason.trim().length<12)return;
    setBusy(true);setError('');setMessage('');
    try{
      const result=await request('/api/v1/billing/trial/extend',{
        method:'POST',body:JSON.stringify({
          organizationId:status.organizationId,appId:status.appId,
          days,reason:reason.trim(),
        }),
      });
      setMessage('Extensão concedida. Novo vencimento: '+showDate(result.effectiveEndsAt)+'.');
      const query=new URLSearchParams({organizationId:status.organizationId,appId:status.appId});
      setStatus(await request('/api/v1/billing/trial/admin/status?'+query) as TrialStatus);
      setConfirm(false);setReason('');
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível conceder a extensão.')}
    finally{setBusy(false)}
  }
  if(loading)return <div className="min-h-screen bg-[#060b15] text-white p-8">Carregando permissões…</div>;
  if(!user||!allowed)return <div className="min-h-screen bg-[#060b15] text-white p-8"><h1 className="text-xl font-semibold">Acesso restrito</h1><p className="mt-3 text-slate-400">Somente CEO, administração global e suporte MillionsNest podem estender avaliações.</p><Link to="/dashboard" className="text-blue-300">Voltar ao Hub</Link></div>;
  return <EcosystemShell activeAppId="core">
    <main className="min-h-screen bg-[#060b15] text-slate-100 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2"><Link to="/dashboard" className="text-sm text-blue-300">← Voltar ao Hub</Link>
          <span className="block text-xs uppercase tracking-[.18em] text-blue-300">MillionsNest · Administração do ecossistema</span>
          <h1 className="text-3xl font-semibold tracking-tight">Avaliações e extensões</h1>
          <p className="text-slate-400">MusicScale: 14 dias. NestLocal: 7 dias. Apenas a equipe MillionsNest pode conceder uma extensão de até 7 dias, sem alterar o Stripe.</p>
        </header>
        <section className="grid gap-4 rounded-2xl border border-white/10 bg-[#101827] p-5 md:grid-cols-2">
          <label className="text-sm text-slate-300">Aplicativo
            <select value={appId} onChange={e=>{setAppId(e.target.value as TrialApp);setStatus(null);setMessage('')}}
              className="mt-2 w-full rounded-xl border border-white/15 bg-[#0a1220] p-3">
              <option value="musicscale">MusicScale</option><option value="nestlocal">NestLocal</option>
            </select>
          </label>
          <label className="text-sm text-slate-300">Identificador da organização
            <input value={organizationId} onChange={e=>{setOrganizationId(e.target.value);setStatus(null)}}
              autoComplete="off" placeholder="org_..." className="mt-2 w-full rounded-xl border border-white/15 bg-[#0a1220] p-3"/>
          </label>
          <button type="button" onClick={lookup} disabled={busy||!organizationId.trim()}
            className="rounded-xl bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50 md:col-span-2">
            {busy?'Consultando…':'Consultar avaliação'}
          </button>
        </section>
        {error&&<p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-rose-200">{error}</p>}
        {message&&<p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-200">{message}</p>}
        {status&&<section className="space-y-4 rounded-2xl border border-white/10 bg-[#101827] p-5">
          <h2 className="text-xl font-semibold">{status.organizationName}</h2>
          <p className="text-sm text-slate-400">{status.appId} · {status.organizationId}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white/5 p-3"><div className="text-xs text-slate-400">Prazo inicial</div><div className="mt-1 font-medium">{showDate(status.trial?.baseEndsAt)}</div></div>
            <div className="rounded-xl bg-white/5 p-3"><div className="text-xs text-slate-400">Vencimento efetivo</div><div className="mt-1 font-medium">{showDate(status.trial?.effectiveEndsAt)}</div></div>
          </div>
          <p className="text-sm text-slate-300">{!status.trial?'Não existe trial interno verificável. Nenhuma extensão pode ser concedida.':
            status.hasExistingSubscription?'Existe histórico de assinatura. O trial não pode ser modificado.':
            status.trial.extended?'A extensão já foi usada. Não há renovação automática.':
            status.trial.active?'Avaliação ativa.': 'Avaliação encerrada; assinatura necessária após o prazo efetivo.'}</p>
          {status.canExtend&&<div className="space-y-3 border-t border-white/10 pt-4">
            <h3 className="font-semibold">Extensão excepcional, uma única vez</h3>
            <label className="block text-sm text-slate-300">Dias adicionais (1 a 7)
              <select value={days} onChange={e=>setDays(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-white/15 bg-[#0a1220] p-3">
                {[1,2,3,4,5,6,7].map(n=><option key={n} value={n}>{n} {n===1?'dia':'dias'}</option>)}
              </select>
            </label>
            <label className="block text-sm text-slate-300">Motivo obrigatório (mínimo de 12 caracteres)
              <textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} rows={3}
                className="mt-2 w-full rounded-xl border border-white/15 bg-[#0a1220] p-3" placeholder="Explique a necessidade desta extensão."/>
            </label>
            <label className="flex items-start gap-3 text-sm text-slate-300">
              <input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)} className="mt-1"/>
              <span>Confirmo que atuo pela equipe MillionsNest. Essa extensão é única, auditada, não gera assinatura, cobrança ou créditos de IA adicionais.</span>
            </label>
            <button type="button" onClick={extend} disabled={busy||!confirm||reason.trim().length<12}
              className="w-full rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-[#041b11] hover:bg-emerald-400 disabled:opacity-50">
              {busy?'Salvando…':'Conceder extensão com auditoria'}
            </button>
          </div>}
        </section>}
      </div>
    </main>
  </EcosystemShell>;
}
