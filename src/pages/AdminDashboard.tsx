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
    db,
    auth
} from '../services/firebase';
import { signOut } from 'firebase/auth';
// import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Search,
    Users,
    Laptop,
    Smartphone,
    X,
    Camera,
    Download,
    Printer,
    Trash2,
    LogOut,
    UploadCloud,
    AlertTriangle,
    Bell
} from 'lucide-react';
import EmployeeCard from '../components/EmployeeCard';
import DeviceCard from '../components/DeviceCard';
import Modal from '../components/Modal';
// @ts-ignore
import { generateQRCode } from '../utils/qr';
import { doc, updateDoc } from 'firebase/firestore';
import { getSystemAlerts, type Alert } from '../utils/alerts';
import html2canvas from 'html2canvas';

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState<'employees' | 'company' | 'byod' | 'alerts'>('employees');
    const [employees, setEmployees] = useState<any[]>([]);
    const [devices, setDevices] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [alertsLoading, setAlertsLoading] = useState(false);

    // const navigate = useNavigate();

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

    useEffect(() => {
        loadData();
    }, []);


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

            // SECURITY RULE: BYOD must be assigned to an employee at creation
            if (type === 'BYOD' && !devForm.assignedTo && !editingDevice) {
                alert("For security and fraud prevention, BYOD devices must be assigned to an employee during registration.");
                return;
            }

            // ONE LAPTOP RULE: Check if employee already has a device of this type
            if (devForm.assignedTo) {
                const existing = devices.find(d =>
                    d.assignedTo === devForm.assignedTo &&
                    d.type === type &&
                    d.serialNumber !== devForm.serialNumber
                );
                if (existing) {
                    alert(`This employee already has a ${type} laptop assigned (${existing.serialNumber}). Only one per type is permitted.`);
                    return;
                }
            }

            if (editingDevice) {
                await updateDevice(editingDevice.serialNumber, { ...devForm, type });
            } else {
                await addDevice({ ...devForm, type: type as any });
            }
            setModalOpen(false);
            loadData();
            alert("Device saved successfully!");
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

    const handleDownloadLabel = async () => {
        const labelElement = document.getElementById('printable-label');
        if (!labelElement) return;

        try {
            const canvas = await html2canvas(labelElement, {
                scale: 3, // High resolution
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                onclone: (clonedDoc) => {
                    // Ensure the cloned element is visible for capture
                    const el = clonedDoc.getElementById('printable-label');
                    if (el) {
                        el.style.visibility = 'visible';
                        el.style.position = 'relative';
                        el.style.boxShadow = 'none';
                        el.style.border = 'none'; // Clean look for download
                    }
                }
            });

            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `Minet_Label_${qrData?.device.serialNumber}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error("Download Error:", err);
            alert("Failed to download label image.");
        }
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
            <header style={{ background: 'white', padding: '1.25rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div>
                    <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--primary)', lineHeight: 1.1 }}>Minet Laptop Tracking System</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>ADMIN DASHBOARD</div>
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
                    <button onClick={() => setActiveTab('employees')} style={{ ...(activeTab === 'employees' ? activeTabBtn : inactiveTabBtn), whiteSpace: 'nowrap' }}>
                        <Users size={16} /> Employees
                    </button>
                    <button onClick={() => setActiveTab('company')} style={{ ...(activeTab === 'company' ? activeTabBtn : inactiveTabBtn), whiteSpace: 'nowrap' }}>
                        <Laptop size={16} /> Company
                    </button>
                    <button onClick={() => setActiveTab('byod')} style={{ ...(activeTab === 'byod' ? activeTabBtn : inactiveTabBtn), whiteSpace: 'nowrap' }}>
                        <Smartphone size={16} /> BYOD
                    </button>
                    <button onClick={() => setActiveTab('alerts')} style={{ ... (activeTab === 'alerts' ? { ...activeTabBtn, background: '#f59e0b', boxShadow: '0 4px 6px rgba(245, 158, 11, 0.2)' } : inactiveTabBtn), position: 'relative', whiteSpace: 'nowrap' }}>
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
                                    setIsAddingEmployee(true);
                                    setSelectedEmployee(null);
                                    setEmpForm({ empId: '', name: '', departmentOrFloor: '' });
                                    setPhotoFile(null);
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
                                        onDelete={async (id) => { if (confirm('Delete employee?')) { await deleteEmployee(id); loadData(); } }}
                                        onView={(e) => {
                                            setSelectedEmployee(e);
                                            setIsAddingEmployee(false);
                                            setEmpForm({ empId: e.empId, name: e.name, departmentOrFloor: e.departmentOrFloor });
                                            setPhotoFile(null);
                                            setIsSubmitting(false);
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Details Panel */}
                        <aside className="glass-card" style={{ padding: '2.5rem', height: 'fit-content', position: 'sticky', top: '100px' }}>
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
                                                                        await updateDevice(dev.serialNumber, { assignedTo: selectedEmployee.empId });
                                                                        setAssigningType(null);
                                                                        loadData();
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
                                    onDelete={async (id) => { if (confirm('Retire (delete) this device permanently?')) { await retireDevice(id); loadData(); } }}
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
                    <div style={{ textAlign: 'center', padding: '1rem', position: 'relative' }}>
                        {/* THE PRINTABLE LABEL AREA */}
                        <div id="printable-label" style={{
                            background: 'white',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            margin: '0 auto'
                        }}>
                            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                                <div className="label-logo-box" style={{
                                    border: '2.5px solid var(--primary)',
                                    borderRadius: '12px',
                                    padding: '10px 20px',
                                    marginBottom: '0.75rem',
                                    display: 'inline-block'
                                }}>
                                    <img src="/logo.png" className="label-logo" style={{ display: 'block' }} alt="Minet" />
                                </div>
                                <div className="label-text-md label-tag" style={{ fontWeight: '800', color: 'var(--primary)', letterSpacing: '2px', fontSize: '1.1rem', textTransform: 'uppercase' }}>ASSET TAG</div>
                            </div>

                            <img src={qrData?.url} className="label-qr" alt="QR Code" />

                            <div style={{ textAlign: 'center' }}>
                                <h3 className="label-text-lg" style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: '800', color: '#111' }}>{qrData?.device.make} {qrData?.device.model}</h3>
                                <p className="label-text-md" style={{ margin: 0, fontSize: '0.95rem', color: '#475569', fontWeight: '700' }}>S/N: {qrData?.device.serialNumber}</p>
                                <p className="label-text-sm" style={{ margin: '0.5rem 0 0 0', fontWeight: '800', fontSize: '0.9rem', color: '#111' }}>User: {qrData?.device.employeeName}</p>
                            </div>
                        </div>

                        <div className="no-print button-group" style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                            <button className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={() => window.print()}><Printer size={18} /> Print Label</button>
                            <button className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#475569' }} onClick={handleDownloadLabel}><Download size={18} /> Download Label</button>
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
                            <input value={devForm.color} onChange={e => setDevForm({ ...devForm, color: e.target.value })} placeholder="e.g. Silver, Space Gray" style={inputStyle} required />
                        </div>
                        <div>
                            <label style={labelStyle}>Assign to Employee (Emp ID)</label>
                            <select value={devForm.assignedTo || ''} onChange={e => setDevForm({ ...devForm, assignedTo: e.target.value })} style={inputStyle}>
                                <option value="">Unassigned</option>
                                {employees.map(e => (
                                    <option key={e.id} value={e.empId}>{e.name} ({e.empId})</option>
                                ))}
                            </select>
                        </div>
                        <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>{editingDevice ? 'Update Device' : 'Register Device'}</button>
                    </form>
                )}
            </Modal>
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
