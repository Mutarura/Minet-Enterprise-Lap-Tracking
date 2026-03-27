import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { validatePasswordStrength } from '../utils/passwordUtils';
import { ShieldCheck, Lock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

const ActivateAccount = () => {
    const [step, setStep] = useState<'loading' | 'form' | 'success' | 'invalid'>('loading');
    const [token, setToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');
        if (urlToken) {
            setToken(urlToken);
            setStep('form');
        } else {
            setStep('invalid');
        }
    }, []);

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedPassword = newPassword.trim();
        const trimmedConfirm = confirmPassword.trim();

        if (trimmedPassword !== trimmedConfirm) {
            setError("Passwords do not match.");
            return;
        }

        const strength = validatePasswordStrength(trimmedPassword);
        if (!strength.isValid) {
            setError(strength.error || "Password is too weak.");
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/users/set-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password: trimmedPassword })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to set password.');
            }

            setStep('success');
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div className="glass-card" style={{ maxWidth: '450px', width: '100%', padding: '2.5rem' }}>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(226, 26, 34, 0.05)', borderRadius: '1rem', color: 'var(--primary)', marginBottom: '1rem' }}>
                        <ShieldCheck size={40} />
                    </div>
                    <h1 style={{ fontSize: '1.75rem', color: 'var(--secondary)', marginBottom: '0.5rem' }}>
                        {step === 'loading' && 'Please wait...'}
                        {step === 'form' && 'Set Your Password'}
                        {step === 'success' && 'Password Set!'}
                        {step === 'invalid' && 'Invalid Link'}
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
                        {step === 'form' && 'Choose a strong password to activate your account.'}
                        {step === 'success' && 'Your account is now active. You can log in.'}
                        {step === 'invalid' && 'This link is missing a token. Please use the link from your email.'}
                    </p>
                </div>

                {/* Loading */}
                {step === 'loading' && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                        Verifying your link...
                    </div>
                )}

                {/* Invalid */}
                {step === 'invalid' && (
                    <div style={{ textAlign: 'center' }}>
                        <XCircle size={48} color="var(--danger)" style={{ margin: '0 auto 1rem' }} />
                        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
                            Please check your email and click the link provided, or contact your administrator to resend the invitation.
                        </p>
                        <button onClick={() => navigate('/')} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                            Back to Login
                        </button>
                    </div>
                )}

                {/* Form */}
                {step === 'form' && (
                    <form onSubmit={handleSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {error && (
                            <div style={{ background: '#fee2e2', color: 'var(--danger)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem', textAlign: 'center' }}>
                                {error}
                            </div>
                        )}

                        <div style={{ padding: '0.75rem', background: '#eff6ff', borderRadius: '8px', border: '1px solid #dbeafe', fontSize: '0.8rem', color: '#1e40af' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px', fontWeight: '800' }}>
                                <AlertTriangle size={14} /> Password Requirements:
                            </div>
                            • Minimum 8 characters<br />
                            • Must contain uppercase & lowercase letters<br />
                            • Must contain at least one number
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem' }}>New Password</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><Lock size={18} /></span>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid #cbd5e1', outline: 'none' }}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem' }}>Confirm Password</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><Lock size={18} /></span>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid #cbd5e1', outline: 'none' }}
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', height: '3rem' }}>
                            {loading ? 'Setting Password...' : 'Set Password & Activate'}
                        </button>
                    </form>
                )}

                {/* Success */}
                {step === 'success' && (
                    <div style={{ textAlign: 'center' }}>
                        <CheckCircle2 size={64} color="#10b981" style={{ margin: '0 auto 1.5rem' }} />
                        <p style={{ color: '#475569', fontWeight: '600', marginBottom: '2rem' }}>
                            Your password has been set successfully. You can now log in with your username and new password.
                        </p>
                        <button onClick={() => navigate('/')} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                            Go to Login
                        </button>
                    </div>
                )}

                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                    <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer' }}>
                        Back to Landing Page
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ActivateAccount;