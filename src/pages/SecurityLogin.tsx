import React, { useState } from 'react';
import { loginUser, logSystemEvent } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

const SecurityLogin = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    const [loading, setLoading] = useState(false);
    const [showForgot, setShowForgot] = useState(false);
    const [forgotUsername, setForgotUsername] = useState('');
    const [forgotStatus, setForgotStatus] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const navigate = useNavigate();

    const handleForgotPassword = async () => {
    if (!forgotUsername.trim()) { setForgotStatus('Please enter your username.'); return; }
    setForgotLoading(true);
    setForgotStatus('');
    try {
        const res = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: forgotUsername.trim() })
        });
        const data = await res.json();
        if (!res.ok) {
            setForgotStatus(data.error || 'Something went wrong.');
        } else {
            setForgotStatus(data.message || 'Reset link sent.');
        }
    } catch {
        setForgotStatus('Something went wrong. Please try again.');
    } finally {
        setForgotLoading(false);
    }
};
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const cleanUsername = username.trim();

        try {
            await loginUser(cleanUsername, password);

            await logSystemEvent(
                { type: 'LOGIN', category: 'AUTH' },
                { id: cleanUsername, type: 'USER', metadata: { username: cleanUsername } },
                'SUCCESS',
                'Security Portal Login'
            );

            const loggedInUser = JSON.parse(localStorage.getItem('minet_user') || '{}');
            if (loggedInUser.role === 'head_security') {
                navigate('/dashboard/security-admin');
            } else {
                navigate('/dashboard/security');
            }
        } catch (err: any) {
    try {
        await logSystemEvent(
            { type: 'LOGIN', category: 'AUTH' },
            { id: 'unknown', type: 'USER', metadata: { username: cleanUsername } },
            'FAILURE',
            `Login failed: ${err.message}`
        );
    } catch (_) {}

            if (err.message === 'ACCOUNT_DISABLED') {
                setError('This account has been deactivated. Please contact support.');
            } else if (err.message === 'USER_NOT_FOUND') {
                setError('Account not found. Please contact your administrator.');
            } else {
                setError('Invalid username or password.');
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
            padding: '1.5rem'
        }}>
            <div style={{ maxWidth: '450px', width: '100%' }}>
                <button
                    onClick={() => navigate('/')}
                    style={{
                        background: 'none',
                        border: '1px solid #cbd5e1',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.5rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color: 'var(--text-muted)',
                        marginBottom: '2rem',
                        cursor: 'pointer',
                        fontWeight: '500'
                    }}
                >
                    <ArrowLeft size={18} /> Back
                </button>

                <div className="glass-card" style={{ padding: '2.5rem', width: '100%' }}>
                    <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                            <img src="/tracker/logo.png" style={{ width: '120px', height: 'auto' }} alt="Minet Logo" />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--secondary)', fontWeight: '700' }}>Security Portal</h2>
                    </div>

                    {error && (
                        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '4px', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)' }}>Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                required
                                autoComplete="off"
                                data-lpignore="true"
                                placeholder="Username"
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)' }}>Password</label>
                            <div style={{ position: 'relative', width: '100%' }}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                    style={{ paddingRight: '3rem' }}
                                    placeholder="Password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '0.75rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading}
                            style={{ height: '3.25rem', marginTop: '1rem', width: '100%', background: 'var(--secondary)' }}
                        >
                            {loading ? 'Authenticating...' : 'Log in to Dashboard'}
                        </button>
                    </form>
                    <button
                        type="button"
                        onClick={() => { setShowForgot(true); setForgotStatus(''); setForgotUsername(''); }}
                        style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.85rem', marginTop: '1rem', cursor: 'pointer', textDecoration: 'underline', width: '100%', textAlign: 'center' }}
                    >
                        Forgot password?
                    </button>
                </div>
            </div>
            <p style={{ marginTop: '2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                System Access Requires Authorized Credentials
            </p>
        
          {showForgot && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                <div style={{ background: 'white', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <h3 style={{ margin: 0, color: '#1e293b' }}>Reset Password</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Enter your username and we will send a reset link to your registered email address.</p>
                    <input
                        type="text"
                        placeholder="Your username"
                        value={forgotUsername}
                        onChange={e => setForgotUsername(e.target.value)}
                        style={{ padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                    />
                    {forgotStatus && (
                        <p style={{ margin: 0, fontSize: '0.85rem', color: forgotStatus.includes('sent') ? '#166634' : '#b91c1c', background: forgotStatus.includes('sent') ? '#dcfce7' : '#fee2e2', padding: '0.75rem', borderRadius: '6px' }}>
                            {forgotStatus}
                        </p>
                    )}
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            onClick={() => setShowForgot(false)}
                            style={{ flex: 1, padding: '0.75rem', background: '#f1f5f9', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', color: '#475569' }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleForgotPassword}
                            disabled={forgotLoading}
                            style={{ flex: 1, padding: '0.75rem', background: '#1e293b', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: forgotLoading ? 'not-allowed' : 'pointer', opacity: forgotLoading ? 0.7 : 1 }}
                        >
                            {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                    </div>
                </div>
            </div>
                
        )}
        </div>
    );
};

export default SecurityLogin;
