import React, { useState, useEffect } from 'react';
import {
    getEmployees,
    getDevices,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addDevice,
    updateDevice,
    retireDevice,
    addLog,
    subscribeToSystemUsers,
    createSystemUser,
    updateSystemUser,
    deleteSystemUser,
    renewUserPassword,
    subscribeToEmployees,
    subscribeToDevices,
    logSystemEvent,
    getEmployeeByEmpId,
    getToken,
    getUser
} from '../services/api';

import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Search,
    Users,
    Laptop,
    Smartphone,
    X,
    Camera,
    Printer,
    Trash2,
    LogOut,
    UploadCloud,
    AlertTriangle,
    Bell,
    Shield,
    ShieldCheck,
    UserCheck,
    UserX,
    Key,
    RefreshCw,
    History
} from 'lucide-react';
import EmployeeCard from '../components/EmployeeCard';
import DeviceCard from '../components/DeviceCard';
import Modal from '../components/Modal';
// @ts-ignore
import { generateQRCode } from '../utils/qr';
import { getSystemAlerts, type Alert } from '../utils/alerts';
import { CheckCircle2 } from 'lucide-react';

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState<'employees' | 'company' | 'byod' | 'alerts' | 'users' | 'audit_logs'>('employees');
    const [userRole, setUserRole] = useState<string | null>(null);
    const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
    const [systemUsers, setSystemUsers] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [devices, setDevices] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [alertsLoading, setAlertsLoading] = useState(false);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [newAccountInfo, setNewAccountInfo] = useState<{ username: string, email: string } | null>(null);

    const navigate = useNavigate();

    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [isAddingEmployee, setIsAddingEmployee] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'device' | 'qr'>('device');
    const [editingDevice, setEditingDevice] = useState<any>(null);
    const [qrData, setQrData] = useState<{ url: string, device: any } | null>(null);

    const [empForm, setEmpForm] = useState({ empId: '', name: '', departmentOrFloor: '' });
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [devForm, setDevForm] = useState({ serialNumber: '', make: '', model: '', color: '', assignedTo: '' });
    const [isDragging, setIsDragging] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [assigningType, setAssigningType] = useState<'COMPANY' | 'BYOD' | null>(null);
    const [assignSearch, setAssignSearch] = useState('');
    const [showEmpFormModal, setShowEmpFormModal] = useState(false);
    const [showUserModal, setShowUserModal] = useState(false);
    const [userForm, setUserForm] = useState({ name: '', role: 'admin' as any, email: '', empId: '' });
    const [editingUser, setEditingUser] = useState<any>(null);
    const [detailsHighlight, setDetailsHighlight] = useState(false);
    const detailsPanelRef = React.useRef<HTMLDivElement | null>(null);

    const [isInitializing, setIsInitializing] = useState(true);
    const [initError, setInitError] = useState<string | null>(null);

    const resetMobileState = () => {
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
            setSelectedEmployee(null);
            setIsAddingEmployee(false);
            setEmpForm({ empId: '', name: '', departmentOrFloor: '' });
            setPhotoFile(null);
            setAssigningType(null);
            setModalOpen(false);
            setQrData(null);
            setEditingDevice(null);
            setDevForm({ serialNumber: '', make: '', model: '', color: '', assignedTo: '' });
            setShowEmpFormModal(false);
        }
    };

    const handleTabSwitch = (tab: typeof activeTab) => {
        setActiveTab(tab);
        resetMobileState();
    };

    // 1. Initial Profile/Role from JWT
    useEffect(() => {
        const token = getToken();
        if (!token) {
            setInitError("No session found. Please log in.");
            setIsInitializing(false);
            return;
        }

        const user = getUser();
        if (user) {
            setCurrentUserProfile(user);
            setUserRole(user.role);
            if (user.role === 'superadmin') {
                setActiveTab('users');
            }
            setIsInitializing(false);
        } else {
            setInitError("Session expired. Please log in again.");
            setIsInitializing(false);
        }
    }, []);

    // 2. Data Subscriptions
    useEffect(() => {
        if (isInitializing || initError || !userRole) return;

        const unsubEmps = subscribeToEmployees((data) => setEmployees(data));
        const unsubDevs = subscribeToDevices((data) => setDevices(data));

        let unsubUsers = () => { };
        if (activeTab === 'users' || userRole === 'superadmin') {
            unsubUsers = subscribeToSystemUsers((data) => setSystemUsers(data));
        }

        loadData();

        return () => {
            unsubEmps();
            unsubDevs();
            unsubUsers();
        };
    }, [activeTab, userRole, isInitializing, initError]);

    const loadData = async (refreshAlerts = false) => {
        try {
            const [emps, devs] = await Promise.all([getEmployees(), getDevices()]);
            setEmployees(emps);
            setDevices(devs);

            if (refreshAlerts || activeTab === 'alerts') {
                setAlertsLoading(true);
                const activeAlerts = await getSystemAlerts(devs);
                setAlerts(activeAlerts);
            }

            if (activeTab === 'audit_logs') {
                const res = await fetch('/api/audit?limit=100', {
                    headers: { 'Authorization': `Bearer ${getToken()}` }
                });
                const data = await res.json();
                setAuditLogs(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Data load error:", err);
        } finally {
            setAlertsLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'alerts' && alerts.length === 0) loadData(true);
        if (activeTab === 'audit_logs') loadData();
    }, [activeTab]);

    const handleEmployeeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!empForm.empId && isAddingEmployee) { alert("Employee ID is required."); return; }
        if (!empForm.name) { alert("Employee Name is required."); return; }

        setIsSubmitting(true);
        try {
            if (isAddingEmployee) {
                await addEmployee({
                    empId: empForm.empId.trim(),
                    name: empForm.name.trim(),
                    departmentOrFloor: empForm.departmentOrFloor.trim(),
                    photoFile: photoFile || undefined
                });
                alert("Employee added successfully!");
            } else {
                if (!selectedEmployee?.emp_id) throw new Error("No employee selected for update");
                  await updateEmployee(selectedEmployee.emp_id, {
                    name: empForm.name.trim(),
                    departmentOrFloor: empForm.departmentOrFloor.trim(),
                    photoFile: photoFile || undefined
                });
                alert("Employee updated successfully!");
            }
            setIsAddingEmployee(false);
            setSelectedEmployee(null);
            setEmpForm({ empId: '', name: '', departmentOrFloor: '' });
            setPhotoFile(null);
        } catch (err: any) {
            alert("Error saving employee: " + (err.message || "Unknown error"));
            setIsSubmitting(false);
        } finally {
            setTimeout(() => setIsSubmitting(false), 500);
        }
    };

    const handleDeviceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const type = activeTab === 'company' ? 'COMPANY' : 'BYOD';

            if (!devForm.assignedTo && !editingDevice) {
                alert("All devices must be assigned to an employee at registration.");
                return;
            }

            if (devForm.assignedTo) {
                const assignedDevices = devices.filter(d =>
                    d.assigned_to === devForm.assignedTo &&
                    d.type === type &&
                    d.serial_number !== devForm.serialNumber
                );
                if (type === 'COMPANY' && assignedDevices.length >= 1) {
                    alert(`This employee already has a COMPANY laptop assigned (${assignedDevices[0].serial_number}). Only one per type is permitted.`);
                    return;
                }
                if (type === 'BYOD' && assignedDevices.length >= 2) {
                    alert(`This employee has reached the maximum allowed BYOD devices (2).`);
                    return;
                }
            }

            if (editingDevice) {
                await updateDevice(editingDevice.serial_number, { ...devForm, type });
                alert("Device saved successfully!");
            } else {
                await addDevice({ ...devForm, type: type as any });

                if (type === 'BYOD') {
                    const employee = employees.find(e => e.emp_id === devForm.assignedTo);
                    if (employee) {
                        try {
                            await addLog({
                                empId: employee.emp_id,
                                employeeName: employee.name,
                                serialNumber: devForm.serialNumber,
                                action: 'CHECK_IN'
                            });
                            alert("BYOD registered successfully. Device has been checked in.");
                        } catch (err) {
                            alert("Device saved, but auto check-in failed.");
                        }
                    } else {
                        alert("Device saved successfully!");
                    }
                } else {
                    alert("Device saved successfully!");
                }
            }
            setModalOpen(false);
            resetMobileState();
        } catch (err: any) {
            alert("Error: " + err.message);
        }
    };

    const handleGenerateQR = async (device: any) => {
        try {
            const employee = employees.find(e => e.emp_id === device.assigned_to);
            const photoVal = (employee?.photo_url && employee.photo_url.startsWith('data:'))
                ? "[BASE64_IMAGE]"
                : (employee?.photo_url || '');

            const metadata = {
                serialNumber: device.serial_number,
                empId: device.assigned_to || 'Unassigned',
                employeeName: employee?.name || 'N/A',
                make: device.make,
                model: device.model,
                color: device.color || 'N/A',
                type: device.type,
                employeePhotoURL: photoVal
            };
            const url = await generateQRCode(metadata);

            await updateDevice(device.serial_number, { qrCodeUrl: url });

            setQrData({ url, device: metadata });
            setModalType('qr');
            setModalOpen(true);
            loadData();
        } catch (err) {
            alert("Failed to generate QR code.");
        }
    };

    const handlePrintLabel = () => {
        if (!qrData) { alert("Error: No label data available. Please regenerate the QR code."); return; }
        localStorage.setItem('printLabelData', JSON.stringify(qrData));
        navigate('/print-label', { state: qrData });
    };

    const filteredEmployees = employees.filter(e =>
        String(e.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(e.emp_id || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredDevices = devices.filter(d =>
        (activeTab === 'company' ? d.type === 'COMPANY' : d.type === 'BYOD') &&
        String(d.serial_number || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getAssignedDevices = (empId: string) => devices.filter(d => d.assigned_to === empId);

    // Conditional rendering - AFTER all hooks
    if (initError) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc', flexDirection: 'column', gap: '1.5rem', padding: '2rem' }}>
                <div style={{ fontSize: '3rem' }}>⚠️</div>
                <h2 style={{ color: 'var(--danger)', margin: 0 }}>Initialization Error</h2>
                <p style={{ color: '#64748b', textAlign: 'center', maxWidth: '400px' }}>{initError}</p>
                <button onClick={() => window.location.href = '/'} className="btn-primary" style={{ padding: '0.75rem 2rem' }}>Return to Login</button>
            </div>
        );
    }

    if (isInitializing) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc', flexDirection: 'column', gap: '1rem' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <p style={{ color: '#64748b', fontWeight: '600' }}>Loading Management Portal...</p>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!userRole) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ fontSize: '3rem' }}>🔒</div>
                <h2 style={{ color: '#64748b', margin: 0 }}>Access Denied</h2>
                <p style={{ color: '#94a3b8' }}>Unable to verify your permissions.</p>
                <button onClick={() => { localStorage.removeItem('minet_token'); localStorage.removeItem('minet_user'); window.location.href = '/tracker/'; }} className="btn-primary">Return to Login</button>
            </div>
        );
    }

    return (
        <div className="admin-dashboard" style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <header style={{ background: 'white', padding: '1.25rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div>
                    <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--primary)', lineHeight: 1.1 }}>Minet Laptop Tracking System</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Shield size={14} /> IT ADMIN DASHBOARD | HELLO {currentUserProfile?.name || 'ADMIN'}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button
                        onClick={async () => {
                            if (confirm('Are you sure you want to logout?')) {
                                const user = getUser();
                                await logSystemEvent(
                                    { type: 'LOGOUT', category: 'AUTH' },
                                    { id: user?.id || 'unknown', type: 'USER' },
                                    'SUCCESS',
                                    'User initiated logout'
                                );
                                localStorage.removeItem('minet_token');
                                localStorage.removeItem('minet_user');
                                window.location.href = '/tracker/';
                            }
                        }}
                        style={{ background: 'rgba(226, 26, 34, 0.05)', border: '1px solid rgba(226, 26, 34, 0.2)', color: 'var(--primary)', fontWeight: '700', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                    >
                        <LogOut size={18} /> <span>Logout</span>
                    </button>
                </div>
            </header>

            <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem', width: '100%', boxSizing: 'border-box', flex: 1 }}>
                {/* Tabs */}
                <div className="tabs-container" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                    <button onClick={() => handleTabSwitch('employees')} style={{ ...(activeTab === 'employees' ? activeTabBtn : inactiveTabBtn), whiteSpace: 'nowrap' }}><Users size={16} /> Employees</button>
                    <button onClick={() => handleTabSwitch('company')} style={{ ...(activeTab === 'company' ? activeTabBtn : inactiveTabBtn), whiteSpace: 'nowrap' }}><Laptop size={16} /> Company</button>
                    <button onClick={() => handleTabSwitch('byod')} style={{ ...(activeTab === 'byod' ? activeTabBtn : inactiveTabBtn), whiteSpace: 'nowrap' }}><Smartphone size={16} /> BYOD</button>
                    <button onClick={() => handleTabSwitch('alerts')} style={{ ...(activeTab === 'alerts' ? { ...activeTabBtn, background: '#f59e0b', boxShadow: '0 4px 6px rgba(245, 158, 11, 0.2)' } : inactiveTabBtn), position: 'relative', whiteSpace: 'nowrap' }}>
                        <Bell size={16} /> Alerts
                        {!alertsLoading && alerts.length > 0 && (
                            <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--primary)', color: 'white', borderRadius: '50%', minWidth: '18px', height: '18px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white', fontWeight: '800' }}>{alerts.length}</span>
                        )}
                    </button>
                    {userRole === 'superadmin' && (
                        <>
                            <button onClick={() => handleTabSwitch('users')} style={{ ...(activeTab === 'users' ? activeTabBtn : inactiveTabBtn), whiteSpace: 'nowrap' }}><Users size={16} /> User Management</button>
                            <button onClick={() => handleTabSwitch('audit_logs')} style={{ ...(activeTab === 'audit_logs' ? activeTabBtn : inactiveTabBtn), whiteSpace: 'nowrap' }}><History size={16} /> Audit Logs</button>
                        </>
                    )}
                </div>

                {activeTab === 'employees' ? (
                    <div className="employee-details-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 450px', gap: '2rem' }}>
                        {/* List Section */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="admin-actions" style={{ display: 'flex', gap: '1rem' }}>
                                <div className="glass-card search-card" style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 1.25rem' }}>
                                    <Search size={20} color="#94a3b8" />
                                    <input type="text" placeholder="Search employees..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ border: 'none', padding: '1rem', width: '100%', outline: 'none', background: 'transparent' }} />
                                </div>
                                <button onClick={() => loadData(true)} className="glass-card compact-card" style={{ padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', cursor: 'pointer' }}>
                                    <RefreshCw size={20} /> Refresh
                                </button>
                                <button onClick={() => {
                                    const isMobile = window.matchMedia('(max-width: 768px)').matches;
                                    setIsAddingEmployee(true);
                                    setSelectedEmployee(null);
                                    setEmpForm({ empId: '', name: '', departmentOrFloor: '' });
                                    setPhotoFile(null);
                                    if (isMobile) setShowEmpFormModal(true);
                                }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                                    <Plus size={20} /> Add Employee
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {filteredEmployees.map(emp => (
                                    <EmployeeCard
                                        key={emp.id}
                                        employee={emp}
                                        onEdit={(e) => {
                                            setSelectedEmployee(e);
                                            setIsAddingEmployee(false);
                                            setEmpForm({ empId: e.emp_id, name: e.name, departmentOrFloor: e.department });
                                            setPhotoFile(null);
                                            setIsSubmitting(false);
                                        }}
                                        onDelete={async (id) => { if (confirm('Delete employee?')) { await deleteEmployee(id); loadData(); resetMobileState(); } }}
                                        onView={(e) => {
                                            setSelectedEmployee(e);
                                            setIsAddingEmployee(false);
                                            setEmpForm({ empId: e.emp_id, name: e.name, departmentOrFloor: e.department });
                                            setPhotoFile(null);
                                            setIsSubmitting(false);
                                            const isMobile = window.matchMedia('(max-width: 768px)').matches;
                                            if (isMobile && detailsPanelRef.current) {
                                                detailsPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                setDetailsHighlight(true);
                                                setTimeout(() => setDetailsHighlight(false), 1200);
                                            }
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Details Panel */}
                        <aside ref={detailsPanelRef} className="glass-card" style={{ padding: '2.5rem', height: 'fit-content', position: 'sticky', top: '100px', boxShadow: detailsHighlight ? '0 0 0 3px rgba(226, 26, 34, 0.25)' : undefined }}>
                            {isAddingEmployee || selectedEmployee ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h2 style={{ fontSize: '1.5rem', color: 'var(--secondary)' }}>{isAddingEmployee ? 'New Employee' : 'Employee Details'}</h2>
                                        <button onClick={() => { setIsAddingEmployee(false); setSelectedEmployee(null); setPhotoFile(null); setIsSubmitting(false); setAssigningType(null); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={24} /></button>
                                    </div>

                                    {assigningType ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <button onClick={() => setAssigningType(null)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '700', cursor: 'pointer' }}>← Back</button>
                                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Assign {assigningType} Laptop</h3>
                                            </div>
                                            <div className="glass-card" style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', background: '#f8fafc' }}>
                                                <Search size={16} color="#94a3b8" />
                                                <input placeholder="Search SN, Make, Model..." value={assignSearch} onChange={e => setAssignSearch(e.target.value)} style={{ border: 'none', padding: '0.75rem', width: '100%', outline: 'none', background: 'transparent', fontSize: '0.9rem' }} />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                                                {devices.filter(d => d.type === assigningType && !d.assigned_to)
                                                    .filter(d => String(d.serial_number || '').toLowerCase().includes(assignSearch.toLowerCase()) || String(d.make || '').toLowerCase().includes(assignSearch.toLowerCase()) || String(d.model || '').toLowerCase().includes(assignSearch.toLowerCase()))
                                                    .length > 0 ? (
                                                    devices.filter(d => d.type === assigningType && !d.assigned_to)
                                                        .filter(d => String(d.serial_number || '').toLowerCase().includes(assignSearch.toLowerCase()) || String(d.make || '').toLowerCase().includes(assignSearch.toLowerCase()) || String(d.model || '').toLowerCase().includes(assignSearch.toLowerCase()))
                                                        .map(dev => (
                                                            <div key={dev.serial_number} className="glass-card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <div>
                                                                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{dev.make} {dev.model}</div>
                                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>S/N: {dev.serial_number}</div>
                                                                </div>
                                                                <button onClick={async () => {
                                                                    try {
                                                                        await updateDevice(dev.serial_number, { assignedTo: selectedEmployee.emp_id });
                                                                        setAssigningType(null);
                                                                        alert("Device assigned successfully!");
                                                                    } catch (err: any) { alert(err.message); }
                                                                }} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>Assign</button>
                                                            </div>
                                                        ))
                                                ) : (
                                                    <div style={{ textAlign: 'center', padding: '2rem', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px dashed #cbd5e1' }}>
                                                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>No available {assigningType} laptops found.</p>
                                                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>Please register the device in the Inventory tab first.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleEmployeeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                                                <div
                                                    style={{ position: 'relative', width: '100%', height: '200px', margin: '0 auto', border: `2px dashed ${isDragging ? 'var(--primary)' : '#cbd5e1'}`, borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', background: isDragging ? 'rgba(226, 26, 34, 0.05)' : '#f8fafc', overflow: 'hidden', cursor: 'pointer' }}
                                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                                    onDragLeave={() => setIsDragging(false)}
                                                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files?.[0]) setPhotoFile(e.dataTransfer.files[0]); }}
                                                    onClick={() => document.getElementById('employee-photo-input')?.click()}
                                                >
                                                    {photoFile || selectedEmployee?.photo_url ? (
                                                        <>
                                                            <img src={photoFile ? URL.createObjectURL(photoFile) : selectedEmployee?.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Employee" />
                                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }} onMouseOver={e => e.currentTarget.style.opacity = '1'} onMouseOut={e => e.currentTarget.style.opacity = '0'}>
                                                                <Camera color="white" size={32} />
                                                                <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: '700', marginTop: '0.5rem' }}>Change Photo</span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div style={{ background: 'white', padding: '1rem', borderRadius: '50%', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                                                                <UploadCloud size={32} color="var(--primary)" />
                                                            </div>
                                                            <div style={{ textAlign: 'center' }}>
                                                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b', fontWeight: '700' }}>Drop photo here</p>
                                                                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>or click to browse</p>
                                                            </div>
                                                        </>
                                                    )}
                                                    <input id="employee-photo-input" type="file" style={{ display: 'none' }} accept="image/*" onChange={e => { if (e.target.files?.[0]) setPhotoFile(e.target.files[0]); }} />
                                                </div>
                                                {(photoFile || selectedEmployee?.photo_url) && (
                                                    <button type="button" style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '700', marginTop: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }} onClick={(e) => { e.stopPropagation(); setPhotoFile(null); }}>
                                                        Remove Current Photo
                                                    </button>
                                                )}
                                            </div>

                                            <div>
                                                <label style={labelStyle}>Employee ID</label>
                                                <input value={empForm.empId} onChange={e => setEmpForm({ ...empForm, empId: e.target.value })} placeholder="e.g. EMP1001" style={inputStyle} disabled={!!selectedEmployee} required />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Full Name</label>
                                                <input value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} style={inputStyle} required />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Department / Floor</label>
                                                <input value={empForm.departmentOrFloor} onChange={e => setEmpForm({ ...empForm, departmentOrFloor: e.target.value })} placeholder="e.g. IT - Floor 4" style={inputStyle} required />
                                            </div>

                                            {!isAddingEmployee && (
                                                <div style={{ padding: '1.5rem', background: '#f1f5f9', borderRadius: 'var(--radius-sm)', marginTop: '1rem' }}>
                                                    <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Laptop size={16} /> Asset Inventory</h4>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                        {['COMPANY', 'BYOD'].map(type => {
                                                            const dev = getAssignedDevices(selectedEmployee.emp_id).find(d => d.type === type);
                                                            return (
                                                                <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '0.75rem', background: 'white', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                                                                        <span style={{ color: '#475569', fontWeight: '800' }}>{type} LAPTOP</span>
                                                                        {dev ? (
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                                                <span style={{ fontWeight: '700', color: 'var(--primary)', background: 'rgba(226, 26, 34, 0.05)', padding: '2px 6px', borderRadius: '4px' }}>{dev.serial_number}</span>
                                                                                <button type="button" onClick={async () => { if (confirm('Unassign this device?')) { await updateDevice(dev.serial_number, { assignedTo: null }); loadData(); } }} style={{ background: '#fee2e2', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}>
                                                                                    <Trash2 size={14} />
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <button type="button" onClick={() => { setAssigningType(type as any); setAssignSearch(''); }} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}>+ Assign</button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            <button type="submit" className="btn-primary" style={{ marginTop: '1rem', opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }} disabled={isSubmitting}>
                                                {isSubmitting ? 'Processing...' : (isAddingEmployee ? 'Register Employee' : 'Update Profile')}
                                            </button>
                                        </form>
                                    )}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '4rem 0', color: '#94a3b8' }}>
                                    <Users size={48} style={{ margin: '0 auto 1rem' }} opacity={0.3} />
                                    <p>Select an employee to view details or manage assets</p>
                                </div>
                            )}
                        </aside>
                    </div>
                ) : activeTab === 'users' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="admin-actions" style={{ display: 'flex', gap: '1rem', flex: 1 }}>
                                <div className="glass-card search-card" style={{ flex: 1, maxWidth: '500px', display: 'flex', alignItems: 'center', padding: '0 1.25rem' }}>
                                    <Search size={20} color="#94a3b8" />
                                    <input type="text" placeholder="Search users..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ border: 'none', padding: '1rem', width: '100%', outline: 'none', background: 'transparent' }} />
                                </div>
                                <button onClick={() => { setEditingUser(null); setUserForm({ name: '', role: 'admin', email: '', empId: '' }); setShowUserModal(true); }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Plus size={20} /> Create User
                                </button>
                            </div>
                        </div>

                        <div className="user-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                            {systemUsers.filter(u =>
                                String(u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                String(u.username || '').toLowerCase().includes(searchTerm.toLowerCase())
                            ).map(user => (
                                <div key={user.id} className="glass-card" style={{ padding: '1.5rem', opacity: user.is_active === false ? 0.6 : 1, borderLeft: `4px solid ${user.role === 'superadmin' ? '#7c3aed' : user.role === 'admin' ? 'var(--primary)' : '#64748b'}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                                {user.role === 'superadmin' ? <ShieldCheck size={24} /> : user.role === 'admin' ? <Key size={24} /> : <Users size={24} />}
                                            </div>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{user.name}</h4>
                                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Username: <strong>{user.username || 'N/A'}</strong></p>
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>{user.email}</p>
                                                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                                                    <span style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9' }}>{user.role}</span>
                                                    {user.is_active === false && <span style={{ fontSize: '0.7rem', fontWeight: '800', background: '#fee2e2', color: 'var(--danger)', padding: '2px 8px', borderRadius: '4px' }}>DISABLED</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="user-card-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                            <button onClick={() => { setEditingUser(user); setUserForm({ name: user.name, role: user.role, email: user.email || '', empId: user.emp_id || '' }); setShowUserModal(true); }} style={{ background: 'white', border: '1px solid #e2e8f0', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer' }} title="Edit User">⚙️</button>
                                            {userRole === 'superadmin' && (
                                                <button
                                                    onClick={async () => {
                                                        if (confirm(`Send password reset email to ${user.name}?`)) {
                                                            try {
                                                                await renewUserPassword(user.id);
                                                                alert("Password reset email sent successfully!");
                                                            } catch (err: any) { alert("Failed: " + err.message); }
                                                        }
                                                    }}
                                                    style={{ background: '#fef3c7', border: '1px solid #fde68a', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', color: '#92400e' }}
                                                    title="Renew Password"
                                                >
                                                    <RefreshCw size={18} />
                                                </button>
                                            )}
                                            <button
                                                onClick={async () => {
                                                    if (confirm(`${user.is_active === false ? 'Enable' : 'Disable'} account for ${user.name}?`)) {
                                                        await updateSystemUser(user.id, { isActive: user.is_active === false });
                                                    }
                                                }}
                                                style={{ background: user.is_active === false ? '#dcfce7' : '#fee2e2', border: 'none', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', color: user.is_active === false ? '#166534' : 'var(--danger)' }}
                                                title={user.is_active === false ? 'Enable' : 'Disable'}
                                            >
                                                {user.is_active === false ? <UserCheck size={18} /> : <UserX size={18} />}
                                            </button>
                                            {userRole === 'superadmin' && (
                                                <button
                                                    onClick={async () => {
                                                        if (confirm(`PERMANENTLY DELETE ${user.name}?`)) {
                                                            try {
                                                                await deleteSystemUser(user.id);
                                                            } catch (err: any) { alert(err.message); }
                                                        }
                                                    }}
                                                    style={{ background: '#fee2e2', border: 'none', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', color: 'var(--danger)' }}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '1.25rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Created {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</span>
                                            <span>Last login: {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : activeTab === 'alerts' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '1.5rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <AlertTriangle size={32} color="#f59e0b" />
                            <div>
                                <h3 style={{ margin: 0, color: '#92400e' }}>Active Security Violation Alerts</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: '#b45309' }}>Monitoring COMPANY devices out of office beyond permitted durations.</p>
                            </div>
                        </div>
                        {alertsLoading ? (
                            <div style={{ textAlign: 'center', padding: '4rem' }}><p>Refreshing security status...</p></div>
                        ) : alerts.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                                <Bell size={48} opacity={0.2} style={{ margin: '0 auto 1.5rem' }} />
                                <p>No security alerts at this time.</p>
                            </div>
                        ) : (
                            <div className="alert-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1rem' }}>
                                {alerts.map(alert => (
                                    <div key={alert.id} className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid #f59e0b' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{alert.employeeName}</h4>
                                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '700' }}>{alert.empId}</p>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: '800', background: '#fef3c7', color: '#92400e', padding: '4px 8px', borderRadius: '4px' }}>
                                                {alert.reason === 'OVERTIME_WEEKDAY' ? 'OVERTIME' : 'WEEKEND STAY'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                                            <p style={{ margin: 0 }}>Device: <strong>{alert.serialNumber}</strong></p>
                                            <p style={{ margin: 0 }}>Out Since: <strong>{alert.checkedOutAt.toLocaleString()}</strong></p>
                                            <p style={{ margin: 0, color: 'var(--primary)', fontWeight: '700' }}>Duration: {alert.durationHrs} Hours</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : activeTab === 'audit_logs' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--secondary)', margin: 0 }}>System Audit Logs</h2>
                            <div style={{ display: 'flex', gap: '1rem', flex: 1, justifyContent: 'flex-end' }}>
                                <div className="glass-card compact-card" style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', flex: 1, maxWidth: '400px' }}>
                                    <Search size={18} color="#94a3b8" />
                                    <input type="text" placeholder="Search logs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ border: 'none', padding: '0.75rem', width: '100%', outline: 'none', background: 'transparent', fontSize: '0.9rem' }} />
                                </div>
                                <button onClick={() => loadData(true)} className="glass-card compact-card" style={{ padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', cursor: 'pointer' }}>
                                    <RefreshCw size={20} /> Refresh
                                </button>
                            </div>
                        </div>

                        <div className="glass-card" style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                        <th style={{ padding: '1rem', fontWeight: '600', color: '#64748b' }}>Time</th>
                                        <th style={{ padding: '1rem', fontWeight: '600', color: '#64748b' }}>Actor</th>
                                        <th style={{ padding: '1rem', fontWeight: '600', color: '#64748b' }}>Action</th>
                                        <th style={{ padding: '1rem', fontWeight: '600', color: '#64748b' }}>Target</th>
                                        <th style={{ padding: '1rem', fontWeight: '600', color: '#64748b' }}>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditLogs.filter(log =>
                                        searchTerm === '' ||
                                        String(log.actor_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        String(log.event_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        String(log.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        String(log.target_id || '').toLowerCase().includes(searchTerm.toLowerCase())
                                    ).map((log) => (
                                        <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '1rem', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                                                <div style={{ fontWeight: '600' }}>{new Date(log.created_at).toLocaleDateString()}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{new Date(log.created_at).toLocaleTimeString()}</div>
                                            </td>
                                            <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                                                <div style={{ fontWeight: '600' }}>{log.actor_name || 'Unknown'}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{log.actor_email}</div>
                                            </td>
                                            <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                                                <span style={{ background: log.status === 'FAILURE' ? '#fee2e2' : '#f1f5f9', color: log.status === 'FAILURE' ? 'var(--danger)' : 'var(--secondary)', padding: '2px 8px', borderRadius: '4px', fontWeight: '700', fontSize: '0.75rem' }}>
                                                    {log.event_type || 'UNKNOWN'}
                                                </span>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>{log.category}</div>
                                            </td>
                                            <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{log.target_type}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>ID: {log.target_id}</div>
                                            </td>
                                            <td style={{ padding: '1rem', maxWidth: '300px', verticalAlign: 'top' }}>{log.description}</td>
                                        </tr>
                                    ))}
                                    {auditLogs.length === 0 && (
                                        <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No audit logs found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* Device Tabs */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="admin-actions" style={{ display: 'flex', gap: '1rem' }}>
                            <div className="glass-card search-card" style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 1.25rem' }}>
                                <Search size={20} color="#94a3b8" />
                                <input type="text" placeholder={`Search ${activeTab} serial...`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ border: 'none', padding: '1rem', width: '100%', outline: 'none', background: 'transparent' }} />
                            </div>
                            <button onClick={() => loadData(true)} className="glass-card compact-card" style={{ padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', cursor: 'pointer' }}>
                                <RefreshCw size={20} /> Refresh
                            </button>
                            <button onClick={() => { setModalType('device'); setEditingDevice(null); setDevForm({ serialNumber: '', make: '', model: '', color: '', assignedTo: '' }); setModalOpen(true); }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Plus size={20} /> Add {activeTab === 'company' ? 'Laptop' : 'Device'}
                            </button>
                        </div>

                        <div className="device-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                            {filteredDevices.map(dev => (
                                <DeviceCard
                                    key={dev.id}
                                    device={dev}
                                    onEdit={(d) => { setEditingDevice(d); setDevForm({ serialNumber: d.serial_number, make: d.make, model: d.model, color: d.color, assignedTo: d.assigned_to || '' }); setModalType('device'); setModalOpen(true); }}
                                    onDelete={async (id) => { if (confirm('Retire this device permanently?')) { await retireDevice(id); resetMobileState(); } }}
                                    onGenerateQR={handleGenerateQR}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* Device/QR Modal */}
            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modalType === 'qr' ? 'Security QR Code' : 'Device Management'}>
                {modalType === 'qr' ? (
                    <div className="qr-preview-container">
                        <div id="printable-label">
                            <div className="label-header">
                                <div className="label-logo-box">
                                    <img src="/tracker/logo.png" className="label-logo" alt="Minet" />
                                </div>
                                <div className="label-tag">ASSET TAG</div>
                            </div>
                            <img src={qrData?.url} className="label-qr" alt="QR Code" />
                            <div className="label-info">
                                <h3 className="label-title">{qrData?.device.make} {qrData?.device.model}</h3>
                                <p className="label-sn">S/N: {qrData?.device.serialNumber}</p>
                                <p className="label-user">User: {qrData?.device.employeeName}</p>
                            </div>
                        </div>
                        <div className="no-print button-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <button className="btn-primary" onClick={handlePrintLabel} style={{ width: '100%', justifyContent: 'center' }}>
                                <Printer size={18} /> Print Label
                            </button>
                            <button type="button" style={{ padding: '0.75rem', background: 'white', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 'var(--radius-sm)', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', fontSize: '0.875rem' }}
                                onClick={() => {
                                    if (!qrData?.url) return;
                                    const filename = `${qrData.device.type}-${qrData.device.serialNumber}-${qrData.device.employeeName}.png`.replace(/[^a-z0-9\-\. ]/gi, '_');
                                    const link = document.createElement('a');
                                    link.href = qrData.url;
                                    link.download = filename;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                }}>
                                ⬇️ Download Image
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleDeviceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div>
                            <label style={labelStyle}>Serial Number</label>
                            <input value={devForm.serialNumber} onChange={e => setDevForm({ ...devForm, serialNumber: e.target.value })} placeholder="e.g. MINET-LAP-101" style={inputStyle} required disabled={!!editingDevice} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={labelStyle}>Make</label>
                                <input value={devForm.make} onChange={e => setDevForm({ ...devForm, make: e.target.value })} placeholder="e.g. Dell" style={inputStyle} required />
                            </div>
                            <div>
                                <label style={labelStyle}>Model</label>
                                <input value={devForm.model} onChange={e => setDevForm({ ...devForm, model: e.target.value })} placeholder="e.g. XPS 13" style={inputStyle} required />
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Color</label>
                            <input value={devForm.color} onChange={e => setDevForm({ ...devForm, color: e.target.value })} placeholder="e.g. Silver" style={inputStyle} required />
                        </div>
                        <div>
                            <label style={labelStyle}>Assign to Employee</label>
                            <select value={devForm.assignedTo || ''} onChange={e => setDevForm({ ...devForm, assignedTo: e.target.value })} style={inputStyle} required>
                                <option value="">-- Select Employee --</option>
                                {employees.map(e => (
                                    <option key={e.id} value={e.emp_id}>{e.name} ({e.emp_id})</option>
                                ))}
                            </select>
                        </div>
                        <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>{editingDevice ? 'Update Device' : 'Register Device'}</button>
                    </form>
                )}
            </Modal>

            {/* User Management Modal */}
            <Modal isOpen={showUserModal} onClose={() => setShowUserModal(false)} title={editingUser ? 'Edit System User' : 'Create System User'}>
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    setIsSubmitting(true);
                    try {
                        if (editingUser) {
                            await updateSystemUser(editingUser.id, {
                                name: userForm.name,
                                role: userForm.role,
                                email: userForm.email || undefined,
                                empId: userForm.role === 'admin' ? userForm.empId : undefined
                            });
                            alert("User updated successfully");
                        } else {
                            if (userForm.role === 'admin') {
                                if (!userForm.empId) throw new Error("Employee ID is required for Admin accounts.");
                                const employee = await getEmployeeByEmpId(userForm.empId);
                                if (!employee) throw new Error(`No employee found with ID ${userForm.empId}. Please add the employee first.`);
                                const empName = (employee as any).name;
                                if (empName.toLowerCase().trim() !== userForm.name.toLowerCase().trim()) {
                                    throw new Error(`Name mismatch! Employee ID ${userForm.empId} belongs to "${empName}", but you entered "${userForm.name}".`);
                                }
                            }
                            const result = await createSystemUser({
                                name: userForm.name,
                                role: userForm.role,
                                email: userForm.email || undefined,
                                empId: userForm.role === 'admin' ? userForm.empId : undefined
                            });
                            setNewAccountInfo(result);
                            setShowSuccessModal(true);
                        }
                        setShowUserModal(false);
                    } catch (err: any) {
                        alert(err.message);
                    } finally {
                        setIsSubmitting(false);
                    }
                }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={labelStyle}>Full Name</label>
                        <input value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} style={inputStyle} required />
                    </div>
                    <div>
                        <label style={labelStyle}>Email</label>
                        <input type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} style={inputStyle} placeholder="e.g. john.doe@minetkenya.co.ke" required />
                    </div>
                    <div>
                        <label style={labelStyle}>System Role</label>
                        <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value as any })} style={inputStyle}>
                            <option value="admin">Admin (Internal Ops)</option>
                            <option value="security">Security (Gate Ops)</option>
                        </select>
                    </div>
                    {userForm.role === 'admin' && (
                        <div>
                            <label style={labelStyle}>Employee ID (Required for Admins)</label>
                            <input value={userForm.empId || ''} onChange={e => setUserForm({ ...userForm, empId: e.target.value })} style={inputStyle} placeholder="e.g. EMP1001" required={userForm.role === 'admin'} />
                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>Admins must be existing employees. ID and Name will be verified.</p>
                        </div>
                    )}
                    <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
                        <h5 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Users size={14} /> Permissions</h5>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>
                            {userForm.role === 'admin' && "Can manage employees, company/BYOD devices, and view violation reports."}
                            {userForm.role === 'security' && "Can manage visitors, vendor check-ins, and standard device logging."}
                        </p>
                    </div>
                    {!editingUser && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '600' }}>* Username will be auto-generated and a secure password setup email will be sent.</p>}
                    <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ marginTop: '1rem' }}>
                        {isSubmitting ? 'Processing...' : editingUser ? 'Save Changes' : 'Create User Account'}
                    </button>
                </form>
            </Modal>

            {/* Account Creation Success Modal */}
            <Modal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} title="Security Credentials Issued">
                <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#10b981', marginBottom: '1.5rem' }}><CheckCircle2 size={64} style={{ margin: '0 auto' }} /></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>
                            <label style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Username</label>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--secondary)' }}>{newAccountInfo?.username}</div>
                                <button onClick={() => { navigator.clipboard.writeText(newAccountInfo?.username || ''); alert('Copied!'); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Copy</button>
                            </div>
                        </div>
                        <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>
                            <label style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Email</label>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                                <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--secondary)' }}>{newAccountInfo?.email}</div>
                                <button onClick={() => { navigator.clipboard.writeText(newAccountInfo?.email || ''); alert('Copied!'); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Copy</button>
                            </div>
                        </div>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>A secure email has been sent with a link to set their password.</p>
                    <button onClick={() => setShowSuccessModal(false)} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Done</button>
                </div>
            </Modal>

            <Modal isOpen={showEmpFormModal} onClose={() => { setShowEmpFormModal(false); setIsAddingEmployee(false); }} title="New Employee">
                <form onSubmit={handleEmployeeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={labelStyle}>Employee ID</label>
                        <input value={empForm.empId} onChange={e => setEmpForm({ ...empForm, empId: e.target.value })} style={inputStyle} required />
                    </div>
                    <div>
                        <label style={labelStyle}>Full Name</label>
                        <input value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} style={inputStyle} required />
                    </div>
                    <div>
                        <label style={labelStyle}>Department / Floor</label>
                        <input value={empForm.departmentOrFloor} onChange={e => setEmpForm({ ...empForm, departmentOrFloor: e.target.value })} style={inputStyle} required />
                    </div>
                    <div>
                        <label style={labelStyle}>Photo</label>
                        <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)} style={inputStyle} />
                    </div>
                    <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        {isSubmitting ? 'Saving...' : 'Save Employee'}
                    </button>
                </form>
            </Modal>
        </div>
    );
};

// Styles
const activeTabBtn: React.CSSProperties = { padding: '0.75rem 1.5rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', boxShadow: '0 4px 6px rgba(226, 26, 34, 0.2)' };
const inactiveTabBtn: React.CSSProperties = { padding: '0.75rem 1.5rem', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-sm)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem' };

export default AdminDashboard;