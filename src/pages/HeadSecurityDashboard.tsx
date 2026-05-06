// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
    getToken,
    getUser,
    logSystemEvent
} from '../services/api';
import {
    ShieldCheck,
    LogOut,
    Monitor,
    LogIn,
    Clock,
    AlertTriangle,
    Download,
    Search,
    Users,
    Briefcase,
    Bell,
    CheckCircle2,
    Calendar
} from 'lucide-react';
import { getSystemAlerts, type Alert } from '../utils/alerts';

const HeadSecurityDashboard = () => {
    const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'visitors' | 'alerts'>('overview');
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Data state
    const [devices, setDevices] = useState<any[]>([]);
    const [activityLogs, setActivityLogs] = useState<any[]>([]);
    const [visitorLogs, setVisitorLogs] = useState<any[]>([]);
    const [vendorLogs, setVendorLogs] = useState<any[]>([]);
    const [deviceAlerts, setDeviceAlerts] = useState<Alert[]>([]);
    const [retrievedAlerts, setRetrievedAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [deviceFilter, setDeviceFilter] = useState<'all' | 'in' | 'out' | 'retrieved'>('all');

    // Export state
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportDates, setExportDates] = useState({ start: '', end: '' });
    const [exportFilename, setExportFilename] = useState('');

    useEffect(() => {
        const user = getUser();
        setCurrentUser(user);
        loadAll();

        const interval = setInterval(loadAll, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadAll = async () => {
        try {
            const token = getToken();
            const headers = { 'Authorization': `Bearer ${token}` };

            const [devRes, logsRes, visitorsRes, vendorsRes] = await Promise.all([
                fetch('/api/devices', { headers }),
                fetch('/api/logs/today', { headers }),
                fetch('/api/visitors', { headers }),
                fetch('/api/vendors/visits/today', { headers }).catch(() => ({ json: () => [] }))
            ]);

            const [devData, logsData, visitorsData] = await Promise.all([
                devRes.json(),
                logsRes.json(),
                visitorsRes.json(),
            ]);

            const vendorsData = await (vendorsRes as any).json().catch(() => []);

            setDevices(Array.isArray(devData) ? devData : []);
            setActivityLogs(Array.isArray(logsData) ? logsData : []);
            setVisitorLogs(Array.isArray(visitorsData) ? visitorsData : []);
            setVendorLogs(Array.isArray(vendorsData) ? vendorsData : []);

            // Load system alerts
            const sysAlerts = await getSystemAlerts(Array.isArray(devData) ? devData : []);
            setDeviceAlerts(sysAlerts);

            // Load retrieved alerts
            const alertsRes = await fetch('/api/logs/alerts', { headers });
            if (alertsRes.ok) {
                const alertsData = await alertsRes.json();
                setRetrievedAlerts(Array.isArray(alertsData) ? alertsData : []);
            }

        } catch (err) {
            console.error('Load error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Stats
    const totalDevices = devices.filter(d => d.type === 'COMPANY').length;
    const devicesIn = devices.filter(d => d.type === 'COMPANY' && d.last_action === 'CHECK_IN').length;
    const devicesOut = devices.filter(d => d.type === 'COMPANY' && d.last_action === 'CHECK_OUT').length;
    const devicesRetrieved = devices.filter(d => d.status === 'retrieved').length;
    const visitorsOnsite = visitorLogs.filter(v => v.status === 'IN').length;

    // Filtered devices
    const filteredDevices = devices.filter(d => {
        if (d.type !== 'COMPANY') return false;
        if (deviceFilter === 'in') return d.last_action === 'CHECK_IN' && d.status !== 'retrieved';
        if (deviceFilter === 'out') return d.last_action === 'CHECK_OUT' && d.status !== 'retrieved';
        if (deviceFilter === 'retrieved') return d.status === 'retrieved';
        return true;
    }).filter(d => {
        if (!searchTerm) return true;
        return [d.serial_number, d.make, d.model, d.assigned_employee_name]
            .some(v => String(v || '').toLowerCase().includes(searchTerm.toLowerCase()));
    });

    const handleExportCSV = async () => {
        if (!exportDates.start || !exportDates.end) {
            window.alert('Please select both start and end dates.');
            return;
        }
        try {
            const token = getToken();
            const res = await fetch(`/api/logs/export?start=${exportDates.start}&end=${exportDates.end}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const allData = await res.json();
            if (!allData.length) {
                window.alert('No logs found for the selected range.');
                return;
            }
            const headers = ['Timestamp', 'Type', 'Name/Company', 'ID / Contact', 'Action/Status', 'Details', 'Device S/N'];
            const escape = (str: string) => `"${str ? str.toString().replace(/"/g, '""') : ''}"`;
            const csvRows = [
                headers.join(','),
                ...allData.map((row: any) => [
                    escape(new Date(row.timestamp || row.check_in_time).toLocaleString()),
                    escape(row.entry_type || row.type || ''),
                    escape(row.employee_name || row.name || row.vendor_name || ''),
                    escape(row.emp_id || row.identifier || row.phone || ''),
                    escape(row.action || (row.status === 'IN' ? 'CHECK_IN' : 'CHECK_OUT')),
                    escape(row.reason || row.purpose || ''),
                    escape(row.serial_number || row.device_serial || '')
                ].join(','))
            ];
            const csvBlob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
            const url = window.URL.createObjectURL(csvBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${exportFilename || 'Security_Logs'}_${exportDates.start}_to_${exportDates.end}.csv`;
            a.click();
            setShowExportModal(false);
        } catch (err) {
            console.error('Export error:', err);
            window.alert('Failed to export logs.');
        }
    };

    const totalAlerts = deviceAlerts.length + retrievedAlerts.length;

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                <p style={{ color: '#64748b' }}>Loading command centre...</p>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: '2rem' }}>
            {/* Header */}
            <header style={{ background: 'white', padding: '1.25rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div>
                    <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--secondary)', lineHeight: 1.1 }}>Security Command Centre</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '4px' }}>
                        <ShieldCheck size={14} color="var(--primary)" /> {currentUser?.name || 'HEAD OF SECURITY'}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={() => setShowExportModal(true)}
                        style={{ background: 'white', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', cursor: 'pointer', color: 'var(--secondary)', fontSize: '0.85rem' }}
                    >
                        <Download size={16} /> Export Logs
                    </button>
                    <button
                        onClick={async () => {
                            if (confirm('Logout?')) {
                                const user = getUser();
                                await logSystemEvent(
                                    { type: 'LOGOUT', category: 'AUTH' },
                                    { id: user?.id || 'unknown', type: 'USER' },
                                    'SUCCESS',
                                    'Head of Security initiated logout'
                                );
                                localStorage.removeItem('minet_token');
                                localStorage.removeItem('minet_user');
                                window.location.href = '/tracker/';
                            }
                        }}
                        style={{ background: 'rgba(0,0,0,0.05)', border: 'none', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'var(--secondary)' }}
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem', width: '100%', boxSizing: 'border-box' }}>

                {/* Tabs */}
                <div style={{ display: 'flex', background: 'white', borderRadius: 'var(--radius-sm)', padding: '4px', marginBottom: '2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', overflowX: 'auto', gap: '4px' }}>
                    {([
                        { key: 'overview', label: 'Overview', icon: <Monitor size={16} /> },
                        { key: 'activity', label: 'Activity', icon: <Clock size={16} /> },
                        { key: 'visitors', label: 'Visitors & Vendors', icon: <Users size={16} /> },
                        { key: 'alerts', label: 'Alerts', icon: <Bell size={16} />, badge: totalAlerts },
                    ] as any[]).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            style={{
                                flex: 1, padding: '0.75rem 1rem',
                                background: activeTab === tab.key ? 'var(--secondary)' : 'transparent',
                                color: activeTab === tab.key ? 'white' : '#64748b',
                                border: 'none', borderRadius: '4px', fontWeight: '700',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: '0.5rem', cursor: 'pointer', whiteSpace: 'nowrap',
                                position: 'relative'
                            }}
                        >
                            {tab.icon} {tab.label}
                            {tab.badge > 0 && (
                                <span style={{ background: 'var(--primary)', color: 'white', borderRadius: '50%', minWidth: '18px', height: '18px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                        {/* Stat Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                            {[
                                { label: 'Total Company Devices', value: totalDevices, color: 'var(--secondary)', icon: <Monitor size={24} /> },
                                { label: 'Currently In Office', value: devicesIn, color: '#10b981', icon: <LogIn size={24} /> },
                                { label: 'Currently Out', value: devicesOut, color: 'var(--primary)', icon: <LogOut size={24} /> },
                                { label: 'Retrieved', value: devicesRetrieved, color: '#7c3aed', icon: <ShieldCheck size={24} /> },
                                { label: 'Visitors On-site', value: visitorsOnsite, color: '#0284c7', icon: <Users size={24} /> },
                            ].map((stat, i) => (
                                <div key={i} className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ color: stat.color, background: stat.color + '15', padding: '0.75rem', borderRadius: '50%' }}>
                                        {stat.icon}
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>{stat.label}</p>
                                        <p style={{ margin: 0, fontSize: '2rem', fontWeight: '800', color: stat.color, lineHeight: 1.1 }}>{stat.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Device List */}
                        <div className="glass-card" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                                <h3 style={{ margin: 0, color: 'var(--secondary)', fontSize: '1rem', fontWeight: '800' }}>Device Status</h3>
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px' }}>
                                        {(['all', 'in', 'out', 'retrieved'] as const).map(f => (
                                            <button key={f} onClick={() => setDeviceFilter(f)}
                                                style={{ padding: '0.4rem 0.75rem', background: deviceFilter === f ? 'white' : 'transparent', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', color: deviceFilter === f ? 'var(--secondary)' : '#64748b', boxShadow: deviceFilter === f ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                                                {f.charAt(0).toUpperCase() + f.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '8px', padding: '0.4rem 0.75rem', gap: '0.5rem' }}>
                                        <Search size={14} color="#94a3b8" />
                                        <input placeholder="Search devices..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem', width: '160px' }} />
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {filteredDevices.length === 0 ? (
                                    <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No devices found.</p>
                                ) : filteredDevices.map(d => (
                                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '8px', borderLeft: `4px solid ${d.status === 'retrieved' ? '#7c3aed' : d.last_action === 'CHECK_IN' ? '#10b981' : 'var(--primary)'}` }}>
                                        <div>
                                            <p style={{ margin: 0, fontWeight: '700', fontSize: '0.9rem', color: 'var(--secondary)' }}>{d.make} {d.model}</p>
                                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>S/N: {d.serial_number} {d.assigned_employee_name ? `• ${d.assigned_employee_name}` : '• Unassigned'}</p>
                                        </div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: '800', padding: '3px 10px', borderRadius: '4px', background: d.status === 'retrieved' ? '#ede9fe' : d.last_action === 'CHECK_IN' ? '#dcfce7' : '#fee2e2', color: d.status === 'retrieved' ? '#7c3aed' : d.last_action === 'CHECK_IN' ? '#166534' : 'var(--primary)' }}>
                                            {d.status === 'retrieved' ? 'RETRIEVED' : d.last_action === 'CHECK_IN' ? 'IN' : d.last_action === 'CHECK_OUT' ? 'OUT' : 'UNKNOWN'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ACTIVITY TAB */}
                {activeTab === 'activity' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, color: 'var(--secondary)', fontWeight: '800' }}>Today's Activity Log</h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{activityLogs.length} device events today</p>
                        </div>
                        {activityLogs.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                                <Clock size={48} opacity={0.3} style={{ marginBottom: '1rem' }} />
                                <p>No activity logged today.</p>
                            </div>
                        ) : activityLogs.map(log => (
                            <div key={log.id} className="glass-card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `4px solid ${log.action === 'CHECK_IN' ? '#10b981' : log.action === 'RETRIEVED' ? '#7c3aed' : 'var(--primary)'}` }}>
                                <div>
                                    <p style={{ margin: 0, fontWeight: '700', color: 'var(--secondary)' }}>{log.employee_name}</p>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>S/N: {log.serial_number}</p>
                                </div>
                                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: '800', padding: '2px 8px', borderRadius: '4px', background: log.action === 'CHECK_IN' ? '#dcfce7' : log.action === 'RETRIEVED' ? '#ede9fe' : '#fee2e2', color: log.action === 'CHECK_IN' ? '#166534' : log.action === 'RETRIEVED' ? '#7c3aed' : 'var(--primary)' }}>
                                        {log.action === 'CHECK_IN' ? 'IN' : log.action === 'RETRIEVED' ? 'RETRIEVED' : 'OUT'}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={12} /> {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* VISITORS TAB */}
                {activeTab === 'visitors' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Visitors */}
                        <div>
                            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--secondary)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Users size={18} /> Visitors Today
                            </h3>
                            {visitorLogs.length === 0 ? (
                                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>No visitor activity today.</p>
                            ) : visitorLogs.map(v => (
                                <div key={v.id} className="glass-card" style={{ padding: '1rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `4px solid ${v.status === 'IN' ? '#10b981' : '#94a3b8'}` }}>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: '700' }}>{v.name}</p>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{v.reason} {v.destination ? `• ${v.destination}` : ''}</p>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>{v.identifier}</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: '800', padding: '2px 8px', borderRadius: '4px', background: v.status === 'IN' ? '#dcfce7' : '#f1f5f9', color: v.status === 'IN' ? '#166534' : '#64748b' }}>
                                            {v.status === 'IN' ? 'ON SITE' : 'CHECKED OUT'}
                                        </span>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                                            {new Date(v.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Vendors */}
                        <div>
                            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--secondary)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Briefcase size={18} /> Vendor Visits Today
                            </h3>
                            {vendorLogs.length === 0 ? (
                                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>No vendor activity today.</p>
                            ) : vendorLogs.map(v => (
                                <div key={v.id} className="glass-card" style={{ padding: '1rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `4px solid ${v.status === 'IN' ? '#f59e0b' : '#94a3b8'}` }}>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: '700' }}>{v.vendor_name}</p>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{v.visitor_name} • {v.purpose}</p>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: '800', padding: '2px 8px', borderRadius: '4px', background: v.status === 'IN' ? '#fef3c7' : '#f1f5f9', color: v.status === 'IN' ? '#92400e' : '#64748b' }}>
                                        {v.status === 'IN' ? 'ON SITE' : 'CHECKED OUT'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ALERTS TAB */}
                {activeTab === 'alerts' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                        {/* Overtime / Weekend alerts */}
                        <div>
                            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '1.25rem', borderRadius: 'var(--radius-sm)', display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                                <AlertTriangle size={28} color="#f59e0b" />
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#92400e' }}>Security Violations</h3>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#b45309' }}>Company laptops out for 15hr+ or over weekends.</p>
                                </div>
                            </div>
                            {deviceAlerts.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                    <CheckCircle2 size={36} opacity={0.3} style={{ marginBottom: '0.5rem' }} />
                                    <p>No active violations.</p>
                                </div>
                            ) : deviceAlerts.map(alert => (
                                <div key={alert.id} className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b', marginBottom: '0.75rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <p style={{ margin: 0, fontWeight: '700' }}>{alert.employeeName}</p>
                                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '700' }}>{alert.empId}</p>
                                            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>S/N: {alert.serialNumber}</p>
                                        </div>
                                        <span style={{ fontSize: '0.7rem', fontWeight: '800', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '4px' }}>
                                            {alert.reason === 'OVERTIME_WEEKDAY' ? 'OVERTIME' : 'WEEKEND'}
                                        </span>
                                    </div>
                                    <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                                        Out since: {alert.checkedOutAt.toLocaleString()} ({alert.durationHrs} hrs ago)
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Retrieved device alerts */}
                        <div>
                            <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', padding: '1.25rem', borderRadius: 'var(--radius-sm)', display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                                <ShieldCheck size={28} color="#7c3aed" />
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#5b21b6' }}>Retrieved Devices</h3>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#7c3aed' }}>Devices found and secured by security personnel.</p>
                                </div>
                            </div>
                            {retrievedAlerts.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                    <CheckCircle2 size={36} opacity={0.3} style={{ marginBottom: '0.5rem' }} />
                                    <p>No retrieved devices.</p>
                                </div>
                            ) : retrievedAlerts.map(alert => (
                                <div key={alert.id} className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid #7c3aed', marginBottom: '0.75rem' }}>
                                    <p style={{ margin: 0, fontWeight: '800', color: 'var(--secondary)' }}>S/N: {alert.device_serial}</p>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>Found by: <strong>{alert.created_by}</strong></p>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>{alert.message}</p>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>{new Date(alert.created_at).toLocaleString()}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* Export Modal */}
            {showExportModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', borderRadius: 'var(--radius-md)', padding: '2rem', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>Export Activity Logs</h3>
                            <button onClick={() => setShowExportModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={labelStyle}>Start Date</label>
                                <input type="date" value={exportDates.start} onChange={e => setExportDates({ ...exportDates, start: e.target.value })} style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>End Date</label>
                                <input type="date" value={exportDates.end} onChange={e => setExportDates({ ...exportDates, end: e.target.value })} style={inputStyle} />
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Save File As</label>
                            <input type="text" value={exportFilename} onChange={e => setExportFilename(e.target.value)} placeholder="e.g. security_logs_may2026" style={inputStyle} />
                        </div>
                        <button onClick={handleExportCSV} className="btn-primary" style={{ height: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                            <Download size={18} /> Download CSV
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' };

export default HeadSecurityDashboard;