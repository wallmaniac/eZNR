'use client';
import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { uploadSecureFile } from '@/lib/storageService';
import { getCompanyBranding } from '@/lib/brandingService';

import { useParams } from 'next/navigation';

export default function PublicObservationForm() {
    const params = useParams();
    const companyId = params?.companyId;
    const { lang , t } = useLanguage();
    
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    
    const [formData, setFormData] = useState({
        opis: '',
        lokacija: '',
        ime: '',
        orgJedinicaId: '',
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const fileInputCameraRef = useRef(null);
    const fileInputGalleryRef = useRef(null);
    
    // UI Branding (read-only, public)
    const [companyInfo, setCompanyInfo] = useState({ name: 'Kompanija', logo: '' });
    const [orgUnits, setOrgUnits] = useState([]);
    
    useEffect(() => {
        const fetchBrand = async () => {
            if (!companyId || companyId === 'all') return;
            try {
                const docRef = doc(db, 'companies', companyId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    // Fetch org units via proxy since this is a public page
                    fetch('/api/firebase-proxy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ functionName: 'getOrgUnits', data: { companyId } })
                    }).then(r => r.json()).then(res => {
                        const d = res.result || res;
                        if (d && d.success && d.orgUnits) setOrgUnits(d.orgUnits);
                    }).catch(console.error);
                    setCompanyInfo({ 
                        name: data.skraceniNaziv || data.naziv || 'Kompanija', 
                        logo: data.logo || data.branding?.logo || '' 
                    });
                }
            } catch(e) {
                console.error("Failed fetching company brand:", e);
            }
        };
        fetchBrand();
    }, [companyId]);

    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = event => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX = 1280;

                    if (width > height) {
                        if (width > MAX) { height *= MAX / width; width = MAX; }
                    } else {
                        if (height > MAX) { width *= MAX / height; height = MAX; }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // WebP format triggers client-side size reduction ~70% over JPEG
                    canvas.toBlob((blob) => {
                        resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                            type: 'image/webp',
                            lastModified: Date.now()
                        }));
                    }, 'image/webp', 0.8);
                };
                img.onerror = error => reject(error);
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setErrorMsg(t('youCanOnlySelectImages'));
            return;
        }

        try {
            const compressed = await compressImage(file);
            setImageFile(compressed);
            
            // Create a preview object url
            const objUrl = URL.createObjectURL(compressed);
            setImagePreview(objUrl);
        } catch (err) {
            setErrorMsg(t('errorProcessingImage'));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        if (!formData.opis.trim() || !formData.lokacija.trim()) {
            setErrorMsg(t('descriptionAndLocationAreMandatory'));
            return;
        }

        setSubmitting(true);
        try {
            // 1. Convert Image to Base64 (Bypass Client Storage Rules)
            let base64Image = null;
            if (imageFile) {
                base64Image = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(imageFile);
                });
            }

            // 2. Save to Firestore & Storage via Firebase Proxy
            let proxyDbData = null;
            try {
                const proxyDbRes = await fetch('/api/firebase-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        functionName: 'saveHazard',
                        data: {
                            companyId,
                            base64Image,
                            mimeType: imageFile ? imageFile.type : null,
                            payload: {
                                opis: formData.opis,
                                lokacija: formData.lokacija,
                                orgJedinicaId: formData.orgJedinicaId,
                                ime: formData.ime || 'Anonimno',
                                status: 'Novo',
                                datum: new Date().toISOString(),
                            }
                        }
                    })
                });
                proxyDbData = await proxyDbRes.json();
                const proxyDbResult = proxyDbData.result || proxyDbData; // Handle both wrapped and unwrapped safely
                if (!proxyDbResult.success) {
                    throw new Error(proxyDbResult.error || 'Server rejected saveHazard');
                }
                // Overwrite proxyDbData to be the actual result for the email step below
                proxyDbData = proxyDbResult;
            } catch(dbErr) {
                console.error('Firestore save via proxy failed:', dbErr);
                throw new Error('Database locked or unavailable');
            }

            // 3. Send Email Alert by requesting proxy
            let targetEmail = '';
            try {
                const nsRes = await fetch('/api/firebase-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ functionName: 'getNotifSettings', data: { companyId: String(companyId) } })
                });
                const nsDataRaw = await nsRes.json();
                const nsData = nsDataRaw.result || nsDataRaw;
                console.log('[Hazard] notif settings response:', nsData);
                if (nsData?.success && nsData.settings?.obsNotifEmail) {
                    targetEmail = nsData.settings.obsNotifEmail.trim();
                } else {
                    console.warn('[Hazard] obsNotifEmail not found in settings. Full settings:', nsData?.settings);
                }
            } catch(e) {
                console.error('[Hazard] Failed to fetch notification settings:', e);
            }

            if (targetEmail) {
                // Send hazard email
                try {
                    const emailRes = await fetch('/api/firebase-proxy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            functionName: 'sendEmail',
                            data: {
                                isHazard: true,
                                toEmail: targetEmail,
                                companyId: String(companyId),
                                companyName: companyInfo.name,
                                location: formData.lokacija,
                                description: formData.opis,
                                reporterName: formData.ime || 'Anonimno',
                                imageLink: proxyDbData?.payload?.slika?.url || null,
                                dashboardLink: window.location.origin + '/dashboard/observations' + (proxyDbData?.id ? `?id=${proxyDbData.id}&c=${companyId}` : `?c=${companyId}`)
                            }
                        })
                    });
                    const emailData = await emailRes.json();
                    const emailResult = emailData.result || emailData;
                    if (!emailResult.success) {
                        console.error('[Hazard] Email dispatch failed:', emailResult.error || emailData);
                    } else {
                        console.log('[Hazard] Email sent successfully to:', targetEmail);
                    }
                } catch(emailErr) {
                    console.error('[Hazard] Exception during email send:', emailErr);
                }
            } else {
                console.warn('[Hazard] No target email found — email not sent.');
            }

            setSuccess(true);
        } catch (err) {
            console.error(err);
            setErrorMsg(t('anErrorOccurredPleaseTry'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-page)', fontFamily: 'var(--font-body)', padding: 20 }}>
            {/* Header */}
            <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center', marginBottom: 24, marginTop: 24 }}>
                {companyInfo.logo && <img src={companyInfo.logo} style={{ height: 60, objectFit: 'contain', marginBottom: 16 }} alt="Logo" />}
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 8px 0' }}>
                    {t('hazardReport')}
                </h1>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
                    {t('fieldHazardObservationSystem')}
                </p>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', marginTop: 8 }}>
                    {companyInfo.name}
                </div>
            </div>

            {/* Form */}
            <div style={{ maxWidth: 500, margin: '0 auto', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', padding: 24 }}>
                {success ? (
                    <div className="animate-fadeIn" style={{ textAlign: 'center', padding: '40px 0' }}>
                        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
                        <h2 style={{ color: 'var(--success)' }}>{t('sentSuccessfully')}</h2>
                        <p style={{ color: 'var(--text-muted)' }}>
                            {t('thankYouForCaringFor')}
                        </p>
                        <button className="btn btn-outline" style={{ marginTop: 24 }} onClick={() => window.location.reload()}>
                            {t('reportAnotherHazard')}
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="animate-fadeIn">
                        {errorMsg && (
                            <div style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', marginBottom: 20, fontSize: '0.85rem' }}>
                                ⚠️ {errorMsg}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600 }}>{t('shortDescription1')}</label>
                            <input 
                                className="form-input" 
                                placeholder={t('egCutWireNearWater')} 
                                value={formData.opis}
                                onChange={e => setFormData({...formData, opis: e.target.value})}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600 }}>{t('exactLocation1')}</label>
                            <input 
                                className="form-input" 
                                placeholder={t('egMachine84Unit2')} 
                                value={formData.lokacija}
                                onChange={e => setFormData({...formData, lokacija: e.target.value})}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600 }}>{t('yourNameOptional')}</label>
                            <input 
                                className="form-input" 
                                placeholder={t('egJohnForContactPurposes')} 
                                value={formData.ime}
                                onChange={e => setFormData({...formData, ime: e.target.value})}
                            />
                        </div>

                        <div className="form-group" style={{ display: orgUnits.length > 0 ? 'block' : 'none' }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>{t('departmentOptional1')}</label>
                                <select 
                                    className="form-select" 
                                    value={formData.orgJedinicaId}
                                    onChange={e => setFormData({...formData, orgJedinicaId: e.target.value})}
                                >
                                    <option value="">-</option>
                                    {orgUnits.map(ou => <option key={ou.id} value={ou.id}>{ou.naziv}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600 }}>{t('photoOptional1')}</label>
                            <div 
                                style={{ 
                                    border: '2px dashed var(--primary)', 
                                    borderRadius: 'var(--radius-md)', 
                                    padding: '24px 20px', 
                                    textAlign: 'center',
                                    background: 'rgba(0,191,166,0.03)',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}>
                                {imagePreview ? (
                                    <img src={imagePreview} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} alt="Preview" />
                                ) : (
                                    <div>
                                        <div style={{ fontSize: 32, marginBottom: 12 }}>📷</div>
                                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                                            <button 
                                                type="button" 
                                                className="btn btn-primary btn-sm" 
                                                onClick={() => fileInputCameraRef.current?.click()} 
                                                style={{ flex: 1, padding: '8px 4px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                {t('takePhoto')}
                                            </button>
                                            <button 
                                                type="button" 
                                                className="btn btn-outline btn-sm" 
                                                onClick={() => fileInputGalleryRef.current?.click()} 
                                                style={{ flex: 1, padding: '8px 4px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                {t('fromGallery')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {imagePreview && (
                                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8, color: 'var(--danger)', margin: '8px auto', display: 'block' }} onClick={() => { setImageFile(null); setImagePreview(null); }}>
                                    {t('removePhoto1')}
                                </button>
                            )}
                            <input 
                                type="file" 
                                accept="image/*"
                                capture="environment" 
                                ref={fileInputCameraRef} 
                                style={{ display: 'none' }} 
                                onChange={handleFileSelect}
                            />
                            <input 
                                type="file" 
                                accept="image/*" 
                                ref={fileInputGalleryRef} 
                                style={{ display: 'none' }} 
                                onChange={handleFileSelect}
                            />
                        </div>

                        <button 
                            type="submit" 
                            className="btn btn-primary" 
                            style={{ width: '100%', padding: '16px', fontSize: '1rem', marginTop: 12, background: 'var(--primary)', color: 'white', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            disabled={submitting}
                        >
                            {submitting ? (t('slanjeUTijeku')) : (t('submitReport'))}
                        </button>
                    </form>
                )}
            </div>
            <div style={{ textAlign: 'center', marginTop: 32, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                eZNR © {new Date().getFullYear()}
            </div>
        </div>
    );
}
