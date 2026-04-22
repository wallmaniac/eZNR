'use client';
import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { uploadSecureFile } from '@/lib/storageService';
import { getCompanyBranding } from '@/lib/brandingService';

import { useParams } from 'next/navigation';

export default function PublicObservationForm() {
    const params = useParams();
    const companyId = params?.companyId;
    const { lang } = useLanguage();
    
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    
    const [formData, setFormData] = useState({
        opis: '',
        lokacija: '',
        ime: '',
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const fileInputRef = useRef(null);
    
    // UI Branding (read-only, public)
    const [companyInfo, setCompanyInfo] = useState({ name: 'Kompanija', logo: '' });
    
    useEffect(() => {
        const fetchBrand = async () => {
            try {
                const b = await getCompanyBranding(companyId);
                if (b) setCompanyInfo({ name: b.skraceniNaziv || b.naziv || 'Kompanija', logo: b.logo });
            } catch(e) {}
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
            setErrorMsg(lang === 'bs' ? 'Možete odabrati samo slike.' : 'You can only select images.');
            return;
        }

        try {
            const compressed = await compressImage(file);
            setImageFile(compressed);
            
            // Create a preview object url
            const objUrl = URL.createObjectURL(compressed);
            setImagePreview(objUrl);
        } catch (err) {
            setErrorMsg(lang === 'bs' ? 'Greška pri obradi slike.' : 'Error processing image.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        if (!formData.opis.trim() || !formData.lokacija.trim()) {
            setErrorMsg(lang === 'bs' ? 'Popunite obavezna polja: Kratki opis i Tačna lokacija.' : 'Description and location are mandatory.');
            return;
        }

        setSubmitting(true);
        try {
            // 1. Upload File to Firebase Storage (Only if file is selected)
            let uploaded = null;
            if (imageFile) {
                uploaded = await uploadSecureFile(companyId, 'safety_observations', imageFile);
            }

            // 2. Save to Firestore via Firebase Proxy to bypass Client Security Rules
            try {
                const proxyDbRes = await fetch('/api/firebase-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        functionName: 'saveHazard',
                        data: {
                            companyId,
                            payload: {
                                opis: formData.opis,
                                lokacija: formData.lokacija,
                                ime: formData.ime || 'Anonimno',
                                ...(uploaded ? { slika: uploaded } : {}),
                                status: 'Novo',
                                datum: new Date().toISOString(),
                            }
                        }
                    })
                });
                const proxyDbData = await proxyDbRes.json();
                if (!proxyDbData.success) {
                    throw new Error(proxyDbData.error || 'Server rejected saveHazard');
                }
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
                    body: JSON.stringify({ functionName: 'getNotifSettings', data: { companyId } })
                });
                const nsData = await nsRes.json();
                if (nsData?.success && nsData.settings?.obsNotifEmail) {
                    targetEmail = nsData.settings.obsNotifEmail;
                }
            } catch(e) { }

            if (targetEmail) {
                // Send hazard email
                await fetch('/api/firebase-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        functionName: 'sendEmail',
                        data: {
                            isHazard: true,
                            toEmail: targetEmail,
                            companyName: companyInfo.name,
                            location: formData.lokacija,
                            description: formData.opis,
                            reporterName: formData.ime || 'Anonimno',
                            imageLink: uploaded ? uploaded.url : null,
                            dashboardLink: window.location.origin + '/dashboard/observations'
                        }
                    })
                });
            }

            setSuccess(true);
        } catch (err) {
            console.error(err);
            setErrorMsg(lang === 'bs' ? 'Desila se greška pri slanju. Pokušajte ponovo.' : 'An error occurred. Please try again.');
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
                    {lang === 'bs' ? 'Prijava Opasnosti' : 'Hazard Report'}
                </h1>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
                    {lang === 'bs' 
                        ? 'Sistem sigurnosnih opažanja na terenu.' 
                        : 'Field hazard observation system.'}
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
                        <h2 style={{ color: 'var(--success)' }}>{lang === 'bs' ? 'Uspješno poslano!' : 'Sent successfully!'}</h2>
                        <p style={{ color: 'var(--text-muted)' }}>
                            {lang === 'bs' ? 'Hvala što brinete o sigurnosti. Prijava je dojavljena administraciji.' : 'Thank you for caring for safety. The administration has been notified.'}
                        </p>
                        <button className="btn btn-outline" style={{ marginTop: 24 }} onClick={() => window.location.reload()}>
                            {lang === 'bs' ? 'Prijavi novu opasnost' : 'Report another hazard'}
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
                            <label className="form-label" style={{ fontWeight: 600 }}>{lang === 'bs' ? 'Kratki opis problema *' : 'Short description *'}</label>
                            <input 
                                className="form-input" 
                                placeholder={lang === 'bs' ? 'Npr. Odrezana žica blizu vode...' : 'E.g. Cut wire near water...'} 
                                value={formData.opis}
                                onChange={e => setFormData({...formData, opis: e.target.value})}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600 }}>{lang === 'bs' ? 'Tačna lokacija *' : 'Exact location *'}</label>
                            <input 
                                className="form-input" 
                                placeholder={lang === 'bs' ? 'Npr. Mašina br. 84, Pogon 2' : 'E.g. Machine 84, Unit 2'} 
                                value={formData.lokacija}
                                onChange={e => setFormData({...formData, lokacija: e.target.value})}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600 }}>{lang === 'bs' ? 'Vaše ime (opcionalno)' : 'Your name (optional)'}</label>
                            <input 
                                className="form-input" 
                                placeholder={lang === 'bs' ? 'Npr. Edin, da bi vas mogli kontaktirati' : 'E.g. John, for contact purposes'} 
                                value={formData.ime}
                                onChange={e => setFormData({...formData, ime: e.target.value})}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600 }}>{lang === 'bs' ? 'Fotografija (opcionalno)' : 'Photo (optional)'}</label>
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                style={{ 
                                    border: '2px dashed var(--primary)', 
                                    borderRadius: 'var(--radius-md)', 
                                    padding: '30px 20px', 
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    background: 'rgba(0,191,166,0.03)',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}>
                                {imagePreview ? (
                                    <img src={imagePreview} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} alt="Preview" />
                                ) : (
                                    <div>
                                        <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                                        <div style={{ color: 'var(--primary)', fontWeight: 600 }}>{lang === 'bs' ? 'Dodaj sliku sa kamere ili iz galerije' : 'Add photo from camera or gallery'}</div>
                                    </div>
                                )}
                            </div>
                            {imagePreview && (
                                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8, color: 'var(--danger)', margin: '8px auto', display: 'block' }} onClick={() => { setImageFile(null); setImagePreview(null); }}>
                                    {lang === 'bs' ? 'Ukloni sliku' : 'Remove photo'}
                                </button>
                            )}
                            <input 
                                type="file" 
                                accept="image/png, image/jpeg, image/jpg, image/webp"
                                 
                                ref={fileInputRef} 
                                style={{ display: 'none' }} 
                                onChange={handleFileSelect}
                            />
                        </div>

                        <button 
                            type="submit" 
                            className="btn btn-primary" 
                            style={{ width: '100%', padding: '16px', fontSize: '1rem', marginTop: 12, background: 'var(--primary)', color: 'white' }}
                            disabled={submitting}
                        >
                            {submitting ? (lang === 'bs' ? 'Slanje u toku...' : 'Sending...') : (lang === 'bs' ? 'Pošalji Prijavu' : 'Submit Report')}
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
