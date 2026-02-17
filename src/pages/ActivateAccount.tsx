import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { verifyActivationIdentity, finalizePasswordSetup, logSystemEvent } from '../services/firebase';
import { validatePasswordStrength } from '../utils/passwordUtils';
import { ShieldCheck, Lock, User, CheckCircle2, AlertTriangle } from 'lucide-react';

const ActivateAccount = () => {
    const [step, setStep] = useState(1);
    const [username, setUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [tempPasswordInput, setTempPasswordInput] = useState('');
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
            const trimmedTemp = tempPasswordInput.trim();

            if (!trimmedUsername) throw new Error("Please enter your username");
            if (!trimmedTemp) throw new Error("Please enter your temporary password");

            // Stage 1 Verification
            const data = await verifyActivationIdentity(trimmedUsername, trimmedTemp);
            setUserData(data);
            setStep(2);
        } catch (err: any) {
            console.error("Verification Error:", err);
            setError(err.message || "Identity verification failed.");
        } finally {
            setLoading(false);
        }
    };

    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedPassword = newPassword.trim();
        const trimmedConfirm = confirmPassword.trim();
        const trimmedTemp = tempPasswordInput.trim();

        // 1. Validations
        if (trimmedPassword !== trimmedConfirm) {
            setError("Passwords do not match");
            return;
        }

        const strength = validatePasswordStrength(trimmedPassword);
        if (!strength.isValid) {
            setError(strength.error || "Password is too weak");
            return;
        }

        if (trimmedPassword === trimmedTemp) {
            setError("New password cannot be the same as your temporary password");
            return;
        }

        setLoading(true);
        setError('');
        try {
            console.log("Stage 2: Finalizing password for", userData.email);

            // 2. Authenticate with Temp Password to allow update
            let userToUpdate = auth.currentUser;

            // Force sign-in to ensure we have credentials to change password
            try {
                const userCred = await signInWithEmailAndPassword(auth, userData.email, trimmedTemp);
                userToUpdate = userCred.user;
            } catch (authErr: any) {
                console.error("Stage 2: Auth Error", authErr);
                throw new Error("Could not authenticate session. Please try restarting the process.");
            }

            // 3. Update Auth Password
            if (!userToUpdate) throw new Error("No active session found.");
            await updatePassword(userToUpdate, trimmedPassword);
            console.log("Stage 2: Auth password updated");

            // 4. Update Firestore Profile
            await finalizePasswordSetup(userData.uid);
            console.log("Stage 2: Firestore records updated");

            // 5. Audit Log (Specific Event)
            await logSystemEvent(
                { type: 'PASSWORD_RESET_COMPLETED', category: 'AUTH' },
                { id: userData.uid, type: 'USER', metadata: { username: userData.username } },
                'SUCCESS',
                userData.type === 'INITIAL' ? 'Initial account password established' : 'Account password renewed'
            );

            setStep(3);
        } catch (err: any) {
            console.error("Activation Final Step Error:", err);
            setError(err.message || "An unexpected error occurred during password setup.");

            await logSystemEvent(
                { type: 'PASSWORD_SETUP_FAILED', category: 'AUTH' },
                { id: userData?.uid || 'N/A', type: 'USER' },
                'FAILURE',
                `Final setup failed: ${err.message}`
            );
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

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem' }}>Temporary Password</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><Lock size={18} /></span>
                                <input
                                    type="text"
                                    placeholder="Enter secret code from Admin"
                                    style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid #cbd5e1', outline: 'none' }}
                                    value={tempPasswordInput}
                                    onChange={e => setTempPasswordInput(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                            {loading ? "Verifying..." : "Verify Identity"}
                        </button>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={handleActivate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ padding: '1rem', background: '#ecfdf5', border: '1px solid #d1fae5', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: '#065f46', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <CheckCircle2 size={20} />
                            <div>
                                <strong>Identity Verified</strong>
                                <p style={{ margin: 0, opacity: 0.8 }}>Logged in as: {userData?.email}</p>
                            </div>
                        </div>

                        <div style={{ padding: '0.75rem', background: '#eff6ff', borderRadius: '8px', border: '1px solid #dbeafe', fontSize: '0.8rem', color: '#1e40af' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px', fontWeight: '800' }}>
                                <AlertTriangle size={14} /> Password Rules:
                            </div>
                            • Min 8 characters<br />
                            • Must contain uppercase & lowercase<br />
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
        </div >
    );
};

export default ActivateAccount;
