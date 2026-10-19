import { useEffect, useId, useRef, useState } from 'react';
import { withAbortDeadline } from '../lib/withAbortDeadline.js';

type Access = Record<'enabled' | 'count' | 'register' | 'review' | 'approve' | 'balance' | 'manage', boolean>;
type Result = { access: Access; revision: number; editable: boolean; individual: boolean; inherited: boolean };
const COPY = {
  pt: { title: 'Permissões do NestFinance', intro: 'Escolha o que esta pessoa pode fazer nas finanças da igreja.',
    precise: 'Ao salvar, somente os acessos marcados valerão no NestFinance. Os outros aplicativos não mudam.',
    locked: 'Este acesso é protegido. Você não pode alterar seu próprio acesso, limitar uma função global ou alterar o dono sem autoridade global.',
    legacy: 'O acesso atual vem das permissões anteriores. Revise cada opção antes de salvar.',
    save: 'Salvar permissões', saving: 'Salvando…', loading: 'Carregando permissões…', retry: 'Tentar novamente',
    error: 'Não foi possível carregar ou salvar. Tente novamente.', conflict: 'Outra pessoa alterou este acesso. Recarregue e revise as opções.',
    success: 'Permissões salvas. A sessão anterior foi invalidada para aplicar o novo acesso.',
    reason: 'Motivo da alteração', reasons: ['Organização da equipe', 'Mudança de responsabilidade', 'Retirada de acesso'],
    rows: [
      ['enabled', 'Entrar no NestFinance', 'Permitir que esta pessoa abra o aplicativo.'],
      ['count', 'Contar dízimos e ofertas', 'Registrar e conferir a contagem do culto, sem liberar outros lançamentos.'],
      ['balance', 'Ver o saldo', 'Consultar o saldo e informações financeiras, sem alterar valores.'],
      ['register', 'Registrar entradas e despesas', 'Criar e corrigir registros em preparação e enviá-los para conferência.'],
      ['review', 'Conferir os registros', 'Revisar valores e comprovantes, devolver para correção e conferir contagens.'],
      ['approve', 'Aprovar registros', 'Autorizar que os registros conferidos sejam efetivados.'],
      ['manage', 'Administrar todas as finanças', 'Acesso completo: inclui saldo, registros, aprovações e configurações.'],
    ],
  },
  en: { title: 'NestFinance permissions', intro: 'Choose what this person can do with church finances.',
    precise: 'After saving, only the selected NestFinance permissions apply. Other apps stay unchanged.',
    locked: 'This access is protected. You cannot edit your own access, restrict global authority, or change the owner without global authority.',
    legacy: 'Current access comes from earlier permissions. Review every option before saving.',
    save: 'Save permissions', saving: 'Saving…', loading: 'Loading permissions…', retry: 'Try again',
    error: 'Could not load or save permissions. Please try again.', conflict: 'Someone else changed this access. Reload and review the options.',
    success: 'Permissions saved. The previous session was invalidated to apply the new access.',
    reason: 'Reason for change', reasons: ['Team setup', 'Responsibility changed', 'Access removed'],
    rows: [
      ['enabled', 'Open NestFinance', 'Allow this person to enter the app.'],
      ['count', 'Count tithes and offerings', 'Record and check service counts without access to other entries.'],
      ['balance', 'View the balance', 'View the balance and financial information without changing amounts.'],
      ['register', 'Record income and expenses', 'Create and correct records in preparation and send them for review.'],
      ['review', 'Check records', 'Review amounts and receipts, return corrections and check counts.'],
      ['approve', 'Approve records', 'Authorize reviewed records to take effect.'],
      ['manage', 'Manage all finances', 'Full access: includes balances, entries, approvals and settings.'],
    ],
  },
  es: { title: 'Permisos de NestFinance', intro: 'Elige qué puede hacer esta persona con las finanzas de la iglesia.',
    precise: 'Al guardar, solo se aplicarán los permisos marcados en NestFinance. Las otras aplicaciones no cambian.',
    locked: 'Este acceso está protegido. No puedes editar tu propio acceso, limitar una función global ni cambiar al dueño sin autoridad global.',
    legacy: 'El acceso actual proviene de permisos anteriores. Revisa cada opción antes de guardar.',
    save: 'Guardar permisos', saving: 'Guardando…', loading: 'Cargando permisos…', retry: 'Intentar otra vez',
    error: 'No se pudieron cargar o guardar los permisos. Intenta otra vez.', conflict: 'Otra persona cambió este acceso. Recarga y revisa las opciones.',
    success: 'Permisos guardados. La sesión anterior fue invalidada para aplicar el nuevo acceso.',
    reason: 'Motivo del cambio', reasons: ['Organización del equipo', 'Cambio de responsabilidad', 'Retirada de acceso'],
    rows: [
      ['enabled', 'Entrar a NestFinance', 'Permitir que esta persona abra la aplicación.'],
      ['count', 'Contar diezmos y ofrendas', 'Registrar y revisar el conteo del culto sin permitir otros registros.'],
      ['balance', 'Ver el saldo', 'Consultar el saldo y la información financiera sin cambiar importes.'],
      ['register', 'Registrar ingresos y gastos', 'Crear y corregir registros en preparación y enviarlos a revisión.'],
      ['review', 'Revisar los registros', 'Revisar importes y comprobantes, devolver correcciones y revisar conteos.'],
      ['approve', 'Aprobar registros', 'Autorizar que los registros revisados se hagan efectivos.'],
      ['manage', 'Administrar todas las finanzas', 'Acceso completo: incluye saldo, registros, aprobaciones y ajustes.'],
    ],
  },
};
const REASONS = ['team_setup', 'responsibility_changed', 'access_removed'];
export function NestFinanceMemberAccessEditor({ organizationId, memberId, locale, user }: {
  organizationId: string; memberId: string; locale: string; user: { getIdToken: () => Promise<string> } | null;
}) {
  const copy = COPY[locale.startsWith('en') ? 'en' : locale.startsWith('es') ? 'es' : 'pt'];
  const id = useId();
  const [open, setOpen] = useState(false), [result, setResult] = useState<Result | null>(null);
  const [draft, setDraft] = useState<Access | null>(null), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [saved, setSaved] = useState(false), [reason, setReason] = useState(REASONS[0]);
  const epoch = useRef(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { epoch.current++; request.current?.abort(); }, [organizationId, memberId, user]);
  async function send(save = false) {
    if (!user || (save && (!draft || !result?.editable))) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const generation = ++epoch.current;
    setBusy(true); setError(''); setSaved(false);
    // Bound both token acquisition and network latency; no endless login/retry loop.
    try {
      const body = await withAbortDeadline(controller, async () => {
        const token = await user.getIdToken();
        if (controller.signal.aborted) throw new Error('TIMEOUT');
        const response = await fetch(`/api/v1/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(memberId)}/nestfinance-access`, {
        method: save ? 'PATCH' : 'GET', signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, ...(save ? { 'Content-Type': 'application/json' } : {}) },
        ...(save ? { body: JSON.stringify({ access: draft, expectedRevision: result!.revision, reason }) } : {}),
      });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(response.status === 409 ? 'CONFLICT' : 'REQUEST_FAILED');
        return payload;
      });
      if (generation !== epoch.current) return;
      setResult(body); setDraft(body.access); setSaved(save);
    } catch (failure) {
      if (generation === epoch.current) {
        const conflict = failure instanceof Error && failure.message === 'CONFLICT';
        if (conflict) { setResult(null); setDraft(null); }
        setError(conflict ? copy.conflict : copy.error);
      }
    } finally {
      if (generation === epoch.current) setBusy(false);
    }
  }
  return <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025]">
    <button type="button" aria-expanded={open} aria-controls={id} className="min-h-12 w-full px-4 py-3 text-left text-sm font-semibold text-[#F5F7FA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7DB7FA]"
      onClick={() => { setOpen(!open); if (!open && !result && !busy) void send(); }}>{copy.title}<span aria-hidden="true" className="float-right">{open ? '−' : '+'}</span></button>
    {open && <div id={id} className="space-y-4 border-t border-white/10 p-4">
      <p className="text-sm leading-relaxed text-[#A0A7B5]">{copy.intro}</p>
      {busy && !result && <p role="status" className="text-sm text-[#A0A7B5]">{copy.loading}</p>}
      {error && <div role="alert" className="space-y-2 text-sm text-red-200"><p>{error}</p><button type="button" disabled={busy} onClick={() => void send()} className="min-h-11 underline">{copy.retry}</button></div>}
      {result && draft && <>
        <p className="rounded-xl border border-[#7DB7FA]/20 bg-[#7DB7FA]/[0.06] p-3 text-sm leading-relaxed text-[#C9DFF9]">{!result.editable ? copy.locked : !result.individual ? copy.legacy : copy.precise}</p>
        <fieldset disabled={busy || !result.editable} className="grid min-w-0 gap-2 lg:grid-cols-2 disabled:opacity-70">
          <legend className="sr-only">{copy.title}</legend>
          {copy.rows.map(([key, label, description]) => <label key={key} className="flex min-h-20 min-w-0 cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] p-3 hover:bg-white/[0.03] focus-within:ring-2 focus-within:ring-[#7DB7FA]">
            <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#7DB7FA]" checked={draft[key as keyof Access] || (key !== 'enabled' && draft.manage)}
              disabled={key !== 'enabled' && key !== 'manage' && draft.manage}
              onChange={event => { setDraft({ ...draft, [key]: event.target.checked }); setSaved(false); }} />
            <span className="min-w-0"><span className="block text-sm font-semibold text-[#F5F7FA]">{label}</span><span className="mt-1 block text-xs leading-relaxed text-[#A0A7B5]">{description}</span></span>
          </label>)}
        </fieldset>
        {result.editable && <>
          <p className="text-xs leading-relaxed text-[#A0A7B5]">{copy.precise}</p>
          <label className="block text-sm text-[#A0A7B5]">{copy.reason}<select value={reason} disabled={busy} onChange={event => setReason(event.target.value)} className="mt-2 block min-h-12 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-3 text-base text-[#F5F7FA]">
            {REASONS.map((value, index) => <option key={value} value={value}>{copy.reasons[index]}</option>)}
          </select></label>
          <button type="button" disabled={busy || !!error} onClick={() => void send(true)} className="min-h-12 w-full rounded-xl bg-[#D4E6FF] px-5 py-3 text-sm font-bold text-[#0B0F19] disabled:opacity-50 sm:w-auto">{busy ? copy.saving : copy.save}</button>
        </>}
      </>}
      {saved && <p role="status" className="text-sm text-emerald-200">{copy.success}</p>}
    </div>}
  </section>;
}
