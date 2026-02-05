import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PrintLabel = () => {
    const navigate = useNavigate();
    const [qrData, setQrData] = useState<any>(null);
    const [imagesLoaded, setImagesLoaded] = useState({ logo: false, qr: false });

    useEffect(() => {
        // Load data from storage
        const storedData = localStorage.getItem('printLabelData');
        if (storedData) {
            setQrData(JSON.parse(storedData));
        } else {
            navigate('/dashboard/it');
        }
    }, [navigate]);

    const handlePrint = () => {
        window.print();
    };

    const handleImageLoad = (type: 'logo' | 'qr') => {
        setImagesLoaded(prev => ({ ...prev, [type]: true }));
    };

    if (!qrData) return <div style={{ padding: 20 }}>Loading label data...</div>;

    return (
        <div className="print-page-container">
            <style>{`
                /* Base Styles */
                body {
                    background-color: #f8fafc;
                }
                
                .print-page-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 20px;
                    min-height: 100vh;
                }

                .action-buttons {
                    margin-bottom: 24px;
                    display: flex;
                    gap: 12px;
                }

                .btn {
                    padding: 10px 20px;
                    border-radius: 6px;
                    border: none;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .btn-print { background: #e21a22; color: white; }
                .btn-back { background: white; color: #475569; border: 1px solid #cbd5e1; }

                /* Label Styles */
                .label-card {
                    width: 320px; /* Standard sticker width */
                    background: white;
                    padding: 16px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    text-align: center;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                }

                .label-logo { width: 100px; margin-bottom: 8px; }
                .label-tag { color: #e21a22; font-weight: 800; letter-spacing: 1px; margin-bottom: 8px; }
                .label-qr { width: 160px; height: 160px; margin-bottom: 8px; }
                .label-title { font-weight: 800; font-size: 1.1em; margin-bottom: 4px; }
                .label-text { color: #475569; font-size: 0.9em; margin: 2px 0; }
                .label-text strong { color: #000; }

                /* PRINT SPECIFIC STYLES */
                @media print {
                    /* Hide everything by default */
                    body * {
                        visibility: hidden;
                    }
                    
                    /* Reset Body */
                    body, html {
                        margin: 0;
                        padding: 0;
                        background: white;
                        height: 100%;
                        overflow: visible;
                    }

                    /* Show ONLY the label card and its children */
                    .label-card, .label-card * {
                        visibility: visible;
                    }

                    /* Position the label */
                    .label-card {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        max-width: 100%; /* Allow full width printing if needed, or keep fixed */
                        margin: 0;
                        padding: 10px;
                        border: none;
                        box-shadow: none;
                        border-radius: 0;
                    }
                    
                    /* Hide buttons explicitly */
                    .action-buttons {
                        display: none;
                    }
                }
            `}</style>
            
            <div className="action-buttons">
                <button className="btn btn-back" onClick={() => navigate(-1)}>
                    Back
                </button>
                <button 
                    className="btn btn-print" 
                    onClick={handlePrint}
                    // disabled={!imagesLoaded.logo && !imagesLoaded.qr} /* Removed strict check */
                >
                    🖨️ Print Label
                </button>
            </div>

            <div className="label-card">
                <img 
                    src="/logo.png" 
                    className="label-logo" 
                    alt="Minet" 
                    onLoad={() => handleImageLoad('logo')}
                    onError={(e) => {
                        console.error('Logo failed to load'); 
                        handleImageLoad('logo'); // Proceed anyway
                    }}
                />
                <div className="label-tag">ASSET TAG</div>
                
                <img 
                    src={qrData.url} 
                    className="label-qr" 
                    alt="QR Code" 
                    onLoad={() => handleImageLoad('qr')}
                />
                
                <div className="label-title">{qrData.device.make} {qrData.device.model}</div>
                <div className="label-text">S/N: <strong>{qrData.device.serialNumber}</strong></div>
                <div className="label-text">User: <strong>{qrData.device.employeeName || 'Unassigned'}</strong></div>
            </div>
        </div>
    );
};

export default PrintLabel;
