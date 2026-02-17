import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { activateUserAccount, addAuditLog } from '../services/firebase';
import { doc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
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

    useEffect(() => {
        // Auto-fill username if provided in URL
        const params = new URLSearchParams(window.location.search);
        const urlUsername = params.get('username');
        if (urlUsername) {
            setUsername(urlUsername);
        }

        // If the user is ALREADY logged in (likely from the login page redirect), 
        // we check if they match the account being activated.
        // We do NOT call signOut here anymore to support the Login -> Activate flow.
    }, []);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const trimmedUsername = username.trim();
            if (!trimmedUsername) throw new Error("Please enter a username");

            const data = await activateUserAccount(trimmedUsername);
            setUserData(data);
            setStep(2);
        } catch (err: any) {
            console.error("Verification Error:", err);
            setError(err.message || "Username verification failed.");
        } finally {
            setLoading(false);
        }
    };

    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedPassword = newPassword.trim();
        const trimmedConfirm = confirmPassword.trim();

        if (trimmedPassword !== trimmedConfirm) {
            setError("Passwords do not match");
            return;
        }
        if (trimmedPassword.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        setLoading(true);
        setError('');
        try {
            console.log("Attempting activation for:", userData.email);

            let userToUpdate = auth.currentUser;

            // 1. Sign in ONLY if not already logged in as the target user
            const targetEmail = userData.email.trim();
            const targetTempPassword = userData.tempPassword.trim();

            if (!userToUpdate || userToUpdate.email?.toLowerCase() !== targetEmail.toLowerCase()) {
                console.log("Activation: Authenticating with temporary credentials...");
                try {
                    const userCred = await signInWithEmailAndPassword(auth, targetEmail, targetTempPassword);
                    userToUpdate = userCred.user;
                } catch (authErr: any) {
                    console.error("Activation: Auth Error", authErr.code, authErr.message);
                    if (authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/wrong-password') {
                        throw new Error("Activation failed: The temporary password does not match. Please ensure you haven't already activated or contact your Admin for a fresh account.");
                    }
                    throw authErr;
                }
            } else {
                console.log("Activation: Using existing session for", userToUpdate.email);
            }

            // 2. Update password
            if (!userToUpdate) throw new Error("Security Error: No active user session.");

            try {
                await updatePassword(userToUpdate, trimmedPassword);
                console.log("Activation: Password updated successfully");
            } catch (pError: any) {
                console.error("Activation: Password update error", pError);
                if (pError.code === 'auth/requires-recent-login') {
                    throw new Error("Security Timeout: Please log out and log back in with your temporary password, then try again.");
                }
                throw pError;
            }

            // 3. Update Firestore profile
            try {
                const userRef = doc(db, "users", userData.uid);
                await updateDoc(userRef, {
                    mustChangePassword: false,
                    tempPassword: deleteField(),
                    updatedAt: serverTimestamp(),
                    lastLogin: serverTimestamp()
                });
                console.log("Activation: Firestore profile updated");
            } catch (fsError: any) {
                console.error("Activation: Firestore Update Error", fsError);
                throw new Error(`Profile update failed: ${fsError.message || "Permission Denied"}`);
            }

            // 4. Audit Log
            try {
                await addAuditLog("ACTIVATE_ACCOUNT", userData.uid, { username: username.trim() });
                console.log("Activation: Audit log added");
            } catch (alError) {
                console.warn("Activation: Audit log failed (non-critical)", alError);
            }

            setStep(3);
        } catch (err: any) {
            console.error("Activation Final Step Error:", err.code || 'unknown', err.message);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
                setError(`Credential Mismatch: The temporary password for ${userData?.email} is incorrect. This happens if the account was 'Reset' without being deleted. Please ask your Admin to DELETE and RE-CREATE your account.`);
            } else {
                setError(err.message || "An unexpected error occurred during activation.");
            }
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
                        {step === 1 ? "Enter your username to set up your account" : step === 2 ? `Setting up: ${userData?.email}` : "Success!"}
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
