import React from 'react';
import { Laptop, QrCode, Trash2, Edit3 } from 'lucide-react';

interface DeviceCardProps {
  device: {
    id: string;
    serial_number: string;
    type: 'COMPANY' | 'BYOD';
    make?: string | null;
    model?: string | null;
    color?: string | null;
    assigned_to?: string | null;
    assigned_employee_name?: string | null;
    qr_code_url?: string | null;
    is_leased?: boolean;
  };
  onEdit: (dev: any) => void;
  onDelete?: (id: string) => void;
  onGenerateQR: (dev: any) => void;
}

const DeviceCard: React.FC<DeviceCardProps> = ({ device, onDelete, onEdit, onGenerateQR }) => {
  const isAssigned = !!device.assigned_to;
  const displayName = (device.make || device.model) 
    ? `${device.make || ''} ${device.model || ''}`.trim()
    : `Device: ${device.serial_number}`;

  return (
    <div className="glass-card device-card" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
      {/* Icon */}
      <div style={{
        padding: '1rem',
        background: device.type === 'COMPANY' ? 'rgba(226, 26, 34, 0.05)' : 'rgba(0,0,0,0.05)',
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Laptop size={28} color={device.type === 'COMPANY' ? 'var(--primary)' : 'var(--secondary)'} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--secondary)' }}>{displayName}</h3>
          <span style={{
            fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px',
            background: device.type === 'COMPANY' ? 'var(--primary)' : '#475569',
            color: 'white', fontWeight: '700', textTransform: 'uppercase'
          }}>
            {device.type}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>
          S/N: {device.serial_number}
        </p>
        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: isAssigned ? '#10b981' : '#cbd5e1', flexShrink: 0
          }} />
          <span style={{ fontSize: '0.75rem', color: isAssigned ? '#059669' : '#64748b', fontWeight: '600' }}>
            {isAssigned
              ? `${device.assigned_employee_name || device.assigned_to} (${device.assigned_to})`
              : 'Unassigned'}
          </span>
        </div>
        {device.is_leased && (
          <span style={{ fontSize: '0.7rem', fontWeight: '800', background: 'rgba(226,26,34,0.1)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px', marginTop: '0.25rem', display: 'inline-block' }}>LEASED</span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
        <button
          onClick={() => onGenerateQR(device)}
          title="Generate QR"
          style={{
            padding: '0.5rem',
            background: device.qr_code_url ? 'rgba(16, 185, 129, 0.1)' : '#f1f5f9',
            color: device.qr_code_url ? '#10b981' : '#475569',
            border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center'
          }}
        >
          <QrCode size={18} />
        </button>

        <button
          onClick={() => onEdit(device)}
          title="Edit device"
          style={{
            padding: '0.5rem', background: '#f1f5f9', color: '#475569',
            border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center'
          }}
        >
          <Edit3 size={18} />
        </button>

        {onDelete && (
          <button
            onClick={() => onDelete(device.serial_number)}
            title="Retire device"
            style={{
              padding: '0.5rem', background: '#fee2e2', color: 'var(--primary)',
              border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center'
            }}
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default DeviceCard;