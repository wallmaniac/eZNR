'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import {
    getAll, create, remove, COLLECTIONS, getOrgUnitName, getWorkplaceName,
    getWorkerCertificates, getWorkerPPE, formatDate,
} from '@/lib/dataStore';

const EVENT_ROUTES = {
    cert: '/dashboard/worker-certificates',
    ppe: '/dashboard/worker-ppe',
    equip: '/dashboard/equipment',
    doc: '/dashboard/employer-docs',
};

export default function DashboardPage() {
    const { t, lang } = useLanguage();
    const router = useRouter();
    const [currentDate, setCurrentDate] = useState(new Date(2026, 1, 26));
    const [activeTab, setActiveTab] = useState('new');
    const [workers, setWorkers] = useState([]);
    const [certs, setCerts] = useState([]);
    const [ppeAssignments, setPpeAssignments] = useState([]);
    const [equipment, setEquipment] = useState([]);
    const [actionMenuId, setActionMenuId] = useState(null);
    const actionRef = useRef(null);
    const [showEventForm, setShowEventForm] = useState(false);
    const [eventFormDate, setEventFormDate] = useState('');
    const [eventFormData, setEventFormData] = useState({
        tip: 'cert', opis: '', count: 1,
        // cert fields
        workerId: '', certNaziv: '', certOznaka: '', certTip: '', certDatum: '', certVrijediDo: '', certSposobnost: 'Sposoban',
        // ppe fields
        ppeNaziv: '', ppeDatum: '', ppeKolicina: 1,
    });
    const [calEvents, setCalEvents] = useState([]);
    const [certTypes, setCertTypes] = useState([]);
    const [ppeTypes, setPpeTypes] = useState([]);
    const [deleteEventTarget, setDeleteEventTarget] = useState(null); // event to confirm-delete

    useEffect(() => {
        setWorkers(getAll(COLLECTIONS.WORKERS));
        setCerts(getAll(COLLECTIONS.CERTIFICATES));
        setPpeAssignments(getAll(COLLECTIONS.PPE_ASSIGNMENTS));
        setEquipment(getAll(COLLECTIONS.EQUIPMENT));
        setCalEvents(getAll(COLLECTIONS.CALENDAR_EVENTS));
        setCertTypes(getAll(COLLECTIONS.CERT_TYPES));
        setPpeTypes(getAll(COLLECTIONS.PPE_TYPES));
    }, []);

    useEffect(() => {
        const handleClick = (e) => { if (actionRef.current && !actionRef.current.contains(e.target)) setActionMenuId(null); };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const today = new Date();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const startPad = (firstDay === 0 ? 6 : firstDay - 1);

    const calendarEvents = calEvents;

    const getDayEvents = (day) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return calendarEvents.filter(e => e.datum === dateStr);
    };

    const stats = useMemo(() => {
        const activeWorkers = workers.filter(w => w.aktivan).length;
        const activeCerts = certs.length;
        const expiringSoon = certs.filter(c => {
            if (!c.vrijediDo) return false;
            const exp = new Date(c.vrijediDo);
            const diff = (exp - today) / (1000 * 60 * 60 * 24);
            return diff >= 0 && diff <= 30;
        }).length;
        const activeEquip = equipment.filter(e => e.status === 'active').length;
        const expiredCerts = certs.filter(c => c.vrijediDo && new Date(c.vrijediDo) < today).length;
        const expiredEquip = equipment.filter(e => e.status === 'expired' || (e.iduci && new Date(e.iduci) < today)).length;
        const totalExpired = expiredCerts + expiredEquip;
        return { activeWorkers, activeCerts, expiringSoon, activeEquip, totalExpired };
    }, [workers, certs, equipment]);

    // Show all active workers (not just recent hires - date might be too old)
    const activeWorkers = workers.filter(w => w.aktivan);
    const formerWorkers = workers.filter(w => !w.aktivan);
    const terminatedWorkers = formerWorkers;

    // Tab data logic
    const getTabData = () => {
        switch (activeTab) {
            case 'new': return activeWorkers;
            case 'terminations': return terminatedWorkers;
            case 'certs': return certs;
            case 'ppe': return ppeAssignments;
            default: return activeWorkers;
        }
    };

    const getTabTitle = () => {
        switch (activeTab) {
            case 'new': return lang === 'bs' ? 'Radnici zaposleni u posljednjih 30 dana' : 'Workers employed in last 30 days';
            case 'terminations': return lang === 'bs' ? 'Prestanci radnog odnosa' : 'Terminations';
            case 'certs': return lang === 'bs' ? 'Uvjerenja i osposobljavanja' : 'Certificates and training';
            case 'ppe': return lang === 'bs' ? 'Osobna zaštitna sredstva' : 'Personal protective equipment';
            default: return '';
        }
    };

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    const monthName = currentDate.toLocaleDateString(lang === 'bs' ? 'bs-BA' : 'en-US', { month: 'long', year: 'numeric' });
    const dayNames = lang === 'bs'
        ? ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned']
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const tabs = [
        { key: 'new', label: t('newEmployments'), count: activeWorkers.length },
        { key: 'terminations', label: t('terminations'), count: terminatedWorkers.length },
        { key: 'certs', label: t('certificatesAndTraining'), count: stats.activeCerts },
        { key: 'ppe', label: t('personalProtective'), count: ppeAssignments.length },
    ];

    const handleEventClick = (ev, e) => {
        e.stopPropagation();
        const path = EVENT_ROUTES[ev.tip] || '/dashboard';
        router.push(path);
    };

    const handleDeleteEvent = (ev, e) => {
        e.stopPropagation();
        setDeleteEventTarget(ev);
    };

    const confirmDeleteEvent = () => {
        if (!deleteEventTarget) return;
        remove(COLLECTIONS.CALENDAR_EVENTS, deleteEventTarget.id);
        setCalEvents(getAll(COLLECTIONS.CALENDAR_EVENTS));
        setDeleteEventTarget(null);
    };

    const handleStatClick = (path) => {
        router.push(path);
    };

    const handleWorkerAction = (action, worker) => {
        setActionMenuId(null);
        switch (action) {
            case 'open': router.push('/dashboard/workers'); break;
            case 'certs': router.push('/dashboard/worker-certificates'); break;
            case 'ppe': router.push('/dashboard/worker-ppe'); break;
            case 'print': window.print(); break;
            default: break;
        }
    };

    return (
        <div className="animate-fadeIn">
            {/* Stats Cards — now clickable */}
            <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(0, 1fr)', gap: 10, marginBottom: 24 }}>
                <StatCard icon="👥" label={t('workers')} value={stats.activeWorkers} color="var(--primary)" onClick={() => handleStatClick('/dashboard/workers')} />
                <StatCard icon="📜" label={t('certificatesAndTraining')} value={stats.activeCerts} color="var(--secondary)" onClick={() => handleStatClick('/dashboard/worker-certificates')} />
                <StatCard icon="⏰" label={lang === 'bs' ? 'Ističe uskoro' : 'Expiring soon'} value={stats.expiringSoon} color="#FF9800" onClick={() => handleStatClick('/dashboard/worker-certificates')} />
                <StatCard icon="⚙️" label={t('workEquipment')} value={stats.activeEquip} color="#607D8B" onClick={() => handleStatClick('/dashboard/equipment')} />
                {stats.totalExpired > 0 && (
                    <StatCard icon="🚨" label={lang === 'bs' ? 'Isteklo' : 'Expired'} value={stats.totalExpired} color="#D32F2F" onClick={() => handleStatClick('/dashboard/worker-certificates')} isAlert />
                )}
            </div>

            {/* Calendar */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-body">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <button className="btn btn-ghost btn-sm" onClick={prevMonth}>◀ {t('previous')}</button>
                        <h2 style={{ margin: 0, textTransform: 'capitalize' }}>📅 {monthName}</h2>
                        <button className="btn btn-ghost btn-sm" onClick={nextMonth}>{t('next')} ▶</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                        {dayNames.map(d => (
                            <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-table-header)', textTransform: 'uppercase' }}>{d}</div>
                        ))}
                        {Array.from({ length: startPad }).map((_, i) => (
                            <div key={`pad-${i}`} style={{ padding: 8, background: '#f8f9fa', minHeight: 80, minWidth: 0 }} />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const events = getDayEvents(day);
                            const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
                            return (
                                <div key={day} style={{
                                    padding: '6px 8px', minHeight: 80, minWidth: 0, background: isToday ? 'rgba(0,191,166,0.08)' : 'white',
                                    borderLeft: isToday ? '3px solid var(--primary)' : '1px solid #eee',
                                    borderBottom: '1px solid #eee', transition: 'background 0.2s', cursor: 'pointer',
                                }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,191,166,0.05)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = isToday ? 'rgba(0,191,166,0.08)' : 'white'}
                                    onClick={() => {
                                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                        setEventFormDate(dateStr);
                                        setEventFormData({
                                            tip: 'cert', opis: '', count: 1,
                                            workerId: '', certNaziv: '', certOznaka: '', certTip: '', certDatum: dateStr, certVrijediDo: '', certSposobnost: 'Sposoban',
                                            ppeNaziv: '', ppeDatum: dateStr, ppeKolicina: 1,
                                        });
                                        setShowEventForm(true);
                                    }}>
                                    <div style={{ fontWeight: isToday ? 800 : 600, fontSize: '0.85rem', color: isToday ? 'var(--primary)' : 'var(--text-dark)', marginBottom: 4 }}>{day}</div>
                                    {events.map((ev, idx) => (
                                        <div key={idx}
                                            style={{
                                                fontSize: '0.65rem', padding: '2px 4px', borderRadius: 3, marginBottom: 2,
                                                cursor: 'pointer', position: 'relative',
                                                display: 'flex', alignItems: 'center', gap: 2,
                                                background: ev.tip === 'cert' ? '#E3F2FD' : ev.tip === 'ppe' ? '#FFF3E0' : ev.tip === 'equip' ? '#E8F5E9' : '#F3E5F5',
                                                color: ev.tip === 'cert' ? '#1565C0' : ev.tip === 'ppe' ? '#E65100' : ev.tip === 'equip' ? '#2E7D32' : '#6A1B9A',
                                                transition: 'opacity 0.15s',
                                            }}
                                            title={ev.opis}>
                                            <span
                                                onClick={(e) => handleEventClick(ev, e)}
                                                style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}>
                                                {ev.tip === 'cert' ? `📜 ${ev.opis || `Uvjerenja (${ev.count})`}` : ev.tip === 'ppe' ? `🦺 ${ev.opis || `ZS (${ev.count})`}` : ev.tip === 'equip' ? `⚙️ ${ev.opis || `RO (${ev.count})`}` : ev.opis}
                                            </span>
                                            <button
                                                onClick={(e) => handleDeleteEvent(ev, e)}
                                                title={lang === 'bs' ? 'Obriši događaj' : 'Delete event'}
                                                style={{
                                                    background: 'none', border: 'none', cursor: 'pointer',
                                                    padding: '0 2px', lineHeight: 1, fontSize: '0.7rem',
                                                    color: 'inherit', opacity: 0.5, flexShrink: 0,
                                                    borderRadius: 2,
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(0,0,0,0.12)'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.background = 'none'; }}
                                            >✕</button>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 16, fontSize: '0.8rem' }}>
                        <Legend color="#1565C0" bg="#E3F2FD" label={lang === 'bs' ? 'Uvjerenja' : 'Certificates'} />
                        <Legend color="#E65100" bg="#FFF3E0" label="ZS" />
                        <Legend color="#2E7D32" bg="#E8F5E9" label={lang === 'bs' ? 'Dokumenti' : 'Documents'} />
                        <Legend color="#6A1B9A" bg="#F3E5F5" label={lang === 'bs' ? 'Predmeti' : 'Objects'} />
                    </div>
                </div>
            </div>

            {showEventForm && (
                <div className="modal-overlay" onClick={() => setShowEventForm(false)}>
                    <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>📅 {lang === 'bs' ? 'Novi događaj' : 'New Event'} — {formatDate(eventFormDate)}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowEventForm(false)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                            {/* Event type */}
                            <div className="form-group">
                                <label className="form-label">{lang === 'bs' ? 'Tip događaja' : 'Event type'}</label>
                                <select className="form-select" value={eventFormData.tip}
                                    onChange={e => setEventFormData(prev => ({ ...prev, tip: e.target.value }))}>
                                    <option value="cert">{lang === 'bs' ? '📜 Uvjerenja / Osposobljavanje' : '📜 Certificates / Training'}</option>
                                    <option value="ppe">{lang === 'bs' ? '🦺 Zaštitna oprema (OZO)' : '🦺 PPE'}</option>
                                    <option value="equip">{lang === 'bs' ? '⚙️ Radna oprema / Objekti' : '⚙️ Equipment'}</option>
                                    <option value="doc">{lang === 'bs' ? '📋 Dokumentacija' : '📋 Documentation'}</option>
                                    <option value="other">{lang === 'bs' ? 'Ostalo' : 'Other'}</option>
                                </select>
                            </div>

                            {/* Worker selector — shown for cert and ppe */}
                            {(eventFormData.tip === 'cert' || eventFormData.tip === 'ppe') && (
                                <div className="form-group">
                                    <label className="form-label">
                                        👤 {lang === 'bs' ? 'Radnik (opcionalno)' : 'Worker (optional)'}
                                    </label>
                                    <select className="form-select" value={eventFormData.workerId}
                                        onChange={e => setEventFormData(prev => ({ ...prev, workerId: e.target.value }))}>
                                        <option value="">{lang === 'bs' ? '— Bez radnika —' : '— No worker —'}</option>
                                        {workers.filter(w => w.aktivan).map(w => (
                                            <option key={w.id} value={w.id}>{w.ime} {w.prezime}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* ── CERT fields ── */}
                            {eventFormData.tip === 'cert' && (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <div className="form-group">
                                            <label className="form-label">{lang === 'bs' ? 'Naziv uvjerenja *' : 'Certificate name *'}</label>
                                            <input className="form-input" value={eventFormData.certNaziv}
                                                onChange={e => setEventFormData(prev => ({ ...prev, certNaziv: e.target.value }))}
                                                placeholder={lang === 'bs' ? 'npr. Osposobljavanje ZNR' : 'e.g. OHS Training'} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{lang === 'bs' ? 'Tip uvjerenja' : 'Certificate type'}</label>
                                            <select className="form-select" value={eventFormData.certTip}
                                                onChange={e => {
                                                    const ct = certTypes.find(c => c.naziv === e.target.value);
                                                    const vrijediDo = ct && eventFormData.certDatum
                                                        ? (() => { const d = new Date(eventFormData.certDatum); d.setMonth(d.getMonth() + ct.trajanjeMjeseci); return d.toISOString().split('T')[0]; })()
                                                        : eventFormData.certVrijediDo;
                                                    setEventFormData(prev => ({ ...prev, certTip: e.target.value, certOznaka: ct?.oznaka || prev.certOznaka, certVrijediDo: vrijediDo }));
                                                }}>
                                                <option value="">{lang === 'bs' ? '— Odaberi —' : '— Select —'}</option>
                                                {certTypes.map(ct => <option key={ct.id} value={ct.naziv}>{ct.naziv}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                        <div className="form-group">
                                            <label className="form-label">{lang === 'bs' ? 'Oznaka' : 'Code'}</label>
                                            <input className="form-input" value={eventFormData.certOznaka}
                                                onChange={e => setEventFormData(prev => ({ ...prev, certOznaka: e.target.value }))}
                                                placeholder="ZNR-001" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{lang === 'bs' ? 'Datum izdavanja' : 'Issue date'}</label>
                                            <input className="form-input" type="date" value={eventFormData.certDatum}
                                                onChange={e => setEventFormData(prev => ({ ...prev, certDatum: e.target.value }))} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{lang === 'bs' ? 'Vrijedi do' : 'Valid until'}</label>
                                            <input className="form-input" type="date" value={eventFormData.certVrijediDo}
                                                onChange={e => setEventFormData(prev => ({ ...prev, certVrijediDo: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Sposobnost' : 'Fitness'}</label>
                                        <select className="form-select" value={eventFormData.certSposobnost}
                                            onChange={e => setEventFormData(prev => ({ ...prev, certSposobnost: e.target.value }))}>
                                            <option value="Sposoban">{lang === 'bs' ? 'Sposoban' : 'Fit'}</option>
                                            <option value="Nesposoban">{lang === 'bs' ? 'Nesposoban' : 'Unfit'}</option>
                                            <option value="Uvjetno sposoban">{lang === 'bs' ? 'Uvjetno sposoban' : 'Conditionally fit'}</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            {/* ── PPE fields ── */}
                            {eventFormData.tip === 'ppe' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 12 }}>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Naziv OZO *' : 'PPE name *'}</label>
                                        <select className="form-select" value={eventFormData.ppeNaziv}
                                            onChange={e => setEventFormData(prev => ({ ...prev, ppeNaziv: e.target.value }))}>
                                            <option value="">{lang === 'bs' ? '— Odaberi —' : '— Select —'}</option>
                                            {ppeTypes.map(pt => <option key={pt.id} value={pt.naziv}>{pt.naziv}</option>)}
                                            <option value="__custom">{lang === 'bs' ? 'Unesi ručno...' : 'Enter manually...'}</option>
                                        </select>
                                        {eventFormData.ppeNaziv === '__custom' && (
                                            <input className="form-input" style={{ marginTop: 6 }}
                                                placeholder={lang === 'bs' ? 'Naziv OZO...' : 'PPE name...'}
                                                onChange={e => setEventFormData(prev => ({ ...prev, ppeNaziv: e.target.value }))} />
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Datum zaduženja' : 'Assignment date'}</label>
                                        <input className="form-input" type="date" value={eventFormData.ppeDatum}
                                            onChange={e => setEventFormData(prev => ({ ...prev, ppeDatum: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Kol.' : 'Qty'}</label>
                                        <input className="form-input" type="number" min="1" value={eventFormData.ppeKolicina}
                                            onChange={e => setEventFormData(prev => ({ ...prev, ppeKolicina: parseInt(e.target.value) || 1 }))} />
                                    </div>
                                </div>
                            )}

                            {/* Description + count for non-cert/ppe */}
                            <div className="form-group">
                                <label className="form-label">
                                    {lang === 'bs' ? 'Opis događaja' : 'Event description'}
                                    {(eventFormData.tip !== 'cert' && eventFormData.tip !== 'ppe') ? ' *' : ` (${lang === 'bs' ? 'opcionalno' : 'optional'})`}
                                </label>
                                <input className="form-input" value={eventFormData.opis}
                                    onChange={e => setEventFormData(prev => ({ ...prev, opis: e.target.value }))}
                                    placeholder={lang === 'bs' ? 'Opis događaja...' : 'Event description...'} />
                            </div>

                            {eventFormData.tip !== 'cert' && eventFormData.tip !== 'ppe' && (
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Broj radnika' : 'Number of workers'}</label>
                                    <input className="form-input" type="number" min="1" value={eventFormData.count}
                                        onChange={e => setEventFormData(prev => ({ ...prev, count: parseInt(e.target.value) || 1 }))} />
                                </div>
                            )}

                            {/* Info banner when worker linked */}
                            {eventFormData.workerId && (eventFormData.tip === 'cert' || eventFormData.tip === 'ppe') && (
                                <div style={{ background: 'rgba(0,191,166,0.1)', border: '1px solid rgba(0,191,166,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem', color: '#009985' }}>
                                    ✅ {lang === 'bs'
                                        ? `Zapis će biti dodan i u ${eventFormData.tip === 'cert' ? 'Popis uvjerenja' : 'Zaštitnu opremu'} radnika.`
                                        : `Record will also be added to worker's ${eventFormData.tip === 'cert' ? 'certificates list' : 'PPE list'}.`}
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowEventForm(false)}>{t('cancel')}</button>
                            <button className="btn btn-primary" onClick={() => {
                                const { tip, opis, count, workerId,
                                    certNaziv, certOznaka, certTip, certDatum, certVrijediDo, certSposobnost,
                                    ppeNaziv, ppeDatum, ppeKolicina } = eventFormData;

                                // Validation
                                if (tip === 'cert' && !certNaziv.trim()) { alert(lang === 'bs' ? 'Naziv uvjerenja je obavezan!' : 'Certificate name is required!'); return; }
                                if (tip === 'ppe' && (!ppeNaziv || ppeNaziv === '__custom')) { alert(lang === 'bs' ? 'Naziv OZO je obavezan!' : 'PPE name is required!'); return; }
                                if (tip !== 'cert' && tip !== 'ppe' && !opis.trim()) { alert(lang === 'bs' ? 'Opis je obavezan!' : 'Description is required!'); return; }

                                // Auto-generate description
                                let autoOpis = opis;
                                if (tip === 'cert' && !opis) autoOpis = certNaziv + (workerId ? ` — ${workers.find(w => w.id === workerId)?.ime} ${workers.find(w => w.id === workerId)?.prezime}` : '');
                                if (tip === 'ppe' && !opis) autoOpis = ppeNaziv + (workerId ? ` — ${workers.find(w => w.id === workerId)?.ime} ${workers.find(w => w.id === workerId)?.prezime}` : '');

                                // 1. Always create calendar event
                                create(COLLECTIONS.CALENDAR_EVENTS, { datum: eventFormDate, tip, opis: autoOpis || opis, count: workerId ? 1 : count });

                                // 2. If cert type + worker selected → also create certificate record
                                if (tip === 'cert' && workerId) {
                                    create(COLLECTIONS.CERTIFICATES, {
                                        workerId,
                                        ime: certNaziv,
                                        naziv: certNaziv,
                                        oznaka: certOznaka,
                                        tipUvjerenja: certTip,
                                        datum: certDatum || eventFormDate,
                                        vrijediDo: certVrijediDo,
                                        sposobnost: certSposobnost,
                                        upisao: 'Kalendar',
                                        ogranicenje: '',
                                    });
                                    setCerts(getAll(COLLECTIONS.CERTIFICATES));
                                }

                                // 3. If ppe type + worker selected → also create PPE assignment
                                if (tip === 'ppe' && workerId) {
                                    create(COLLECTIONS.PPE_ASSIGNMENTS, {
                                        workerId,
                                        naziv: ppeNaziv,
                                        datumZaduzenja: ppeDatum || eventFormDate,
                                        datumRazduzenja: '',
                                        kolicina: ppeKolicina,
                                    });
                                    setPpeAssignments(getAll(COLLECTIONS.PPE_ASSIGNMENTS));
                                }

                                setCalEvents(getAll(COLLECTIONS.CALENDAR_EVENTS));
                                setShowEventForm(false);
                            }}>💾 {t('save')}</button>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Delete Event Confirmation Modal ── */}
            {deleteEventTarget && (
                <div className="modal-overlay" onClick={() => setDeleteEventTarget(null)}>
                    <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ background: 'linear-gradient(135deg, #C62828, #B71C1C)' }}>
                            <h2 style={{ color: 'white' }}>🗑️ {lang === 'bs' ? 'Obriši događaj' : 'Delete event'}</h2>
                            <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setDeleteEventTarget(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: 12, color: 'var(--text-dark)' }}>
                                {lang === 'bs' ? 'Sigurno želiš obrisati ovaj događaj s kalendara?' : 'Are you sure you want to delete this event from the calendar?'}
                            </p>
                            <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 14px', border: '1px solid #eee' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>
                                    {deleteEventTarget.tip === 'cert' ? '📜' : deleteEventTarget.tip === 'ppe' ? '🦺' : deleteEventTarget.tip === 'equip' ? '⚙️' : '📋'}{' '}
                                    {deleteEventTarget.opis || deleteEventTarget.tip}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    📅 {formatDate(deleteEventTarget.datum)}
                                </div>
                            </div>
                            <p style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                ⚠️ {lang === 'bs'
                                    ? 'Ovo briše samo unos s kalendara. Uvjerenja ili zaštitna oprema radnika ostaju nepromijenjeni.'
                                    : 'This only removes the calendar entry. Worker certificates or PPE records remain unchanged.'}
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setDeleteEventTarget(null)}>
                                {t('cancel')}
                            </button>
                            <button className="btn btn-danger" onClick={confirmDeleteEvent}
                                style={{ background: '#D32F2F', color: 'white', border: 'none' }}>
                                🗑️ {lang === 'bs' ? 'Obriši' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Tabs */}
            <div className="card">
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 0, borderBottom: '3px solid var(--primary)', marginBottom: 20, overflowX: 'auto' }}>
                        {tabs.map(tb => (
                            <button key={tb.key}
                                onClick={() => setActiveTab(tb.key)}
                                style={{
                                    padding: '12px 20px', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-heading)',
                                    fontWeight: activeTab === tb.key ? 700 : 500, fontSize: '0.85rem', whiteSpace: 'nowrap',
                                    background: activeTab === tb.key ? 'var(--primary)' : 'transparent',
                                    color: activeTab === tb.key ? 'white' : 'var(--text-dark)',
                                    borderRadius: activeTab === tb.key ? 'var(--radius-md) var(--radius-md) 0 0' : 0,
                                    transition: 'all 0.2s',
                                }}>
                                {tb.label}
                                {tb.count > 0 && <span style={{
                                    marginLeft: 8, padding: '2px 8px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 700,
                                    background: activeTab === tb.key ? 'rgba(255,255,255,0.3)' : 'var(--primary)',
                                    color: 'white',
                                }}>{tb.count}</span>}
                            </button>
                        ))}
                    </div>

                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        👤 {getTabTitle()}
                    </h3>

                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => router.push('/dashboard/workers')}>+ {t('add')}</button>
                        <div style={{ marginLeft: 'auto' }}>
                            <button className="btn btn-dark btn-sm" onClick={() => router.push('/dashboard/workers')}>{t('selectGroupAction')} ▼</button>
                        </div>
                    </div>

                    {/* Workers Table (for new/terminations tabs) */}
                    {(activeTab === 'new' || activeTab === 'terminations') && (
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 120 }}>{t('actions')}</th>
                                        <th>Red. br.</th>
                                        <th>{t('workerName')} ↑</th>
                                        <th>{t('workerSurname')} ↑</th>
                                        <th>JMBG</th>
                                        <th>{t('employmentDate')} ↑</th>
                                        <th>{t('orgUnit')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(activeTab === 'new' ? activeWorkers : terminatedWorkers).map((w, idx) => (
                                        <tr key={w.id}>
                                            <td style={{ position: 'relative' }} ref={actionMenuId === w.id ? actionRef : null}>
                                                <button className="btn btn-primary btn-sm"
                                                    onClick={() => setActionMenuId(actionMenuId === w.id ? null : w.id)}>
                                                    {t('actions')} ▼
                                                </button>
                                                {actionMenuId === w.id && (
                                                    <div className="dropdown-menu" style={{ top: 'calc(100% + 4px)', left: 0, zIndex: 50 }}>
                                                        <button className="dropdown-item" onClick={() => handleWorkerAction('open', w)}>📂 {t('open')}</button>
                                                        <button className="dropdown-item" onClick={() => handleWorkerAction('certs', w)}>📜 {t('certificatesAndTraining')}</button>
                                                        <button className="dropdown-item" onClick={() => handleWorkerAction('ppe', w)}>🦺 {t('personalProtective')}</button>
                                                        <div className="dropdown-divider" />
                                                        <button className="dropdown-item" onClick={() => handleWorkerAction('print', w)}>🖨️ {t('print')}</button>
                                                    </div>
                                                )}
                                            </td>
                                            <td>{idx + 1}</td>
                                            <td style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--primary)' }}
                                                onClick={() => router.push('/dashboard/workers')}>
                                                {w.ime}
                                            </td>
                                            <td style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--primary)' }}
                                                onClick={() => router.push('/dashboard/workers')}>
                                                {w.prezime}
                                            </td>
                                            <td><code style={{ fontSize: '0.85rem' }}>{w.jmbg}</code></td>
                                            <td>{formatDate(w.datumZaposlenja)}</td>
                                            <td>{getOrgUnitName(w.orgJedinicaId)}</td>
                                        </tr>
                                    ))}
                                    {(activeTab === 'new' ? activeWorkers : terminatedWorkers).length === 0 && (
                                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Certificates Table */}
                    {activeTab === 'certs' && (
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('actions')}</th>
                                        <th>{lang === 'bs' ? 'Radnik' : 'Worker'}</th>
                                        <th>{t('name')}</th>
                                        <th>{t('certCode')}</th>
                                        <th>{t('certDate')}</th>
                                        <th>{t('certValidUntil')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {certs.map((c, idx) => {
                                        const worker = workers.find(w => w.id === c.workerId);
                                        const isExpired = c.vrijediDo && new Date(c.vrijediDo) < new Date();
                                        return (
                                            <tr key={c.id || idx}>
                                                <td><button className="btn btn-primary btn-sm" onClick={() => router.push('/dashboard/worker-certificates')}>{t('actions')} ▼</button></td>
                                                <td style={{ fontWeight: 600 }}>{worker ? `${worker.ime} ${worker.prezime}` : '-'}</td>
                                                <td>{c.naziv}</td>
                                                <td><span className="badge badge-info">{c.oznaka}</span></td>
                                                <td>{formatDate(c.datum)}</td>
                                                <td style={{ color: isExpired ? 'var(--danger)' : undefined, fontWeight: isExpired ? 700 : undefined }}>
                                                    {formatDate(c.vrijediDo)} {isExpired && '⚠️'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {certs.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* PPE Table */}
                    {activeTab === 'ppe' && (
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('actions')}</th>
                                        <th>{lang === 'bs' ? 'Radnik' : 'Worker'}</th>
                                        <th>{t('name')}</th>
                                        <th>{lang === 'bs' ? 'Datum zaduženja' : 'Assignment date'}</th>
                                        <th>{lang === 'bs' ? 'Količina' : 'Quantity'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ppeAssignments.map((p, idx) => {
                                        const worker = workers.find(w => w.id === p.workerId);
                                        return (
                                            <tr key={p.id || idx}>
                                                <td><button className="btn btn-primary btn-sm" onClick={() => router.push('/dashboard/worker-ppe')}>{t('actions')} ▼</button></td>
                                                <td style={{ fontWeight: 600 }}>{worker ? `${worker.ime} ${worker.prezime}` : '-'}</td>
                                                <td>{p.naziv}</td>
                                                <td>{formatDate(p.datumZaduzenja)}</td>
                                                <td>{p.kolicina}</td>
                                            </tr>
                                        );
                                    })}
                                    {ppeAssignments.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, color, onClick, isAlert }) {
    return (
        <div className="card" style={{ borderLeft: `4px solid ${color}`, cursor: 'pointer', background: isAlert ? 'linear-gradient(135deg, #FFEBEE, #FFCDD2)' : undefined }} onClick={onClick}>
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 10px' }}>
                <span style={{ fontSize: '1.5rem', flexShrink: 0, animation: isAlert ? 'pulse 1.5s infinite' : undefined }}>{icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color }}>{value}</div>
                    <div style={{ fontSize: '0.75rem', lineHeight: 1.2, color: isAlert ? '#D32F2F' : 'var(--text-muted)', fontWeight: isAlert ? 700 : undefined, wordBreak: 'break-word', hyphens: 'auto' }}>{label}</div>
                </div>
                {isAlert && <span style={{ marginLeft: 'auto', fontSize: '1.2rem', flexShrink: 0 }}>⚠️</span>}
            </div>
        </div>
    );
}

function Legend({ color, bg, label }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: bg, border: `2px solid ${color}` }} />
            <span>{label}</span>
        </div>
    );
}
