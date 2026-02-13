import { db, auth } from "../services/firebase";
import { doc, setDoc, addDoc, collection, Timestamp, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";

const seedUsers = async () => {
    const users = [
        { username: 'admin', email: 'admin@minet.com', password: 'MinetAdmin1!', role: 'superadmin' },
        { username: 'security', email: 'security@minet.com', password: 'GateSecure1!', role: 'security' }
    ];

    for (const user of users) {
        try {
            let uid;
            try {
                // Try creating the user
                const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
                uid = userCredential.user.uid;
                console.log(`Created new auth user: ${user.email}`);
            } catch (authError) {
                if (authError.code === 'auth/email-already-in-use') {
                    // Just catch it, we'll try to update Firestore if we have a session
                    // Note: Cannot get UID without login or admin SDK
                    console.log(`User ${user.email} already exists in Auth.`);
                } else {
                    throw authError;
                }
            }

            // If we have a UID (new user), or if we are the current user, update Firestore
            if (uid) {
                await setDoc(doc(db, "users", uid), {
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    updatedAt: Timestamp.now()
                });
                console.log(`Ensured Firestore record for ${user.username} (${user.role})`);
            }
        } catch (error) {
            console.error(`Unexpected error seeding user ${user.email}:`, error.message);
        }
    }
};

/**
 * Specifically just creates the Super Admin if they don't exist.
 * Safe to call even if the DB rules are slightly restrictive for cleaning.
 */
export const bootstrapAdmin = async () => {
    console.log("Bootstrapping Admin...");
    try {
        const admin = { username: 'admin', email: 'admin@minet.com', password: 'MinetAdmin1!', role: 'superadmin' };

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, admin.email, admin.password);
            const uid = userCredential.user.uid;
            await setDoc(doc(db, "users", uid), {
                username: admin.username,
                email: admin.email,
                role: admin.role,
                isActive: true,
                updatedAt: Timestamp.now()
            });
            console.log("Admin bootstrapped successfully with UID: " + uid);
        } catch (e) {
            if (e.code === 'auth/email-already-in-use') {
                console.log("Admin account already exists in Auth.");
            } else {
                throw e;
            }
        }
    } catch (error) {
        console.error("Bootstrap error:", error);
        throw error;
    }
};

const employees = [
    { empId: "EMP1001", name: "John Doe", departmentOrFloor: "Floor 1" },
    { empId: "EMP1002", name: "Jane Smith", departmentOrFloor: "Floor 2" },
    { empId: "EMP1003", name: "Mike Johnson", departmentOrFloor: "Floor 3" },
    { empId: "EMP1004", name: "Emily Davis", departmentOrFloor: "Floor 1" },
    { empId: "EMP1005", name: "Chris Wilson", departmentOrFloor: "Floor 4" }
];

const devices = [
    { serialNumber: "MINET-1001", type: "COMPANY", make: "Dell", model: "XPS 13", specifications: "i7, 16GB, 512GB", assignedTo: "EMP1001" },
    { serialNumber: "MINET-1002", type: "BYOD", make: "Apple", model: "MacBook Air", specifications: "M2, 8GB, 256GB", assignedTo: "EMP1001" },
    { serialNumber: "MINET-1003", type: "COMPANY", make: "HP", model: "EliteBook", specifications: "i5, 16GB, 256GB", assignedTo: "EMP1002" },
    { serialNumber: "MINET-1004", type: "COMPANY", make: "Lenovo", model: "ThinkPad", specifications: "Ryzen 7, 32GB, 1TB", assignedTo: null },
    { serialNumber: "MINET-1005", type: "BYOD", make: "Asus", model: "Zenbook", specifications: "i7, 16GB, 512GB", assignedTo: "EMP1003" }
];

export const seedDatabase = async () => {
    console.log("Seeding started...");
    try {
        console.log("1. Cleaning existing data...");
        const collectionsList = ["employees", "devices", "logs", "users"];
        for (const coll of collectionsList) {
            console.log(`Clearing ${coll}...`);
            const snap = await getDocs(collection(db, coll));
            for (const d of snap.docs) {
                await deleteDoc(d.ref);
            }
        }

        console.log("2. Seeding users...");
        await seedUsers();

        console.log("3. Seeding employees...");
        for (const emp of employees) {
            await addDoc(collection(db, "employees"), {
                ...emp,
                photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=random`,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            console.log(`Added employee: ${emp.name}`);
        }

        for (const dev of devices) {
            await setDoc(doc(db, "devices", dev.serialNumber), {
                ...dev,
                qrCodeURL: null,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            console.log(`Added device: ${dev.serialNumber}`);
        }

        console.log("Seeding completed!");
        alert("System Initialized Successfully! You can now login.");
    } catch (error) {
        console.error("Error seeding database:", error);
        if (error.message && error.message.includes("permission")) {
            alert("Permission Denied! Please ensure:\n1. Firestore is ENABLED in the Firebase Console.\n2. Security Rules are set to allow access (currently set to open in firestore.rules).\n3. You have deployed the rules via CLI (npx firebase deploy --only firestore:rules).");
        } else {
            alert("Error initializing system: " + (error.message || error));
        }
    }
};
