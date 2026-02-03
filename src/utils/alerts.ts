import { collections } from '../services/firebase';
import { query, where, orderBy, getDocs, limit } from 'firebase/firestore';

export interface Alert {
    id: string;
    employeeName: string;
    empId: string;
    serialNumber: string;
    checkedOutAt: Date;
    durationHrs: number;
    reason: 'OVERTIME_WEEKDAY' | 'WEEKEND_STAY';
}

export const getSystemAlerts = async (devices: any[]): Promise<Alert[]> => {
    const alerts: Alert[] = [];
    const now = new Date();

    // 1. Filter for Company Laptops only
    const companyDevices = devices.filter(d => d.type === 'COMPANY');

    for (const device of companyDevices) {
        // 2. Get the very last log for this device
        const q = query(
            collections.logs,
            where("serialNumber", "==", device.serialNumber),
            orderBy("timestamp", "desc"),
            limit(1)
        );

        const snap = await getDocs(q);
        if (snap.empty) continue;

        const lastLog = snap.docs[0].data();

        // 3. Only care if it is currently CHECKED_OUT
        if (lastLog.action === 'CHECK_OUT') {
            const checkoutTime = lastLog.timestamp.toDate();
            const diffMs = now.getTime() - checkoutTime.getTime();
            const diffHrs = diffMs / (1000 * 60 * 60);

            const dayOfWeek = checkoutTime.getDay(); // 0 (Sun) to 6 (Sat)
            const isWeekendNow = now.getDay() === 0 || now.getDay() === 6;

            let isAlert = false;
            let reason: 'OVERTIME_WEEKDAY' | 'WEEKEND_STAY' = 'OVERTIME_WEEKDAY';

            // Logic 1: Laptop is out during the weekend
            if (isWeekendNow) {
                isAlert = true;
                reason = 'WEEKEND_STAY';
            }
            // Logic 2: Out for more than 38 hours (general rule)
            else if (diffHrs > 38) {
                isAlert = true;
                reason = 'OVERTIME_WEEKDAY';
            }
            // Logic 3: Out from Friday and longer than 66 hours
            else if (dayOfWeek === 5 && diffHrs > 66) {
                isAlert = true;
                reason = 'WEEKEND_STAY';
            }

            if (isAlert) {
                alerts.push({
                    id: device.serialNumber,
                    employeeName: lastLog.employeeName,
                    empId: lastLog.empId,
                    serialNumber: device.serialNumber,
                    checkedOutAt: checkoutTime,
                    durationHrs: Math.round(diffHrs),
                    reason: reason
                });
            }
        }
    }

    return alerts;
};
