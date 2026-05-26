import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { useAuth } from '../contexts/AuthContext.js';
import { Clock, CheckCircle2, Music, Users, ShieldAlert, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.organizationId) return;

    const timelineRef = collection(db, `organizations/${profile.organizationId}/timeline`);
    const q = query(timelineRef, orderBy('timestamp', 'desc'), limit(15));

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimelineEvent));
      setEvents(data);
      setLoading(false);
    });

    return () => unsub();
  }, [profile?.organizationId]);

  const getEventIcon = (type: string) => {
    if (type.includes('scale')) return <Clock className="w-3.5 h-3.5 text-[#2B85EB]" />;
    if (type.includes('rehearsal')) return <Users className="w-3.5 h-3.5 text-[#A855F7]" />;
    if (type.includes('music') || type.includes('song')) return <Music className="w-3.5 h-3.5 text-[#10B981]" />;
    if (type.includes('billing') || type.includes('org')) return <ShieldAlert className="w-3.5 h-3.5 text-[#F59E0B]" />;
    return <CheckCircle2 className="w-3.5 h-3.5 text-[#A0A7B5]" />;
  };

  const getEventColorDot = (type: string) => {
    if (type.includes('scale')) return 'bg-[#2B85EB]';
    if (type.includes('music') || type.includes('song')) return 'bg-[#10B981]';
    if (type.includes('rehearsal')) return 'bg-[#A855F7]';
    if (type.includes('billing')) return 'bg-[#F59E0B]';
    return 'bg-[#A0A7B5]';
  };

  if (loading) {
    return (
      <div className="bg-[#0B0F19] rounded-[2rem] p-6 border border-white/5 opacity-50 flex items-center justify-center animate-pulse min-h-[300px]">
        <span className="text-sm text-[#A0A7B5]">Carregando Timeline Operacional...</span>
      </div>
    );
  }

  return (
    <div className="bg-[#0B0F19]/50 backdrop-blur-xl rounded-[2rem] p-6 border border-white/5 shadow-inner transition-all relative overflow-hidden flex flex-col min-h-[300px]">
      <div className="absolute inset-0 bg-gradient-to-br from-[#2B85EB]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-[#F5F7FA] tracking-tight flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#A0A7B5]" /> Timeline Ministerial
        </h3>
        <span className="text-[10px] text-[#A0A7B5] font-mono tracking-widest uppercase flex items-center gap-1.5">
          Live <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
        </span>
      </div>
      
      <div className="flex-1 relative">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-60">
             <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-[#A0A7B5]">
                <Clock className="w-5 h-5" />
             </div>
             <div>
                <p className="text-sm font-medium text-[#F5F7FA]">Timeline Silenciosa</p>
                <p className="text-xs text-[#A0A7B5] mt-1 max-w-[200px]">Os eventos do seu ecossistema aparecerão magicamente aqui.</p>
             </div>
          </div>
        ) : (
          <div className="space-y-5 relative">
            <div className="absolute left-3 top-2 bottom-2 w-px bg-white/5" />
            
            <AnimatePresence>
              {events.map((evt, idx) => (
                <motion.div 
                  key={evt.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.05 }}
                  className="relative pl-8 group cursor-default"
                >
                  <div className={`absolute left-[9px] top-1.5 w-1.5 h-1.5 rounded-full ${getEventColorDot(evt.eventType)} ring-4 ring-[#0B0F19] transition-transform group-hover:scale-150`} />
                  
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <p className="text-sm font-medium text-[#F5F7FA] group-hover:text-white transition-colors">{evt.title}</p>
                      <p className="text-xs text-[#A0A7B5] mt-0.5 line-clamp-2">{evt.description}</p>
                    </div>
                    <span className="text-[10px] text-[#6B7280] whitespace-nowrap pt-0.5 font-mono">
                      {evt.timestamp ? (
                         new Date(evt.timestamp.seconds * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      ) : 'agora'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 mt-2 opacity-50 group-hover:opacity-100 transition-opacity">
                    <span className="flex items-center justify-center w-5 h-5 rounded bg-white/5">
                       {getEventIcon(evt.eventType)}
                    </span>
                    <span className="text-[9px] uppercase font-bold text-[#A0A7B5] tracking-widest">{evt.appSource}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      
      {/* Ghost gradient for long timelines */}
      {events.length > 5 && (
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0B0F19] to-transparent pointer-events-none" />
      )}
    </div>
  );
}
