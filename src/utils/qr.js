import QRCode from 'qrcode';

/**
 * Generates a Minet QR code encoding only the device serial number.
 * All device and employee details are fetched live from the DB at scan time.
 * This means a printed label is valid forever — no reprint needed on reassignment
 * or if device details are corrected.
 * @param {string} serialNumber The device serial number to encode
 */
export const generateQRCode = async (serialNumber) => {
    if (!serialNumber) throw new Error('Serial number is required to generate QR code');

    try {
        return await QRCode.toDataURL(serialNumber, {
            width: 600,
            margin: 2,
            errorCorrectionLevel: 'H',
            color: {
                dark: '#E21A22', // Minet Red
                light: '#ffffff',
            },
        });
    } catch (err) {
        console.error("QR Generation Error:", err);
        throw err;
    }
};