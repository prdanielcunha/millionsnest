/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home.js';
import { Terms } from './pages/Terms.js';
import { Privacy } from './pages/Privacy.js';
import { Refunds } from './pages/Refunds.js';
import { Cancellation } from './pages/Cancellation.js';
import { AuthProvider } from './contexts/AuthContext.js';
import { Login } from './pages/Login.js';

import { Dashboard } from './pages/Dashboard.js';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/termos-de-uso" element={<Terms />} />
          <Route path="/politica-de-privacidade" element={<Privacy />} />
          <Route path="/politicas-de-reembolso" element={<Refunds />} />
          <Route path="/politicas-de-cancelamento" element={<Cancellation />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
