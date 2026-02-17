import React, { useState } from 'react';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth, db, logSystemEvent } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

const ITLogin = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Check if user is already logged in
    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                navigate('/dashboard/it');
            }
        });
        return () => unsubscribe();
    }, [navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const cleanUsername = username.trim();
        const isAdminShortcut = cleanUsername.toLowerCase() === 'admin';
        let email = '';

        try {
            // 1. Handle Admin Shortcut directly to bypass permission issues
            if (isAdminShortcut) {
                email = 'admin@minet.com';
            } else {
                // For other users, we MUST lookup the email in Firestore
                const { query, where, getDocs, collection } = await import('firebase/firestore');
                const q = query(collection(db, "users"), where("username", "==", cleanUsername));
                const snap = await getDocs(q);

                if (!snap.empty) {
                    const userData = snap.docs[0].data();
                    email = userData.email;
                    if (!userData.isActive) throw new Error("ACCOUNT_DISABLED");
                } else {
                    throw new Error("USER_NOT_FOUND");
                }
            }

            const userCredential = await signInWithEmailAndPassword(auth, email, password);

            // Fetch latest user data to check flags
            const { getDoc, doc } = await import('firebase/firestore');
            const userRef = doc(db, "users", userCredential.user.uid);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.data();

            if (userData && (userData.mustSetPassword || userData.passwordResetRequired)) {
                // Redirect to activation/renewal flow
                navigate(`/activate?username=${userData.username}`);
                return;
            }

            // Healing: Ensure the 'Admin' user document exists and has the 'superadmin' role
            if (isAdminShortcut) {
                const { setDoc, serverTimestamp } = await import('firebase/firestore');
                // Use UID for the document ID, NOT the email
                // Update or create the profile with correct role and UID mapping
                await setDoc(userRef, {
                    uid: userCredential.user.uid,
                    username: 'Admin',
                    name: 'System Super Admin',
                    email: email,
                    role: 'superadmin',
                    isActive: true,
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }

            await logSystemEvent(
                { type: 'LOGIN', category: 'AUTH' },
                { id: userCredential.user.uid, type: 'USER', metadata: { email } },
                'SUCCESS',
                'IT Admin Portal Login'
            );

            navigate('/dashboard/it');
        } catch (err: any) {
            console.error("Login Check:", err.code, err.message);

            await logSystemEvent(
                { type: 'LOGIN', category: 'AUTH' },
                { id: 'unknown', type: 'USER', metadata: { username: cleanUsername } },
                'FAILURE',
                `Login failed: ${err.message}`
            );
            if (err.message === "ACCOUNT_DISABLED") {
                setError('This account has been deactivated. Please contact support.');
            } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError('Invalid password. Please check your credentials.');
            } else if (err.code === 'auth/user-not-found') {
                setError('Staff account not found. Please contact the Super Admin.');
            } else {
                setError(err.message || 'Invalid username or password.');
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

                    <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <button
                            onClick={() => navigate('/activate')}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            Set up / Renew password
                        </button>

                        <button
                            onClick={async () => {
                                if (confirm("Initialize Superadmin credentials? This is only for first-time setup or recovery.")) {
                                    setLoading(true);
                                    try {
                                        // @ts-ignore
                                        const { bootstrapAdmin } = await import('../utils/seedData');
                                        await bootstrapAdmin();
                                        alert("System admin initialized. Try logging in now.");
                                    } catch (e: any) {
                                        alert(e.message);
                                    } finally {
                                        setLoading(false);
                                    }
                                }
                            }}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.7rem', cursor: 'pointer' }}
                        >
                            Initial setup / Restore Admin
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

export default ITLogin;
