// @ts-ignore
import React from 'react';
import { Trash2, Edit3, Shield } from 'lucide-react';

interface EmployeeCardProps {
    employee: {
        id: string;
        empId: string;
        name: string;
        departmentOrFloor: string;
        photoURL?: string;
    };
    onEdit: (emp: any) => void;
    onDelete: (id: string) => void;
    onView?: (emp: any) => void;
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({ employee, onDelete, onEdit, onView }) => {
    return (
        <div
            className="glass-card"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1.5rem',
                padding: '1.25rem',
                cursor: onView ? 'pointer' : 'default',
                transition: 'all 0.2s ease'
            }}
            onClick={() => onView && onView(employee)}
        >
            <div style={{ position: 'relative' }}>
                <img
                    src={employee.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(employee.name)}`}
                    alt={employee.name}
                    style={{
                        width: '70px',
                        height: '70px',
                        borderRadius: 'var(--radius-sm)',
                        objectFit: 'cover',
                        border: '2px solid #fff',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                    }}
                />
                <div style={{
                    position: 'absolute',
                    bottom: '-5px',
                    right: '-5px',
                    background: 'var(--primary)',
                    color: 'white',
                    fontSize: '0.65rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: '700'
                }}>
                    {employee.empId}
                </div>
            </div>

            <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', color: 'var(--secondary)' }}>{employee.name}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Shield size={14} /> {employee.departmentOrFloor}</span>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(employee); }}
                    style={{
                        padding: '0.5rem',
                        background: '#f1f5f9',
                        color: '#475569',
                        border: 'none',
                        borderRadius: '0.5rem',
                        display: 'flex',
                        alignItems: 'center'
                    }}
                >
                    <Edit3 size={18} />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(employee.id); }}
                    style={{
                        padding: '0.5rem',
                        background: '#fee2e2',
                        color: 'var(--danger)',
                        border: 'none',
                        borderRadius: '0.5rem',
                        display: 'flex',
                        alignItems: 'center'
                    }}
                >
                    <Trash2 size={18} />
                </button>
            </div>
        </div>
    );
};

export default EmployeeCard;
