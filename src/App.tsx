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
import PrintLabel from './pages/PrintLabel';
import ActivateAccount from './pages/ActivateAccount';

const ProtectedRoute = ({ children, role }: { children: React.ReactNode, role: 'admin' | 'security' | 'superadmin' }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserRole(data.role);
            setIsActive(data.isActive !== false);

            // Update last login
            const { serverTimestamp, updateDoc, doc } = await import('firebase/firestore');
            await updateDoc(doc(db, "users", currentUser.uid), {
              lastLogin: serverTimestamp()
            });
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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc', textAlign: 'center', padding: '2rem' }}>
      <p style={{ fontWeight: '600', color: 'var(--text-muted)', fontSize: '1.1rem' }}>We are getting your Dashboard ready for you. 😊</p>
    </div>
  );

  if (!user) {
    const loginPath = (role === 'security') ? '/login/security' : '/login/it';
    return <Navigate to={loginPath} replace />;
  }

  if (!isActive) {
    return (
      <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>
        <h2>Account Disabled</h2>
        <p>Your account has been deactivated. Please contact the administrator.</p>
        <button onClick={() => auth.signOut()} className="btn-primary" style={{ marginTop: '1rem' }}>Logout</button>
      </div>
    );
  }

  // Strict Role separation:
  // - superadmin can access 'admin' (SuperAdmin Dashboard)
  // - admin can access 'admin' (Restricted IT Dashboard)
  // - security can access 'security' (Security Dashboard)
  const hasAccess =
    (role === 'admin' && (userRole === 'superadmin' || userRole === 'admin')) ||
    (role === 'security' && userRole === 'security');

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
        {/* Fill in legacy routes for redirection if needed, or remove them */}
        <Route path="/admin" element={<Link to="/dashboard/it" replace />} />
        <Route path="/security" element={<Link to="/dashboard/security" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
