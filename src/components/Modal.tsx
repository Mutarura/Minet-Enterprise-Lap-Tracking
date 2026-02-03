import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
        }}>
            <div className="glass-card modal-content" style={{
                width: '100%',
                maxWidth: '600px',
                maxHeight: '90vh',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1.5rem',
                    borderBottom: '1px solid rgba(0,0,0,0.05)',
                    background: 'rgba(255,255,255,0.5)'
                }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--secondary)', fontWeight: '700' }}>{title}</h2>
                    <button onClick={onClose} style={{
                        background: '#f1f5f9',
                        border: 'none',
                        padding: '0.4rem',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        color: '#64748b'
                    }}>
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-inner-content" style={{ padding: '2rem' }}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
