import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/:outletSlug/t/:qrUid" element={<App />} />
        <Route path="*" element={<Navigate to="/raasta/t/tbl-001" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
