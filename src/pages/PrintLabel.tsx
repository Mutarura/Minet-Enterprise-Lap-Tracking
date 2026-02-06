import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const PrintLabel = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [qrData, setQrData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [imagesLoaded, setImagesLoaded] = useState({ logo: false, qr: false });

    useEffect(() => {
        // Try getting data from location state (navigation) first, then localStorage (backup)
        const stateData = location.state;
        if (stateData) {
            setQrData(stateData);
        } else {
            // Fallback to local storage for refresh
            try {
                const storedData = localStorage.getItem('printLabelData');
                if (storedData) {
                    setQrData(JSON.parse(storedData));
                } else {
                    setError("No label data found. Please go back to the dashboard and regenerate the QR code.");
                }
            } catch (err) {
                console.error("Failed to load print data:", err);
                setError("Failed to load label data.");
            }
        }
    }, [location]);

    const handlePrint = () => {
        try {
            // meaningful title for the print job (PDF filename)
            const oldTitle = document.title;
            if (qrData?.device?.serialNumber) {
                document.title = `Asset-${qrData.device.serialNumber}`;
            }

            // Direct synchronous call is required for many mobile browsers
            window.print();

            // Restore title after a small delay (printing is blocking in some browsers, non-blocking in others)
            setTimeout(() => { document.title = oldTitle; }, 1000);
        } catch (e) {
            console.error("Print invocation failed:", e);
            alert("Print command failed. Please use your browser's menu to Print.");
        }
    };

    const handleImageLoad = (type: 'logo' | 'qr') => {
        setImagesLoaded(prev => ({ ...prev, [type]: true }));
    };

    const handleImageError = (type: 'logo' | 'qr') => {
        console.warn(`Failed to load ${type} image - likely blocked by client`);
        setImagesLoaded(prev => ({ ...prev, [type]: true }));
    };

    const isReadyToPrint = imagesLoaded.logo && imagesLoaded.qr;

    useEffect(() => {
        // Auto-trigger print if requested via query param (optional, possibly for future)
        // But for now, just debugging
        console.log("Images loaded:", imagesLoaded);
    }, [imagesLoaded]);

    if (error) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
                <h2 style={{ color: '#e21a22' }}>Label Error</h2>
                <p>{error}</p>
                <button
                    onClick={() => navigate('/dashboard/it')}
                    style={{
                        padding: '10px 20px',
                        background: '#e21a22',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        marginTop: '20px'
                    }}
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }

    if (!qrData) return <div style={{ padding: 20 }}>Loading label data...</div>;

    return (
        <div className="print-page-container">
            <style>{`
                /* Base Styles */
                body {
                    background-color: #f8fafc;
                    margin: 0;
                }
                
                .print-page-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 40px 20px;
                    min-height: 100vh;
                    box-sizing: border-box;
                }

                .action-buttons {
                    margin-bottom: 30px;
                    display: flex;
                    flex-direction: column; /* Stacked Vertically */
                    gap: 16px;
                    width: 100%;
                    max-width: 320px; /* Match label width */
                }

                .btn {
                    padding: 14px 24px;
                    border-radius: 8px;
                    border: none;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    font-size: 16px;
                    transition: all 0.2s;
                    width: 100%; /* Full width in the stack */
                }
                
                .btn-print { 
                    background: #e21a22; 
                    color: white; 
                    box-shadow: 0 4px 6px -1px rgba(226, 26, 34, 0.2);
                }
                
                .btn-print:hover:not(:disabled) {
                    background: #b9151c;
                    transform: translateY(-1px);
                }

                .btn-print:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    background: #94a3b8;
                    box-shadow: none;
                }
                
                .btn-download {
                    background: white;
                    color: #0f172a;
                    border: 1px solid #cbd5e1;
                    box-shadow: 0 2px 4px -1px rgba(0,0,0,0.05);
                }
                
                .btn-download:hover {
                    background: #f8fafc;
                    border-color: #94a3b8;
                }

                .btn-back { 
                    background: transparent; 
                    color: #64748b; 
                    border: none;
                    padding: 8px;
                    font-weight: 600;
                    margin-bottom: 8px; 
                }
                .btn-back:hover { 
                    color: #334155; 
                    text-decoration: underline;
                }

                /* Label Styles - Screen */
                .label-card {
                    width: 320px;
                    background: white;
                    padding: 16px;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    text-align: center;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                }

                /* Label Content */
                .label-logo { width: 100px; margin-bottom: 8px; object-fit: contain; }
                .label-tag { color: #e21a22; font-weight: 800; letter-spacing: 1px; margin-bottom: 8px; font-family: sans-serif; }
                .label-qr { 
                    width: 160px; 
                    height: 160px; 
                    margin-bottom: 12px;
                    display: block;
                    margin-left: auto;
                    margin-right: auto;
                }
                .label-title { font-weight: 800; font-size: 1.1rem; margin-bottom: 4px; color: #0f172a; font-family: sans-serif; }
                .label-text { color: #475569; font-size: 0.9rem; margin: 2px 0; font-family: sans-serif; }
                .label-text strong { color: #0f172a; }

                /* PRINT SPECIFIC STYLES */
                @media print {
                    @page {
                        margin: 0;
                        size: auto;
                    }

                    body, html {
                        background: white;
                        margin: 0;
                        padding: 0;
                        width: 100%;
                        height: 100%;
                        overflow: visible !important;
                        visibility: hidden; /* Hide everything by default */
                    }

                    .print-page-container {
                        padding: 0;
                        margin: 0;
                        display: block;
                        width: auto;
                        height: auto;
                        visibility: visible; /* Show container */
                        position: absolute;
                        top: 0;
                        left: 0;
                    }

                    .action-buttons {
                        display: none !important;
                    }

                    .label-card {
                        visibility: visible;
                        position: relative; /* Use standard flow */
                        top: 0;
                        left: 0;
                        margin: 0;
                        width: 320px !important;
                        border: none;
                        box-shadow: none;
                        border-radius: 0;
                        padding: 10px;
                    }
                    
                    /* Ensure exact colors */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>

            <div className="action-buttons">
                <button
                    className="btn btn-print"
                    onClick={handlePrint}
                    disabled={!isReadyToPrint}
                >
                    {!isReadyToPrint ? 'Loading Graphics...' : '🖨️ Print Label'}
                </button>

                <button className="btn btn-back" onClick={() => navigate(-1)}>
                    ← Back to Dashboard
                </button>
            </div>

            <div className="label-card">
                <img
                    src="/logo.png"
                    className="label-logo"
                    alt="Minet"
                    onLoad={() => handleImageLoad('logo')}
                    onError={() => handleImageError('logo')}
                />
                <div className="label-tag">ASSET TAG</div>

                <img
                    src={qrData.url}
                    className="label-qr"
                    alt="QR Code"
                    onLoad={() => handleImageLoad('qr')}
                    onError={() => handleImageError('qr')}
                />

                <div className="label-title">{qrData.device.make} {qrData.device.model}</div>
                <div className="label-text">S/N: <strong>{qrData.device.serialNumber}</strong></div>
                <div className="label-text">User: <strong>{qrData.device.employeeName || 'Unassigned'}</strong></div>
            </div>
        </div>
    );
};

export default PrintLabel;
