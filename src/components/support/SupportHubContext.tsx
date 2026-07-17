import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { SupportRequestModal } from './SupportRequestModal.js';
import { SupportWhatsAppModal } from './SupportWhatsAppModal.js';
import { SupportGuideModal } from './SupportGuideModal.js';
import { useLocation } from 'react-router-dom';
import { resolveSupportGuide, SupportGuideDefinition } from '../../lib/supportGuideRegistry.js';

export function resolveSupportAppId(pathname: string): string {
  if (pathname.startsWith('/dashboard/apps/musicscale')) return 'musicscale';
  if (pathname.startsWith('/dashboard/apps/nestfinance')) return 'nestfinance';
  return 'core';
}

interface SupportHubContextValue {
  openHub: () => void;
  closeHub: () => void;
  toggleHub: () => void;
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

  const openHub = () => {
    setHubOpen(true);
    setRequestOpen(false);
    setWhatsappOpen(false);
    setGuideOpen(false);
  };

  const closeHub = () => setHubOpen(false);
  const toggleHub = () => setHubOpen(prev => !prev);
  
  const openRequest = () => {
    setHubOpen(false);
    setRequestOpen(true);
    setWhatsappOpen(false);
    setGuideOpen(false);
  };

  const openWhatsApp = () => {
    setHubOpen(false);
    setWhatsappOpen(true);
    setRequestOpen(false);
    setGuideOpen(false);
  };

  const openCurrentGuide = () => {
    setHubOpen(false);
    setGuideOpen(true);
    setRequestOpen(false);
    setWhatsappOpen(false);
  };

  const closeSupport = () => {
    setHubOpen(false);
    setRequestOpen(false);
    setWhatsappOpen(false);
    setGuideOpen(false);
  };

  let currentAppId = resolveSupportAppId(location.pathname);

  const prevOrgIdRef = useRef(organizationId);
  const prevPathRef = useRef(location.pathname);
  const prevSearchRef = useRef(location.search);
  const prevAppIdRef = useRef(currentAppId);

  useEffect(() => {
    let shouldCloseHub = false;
    let shouldCloseAll = false;

    if (prevOrgIdRef.current !== organizationId) {
      shouldCloseAll = true;
    }
    
    if (prevPathRef.current !== location.pathname || prevSearchRef.current !== location.search || prevAppIdRef.current !== currentAppId) {
      shouldCloseHub = true;
    }

    if (shouldCloseAll) {
      setHubOpen(false);
      setRequestOpen(false);
      setWhatsappOpen(false);
      setGuideOpen(false);
    } else if (shouldCloseHub) {
      setHubOpen(false);
    }

    prevOrgIdRef.current = organizationId;
    prevPathRef.current = location.pathname;
    prevSearchRef.current = location.search;
    prevAppIdRef.current = currentAppId;
  }, [organizationId, location.pathname, location.search, currentAppId]);

  const currentGuide = resolveSupportGuide({
    pathname: location.pathname,
    searchParams: new URLSearchParams(location.search),
    appId: currentAppId
  });

  return (
    <SupportHubContext.Provider value={{ 
      openHub, closeHub, toggleHub, openRequest, openWhatsApp, openCurrentGuide, closeSupport,
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
