/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { AuthProvider, useAuth } from './contexts/AuthContext.js';
import { OrganizationProvider } from './contexts/OrganizationContext.js';
import { CommandPalette } from './components/CommandPalette.js';
import { SmartResume } from './components/SmartResume.js';
import { telemetry } from './packages/telemetry/index.js';
import { performanceEngine } from './packages/telemetry/performance.js';
import { i18nEngine } from './packages/i18n/index.js';
import { initializeOSHardening } from './packages/os/index.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { Toaster } from 'react-hot-toast';

initializeOSHardening();

const Home = lazy(() => import('./pages/Home.js').then(module => ({ default: module.Home })));
const Terms = lazy(() => import('./pages/Terms.js').then(module => ({ default: module.Terms })));
const Privacy = lazy(() => import('./pages/Privacy.js').then(module => ({ default: module.Privacy })));
const Refunds = lazy(() => import('./pages/Refunds.js').then(module => ({ default: module.Refunds })));
const Cancellation = lazy(() => import('./pages/Cancellation.js').then(module => ({ default: module.Cancellation })));
const Login = lazy(() => import('./pages/Login.js').then(module => ({ default: module.Login })));
const Join = lazy(() => import('./pages/Join.js').then(module => ({ default: module.Join })));
const Dashboard = lazy(() => import('./pages/Dashboard.js').then(module => ({ default: module.Dashboard })));
const Checkout = lazy(() => import('./pages/Checkout.js'));
const AdminDebug = lazy(() => import('./pages/AdminDebug.js'));
const EcosystemAdmin = lazy(() => import('./pages/EcosystemAdmin.js').then(module => ({ default: module.EcosystemAdmin })));

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#2B85EB]/30 border-t-[#2B85EB] animate-spin" />
    </div>
  );
}

function GlobalTelemetry() {
  const { user, profile } = useAuth();
  
  useEffect(() => {
    if (user && profile?.organizationId) {
      telemetry.initialize(user.uid, profile.organizationId);
      performanceEngine.initialize(user.uid, profile.organizationId);
      
      return () => {
        telemetry.teardown();
        performanceEngine.teardown();
      };
    }
  }, [user, profile?.organizationId]);

  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18nEngine}>
        <AuthProvider>
          <OrganizationProvider>
            <GlobalTelemetry />
            <Toaster position="top-right" toastOptions={{ className: 'bg-[#0B0F19] text-white border border-white/10' }} />
            <BrowserRouter>
              <CommandPalette />
              <SmartResume />
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/join/:orgId" element={<Join />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/dashboard/:tab" element={<Dashboard />} />
                <Route path="/dashboard/:tab/:subTab" element={<Dashboard />} />
                <Route path="/admin/debug/organization" element={<AdminDebug />} />
                <Route path="/admin/ecosystem" element={<EcosystemAdmin />} />
                <Route path="/upgrade" element={<Checkout />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/termos-de-uso" element={<Terms />} />
                <Route path="/politica-de-privacidade" element={<Privacy />} />
                <Route path="/politicas-de-reembolso" element={<Refunds />} />
                <Route path="/politicas-de-cancelamento" element={<Cancellation />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </OrganizationProvider>
      </AuthProvider>
    </I18nextProvider>
    </ErrorBoundary>
  );
}
