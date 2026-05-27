import React, { useEffect, useState } from 'react';
import { Terminal, Activity, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { diagnosticsEngine, TraceLog } from '../packages/os/diagnostics.js';
import { watchdog } from '../packages/os/watchdog.js';
import { queueIntegrity } from '../packages/os/queue.js';
import { ecosystemPlatform, ProtocolDiagnostic } from '../sdk/ecosystem.js';

export function OperationalDiagnosticsUI({ onClose }: { onClose: () => void }) {
  const [logs, setLogs] = useState<TraceLog[]>([]);
  const [protocolLogs, setProtocolLogs] = useState<ProtocolDiagnostic[]>([]);
  const [watchdogState, setWatchdogState] = useState<any>(null);
  const [queueState, setQueueState] = useState<any>(null);
  const [tab, setTab] = useState<'traces' | 'protocol' | 'watchdog'>('traces');

  useEffect(() => {
    const i = setInterval(() => {
      setLogs([...diagnosticsEngine.getTraces()]);
      setProtocolLogs([...ecosystemPlatform.getDiagnostics()]);
      setWatchdogState(watchdog.getHealthStatus());
      setQueueState(queueIntegrity.getQueueHealth());
    }, 1000);
    return () => clearInterval(i);
  }, []);

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'fatal': return 'text-red-500';
      case 'error': return 'text-orange-500';
      case 'warn': return 'text-yellow-500';
      default: return 'text-blue-400';
    }
  };

  return (
    <div className="fixed inset-4 md:inset-10 bg-[#050505] border border-white/10 rounded-2xl shadow-2xl z-[9999] flex flex-col overflow-hidden text-[#F5F7FA] font-mono text-xs">
      <div className="flex items-center justify-between p-4 bg-[#0B0F19] border-b border-white/5">
        <h2 className="flex items-center gap-2 font-bold text-sm tracking-widest text-[#2B85EB]">
          <Terminal className="w-4 h-4" /> MillionsNest OS Console
        </h2>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
            <span className="text-[#A0A7B5]">Degraded Mode:</span>
            <span className={`font-bold ${watchdogState?.isDegraded ? 'text-red-500' : 'text-green-500'}`}>
              {watchdogState?.isDegraded ? 'ACTIVE' : 'OFFLINE'}
            </span>
          </div>
          
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
            <span className="text-[#A0A7B5]">Queue:</span>
            <span className="text-white">P: {queueState?.pending || 0} / F: {queueState?.failed || 0}</span>
          </div>
          <button onClick={onClose} className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors text-white">X</button>
        </div>
      </div>

      <div className="flex bg-[#0B0F19] border-b border-white/5">
        {['traces', 'protocol', 'watchdog'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`px-6 py-2 border-b-2 uppercase tracking-widest ${tab === t ? 'border-[#2B85EB] text-white' : 'border-transparent text-[#A0A7B5] hover:bg-white/5'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-black">
        {tab === 'traces' && (
          <div className="space-y-1">
            {logs.map(log => (
              <div key={log.id} className="flex items-start gap-4 hover:bg-white/5 py-1 px-2 rounded">
                <span className="text-[#A0A7B5] shrink-0 w-24">{new Date(log.timestamp).toLocaleTimeString('pt-BR')}</span>
                <span className={`w-16 shrink-0 font-bold uppercase ${getSeverityColor(log.severity)}`}>{log.severity}</span>
                <span className="w-32 shrink-0 text-purple-400">[{log.module}]</span>
                <span className="break-all whitespace-pre-wrap">{log.message}</span>
              </div>
            ))}
            {logs.length === 0 && <p className="text-[#A0A7B5]">No diagnostics traces found.</p>}
          </div>
        )}

        {tab === 'protocol' && (
          <div className="space-y-1">
            {protocolLogs.map((log, i) => (
              <div key={i} className="flex items-start gap-4 hover:bg-white/5 py-1 px-2 rounded">
                <span className="text-[#A0A7B5] shrink-0 w-24">{new Date(log.timestamp).toLocaleTimeString('pt-BR')}</span>
                <span className={`w-20 shrink-0 font-bold uppercase ${log.status === 'ERROR' ? 'text-red-500' : log.status === 'WARN' ? 'text-yellow-500' : 'text-green-500'}`}>{log.status}</span>
                <span className="w-32 shrink-0 text-cyan-400">[{log.module}]</span>
                <span className="w-48 shrink-0 text-gray-300 font-bold">{log.action}</span>
                <span className="break-all">{log.details}</span>
              </div>
            ))}
            {protocolLogs.length === 0 && <p className="text-[#A0A7B5]">No protocol traces found.</p>}
          </div>
        )}

        {tab === 'watchdog' && (
          <div className="grid grid-cols-2 gap-4">
             {watchdogState?.modules?.map(([appId, m]: [string, any]) => (
                <div key={appId} className="bg-white/5 p-4 rounded-xl border border-white/10">
                   <div className="flex justify-between items-center mb-2">
                     <span className="font-bold text-white tracking-widest">{appId}</span>
                     <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${m.status === 'dead' ? 'bg-red-500/20 text-red-500' : m.status === 'degraded' ? 'bg-orange-500/20 text-orange-500' : 'bg-green-500/20 text-green-500'}`}>{m.status}</span>
                   </div>
                   <div className="text-[#A0A7B5] space-y-1">
                     <p>Restarts: {m.restartCount}</p>
                     <p>Missed Pings: {m.missedPings}</p>
                     <p>Last Ping: {new Date(m.lastPing).toLocaleTimeString()}</p>
                   </div>
                </div>
             ))}
             {(!watchdogState?.modules || watchdogState.modules.length === 0) && <p className="text-[#A0A7B5]">No active modules.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
