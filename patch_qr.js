const fs = require('fs');

let content = fs.readFileSync('src/app/dashboard/observations/page.js', 'utf8');

if (!content.includes('QRCodeSVG')) {
    content = content.replace(
        "import { useSavedFlash } from '@/hooks/useSavedFlash';",
        "import { useSavedFlash } from '@/hooks/useSavedFlash';\nimport { QRCodeSVG } from 'qrcode.react';"
    );
}

if (!content.includes('setShowQR')) {
    content = content.replace(
        "const [viewingItem, setViewingItem] = useState(null);",
        "const [viewingItem, setViewingItem] = useState(null);\n    const [showQR, setShowQR] = useState(false);"
    );
}

const authMarker = "const { isAdmin } = useAuth();";
const authNew = "const { isAdmin, activeCompanyId } = useAuth();";
if (content.includes(authMarker) && !content.includes('activeCompanyId')) {
    content = content.replace(authMarker, authNew);
}

if (!content.includes('setShowQR(true)')) {
    const btnMarker = `{lang === 'bs' ? 'zabilježenih obzervacija s terena' : 'recorded field observations'}
                    </p>
                </div>`;
    const btnNew = `{lang === 'bs' ? 'zabilježenih obzervacija s terena' : 'recorded field observations'}
                    </p>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <button className="btn btn-primary" onClick={() => setShowQR(true)}>
                        🖨️ {lang === 'bs' ? 'Isprintaj QR Kod' : 'Print QR Code'}
                    </button>
                </div>`;
    content = content.replace(btnMarker, btnNew);
}

const modalMarker = `{/* Viewing Modal */}`;
const modalNew = `{/* QR Code Printable Modal */}
            {showQR && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card animate-fadeIn" style={{ background: '#fff', padding: 40, textAlign: 'center', maxWidth: 450, borderRadius: 16 }}>
                        <h2 style={{ color: '#000', marginBottom: 10, fontSize: 24, fontWeight: 900 }}>🚨 PRIJAVA OPASNOSTI</h2>
                        <p style={{ color: '#555', marginBottom: 30, fontSize: 14 }}>Skenirajte kod ispod i odmah prijavite kvar, štetu ili opasnu situaciju na gradilištu. Prijava ide direktno nadležnoj službi.</p>
                        <div style={{ background: '#fff', padding: 20, display: 'inline-block', borderRadius: 12, border: '4px solid #ef4444' }}>
                            <QRCodeSVG value={\`\${window.location.origin}/q/obs/\${activeCompanyId || 'all'}\`} size={220} />
                        </div>
                        <div style={{ marginTop: 30, display: 'flex', gap: 10, justifyContent: 'center' }}>
                            <button className="btn btn-ghost" style={{ background: '#f1f5f9', color: '#333' }} onClick={() => setShowQR(false)}>Zatvori</button>
                            <button className="btn btn-primary" style={{ background: '#ef4444', color: '#fff' }} onClick={() => window.print()}>🖨️ Printaj plakat</button>
                        </div>
                    </div>
                    {/* Hide backdrop and show ONLY poster when printing */}
                    <style>{\`
                        @media print {
                            body * { visibility: hidden; }
                            .card.animate-fadeIn, .card.animate-fadeIn * { visibility: visible; }
                            .card.animate-fadeIn { position: absolute; left: 0; top: 0; width: 100vw; height: 100vh; padding: 100px; text-align: center; box-shadow: none !important; border-radius: 0 !important; }
                            .btn { display: none !important; }
                        }
                    \`}</style>
                </div>
            )}

            {/* Viewing Modal */}`;

if (!content.includes('QR Code Printable Modal')) {
    content = content.replace(modalMarker, modalNew);
}

fs.writeFileSync('src/app/dashboard/observations/page.js', content, 'utf8');
console.log('Added QR Code Poster logic!');
