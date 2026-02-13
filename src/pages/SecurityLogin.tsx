import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

const SecurityLogin = () => {
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

        const cleanUsername = username.trim();
        let email = '';

        try {
            const { query, where, getDocs, collection } = await import('firebase/firestore');
            const q = query(collection(db, "users"), where("username", "==", cleanUsername));
            const snap = await getDocs(q);
            if (snap.empty) {
                throw new Error("USER_NOT_FOUND");
            }
            email = snap.docs[0].data().email;

            await signInWithEmailAndPassword(auth, email, password);
            navigate('/dashboard/security');
        } catch (err: any) {
            console.error("Login Error:", err.code, err.message);
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
                            {loading ? 'Authenticating...' : 'COMMENCE WATCH'}
                        </button>
                    </form>

                    <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                        <button
                            onClick={() => navigate('/activate')}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            New account? Set password
                        </button>
                    </div>
                </div>
            </div>
            <p style={{ marginTop: '2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                System Access Requires Authorized Credentials
            </p>
        </div>
    );
};

export default SecurityLogin;
