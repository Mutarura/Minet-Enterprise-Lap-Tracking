import { getDevices } from '../services/api';

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

    // Filter for Company Laptops only
    const companyDevices = devices.filter(d => d.type === 'COMPANY');

    for (const device of companyDevices) {
        if (device.last_action === 'CHECK_OUT' && device.last_action_at) {
            const checkoutTime = new Date(device.last_action_at);
            const diffMs = now.getTime() - checkoutTime.getTime();
            const diffHrs = diffMs / (1000 * 60 * 60);

            const isWeekendNow = now.getDay() === 0 || now.getDay() === 6;
            const dayOfWeek = checkoutTime.getDay();

            let isAlert = false;
            let reason: 'OVERTIME_WEEKDAY' | 'WEEKEND_STAY' = 'OVERTIME_WEEKDAY';

            if (isWeekendNow) {
                isAlert = true;
                reason = 'WEEKEND_STAY';
            } else if (diffHrs > 38) {
                isAlert = true;
                reason = 'OVERTIME_WEEKDAY';
            } else if (dayOfWeek === 5 && diffHrs > 66) {
                isAlert = true;
                reason = 'WEEKEND_STAY';
            }

            if (isAlert) {
                alerts.push({
                    id: device.serial_number,
                    employeeName: device.assigned_employee_name || 'Unknown',
                    empId: device.assigned_to || '',
                    serialNumber: device.serial_number,
                    checkedOutAt: checkoutTime,
                    durationHrs: Math.round(diffHrs),
                    reason
                });
            }
        }
    }

    return alerts;
};