import { addEmployee, addDevice, createSystemUser } from '../services/api';

const employees = [
    { empId: "EMP1001", name: "John Doe", departmentOrFloor: "Floor 1" },
    { empId: "EMP1002", name: "Jane Smith", departmentOrFloor: "Floor 2" },
    { empId: "EMP1003", name: "Mike Johnson", departmentOrFloor: "Floor 3" },
    { empId: "EMP1004", name: "Emily Davis", departmentOrFloor: "Floor 1" },
    { empId: "EMP1005", name: "Chris Wilson", departmentOrFloor: "Floor 4" },
    { empId: "INT1003", name: "Joe Ngala", departmentOrFloor:  "Floor 3"}
];

const devices = [
    { serialNumber: "MINET-1001", type: "COMPANY" as const, make: "Dell", model: "XPS 13", color: "Black", assignedTo: "EMP1001" },
    { serialNumber: "MINET-1002", type: "BYOD" as const, make: "Apple", model: "MacBook Air", color: "Silver", assignedTo: "EMP1001" },
    { serialNumber: "MINET-1003", type: "COMPANY" as const, make: "HP", model: "EliteBook", color: "Grey", assignedTo: "EMP1002" },
    { serialNumber: "MINET-1004", type: "COMPANY" as const, make: "Lenovo", model: "ThinkPad", color: "Black", assignedTo: "EMP1003" },
    { serialNumber: "MINET-1005", type: "BYOD" as const, make: "Asus", model: "Zenbook", color: "Blue", assignedTo: "EMP1003" }
];

export const bootstrapAdmin = async () => {
    console.log("Bootstrapping Admin...");
    try {
        await createSystemUser({
            name: 'System Super Admin',
            role: 'superadmin',
            email: 'admin@minetkenya.co.ke'
        });
        console.log("Admin bootstrapped successfully");
    } catch (error: any) {
        if (error.message?.includes('already exists')) {
            console.log("Admin account already exists");
        } else {
            console.error("Bootstrap error:", error);
            throw error;
        }
    }
};

export const seedDatabase = async () => {
    console.log("Seeding started...");
    try {
        console.log("Seeding employees...");
        for (const emp of employees) {
            try {
                await addEmployee(emp);
                console.log(`Added employee: ${emp.name}`);
            } catch (e: any) {
                console.log(`Employee ${emp.empId} may already exist:`, e.message);
            }
        }

        console.log("Seeding devices...");
        for (const dev of devices) {
            try {
                await addDevice(dev);
                console.log(`Added device: ${dev.serialNumber}`);
            } catch (e: any) {
                console.log(`Device ${dev.serialNumber} may already exist:`, e.message);
            }
        }

        console.log("Seeding completed!");
        alert("System Initialized Successfully!");
    } catch (error: any) {
        console.error("Error seeding database:", error);
        alert("Error initializing system: " + (error.message || error));
    }
};