/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Terms } from './pages/Terms';
import { Privacy } from './pages/Privacy';
import { Refunds } from './pages/Refunds';
import { Cancellation } from './pages/Cancellation';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/termos-de-uso" element={<Terms />} />
        <Route path="/politica-de-privacidade" element={<Privacy />} />
        <Route path="/politicas-de-reembolso" element={<Refunds />} />
        <Route path="/politicas-de-cancelamento" element={<Cancellation />} />
      </Routes>
    </BrowserRouter>
  );
}
