import React, { useEffect, useState } from 'react';
import { presenceEngine, PresenceState } from '../packages/intelligence/presence.js';
import { useAuth } from '../contexts/AuthContext.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Users } from 'lucide-react';

export function PresenceAvatars() {
  const { user, profile } = useAuth();
  const [peers, setPeers] = useState<PresenceState[]>([]);

  useEffect(() => {
    if (user && profile?.organizationId) {
      presenceEngine.initialize(user, profile.organizationId);
      
      const unsub = presenceEngine.subscribeToPeers(profile.organizationId, (latestPeers) => {
        // Filter out current user from peers rendering
        setPeers(latestPeers.filter(p => p.userId !== user.uid));
      });
      
      return () => {
        unsub();
        presenceEngine.teardown();
      };
    }
  }, [user, profile?.organizationId]);

  if (peers.length === 0) return null;

  // Max 3 avatars to avoid "excessive visual noise"
  const visiblePeers = peers.slice(0, 3);
  const extraCount = Math.max(0, peers.length - 3);

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        <AnimatePresence>
          {visiblePeers.map(peer => (
            <motion.div
              key={peer.userId}
              initial={{ opacity: 0, scale: 0.8, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="relative group"
            >
              <div className="w-8 h-8 rounded-full bg-[#1F2937] border-2 border-[#111827] overflow-hidden flex items-center justify-center shadow-lg relative">
                 {peer.photoURL ? (
                    <img src={peer.photoURL} alt={peer.displayName} className="w-full h-full object-cover" />
                 ) : (
                    <span className="text-[10px] font-bold text-[#A0A7B5] uppercase">{peer.displayName.substring(0, 2)}</span>
                 )}
                 {/* Silent status dot */}
                 <div className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-[#111827] ${peer.status === 'active' ? 'bg-[#10B981]' : 'bg-[#F59E0B]'}`} />
              </div>

              {/* Tooltip on hover */}
              <div className="hidden group-hover:block absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-black/80 backdrop-blur-md rounded border border-white/10 text-[10px] text-white whitespace-nowrap z-50 pointer-events-none">
                 {peer.displayName}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {extraCount > 0 && (
          <div className="w-8 h-8 rounded-full bg-[#1F2937] border-2 border-[#111827] flex items-center justify-center shadow-lg z-10 text-[10px] font-bold text-[#A0A7B5]">
            +{extraCount}
          </div>
        )}
      </div>
      
      {/* Silent textual context */}
      <span className="hidden md:inline text-[10px] text-[#6B7280] font-medium leading-tight">
        {peers.length} on<br/>agora
      </span>
    </div>
  );
}
