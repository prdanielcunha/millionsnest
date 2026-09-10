import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  GripVertical,
  Headphones,
  MapPin,
  Music2,
  Pause,
  Play,
  Plus,
  SlidersHorizontal,
  Sparkles,
  UsersRound,
  Volume2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

export interface MusicScaleDemoStep {
  step: string;
  title: string;
  desc: string;
}

interface MusicScaleGuidedDemoProps {
  steps: MusicScaleDemoStep[];
  activeStep: number;
  onSelectStep: (index: number) => void;
}

function FrameHeader({ title, kicker }: { title: string; kicker: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-[#637083]">{kicker}</div>
        <div className="mt-1 truncate text-[12px] font-semibold text-white sm:text-sm">{title}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-300" />
        <span className="text-[8px] font-semibold text-[#788596]">MusicScale</span>
      </div>
    </div>
  );
}

function CreateScaleVisual() {
  const { t } = useTranslation(["musicscale"]);
  return (
    <div className="h-full bg-[#07090D]">
      <FrameHeader title={t("demo_visual.create_title", "Nova Escala de Músicas")} kicker={t("demo_visual.product_ui", "INTERFACE DO PRODUTO")} />
      <div className="p-4 sm:p-5">
        <div className="flex gap-3 overflow-hidden border-b border-white/[0.07] pb-3">
          {[
            t("demo_visual.event", "Evento"),
            t("demo_visual.band", "Banda"),
            t("demo_visual.repertoire", "Repertório"),
            t("demo_visual.review", "Revisão"),
          ].map((label, index) => (
            <div key={label} className={`shrink-0 text-[9px] font-semibold ${index === 0 ? "text-[#6FAEFF]" : "text-[#596576]"}`}>
              {label}
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/[0.08] bg-[#111723] p-3">
            <div className="text-[7px] font-bold uppercase tracking-[0.16em] text-[#667487]">{t("demo_visual.date", "Data")}</div>
            <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-white">
              <CalendarDays className="h-3.5 w-3.5 text-[#6FAEFF]" /> 13/09/2026
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#111723] p-3">
            <div className="text-[7px] font-bold uppercase tracking-[0.16em] text-[#667487]">{t("demo_visual.time", "Horário")}</div>
            <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-white">
              <Clock3 className="h-3.5 w-3.5 text-[#6FAEFF]" /> 19:00
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#111723] p-3">
            <div className="text-[7px] font-bold uppercase tracking-[0.16em] text-[#667487]">{t("demo_visual.location", "Local")}</div>
            <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-white">
              <MapPin className="h-3.5 w-3.5 text-[#6FAEFF]" /> {t("demo_visual.main_temple", "Templo Principal")}
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-[#2B85EB]/20 bg-[#2B85EB]/[0.06] p-3">
          <div className="text-[7px] font-bold uppercase tracking-[0.16em] text-[#7CB7FF]">{t("demo_visual.event_type", "Tipo de evento")}</div>
          <div className="mt-1.5 text-[11px] font-semibold text-white">{t("demo_visual.sunday_service", "Culto de Domingo")}</div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <div className="rounded-xl border border-white/[0.08] px-3 py-2 text-[9px] font-semibold text-[#8B96A5]">{t("demo_visual.save_draft", "Salvar rascunho")}</div>
          <div className="rounded-xl bg-white px-3 py-2 text-[9px] font-semibold text-[#07090D]">{t("demo_visual.next", "Avançar")}</div>
        </div>
      </div>
    </div>
  );
}

function RepertoireVisual() {
  const { t } = useTranslation(["musicscale"]);
  const songs = [
    { title: t("demo_visual.song_one", "Canção de Esperança"), keyName: "G", bpm: "72" },
    { title: t("demo_visual.song_two", "Graça Sobre Graça"), keyName: "D", bpm: "68" },
    { title: t("demo_visual.song_three", "Tudo Entregarei"), keyName: "A", bpm: "76" },
  ];
  return (
    <div className="h-full bg-[#07090D]">
      <FrameHeader title={t("demo_visual.repertoire_title", "Repertório do culto")} kicker={t("demo_visual.product_ui", "INTERFACE DO PRODUTO")} />
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-[#637083]">{t("demo_visual.sunday_service", "Culto de Domingo")}</div>
            <div className="mt-1 text-[11px] font-semibold text-white">{t("demo_visual.songs_ready", "3 músicas organizadas")}</div>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-[#2B85EB]/20 bg-[#2B85EB]/10 px-2.5 py-2 text-[8px] font-semibold text-[#9AC8FF]">
            <Plus className="h-3 w-3" /> {t("demo_visual.add_song", "Adicionar música")}
          </div>
        </div>
        <div className="space-y-2">
          {songs.map((song, index) => (
            <div key={song.title} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <div className="flex items-center gap-2">
                <GripVertical className="h-3.5 w-3.5 text-[#465162]" />
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#2B85EB]/10 text-[9px] font-bold text-[#87BCFF]">{index + 1}</div>
              </div>
              <div className="min-w-0">
                <div className="truncate text-[10px] font-semibold text-white">{song.title}</div>
                <div className="mt-1 flex items-center gap-2 text-[8px] text-[#697586]">
                  <Headphones className="h-3 w-3" />
                  {t("demo_visual.reference_ready", "Referência pronta")}
                </div>
              </div>
              <div className="flex gap-1.5">
                <span className="rounded-lg border border-[#6166FF]/20 bg-[#6166FF]/10 px-2 py-1 text-[8px] font-bold text-[#A9ABFF]">{song.keyName}</span>
                <span className="rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] px-2 py-1 text-[8px] font-semibold text-emerald-300">{song.bpm} BPM</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 text-[8px] text-[#657183]">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {t("demo_visual.local_settings", "Tom e BPM podem ser definidos para esta escala sem alterar a música original.")}
        </div>
      </div>
    </div>
  );
}

function NotificationsVisual() {
  const { t } = useTranslation(["musicscale"]);
  return (
    <div className="h-full bg-[#07090D]">
      <FrameHeader title={t("demo_visual.notifications_title", "Notificações")} kicker={t("demo_visual.product_ui", "INTERFACE DO PRODUTO")} />
      <div className="p-4 sm:p-5">
        <div className="rounded-2xl border border-[#6166FF]/20 bg-[#6166FF]/[0.055] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#6166FF]/15">
              <Bell className="h-4 w-4 text-[#AAA8FF]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold text-white">{t("demo_visual.assigned_notification", "Você foi escalado")}</span>
                <span className="rounded-full bg-[#2B85EB]/10 px-2 py-0.5 text-[7px] font-bold uppercase tracking-[0.12em] text-[#8EC2FF]">{t("demo_visual.new", "Novo")}</span>
              </div>
              <div className="mt-1 text-[9px] text-[#8994A3]">{t("demo_visual.sunday_service", "Culto de Domingo")} · 19:00</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[8px] text-[#9AA5B4]">{t("demo_visual.role_vocal", "Vocal")}</span>
                <span className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[8px] text-[#9AA5B4]">5 {t("demo_visual.songs", "músicas")}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] p-3 text-center">
            <Check className="mx-auto h-4 w-4 text-emerald-300" />
            <div className="mt-2 text-[8px] font-semibold text-emerald-200">{t("demo_visual.confirm", "Confirmar")}</div>
          </div>
          <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-3 text-center">
            <CircleHelp className="mx-auto h-4 w-4 text-amber-300" />
            <div className="mt-2 text-[8px] font-semibold text-amber-200">{t("demo_visual.maybe", "Ainda não sei")}</div>
          </div>
          <div className="rounded-xl border border-red-400/15 bg-red-400/[0.05] p-3 text-center">
            <span className="mx-auto flex h-4 w-4 items-center justify-center text-[13px] text-red-300">×</span>
            <div className="mt-2 text-[8px] font-semibold text-red-200">{t("demo_visual.decline", "Não poderei")}</div>
          </div>
        </div>
        <p className="mt-4 text-[8px] leading-relaxed text-[#667283]">
          {t("demo_visual.notification_note", "A equipe recebe o contexto da escala e responde sem depender de mensagens espalhadas.")}
        </p>
      </div>
    </div>
  );
}

function ConfirmationsVisual() {
  const { t } = useTranslation(["musicscale"]);
  const members = [
    { initials: "AC", name: "Ana", role: t("demo_visual.role_vocal", "Vocal"), status: t("demo_visual.accepted", "Confirmado"), tone: "emerald" },
    { initials: "RL", name: "Rafael", role: t("demo_visual.role_guitar", "Violão"), status: t("demo_visual.pending", "Pendente"), tone: "amber" },
    { initials: "MS", name: "Marcos", role: t("demo_visual.role_drums", "Bateria"), status: t("demo_visual.maybe_short", "Talvez"), tone: "blue" },
  ] as const;
  return (
    <div className="h-full bg-[#07090D]">
      <FrameHeader title={t("demo_visual.team_status_title", "Situação da equipe")} kicker={t("demo_visual.product_ui", "INTERFACE DO PRODUTO")} />
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] p-3"><div className="text-lg font-semibold text-white">4</div><div className="text-[7px] font-bold uppercase tracking-[0.12em] text-emerald-300">{t("demo_visual.accepted", "Confirmado")}</div></div>
          <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-3"><div className="text-lg font-semibold text-white">2</div><div className="text-[7px] font-bold uppercase tracking-[0.12em] text-amber-300">{t("demo_visual.pending", "Pendente")}</div></div>
          <div className="rounded-xl border border-[#2B85EB]/15 bg-[#2B85EB]/[0.05] p-3"><div className="text-lg font-semibold text-white">1</div><div className="text-[7px] font-bold uppercase tracking-[0.12em] text-[#86BEFF]">{t("demo_visual.maybe_short", "Talvez")}</div></div>
        </div>
        <div className="mt-3 space-y-2">
          {members.map(member => {
            const statusClass = member.tone === "emerald"
              ? "border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-300"
              : member.tone === "amber"
                ? "border-amber-400/15 bg-amber-400/[0.06] text-amber-300"
                : "border-[#2B85EB]/15 bg-[#2B85EB]/[0.06] text-[#86BEFF]";
            return (
              <div key={member.name} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[8px] font-bold text-white">{member.initials}</div>
                <div className="min-w-0 flex-1"><div className="truncate text-[10px] font-semibold text-white">{member.name}</div><div className="text-[8px] text-[#697586]">{member.role}</div></div>
                <span className={`rounded-full border px-2 py-1 text-[7px] font-semibold ${statusClass}`}>{member.status}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.018] px-3 py-2 text-[8px] text-[#758193]">
          <UsersRound className="h-3.5 w-3.5 text-[#8EBFFF]" />
          {t("demo_visual.leader_summary", "O líder vê quem respondeu e quem ainda precisa de atenção.")}
        </div>
      </div>
    </div>
  );
}

function PerformanceVisual() {
  const { t } = useTranslation(["musicscale"]);
  return (
    <div className="relative h-full overflow-hidden bg-[#030405]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(79,86,255,.14),transparent_44%)]" />
      <div className="relative flex h-full flex-col p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[7px] font-bold uppercase tracking-[0.18em] text-[#6F7B8B]">{t("demo_visual.performance_mode", "PERFORMANCE MODE")}</div>
            <div className="mt-1 text-[12px] font-semibold text-white">{t("demo_visual.song_one", "Canção de Esperança")}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-[#6166FF]/20 bg-[#6166FF]/10 px-2.5 py-1.5 text-sm font-bold text-[#B4B5FF]">G</span>
            <span className="rounded-lg border border-emerald-400/15 bg-emerald-400/[0.05] px-2.5 py-1.5 text-[8px] font-semibold text-emerald-300">72 BPM</span>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            t("demo_visual.intro", "Introdução"),
            t("demo_visual.verse", "Primeira Parte"),
            t("demo_visual.chorus", "Refrão"),
            t("demo_visual.final", "Final"),
          ].map((section, index) => (
            <span key={section} className={`rounded-full border px-2.5 py-1 text-[7px] font-semibold ${index === 1 ? "border-[#6166FF]/25 bg-[#6166FF]/10 text-[#B9BAFF]" : "border-white/[0.07] bg-white/[0.02] text-[#667283]"}`}>{section}</span>
          ))}
        </div>
        <div className="mt-5 flex-1 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
          <div className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#5C6878]">{t("demo_visual.current_section", "PRIMEIRA PARTE")}</div>
          <div className="mt-4 space-y-3 font-mono text-[11px] leading-relaxed sm:text-[13px]">
            <div><span className="mr-3 font-bold text-[#8D90FF]">G</span><span className="text-white/80">{t("demo_visual.lyric_line_one", "Tudo começa quando eu confio")}</span></div>
            <div><span className="mr-3 font-bold text-[#8D90FF]">Em</span><span className="text-white/80">{t("demo_visual.lyric_line_two", "Mesmo sem saber o que virá")}</span></div>
            <div><span className="mr-3 font-bold text-[#8D90FF]">C</span><span className="text-white/80">{t("demo_visual.lyric_line_three", "Tua graça me conduz")}</span></div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            [Play, t("demo_visual.autoscroll", "Auto")],
            [Volume2, t("demo_visual.pad", "Pad")],
            [Clock3, t("demo_visual.metronome", "Metrônomo")],
            [Pause, t("demo_visual.pause", "Pausar")],
          ].map(([Icon, label]) => {
            const Cmp = Icon as typeof Play;
            return <div key={String(label)} className="flex min-h-[44px] flex-col items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-[7px] font-semibold text-[#7C8797]"><Cmp className="mb-1 h-3.5 w-3.5 text-[#9FA6FF]" />{String(label)}</div>;
          })}
        </div>
      </div>
    </div>
  );
}

const visuals = [CreateScaleVisual, RepertoireVisual, NotificationsVisual, ConfirmationsVisual, PerformanceVisual];

export function MusicScaleGuidedDemo({ steps, activeStep, onSelectStep }: MusicScaleGuidedDemoProps) {
  const { t } = useTranslation(["musicscale"]);
  const reduceMotion = useReducedMotion();
  const ActiveVisual = visuals[activeStep] || CreateScaleVisual;

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:gap-12 xl:gap-16 lg:items-center">
      <div className="lg:col-span-8 min-w-0">
        <div className="relative overflow-hidden rounded-[1.5rem] border border-white/[0.09] bg-white/[0.025] p-2 shadow-[0_30px_100px_rgba(0,0,0,.42)] sm:rounded-[2rem] sm:p-3">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,.06),transparent_24%,transparent_70%,rgba(43,133,235,.08))]" />
          <div className="relative overflow-hidden rounded-[1.15rem] border border-white/[0.07] bg-[#07090D] sm:rounded-[1.45rem]">
            <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0A0D13]/90 px-3.5 py-2.5 backdrop-blur-xl sm:px-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-white/[0.14]" />
                <span className="h-2 w-2 rounded-full bg-white/[0.10]" />
                <span className="h-2 w-2 rounded-full bg-white/[0.07]" />
              </div>
              <div className="text-[7px] font-bold uppercase tracking-[0.16em] text-[#5D697A]">{t("demo_visual.real_product_demo", "DEMONSTRAÇÃO DO PRODUTO")}</div>
            </div>
            <div className="aspect-[4/3] min-h-[360px] sm:aspect-video sm:min-h-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.995 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -8, scale: 0.995 }}
                  transition={{ duration: 0.24 }}
                  className="h-full"
                >
                  <ActiveVisual />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="mt-4 lg:hidden">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 no-scrollbar" role="tablist" aria-label={t("demo_guided_label", "Demonstração guiada")}>
            {steps.map((item, index) => (
              <button
                key={item.step}
                type="button"
                role="tab"
                aria-selected={activeStep === index}
                onClick={() => onSelectStep(index)}
                className={`min-h-[42px] shrink-0 rounded-full border px-4 text-[11px] font-semibold transition ${activeStep === index ? "border-[#2B85EB]/35 bg-[#2B85EB]/12 text-white" : "border-white/[0.08] bg-white/[0.02] text-[#7B8797]"}`}
              >
                {item.step} · {item.title}
              </button>
            ))}
          </div>
          <div className="mt-2 rounded-2xl border border-white/[0.06] bg-white/[0.018] p-4">
            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#6FAEFF]">{t("demo_guided_label", "Demonstração guiada")} · {activeStep + 1}/{steps.length}</div>
            <h3 className="mt-2 text-lg font-semibold text-white">{steps[activeStep].title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-[#8C98A8]">{steps[activeStep].desc}</p>
          </div>
        </div>
      </div>

      <div className="hidden lg:col-span-4 lg:flex lg:flex-col lg:gap-3">
        {steps.map((item, index) => (
          <button
            key={item.step}
            type="button"
            onClick={() => onSelectStep(index)}
            aria-pressed={activeStep === index}
            className={`group flex min-h-[88px] items-start gap-4 rounded-2xl border p-4 text-left transition ${activeStep === index ? "border-[#2B85EB]/25 bg-[#2B85EB]/[0.065]" : "border-white/[0.06] bg-white/[0.015] hover:border-white/[0.11] hover:bg-white/[0.03]"}`}
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${activeStep === index ? "border-[#2B85EB]/40 bg-[#2B85EB]/15 text-[#9CC8FF]" : "border-white/[0.08] bg-white/[0.025] text-[#657184]"}`}>{item.step}</div>
            <div className="min-w-0 flex-1">
              <div className={`text-sm font-semibold ${activeStep === index ? "text-white" : "text-[#B0B8C4]"}`}>{item.title}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#697586]">{item.desc}</p>
            </div>
            <ChevronRight className={`mt-1 h-4 w-4 shrink-0 transition-transform ${activeStep === index ? "translate-x-0.5 text-[#76B5FF]" : "text-[#465263] group-hover:translate-x-0.5"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
