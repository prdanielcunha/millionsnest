import { MapPin, Edit2, Trash2, Music } from "lucide-react";

export function EscalasMockup() {
  return (
    <div className="w-full bg-[#0a0a0a] rounded-t-2xl p-4 md:p-6 overflow-hidden select-none border-t border-x border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      {/* Top Bar */}
      <div className="flex gap-2 mb-6">
        <div className="bg-[#242424] hover:bg-[#2a2a2a] px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-semibold text-white/90 cursor-default transition-colors">
          Selecionar
        </div>
        <div className="flex bg-[#111] border border-white/5 rounded-lg p-1">
          <div className="bg-blue-500 text-white px-4 py-1 md:py-1.5 rounded-md text-xs md:text-sm font-semibold shadow-sm cursor-default">
            Próximas
          </div>
          <div className="px-4 py-1 md:py-1.5 rounded-md text-xs md:text-sm font-semibold text-white/50 hover:text-white/80 transition-colors cursor-default">
            Passadas
          </div>
        </div>
      </div>

      {/* Cards Scroll Container */}
      <div 
        className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 snap-x"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style dangerouslySetInnerHTML={{__html: `div::-webkit-scrollbar { display: none; }`}} />
        {/* Card 1 */}
        <ScheduleCard 
          month="MAI" day="10" 
          title="Culto Profético" location="Cambé" 
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
          title="Culto Profético" location="Industrial" 
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
          title="Culto Profético" location="Cambé" 
          songsCount={4}
          songs={[
            { name: "Estamos de Pé", key: "A" },
            { name: "Sublime", key: "D" },
            { name: "Digno de Tudo + Te Exaltamos", key: "C" },
            { name: "Algo Novo", key: "D" }
          ]}
        />
      </div>
    </div>
  );
}

function ScheduleCard({ month, day, title, location, songsCount, songs, moreCount }: any) {
  return (
    <div className="min-w-[260px] md:min-w-[300px] max-w-[300px] bg-[#111] border border-white/5 rounded-2xl p-4 md:p-5 flex flex-col snap-start shrink-0 shadow-lg">
      {/* Header */}
      <div className="flex gap-3 md:gap-4 mb-5 md:mb-6">
        <div className="bg-[#142642] text-white rounded-xl aspect-square w-12 md:w-14 shrink-0 flex flex-col items-center justify-center border border-blue-500/20 shadow-inner">
          <span className="text-[9px] md:text-[10px] font-bold text-blue-300 uppercase tracking-wider">{month}</span>
          <span className="text-lg md:text-xl font-bold leading-none mt-0.5">{day}</span>
        </div>
        <div className="flex flex-col justify-center flex-1 min-w-0">
          <h4 className="font-bold text-sm md:text-base text-white/90 truncate">{title}</h4>
          <div className="flex items-center gap-1 text-white/50 text-xs md:text-sm mt-0.5">
            <MapPin className="w-3 md:w-3.5 h-3 md:h-3.5 shrink-0" />
            <span className="truncate">{location}</span>
          </div>
        </div>
      </div>

      {/* Repertório */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] md:text-xs font-bold text-white/40 tracking-wider">REPERTÓRIO</span>
        <div className="flex items-center gap-1 text-[10px] md:text-xs text-white/40">
          <Music className="w-3 h-3" />
          <span>{songsCount} músicas</span>
        </div>
      </div>

      <div className="space-y-2 md:space-y-2.5 mb-4 flex-1">
        {songs.map((s: any, i: number) => (
          <div key={i} className="flex justify-between items-center text-xs md:text-sm">
            <span className="text-white/80 font-medium truncate pr-3">{s.name}</span>
            <span className="text-white/40 font-mono text-[10px] md:text-xs shrink-0">{`(${s.key})`}</span>
          </div>
        ))}
        {moreCount && (
          <div className="text-[10px] md:text-xs text-white/40 text-center mt-2">+ {moreCount} mais...</div>
        )}
      </div>

      <div className="h-px w-full bg-white/5 my-3 md:my-4" />

      {/* Actions */}
      <div className="flex justify-center gap-4 md:gap-6 mt-auto">
        <button className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors text-xs md:text-sm font-medium">
          <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
          Editar
        </button>
        <button className="flex items-center gap-1.5 text-red-400/80 hover:text-red-400 transition-colors text-xs md:text-sm font-medium">
          <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
          Excluir
        </button>
      </div>
    </div>
  );
}
