import { motion } from "framer-motion";
import { Book, Sparkles, TrendingUp, Moon, Calendar, User, HeadphonesIcon, HelpCircle, Music } from "lucide-react";

export function DashboardMockup() {
  return (
    <div className="w-[800px] h-[600px] shrink-0 bg-[#0a0a0a] text-white flex overflow-hidden rounded-2xl border border-white/10 font-sans shadow-2xl relative select-none">
      {/* Sidebar */}
      <div className="w-20 bg-[#111] border-r border-white/5 flex flex-col items-center py-6 gap-6 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-blue-600 font-bold flex items-center justify-center text-base">M</div>
        <div className="flex flex-col gap-5 mt-4 text-white/40">
          <div className="p-2.5 rounded-lg bg-blue-500/20 text-blue-500"><LayoutIcon className="w-6 h-6" /></div>
          <div className="p-2.5 rounded-lg hover:text-white transition-colors"><Book className="w-6 h-6" /></div>
          <div className="p-2.5 rounded-lg hover:text-white transition-colors"><Calendar className="w-6 h-6" /></div>
          <div className="p-2.5 rounded-lg hover:text-white transition-colors"><Music className="w-6 h-6" /></div>
          <div className="p-2.5 rounded-lg hover:text-white transition-colors"><User className="w-6 h-6" /></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
        {/* Header */}
        <div className="px-8 py-5 border-b border-white/5 flex justify-between items-center bg-[#0a0a0a]">
          <h2 className="font-semibold text-base">Visão Geral</h2>
          <div className="flex gap-4 text-white/40">
            <HelpCircle className="w-5 h-5" />
            <HeadphonesIcon className="w-5 h-5" />
          </div>
        </div>

        {/* Scrollable Content (Simulated) */}
        <div className="p-8 flex flex-col gap-8 overflow-y-auto">
          {/* Welcome Area */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Olá, Daniel!</h1>
              <p className="text-white/40 text-sm mt-1">Aqui está um resumo da sua atividade.</p>
            </div>
            <button className="flex px-5 py-2.5 bg-brand-secondary text-[#0a0a0a] font-bold text-sm rounded-full items-center gap-2">
              <HeadphonesIcon className="w-4 h-4" />
              Indicar Música
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#111] border border-white/5 p-5 rounded-2xl flex justify-between items-start">
              <div>
                <div className="text-xs text-white/40 font-semibold mb-2 uppercase tracking-wider leading-tight">Total de Músicas</div>
                <div className="text-3xl font-bold">57</div>
              </div>
              <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl"><Book className="w-5 h-5" /></div>
            </div>
            <div className="bg-[#111] border border-white/5 p-5 rounded-2xl flex justify-between items-start">
              <div>
                <div className="text-xs text-white/40 font-semibold mb-2 uppercase tracking-wider leading-tight">Músicas Novas</div>
                <div className="text-3xl font-bold">13</div>
              </div>
              <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl"><Sparkles className="w-5 h-5" /></div>
            </div>
            <div className="bg-[#111] border border-white/5 p-5 rounded-2xl flex justify-between items-start">
              <div>
                <div className="text-xs text-white/40 font-semibold mb-2 uppercase tracking-wider leading-tight">Músicas Ativas</div>
                <div className="text-3xl font-bold">57</div>
              </div>
              <div className="p-2.5 bg-green-500/20 text-green-400 rounded-xl"><TrendingUp className="w-5 h-5" /></div>
            </div>
            <div className="bg-[#111] border border-white/5 p-5 rounded-2xl flex justify-between items-start">
              <div>
                <div className="text-xs text-white/40 font-semibold mb-2 uppercase tracking-wider leading-tight">Músicas Inativas</div>
                <div className="text-3xl font-bold">0</div>
              </div>
              <div className="p-2.5 bg-orange-500/20 text-orange-400 rounded-xl"><Moon className="w-5 h-5" /></div>
            </div>
          </div>

          {/* Event Card */}
          <div className="bg-[#111] border border-white/5 p-6 rounded-2xl flex justify-between items-center">
            <div>
              <div className="text-xs text-brand-secondary font-semibold mb-1 uppercase tracking-wider">Próximo Evento (Geral)</div>
              <div className="text-xl font-bold">Culto Profético</div>
              <div className="text-sm text-white/40 mt-1">domingo, 10 de maio de 2026</div>
              
              <div className="mt-5 flex gap-2 flex-wrap">
                {['A Bênção', 'A Boa Parte', 'É Ele'].map(m => (
                  <span key={m} className="px-3 py-1.5 bg-white/5 rounded-md text-xs text-white/60">{m}</span>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-center justify-center p-5 bg-white/5 rounded-2xl border border-white/5">
              <span className="text-4xl font-bold">3</span>
              <span className="text-xs text-white/40 font-bold tracking-wider mt-1">DIAS</span>
            </div>
          </div>

        </div>
      </div>
      
      {/* Decorative Gradient to disguise the bottom cut-off */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0a0a0a] to-transparent z-20 pointer-events-none" />
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
