import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, User, ChevronRight, HelpCircle } from "lucide-react";

const commonQuestions = [
  {
    q: "Como funciona o teste grátis?",
    a: "Você tem 7 dias de acesso total em qualquer plano. Nada será cobrado se você cancelar antes do prazo."
  },
  {
    q: "Quais os planos disponíveis?",
    a: "Temos o Starter (essencial) e o Pro (completo com Biblioteca Viva). Veja a seção de preços para detalhes."
  },
  {
    q: "O WhatsApp Bot está incluso?",
    a: "A integração com WhatsApp para envio de escalas está disponível nos planos pagos para facilitar a comunicação do time."
  }
];

export function SalesChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'welcome' | 'faq' | 'input'>('welcome');
  const [selectedFaq, setSelectedFaq] = useState<typeof commonQuestions[0] | null>(null);
  const [userQuestion, setUserQuestion] = useState("");
  const whatsappNumber = "5543999907071";
  
  const chatRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (chatRef.current && !chatRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSendToWhatsapp = () => {
    const text = userQuestion || (selectedFaq ? `Minha dúvida: ${selectedFaq.q}` : "Olá! Gostaria de tirar algumas dúvidas sobre o MusicScale.");
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?phone=${whatsappNumber}&text=${encoded}`, '_blank');
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-[#2B85EB] text-white rounded-full shadow-[0_10px_25px_rgba(43,133,235,0.3)] hover:shadow-[0_15px_35px_rgba(43,133,235,0.5)] transition-all cursor-pointer group"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-7 h-7 fill-current" />}
        <span className="absolute inset-0 rounded-full bg-[#2B85EB] animate-ping opacity-20 pointer-events-none" />
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={chatRef}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-48px)] bg-[#0B0F19] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 bg-gradient-to-br from-[#2B85EB] to-[#1a5fb4] text-white">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-2 border-white/20 overflow-hidden bg-white/10 flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[#2B85EB] rounded-full" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Consultor MusicScale</h3>
                  <div className="flex items-center gap-1.5 text-xs text-white/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Online agora para te ajudar
                  </div>
                </div>
              </div>
              <p className="text-sm text-white/90 leading-relaxed">
                Olá! 👋 Como posso ajudar a transformar seu ministério hoje?
              </p>
            </div>

            {/* Chat Body */}
            <div className="flex-1 p-6 max-h-[350px] overflow-y-auto bg-[#0B0F19]">
              <AnimatePresence mode="wait">
                {step === 'welcome' && (
                  <motion.div
                    key="welcome"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    <button
                      onClick={() => setStep('faq')}
                      className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#2B85EB]/10 flex items-center justify-center">
                          <HelpCircle className="w-4 h-4 text-[#2B85EB]" />
                        </div>
                        <span className="text-sm font-medium text-[#F5F7FA]">Dúvida rápida sobre planos</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#A0A7B5] group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button
                      onClick={() => setStep('input')}
                      className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#2B85EB]/10 flex items-center justify-center">
                          <MessageCircle className="w-4 h-4 text-[#2B85EB]" />
                        </div>
                        <span className="text-sm font-medium text-[#F5F7FA]">Fala direto no WhatsApp</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#A0A7B5] group-hover:translate-x-1 transition-transform" />
                    </button>
                  </motion.div>
                )}

                {step === 'faq' && (
                  <motion.div
                    key="faq"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-3"
                  >
                    <button 
                      onClick={() => { setStep('welcome'); setSelectedFaq(null); }}
                      className="text-xs text-[#2B85EB] font-semibold mb-2 hover:underline"
                    >
                      ← Voltar
                    </button>
                    {commonQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedFaq(selectedFaq === q ? null : q)}
                        className={`w-full p-3 rounded-xl border text-left transition-all ${selectedFaq === q ? 'bg-[#2B85EB]/10 border-[#2B85EB]/30' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                      >
                        <p className="text-xs font-semibold text-[#F5F7FA] mb-1">{q.q}</p>
                        {selectedFaq === q && (
                          <motion.p
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="text-xs text-[#A0A7B5] mt-2 leading-relaxed"
                          >
                            {q.a}
                          </motion.p>
                        )}
                      </button>
                    ))}
                    {selectedFaq && (
                      <button
                        onClick={handleSendToWhatsapp}
                        className="w-full mt-4 py-3 bg-[#2B85EB] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2"
                      >
                        Ainda com dúvida? Chamar no Zap <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </motion.div>
                )}

                {step === 'input' && (
                  <motion.div
                    key="input"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    <button 
                      onClick={() => setStep('welcome')}
                      className="text-xs text-[#2B85EB] font-semibold hover:underline"
                    >
                      ← Voltar
                    </button>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[#A0A7B5]">Qual sua principal dúvida?</label>
                      <textarea
                        autoFocus
                        value={userQuestion}
                        onChange={(e) => setUserQuestion(e.target.value)}
                        placeholder="Ex: Como importar meu acervo?"
                        className="w-full h-24 p-4 bg-white/5 border border-white/10 rounded-2xl text-sm text-[#F5F7FA] placeholder:text-[#A0A7B5]/40 focus:border-[#2B85EB]/50 focus:outline-none transition-all resize-none"
                      />
                    </div>
                    <button
                      onClick={handleSendToWhatsapp}
                      className="w-full py-4 bg-[#2B85EB] text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-[#1a5fb4] transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      Iniciar conversa
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-white/[0.02] border-t border-white/5 flex items-center justify-center gap-2 text-[10px] text-[#A0A7B5] uppercase tracking-widest font-semibold">
              <span className="w-1 h-1 rounded-full bg-[#2B85EB]" />
              Suporte VIP Inteligente
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
