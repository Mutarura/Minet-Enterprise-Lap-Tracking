import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { activateUserAccount, addAuditLog } from '../services/firebase';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { ShieldCheck, Lock, User, CheckCircle2 } from 'lucide-react';

const ActivateAccount = () => {
    const [step, setStep] = useState(1);
    const [username, setUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [userData, setUserData] = useState<any>(null);
    const navigate = useNavigate();

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const data = await activateUserAccount(username);
            setUserData(data);
            setStep(2);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        if (newPassword.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        setLoading(true);
        setError('');
        try {
            // 1. Sign in with temp password
            const userCred = await signInWithEmailAndPassword(auth, userData.email, userData.tempPassword);

            // 2. Update password
            await updatePassword(userCred.user, newPassword);

            // 3. Update Firestore profile
            const userRef = doc(db, "users", userData.uid);
            await updateDoc(userRef, {
                mustChangePassword: false,
                tempPassword: deleteField() // Remove the temp password after activation
            });

            // 4. Audit Log
            await addAuditLog("ACTIVATE_ACCOUNT", userData.uid, { username });

            setStep(3);
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div className="glass-card" style={{ maxWidth: '450px', width: '100%', padding: '2.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(226, 26, 34, 0.05)', borderRadius: '1rem', color: 'var(--primary)', marginBottom: '1rem' }}>
                        <ShieldCheck size={40} />
                    </div>
                    <h1 style={{ fontSize: '1.75rem', color: 'var(--secondary)', marginBottom: '0.5rem' }}>Account Activation</h1>
                    <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
                        {step === 1 ? "Enter your username to set up your account" : step === 2 ? "Specify a new password for your account" : "Success!"}
                    </p>
                </div>

                {error && (
                    <div style={{ background: '#fee2e2', color: 'var(--danger)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                        {error}
                    </div>
                )}

                {step === 1 && (
                    <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ position: 'relative' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem' }}>Username</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><User size={18} /></span>
                                <input
                                    type="text"
                                    placeholder="e.g. MutaruraR"
                                    style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid #cbd5e1', outline: 'none' }}
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                            {loading ? "Verifying..." : "Continue"}
                        </button>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={handleActivate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
                        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                            {loading ? "Saving..." : "Set Password & Activate"}
                        </button>
                    </form>
                )}

                {step === 3 && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#10b981', marginBottom: '1.5rem' }}>
                            <CheckCircle2 size={64} style={{ margin: '0 auto' }} />
                        </div>
                        <p style={{ color: '#475569', fontWeight: '600', marginBottom: '2rem' }}>Your account is now active!</p>
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
