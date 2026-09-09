import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  EyeOff,
  LayoutGrid,
  Monitor,
  Music2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
  UsersRound,
} from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { trackHomeMusicScaleInterest } from "../lib/publicFunnelAnalytics.js";

type DemoLane = "today" | "changes" | "commitments";
type DemoDevice = "desktop" | "tablet" | "mobile";

const laneOrder: DemoLane[] = ["today", "changes", "commitments"];

export function ActionOsShowcase() {
  const { t } = useTranslation(["landing"]);
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [activeLane, setActiveLane] = useState<DemoLane>("today");
  const [device, setDevice] = useState<DemoDevice>("desktop");

  const isCompact = device === "mobile";
  const isTablet = device === "tablet";
  const frameWidth = device === "desktop"
    ? "max-w-[1180px]"
    : device === "tablet"
      ? "max-w-[820px]"
      : "max-w-[430px]";

  const laneLabel = (lane: DemoLane) => {
    if (lane === "today") return t("action_demo_lane_today");
    if (lane === "changes") return t("action_demo_lane_changes");
    return t("action_demo_lane_commitments");
  };

  const renderToday = () => (
    <motion.section
      key="today"
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: 0.28 }}
      className="relative overflow-hidden rounded-[1.9rem] border border-white/[0.08] bg-[#080A0F] p-4 shadow-[0_26px_80px_rgba(0,0,0,.24)] sm:p-5"
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#2B85EB]/10 blur-[80px]" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#73B4FF] shadow-[0_0_18px_rgba(115,180,255,.55)]" />
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#86BEFF]">
                {t("action_demo_today_eyebrow")}
              </p>
            </div>
            <h3 className="text-xl font-semibold tracking-[-0.035em] text-white sm:text-2xl">
              {t("action_demo_today_title")}
            </h3>
            <p className="mt-1.5 max-w-xl text-[11px] leading-relaxed text-[#8E99A8] sm:text-xs">
              {t("action_demo_today_subtitle")}
            </p>
          </div>
          {!isCompact && (
            <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[10px] font-semibold text-white/75">
              {t("action_demo_today_count")}
            </span>
          )}
        </div>

        <article className={`mt-5 grid gap-3 rounded-2xl border border-white/[0.065] bg-white/[0.022] p-3.5 ${isCompact ? "" : "sm:grid-cols-[auto_1fr_auto] sm:items-center"}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#2B85EB]/20 bg-[#2B85EB]/10">
            <img src="/LogoIconMusicScale-1.png" alt="" className="h-5.5 w-5.5 object-contain" />
          </div>

          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[#687486]">MusicScale</span>
              <span className="rounded-full border border-amber-400/15 bg-amber-400/[0.06] px-2 py-0.5 text-[8px] font-semibold text-amber-300">
                {t("action_demo_priority")}
              </span>
            </div>
            <h4 className="text-[13px] font-semibold leading-snug text-white sm:text-sm">
              {t("action_demo_action_title")}
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed text-[#8A95A4] sm:text-[11px]">
              {t("action_demo_action_desc")}
            </p>
          </div>

          <div className={`flex gap-1.5 ${isCompact ? "grid grid-cols-3" : "sm:flex-col"}`}>
            <button type="button" className="min-h-[36px] rounded-lg bg-white px-3 text-[9px] font-semibold text-[#07090D]">
              <span className="inline-flex items-center justify-center gap-1">
                {t("action_demo_open")}
                <ChevronRight className="h-3 w-3" />
              </span>
            </button>
            <button type="button" className="min-h-[34px] rounded-lg border border-white/[0.07] bg-white/[0.025] px-2 text-[9px] font-semibold text-[#A8B2C0]">
              <Clock3 className="mr-1 inline h-3 w-3" />
              {t("action_demo_snooze")}
            </button>
            <button type="button" className="min-h-[34px] rounded-lg border border-white/[0.07] bg-white/[0.025] px-2 text-[9px] font-semibold text-[#A8B2C0]">
              <EyeOff className="mr-1 inline h-3 w-3" />
              {t("action_demo_hide")}
            </button>
          </div>
        </article>
      </div>
    </motion.section>
  );

  const renderChanges = () => (
    <motion.section
      key="changes"
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: 0.28 }}
      className="relative overflow-hidden rounded-[1.75rem] border border-violet-400/[0.12] bg-violet-400/[0.035] p-4 sm:p-5"
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-violet-400/[0.08] blur-[80px]" />
      <div className="relative">
        <div className="mb-2 flex items-center gap-2 text-violet-300">
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="text-[9px] font-bold uppercase tracking-[0.18em]">{t("action_demo_changes_eyebrow")}</span>
        </div>
        <h3 className="text-xl font-semibold tracking-[-0.025em] text-white sm:text-2xl">{t("action_demo_changes_title")}</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-[#8D95A6] sm:text-xs">{t("action_demo_changes_subtitle")}</p>

        <article className={`mt-5 grid gap-3 rounded-2xl border border-violet-300/[0.10] bg-black/[0.12] p-3.5 ${isCompact ? "" : "sm:grid-cols-[auto_1fr_auto] sm:items-center"}`}>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-300/[0.14] bg-violet-300/[0.07]">
            <Sparkles className="h-4 w-4 text-violet-200" />
          </div>
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-violet-300">MusicScale</span>
              <span className="rounded-full border border-violet-300/[0.14] bg-violet-300/[0.08] px-2 py-0.5 text-[8px] font-semibold text-violet-100">
                {t("action_demo_new")}
              </span>
              <span className="text-[8px] text-[#717B8B]">{t("action_demo_changes_when")}</span>
            </div>
            <h4 className="text-[13px] font-semibold text-white sm:text-sm">{t("action_demo_changes_item")}</h4>
            <p className="mt-1 text-[10px] leading-relaxed text-[#929BAB] sm:text-[11px]">{t("action_demo_changes_summary")}</p>
          </div>
          <button type="button" className="min-h-[36px] rounded-lg bg-white px-3 text-[9px] font-semibold text-[#07090D]">
            {t("action_demo_review")}
            <ChevronRight className="ml-1 inline h-3 w-3" />
          </button>
        </article>
      </div>
    </motion.section>
  );

  const renderCommitments = () => (
    <motion.section
      key="commitments"
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: 0.28 }}
      className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.07] bg-white/[0.018] p-4 sm:p-5"
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#2B85EB]/[0.08] blur-[80px]" />
      <div className="relative">
        <div className="mb-2 flex items-center gap-2 text-[#86BEFF]">
          <CalendarDays className="h-3.5 w-3.5" />
          <span className="text-[9px] font-bold uppercase tracking-[0.18em]">{t("action_demo_commitments_eyebrow")}</span>
        </div>
        <h3 className="text-xl font-semibold tracking-[-0.025em] text-white sm:text-2xl">{t("action_demo_commitments_title")}</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-[#8490A0] sm:text-xs">{t("action_demo_commitments_subtitle")}</p>

        <article className={`mt-5 grid gap-3 rounded-2xl border border-[#2B85EB]/15 bg-[#2B85EB]/[0.045] p-3.5 ${isCompact ? "" : "sm:grid-cols-[auto_1fr_auto] sm:items-center"}`}>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#2B85EB]/20 bg-[#2B85EB]/10">
            <img src="/LogoIconMusicScale-1.png" alt="" className="h-5.5 w-5.5 object-contain" />
          </div>
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[#86BEFF]">MusicScale</span>
              <span className="rounded-full border border-[#2B85EB]/15 bg-[#2B85EB]/[0.06] px-2 py-0.5 text-[8px] font-semibold text-[#9CC8FF]">
                {t("action_demo_preparation")}
              </span>
              <span className="text-[8px] text-[#788596]">{t("action_demo_commitments_when")}</span>
            </div>
            <h4 className="text-[13px] font-semibold text-white sm:text-sm">{t("action_demo_commitments_item")}</h4>
            <p className="mt-1 text-[10px] leading-relaxed text-[#8C98A7] sm:text-[11px]">{t("action_demo_commitments_summary")}</p>
          </div>
          <button type="button" className="min-h-[36px] rounded-lg bg-white px-3 text-[9px] font-semibold text-[#07090D]">
            <Music2 className="mr-1 inline h-3 w-3" />
            {t("action_demo_prepare")}
          </button>
        </article>
      </div>
    </motion.section>
  );

  const lanePreview = activeLane === "today"
    ? renderToday()
    : activeLane === "changes"
      ? renderChanges()
      : renderCommitments();

  return (
    <section id="action-os-demo" className="relative overflow-hidden border-y border-white/[0.06] bg-[#040608] py-24 md:py-32">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-12 h-[440px] w-[900px] -translate-x-1/2 rounded-full bg-[#2B85EB]/[0.08] blur-[150px]" />
        <div className="absolute inset-0 opacity-[0.18]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px)", backgroundSize: "56px 56px", maskImage: "linear-gradient(to bottom,transparent,black 18%,black 82%,transparent)" }} />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_.56fr] lg:items-end">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#6EAFFF]/20 bg-[#6EAFFF]/[0.065] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#BFD9FF]">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t("action_demo_eyebrow")}
            </div>
            <h2 className="mt-5 text-4xl font-semibold leading-[1.01] tracking-[-0.055em] text-white md:text-6xl">
              <Trans i18nKey="landing:action_demo_title" components={{ 1: <span className="text-[#8D98A8]" /> }} />
            </h2>
            <p className="mt-6 max-w-3xl text-base leading-relaxed text-[#8D98A8] md:text-lg">
              {t("action_demo_desc")}
            </p>
          </div>

          <div className="lg:justify-self-end">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3.5 backdrop-blur-xl">
              <div className="flex items-center gap-2 text-[10px] font-semibold text-[#AAB4C2]">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                {t("action_demo_truth")}
              </div>
              <p className="mt-1.5 max-w-sm text-[10px] leading-relaxed text-[#697585]">{t("action_demo_truth_desc")}</p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("action_demo_lane_selector")}>
            {laneOrder.map(lane => (
              <button
                key={lane}
                type="button"
                role="tab"
                aria-selected={activeLane === lane}
                onClick={() => setActiveLane(lane)}
                className={`min-h-[40px] rounded-full border px-4 text-[11px] font-semibold transition ${activeLane === lane
                  ? "border-[#6EAFFF]/30 bg-[#2B85EB]/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08)]"
                  : "border-white/[0.07] bg-white/[0.02] text-[#7E8999] hover:bg-white/[0.045] hover:text-white"}`}
              >
                {laneLabel(lane)}
              </button>
            ))}
          </div>

          <div className="hidden items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-[#080B10]/70 p-1.5 backdrop-blur-xl sm:flex" aria-label={t("action_demo_device_selector")}>
            {([
              ["desktop", Monitor, "action_demo_device_desktop"],
              ["tablet", Tablet, "action_demo_device_tablet"],
              ["mobile", Smartphone, "action_demo_device_mobile"],
            ] as const).map(([value, Icon, key]) => (
              <button
                key={value}
                type="button"
                onClick={() => setDevice(value)}
                aria-pressed={device === value}
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-xl px-3 text-[9px] font-semibold transition ${device === value
                  ? "bg-white text-[#07090D]"
                  : "text-[#7C8796] hover:bg-white/[0.05] hover:text-white"}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t(key)}
              </button>
            ))}
          </div>
        </div>

        <motion.div layout className={`mx-auto mt-5 w-full transition-[max-width] duration-500 ${frameWidth}`}>
          <div className="relative overflow-hidden rounded-[32px] border border-white/[0.10] bg-white/[0.035] p-2.5 shadow-[0_50px_130px_rgba(0,0,0,.55)] backdrop-blur-2xl sm:p-3">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,.08),transparent_18%,transparent_72%,rgba(43,133,235,.08))]" />
            <div className="relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#05070B]">
              <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#090C12]/85 px-3.5 py-3 backdrop-blur-xl sm:px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035]">
                    <LayoutGrid className="h-4 w-4 text-[#83BCFF]" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-semibold text-white">{t("action_demo_org")}</div>
                    <div className="truncate text-[8px] text-[#637081]">MillionsNest Hub</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isCompact && (
                    <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.055] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.14em] text-emerald-300">
                      {t("action_demo_live")}
                    </span>
                  )}
                  <div className="h-7 w-7 rounded-full border border-white/[0.08] bg-[radial-gradient(circle_at_35%_30%,rgba(110,175,255,.5),rgba(43,133,235,.14)_38%,rgba(255,255,255,.04)_70%)]" />
                </div>
              </div>

              <div className={`grid min-h-[520px] ${isCompact ? "grid-cols-1" : isTablet ? "grid-cols-[150px_1fr]" : "grid-cols-[180px_1fr]"}`}>
                {!isCompact && (
                  <aside className="border-r border-white/[0.06] bg-[#06080D]/80 p-3">
                    <div className="space-y-1.5">
                      {[
                        [LayoutGrid, t("action_demo_nav_home"), true],
                        [Music2, "MusicScale", false],
                        [UsersRound, t("action_demo_nav_team"), false],
                        [CreditCard, t("action_demo_nav_billing"), false],
                      ].map(([Icon, label, active]) => {
                        const Cmp = Icon as typeof LayoutGrid;
                        return (
                          <div key={String(label)} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${active
                            ? "border-[#2B85EB]/20 bg-[#2B85EB]/[0.09] text-white"
                            : "border-transparent text-[#687486]"}`}>
                            <Cmp className="h-3.5 w-3.5" />
                            <span className="truncate text-[9px] font-semibold">{String(label)}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.018] p-3">
                      <div className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#556171]">{t("action_demo_system_label")}</div>
                      <div className="mt-2 flex items-center gap-2 text-[9px] font-semibold text-[#9AA5B4]">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        {t("action_demo_system_ok")}
                      </div>
                    </div>
                  </aside>
                )}

                <main className="min-w-0 p-3.5 sm:p-5">
                  <div className="mb-4 flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-[#5F6B7B]">{t("action_demo_workspace")}</div>
                      <h3 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-white sm:text-xl">{laneLabel(activeLane)}</h3>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[8px] text-[#6F7B8B]">
                      {t("action_demo_sample")}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {lanePreview}
                  </AnimatePresence>

                  <div className={`mt-3 grid gap-2 ${isCompact ? "grid-cols-1" : "grid-cols-3"}`}>
                    {laneOrder.filter(lane => lane !== activeLane).map(lane => (
                      <button
                        key={lane}
                        type="button"
                        onClick={() => setActiveLane(lane)}
                        className="group rounded-2xl border border-white/[0.06] bg-white/[0.018] p-3 text-left transition hover:border-white/[0.12] hover:bg-white/[0.035]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-semibold text-[#A4AEBC]">{laneLabel(lane)}</span>
                          <ArrowUpRight className="h-3 w-3 text-[#5C6878] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        </div>
                        <div className="mt-3 h-1.5 rounded-full bg-white/[0.05]">
                          <div className={`h-full rounded-full ${lane === "changes" ? "w-2/3 bg-violet-300/35" : "w-4/5 bg-[#66A8FF]/35"}`} />
                        </div>
                      </button>
                    ))}
                    {!isCompact && (
                      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.018] p-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-3 w-3 text-emerald-300" />
                          <span className="text-[9px] font-semibold text-[#A4AEBC]">{t("action_demo_privacy")}</span>
                        </div>
                        <p className="mt-2 text-[8px] leading-relaxed text-[#596575]">{t("action_demo_privacy_desc")}</p>
                      </div>
                    )}
                  </div>
                </main>
              </div>

              {isCompact && (
                <div className="grid grid-cols-4 border-t border-white/[0.06] bg-[#080B10]/92 p-2 backdrop-blur-xl">
                  {[LayoutGrid, Music2, UsersRound, CreditCard].map((Icon, index) => (
                    <div key={index} className="flex min-h-[42px] items-center justify-center">
                      <Icon className={`h-4 w-4 ${index === 0 ? "text-[#76B5FF]" : "text-[#536071]"}`} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        <div className="mx-auto mt-7 flex max-w-3xl flex-col items-center text-center">
          <p className="text-xs leading-relaxed text-[#6F7B8B]">{t("action_demo_footer_note")}</p>
          <button
            type="button"
            onClick={() => {
              trackHomeMusicScaleInterest("flagship_primary");
              navigate("/musicscale#musicscale-demo");
            }}
            className="group mt-5 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-white/[0.10] bg-white px-5 py-3 text-sm font-semibold text-[#07090D] transition hover:-translate-y-0.5"
          >
            {t("action_demo_cta")}
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
