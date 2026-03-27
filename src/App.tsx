// @ts-nocheck
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import SecurityDashboard from './pages/SecurityDashboard';
import { getToken, getUser } from './services/api';
import './index.css';

import LandingPage from './pages/LandingPage';
import ITLogin from './pages/ITLogin';
import SecurityLogin from './pages/SecurityLogin';
import PrintLabel from './pages/PrintLabel';
import ActivateAccount from './pages/ActivateAccount';

const ProtectedRoute = ({ children, role }: { children: React.ReactNode, role: 'admin' | 'security' }) => {
  const token = getToken();
  const user = getUser();

  if (!token || !user) {
    const loginPath = role === 'security' ? '/login/security' : '/login/it';
    return <Navigate to={loginPath} replace />;
  }

  if (user.mustChangePassword) {
    return <Navigate to="/activate" replace />;
  }

  if (user.isActive === false) {
    return (
      <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>
        <h2>Account Disabled</h2>
        <p>Your account has been deactivated. Please contact the administrator.</p>
        <button onClick={() => { localStorage.removeItem('minet_token'); localStorage.removeItem('minet_user'); window.location.href = '/tracker/'; }} className="btn-primary" style={{ marginTop: '1rem' }}>Logout</button>
      </div>
    );
  }

  const hasAccess =
    (role === 'admin' && (user.role === 'superadmin' || user.role === 'admin')) ||
    (role === 'security' && user.role === 'security');

  if (!hasAccess) {
    return (
      <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>
        <h2>Unauthorized Access</h2>
        <p>Your account does not have {role} privileges.</p>
        <Link to="/" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>Return to Portal Selection</Link>
      </div>
    );
  }

  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login/it" element={<ITLogin />} />
        <Route path="/login/security" element={<SecurityLogin />} />
        <Route path="/dashboard/it" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/security" element={<ProtectedRoute role="security"><SecurityDashboard /></ProtectedRoute>} />
        <Route path="/print-label" element={<PrintLabel />} />
        <Route path="/activate" element={<ActivateAccount />} />
        <Route path="/admin" element={<Navigate to="/dashboard/it" replace />} />
        <Route path="/security" element={<Navigate to="/dashboard/security" replace />} />
      </Routes>
    </Router>
  );
}

export default App;