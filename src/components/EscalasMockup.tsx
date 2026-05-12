import { MapPin, Edit2, Trash2, Music } from "lucide-react";

export function EscalasMockup() {
  return (
    <div className="w-full bg-[#050505] rounded-t-2xl p-4 md:p-6 overflow-hidden select-none border-t border-x border-white/5 relative z-10 shadow-[0_-20px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
      {/* Top Bar */}
      <div className="flex gap-3 mb-6 relative z-10">
        <div className="bg-[#0B0F19] hover:bg-[#0B0F19]/80 px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-semibold text-[#F5F7FA] cursor-default transition-colors border border-white/5 shadow-sm">
          Selecionar
        </div>
        <div className="flex bg-[#0B0F19] border border-white/5 rounded-lg p-1 shadow-sm">
          <div className="bg-[#2B85EB]/10 border border-[#2B85EB]/20 text-[#2B85EB] px-4 py-1 md:py-1.5 rounded-md text-xs md:text-sm font-semibold shadow-sm cursor-default">
            Próximas
          </div>
          <div className="px-4 py-1 md:py-1.5 rounded-md text-xs md:text-sm font-medium text-[#A0A7B5] hover:text-[#F5F7FA] transition-colors cursor-default">
            Passadas
          </div>
        </div>
      </div>

      {/* Cards Scroll Container */}
      <div 
        className="flex gap-5 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 snap-x relative z-10"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style dangerouslySetInnerHTML={{__html: `div::-webkit-scrollbar { display: none; }`}} />
        {/* Card 1 */}
        <ScheduleCard 
          month="MAI" day="10" 
          title="Culto Profético" location="Campus Cambé" 
          songsCount={4}
          songs={[
            { name: "A Bênção", key: "Bb" },
            { name: "A Boa Parte", key: "E" },
            { name: "É Ele", key: "Bb" },
            { name: "O Encontro", key: "B" }
          ]}
        />
        {/* Card 2 */}
        <ScheduleCard 
          month="MAI" day="17" 
          title="Culto Profético" location="Campus Centro" 
          songsCount={5}
          songs={[
            { name: "Tudo o que me prometeu", key: "G" },
            { name: "Onde o fogo não apaga", key: "Db" },
            { name: "Cordeiro e Leão", key: "D" },
            { name: "Maranata", key: "Bm" }
          ]}
          moreCount={1}
        />
        {/* Card 3 */}
        <ScheduleCard 
          month="MAI" day="24" 
          title="Culto de Jovens" location="Campus Cambé" 
          songsCount={4}
          songs={[
            { name: "Estamos de Pé", key: "A" },
            { name: "Sublime", key: "D" },
            { name: "Digno de Tudo", key: "C" },
            { name: "Algo Novo", key: "D" }
          ]}
        />
      </div>
    </div>
  );
}

function ScheduleCard({ month, day, title, location, songsCount, songs, moreCount }: any) {
  return (
    <div className="min-w-[260px] md:min-w-[300px] max-w-[300px] bg-[#0B0F19]/80 backdrop-blur-md border border-white/5 rounded-2xl p-5 md:p-6 flex flex-col snap-start shrink-0 shadow-lg hover:border-white/10 hover:shadow-[0_0_20px_rgba(43,133,235,0.05)] transition-all">
      {/* Header */}
      <div className="flex gap-4 mb-6">
        <div className="bg-[#050505] text-[#F5F7FA] rounded-xl aspect-square w-12 md:w-14 shrink-0 flex flex-col items-center justify-center border border-white/5 shadow-inner relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-1 bg-[#2B85EB]/50" />
          <span className="text-[9px] md:text-[10px] font-bold text-[#A0A7B5] uppercase tracking-widest">{month}</span>
          <span className="text-lg md:text-xl font-semibold leading-none mt-1 tracking-tight">{day}</span>
        </div>
        <div className="flex flex-col justify-center flex-1 min-w-0">
          <h4 className="font-semibold text-sm md:text-base text-[#F5F7FA] truncate">{title}</h4>
          <div className="flex items-center gap-1.5 text-[#A0A7B5] text-xs md:text-sm mt-1">
            <MapPin className="w-3 md:w-3.5 h-3 md:h-3.5 shrink-0" />
            <span className="truncate font-medium">{location}</span>
          </div>
        </div>
      </div>

      {/* Repertório */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-[10px] md:text-xs font-semibold text-[#A0A7B5] tracking-widest uppercase">Repertório</span>
        <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-[#2B85EB] font-medium bg-[#2B85EB]/10 px-2 py-0.5 rounded-md">
          <Music className="w-3 h-3" />
          <span>{songsCount} músicas</span>
        </div>
      </div>

      <div className="space-y-3 mb-5 flex-1">
        {songs.map((s: any, i: number) => (
          <div key={i} className="flex justify-between items-center text-xs md:text-sm group">
            <span className="text-[#F5F7FA] font-medium truncate pr-3 group-hover:text-[#2B85EB] transition-colors">{s.name}</span>
            <span className="text-[#A0A7B5] font-mono text-[10px] md:text-xs shrink-0 flex items-center justify-center w-8 h-5 rounded bg-white/5 border border-white/5">{s.key}</span>
          </div>
        ))}
        {moreCount && (
          <div className="text-[10px] md:text-xs text-[#A0A7B5] font-medium text-center mt-3 pt-2 border-t border-white/5">+ {moreCount} outra</div>
        )}
      </div>

      <div className="h-px w-full bg-white/5 my-4" />

      {/* Actions */}
      <div className="flex justify-around mt-auto">
        <button className="flex items-center gap-2 text-[#A0A7B5] hover:text-[#F5F7FA] transition-colors text-xs md:text-sm font-semibold">
          <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
          Editar
        </button>
        <div className="w-px h-4 bg-white/5 self-center" />
        <button className="flex items-center gap-2 text-[#EF4444]/80 hover:text-[#EF4444] transition-colors text-xs md:text-sm font-semibold">
          <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
          Excluir
        </button>
      </div>
    </div>
  );
}
