import { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { useAuth } from '../contexts/AuthContext.js';
import { useOrganization } from '../contexts/OrganizationContext.js';
import { Clock, CheckCircle2, Music, Users, ShieldAlert, Filter, CalendarDays, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { eventBus } from '../packages/events/index.js';
import { Shimmer } from '../packages/ui/shimmer.js';
import { PremiumEmptyState } from '../packages/ui/empty-state.js';

interface TimelineEvent {
  id: string;
  eventType: string;
  actorUid: string;
  appSource: string;
  title: string;
  description: string;
  timestamp: { seconds: number, nanoseconds: number };
}

export function UnifiedTimeline() {
  const { profile } = useAuth();
  const { organization } = useOrganization();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'musicscale' | 'organization' | 'billing'>('all');

  useEffect(() => {
    if (!organization?.id || !profile) return;

    const timelineRef = collection(db, `organizations/${organization.id}/timeline`);
    const q = query(timelineRef, orderBy('timestamp', 'desc'), limit(50));

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimelineEvent));
      setEvents(data);
      setLoading(false);
      
      // Update UI telemetry for operational tracking
      eventBus.publish('ecosystem.timeline.viewed', { 
        organizationId: organization.id, 
        userId: profile.id, 
        appSource: 'core',
        metadata: { loadedEventCount: data.length }
      });
    });

    return () => unsub();
  }, [organization?.id, profile?.id]);

  const getEventIcon = (type: string) => {
    if (type.includes('scale') || type.includes('rehearsal')) return <CalendarDays className="w-3.5 h-3.5 text-[#2B85EB]" />;
    if (type.includes('worship')) return <Users className="w-3.5 h-3.5 text-[#A855F7]" />;
    if (type.includes('music') || type.includes('song')) return <Music className="w-3.5 h-3.5 text-[#10B981]" />;
    if (type.includes('billing')) return <ShieldAlert className="w-3.5 h-3.5 text-[#F59E0B]" />;
    if (type.includes('org') || type.includes('member')) return <Key className="w-3.5 h-3.5 text-[#A0A7B5]" />;
    return <CheckCircle2 className="w-3.5 h-3.5 text-[#2B85EB]" />;
  };

  const getEventColorDot = (type: string) => {
    if (type.includes('scale') || type.includes('rehearsal')) return 'bg-[#2B85EB]';
    if (type.includes('music') || type.includes('song')) return 'bg-[#10B981]';
    if (type.includes('worship')) return 'bg-[#A855F7]';
    if (type.includes('billing')) return 'bg-[#F59E0B]';
    return 'bg-[#2B85EB]'; // Core ecosystem color
  };

  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter(e => e.eventType.startsWith(filter) || e.appSource === filter);
  }, [events, filter]);

  if (loading) {
    return (
              <Shimmer className="w-full h-full min-h-[400px] rounded-[2rem]" />
    );
  }

  return (
    <div className="bg-[#0B0F19]/50 backdrop-blur-xl rounded-[2rem] p-6 border border-white/5 shadow-inner transition-all relative overflow-hidden flex flex-col min-h-[450px]">
      <div className="absolute inset-0 bg-gradient-to-br from-[#2B85EB]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 relative z-10">
        <div>
           <h3 className="text-lg font-semibold text-[#F5F7FA] tracking-tight flex items-center gap-2">
             <Clock className="w-5 h-5 text-[#A0A7B5]" /> Timeline Ministerial
           </h3>
           <p className="text-xs text-[#A0A7B5] mt-0.5">Memória operacional inteligente e em tempo real.</p>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-2 bg-[#050505] p-1 rounded-xl border border-white/5">
           {(['all', 'musicscale', 'organization'] as const).map(f => (
             <button
               key={f}
               onClick={() => setFilter(f)}
               className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all uppercase tracking-widest ${filter === f ? 'bg-white/10 text-[#F5F7FA] shadow-sm' : 'text-[#A0A7B5] hover:text-[#F5F7FA]'}`}
             >
               {f === 'all' ? 'Tudo' : f}
             </button>
           ))}
        </div>
      </div>
      
      <div className="flex-1 relative overflow-y-auto no-scrollbar pb-10 z-10">
        {filteredEvents.length === 0 ? (
          <div className="mt-8">
            <PremiumEmptyState 
              icon={<Filter className="w-8 h-8" />}
              title="Memória Limpa"
              description="Nenhuma atividade recente registrada neste escopo."
            />
          </div>
        ) : (
          <div className="space-y-6 relative ml-2">
            <div className="absolute left-[3px] top-2 bottom-2 w-px bg-white/5" />
            
            <AnimatePresence mode="popLayout">
              {filteredEvents.map((evt, idx) => (
                <motion.div 
                  layout
                  key={evt.id}
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="relative pl-8 group cursor-default"
                >
                  <div className={`absolute left-0 top-1.5 w-2 h-2 rounded-full ${getEventColorDot(evt.eventType)} ring-4 ring-[#0B0F19] transition-transform group-hover:scale-150`} />
                  
                  <div className="flex flex-col gap-1 bg-[#050505] p-3 rounded-xl border border-white/5 hover:border-white/10 transition-colors shadow-sm relative">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                           <span className="flex items-center justify-center w-5 h-5 rounded bg-white/5">
                             {getEventIcon(evt.eventType)}
                           </span>
                           <p className="text-sm font-semibold text-[#F5F7FA]">{evt.title}</p>
                        </div>
                        <p className="text-xs text-[#A0A7B5] line-clamp-2 ml-7 leading-relaxed">{evt.description}</p>
                      </div>
                      <span className="text-[10px] text-[#A0A7B5] pt-1 font-mono shrink-0">
                        {evt.timestamp ? (
                           new Date(evt.timestamp.seconds * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        ) : 'agora'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1 ml-7 opacity-70">
                      <span className="text-[9px] uppercase font-bold text-[#A0A7B5] tracking-widest bg-white/5 px-1.5 py-0.5 rounded shadow-sm">{evt.appSource}</span>
                      <span className="text-[9px] uppercase font-bold text-[#6B7280] tracking-widest bg-white/5 px-1.5 py-0.5 rounded shadow-sm">{evt.eventType}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      
      {/* Ghost gradient for long timelines */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0B0F19] to-transparent pointer-events-none" />
    </div>
  );
}
