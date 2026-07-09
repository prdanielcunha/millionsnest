import React from 'react';
import { 
  LayoutGrid, Calendar, Music, BookOpen, Users, 
  Database, Headphones, Home, Settings, HelpCircle, 
  Moon, User, LogOut, Sparkles, CalendarPlus, TrendingUp
} from "lucide-react";

export function EscalasMockup() {
  return (
    <div className="w-[1024px] h-[700px] bg-[#050505] rounded-xl border border-white/5 flex overflow-hidden shadow-2xl relative select-none">
      
      {/* Sidebar */}
      <div className="w-[68px] bg-[#0A0A0A] border-r border-[#151515] flex flex-col items-center py-4 justify-between shrink-0 relative z-20">
        <div className="flex flex-col gap-5 w-full items-center">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
            <img 
              src="/LogoIconMusicScale-1.png" 
              onError={(e) => { e.currentTarget.src = '/logo.png'; }} 
              alt="MusicScale"
              className="w-full h-full object-contain"
            />
          </div>
          
          <div className="flex flex-col gap-1 w-full px-2 mt-4">
            <SidebarIcon icon={<LayoutGrid size={18} />} active />
            <SidebarIcon icon={<Calendar size={18} />} />
            <SidebarIcon icon={<Music size={18} />} />
            <SidebarIcon icon={<BookOpen size={18} />} />
            <SidebarIcon icon={<Users size={18} />} />
          </div>
          
          <div className="w-6 h-px bg-[#151515] my-1" />
          
          <div className="flex flex-col gap-1 w-full px-2">
            <SidebarIcon icon={<Database size={18} />} />
            <SidebarIcon icon={<Headphones size={18} />} />
            <SidebarIcon icon={<Home size={18} />} />
            <SidebarIcon icon={<Settings size={18} />} />
            <SidebarIcon icon={<HelpCircle size={18} />} />
          </div>
        </div>

        <div className="flex flex-col gap-1 w-full px-2">
          <SidebarIcon icon={<Moon size={18} />} />
          <SidebarIcon icon={<User size={18} />} />
          <SidebarIcon icon={<LogOut size={18} className="text-[#EF4444]/60 hover:text-[#EF4444]" />} />
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-20 bg-[#050505]">
        {/* Header */}
        <div className="h-16 border-b border-[#151515] flex items-center px-8 shrink-0">
          <h2 className="text-[#F5F7FA] font-semibold text-lg">Visão Geral</h2>
        </div>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-hidden p-8 flex flex-col items-center pt-[5vh]">
          {/* Welcome Text */}
          <div className="max-w-[700px] w-full flex flex-col items-center text-center mb-16">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#A0A7B5] mb-4 flex items-center gap-2">
              <Sparkles size={12} className="text-[#A0A7B5]" />
              SEJA BEM-VINDO
            </div>
            
            <h1 className="text-[4rem] font-bold text-[#F5F7FA] tracking-tight leading-none mb-6">
              Organização musical
            </h1>
            
            <p className="text-[#A0A7B5] text-lg leading-relaxed max-w-[600px]">
              Você está a poucos passos de centralizar seu repertório, montar suas escalas e equipar seu time com conforto e precisão.
            </p>
          </div>

          <div className="w-full max-w-[800px] flex flex-col gap-8">
            {/* Acesso Rápido */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#A0A7B5] mb-4">ACESSO RÁPIDO</h3>
              <div className="grid grid-cols-4 gap-4">
                <ActionCard 
                  icon={<CalendarPlus size={20} />} 
                  title="Nova Escala" 
                  desc="Montar repertório" 
                />
                <ActionCard 
                  icon={<Calendar size={20} />} 
                  title="Ver Escalas" 
                  desc="Agenda completa" 
                />
                <ActionCard 
                  icon={<Music size={20} />} 
                  title="Nova Música" 
                  desc="Adicionar cifra" 
                />
                <ActionCard 
                  icon={<BookOpen size={20} />} 
                  title="Ver Músicas" 
                  desc="Seu repertório" 
                />
              </div>
            </div>

            {/* Para Começar */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#A0A7B5] mb-4">PARA COMEÇAR</h3>
              <div className="grid grid-cols-3 gap-4">
                <ActionCard 
                  icon={<Sparkles size={20} />} 
                  title="Importar Músicas" 
                  desc="Adicione cifras prontas." 
                  highlight
                />
                <ActionCard 
                  icon={<Music size={20} />} 
                  title="Seu Repertório" 
                  desc="Cadastre as cifras." 
                />
                <ActionCard 
                  icon={<CalendarPlus size={20} />} 
                  title="Criar Escala" 
                  desc="Agende seu evento." 
                />
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-4 pt-4 pb-12">
              <StatCard 
                title="TOTAL DE MÚSICAS" 
                value="0" 
                icon={<BookOpen size={16} className="text-[#2B85EB]" />} 
                iconBg="bg-[#2B85EB]/20" 
              />
              <StatCard 
                title="MÚSICAS NOVAS" 
                value="0" 
                icon={<Sparkles size={16} className="text-[#A855F7]" />} 
                iconBg="bg-[#A855F7]/20" 
              />
              <StatCard 
                title="MÚSICAS ATIVAS" 
                value="0" 
                icon={<TrendingUp size={16} className="text-[#10B981]" />} 
                iconBg="bg-[#10B981]/20" 
              />
              <StatCard 
                title="MÚSICAS INATIVAS" 
                value="0" 
                icon={<Moon size={16} className="text-[#F59E0B]" />} 
                iconBg="bg-[#F59E0B]/20" 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarIcon({ icon, active }: { icon: React.ReactNode, active?: boolean }) {
  return (
    <div className={`w-12 h-12 flex items-center justify-center rounded-xl cursor-default transition-colors ${
      active ? 'bg-white/10 text-white' : 'text-[#A0A7B5]/60 hover:text-white hover:bg-white/5'
    }`}>
      {icon}
    </div>
  );
}

function ActionCard({ icon, title, desc, highlight }: { icon: React.ReactNode, title: string, desc: string, highlight?: boolean }) {
  return (
    <div className={`p-6 rounded-2xl flex flex-col justify-end min-h-[140px] bg-[#0B0F19] transition-colors border ${
      highlight ? 'border-white/20' : 'border-[#151515] hover:border-white/10'
    }`}>
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#A0A7B5] mb-auto">
        {icon}
      </div>
      <h4 className="text-[#F5F7FA] font-semibold text-[15px] mb-1">{title}</h4>
      <p className="text-[#A0A7B5] text-[13px]">{desc}</p>
    </div>
  );
}

function StatCard({ title, value, icon, iconBg }: { title: string, value: string, icon: React.ReactNode, iconBg: string }) {
  return (
    <div className="p-5 rounded-2xl bg-[#0B0F19] border border-[#151515] flex flex-col justify-between min-h-[110px]">
      <div className="flex justify-between items-start">
        <h4 className="text-[9px] font-bold text-[#A0A7B5] uppercase tracking-widest leading-relaxed max-w-[60%]">{title}</h4>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
      <div className="text-[2rem] font-bold text-[#F5F7FA] leading-none mt-4">
        {value}
      </div>
    </div>
  );
}
