import React, { createContext, useContext, useState, ReactNode } from 'react';
import { SupportRequestModal } from './SupportRequestModal.js';
import { SupportWhatsAppModal } from './SupportWhatsAppModal.js';
import { SupportGuideModal } from './SupportGuideModal.js';
import { useLocation } from 'react-router-dom';
import { resolveSupportGuide, SupportGuideDefinition } from '../../lib/supportGuideRegistry.js';

interface SupportHubContextValue {
  openHub: () => void;
  openRequest: () => void;
  openWhatsApp: () => void;
  openCurrentGuide: () => void;
  closeSupport: () => void;
  requestOpen: boolean;
  whatsappOpen: boolean;
  guideOpen: boolean;
  hubOpen: boolean;
  organizationId: string | null;
  organizationName: string | null;
  appId: string;
}

const SupportHubContext = createContext<SupportHubContextValue | null>(null);

export function useSupportHub() {
  const context = useContext(SupportHubContext);
  if (!context) {
    throw new Error('useSupportHub must be used within a SupportHubProvider');
  }
  return context;
}

interface SupportHubProviderProps {
  children: ReactNode;
  organizationId: string | null;
  organizationName: string | null;
  appId: string;
}

export function SupportHubProvider({ children, organizationId, organizationName, appId }: SupportHubProviderProps) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  
  const location = useLocation();

  const openHub = () => setHubOpen(true);
  
  const openRequest = () => {
    setRequestOpen(true);
    setWhatsappOpen(false);
    setGuideOpen(false);
  };

  const openWhatsApp = () => {
    setWhatsappOpen(true);
    setRequestOpen(false);
    setGuideOpen(false);
  };

  const openCurrentGuide = () => {
    setGuideOpen(true);
    setRequestOpen(false);
    setWhatsappOpen(false);
  };

  const closeSupport = () => {
    setRequestOpen(false);
    setWhatsappOpen(false);
    setGuideOpen(false);
  };

  let currentAppId = appId;
  if (location.pathname.startsWith('/musicscale')) currentAppId = 'musicscale';
  else if (location.pathname.startsWith('/finance')) currentAppId = 'nestfinance';

  const currentGuide = resolveSupportGuide({
    pathname: location.pathname,
    searchParams: new URLSearchParams(location.search),
    appId: currentAppId
  });

  return (
    <SupportHubContext.Provider value={{ 
      openHub, openRequest, openWhatsApp, openCurrentGuide, closeSupport,
      requestOpen, whatsappOpen, guideOpen, hubOpen,
      organizationId, organizationName, appId: currentAppId
    }}>
      {children}
      <SupportRequestModal />
      <SupportWhatsAppModal 
        isOpen={whatsappOpen} 
        onClose={closeSupport} 
        appId={currentAppId} 
      />
      <SupportGuideModal 
        isOpen={guideOpen} 
        onClose={closeSupport} 
        guide={currentGuide} 
      />
    </SupportHubContext.Provider>
  );
}
