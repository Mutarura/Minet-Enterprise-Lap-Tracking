import QRCode from 'qrcode';

/**
 * Generates a Minet-branded QR code including metadata
 * @param {Object} metadata The device and employee metadata to encode
 */
export const generateQRCode = async (metadata) => {
    try {
        // Validation of metadata
        const required = ['serialNumber', 'make', 'model'];
        for (const field of required) {
            if (!metadata[field]) throw new Error(`Missing required QR field: ${field}`);
        }

        // Encode as JSON string
        const dataString = JSON.stringify(metadata);

        return await QRCode.toDataURL(dataString, {
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
