import React, { useState } from 'react';
import { loginUser } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

const Login = () => {
    const [mode, setMode] = useState<'security' | 'admin'>('security');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const user = await loginUser(username.trim(), password);

            // Role check — make sure they're logging into the right portal
            const expectedRole = mode === 'admin' ? ['admin', 'superadmin'] : ['security'];
            if (!expectedRole.includes(user.role)) {
                localStorage.removeItem('minet_token');
                localStorage.removeItem('minet_user');
                setError(`This account is registered as ${user.role}, not ${mode}.`);
                return;
            }

            navigate(mode === 'admin' ? '/dashboard/it' : '/dashboard/security');
        } catch (err: any) {
            if (err.message === 'ACCOUNT_DISABLED') {
                setError('This account has been deactivated. Please contact support.');
            } else if (err.message === 'USER_NOT_FOUND') {
                setError('Account not found. Please contact your administrator.');
            } else if (err.message === 'INVALID_PASSWORD') {
                setError('Invalid username or password.');
            } else {
                setError(err.message || 'Authentication failed.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
        }}>
            {/* Branded Header */}
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <img src="/logo.png" style={{ width: '120px', height: 'auto', marginBottom: '1rem' }} alt="Minet Logo" />
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--secondary)', fontWeight: '600', letterSpacing: '1px', fontStyle: 'italic' }}>
                    Risk. Reinsurance. People
                </div>
            </div>

            {/* Login Card */}
            <div className="glass-card" style={{ maxWidth: '450px', width: '100%', padding: '3rem' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '2rem', fontSize: '1.75rem', color: 'var(--secondary)' }}>
                    {mode === 'security' ? 'Security Login' : 'IT Admin Login'}
                </h2>

                {error && (
                    <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center', border: '1px solid #fecaca' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)' }}>Username</label>
                        <input
                            type="text"
                            placeholder={mode === 'security' ? 'e.g. jdoe.security' : 'e.g. jdoe.admin'}
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase())}
                            required
                            autoComplete="off"
                            data-lpignore="true"
                            spellCheck="false"
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)' }}>Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="new-password"
                                data-lpignore="true"
                                style={{ paddingRight: '3rem' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0' }}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '0.5rem', height: '3.25rem' }}>
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                </form>

                <div style={{ marginTop: '2.5rem', textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        {mode === 'security' ? 'Need to manage the system?' : 'Back to physical check-in?'}
                    </p>
                    <button
                        type="button"
                        onClick={() => { setMode(mode === 'security' ? 'admin' : 'security'); setError(''); setUsername(''); setPassword(''); }}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', fontSize: '1rem', marginTop: '0.5rem', textDecoration: 'underline', width: 'auto', margin: '0.5rem auto 0' }}
                    >
                        {mode === 'security' ? 'Switch to IT Admin Access' : 'Switch to Security Access'}
                    </button>
                </div>
            </div>

            <div style={{ marginTop: '4rem', color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>
                © {new Date().getFullYear()} Minet Group. All rights reserved.<br />
                Enterprise Laptop Tracking System v1.0
            </div>
        </div>
    );
};

export default Login;