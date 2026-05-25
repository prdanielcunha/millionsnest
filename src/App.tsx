/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider } from './contexts/AuthContext.js';

const Home = lazy(() => import('./pages/Home.js').then(module => ({ default: module.Home })));
const Terms = lazy(() => import('./pages/Terms.js').then(module => ({ default: module.Terms })));
const Privacy = lazy(() => import('./pages/Privacy.js').then(module => ({ default: module.Privacy })));
const Refunds = lazy(() => import('./pages/Refunds.js').then(module => ({ default: module.Refunds })));
const Cancellation = lazy(() => import('./pages/Cancellation.js').then(module => ({ default: module.Cancellation })));
const Login = lazy(() => import('./pages/Login.js').then(module => ({ default: module.Login })));
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
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
    </AuthProvider>
  );
}
