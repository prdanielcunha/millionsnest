import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, ChevronRight, DollarSign, Handshake, HelpCircle, Loader2 } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { createPublicSalesWhatsAppLink, resolvePublicContactLocale } from '../services/publicContactClient.js';
import { useLocation } from 'react-router-dom';

export function SalesChat() {
  const { t, i18n } = useTranslation(['landing']);
  const location = useLocation();
  const commonQuestions = [1, 2, 5].map((n) => ({ q: t(`faq_q${n}`), a: t(`faq_a${n}`) }));

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'intent' | 'faq' | 'input'>('intent');
  const [selectedIntent, setSelectedIntent] = useState<'pricing' | 'pre_sales_question' | 'partnership' | null>(null);
  const [selectedFaqIndex, setSelectedFaqIndex] = useState<number | null>(null);
  const [userQuestion, setUserQuestion] = useState("");
  const [isContacting, setIsContacting] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const chatRootRef = useRef<HTMLDivElement>(null);
  const contactAbortRef = useRef<AbortController | null>(null);

  const closeChat = useCallback(() => {
    contactAbortRef.current?.abort();
    contactAbortRef.current = null;
    setIsContacting(false);
    setContactError(null);
    setIsOpen(false);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chatRootRef.current && !chatRootRef.current.contains(event.target as Node)) closeChat();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeChat]);

  useEffect(() => () => {
    contactAbortRef.current?.abort();
    contactAbortRef.current = null;
  }, []);

  const handleIntentSelect = (intent: 'pricing' | 'pre_sales_question' | 'partnership') => {
    setSelectedIntent(intent);
    setContactError(null);
    setSelectedFaqIndex(null);
    setStep(intent === 'pricing' ? 'faq' : 'input');
  };

  const handleSendToWhatsapp = async () => {
    if (isContacting || !selectedIntent) return;
    setContactError(null);
    const selectedFaq = selectedFaqIndex === null ? null : commonQuestions[selectedFaqIndex];
    const finalMessage = userQuestion || selectedFaq?.q || undefined;

    contactAbortRef.current?.abort();
    const controller = new AbortController();
    contactAbortRef.current = controller;
    const popup = window.open('about:blank', '_blank');

    if (!popup) {
      setContactError(t('public_contact_error'));
      return;
    }

    try { popup.opener = null; } catch {}

    try {
      setIsContacting(true);
      const url = await createPublicSalesWhatsAppLink({
        intent: selectedIntent,
        locale: resolvePublicContactLocale(i18n.resolvedLanguage ?? i18n.language),
        message: finalMessage,
        pagePath: location.pathname
      }, controller.signal);

      if (controller.signal.aborted || contactAbortRef.current !== controller) {
        popup.close();
        return;
      }
      if (!url.startsWith('https://wa.me/')) throw new Error('Invalid URL');
      popup.location.href = url;
      closeChat();
    } catch {
      if (!controller.signal.aborted) {
        popup.close();
        setContactError(t('public_contact_error'));
      }
    } finally {
      if (contactAbortRef.current === controller) {
        contactAbortRef.current = null;
        setIsContacting(false);
      }
    }
  };

  const options = [
    { intent: 'pricing' as const, icon: DollarSign, label: t('chat_opt_plans') },
    { intent: 'pre_sales_question' as const, icon: HelpCircle, label: t('pre_sales_question') },
    { intent: 'partnership' as const, icon: Handshake, label: t('chat_opt_partnership') },
  ];

  return (
    <div ref={chatRootRef}>
      <motion.button
        onClick={() => isOpen ? closeChat() : setIsOpen(true)}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.98 }}
        className="fixed bottom-5 right-5 z-50 flex h-12 items-center gap-2 rounded-full border border-white/10 bg-[#0B0F17]/95 px-4 text-sm font-medium text-[#E7EBF1] shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:border-white/20 hover:bg-[#101620]"
        aria-label={t('chat_button')}
      >
        {isOpen ? <X className="h-4 w-4" /> : <MessageCircle className="h-4 w-4 text-[#78B6FF]" />}
        <span className="hidden sm:block">{t('chat_button')}</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: 12, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.985 }} className="fixed bottom-20 right-5 z-50 flex w-[390px] max-w-[calc(100vw-40px)] flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#090D14] shadow-[0_35px_90px_rgba(0,0,0,0.55)]">
            <div className="border-b border-white/[0.07] p-5">
              <div className="text-sm font-semibold text-white">{t('chat_consultant')}</div>
              <p className="mt-1 text-xs text-[#748090]">{t('chat_response_channel')}</p>
              <p className="mt-4 text-sm leading-relaxed text-[#A6AFBC]">{t('chat_greet')}</p>
            </div>

            <div className="max-h-[390px] overflow-y-auto p-4">
              <AnimatePresence mode="wait">
                {step === 'intent' && (
                  <motion.div key="intent" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-2">
                    <div className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#667181]">{t('chat_choose')}</div>
                    {options.map(({ intent, icon: Icon, label }) => (
                      <button key={intent} onClick={() => handleIntentSelect(intent)} className="group flex w-full items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5 text-left transition hover:bg-white/[0.045]">
                        <span className="flex items-center gap-3 text-sm font-medium text-[#DCE1E8]"><Icon className="h-4 w-4 text-[#6EAFFF]" />{label}</span>
                        <ChevronRight className="h-4 w-4 text-[#566171] transition group-hover:translate-x-0.5" />
                      </button>
                    ))}
                  </motion.div>
                )}

                {step === 'faq' && (
                  <motion.div key="faq" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-2">
                    <button onClick={() => { setStep('intent'); setSelectedIntent(null); }} className="mb-2 text-xs font-medium text-[#78B6FF]">{t('chat_back_options')}</button>
                    {commonQuestions.map((item, i) => (
                      <button key={item.q} onClick={() => setSelectedFaqIndex(selectedFaqIndex === i ? null : i)} className={`w-full rounded-xl border p-3 text-left transition ${selectedFaqIndex === i ? 'border-[#2B85EB]/25 bg-[#2B85EB]/[0.06]' : 'border-white/[0.07] bg-white/[0.02]'}`}>
                        <p className="text-xs font-semibold leading-relaxed text-[#E1E6ED]">{item.q}</p>
                        {selectedFaqIndex === i && <p className="mt-2 text-xs leading-relaxed text-[#7F8998]">{item.a}</p>}
                      </button>
                    ))}
                    <button onClick={() => setStep('input')} className="mt-3 w-full rounded-xl border border-white/[0.08] px-4 py-3 text-xs font-semibold text-[#BFD9FF] transition hover:bg-white/[0.03]">{t('chat_talk_consultant')}</button>
                  </motion.div>
                )}

                {step === 'input' && (
                  <motion.div key="input" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-3">
                    <button onClick={() => setStep(selectedIntent === 'pricing' ? 'faq' : 'intent')} className="text-xs font-medium text-[#78B6FF]">← {selectedIntent === 'pricing' ? t('chat_back_faq') : t('chat_back_options')}</button>
                    <label className="block text-xs font-medium leading-relaxed text-[#8994A4]">
                      {selectedIntent === 'pre_sales_question' ? t('pre_sales_prompt') : selectedIntent === 'partnership' ? t('chat_how_help_partnership') : t('chat_how_help_plans')}
                    </label>
                    <textarea value={userQuestion} onChange={(e) => setUserQuestion(e.target.value)} placeholder={t('chat_placeholder')} className="h-24 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5 text-sm text-white outline-none placeholder:text-[#596372] focus:border-[#2B85EB]/35" />
                    {contactError && <div role="alert" className="rounded-lg bg-red-400/10 p-2 text-xs text-red-300">{contactError}</div>}
                    <button onClick={handleSendToWhatsapp} disabled={isContacting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-semibold text-black transition hover:bg-[#EEF2F7] disabled:opacity-50">
                      {isContacting ? <><Loader2 className="h-4 w-4 animate-spin" />{t('public_contact_loading')}</> : <><Send className="h-4 w-4" />{t('chat_button')}</>}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="border-t border-white/[0.06] px-4 py-3 text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-[#596372]">{t('chat_human_support')}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
