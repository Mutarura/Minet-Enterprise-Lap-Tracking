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
    db,
    auth,
    subscribeToSystemUsers,
    createSystemUser,
    updateSystemUser,
    resetUserPassword
} from '../services/firebase';
import { signOut } from 'firebase/auth';
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
    ShieldCheck,
    UserCheck,
    UserX,
    Key,
    Shield,
    RefreshCw
} from 'lucide-react';
import EmployeeCard from '../components/EmployeeCard';
import DeviceCard from '../components/DeviceCard';
import Modal from '../components/Modal';
// @ts-ignore
import { generateQRCode } from '../utils/qr';
import { doc, updateDoc } from 'firebase/firestore';
import { getSystemAlerts, type Alert } from '../utils/alerts';
import { CheckCircle2 } from 'lucide-react';

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState<'employees' | 'company' | 'byod' | 'alerts' | 'users'>('employees');
    const [userRole, setUserRole] = useState<string | null>(null);
    const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
    const [systemUsers, setSystemUsers] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [devices, setDevices] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [alertsLoading, setAlertsLoading] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [newAccountInfo, setNewAccountInfo] = useState<{ username: string, tempPassword: string } | null>(null);

    const navigate = useNavigate();

    // Selection state for details panel
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [isAddingEmployee, setIsAddingEmployee] = useState(false);

    // Modal states
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'device' | 'qr'>('device');
    const [editingDevice, setEditingDevice] = useState<any>(null);
    const [qrData, setQrData] = useState<{ url: string, device: any } | null>(null);

    // Form states
    const [empForm, setEmpForm] = useState({ empId: '', name: '', departmentOrFloor: '' });
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [devForm, setDevForm] = useState({ serialNumber: '', make: '', model: '', color: '', assignedTo: '' });
    const [isDragging, setIsDragging] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [assigningType, setAssigningType] = useState<'COMPANY' | 'BYOD' | null>(null);
    const [assignSearch, setAssignSearch] = useState('');
    const [showEmpFormModal, setShowEmpFormModal] = useState(false);
    const [showUserModal, setShowUserModal] = useState(false);
    const [userForm, setUserForm] = useState({ name: '', role: 'admin' as any });
    const [editingUser, setEditingUser] = useState<any>(null);
    const [detailsHighlight, setDetailsHighlight] = useState(false);
    const detailsPanelRef = React.useRef<HTMLDivElement | null>(null);

    // MOBILE SESSION MANAGEMENT
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

    useEffect(() => {
        loadData();
        checkRole();

        let unsubUsers = () => { };
        if (activeTab === 'users') {
            unsubUsers = subscribeToSystemUsers((data) => {
                setSystemUsers(data);
            });
        }
        return () => unsubUsers();
    }, [activeTab]);

    const checkRole = async () => {
        if (auth.currentUser) {
            const { getDoc, doc } = await import('firebase/firestore');
            const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                setUserRole(data.role);
                setCurrentUserProfile(data);

                // If they are a superadmin, default their view to User Management
                if (data.role === 'superadmin') {
                    setActiveTab('users');
                }
            }
        }
    };


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
        } catch (err) {
            console.error("Data load error:", err);
        } finally {
            setAlertsLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'alerts' && alerts.length === 0) {
            loadData(true);
        }
    }, [activeTab]);

    const handleEmployeeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!empForm.empId && isAddingEmployee) {
            alert("Employee ID is required for new employees.");
            return;
        }
        if (!empForm.name) {
            alert("Employee Name is required.");
            return;
        }

        setIsSubmitting(true);
        try {
            console.log("Submitting employee data...", isAddingEmployee ? "ADD" : "UPDATE");

            if (isAddingEmployee) {
                await addEmployee({
                    empId: empForm.empId.trim(),
                    name: empForm.name.trim(),
                    departmentOrFloor: empForm.departmentOrFloor.trim(),
                    photoFile: photoFile || undefined
                });
                alert("Employee added successfully!");
            } else {
                if (!selectedEmployee?.id) throw new Error("No employee selected for update");
                await updateEmployee(selectedEmployee.id, {
                    name: empForm.name.trim(),
                    departmentOrFloor: empForm.departmentOrFloor.trim(),
                    photoFile: photoFile || undefined
                });
                alert("Employee updated successfully!");
            }

            // Success cleanup
            setIsAddingEmployee(false);
            setSelectedEmployee(null);
            setEmpForm({ empId: '', name: '', departmentOrFloor: '' });
            setPhotoFile(null);

            // Refresh list (non-blocking for the UI submission state)
            loadData();
        } catch (err: any) {
            console.error("Submission error details:", err);
            alert("Error saving employee: " + (err.message || "Unknown error"));
            setIsSubmitting(false); // Immediate reset on error
        } finally {
            // Wait a tiny bit to ensure Firestore has settled before allowing another click
            setTimeout(() => setIsSubmitting(false), 500);
        }
    };

    const handleDeviceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const type = activeTab === 'company' ? 'COMPANY' : 'BYOD';

            // SECURITY RULE: All devices must be assigned at creation
            if (!devForm.assignedTo && !editingDevice) {
                alert("All devices must be assigned to an employee at registration.");
                return;
            }

            // ONE LAPTOP RULE: Check if employee already has a device of this type
            if (devForm.assignedTo) {
                const assignedDevices = devices.filter(d =>
                    d.assignedTo === devForm.assignedTo &&
                    d.type === type &&
                    d.serialNumber !== devForm.serialNumber
                );

                if (type === 'COMPANY' && assignedDevices.length >= 1) {
                    alert(`This employee already has a COMPANY laptop assigned (${assignedDevices[0].serialNumber}). Only one per type is permitted.`);
                    return;
                }

                if (type === 'BYOD' && assignedDevices.length >= 2) {
                    alert(`This employee has reached the maximum allowed BYOD devices (2).`);
                    return;
                }
            }

            if (editingDevice) {
                await updateDevice(editingDevice.serialNumber, { ...devForm, type });
                alert("Device saved successfully!");
            } else {
                await addDevice({ ...devForm, type: type as any });

                // AUTO CHECK-IN FOR BYOD
                if (type === 'BYOD') {
                    const employee = employees.find(e => e.empId === devForm.assignedTo);
                    if (employee) {
                        try {
                            await addLog({
                                empId: employee.empId,
                                employeeName: employee.name,
                                serialNumber: devForm.serialNumber,
                                action: 'CHECK_IN'
                            });
                            alert("BYOD registered successfully. Device has been checked in.");
                        } catch (err) {
                            console.error("Auto check-in failed", err);
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
            loadData();
            resetMobileState(); // Ensure clean slate on mobile
        } catch (err: any) {
            alert("Error: " + err.message);
        }
    };

    const handleGenerateQR = async (device: any) => {
        try {
            const employee = employees.find(e => e.empId === device.assignedTo);
            const photoVal = (employee?.photoURL && employee.photoURL.startsWith('data:'))
                ? "[BASE64_IMAGE]"
                : (employee?.photoURL || '');

            const metadata = {
                serialNumber: device.serialNumber,
                empId: device.assignedTo || 'Unassigned',
                employeeName: employee?.name || 'N/A',
                make: device.make,
                model: device.model,
                color: device.color || 'N/A',
                type: device.type,
                employeePhotoURL: photoVal
            };
            const url = await generateQRCode(metadata);

            await updateDoc(doc(db, "devices", device.serialNumber), { qrCodeURL: url });

            setQrData({ url, device: metadata });
            setModalType('qr');
            setModalOpen(true);
            loadData();
        } catch (err) {
            alert("Failed to generate QR code.");
        }
    };

    const handlePrintLabel = () => {
        console.log("Print button clicked", qrData);
        if (!qrData) {
            alert("Error: No label data available. Please regenerate the QR code.");
            return;
        }

        // Use React Router state for robust data passing, with localStorage backup
        localStorage.setItem('printLabelData', JSON.stringify(qrData));
        navigate('/print-label', { state: qrData });
    };

    const filteredEmployees = employees
        .filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.empId.toLowerCase().includes(searchTerm.toLowerCase()))
        .slice(0, 10); // Show 10 by default

    const filteredDevices = devices.filter(d =>
        (activeTab === 'company' ? d.type === 'COMPANY' : d.type === 'BYOD') &&
        d.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getAssignedDevices = (empId: string) => {
        return devices.filter(d => d.assignedTo === empId);
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
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
                    <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--primary)', lineHeight: 1.1 }}>Minet Laptop Tracking System</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Shield size={14} /> IT ADMIN DASHBOARD | HELLO {currentUserProfile?.name || 'ADMIN'}
                    </div>
                </div>

                <button
                    onClick={async () => {
                        if (confirm('Are you sure you want to logout?')) {
                            await signOut(auth);
                            window.location.href = 'https://minet-insurance-laptoptracking.web.app/';
                        }
                    }}
                    style={{
                        background: 'rgba(226, 26, 34, 0.05)',
                        border: '1px solid rgba(226, 26, 34, 0.2)',
                        color: 'var(--primary)',
                        fontWeight: '700',
                        padding: '0.5rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <LogOut size={18} />
                    <span>Logout</span>
                </button>
            </header>

            <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem', width: '100%', boxSizing: 'border-box', flex: 1 }}>
                {/* Tabs */}
                <div className="tabs-container" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                    <button onClick={() => handleTabSwitch('employees')} style={{ ...(activeTab === 'employees' ? activeTabBtn : inactiveTabBtn), whiteSpace: 'nowrap' }}>
                        <Users size={16} /> Employees
                    </button>
                    <button onClick={() => handleTabSwitch('company')} style={{ ...(activeTab === 'company' ? activeTabBtn : inactiveTabBtn), whiteSpace: 'nowrap' }}>
                        <Laptop size={16} /> Company
                    </button>
                    <button onClick={() => handleTabSwitch('byod')} style={{ ...(activeTab === 'byod' ? activeTabBtn : inactiveTabBtn), whiteSpace: 'nowrap' }}>
                        <Smartphone size={16} /> BYOD
                    </button>
                    <button onClick={() => handleTabSwitch('alerts')} style={{ ... (activeTab === 'alerts' ? { ...activeTabBtn, background: '#f59e0b', boxShadow: '0 4px 6px rgba(245, 158, 11, 0.2)' } : inactiveTabBtn), position: 'relative', whiteSpace: 'nowrap' }}>
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
                                fontWeight: '800',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                                {alerts.length}
                            </span>
                        )}
                    </button>
                    {userRole === 'superadmin' && (
                        <button onClick={() => handleTabSwitch('users')} style={{ ...(activeTab === 'users' ? activeTabBtn : inactiveTabBtn), whiteSpace: 'nowrap' }}>
                            <Shield size={16} /> User Management
                        </button>
                    )}
                </div>

                {activeTab === 'employees' ? (
                    <div className="employee-details-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 450px', gap: '2rem' }}>
                        {/* List Section */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div className="glass-card" style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 1.25rem' }}>
                                    <Search size={20} color="#94a3b8" />
                                    <input
                                        type="text"
                                        placeholder="Search by ID or Name..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        style={{ border: 'none', padding: '1rem', width: '100%', outline: 'none', background: 'transparent' }}
                                    />
                                </div>
                                <button onClick={() => {
                                    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
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
                                            setEmpForm({ empId: e.empId, name: e.name, departmentOrFloor: e.departmentOrFloor });
                                            setPhotoFile(null);
                                            setIsSubmitting(false);
                                        }}
                                        onDelete={async (id) => { if (confirm('Delete employee?')) { await deleteEmployee(id); loadData(); resetMobileState(); } }}
                                        onView={(e) => {
                                            setSelectedEmployee(e);
                                            setIsAddingEmployee(false);
                                            setEmpForm({ empId: e.empId, name: e.name, departmentOrFloor: e.departmentOrFloor });
                                            setPhotoFile(null);
                                            setIsSubmitting(false);
                                            const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
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
                                        <button onClick={() => {
                                            setIsAddingEmployee(false);
                                            setSelectedEmployee(null);
                                            setPhotoFile(null);
                                            setIsSubmitting(false);
                                            setAssigningType(null); // Reset assignment view
                                        }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={24} /></button>
                                    </div>

                                    {assigningType ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <button onClick={() => setAssigningType(null)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    ← Back
                                                </button>
                                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Assign {assigningType} Laptop</h3>
                                            </div>

                                            <div className="glass-card" style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', background: '#f8fafc' }}>
                                                <Search size={16} color="#94a3b8" />
                                                <input
                                                    placeholder="Search SN, Make, Model..."
                                                    value={assignSearch}
                                                    onChange={e => setAssignSearch(e.target.value)}
                                                    style={{ border: 'none', padding: '0.75rem', width: '100%', outline: 'none', background: 'transparent', fontSize: '0.9rem' }}
                                                />
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                                                {devices
                                                    .filter(d => d.type === assigningType && !d.assignedTo)
                                                    .filter(d =>
                                                        d.serialNumber.toLowerCase().includes(assignSearch.toLowerCase()) ||
                                                        d.make.toLowerCase().includes(assignSearch.toLowerCase()) ||
                                                        d.model.toLowerCase().includes(assignSearch.toLowerCase())
                                                    )
                                                    .length > 0 ? (
                                                    devices
                                                        .filter(d => d.type === assigningType && !d.assignedTo)
                                                        .filter(d =>
                                                            d.serialNumber.toLowerCase().includes(assignSearch.toLowerCase()) ||
                                                            d.make.toLowerCase().includes(assignSearch.toLowerCase()) ||
                                                            d.model.toLowerCase().includes(assignSearch.toLowerCase())
                                                        )
                                                        .map(dev => (
                                                            <div key={dev.serialNumber} className="glass-card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <div>
                                                                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{dev.make} {dev.model}</div>
                                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>S/N: {dev.serialNumber}</div>
                                                                </div>
                                                                <button
                                                                    onClick={async () => {
                                                                        try {
                                                                            await updateDevice(dev.serialNumber, { assignedTo: selectedEmployee.empId });
                                                                            setAssigningType(null);
                                                                            loadData();
                                                                            alert("Device assigned successfully!");
                                                                        } catch (err: any) {
                                                                            alert(err.message);
                                                                        }
                                                                    }}
                                                                    className="btn-primary"
                                                                    style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                                                                >
                                                                    Assign
                                                                </button>
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
                                                    style={{
                                                        position: 'relative',
                                                        width: '100%',
                                                        height: '200px',
                                                        margin: '0 auto',
                                                        border: `2px dashed ${isDragging ? 'var(--primary)' : '#cbd5e1'}`,
                                                        borderRadius: 'var(--radius-md)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '0.75rem',
                                                        background: isDragging ? 'rgba(226, 26, 34, 0.05)' : '#f8fafc',
                                                        overflow: 'hidden',
                                                        transition: 'all 0.2s ease',
                                                        cursor: 'pointer'
                                                    }}
                                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                                    onDragLeave={() => setIsDragging(false)}
                                                    onDrop={(e) => {
                                                        e.preventDefault();
                                                        setIsDragging(false);
                                                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                                            setPhotoFile(e.dataTransfer.files[0]);
                                                        }
                                                    }}
                                                    onClick={() => document.getElementById('employee-photo-input')?.click()}
                                                >
                                                    {photoFile || selectedEmployee?.photoURL ? (
                                                        <>
                                                            <img
                                                                src={photoFile ? URL.createObjectURL(photoFile) : selectedEmployee?.photoURL}
                                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                alt="Employee"
                                                            />
                                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }} onMouseOver={(e) => e.currentTarget.style.opacity = '1'} onMouseOut={(e) => e.currentTarget.style.opacity = '0'}>
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
                                                                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>or click to browse local storage</p>
                                                            </div>
                                                        </>
                                                    )}
                                                    <input id="employee-photo-input" type="file" style={{ display: 'none' }} accept="image/*" onChange={e => {
                                                        if (e.target.files && e.target.files[0]) {
                                                            setPhotoFile(e.target.files[0]);
                                                        }
                                                    }} />
                                                </div>
                                                {(photoFile || selectedEmployee?.photoURL) && (
                                                    <button
                                                        type="button"
                                                        style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '700', marginTop: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                                                        onClick={(e) => { e.stopPropagation(); setPhotoFile(null); if (!isAddingEmployee) loadData(); }}
                                                    >
                                                        Remove Current Photo
                                                    </button>
                                                )}
                                            </div>

                                            <div>
                                                <label htmlFor="emp-form-id" style={labelStyle}>Employee ID</label>
                                                <input id="emp-form-id" name="empId" value={empForm.empId} onChange={e => setEmpForm({ ...empForm, empId: e.target.value })} placeholder="e.g. EMP1001" style={inputStyle} disabled={!!selectedEmployee} required />
                                            </div>
                                            <div>
                                                <label htmlFor="emp-form-name" style={labelStyle}>Full Name</label>
                                                <input id="emp-form-name" name="name" value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} style={inputStyle} required />
                                            </div>
                                            <div>
                                                <label htmlFor="emp-form-dept" style={labelStyle}>Department / Floor</label>
                                                <input id="emp-form-dept" name="departmentOrFloor" value={empForm.departmentOrFloor} onChange={e => setEmpForm({ ...empForm, departmentOrFloor: e.target.value })} placeholder="e.g. IT - Floor 4" style={inputStyle} required />
                                            </div>

                                            {!isAddingEmployee && (
                                                <div style={{ padding: '1.5rem', background: '#f1f5f9', borderRadius: 'var(--radius-sm)', marginTop: '1rem' }}>
                                                    <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Laptop size={16} /> Asset Inventory</h4>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                        {['COMPANY', 'BYOD'].map(type => {
                                                            const dev = getAssignedDevices(selectedEmployee.empId).find(d => d.type === type);
                                                            return (
                                                                <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '0.75rem', background: 'white', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                                                                        <span style={{ color: '#475569', fontWeight: '800', letterSpacing: '0.5px' }}>{type} LAPTOP</span>
                                                                        {dev ? (
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                                                <span style={{ fontWeight: '700', color: 'var(--primary)', background: 'rgba(226, 26, 34, 0.05)', padding: '2px 6px', borderRadius: '4px' }}>{dev.serialNumber}</span>
                                                                                <button
                                                                                    type="button"
                                                                                    title="Unassign Device"
                                                                                    onClick={async () => { if (confirm('Are you sure you want to unassign this device? This will free it up for other employees.')) { await updateDevice(dev.serialNumber, { assignedTo: null }); loadData(); } }}
                                                                                    style={{ background: '#fee2e2', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                                                                                >
                                                                                    <Trash2 size={14} />
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => { setAssigningType(type as any); setAssignSearch(''); }}
                                                                                style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                                                                            >
                                                                                + Assign
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            <button
                                                type="submit"
                                                className="btn-primary"
                                                style={{ marginTop: '1rem', opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                                                disabled={isSubmitting}
                                            >
                                                {isSubmitting ? 'Processing...' : (isAddingEmployee ? 'Register Employee' : 'Update Profile')}
                                            </button>
                                        </form>
                                    )}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '4rem 0', color: '#94a3b8' }}>
                                    <Users size={48} style={{ margin: '0 auto 1rem auo' }} opacity={0.3} />
                                    <p>Select an employee to view details or manage assets</p>
                                </div>
                            )}
                        </aside>
                    </div>
                ) : activeTab === 'users' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '1rem', flex: 1 }}>
                                <div className="glass-card" style={{ flex: 1, maxWidth: '500px', display: 'flex', alignItems: 'center', padding: '0 1.25rem' }}>
                                    <Search size={20} color="#94a3b8" />
                                    <input
                                        type="text"
                                        placeholder="Search users..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        style={{ border: 'none', padding: '1rem', width: '100%', outline: 'none', background: 'transparent' }}
                                    />
                                </div>
                                <button onClick={() => {
                                    setEditingUser(null);
                                    setUserForm({ name: '', role: 'admin' });
                                    setShowUserModal(true);
                                }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Plus size={20} /> Create User
                                </button>
                            </div>
                        </div>

                        <div className="user-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                            {systemUsers.filter(u =>
                                u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase()))
                            ).map(user => (
                                <div key={user.id} className="glass-card" style={{ padding: '1.5rem', opacity: user.isActive === false ? 0.6 : 1, borderLeft: `4px solid ${user.role === 'superadmin' ? '#7c3aed' : user.role === 'admin' ? 'var(--primary)' : '#64748b'}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                                {user.role === 'superadmin' ? <ShieldCheck size={24} /> : user.role === 'admin' ? <Key size={24} /> : <Shield size={24} />}
                                            </div>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{user.name}</h4>
                                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Username: <strong>{user.username || 'N/A'}</strong></p>
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>{user.email}</p>
                                                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                                                    <span style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9' }}>{user.role}</span>
                                                    {user.isActive === false && <span style={{ fontSize: '0.7rem', fontWeight: '800', background: '#fee2e2', color: 'var(--danger)', padding: '2px 8px', borderRadius: '4px' }}>DISABLED</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={() => {
                                                    setEditingUser(user);
                                                    setUserForm({ name: user.name, role: user.role });
                                                    setShowUserModal(true);
                                                }}
                                                style={{ background: 'white', border: '1px solid #e2e8f0', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer' }}
                                                title="Edit User"
                                            >
                                                ⚙️
                                            </button>
                                            {userRole === 'superadmin' && (
                                                <button
                                                    onClick={async () => {
                                                        if (confirm(`Reset password for ${user.name}? This will enforce a new temporary password.`)) {
                                                            try {
                                                                const newTemp = await resetUserPassword(user.id);
                                                                setNewAccountInfo({ username: user.username, tempPassword: newTemp });
                                                                setUserForm({ name: user.name, role: user.role }); // Ensure userForm.name is correct for modal
                                                                setShowSuccessModal(true);
                                                            } catch (err: any) {
                                                                alert(err.message);
                                                            }
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
                                                    if (confirm(`${user.isActive === false ? 'Enable' : 'Disable'} account for ${user.name}?`)) {
                                                        await updateSystemUser(user.id, { isActive: user.isActive === false });
                                                    }
                                                }}
                                                style={{ background: user.isActive === false ? '#dcfce7' : '#fee2e2', border: 'none', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', color: user.isActive === false ? '#166534' : 'var(--danger)' }}
                                                title={user.isActive === false ? 'Enable' : 'Disable'}
                                            >
                                                {user.isActive === false ? <UserCheck size={18} /> : <UserX size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '1.25rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Created {user.createdAt?.toDate().toLocaleDateString()} by {user.createdBy}</span>
                                            <span>Last: {user.lastLogin ? user.lastLogin.toDate().toLocaleString() : 'Never'}</span>
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
                            <div style={{ textAlign: 'center', padding: '4rem' }}>
                                <p>Refreshing security status...</p>
                            </div>
                        ) : alerts.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                                <Bell size={48} opacity={0.2} style={{ margin: '0 auto 1.5rem' }} />
                                <p>No security alerts at this time. All company laptops are accounted for.</p>
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
                                            <p style={{ margin: 0, color: 'var(--primary)', fontWeight: '700' }}>Current Duration: {alert.durationHrs} Hours</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    /* Device Tabs Content */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div className="glass-card" style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 1.25rem' }}>
                                <Search size={20} color="#94a3b8" />
                                <input
                                    type="text"
                                    placeholder={`Search ${activeTab} serial...`}
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    style={{ border: 'none', padding: '1rem', width: '100%', outline: 'none', background: 'transparent' }}
                                />
                            </div>
                            <button onClick={() => { setModalType('device'); setEditingDevice(null); setDevForm({ serialNumber: '', make: '', model: '', color: '', assignedTo: '' }); setModalOpen(true); }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Plus size={20} /> Add {activeTab === 'company' ? 'Laptop' : 'Device'}
                            </button>
                        </div>

                        <div className="device-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                            {filteredDevices.map(dev => (
                                <DeviceCard
                                    key={dev.id}
                                    device={dev}
                                    onEdit={(d) => { setEditingDevice(d); setDevForm(d); setModalType('device'); setModalOpen(true); }}
                                    onDelete={async (id) => { if (confirm('Retire (delete) this device permanently?')) { await retireDevice(id); loadData(); resetMobileState(); } }}
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
                        {/* THE PRINTABLE LABEL AREA */}
                        <div id="printable-label">
                            <div className="label-header">
                                <div className="label-logo-box">
                                    <img src="/logo.png" className="label-logo" alt="Minet" />
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
                            <button
                                className="btn-primary"
                                onClick={handlePrintLabel}
                                style={{ width: '100%', justifyContent: 'center' }}
                            >
                                <Printer size={18} /> Print Label
                            </button>
                            <button
                                type="button"
                                style={{
                                    padding: '0.75rem',
                                    background: 'white',
                                    color: '#0f172a',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: 'var(--radius-sm)',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    width: '100%',
                                    fontSize: '0.875rem'
                                }}
                                onClick={() => {
                                    if (!qrData?.url) return;
                                    const type = qrData.device.type || 'DEVICE';
                                    const serial = qrData.device.serialNumber || 'UNKNOWN';
                                    const name = qrData.device.employeeName || 'Unassigned';
                                    const filename = `${type}-${serial}-${name}.png`.replace(/[^a-z0-9\-\. ]/gi, '_');

                                    const link = document.createElement('a');
                                    link.href = qrData.url;
                                    link.download = filename;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                }}
                            >
                                ⬇️ Download Image
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleDeviceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div>
                            <label htmlFor="dev-serial" style={labelStyle}>Serial Number</label>
                            <input id="dev-serial" name="serialNumber" value={devForm.serialNumber} onChange={e => setDevForm({ ...devForm, serialNumber: e.target.value })} placeholder="e.g. MINET-LAP-101" style={inputStyle} required disabled={!!editingDevice} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label htmlFor="dev-make" style={labelStyle}>Make</label>
                                <input id="dev-make" name="make" value={devForm.make} onChange={e => setDevForm({ ...devForm, make: e.target.value })} placeholder="e.g. Dell" style={inputStyle} required />
                            </div>
                            <div>
                                <label htmlFor="dev-model" style={labelStyle}>Model</label>
                                <input id="dev-model" name="model" value={devForm.model} onChange={e => setDevForm({ ...devForm, model: e.target.value })} placeholder="e.g. XPS 13" style={inputStyle} required />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="dev-color" style={labelStyle}>Color</label>
                            <input id="dev-color" name="color" value={devForm.color} onChange={e => setDevForm({ ...devForm, color: e.target.value })} placeholder="e.g. Silver, Space Gray" style={inputStyle} required />
                        </div>
                        <div>
                            <label htmlFor="dev-assigned" style={labelStyle}>Assign to Employee (Emp ID)</label>
                            <select id="dev-assigned" name="assignedTo" value={devForm.assignedTo || ''} onChange={e => setDevForm({ ...devForm, assignedTo: e.target.value })} style={inputStyle} required>
                                {employees.map(e => (
                                    <option key={e.id} value={e.empId}>{e.name} ({e.empId})</option>
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
                                role: userForm.role
                            });
                            alert("User updated successfully");
                        } else {
                            const result = await createSystemUser({
                                name: userForm.name,
                                role: userForm.role
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
                        <label style={labelStyle}>System Role</label>
                        <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value as any })} style={inputStyle}>
                            <option value="admin">Admin (Internal Ops)</option>
                            <option value="security">Security (Gate Ops)</option>
                            <option value="superadmin">Super Admin (Full Access)</option>
                        </select>
                    </div>

                    <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
                        <h5 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Shield size={14} /> Permissions</h5>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>
                            {userForm.role === 'superadmin' && "Can manage other admins, delete data, and view all system logs."}
                            {userForm.role === 'admin' && "Can manage employees, company/BYOD devices, and view violation reports."}
                            {userForm.role === 'security' && "Can manage visitors, vendor check-ins, and standard device logging."}
                        </p>
                    </div>

                    {!editingUser && (
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '600' }}>
                            * Username and temporary password will be auto-generated.
                        </p>
                    )}

                    <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ marginTop: '1rem' }}>
                        {isSubmitting ? 'Processing...' : editingUser ? 'Save Changes' : 'Create User Account'}
                    </button>
                </form>
            </Modal>

            {/* Account Creation Success Modal */}
            <Modal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} title="Account Created Successfully">
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ color: '#10b981', marginBottom: '1.5rem' }}>
                        <CheckCircle2 size={64} style={{ margin: '0 auto' }} />
                    </div>
                    <p style={{ color: '#475569', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                        The account for <strong>{userForm.name}</strong> has been created. Please share these temporary credentials with them.
                    </p>

                    <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0', textAlign: 'left', marginBottom: '2rem' }}>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Username</label>
                            <p style={{ margin: '0.25rem 0 0', fontSize: '1.1rem', fontWeight: '700', color: 'var(--secondary)' }}>{newAccountInfo?.username}</p>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Temporary Password</label>
                            <p style={{ margin: '0.25rem 0 0', fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary)', fontFamily: 'monospace' }}>{newAccountInfo?.tempPassword}</p>
                        </div>
                    </div>

                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', marginBottom: '1.5rem' }}>
                        Note: The user will be required to change this password upon their first activation.
                    </p>

                    <button onClick={() => setShowSuccessModal(false)} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                        Done
                    </button>
                </div>
            </Modal>

            <Modal isOpen={showEmpFormModal} onClose={() => { setShowEmpFormModal(false); setIsAddingEmployee(false); }} title="New Employee">
                <form onSubmit={handleEmployeeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label htmlFor="new-emp-id" style={labelStyle}>Employee ID</label>
                        <input id="new-emp-id" name="empId" value={empForm.empId} onChange={e => setEmpForm({ ...empForm, empId: e.target.value })} style={inputStyle} required />
                    </div>
                    <div>
                        <label htmlFor="new-emp-name" style={labelStyle}>Full Name</label>
                        <input id="new-emp-name" name="name" value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} style={inputStyle} required />
                    </div>
                    <div>
                        <label htmlFor="new-emp-dept" style={labelStyle}>Department / Floor</label>
                        <input id="new-emp-dept" name="departmentOrFloor" value={empForm.departmentOrFloor} onChange={e => setEmpForm({ ...empForm, departmentOrFloor: e.target.value })} style={inputStyle} required />
                    </div>
                    <div>
                        <label htmlFor="new-emp-photo" style={labelStyle}>Photo</label>
                        <input id="new-emp-photo" name="photo" type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)} style={inputStyle} />
                    </div>
                    <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        {isSubmitting ? 'Saving...' : 'Save Employee'}
                    </button>
                </form>
            </Modal>

            {/* Hidden Print-Only Section Removed */}
        </div>
    );
};

// Styles
const activeTabBtn: React.CSSProperties = {
    padding: '0.75rem 1.5rem',
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    boxShadow: '0 4px 6px rgba(226, 26, 34, 0.2)'
};

const inactiveTabBtn: React.CSSProperties = {
    padding: '0.75rem 1.5rem',
    background: 'white',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    borderRadius: 'var(--radius-sm)',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer'
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#475569',
    marginBottom: '0.5rem'
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid #cbd5e1',
    outline: 'none',
    fontSize: '0.95rem'
};

export default AdminDashboard;
