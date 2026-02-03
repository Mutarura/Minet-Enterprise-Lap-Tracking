// @ts-ignore
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Laptop } from 'lucide-react';

const LandingPage = () => {
    const navigate = useNavigate();

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
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <img src="/logo.png" alt="Minet Logo" style={{ width: '140px', height: 'auto', marginBottom: '1rem' }} />
                </div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--secondary)', marginTop: '0.5rem', fontStyle: 'italic' }}>
                    Risk. Reinsurance. People
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '1.5rem', fontWeight: '500' }}>
                    Enterprise Laptop Tracking System
                </p>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '2.5rem',
                width: '100%',
                maxWidth: '800px'
            }}>
                {/* IT / Admin Card */}
                <div
                    onClick={() => navigate('/login/it')}
                    className="portal-card"
                    style={{
                        background: 'white',
                        padding: '3.5rem 2rem',
                        borderRadius: 'var(--radius-lg)',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: 'var(--shadow-lg)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1.5rem',
                        border: '1px solid rgba(0,0,0,0.05)'
                    }}
                >
                    <div style={{ background: 'rgba(226, 26, 34, 0.1)', padding: '1.5rem', borderRadius: '50%' }}>
                        <Laptop size={48} color="var(--primary)" />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--secondary)', marginBottom: '0.5rem' }}>IT / Admin</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Personnel management & device inventory</p>
                    </div>
                </div>

                {/* Security Card */}
                <div
                    onClick={() => navigate('/login/security')}
                    className="portal-card"
                    style={{
                        background: 'white',
                        padding: '3.5rem 2rem',
                        borderRadius: 'var(--radius-lg)',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: 'var(--shadow-lg)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1.5rem',
                        border: '1px solid rgba(0,0,0,0.05)'
                    }}
                >
                    <div style={{ background: 'rgba(0,0,0,0.05)', padding: '1.5rem', borderRadius: '50%' }}>
                        <ShieldCheck size={48} color="var(--secondary)" />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--secondary)', marginBottom: '0.5rem' }}>Security</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Checkpoint scanning & activity logs</p>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                © {new Date().getFullYear()} Minet Group. Authorized Personnel Only.
            </div>

            <style>{`
                .portal-card:hover {
                    transform: translateY(-10px);
                    box-shadow: var(--shadow-xl) !important;
                }
            `}</style>
        </div>
    );
};

export default LandingPage;
