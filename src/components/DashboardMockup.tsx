import { motion } from "framer-motion";
import { Book, Sparkles, TrendingUp, Moon, Calendar, User, HeadphonesIcon, HelpCircle, Music } from "lucide-react";

export function DashboardMockup() {
  return (
    <div className="w-[800px] h-[600px] shrink-0 bg-[#050505] text-[#F5F7FA] flex overflow-hidden rounded-2xl border border-white/5 font-sans relative select-none">
      {/* Sidebar */}
      <div className="w-20 bg-[#0B0F19] border-r border-white/5 flex flex-col items-center py-6 gap-6 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-[#2B85EB]/10 border border-[#2B85EB]/20 text-[#2B85EB] font-bold flex items-center justify-center text-base">M</div>
        <div className="flex flex-col gap-6 mt-6 text-[#A0A7B5]">
          <div className="p-2.5 rounded-xl bg-[#2B85EB]/10 text-[#2B85EB] shadow-[0_0_12px_rgba(43,133,235,0.15)]"><LayoutIcon className="w-5 h-5" /></div>
          <div className="p-2.5 rounded-xl hover:text-white transition-colors"><Book className="w-5 h-5" /></div>
          <div className="p-2.5 rounded-xl hover:text-white transition-colors"><Calendar className="w-5 h-5" /></div>
          <div className="p-2.5 rounded-xl hover:text-white transition-colors"><Music className="w-5 h-5" /></div>
          <div className="p-2.5 rounded-xl hover:text-white transition-colors"><User className="w-5 h-5" /></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-10 overflow-hidden bg-[#050505]">
        {/* Header */}
        <div className="px-8 py-5 border-b border-white/5 flex justify-between items-center bg-transparent backdrop-blur-md">
          <h2 className="font-medium text-sm text-[#F5F7FA]">Visão Geral</h2>
          <div className="flex gap-4 text-[#A0A7B5]">
            <HelpCircle className="w-4 h-4" />
            <HeadphonesIcon className="w-4 h-4" />
          </div>
        </div>

        {/* Scrollable Content (Simulated) */}
        <div className="p-8 flex flex-col gap-8 overflow-y-auto">
          {/* Welcome Area */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#F5F7FA]">Olá, Daniel!</h1>
              <p className="text-[#A0A7B5] text-sm mt-1">Aqui está um resumo da sua atividade.</p>
            </div>
            <button className="flex px-4 py-2 bg-[#F5F7FA] text-[#050505] font-semibold text-sm rounded-lg items-center gap-2 shadow-sm">
              <HeadphonesIcon className="w-4 h-4" />
              Indicar Música
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0B0F19] border border-white/5 p-5 rounded-2xl flex justify-between items-start hover:border-white/10 transition-colors">
              <div>
                <div className="text-xs text-[#A0A7B5] font-medium mb-3">Total de Músicas</div>
                <div className="text-2xl font-semibold tracking-tight text-[#F5F7FA]">57</div>
              </div>
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg"><Book className="w-4 h-4" /></div>
            </div>
            <div className="bg-[#0B0F19] border border-white/5 p-5 rounded-2xl flex justify-between items-start hover:border-white/10 transition-colors">
              <div>
                <div className="text-xs text-[#A0A7B5] font-medium mb-3">Músicas Novas</div>
                <div className="text-2xl font-semibold tracking-tight text-[#F5F7FA]">13</div>
              </div>
              <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg"><Sparkles className="w-4 h-4" /></div>
            </div>
            <div className="bg-[#0B0F19] border border-white/5 p-5 rounded-2xl flex justify-between items-start hover:border-white/10 transition-colors">
              <div>
                <div className="text-xs text-[#A0A7B5] font-medium mb-3">Músicas Ativas</div>
                <div className="text-2xl font-semibold tracking-tight text-[#F5F7FA]">57</div>
              </div>
              <div className="p-2 bg-green-500/10 text-green-400 rounded-lg"><TrendingUp className="w-4 h-4" /></div>
            </div>
            <div className="bg-[#0B0F19] border border-white/5 p-5 rounded-2xl flex justify-between items-start hover:border-white/10 transition-colors">
              <div>
                <div className="text-xs text-[#A0A7B5] font-medium mb-3">Músicas Inativas</div>
                <div className="text-2xl font-semibold tracking-tight text-[#F5F7FA]">0</div>
              </div>
              <div className="p-2 bg-orange-500/10 text-orange-400 rounded-lg"><Moon className="w-4 h-4" /></div>
            </div>
          </div>

          {/* Event Card */}
          <div className="bg-[#0B0F19] border border-white/5 p-6 rounded-2xl flex justify-between items-center hover:border-white/10 transition-colors">
            <div>
              <div className="text-[10px] text-[#2B85EB] font-bold uppercase tracking-widest mb-2">Próximo Evento (Geral)</div>
              <div className="text-lg font-semibold text-[#F5F7FA]">Culto Profético</div>
              <div className="text-sm text-[#A0A7B5] mt-1">domingo, 10 de maio de 2026</div>
              
              <div className="mt-6 flex gap-2 flex-wrap">
                {['A Bênção', 'A Boa Parte', 'É Ele'].map(m => (
                  <span key={m} className="px-3 py-1.5 bg-white/5 border border-white/5 rounded-md text-xs font-medium text-[#A0A7B5]">{m}</span>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-center justify-center p-5 bg-[#050505] rounded-xl border border-white/5 shadow-inner">
              <span className="text-4xl font-light tracking-tight text-[#F5F7FA]">3</span>
              <span className="text-[10px] text-[#A0A7B5] font-semibold tracking-widest mt-1">DIAS</span>
            </div>
          </div>

        </div>
      </div>
      
      {/* Decorative Gradient to disguise the bottom cut-off */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#050505] to-transparent z-20 pointer-events-none" />
    </div>
  );
}

function LayoutIcon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="3" y1="9" x2="21" y2="9"></line>
      <line x1="9" y1="21" x2="9" y2="9"></line>
    </svg>
  );
}
