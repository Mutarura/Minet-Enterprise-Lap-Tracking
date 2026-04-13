import { io, Socket } from 'socket.io-client';

// ============================
// BASE CONFIGURATION
// ============================
const API_BASE = '/api';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(window.location.origin, {
      transports: ['websocket', 'polling']
    });
  }
  return socket;
};

// ============================
// AUTH TOKEN HELPERS
// ============================
export const getToken = (): string | null => {
  return localStorage.getItem('minet_token');
};

export const setToken = (token: string): void => {
  localStorage.setItem('minet_token', token);
};

export const removeToken = (): void => {
  localStorage.removeItem('minet_token');
  localStorage.removeItem('minet_user');
};

export const getUser = (): any => {
  const user = localStorage.getItem('minet_user');
  return user ? JSON.parse(user) : null;
};

export const setUser = (user: any): void => {
  localStorage.setItem('minet_user', JSON.stringify(user));
};

// ============================
// BASE FETCH HELPER
// ============================
const apiFetch = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<any> => {
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

 if (response.status === 401) {
    // Only redirect if we had a token (real session expiry)
    // Don't redirect during login attempts
    if (getToken()) {
        removeToken();
        window.location.href = '/tracker/';
    }
    throw new Error('Session expired. Please log in again.');
}

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data;
};

// ============================
// AUTH
// ============================
export const loginUser = async (username: string, password: string) => {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  setToken(data.token);
  setUser(data.user);
  return data;
};

export const logoutUser = (): void => {
  removeToken();
  socket?.disconnect();
  socket = null;
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string
) => {
  return apiFetch('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword })
  });
};

export const getCurrentUser = async () => {
  return apiFetch('/auth/me');
};

// ============================
// EMPLOYEES
// ============================
export const getEmployees = async () => {
  return apiFetch('/employees');
};

export const getEmployeeByEmpId = async (empId: string) => {
  return apiFetch(`/employees/${empId}`);
};

export const addEmployee = async (data: {
  empId: string;
  name: string;
  departmentOrFloor: string;
  photoFile?: File;
}) => {
  let photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}`;
  if (data.photoFile) {
    photoUrl = await compressImage(data.photoFile);
  }
  return apiFetch('/employees', {
    method: 'POST',
    body: JSON.stringify({
      empId: data.empId,
      name: data.name,
      department: data.departmentOrFloor,
      photoUrl
    })
  });
};

export const updateEmployee = async (
  empId: string,
  data: { name?: string; departmentOrFloor?: string; photoFile?: File }
) => {
  let photoUrl: string | undefined;
  if (data.photoFile) {
    photoUrl = await compressImage(data.photoFile);
  }
  return apiFetch(`/employees/${empId}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: data.name,
      department: data.departmentOrFloor,
      photoUrl
    })
  });
};

export const deleteEmployee = async (empId: string) => {
  return apiFetch(`/employees/${empId}`, { method: 'DELETE' });
};

export const subscribeToEmployees = (callback: (data: any[]) => void) => {
  getEmployees().then(callback).catch(console.error);
  const s = getSocket();
  const handler = () => {
    getEmployees().then(callback).catch(console.error);
  };
  s.on('employees:updated', handler);
  s.on('employees:deleted', handler);
  return () => {
    s.off('employees:updated', handler);
    s.off('employees:deleted', handler);
  };
};

// ============================
// DEVICES
// ============================
export const getDevices = async () => {
  return apiFetch('/devices');
};

export const addDevice = async (data: {
  serialNumber: string;
  type: 'COMPANY' | 'BYOD';
  make?: string;
  model?: string;
  color?: string;
  assignedTo?: string | null;
  isLeased?: boolean;
}) => {
  return apiFetch('/devices', {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

export const updateDevice = async (
  serialNumber: string,
  data: Partial<{
    assignedTo: string | null;
    make: string;
    model: string;
    color: string;
    type: 'COMPANY' | 'BYOD';
    qrCodeUrl?: string | null;
    isLeased?: boolean;
  }>
) => {
  return apiFetch(`/devices/${serialNumber}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
};

export const retireDevice = async (serialNumber: string) => {
  return apiFetch(`/devices/${serialNumber}`, { method: 'DELETE' });
};

export const subscribeToDevices = (callback: (data: any[]) => void) => {
  getDevices().then(callback).catch(console.error);
  const s = getSocket();
  const handler = () => {
    getDevices().then(callback).catch(console.error);
  };
  s.on('devices:updated', handler);
  s.on('devices:deleted', handler);
  return () => {
    s.off('devices:updated', handler);
    s.off('devices:deleted', handler);
  };
};

// ============================
// ACTIVITY LOGS
// ============================
export const addLog = async (log: {
  empId: string;
  employeeName: string;
  serialNumber: string;
  action: 'CHECK_IN' | 'CHECK_OUT';
}) => {
  return apiFetch('/logs', {
    method: 'POST',
    body: JSON.stringify(log)
  });
};

export const subscribeToAllLogs = (callback: (data: any[]) => void) => {
  apiFetch('/logs/today').then(callback).catch(console.error);
  const s = getSocket();
  s.on('logs:new', () => {
    apiFetch('/logs/today').then(callback).catch(console.error);
  });
  return () => {
    s.off('logs:new');
  };
};

export const syncOfflineScans = async (scans: any[]) => {
  return apiFetch('/logs/sync', {
    method: 'POST',
    body: JSON.stringify({ scans })
  });
};

// ============================
// VISITORS
// ============================
export const addVisitor = async (data: {
  type: 'QUICK' | 'STANDARD';
  name: string;
  phone?: string;
  identifier: string;
  destination?: string;
  reason: string;
  deviceType?: string;
  deviceMakeModel?: string;
  deviceSerial?: string;
  deviceColor?: string;
}) => {
  return apiFetch('/visitors', {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

export const getActiveVisitors = async () => {
  return apiFetch('/visitors/active');
};

export const checkOutVisitor = async (id: string) => {
  return apiFetch(`/visitors/${id}/checkout`, { method: 'PUT' });
};

export const subscribeToActiveVisitors = (callback: (data: any[]) => void) => {
  getActiveVisitors().then(callback).catch(console.error);
  const s = getSocket();
  const handler = () => {
    getActiveVisitors().then(callback).catch(console.error);
  };
  s.on('visitors:updated', handler);
  return () => {
    s.off('visitors:updated', handler);
  };
};

export const subscribeToTodayVisitors = (callback: (data: any[]) => void) => {
  apiFetch('/visitors/today').then(callback).catch(console.error);
  const s = getSocket();
  const handler = () => {
    apiFetch('/visitors/today').then(callback).catch(console.error);
  };
  s.on('visitors:updated', handler);
  return () => {
    s.off('visitors:updated', handler);
  };
};

// ============================
// VENDORS
// ============================
export const getVendors = async () => {
  return apiFetch('/vendors');
};

export const addVendor = async (data: {
  fullName: string;
  phone: string;
  company?: string;
  supplies: string;
  notes?: string;
}) => {
  return apiFetch('/vendors', {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

export const deleteVendor = async (id: string) => {
  return apiFetch(`/vendors/${id}`, { method: 'DELETE' });
};

export const checkInVendor = async (
  vendorId: string,
  purpose: string,
  companyName: string,
  employeeName: string,
  employeePhone: string
) => {
  return apiFetch(`/vendors/${vendorId}/checkin`, {
    method: 'POST',
    body: JSON.stringify({
      purpose,
      companyName,
      visitorName: employeeName,
      visitorPhone: employeePhone
    })
  });
};

export const checkOutVendorVisit = async (visitId: string) => {
  return apiFetch(`/vendors/visits/${visitId}/checkout`, { method: 'PUT' });
};

export const getActiveVendorVisits = async () => {
  return apiFetch('/vendors/visits/active');
};

export const subscribeToVendors = (callback: (data: any[]) => void) => {
  getVendors().then(callback).catch(console.error);
  const s = getSocket();
  const handler = () => {
    getVendors().then(callback).catch(console.error);
  };
  s.on('vendors:updated', handler);
  s.on('vendors:deleted', handler);
  return () => {
    s.off('vendors:updated', handler);
    s.off('vendors:deleted', handler);
  };
};

export const subscribeToActiveVendorVisits = (callback: (data: any[]) => void) => {
  getActiveVendorVisits().then(callback).catch(console.error);
  const s = getSocket();
  const handler = () => {
    getActiveVendorVisits().then(callback).catch(console.error);
  };
  s.on('vendorVisits:updated', handler);
  return () => {
    s.off('vendorVisits:updated', handler);
  };
};

export const subscribeToTodayVendorVisits = (callback: (data: any[]) => void) => {
  apiFetch('/vendors/visits/today').then(callback).catch(console.error);
  const s = getSocket();
  const handler = () => {
    apiFetch('/vendors/visits/today').then(callback).catch(console.error);
  };
  s.on('vendorVisits:updated', handler);
  return () => {
    s.off('vendorVisits:updated', handler);
  };
};

// ============================
// USERS
// ============================
export const getSystemUsers = async () => {
  return apiFetch('/users');
};

export const createSystemUser = async (data: {
  name: string;
  role: 'superadmin' | 'admin' | 'security';
  email?: string;
  empId?: string;
}) => {
  return apiFetch('/users', {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

export const updateSystemUser = async (id: string, data: {
  role?: 'superadmin' | 'admin' | 'security';
  isActive?: boolean;
  name?: string;
  email?: string;
  empId?: string;
}) => {
  return apiFetch(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
};

export const deleteSystemUser = async (id: string) => {
  return apiFetch(`/users/${id}`, { method: 'DELETE' });
};

export const renewUserPassword = async (id: string) => {
  return apiFetch(`/users/${id}/reset-password`, { method: 'POST' });
};

export const subscribeToSystemUsers = (callback: (data: any[]) => void) => {
  getSystemUsers().then(callback).catch(console.error);
  const s = getSocket();
  const handler = () => {
    getSystemUsers().then(callback).catch(console.error);
  };
  s.on('users:updated', handler);
  s.on('users:deleted', handler);
  return () => {
    s.off('users:updated', handler);
    s.off('users:deleted', handler);
  };
};

// ============================
// AUDIT LOGS
// ============================
export const logSystemEvent = async (
  action: { type: string; category: string },
  target: { id: string; type: string; metadata?: any },
  status: 'SUCCESS' | 'FAILURE' = 'SUCCESS',
  description: string
) => {
  try {
    await apiFetch('/audit', {
      method: 'POST',
      body: JSON.stringify({
        eventType: action.type,
        category: action.category,
        targetType: target.type,
        targetId: target.id,
        status,
        description,
        metadata: target.metadata
      })
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
};

// ============================
// IMAGE COMPRESSION
// ============================
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

export const uploadFile = async (_path: string, file: File) => {
  return compressImage(file);
};