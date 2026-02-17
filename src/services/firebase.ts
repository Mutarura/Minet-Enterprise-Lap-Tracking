import { db, storage, auth, secondaryAuth } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    updateDoc,
    doc,
    Timestamp,
    setDoc,
    query,
    where,
    serverTimestamp,
    orderBy,
    onSnapshot,
    deleteDoc
} from "firebase/firestore";
// Storage imports removed to bypass billing/bucket requirements
// import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export { auth, db, storage, secondaryAuth };

// ============================
// COLLECTION REFERENCES
// ============================
export const collections = {
    employees: collection(db, "employees"),
    devices: collection(db, "devices"),
    logs: collection(db, "logs"),
    visitors: collection(db, "visitors"),
    vendors: collection(db, "vendors"),
    vendorVisits: collection(db, "vendorVisits"),
    users: collection(db, "users"),
    auditLogs: collection(db, "auditLogs"),
};

// ============================
// EMPLOYEE LOGIC
// ============================

export const getEmployees = async () => {
    const snapshot = await getDocs(collections.employees);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const subscribeToEmployees = (callback: (data: any[]) => void) => {
    return onSnapshot(collections.employees, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
    }, (error) => {
        console.error("Employee Subscription Error:", error);
    });
};

export const getEmployeeByEmpId = async (empId: string) => {
    const q = query(collections.employees, where("empId", "==", empId));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }
    return null;
};

export const addEmployee = async (data: {
    empId: string;
    name: string;
    departmentOrFloor: string;
    photoFile?: File;
}) => {
    let photoURL = "https://ui-avatars.com/api/?name=" + encodeURIComponent(data.name || "User");

    if (data.photoFile) {
        try {
            photoURL = await uploadFile(`employee_photos / ${data.empId}_${Date.now()} `, data.photoFile);
        } catch (storageError) {
            console.error("Storage Error:", storageError);
            throw new Error("PHOTO_UPLOAD_FAILED: Could not save the profile picture. This usually happens if the Firebase Storage 'bucket' is not enabled in the console.");
        }
    }

    // Use setDoc with empId as the document ID for idempotency and easier lookup
    await setDoc(doc(db, "employees", data.empId), {
        empId: data.empId,
        name: data.name,
        departmentOrFloor: data.departmentOrFloor,
        photoURL,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
};

export const updateEmployee = async (
    id: string,
    data: { name?: string; departmentOrFloor?: string; photoFile?: File }
) => {
    const docRef = doc(db, "employees", id);
    const docSnap = await getDoc(docRef);
    const existingData = docSnap.data();

    // Unique filename to bypass browser cache
    const photoURL = data.photoFile
        ? await uploadFile(`employee_photos / ${existingData?.empId}_${Date.now()} `, data.photoFile)
        : existingData?.photoURL;

    const updatePayload: any = {
        updatedAt: Timestamp.now(),
        photoURL
    };

    if (data.name) updatePayload.name = data.name;
    if (data.departmentOrFloor) updatePayload.departmentOrFloor = data.departmentOrFloor;

    await updateDoc(docRef, updatePayload);
};

export const deleteEmployee = async (id: string) => {
    // Also unassign devices? Requirement says retired devices are deleted.
    // We should probably just delete the employee and clear the assignedTo in devices.
    const empSnap = await getDoc(doc(db, "employees", id));
    const empData = empSnap.data();

    if (empData) {
        const q = query(collections.devices, where("assignedTo", "==", empData.empId));
        const deviceSnaps = await getDocs(q);
        for (const d of deviceSnaps.docs) {
            await updateDoc(d.ref, { assignedTo: null, updatedAt: Timestamp.now() });
        }
    }

    await deleteDoc(doc(db, "employees", id));
};

// ============================
// DEVICE LOGIC
// ============================

export const getDevices = async () => {
    const snapshot = await getDocs(collections.devices);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const subscribeToDevices = (callback: (data: any[]) => void) => {
    return onSnapshot(collections.devices, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
    }, (error) => {
        console.error("Device Subscription Error:", error);
    });
};

export const addDevice = async (data: {
    serialNumber: string;
    type: "COMPANY" | "BYOD";
    make: string;
    model: string;
    color: string;
    assignedTo?: string | null; // empId
}) => {
    if (!data.assignedTo || data.assignedTo.trim() === "") {
        throw new Error("Devices must be assigned to an employee when registered.");
    }

    const devicesSnap = await getDocs(collections.devices);
    const allDevices = devicesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as any);
    const assignedDevices = allDevices.filter(d => d.assignedTo === data.assignedTo && d.type === data.type);

    if (data.type === 'COMPANY' && assignedDevices.length >= 1) {
        throw new Error(`This employee already has a COMPANY device(${assignedDevices[0].serialNumber}).Only one per type is permitted.`);
    }

    if (data.type === 'BYOD' && assignedDevices.length >= 2) {
        throw new Error(`This employee has reached the maximum allowed BYOD devices(2).`);
    }

    await setDoc(doc(db, "devices", data.serialNumber), {
        ...data,
        qrCodeURL: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
};

export const updateDevice = async (serialNumber: string, data: Partial<{
    assignedTo: string | null;
    make: string;
    model: string;
    color: string;
    type: "COMPANY" | "BYOD";
    qrCodeURL?: string | null;
}>) => {
    // If we are assigning to an employee, check limits
    if (data.assignedTo) {
        const devicesSnap = await getDocs(collections.devices);
        const allDevices = devicesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as any);

        // Get the current device's type if not provided in data
        let deviceType = data.type;
        if (!deviceType) {
            const currentDeviceSnap = await getDoc(doc(db, "devices", serialNumber));
            deviceType = currentDeviceSnap.data()?.type;
        }

        const assignedDevices = allDevices.filter(d =>
            d.assignedTo === data.assignedTo &&
            d.type === deviceType &&
            d.id !== serialNumber
        );

        if (deviceType === 'COMPANY' && assignedDevices.length >= 1) {
            throw new Error(`This employee already has a COMPANY device(${assignedDevices[0].serialNumber}).`);
        }

        if (deviceType === 'BYOD' && assignedDevices.length >= 2) {
            throw new Error(`This employee has reached the maximum allowed BYOD devices(2).`);
        }
    }

    const docRef = doc(db, "devices", serialNumber);
    await updateDoc(docRef, { ...data, updatedAt: Timestamp.now() });
};

export const retireDevice = async (id: string) => {
    await deleteDoc(doc(db, "devices", id));
};

// ============================
// LOGS LOGIC
// ============================

export const addLog = async (log: {
    empId: string;
    employeeName: string;
    serialNumber: string;
    action: "CHECK_IN" | "CHECK_OUT";
}) => {
    // 1. Create the log entry with dual timestamps for auditing
    await addDoc(collections.logs, {
        ...log,
        timestamp: Timestamp.now(), // Device/Client clock
        logstamp: serverTimestamp(), // Unalterable Server clock for auditing
        readableLogstamp: new Date().toLocaleString()
    });

    // 2. Update the device status to prevent double actions
    const deviceRef = doc(db, "devices", log.serialNumber);
    await updateDoc(deviceRef, {
        lastAction: log.action,
        lastActionAt: serverTimestamp(),
        updatedAt: Timestamp.now()
    });
};

export const subscribeToAllLogs = (callback: (data: any[]) => void) => {
    const q = query(collections.logs, orderBy("timestamp", "desc"));
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
    }, (error) => {
        console.error("Logs Subscription Error:", error);
    });
};

// ============================
// VISITORS & VENDORS LOGIC
// ============================

// --- VISITORS ---

export const getActiveVisitors = async () => {
    // Get visitors who are currently Checked IN
    const q = query(
        collections.visitors,
        where("status", "==", "IN"),
        orderBy("checkInTime", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const subscribeToActiveVisitors = (callback: (data: any[]) => void) => {
    const q = query(
        collections.visitors,
        where("status", "==", "IN")
        // orderBy("checkInTime", "desc") // Commented out to prevent index errors
    );
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
    }, (error) => {
        console.error("Visitor Subscription Error:", error);
    });
};

export const subscribeToTodayVisitors = (callback: (data: any[]) => void) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const q = query(
        collections.visitors,
        where("checkInTime", ">=", Timestamp.fromDate(today)),
        orderBy("checkInTime", "desc")
    );
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
    }, (error) => {
        console.error("Today Visitor Subscription Error:", error);
    });
};

export const addVisitor = async (data: {
    type: "QUICK" | "STANDARD";
    name: string;
    phone?: string;
    identifier: string; // Required for both now (ID/Passport)
    destination?: string; // Standard only
    reason: string;
    // New Device Fields (Standard only)
    deviceType?: string;
    deviceMakeModel?: string;
    deviceSerial?: string;
    deviceColor?: string;
}) => {
    // Generate a simple sequential-looking ID using timestamp suffix
    const visitorId = `VIS - ${Date.now().toString().slice(-6)} `;

    await addDoc(collections.visitors, {
        visitorId,
        ...data,
        status: "IN",
        checkInTime: Timestamp.now(),
        checkOutTime: null,
        handledBy: auth.currentUser?.displayName || auth.currentUser?.email || "Security"
    });
};



export const checkOutVisitor = async (docId: string) => {
    const docRef = doc(db, "visitors", docId);
    await updateDoc(docRef, {
        status: "OUT",
        checkOutTime: Timestamp.now(),
        handledBy: auth.currentUser?.displayName || auth.currentUser?.email || "Security" // Update who handled the checkout
    });
};

// --- VENDORS ---

export const getVendors = async () => {
    const snapshot = await getDocs(collections.vendors);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const subscribeToVendors = (callback: (data: any[]) => void) => {
    return onSnapshot(collections.vendors, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
    }, (error) => {
        console.error("Vendor Subscription Error:", error);
    });
};

export const addVendor = async (data: {
    fullName: string;
    phone: string;
    company?: string;
    supplies: string;
    notes?: string;
}) => {
    const vendorId = `VEN - ${Date.now().toString().slice(-6)} `;
    await addDoc(collections.vendors, {
        vendorId,
        ...data,
        isActive: true,
        createdAt: Timestamp.now(),
        createdBy: auth.currentUser?.displayName || auth.currentUser?.email || "Security"
    });
};

export const deleteVendor = async (vendorId: string) => {
    await deleteDoc(doc(db, "vendors", vendorId));
};

export const getActiveVendorVisits = async () => {
    const q = query(
        collections.vendorVisits,
        where("status", "==", "IN"),
        orderBy("checkInTime", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const subscribeToActiveVendorVisits = (callback: (data: any[]) => void) => {
    const q = query(
        collections.vendorVisits,
        where("status", "==", "IN")
        // orderBy("checkInTime", "desc") // Commented out to prevent index errors
    );
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
    }, (error) => {
        console.error("Vendor Visit Subscription Error:", error);
    });
};

export const subscribeToTodayVendorVisits = (callback: (data: any[]) => void) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const q = query(
        collections.vendorVisits,
        where("checkInTime", ">=", Timestamp.fromDate(today)),
        orderBy("checkInTime", "desc")
    );
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
    }, (error) => {
        console.error("Today Vendor Visit Subscription Error:", error);
    });
};

export const checkInVendor = async (
    vendorId: string,
    purpose: string,
    companyName: string,
    employeeName: string,
    employeePhone: string
) => {
    // checkInVendor now creates a NEW visit record
    await addDoc(collections.vendorVisits, {
        vendorId,
        vendorName: companyName, // Storing company name as vendorName for backward compatibility in display query or update display logic
        companyName,
        visitorName: employeeName,
        visitorPhone: employeePhone,
        purpose,
        status: "IN",
        checkInTime: Timestamp.now(),
        checkOutTime: null,
        handledBy: auth.currentUser?.displayName || auth.currentUser?.email || "Security"
    });
};

export const checkOutVendorVisit = async (visitId: string) => {
    const docRef = doc(db, "vendorVisits", visitId);
    await updateDoc(docRef, {
        status: "OUT",
        checkOutTime: Timestamp.now(),
        handledBy: auth.currentUser?.displayName || auth.currentUser?.email || "Security"
    });
};


// ============================
// ROLE & USER MANAGEMENT
// ============================

export const addAuditLog = async (action: string, targetId: string, details: any) => {
    await addDoc(collections.auditLogs, {
        action,
        targetId,
        details,
        performedBy: auth.currentUser?.displayName || auth.currentUser?.email || "Unknown",
        timestamp: serverTimestamp()
    });
};

export const generateUsername = async (fullName: string, forceSuffix?: string) => {
    const parts = fullName.trim().split(" ");
    const firstName = parts[0];
    const lastName = parts.length > 1 ? parts[parts.length - 1] : "";

    // Logic: SecondName + FirstLetterOfFirstName (Lowercased for consistency)
    let baseUsername = (lastName + (firstName ? firstName[0] : "")).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

    if (forceSuffix) {
        baseUsername += forceSuffix;
    }

    // Ensure uniqueness in Firestore
    let username = baseUsername;
    let counter = 1;
    let exists = true;

    while (exists) {
        const q = query(collections.users, where("username", "==", username));
        const snap = await getDocs(q);
        if (snap.empty) {
            exists = false;
        } else {
            username = baseUsername + counter;
            counter++;
        }
    }

    return username;
};

export const createSystemUser = async (data: {
    name: string;
    role: "superadmin" | "admin" | "security";
    email?: string; // Added for seeding
    password?: string; // Added for seeding
}) => {
    // Helper to attempt creation
    const attemptCreation = async (attemptName: string, attemptSuffix?: string): Promise<{ username: string, tempPassword: string, uid: string }> => {
        const username = await generateUsername(attemptName, attemptSuffix);
        const email = data.email || `${username.toLowerCase()}@minet.com`;
        const tempPassword = data.password || Math.random().toString(36).substring(2, 12);

        try {
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword);
            const uid = userCredential.user.uid;

            // 3. Create Firestore record
            await setDoc(doc(db, "users", uid), {
                uid: uid,
                name: data.name,
                username: username,
                email: email,
                role: data.role,
                isActive: true, // New users enabled by default
                mustChangePassword: true, // Users must change pswd upon activation
                tempPassword: tempPassword,
                createdAt: serverTimestamp(),
                createdBy: auth.currentUser?.displayName || auth.currentUser?.email
            });

            await addAuditLog("CREATE_USER", uid, { username, role: data.role });
            return { username, tempPassword, uid };
        } catch (authError: any) {
            if (authError.code === 'auth/email-already-in-use' && !data.email) {
                // If the default generated email is taken, try once more with a random 2-digit suffix
                const randomSuffix = Math.floor(10 + Math.random() * 90).toString();
                return attemptCreation(attemptName, randomSuffix);
            }
            throw authError;
        }
    };

    try {
        return await attemptCreation(data.name);
    } catch (error: any) {
        console.error("Critical User Creation Error:", error);
        if (error.code === 'auth/email-already-in-use') {
            throw new Error("This user identity still exists in the Security Auth system. Please use a slightly different name or contact IT to manually clear the old record.");
        }
        throw error;
    }
};

export const activateUserAccount = async (username: string) => {
    // 1. Find user by username (normalization)
    const normalizedUsername = username.trim().toLowerCase();
    const q = query(collections.users, where("username", "==", normalizedUsername));
    const snap = await getDocs(q);

    if (snap.empty) {
        // Fallback: Check if they entered their full email
        if (normalizedUsername.includes('@')) {
            const q2 = query(collections.users, where("email", "==", normalizedUsername));
            const snap2 = await getDocs(q2);
            if (!snap2.empty) return { email: snap2.docs[0].data().email, tempPassword: snap2.docs[0].data().tempPassword, uid: snap2.docs[0].id };
        }
        throw new Error("Username not found. Please ensure you typed it correctly or contact Admin.");
    }
    const userDoc = snap.docs[0];
    const userData = userDoc.data();

    if (!userData.mustChangePassword) throw new Error("Account already active. Please log in.");
    if (!userData.isActive) throw new Error("Account is disabled. Contact Admin.");

    // Return credentials needed for activation sign-in
    return { email: userData.email, tempPassword: userData.tempPassword, uid: userDoc.id };
};

export const updateSystemUser = async (uid: string, data: {
    role?: "superadmin" | "admin" | "security";
    isActive?: boolean;
    name?: string;
}) => {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
        ...data,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.displayName || auth.currentUser?.email
    });

    await addAuditLog("UPDATE_USER", uid, data);
};

export const deleteSystemUser = async (uid: string) => {
    const userRef = doc(db, "users", uid);
    await deleteDoc(userRef);
    await addAuditLog("DELETE_USER", uid, { action: "PERMANENT_DELETE" });
};

export const resetUserPassword = async (uid: string) => {
    // Note: Due to Firebase Client SDK security, we can update the Temp Password in Firestore,
    // but we cannot force-update the Auth password for ANOTHER user.
    // The Admin should usually delete and re-create the user if they lost the password before activation.
    const tempPassword = Math.random().toString(36).substring(2, 12);
    const userRef = doc(db, "users", uid);

    await updateDoc(userRef, {
        tempPassword: tempPassword,
        mustChangePassword: true,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.displayName || auth.currentUser?.email
    });

    await addAuditLog("RESET_PASSWORD", uid, {
        action: "REQUEST_NEW_TEMP",
        note: "Firestore record updated. If user cannot login, delete and re-create user in Auth."
    });

    return tempPassword;
};

export const getSystemUsers = async () => {
    const snapshot = await getDocs(collections.users);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const subscribeToSystemUsers = (callback: (data: any[]) => void) => {
    return onSnapshot(collections.users, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
    });
};

/**
 * COMPRESSION HELPER
 * Resizes images to max 400px and converts to compressed Base64.
 * This bypasses the need for Firebase Storage "Buckets" which require billing.
 */
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

                // Export as compressed JPEG Base64
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // 70% quality
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

export const uploadFile = async (_path: string, file: File) => {
    try {
        // Instead of uploading to Firebase Storage, we compress and return Base64
        // This is stored directly in Firestore, bypassing billing restrictions.
        console.log("Using Local Base64 Storage for", file.name);
        return await compressImage(file);
    } catch (error) {
        console.error("Local Image Processing Error:", error);
        throw new Error("Failed to process image. Please try a different photo.");
    }
};
