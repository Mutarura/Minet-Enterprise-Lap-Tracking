// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { BookOpen, ShieldCheck } from 'lucide-react';
import AdminDashboard from './pages/AdminDashboard';
import SecurityDashboard from './pages/SecurityDashboard';
import Login from './pages/Login';
import { seedDatabase } from './utils/seedData';
import './index.css';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

import LandingPage from './pages/LandingPage';
import ITLogin from './pages/ITLogin';
import SecurityLogin from './pages/SecurityLogin';

const ProtectedRoute = ({ children, role }: { children: React.ReactNode, role: 'admin' | 'security' }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role);
          }
        } catch (e) {
          console.error("Error fetching role", e);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Authenticating...</p>
    </div>
  );

  if (!user) {
    // Correctly redirect to the specific login page using Navigate
    const loginPath = role === 'admin' ? '/login/it' : '/login/security';
    return <Navigate to={loginPath} replace />;
  }

  if (userRole !== role) {
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
        {/* Fill in legacy routes for redirection if needed, or remove them */}
        <Route path="/admin" element={<Link to="/dashboard/it" replace />} />
        <Route path="/security" element={<Link to="/dashboard/security" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
