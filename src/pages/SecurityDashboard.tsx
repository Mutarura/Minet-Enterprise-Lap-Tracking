import React, { useState, useEffect } from 'react';
import {
    collections,
    addLog,
    auth,
    getDevices,
    getEmployeeByEmpId,
    db
} from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
// import { useNavigate } from 'react-router-dom';
import {
    query,
    where,
    onSnapshot,
    Timestamp,
    orderBy,
    limit,
    getDocs
} from 'firebase/firestore';
import QRScanner from '../components/QRScanner';
import Modal from '../components/Modal';
import {
    ScanLine,
    ListFilter,
    Search,
    ArrowLeft,
    CheckCircle2,
    LogOut,
    LogIn,
    Clock,
    Download,
    Calendar,
    AlertTriangle,
    Bell
} from 'lucide-react';
import { getSystemAlerts, type Alert } from '../utils/alerts';

const SecurityDashboard = () => {
    const [activeTab, setActiveTab] = useState<'scanner' | 'logs' | 'alerts'>('scanner');
    const [scanState, setScanState] = useState<'idle' | 'reviewing' | 'success'>('idle');
    const [scannedMetadata, setScannedMetadata] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Alerts State
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [alertsLoading, setAlertsLoading] = useState(false);

    // CSV Export State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportDates, setExportDates] = useState({ start: '', end: '' });
    const [exportFilename, setExportFilename] = useState('');

    // MOBILE SESSION MANAGEMENT
    const resetMobileState = () => {
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
            setScanState('idle');
            setScannedMetadata(null);
            setSearchTerm('');
            setShowExportModal(false);
            setExportDates({ start: '', end: '' });
        }
    };

    const handleTabSwitch = (tab: typeof activeTab) => {
        setActiveTab(tab);
        resetMobileState();
    };

    // const navigate = useNavigate();

    useEffect(() => {
        // Fetch Today's Logs
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const q = query(
            collections.logs,
            where("timestamp", ">=", Timestamp.fromDate(today)),
            orderBy("timestamp", "desc"),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        loadAlerts();

        return () => unsubscribe();
    }, []);

    const loadAlerts = async () => {
        setAlertsLoading(true);
        try {
            const devs = await getDevices();
            const activeAlerts = await getSystemAlerts(devs);
            setAlerts(activeAlerts);
        } catch (err) {
            console.error("Alert load error:", err);
        } finally {
            setAlertsLoading(false);
        }
    };

    const handleScan = async (data: string) => {
        try {
            const parsed = JSON.parse(data);

            // SECURITY SYNC: Fetch latest employee and device status
            const [latestEmployee, deviceSnap] = await Promise.all([
                getEmployeeByEmpId(parsed.empId),
                getDoc(doc(db, "devices", parsed.serialNumber))
            ]);

            const deviceData = deviceSnap.exists() ? deviceSnap.data() : {};

            setScannedMetadata({
                ...parsed,
                employeePhotoURL: (latestEmployee as any)?.photoURL || parsed.employeePhotoURL || '',
                currentStatus: deviceData.lastAction || 'UNKNOWN',
                lastActionAt: deviceData.lastActionAt
            });
            setScanState('reviewing');
        } catch (e) {
            console.error("Invalid QR:", e);
            alert("This QR code is invalid or the data is corrupted.");
        }
    };

    const handleAction = async (action: 'CHECK_IN' | 'CHECK_OUT') => {
        // DOUBLE ACTION PREVENTION RULE
        if (action === scannedMetadata.currentStatus) {
            const statusLabel = action === 'CHECK_IN' ? 'IN' : 'OUT';
            alert(`SECURITY ALERT: This device is already recorded as CHECKED ${statusLabel}. You cannot perform a double ${action.replace('_', ' ')}.`);
            return;
        }

        setActionLoading(true);
        try {
            await addLog({
                empId: scannedMetadata.empId,
                employeeName: scannedMetadata.employeeName,
                serialNumber: scannedMetadata.serialNumber,
                action: action
            });
            setScanState('success');
            setTimeout(() => {
                setScanState('idle');
                setScannedMetadata(null);
                loadAlerts(); // Refresh alerts after action
            }, 2500);
        } catch (err) {
            alert("Action failed. Please try again.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleExportCSV = async () => {
        if (!exportDates.start || !exportDates.end) {
            alert("Please select both start and end dates.");
            return; // Added return to prevent further execution
        }

        try {
            const start = new Date(exportDates.start);
            const end = new Date(exportDates.end);
            end.setHours(23, 59, 59);

            const q = query(
                collections.logs,
                where("timestamp", ">=", Timestamp.fromDate(start)),
                where("timestamp", "<=", Timestamp.fromDate(end)),
                orderBy("timestamp", "desc")
            );

            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => doc.data());

            if (data.length === 0) {
                alert("No logs found for the selected range.");
                return;
            }

            // Generate CSV content
            const headers = ["Timestamp", "Action", "Employee ID", "Employee Name", "Serial Number"];
            const csvRows = [
                headers.join(","),
                ...data.map(row => {
                    const ts = row.timestamp.toDate().toLocaleString();
                    return `"${ts}","${row.action}","${row.empId}","${row.employeeName}","${row.serialNumber}"`;
                })
            ];

            const csvBlob = new Blob([csvRows.join("\n")], { type: 'text/csv' });
            const url = window.URL.createObjectURL(csvBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${exportFilename || 'Minet_Logs'}_${exportDates.start}_to_${exportDates.end}.csv`;
            a.click();
            setShowExportModal(false);
        } catch (err) {
            console.error("Export error:", err);
            alert("Failed to export logs.");
        }
    };

    const filteredLogs = logs.filter(log =>
        log.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.empId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: '5rem', display: 'flex', flexDirection: 'column' }}>
            {/* Professional Header */}
            <header style={{ 
                background: 'white', 
                padding: '1.25rem 2rem', 
                borderBottom: '1px solid #e2e8f0', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                position: 'sticky', 
                top: 0, 
                zIndex: 100, 
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)' 
            }}>
                <div>
                    <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--secondary)', lineHeight: 1.1 }}>Minet Laptop Tracking System</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SECURITY DASHBOARD</div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={() => setShowExportModal(true)}
                        style={{ background: 'white', border: '1px solid #cbd5e1', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', cursor: 'pointer', color: 'var(--secondary)' }}
                        title="Export"
                    >
                        <Download size={18} />
                    </button>
                    <button
                        onClick={async () => { 
                            if (confirm('Logout?')) { 
                                await signOut(auth); 
                                window.location.href = 'https://minet-insurance-laptoptracking.web.app/';
                            } 
                        }}
                        style={{ background: 'rgba(0,0,0,0.05)', border: 'none', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', cursor: 'pointer', color: 'var(--secondary)' }}
                        title="Logout"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            <main style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem', width: '100%', boxSizing: 'border-box', flex: 1 }}>
                {scanState === 'idle' && (
                    <>
                        <div className="tabs-container" style={{ display: 'flex', background: 'white', borderRadius: 'var(--radius-sm)', padding: '4px', marginBottom: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
                            <button onClick={() => handleTabSwitch('scanner')} style={{ ... (activeTab === 'scanner' ? activeTabStyle : inactiveTabStyle), flex: 1, whiteSpace: 'nowrap' }}>
                                <ScanLine size={16} /> Scanner
                            </button>
                            <button onClick={() => handleTabSwitch('logs')} style={{ ... (activeTab === 'logs' ? activeTabStyle : inactiveTabStyle), flex: 1, whiteSpace: 'nowrap' }}>
                                <ListFilter size={16} /> Activities
                            </button>
                            <button onClick={() => handleTabSwitch('alerts')} style={{ ...(activeTab === 'alerts' ? { ...activeTabStyle, background: '#f59e0b' } : inactiveTabStyle), position: 'relative', flex: 1, whiteSpace: 'nowrap' }}>
                                <Bell size={16} /> Alerts
                                {!alertsLoading && alerts.length > 0 && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '-4px',
                                        right: '-4px',
                                        background: 'var(--primary)',
                                        color: 'white',
                                        borderRadius: '50%',
                                        minWidth: '18px',
                                        height: '18px',
                                        fontSize: '0.65rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '2px solid white',
                                        fontWeight: '800'
                                    }}>
                                        {alerts.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {activeTab === 'scanner' ? (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h2 style={{ fontSize: '1.5rem', color: 'var(--secondary)', marginBottom: '0.5rem' }}>Security Checkpoint</h2>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Scan a Minet QR code to record device activity</p>
                                </div>

                                <QRScanner onScanResult={handleScan} />

                                <div style={{ marginTop: '2rem', padding: '1.25rem', background: 'white', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0', textAlign: 'left' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', color: 'var(--secondary)' }}>
                                        <Clock size={20} />
                                        <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>Checkpoint Instructions</span>
                                    </div>
                                    <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#64748b', lineHeight: '1.6' }}>
                                        <li>Position the QR code clearly in the white frame.</li>
                                        <li>You can also click <strong>"Scan Image File"</strong> inside the scanner if the camera is unavailable.</li>
                                        <li>Verify the employee photo before confirming Check In/Out.</li>
                                    </ul>
                                </div>
                            </div>
                        ) : activeTab === 'alerts' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '1.5rem', borderRadius: 'var(--radius-sm)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <AlertTriangle size={32} color="#f59e0b" />
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1rem', color: '#92400e' }}>Active Security Violations</h3>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#b45309' }}>COMPANY laptops out for 15hr+ or long weekends.</p>
                                    </div>
                                </div>

                                {alertsLoading ? (
                                    <p style={{ textAlign: 'center', padding: '2rem' }}>Checking system logs...</p>
                                ) : alerts.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                                        <CheckCircle2 size={48} opacity={0.3} style={{ margin: '0 auto 1rem' }} />
                                        <p>No active security violations found.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {alerts.map(alert => (
                                            <div key={alert.id} className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <p style={{ margin: 0, fontWeight: '700', fontSize: '1rem' }}>{alert.employeeName}</p>
                                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '700' }}>{alert.empId}</p>
                                                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>S/N: {alert.serialNumber}</p>
                                                    </div>
                                                    <span style={{ fontSize: '0.7rem', fontWeight: '800', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '4px' }}>
                                                        {alert.reason === 'OVERTIME_WEEKDAY' ? 'OVERTIME' : 'WEEKEND'}
                                                    </span>
                                                </div>
                                                <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    Out since: {alert.checkedOutAt.toLocaleString()} ({alert.durationHrs} hrs ago)
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div className="glass-card" style={{ display: 'flex', alignItems: 'center', padding: '0 1rem' }}>
                                    <Search size={20} color="#94a3b8" />
                                    <input
                                        type="text"
                                        placeholder="Search activities..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        style={{ border: 'none', padding: '1rem', width: '100%', outline: 'none', background: 'transparent' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {filteredLogs.map(log => (
                                        <div key={log.id} className="glass-card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{ background: log.action === 'CHECK_IN' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(226, 26, 34, 0.1)', color: log.action === 'CHECK_IN' ? '#10b981' : 'var(--primary)', padding: '0.5rem', borderRadius: '50%' }}>
                                                    {log.action === 'CHECK_IN' ? <LogIn size={18} /> : <LogOut size={18} />}
                                                </div>
                                                <div>
                                                    <p style={{ margin: 0, fontWeight: '700', color: 'var(--secondary)' }}>{log.employeeName}</p>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>SN: {log.serialNumber}</p>
                                                        <p style={{ margin: 0, fontSize: '0.65rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                                                            Audit: {log.readableLogstamp || new Date(log.timestamp.seconds * 1000).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <span style={{ fontSize: '0.7rem', fontWeight: '800', background: log.action === 'CHECK_IN' ? '#dcfce7' : '#fee2e2', color: log.action === 'CHECK_IN' ? '#166534' : 'var(--primary)', padding: '2px 8px', borderRadius: '4px' }}>
                                                {log.action === 'CHECK_IN' ? 'IN' : 'OUT'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {scanState === 'reviewing' && (
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem 0' }}>
                        <button onClick={() => setScanState('idle')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: '600', cursor: 'pointer' }}>
                            <ArrowLeft size={20} /> Back
                        </button>

                        <div style={{ position: 'relative', width: '150px', height: '150px', margin: '0 auto' }}>
                            <img
                                src={scannedMetadata.employeePhotoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(scannedMetadata.employeeName)}`}
                                style={{ width: '100%', height: '100%', borderRadius: 'var(--radius-md)', objectFit: 'cover', border: '4px solid white', boxShadow: '0 8px 15px rgba(0,0,0,0.1)' }}
                            />
                        </div>

                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.25rem', fontWeight: '700' }}>EMPLOYEE ID</p>
                            <h2 style={{ fontSize: '2.5rem', color: 'var(--primary)', margin: 0, letterSpacing: '1px' }}>{scannedMetadata.empId}</h2>
                        </div>

                        <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'left', background: '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                                <h4 style={{ margin: 0, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: '800' }}>Device Verification</h4>
                                <span style={{ background: scannedMetadata.type === 'COMPANY' ? '#fee2e2' : '#dcfce7', color: scannedMetadata.type === 'COMPANY' ? 'var(--primary)' : '#166534', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '800' }}>
                                    {scannedMetadata.type || 'UNKNOWN'} DEVICE
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', fontWeight: '700' }}>MAKE / MODEL</p>
                                    <p style={{ margin: 0, fontWeight: '700', fontSize: '1rem' }}>{scannedMetadata.make} {scannedMetadata.model}</p>
                                </div>
                                <div>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', fontWeight: '700' }}>CURRENT STATUS</p>
                                    <span style={{
                                        fontWeight: '800',
                                        color: scannedMetadata.currentStatus === 'CHECK_IN' ? '#10b981' : 'var(--primary)',
                                        fontSize: '0.9rem'
                                    }}>
                                        ● {scannedMetadata.currentStatus === 'CHECK_IN' ? 'INSIDE OFFICE' : 'CHECKED OUT'}
                                    </span>
                                </div>
                                <div>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', fontWeight: '700' }}>SERIAL NUMBER</p>
                                    <p style={{ margin: 0, fontWeight: '800', fontSize: '1rem', color: 'var(--secondary)' }}>{scannedMetadata.serialNumber}</p>
                                </div>
                                <div>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', fontWeight: '700' }}>COLOR</p>
                                    <p style={{ margin: 0, fontWeight: '700' }}>{scannedMetadata.color}</p>
                                </div>
                            </div>
                        </div>

                        <div className="button-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <button
                                onClick={() => handleAction('CHECK_IN')}
                                disabled={actionLoading || scannedMetadata.currentStatus === 'CHECK_IN'}
                                style={{
                                    ...btnActionStyle,
                                    background: '#10b981',
                                    opacity: scannedMetadata.currentStatus === 'CHECK_IN' ? 0.4 : 1,
                                    cursor: scannedMetadata.currentStatus === 'CHECK_IN' ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <LogIn size={20} />
                                {scannedMetadata.currentStatus === 'CHECK_IN' ? 'ALREADY IN' : 'CHECK IN'}
                            </button>

                            <button
                                onClick={() => handleAction('CHECK_OUT')}
                                disabled={actionLoading || scannedMetadata.currentStatus === 'CHECK_OUT'}
                                style={{
                                    ...btnActionStyle,
                                    background: 'var(--primary)',
                                    opacity: scannedMetadata.currentStatus === 'CHECK_OUT' ? 0.4 : 1,
                                    cursor: scannedMetadata.currentStatus === 'CHECK_OUT' ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <LogOut size={20} />
                                {scannedMetadata.currentStatus === 'CHECK_OUT' ? 'ALREADY OUT' : 'CHECK OUT'}
                            </button>
                        </div>

                        {scannedMetadata.currentStatus !== 'UNKNOWN' && (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                * Only the valid next action is available.
                            </p>
                        )}
                    </div>
                )}

                {scanState === 'success' && (
                    <div style={{ textAlign: 'center', padding: '5rem 0' }}>
                        <CheckCircle2 size={64} color="#10b981" style={{ margin: '0 auto 1.5rem' }} />
                        <h2 style={{ fontSize: '1.5rem', color: 'var(--secondary)' }}>Recorded Successfully!</h2>
                    </div>
                )}
            </main>

            <Modal isOpen={showExportModal} onClose={() => setShowExportModal(false)} title="Export Activity Logs (CSV)">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0.5rem' }}>
                    <div style={{ background: '#f1f5f9', padding: '1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: '#475569' }}>
                        <p style={{ margin: 0 }}><strong>Choose a single day or a range.</strong> To download logs for a specific day, set the start and end dates to that day.</p>
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
                        <label style={labelStyle}>Save File As...</label>
                        <input
                            type="text"
                            value={exportFilename}
                            onChange={e => setExportFilename(e.target.value)}
                            placeholder="e.g. security_logs_2024"
                            style={inputStyle}
                            required
                        />
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.4rem' }}>The file will be saved as a .csv file</p>
                    </div>
                    <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '4px', fontSize: '0.8rem', color: '#64748b', border: '1px solid #e2e8f0' }}>
                        <Calendar size={14} style={{ marginBottom: '4px', verticalAlign: 'middle', marginRight: '4px' }} />
                        Max suggested range: 12 months.
                    </div>
                    <button
                        onClick={handleExportCSV}
                        className="btn-primary"
                        style={{
                            height: '3.5rem',
                            fontSize: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.75rem',
                            background: 'var(--secondary)'
                        }}
                    >
                        <Download size={20} /> DOWNLOAD CSV LOGS
                    </button>
                </div>
            </Modal>
        </div>
    );
};

// Styles
const activeTabStyle: React.CSSProperties = {
    flex: 1, padding: '0.75rem', background: 'var(--secondary)', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer'
};
const inactiveTabStyle: React.CSSProperties = {
    flex: 1, padding: '0.75rem', background: 'transparent', color: '#64748b', border: 'none', borderRadius: '4px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer'
};
const btnActionStyle: React.CSSProperties = {
    padding: '1.25rem', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: '800', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
};
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem' };

export default SecurityDashboard;
