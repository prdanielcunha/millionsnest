import { motion, useReducedMotion } from "framer-motion";
import { Check, CircleDot, Clock3, Music2, Radio, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";

const demoRows = [
  { icon: Music2, key: "hero_demo_scale", metaKey: "hero_demo_scale_meta" },
  { icon: UsersRound, key: "hero_demo_confirmations", metaKey: "hero_demo_confirmations_meta" },
  { icon: Radio, key: "hero_demo_conduct", metaKey: "hero_demo_conduct_meta" },
];

export function ProductMotionStage() {
  const { t } = useTranslation(["landing"]);
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#080B11] shadow-[0_45px_120px_rgba(0,0,0,0.55)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_-10%,rgba(43,133,235,.20),transparent_42%)]" />

      <div className="relative flex items-center justify-between border-b border-white/[0.07] bg-[#090D14]/90 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035]">
            <img src="/LogoIconMusicScale-1.png" alt="" aria-hidden="true" className="h-5 w-5 object-contain" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.17em] text-[#667181]">
              {t("hero_demo_label")}
            </p>
            <p className="truncate text-sm font-semibold text-white">MusicScale × MillionsNest</p>
          </div>
        </div>
        <div className="ml-3 inline-flex shrink-0 items-center gap-2 rounded-full border border-[#2B85EB]/20 bg-[#2B85EB]/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#86BEFF]">
          <CircleDot className="h-3 w-3" />
          {t("hero_demo_sample")}
        </div>
      </div>

      <div className="relative grid gap-0 lg:grid-cols-[.32fr_.68fr]">
        <aside className="border-b border-white/[0.06] bg-[#070A10]/85 p-3 lg:border-b-0 lg:border-r">
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
            {[
              ["MusicScale", true],
              ["NestFinance", false],
              ["NestJourney", false],
            ].map(([name, active]) => (
              <div
                key={String(name)}
                className={`flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 ${active
                  ? "border-[#2B85EB]/25 bg-[#2B85EB]/10"
                  : "border-white/[0.05] bg-white/[0.018]"}`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${active ? "bg-[#66A8FF]" : "bg-white/15"}`} />
                <span className={`truncate text-[10px] font-semibold ${active ? "text-white" : "text-[#697484]"}`}>
                  {name}
                </span>
              </div>
            ))}
          </div>
        </aside>

        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#667181]">
                {t("hero_demo_next_service")}
              </div>
              <h3 className="mt-1.5 text-lg font-semibold tracking-[-0.025em] text-white sm:text-xl">
                {t("hero_demo_service_title")}
              </h3>
              <p className="mt-1 text-xs text-[#7F8998]">{t("hero_demo_service_meta")}</p>
            </div>
            <div className="hidden shrink-0 items-center gap-2 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.055] px-2.5 py-1.5 text-[9px] font-semibold text-emerald-300 sm:flex">
              <Check className="h-3 w-3" />
              {t("hero_demo_published")}
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            {demoRows.map(({ icon: Icon, key, metaKey }, index) => (
              <motion.div
                key={key}
                initial={reduceMotion ? false : { opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: reduceMotion ? 0 : 0.25 + index * 0.18 }}
                className="group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.022] p-3.5"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-[#0B1018] text-[#78B5FF]">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[#E7EBF2]">{t(key)}</p>
                  <p className="mt-0.5 truncate text-[10px] text-[#687384]">{t(metaKey)}</p>
                </div>
                <motion.span
                  aria-hidden="true"
                  animate={reduceMotion ? undefined : { opacity: [0.35, 1, 0.35] }}
                  transition={{ duration: 2.2, delay: index * 0.3, repeat: Infinity }}
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300"
                />
              </motion.div>
            ))}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <div className="flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.05] bg-black/20 px-3 py-2.5">
              <Clock3 className="h-3.5 w-3.5 shrink-0 text-[#647083]" />
              <span className="truncate text-[10px] text-[#7E8999]">{t("hero_demo_sync")}</span>
            </div>
            <div className="rounded-xl border border-[#2B85EB]/15 bg-[#2B85EB]/[0.06] px-3 py-2.5 text-center text-[10px] font-semibold text-[#A9CEFF]">
              {t("hero_demo_hub_state")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
