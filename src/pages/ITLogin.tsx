import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

const ITLogin = () => {
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

        const cleanUsername = username.trim().toLowerCase();
        // Professional fallback: Map 'admin' username to core email directly
        const email = cleanUsername === 'admin' ? 'admin@minet.com' : `${cleanUsername}@minet.com`;

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);

            // Self-Healing: Ensure the Firestore role document exists for this default account
            const userDocRef = doc(db, "users", userCredential.user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (!userDocSnap.exists()) {
                console.log("Healing missing admin record...");
                await setDoc(userDocRef, {
                    username: 'admin',
                    email: 'admin@minet.com',
                    role: 'admin',
                    createdAt: Timestamp.now()
                });
            }

            navigate('/dashboard/it');
        } catch (err: any) {
            console.error("Login Check:", err.code, err.message);
            setError('Invalid username or password.');
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
                            <img src="/logo.png" style={{ width: '120px', height: 'auto' }} alt="Minet Logo" />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--secondary)', fontWeight: '700' }}>IT Admin Portal</h2>
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

                        <button type="submit" className="btn-primary" disabled={loading} style={{ height: '3.25rem', marginTop: '1rem', width: '100%' }}>
                            {loading ? 'Verifying...' : 'LOGIN TO INVENTORY'}
                        </button>
                    </form>
                </div>
            </div>
            <p style={{ marginTop: '2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                System Access Requires Authorized Credentials
            </p>
        </div>
    );
};

export default ITLogin;
