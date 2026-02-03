import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Image as ImageIcon, StopCircle } from 'lucide-react';

interface QRScannerProps {
    onScanResult: (decodedText: string) => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScanResult }) => {
    const [isScanning, setIsScanning] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Initialize the scanner instance
        // We use the ID "reader" which corresponds to the div below
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        return () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().catch(err => console.error("Failed to stop scanner cleanup", err));
            }
        };
    }, []);

    const startScanning = async () => {
        if (!scannerRef.current) return;
        try {
            setIsScanning(true);
            const isMobile = window.innerWidth <= 640;
            const qrBoxSize = isMobile ? 200 : 250;

            await scannerRef.current.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: qrBoxSize, height: qrBoxSize },
                    aspectRatio: 1.0
                },
                (decodedText) => {
                    // Success callback
                    // Stop scanning immediately after success to prevent multiple triggers
                    stopScanning().then(() => {
                        onScanResult(decodedText);
                    });
                },
                () => { } // Ignore failures (scanning in progress)
            );
        } catch (err) {
            console.error("Error starting scanner", err);
            setIsScanning(false);
            alert("Failed to start camera. Please ensure camera permissions are granted.");
        }
    };

    const stopScanning = async () => {
        if (!scannerRef.current) return;
        try {
            // Check if scanning matches the internal state of the library
            // Sometimes isScanning state might be out of sync if the library fails internally
            await scannerRef.current.stop();
        } catch (err) {
            console.warn("Stop scanner warning:", err);
        } finally {
            setIsScanning(false);
        }
    };

    const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!scannerRef.current || !e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        try {
            const decodedText = await scannerRef.current.scanFile(file, true);
            onScanResult(decodedText);
        } catch (err) {
            console.error("Error scanning file", err);
            alert("Could not scan QR code from this image. Please make sure the QR code is clear and try again.");
        } finally {
            // Reset input so the same file can be selected again if needed
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* The Scanner Viewport */}
            <div style={{
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                border: '1px solid #e2e8f0',
                background: 'black',
                minHeight: '300px',
                position: 'relative'
            }}>
                <div id="reader" style={{ width: '100%', height: '100%' }}></div>

                {/* Visual placeholder when not scanning */}
                {!isScanning && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        flexDirection: 'column',
                        gap: '1rem',
                        pointerEvents: 'none' // Click through to reader if needed
                    }}>
                        <Camera size={48} opacity={0.5} />
                        <p style={{ margin: 0, opacity: 0.7, fontWeight: '500' }}>Camera is inactive</p>
                    </div>
                )}
            </div>

            {/* Control Buttons - Explicitly placed below */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {!isScanning ? (
                    <button
                        onClick={startScanning}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%' }}
                    >
                        <Camera size={20} /> Scan Camera
                    </button>
                ) : (
                    <button
                        onClick={stopScanning}
                        style={{
                            background: '#fee2e2',
                            color: 'var(--danger)',
                            border: 'none',
                            padding: '0.85rem',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            width: '100%'
                        }}
                    >
                        <StopCircle size={20} /> Stop Camera
                    </button>
                )}

                <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        background: 'white',
                        border: '1px solid #cbd5e1',
                        padding: '0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--secondary)',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        width: '100%'
                    }}
                >
                    <ImageIcon size={20} /> Scan Image
                </button>

                {/* Hidden File Input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleFileScan}
                />
            </div>
        </div>
    );
};

export default QRScanner;
