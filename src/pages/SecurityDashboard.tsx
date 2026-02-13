import React, { useState, useEffect } from 'react';
import {
    collections,
    addLog,
    auth,
    getDevices,
    getEmployeeByEmpId,
    db,
    addVisitor,
    checkOutVisitor,
    addVendor,
    checkInVendor,
    deleteVendor,
    checkOutVendorVisit,
    // New Subscriptions
    subscribeToActiveVisitors,
    subscribeToVendors,
    subscribeToActiveVendorVisits,
    subscribeToTodayVisitors,
    subscribeToTodayVendorVisits
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
    Briefcase,
    UserPlus,
    Plus,
    AlertTriangle,
    Bell,
    Users,
    Trash2
} from 'lucide-react';
import { getSystemAlerts, type Alert } from '../utils/alerts';

const SecurityDashboard = () => {
    const [activeTab, setActiveTab] = useState<'scanner' | 'logs' | 'visitors' | 'alerts'>('scanner');
    const [scanState, setScanState] = useState<'idle' | 'reviewing' | 'success'>('idle');
    const [scannedMetadata, setScannedMetadata] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [visitorLogs, setVisitorLogs] = useState<any[]>([]);
    const [vendorLogs, setVendorLogs] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Alerts State
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [alertsLoading, setAlertsLoading] = useState(false);

    // CSV Export State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportDates, setExportDates] = useState({ start: '', end: '' });
    const [exportFilename, setExportFilename] = useState('');

    // VISITOR & VENDOR STATE
    const [visitorTab, setVisitorTab] = useState<'visitors' | 'vendors'>('visitors');
    const [visitors, setVisitors] = useState<any[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [vendorVisits, setVendorVisits] = useState<any[]>([]);

    // Forms
    const [showVisitorModal, setShowVisitorModal] = useState(false);
    const [visitorType, setVisitorType] = useState<'QUICK' | 'STANDARD'>('QUICK');
    const [visitorForm, setVisitorForm] = useState({
        name: '',
        phone: '',
        reason: '',
        identifier: '',
        destination: '',
        // Standard Device Details
        deviceType: '',
        deviceMakeModel: '',
        deviceSerial: '',
        deviceColor: ''
    });

    const [showVendorModal, setShowVendorModal] = useState(false);
    const [vendorForm, setVendorForm] = useState({ company: '', phone: '', supplies: '', notes: '' });

    const [showVendorCheckInModal, setShowVendorCheckInModal] = useState(false);
    const [selectedVendor, setSelectedVendor] = useState<any>(null);
    const [vendorCheckInForm, setVendorCheckInForm] = useState({ purpose: '', employeeName: '', employeePhone: '' });

    const [searchVisitor, setSearchVisitor] = useState('');
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
        // Consolidated Log Subscription
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Logs (Devices)
        const qLogs = query(
            collections.logs,
            where("timestamp", ">=", Timestamp.fromDate(today)),
            orderBy("timestamp", "desc"),
            limit(50)
        );
        const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
            setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // Visitor Logs (Today)
        const unsubscribeVisitorLogs = subscribeToTodayVisitors((data) => {
            setVisitorLogs(data);
        });

        // Vendor Logs (Today)
        const unsubscribeVendorLogs = subscribeToTodayVendorVisits((data) => {
            setVendorLogs(data);
        });

        loadAlerts();

        return () => {
            unsubscribeLogs();
            unsubscribeVisitorLogs();
            unsubscribeVendorLogs();
        };
    }, []);

    useEffect(() => {
        let unsubscribeVisitors = () => { };
        let unsubscribeVendors = () => { };
        let unsubscribeVendorVisits = () => { };

        if (activeTab === 'visitors') {
            if (visitorTab === 'visitors') {
                unsubscribeVisitors = subscribeToActiveVisitors((data) => {
                    setVisitors(data);
                });
            } else {
                unsubscribeVendors = subscribeToVendors((data) => {
                    setVendors(data);
                });
                unsubscribeVendorVisits = subscribeToActiveVendorVisits((data) => {
                    setVendorVisits(data);
                });
            }
        }

        return () => {
            unsubscribeVisitors();
            unsubscribeVendors();
            unsubscribeVendorVisits();
        };
    }, [activeTab, visitorTab]);

    // Removed loadVisitorData as subscriptions handle updates automatically

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
            return;
        }

        try {
            const start = new Date(exportDates.start);
            const end = new Date(exportDates.end);
            end.setHours(23, 59, 59);

            // 1. Fetch Device Logs
            const qLogs = query(
                collections.logs,
                where("timestamp", ">=", Timestamp.fromDate(start)),
                where("timestamp", "<=", Timestamp.fromDate(end)),
                orderBy("timestamp", "desc")
            );
            const snapsLogs = await getDocs(qLogs);
            const logsData = snapsLogs.docs.map(d => ({ ...d.data(), type: 'DEVICE', sortTime: d.data().timestamp.toDate().getTime() }));

            // 2. Fetch Visitor Logs (using checkInTime)
            const qVisitors = query(
                collections.visitors,
                where("checkInTime", ">=", Timestamp.fromDate(start)),
                where("checkInTime", "<=", Timestamp.fromDate(end))
            );
            const snapsVisitors = await getDocs(qVisitors);
            const visitorsData = snapsVisitors.docs.map(d => ({ ...d.data(), type: 'VISITOR', sortTime: d.data().checkInTime.toDate().getTime() }));

            // 3. Fetch Vendor Visits
            const qVendors = query(
                collections.vendorVisits,
                where("checkInTime", ">=", Timestamp.fromDate(start)),
                where("checkInTime", "<=", Timestamp.fromDate(end))
            );
            const snapsVendors = await getDocs(qVendors);
            const vendorsData = snapsVendors.docs.map(d => ({ ...d.data(), type: 'VENDOR', sortTime: d.data().checkInTime.toDate().getTime() }));

            const allData = [...logsData, ...visitorsData, ...vendorsData].sort((a: any, b: any) => b.sortTime - a.sortTime);

            if (allData.length === 0) {
                alert("No logs found for the selected range.");
                return;
            }

            // Generate CSV content
            const headers = ["Timestamp", "Type", "Name/Company", "ID / Contact", "Action/Status", "Details", "Device S/N"];
            const csvRows = [
                headers.join(","),
                ...allData.map((row: any) => {
                    const ts = new Date(row.sortTime).toLocaleString();
                    let type = row.type;
                    let name = '';
                    let id = '';
                    let action = '';
                    let details = '';
                    let sn = '';

                    if (type === 'DEVICE') {
                        type = 'EMPLOYEE';
                        name = row.employeeName;
                        id = row.empId;
                        action = row.action;
                        sn = row.serialNumber;
                    } else if (type === 'VISITOR') {
                        name = row.name;
                        id = row.identifier || row.phone;
                        action = row.status === 'IN' ? 'CHECK_IN' : 'CHECK_OUT';
                        details = `${row.type} - ${row.reason}`;
                        sn = row.deviceSerial || '';
                    } else if (type === 'VENDOR') {
                        name = row.vendorName; // Company
                        id = row.visitorName ? `${row.visitorName} (${row.visitorPhone})` : 'N/A';
                        action = row.status === 'IN' ? 'CHECK_IN' : 'CHECK_OUT';
                        details = row.purpose;
                    }

                    // Escape quotes
                    const escape = (str: string) => `"${str ? str.toString().replace(/"/g, '""') : ''}"`;

                    return [
                        escape(ts),
                        escape(type),
                        escape(name),
                        escape(id),
                        escape(action),
                        escape(details),
                        escape(sn)
                    ].join(",");
                })
            ];

            const csvBlob = new Blob([csvRows.join("\n")], { type: 'text/csv' });
            const url = window.URL.createObjectURL(csvBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${exportFilename || 'Minet_Master_Logs'}_${exportDates.start}_to_${exportDates.end}.csv`;
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
                            <button onClick={() => handleTabSwitch('scanner')} style={{ ...(activeTab === 'scanner' ? activeTabStyle : inactiveTabStyle), flex: 1, whiteSpace: 'nowrap' }}>
                                <ScanLine size={16} /> Scanner
                            </button>
                            <button onClick={() => handleTabSwitch('logs')} style={{ ...(activeTab === 'logs' ? activeTabStyle : inactiveTabStyle), flex: 1, whiteSpace: 'nowrap' }}>
                                <ListFilter size={16} /> Activities
                            </button>
                            <button onClick={() => handleTabSwitch('visitors')} style={{ ...(activeTab === 'visitors' ? activeTabStyle : inactiveTabStyle), flex: 1, whiteSpace: 'nowrap' }}>
                                <Users size={16} /> Visitors
                            </button>
                            <button onClick={() => handleTabSwitch('alerts')} style={{ ...(activeTab === 'alerts' ? { ...activeTabStyle, background: '#f59e0b', boxShadow: '0 4px 6px rgba(245, 158, 11, 0.2)' } : inactiveTabStyle), position: 'relative', flex: 1, whiteSpace: 'nowrap' }}>
                                <Bell size={16} /> Alerts
                                {!alertsLoading && alerts.length > 0 && (
                                    <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--primary)', color: 'white', borderRadius: '50%', minWidth: '18px', height: '18px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white', fontWeight: '800', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>{alerts.length}</span>
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
                        ) : activeTab === 'visitors' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {/* Visitor Sub-tabs */}
                                <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                                    <button
                                        onClick={() => setVisitorTab('visitors')}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            background: visitorTab === 'visitors' ? 'white' : 'transparent',
                                            fontWeight: '700',
                                            color: visitorTab === 'visitors' ? 'var(--primary)' : '#94a3b8',
                                            border: 'none',
                                            borderBottom: visitorTab === 'visitors' ? '2px solid var(--primary)' : '2px solid transparent',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        <Users size={16} /> Visitors
                                    </button>
                                    <button
                                        onClick={() => setVisitorTab('vendors')}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            background: visitorTab === 'vendors' ? 'white' : 'transparent',
                                            fontWeight: '700',
                                            color: visitorTab === 'vendors' ? 'var(--primary)' : '#94a3b8',
                                            border: 'none',
                                            borderBottom: visitorTab === 'vendors' ? '2px solid var(--primary)' : '2px solid transparent',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        <Briefcase size={16} /> Vendors
                                    </button>
                                </div>

                                {visitorTab === 'visitors' ? (
                                    <>
                                        {/* Visitor Controls */}
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <div className="glass-card" style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 1rem' }}>
                                                <Search size={18} color="#94a3b8" />
                                                <input
                                                    placeholder="Search visitors..."
                                                    value={searchVisitor}
                                                    onChange={e => setSearchVisitor(e.target.value)}
                                                    style={{ border: 'none', padding: '0.75rem', width: '100%', outline: 'none', background: 'transparent' }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button
                                                    onClick={() => {
                                                        setVisitorType('QUICK');
                                                        setVisitorForm({
                                                            name: '', phone: '', reason: '', identifier: '', destination: '',
                                                            deviceType: '', deviceMakeModel: '', deviceSerial: '', deviceColor: ''
                                                        });
                                                        setShowVisitorModal(true);
                                                    }}
                                                    className="btn-primary"
                                                    style={{ padding: '0.6rem 1rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                                                >
                                                    ⚡ Quick
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setVisitorType('STANDARD');
                                                        setVisitorForm({
                                                            name: '', phone: '', reason: '', identifier: '', destination: '',
                                                            deviceType: '', deviceMakeModel: '', deviceSerial: '', deviceColor: ''
                                                        });
                                                        setShowVisitorModal(true);
                                                    }}
                                                    style={{ ...btnActionStyle, padding: '0.6rem 1rem', fontSize: '0.8rem', background: 'white', border: '1px solid #cbd5e1', color: 'var(--secondary)', boxShadow: 'none', whiteSpace: 'nowrap' }}
                                                >
                                                    <UserPlus size={16} /> Standard
                                                </button>
                                            </div>
                                        </div>

                                        {/* Active Visitors List */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>Currently On-Site ({visitors.length})</h3>
                                            {visitors.filter(v => v.name.toLowerCase().includes(searchVisitor.toLowerCase())).map(v => (
                                                <div key={v.id} className="glass-card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <h4 style={{ margin: 0 }}>{v.name}</h4>
                                                            <span style={{ fontSize: '0.7rem', background: v.type === 'QUICK' ? '#f1f5f9' : '#e0f2fe', color: v.type === 'QUICK' ? '#64748b' : '#0284c7', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>{v.type}</span>
                                                        </div>
                                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                                                            <span style={{ fontWeight: '700', marginRight: '6px' }}>{v.identifier}</span>
                                                            {v.type === 'QUICK' ? `• ${v.reason}` : `• Visiting: ${v.destination}`}
                                                        </p>
                                                        {v.deviceType ? (
                                                            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', background: '#f8fafc', padding: '0.4rem', borderRadius: '4px', border: '1px dashed #cbd5e1' }}>
                                                                <u style={{ textDecoration: 'none', fontWeight: '700', color: '#475569' }}>Asset declared:</u> {v.deviceType} - {v.deviceMakeModel} {v.deviceSerial ? `(S/N: ${v.deviceSerial})` : ''}
                                                            </div>
                                                        ) : v.type === 'STANDARD' && (
                                                            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                                                No Asset Declared
                                                            </div>
                                                        )}
                                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>Since {v.checkInTime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm(`Check out ${v.name}?`)) {
                                                                await checkOutVisitor(v.id);
                                                                // automated update via subscription
                                                            }
                                                        }}
                                                        style={{ background: '#fee2e2', color: 'var(--danger)', border: 'none', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', fontWeight: '700', cursor: 'pointer' }}
                                                    >
                                                        Check Out
                                                    </button>
                                                </div>
                                            ))}
                                            {visitors.length === 0 && (
                                                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                                    <Users size={32} opacity={0.3} style={{ marginBottom: '1rem' }} />
                                                    <p>No visitors currently checked in.</p>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* Vendor Controls */}
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <div className="glass-card" style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 1rem' }}>
                                                <Search size={18} color="#94a3b8" />
                                                <input
                                                    placeholder="Search vendors..."
                                                    value={searchVisitor}
                                                    onChange={e => setSearchVisitor(e.target.value)}
                                                    style={{ border: 'none', padding: '0.75rem', width: '100%', outline: 'none', background: 'transparent' }}
                                                />
                                            </div>
                                            <button
                                                onClick={() => { setVendorForm({ company: '', phone: '', supplies: '', notes: '' }); setShowVendorModal(true); }}
                                                className="btn-primary"
                                                style={{ padding: '0.6rem 1rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                                            >
                                                <Plus size={16} /> New Vendor
                                            </button>
                                        </div>

                                        {/* Active Vendor Visits */}
                                        {vendorVisits.length > 0 && (
                                            <div style={{ marginBottom: '1.5rem' }}>
                                                <h3 style={{ fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <ScanLine size={14} /> Active Vendor Visits
                                                </h3>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                    {vendorVisits.map(v => (
                                                        <div key={v.id} className="glass-card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid var(--primary)' }}>
                                                            <div>
                                                                <h4 style={{ margin: 0 }}>{v.vendorName}</h4>
                                                                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                                                                    <span style={{ fontWeight: '700' }}>{v.visitorName}</span> • {v.purpose}
                                                                </p>
                                                                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>In since {v.checkInTime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                            </div>
                                                            <button
                                                                onClick={async () => {
                                                                    if (confirm(`Check out ${v.vendorName}?`)) {
                                                                        await checkOutVendorVisit(v.id);
                                                                        // automated update via subscription
                                                                    }
                                                                }}
                                                                style={{ background: 'white', border: '1px solid #e2e8f0', color: 'var(--secondary)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', fontWeight: '700', cursor: 'pointer' }}
                                                            >
                                                                Out
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Registered Vendors List */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>Registered Vendors</h3>
                                            {vendors.filter(v => v.fullName.toLowerCase().includes(searchVisitor.toLowerCase()) || v.company?.toLowerCase().includes(searchVisitor.toLowerCase())).map(v => (
                                                <div key={v.id} className="glass-card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <h4 style={{ margin: 0 }}>{v.fullName}</h4>
                                                            {v.company && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>@ {v.company}</span>}
                                                        </div>
                                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>Supplies: {v.supplies}</p>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm(`Delete vendor profile for ${v.fullName}?`)) {
                                                                    await deleteVendor(v.id);
                                                                }
                                                            }}
                                                            className="btn-danger"
                                                            style={{ padding: '0.5rem', fontSize: '0.8rem', background: '#fee2e2', color: 'var(--danger)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                            title="Delete Vendor Profile"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedVendor(v);
                                                                setVendorCheckInForm({ purpose: '', employeeName: '', employeePhone: '' });
                                                                setShowVendorCheckInModal(true);
                                                            }}
                                                            className="btn-primary"
                                                            style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                                                        >
                                                            Check In
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : activeTab === 'logs' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#64748b' }}>Today's Activities</h3>
                                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#64748b' }}>Today's Activities</h3>
                                    {/* Export button removed as requested */}
                                </div>
                                {[
                                    ...logs.map(l => ({ ...l, sortTime: l.timestamp?.toDate().getTime() || 0, type: 'DEVICE' })),
                                    ...visitorLogs.map(v => ({ ...v, sortTime: v.checkInTime?.toDate().getTime() || 0, type: 'VISITOR' })),
                                    ...vendorLogs.map(v => ({ ...v, sortTime: v.checkInTime?.toDate().getTime() || 0, type: 'VENDOR' }))
                                ].sort((a, b) => b.sortTime - a.sortTime).map((item, idx) => (
                                    <div key={`${item.type}-${item.id}-${idx}`} className="glass-card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `4px solid ${item.type === 'DEVICE' ? (item.action === 'CHECK_IN' ? '#10b981' : 'var(--primary)') : (item.status === 'IN' ? '#10b981' : '#64748b')}` }}>
                                        <div>
                                            {item.type === 'DEVICE' ? (
                                                <>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ fontWeight: '800', color: item.action === 'CHECK_IN' ? '#166534' : '#991b1b', fontSize: '0.75rem', background: item.action === 'CHECK_IN' ? '#dcfce7' : '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>
                                                            EMPLOYEE
                                                        </span>
                                                        <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{item.employeeName}</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                                                        <span style={{ fontWeight: '700', color: item.action === 'CHECK_IN' ? '#10b981' : 'var(--primary)', marginRight: '6px' }}>
                                                            {item.action === 'CHECK_IN' ? 'IN' : 'OUT'}
                                                        </span>
                                                        Device: {item.serialNumber}
                                                    </div>
                                                </>
                                            ) : item.type === 'VISITOR' ? (
                                                <>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ fontWeight: '800', color: 'var(--secondary)', fontSize: '0.75rem', background: '#e0f2fe', padding: '2px 6px', borderRadius: '4px' }}>
                                                            VISITOR
                                                        </span>
                                                        <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{item.name}</span>
                                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>({item.type /* QUICK/STANDARD */})</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                                                        {item.reason} {item.status === 'OUT' ? '(Checked Out)' : ''}
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ fontWeight: '800', color: '#b45309', fontSize: '0.75rem', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px' }}>
                                                            VENDOR
                                                        </span>
                                                        <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{item.vendorName}</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                                                        {item.purpose} {item.status === 'OUT' ? '(Checked Out)' : ''}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <Clock size={14} />
                                            {new Date(item.sortTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                ))}
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

            {/* NEW VISITOR MODAL */}
            <Modal isOpen={showVisitorModal} onClose={() => setShowVisitorModal(false)} title={`New ${visitorType} Visitor`}>
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!visitorForm.name || !visitorForm.reason) return alert("Name and Reason are required.");

                    // Validation for Quick Visitors
                    if (visitorType === 'QUICK' && !visitorForm.identifier) {
                        return alert("National ID or Passport No. is required for Quick Visitors.");
                    }

                    await addVisitor({
                        type: visitorType,
                        name: visitorForm.name,
                        phone: visitorForm.phone,
                        identifier: visitorForm.identifier,
                        destination: visitorForm.destination,
                        reason: visitorForm.reason,
                        deviceType: visitorForm.deviceType,
                        deviceMakeModel: visitorForm.deviceMakeModel,
                        deviceSerial: visitorForm.deviceSerial,
                        deviceColor: visitorForm.deviceColor
                    });
                    setShowVisitorModal(false);
                    // loadVisitorData(); // handled by subscription
                    alert("Visitor checked in successfully.");
                }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    <div>
                        <label style={labelStyle}>Full Name</label>
                        <input value={visitorForm.name} onChange={e => setVisitorForm({ ...visitorForm, name: e.target.value })} style={inputStyle} required />
                    </div>

                    {/* ID Field - Required for Both now */}
                    <div>
                        <label style={labelStyle}>National ID (or Passport No.) {visitorType === 'QUICK' && '*'}</label>
                        <input
                            value={visitorForm.identifier}
                            onChange={e => setVisitorForm({ ...visitorForm, identifier: e.target.value })}
                            style={inputStyle}
                            placeholder="e.g. ID-12345678"
                            required={visitorType === 'QUICK'}
                        />
                    </div>

                    {visitorType === 'STANDARD' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={labelStyle}>Phone Number</label>
                                <input value={visitorForm.phone} onChange={e => setVisitorForm({ ...visitorForm, phone: e.target.value })} style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Person / Office Visiting</label>
                                <input value={visitorForm.destination} onChange={e => setVisitorForm({ ...visitorForm, destination: e.target.value })} style={inputStyle} required />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label style={labelStyle}>Phone (Optional)</label>
                            <input value={visitorForm.phone} onChange={e => setVisitorForm({ ...visitorForm, phone: e.target.value })} style={inputStyle} />
                        </div>
                    )}

                    <div>
                        <label style={labelStyle}>Reason for Visit</label>
                        <input value={visitorForm.reason} onChange={e => setVisitorForm({ ...visitorForm, reason: e.target.value })} style={inputStyle} placeholder="e.g. Delivery, Meeting, Interview" required />
                    </div>

                    {visitorType === 'STANDARD' && (
                        <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0', marginTop: '0.5rem' }}>
                            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Briefcase size={16} /> Asset Declaration (Optional)
                            </h4>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={labelStyle}>Device Type</label>
                                    <input
                                        value={visitorForm.deviceType}
                                        onChange={e => setVisitorForm({ ...visitorForm, deviceType: e.target.value })}
                                        style={inputStyle}
                                        placeholder="Laptop, Tablet..."
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={labelStyle}>Make / Model</label>
                                        <input
                                            value={visitorForm.deviceMakeModel}
                                            onChange={e => setVisitorForm({ ...visitorForm, deviceMakeModel: e.target.value })}
                                            style={inputStyle}
                                            placeholder="e.g. Dell XPS"
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Color</label>
                                        <input
                                            value={visitorForm.deviceColor}
                                            onChange={e => setVisitorForm({ ...visitorForm, deviceColor: e.target.value })}
                                            style={inputStyle}
                                            placeholder="e.g. Silver"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label style={labelStyle}>Serial Number (Optional)</label>
                                    <input
                                        value={visitorForm.deviceSerial}
                                        onChange={e => setVisitorForm({ ...visitorForm, deviceSerial: e.target.value })}
                                        style={inputStyle}
                                        placeholder="e.g. ABC-123-XYZ"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>Check In Visitor</button>
                    {/* SEED BUTTON FOR DEV */}

                </form>
            </Modal>

            {/* NEW VENDOR MODAL */}
            <Modal isOpen={showVendorModal} onClose={() => setShowVendorModal(false)} title="Register New Vendor">
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!vendorForm.company || !vendorForm.phone) return alert("Company Name and Phone are required.");
                    await addVendor({
                        ...vendorForm,
                        fullName: vendorForm.company, // Map company to fullName as required by backend
                    });
                    setShowVendorModal(false);
                    alert("Vendor registered.");
                }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={labelStyle}>Vendor Company Name</label>
                        <input
                            value={vendorForm.company}
                            onChange={e => setVendorForm({ ...vendorForm, company: e.target.value })}
                            style={inputStyle}
                            placeholder="e.g. TechCorp Solutions"
                            required
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Company Phone Contacts</label>
                        <input
                            value={vendorForm.phone}
                            onChange={e => setVendorForm({ ...vendorForm, phone: e.target.value })}
                            style={inputStyle}
                            placeholder="e.g. 020-XXXXXXX"
                            required
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Supplies / Service</label>
                        <input value={vendorForm.supplies} onChange={e => setVendorForm({ ...vendorForm, supplies: e.target.value })} style={inputStyle} placeholder="e.g. Water, Catering" required />
                    </div>
                    <div>
                        <label style={labelStyle}>Notes</label>
                        <input value={vendorForm.notes} onChange={e => setVendorForm({ ...vendorForm, notes: e.target.value })} style={inputStyle} />
                    </div>
                    <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>Create Profile</button>
                </form>
            </Modal>

            {/* VENDOR CHECK-IN MODAL */}
            <Modal isOpen={showVendorCheckInModal} onClose={() => setShowVendorCheckInModal(false)} title="Vendor Check-In">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                        <h3 style={{ margin: '0 0 0.5rem 0' }}>{selectedVendor?.fullName}</h3>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>{selectedVendor?.company}</p>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>{selectedVendor?.supplies}</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={labelStyle}>Employee Name (Visitor)</label>
                            <input
                                value={vendorCheckInForm.employeeName}
                                onChange={e => setVendorCheckInForm({ ...vendorCheckInForm, employeeName: e.target.value })}
                                style={inputStyle}
                                placeholder="e.g. John Doe"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Phone Number</label>
                            <input
                                value={vendorCheckInForm.employeePhone}
                                onChange={e => setVendorCheckInForm({ ...vendorCheckInForm, employeePhone: e.target.value })}
                                style={inputStyle}
                                placeholder="07XX XXX XXX"
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Purpose of Visit</label>
                            <input
                                value={vendorCheckInForm.purpose}
                                onChange={e => setVendorCheckInForm({ ...vendorCheckInForm, purpose: e.target.value })}
                                style={inputStyle}
                                placeholder="e.g. Weekly Delivery, Maintenance"
                            />
                        </div>
                    </div>

                    <button
                        onClick={async () => {
                            if (!vendorCheckInForm.purpose || !vendorCheckInForm.employeeName) return alert("Name and Purpose are required.");
                            await checkInVendor(
                                selectedVendor.id,
                                vendorCheckInForm.purpose,
                                selectedVendor.fullName, // Company Name
                                vendorCheckInForm.employeeName,
                                vendorCheckInForm.employeePhone
                            );
                            setShowVendorCheckInModal(false);
                            // loadVisitorData(); // handled by subscription
                            alert("Vendor checked in.");
                        }}
                        className="btn-primary"
                        style={{ marginTop: '0.5rem' }}
                    >
                        Confirm Check-In
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
