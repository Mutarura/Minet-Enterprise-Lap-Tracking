import { db, storage, auth } from "../firebase";
import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    updateDoc,
    deleteDoc,
    doc,
    Timestamp,
    setDoc,
    query,
    where,
    serverTimestamp
} from "firebase/firestore";
// Storage imports removed to bypass billing/bucket requirements
// import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export { auth, db, storage };

// ============================
// COLLECTION REFERENCES
// ============================
export const collections = {
    employees: collection(db, "employees"),
    devices: collection(db, "devices"),
    logs: collection(db, "logs"),
};

// ============================
// EMPLOYEE LOGIC
// ============================

export const getEmployees = async () => {
    const snapshot = await getDocs(collections.employees);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
            photoURL = await uploadFile(`employee_photos/${data.empId}_${Date.now()}`, data.photoFile);
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
        ? await uploadFile(`employee_photos/${existingData?.empId}_${Date.now()}`, data.photoFile)
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

export const addDevice = async (data: {
    serialNumber: string;
    type: "COMPANY" | "BYOD";
    make: string;
    model: string;
    color: string;
    assignedTo?: string | null; // empId
}) => {
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

        const existing = allDevices.find(d =>
            d.assignedTo === data.assignedTo &&
            d.type === deviceType &&
            d.id !== serialNumber // Ensure we're not checking against itself
        );

        if (existing) {
            throw new Error(`This employee already has a ${deviceType} device (${existing.serialNumber}).`);
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
