// @ts-ignore
import React from 'react';
import { Laptop, QrCode, Trash2, Edit3 } from 'lucide-react';

interface DeviceCardProps {
    device: {
        id: string;
        serialNumber: string;
        type: "COMPANY" | "BYOD";
        make: string;
        model: string;
        color: string;
        assignedTo?: string | null;
        qrCodeURL?: string | null;
    };
    onEdit: (dev: any) => void;
    onDelete: (id: string) => void;
    onGenerateQR: (dev: any) => void;
}

const DeviceCard: React.FC<DeviceCardProps> = ({ device, onDelete, onEdit, onGenerateQR }) => {
    const isAssigned = !!device.assignedTo;

    return (
        <div className="glass-card device-card" style={{ padding: '1.25rem' }}>
            <div style={{
                padding: '1rem',
                background: device.type === 'COMPANY' ? 'rgba(226, 26, 34, 0.05)' : 'rgba(0,0,0,0.05)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Laptop size={28} color={device.type === 'COMPANY' ? 'var(--primary)' : 'var(--secondary)'} />
            </div>

            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--secondary)' }}>{device.make} {device.model}</h3>
                    <span style={{
                        fontSize: '0.65rem',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: device.type === 'COMPANY' ? 'var(--primary)' : '#475569',
                        color: 'white',
                        fontWeight: '700',
                        textTransform: 'uppercase'
                    }}>
                        {device.type}
                    </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>S/N: {device.serialNumber}</p>
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: isAssigned ? '#10b981' : '#cbd5e1'
                    }}></div>
                    <span style={{ fontSize: '0.75rem', color: isAssigned ? '#059669' : '#64748b', fontWeight: '600' }}>
                        {isAssigned ? `Assigned to ${device.assignedTo}` : 'Unassigned'}
                    </span>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                    onClick={() => onGenerateQR(device)}
                    title="Generate QR"
                    style={{
                        padding: '0.5rem',
                        background: device.qrCodeURL ? 'rgba(16, 185, 129, 0.1)' : '#f1f5f9',
                        color: device.qrCodeURL ? '#10b981' : '#475569',
                        border: 'none',
                        borderRadius: '0.5rem'
                    }}
                >
                    <QrCode size={18} />
                </button>
                <button
                    onClick={() => onEdit(device)}
                    style={{ padding: '0.5rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '0.5rem' }}
                >
                    <Edit3 size={18} />
                </button>
                <button
                    onClick={() => onDelete(device.serialNumber)}
                    style={{ padding: '0.5rem', background: '#fee2e2', color: 'var(--danger)', border: 'none', borderRadius: '0.5rem' }}
                >
                    <Trash2 size={18} />
                </button>
            </div>
        </div>
    );
};

export default DeviceCard;
