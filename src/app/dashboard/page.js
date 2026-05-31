'use client';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import {
    getAll, create, update, remove, removeWorkerCascade, COLLECTIONS, getAllForCompany, getRawAll, formatDate, getOrgUnitName, createForCompany,
    isDataReady,
} from '@/lib/dataStore';
import { getNotificationSettings } from '@/lib/systemMonitor';
import { useAuth } from '@/contexts/AuthContext';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import { useDialog } from '@/hooks/useDialog';
import DateInput from '@/components/DateInput';
import PullToRefresh from '@/components/mobile/PullToRefresh';
import CollapsibleWidget from '@/components/mobile/CollapsibleWidget';
import LongPressMenu, { useLongPress } from '@/components/mobile/LongPressMenu';
import AnalyticsWidgets from '@/components/AnalyticsWidgets';
import EmptyDashboard from '@/components/EmptyDashboard';

const EVENT_ROUTES = {
    cert: '/dashboard/worker-certificates',
    ppe: '/dashboard/worker-ppe',
    equip: '/dashboard/equipment',
    doc: '/dashboard/employer-docs',
    service: '/dashboard/equipment',
    fleet_inspection: '/dashboard/fleet',
    fleet_registration: '/dashboard/fleet',
    fire_service: '/dashboard/fire-protection',
    hydrant_inspection: '/dashboard/fire-protection',
    evac_drill: '/dashboard/evacuation-drills',
    medical: '/dashboard/medical-exams',
    training: '/dashboard/trainings',
};
// ── Alerts Widget: collapsible per-category expander ─────────────────────────
function AlertsWidget({ groups, total, lang, isMobile }) {
    const [openKey, setOpenKey] = useState(null);
    const ref = useRef(null);

    useEffect(() => {
        if (!openKey) return;
        const handleOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpenKey(null);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [openKey]);

    const handlePillClick = (group) => {
        if (group.items.length === 1) {
            // Direct navigate for single items
            group.onItemClick(group.items[0]);
        } else {
            setOpenKey(prev => prev === group.key ? null : group.key);
        }
    };

    return (
        <div ref={ref} style={{ marginBottom: 20 }}>
            {/* Header bar */}
            <div className="card" style={{ border: '1px solid rgba(244,67,54,0.18)', background: 'rgba(244,67,54,0.015)' }}>
                <div style={{ padding: '12px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontWeight: 700, fontFamily: 'var(--font-heading)', fontSize: '0.9rem', color: 'var(--danger)', flexShrink: 0 }}>
                            🚨 {total} {t('stavkiZahtijevaPaznju')}
                        </span>
                    </div>
                    <div className="scrollable-toolbar" style={{ padding: 0, width: 'auto', flexWrap: 'wrap' }}>
                        {groups.map(g => {
                            const isOpen = openKey === g.key;
                            return (
                                <button
                                    key={g.key}
                                    onClick={() => handlePillClick(g)}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 5,
                                        padding: '5px 12px', borderRadius: 999,
                                        border: `1.5px solid ${g.border}`,
                                        background: isOpen ? g.bg : 'transparent',
                                        color: g.color, fontWeight: 700, fontSize: '0.78rem',
                                        cursor: 'pointer', transition: 'all 0.15s ease',
                                        fontFamily: 'var(--font-heading)',
                                    }}>
                                    {g.icon} {g.label}
                                    <span style={{
                                        background: g.color, color: '#fff', borderRadius: 999,
                                        padding: '1px 6px', fontSize: '0.72rem', fontWeight: 800, minWidth: 18, textAlign: 'center',
                                    }}>{g.items.length}</span>
                                    {g.items.length> 1 && (
                                        <span style={{ fontSize: '0.7rem', opacity: 0.7, marginLeft: 1 }}>
                                            {isOpen ? '▲' : '▼'}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Expanded dropdown */}
                {openKey && (() => {
                    const g = groups.find(x => x.key === openKey);
                    if (!g) return null;
                    return (
                        <div style={{
                            borderTop: `1px solid ${g.border}`,
                            background: g.bg,
                            padding: '10px 18px 14px',
                            animation: 'fadeIn 0.15s ease',
                        }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: g.color, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {g.icon} {g.label} — {t('odaberiteStavku')}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 6 }}>
                                {g.items.map((item, idx) => (
                                    <div
                                        key={item.id || idx}
                                        onClick={() => { g.onItemClick(item); setOpenKey(null); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '8px 12px', borderRadius: 8,
                                            background: 'var(--bg-card)', border: `1px solid ${g.border}`,
                                            cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text)',
                                            transition: 'all 0.12s ease',
                                            gap: 8,
                                        }}>
                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {g.itemLabel(item)}
                                        </span>
                                        <span style={{ fontSize: '0.72rem', color: g.color, fontWeight: 600, flexShrink: 0 }}>
                                            {g.itemSub(item)} →
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const { t, lang } = useLanguage();
    const router = useRouter();
    const { activeCompanyId, user, userCompanies } = useAuth();
    const { confirm, DialogRenderer } = useDialog();
    const [currentDate, setCurrentDate] = useState(() => new Date());
    const [activeTab, setActiveTab] = useState('new');
    const [forceWizard, setForceWizard] = useState(false);


    // ── Single atomic data state — prevents calendar flicker from 14 separate setStates ──
    const [ds, setDs] = useState({
        companyId: '',
        wizardCompleted: false,
        workers: [], certs: [], ppeAssignments: [], equipment: [],
        fleetVehicles: [], employerDocs: [], medicalExams: [],
        injuriesData: [], diseasesData: [], calEvents: [],
        certTypes: [], ppeTypes: [], riskAssessments: [], riskItems: [],
        fireExtinguishers: [], hydrants: [], evacuationPlans: [],
    });
    // Convenience destructure so the rest of the component reads exactly the same
    const { wizardCompleted, workers, certs, ppeAssignments, equipment, fleetVehicles, employerDocs,
            medicalExams, injuriesData, diseasesData, calEvents, certTypes, ppeTypes,
            riskAssessments, riskItems, fireExtinguishers, hydrants, evacuationPlans } = ds;

    const [actionMenuId, setActionMenuId] = useState(null);
    const actionRef = useRef(null);
    const [showEventForm, setShowEventForm] = useState(false);
    const [eventFormError, setEventFormError] = useState('');
    const [eventFormDate, setEventFormDate] = useState('');
    const [eventFormData, setEventFormData] = useState({
        tip: 'cert', opis: '', count: 1, companyId: '',
        // cert fields
        workerId: '', certNaziv: '', certOznaka: '', certTip: '', certDatum: '', certVrijediDo: '', certSposobnost: 'Sposoban',
        // ppe fields
        ppeNaziv: '', ppeDatum: '', ppeKolicina: 1,
        // service fields
        machineId: '',
        // fleet fields
        vehicleId: '',
        // fire protection fields
        extinguisherId: '', hydrantId: '',
        // evacuation fields
        evacPlanId: '', drillDuration: '',
        // training fields
        trainingName: '',
    });
    const [deleteEventTarget, setDeleteEventTarget] = useState(null); // event to confirm-delete
    const [viewWorkerId, setViewWorkerId] = useState(null);
    const [dayDetailDate, setDayDetailDate] = useState(null);
    const [dayDetailEvents, setDayDetailEvents] = useState([]);
    const [notifSettings, setNotifSettings] = useState({});
    const [workerSearch, setWorkerSearch] = useState('');
    const [workerDropOpen, setWorkerDropOpen] = useState(false);
    const workerDropRef = useRef(null);
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
    const monthPickerRef = useRef(null);

    // ── Single atomic data loader — ONE setState per sync, not 14 ──
    const syncTimerRef = useRef(null);
    useEffect(() => {
        const uids = user?.companyIds || [];
        const gatherData = () => ({
            companyId: activeCompanyId,
            wizardCompleted: typeof window !== 'undefined' ? localStorage.getItem(`eznr_wizard_completed_${activeCompanyId}`) === 'true' : false,
            workers: getAllForCompany(COLLECTIONS.WORKERS, activeCompanyId, uids),
            certs: getAllForCompany(COLLECTIONS.CERTIFICATES, activeCompanyId, uids),
            ppeAssignments: getAllForCompany(COLLECTIONS.PPE_ASSIGNMENTS, activeCompanyId, uids),
            equipment: getAllForCompany(COLLECTIONS.EQUIPMENT, activeCompanyId, uids),
            fleetVehicles: getAllForCompany(COLLECTIONS.VEHICLES, activeCompanyId, uids),
            employerDocs: getAllForCompany(COLLECTIONS.EMPLOYER_DOCS, activeCompanyId, uids),
            calEvents: getAllForCompany(COLLECTIONS.CALENDAR_EVENTS, activeCompanyId, uids),
            medicalExams: getAllForCompany(COLLECTIONS.MEDICAL_EXAMS, activeCompanyId, uids),
            certTypes: getAll(COLLECTIONS.CERT_TYPES),
            ppeTypes: getAll(COLLECTIONS.PPE_TYPES),
            riskAssessments: getAllForCompany(COLLECTIONS.RISK_ASSESSMENTS, activeCompanyId, uids),
            riskItems: getAll(COLLECTIONS.RISK_ITEMS),
            injuriesData: getAllForCompany(COLLECTIONS.INJURIES, activeCompanyId, uids),
            diseasesData: getAllForCompany(COLLECTIONS.DISEASES, activeCompanyId, uids),
            fireExtinguishers: getAllForCompany(COLLECTIONS.FIRE_EXTINGUISHERS, activeCompanyId, uids),
            hydrants: getAllForCompany(COLLECTIONS.HYDRANTS, activeCompanyId, uids),
            evacuationPlans: getAllForCompany(COLLECTIONS.EVACUATION_PLANS, activeCompanyId, uids),
        });

        // Initial load — immediate, single state write
        setDs(gatherData());

        // Debounced handler for data-synced events (500ms collapse window)
        const debouncedUpdate = () => {
            if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
            syncTimerRef.current = setTimeout(() => {
                const newData = gatherData();
                setDs(prev => {
                    if (JSON.stringify(prev) === JSON.stringify(newData)) return prev;
                    return newData;
                });
            }, 500);
        };

        window.addEventListener('eznr:data-synced', debouncedUpdate);
        return () => {
            window.removeEventListener('eznr:data-synced', debouncedUpdate);
            if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        };
    }, [activeCompanyId, user?.companyIds]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('wizard') === 'true') {
                setForceWizard(true);
                const newUrl = window.location.pathname;
                window.history.replaceState({}, '', newUrl);
            }
        }
    }, []);

    // Stabilize notifSettings — only update state when actual values change
    const notifSettingsRef = useRef(null);
    useEffect(() => {
        const handleClick = (e) => {
            if (actionRef.current && !actionRef.current.contains(e.target)) setActionMenuId(null);
            if (workerDropRef.current && !workerDropRef.current.contains(e.target)) setWorkerDropOpen(false);
            if (monthPickerRef.current && !monthPickerRef.current.contains(e.target)) setShowMonthPicker(false);
        };
        document.addEventListener('mousedown', handleClick);
        const fresh = getNotificationSettings() || {};
        const freshJson = JSON.stringify(fresh);
        if (notifSettingsRef.current !== freshJson) {
            notifSettingsRef.current = freshJson;
            setNotifSettings(fresh);
        }
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    // Stable reference — only changes once per day, not per render
    const today = useMemo(() => new Date(), []);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const startPad = (firstDay === 0 ? 6 : firstDay - 1);

    // Build auto-events from all data with expiry dates
    const autoEvents = useMemo(() => {
        const events = [];
        // Certificates — vrijediDo
        if (notifSettings.calShowCerts !== false) {
            certs.forEach(c => {
                if (!c.vrijediDo) return;
                const w = workers.find(wk => wk.id === c.workerId);
                const wName = w ? `${w.ime} ${w.prezime}` : '';
                events.push({
                    id: `auto-cert-${c.id}`,
                    datum: (c.vrijediDo || '').split('T')[0],
                    tip: 'cert',
                    opis: `${c.ime || c.oznaka || 'Uvjerenje'}${wName ? ` — ${wName}` : ''}`,
                    auto: true,
                    sourceId: c.id,
                    companyId: c.companyId,
                });
            });
        }
        // Equipment — iduci (next inspection)
        if (notifSettings.calShowEquip !== false) {
            equipment.forEach(eq => {
                if (!eq.iduci) return;
                events.push({
                    id: `auto-equip-${eq.id}`,
                    datum: (eq.iduci || '').split('T')[0],
                    tip: 'equip',
                    opis: `${eq.naziv || eq.invBroj || 'Oprema'}`,
                    auto: true,
                    sourceId: eq.id,
                    companyId: eq.companyId,
                });
            });
        }
        // Fleet — registracijaIstice, tehnickiIstice, osiguranjeIstice
        if (notifSettings.calShowFleet !== false) {
            fleetVehicles.forEach(v => {
                if (v.registracijaIstice) events.push({
                    id: `auto-fleet-reg-${v.id}`, datum: (v.registracijaIstice || '').split('T')[0],
                    tip: 'fleet', opis: `Registracija: ${v.registracija}`, auto: true, sourceId: v.id, companyId: v.companyId,
                });
                if (v.tehnickiIstice) events.push({
                    id: `auto-fleet-teh-${v.id}`, datum: (v.tehnickiIstice || '').split('T')[0],
                    tip: 'fleet', opis: `Tehnički pregl: ${v.registracija}`, auto: true, sourceId: v.id, companyId: v.companyId,
                });
                if (v.osiguranjeIstice) events.push({
                    id: `auto-fleet-osig-${v.id}`, datum: (v.osiguranjeIstice || '').split('T')[0],
                    tip: 'fleet', opis: `Osiguranje: ${v.registracija}`, auto: true, sourceId: v.id, companyId: v.companyId,
                });
            });
        }
        // Employer docs — datumIsteka
        if (notifSettings.calShowDoc !== false) {
            employerDocs.forEach(d => {
                if (!d.datumIsteka) return;
                events.push({
                    id: `auto-doc-${d.id}`,
                    datum: (d.datumIsteka || '').split('T')[0],
                    tip: 'doc',
                    opis: `${d.naziv || 'Dokument'}`,
                    auto: true,
                    sourceId: d.id,
                    companyId: d.companyId,
                });
            });
        }
        // Risk Assessment Measures — rokProvedbe
        if (notifSettings.calShowRisk !== false) {
            riskAssessments.forEach(ra => {
                if (ra.status !== 'aktivan') return;
                const items = riskItems.filter(ri => ri.procjenaId === ra.id && ri.rokProvedbe && ri.predlozeneMjere);
                items.forEach(ri => {
                    events.push({
                        id: `auto-risk-${ri.id}`,
                        datum: (ri.rokProvedbe || '').split('T')[0],
                        tip: 'risk',
                        opis: `Mjera: ${ri.predlozeneMjere.substring(0, 30)}${ri.predlozeneMjere.length> 30 ? '...' : ''} (${ra.nazivTvrtke || 'Procjena'})`,
                        auto: true,
                        sourceId: ri.id,
                        companyId: ra.companyId,
                    });
                });
            });
        }
        return events;
    }, [certs, equipment, fleetVehicles, employerDocs, workers, riskAssessments, riskItems, notifSettings]);

    const companies = userCompanies || [];
    const getCompName = (id) => companies.find(c => c.id === id)?.skraceniNaziv || companies.find(c => c.id === id)?.naziv || '';

    const allCalendarEvents = useMemo(() => {
        const userEvents = calEvents.filter(ev => {
            if (ev.tip === 'service' && notifSettings.calShowService === false) return false;
            if (ev.tip === 'med' && notifSettings.calShowMed === false) return false;
            return true;
        });
        const merged = [...userEvents, ...autoEvents].map(e => ({ ...e, datum: (e.datum || '').split('T')[0] }));
        return merged.map(ev => ({ ...ev, companyName: getCompName(ev.companyId) }));
    }, [calEvents, autoEvents, companies, notifSettings]);

    // Pre-compute day→events Map for O(1) lookups — eliminates per-cell filtering
    const dayEventsMap = useMemo(() => {
        const map = new Map();
        const mm = String(month + 1).padStart(2, '0');
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${mm}-${String(d).padStart(2, '0')}`;
            const dayEvents = allCalendarEvents.filter(e => e.datum === dateStr);
            if (dayEvents.length > 0) map.set(d, dayEvents);
        }
        return map;
    }, [allCalendarEvents, year, month, daysInMonth]);

    const getDayEvents = useCallback((day) => {
        return dayEventsMap.get(day) || [];
    }, [dayEventsMap]);

    const stats = useMemo(() => {
        const activeWorkers = workers.filter(w => w.aktivan !== false).length;
        const activeCerts = certs.length;
        const expiringSoon = certs.filter(c => {
            if (!c.vrijediDo) return false;
            const exp = new Date(c.vrijediDo);
            const diff = (exp - today) / (1000 * 60 * 60 * 24);
            return diff>= 0 && diff <= 60;
        }).length;
        const activeEquip = equipment.filter(e => e.status === 'active').length;
        const expiredCerts = certs.filter(c => c.vrijediDo && new Date(c.vrijediDo) < today).length;
        const expiredEquip = equipment.filter(e => e.status === 'expired' || (e.iduci && new Date(e.iduci) < today)).length;
        const expiredMed = medicalExams.filter(m => m.vrijediDo && new Date(m.vrijediDo) < today).length;
        const soonMed = medicalExams.filter(m => { if (!m.vrijediDo) return false; const dd = (new Date(m.vrijediDo) - today) / (86400000); return dd>= 0 && dd <= 60; }).length;
        const totalExpired = expiredCerts + expiredEquip + expiredMed;

        // Trend: items created in last 30 days
        const d30ago = new Date(today.getTime() - 30 * 86400000);
        const recentWorkers = workers.filter(w => w.createdAt && new Date(w.createdAt) >= d30ago).length;
        const recentCerts = certs.filter(c => c.createdAt && new Date(c.createdAt) >= d30ago).length;

        return { activeWorkers, activeCerts, expiringSoon: expiringSoon + soonMed, activeEquip, totalExpired, recentWorkers, recentCerts };
    }, [workers, certs, equipment, medicalExams]);

    const alertsGroups = useMemo(() => {
        const now = new Date();
        const d30 = 30 * 86400000;
        
        const workerMap = new Map();
        workers.forEach(w => workerMap.set(w.id, w));
        
        const activeAssessments = riskAssessments.filter(ra => ra.status === 'aktivan');
        const activeAssessmentIds = new Set(activeAssessments.map(ra => ra.id));
        const activeAssessmentMap = new Map();
        activeAssessments.forEach(ra => activeAssessmentMap.set(ra.id, ra));

        const expiredCertsRaw = [];
        const expiringCertsRaw = [];
        
        certs.forEach(c => {
            if (!c.vrijediDo) return;
            const w = workerMap.get(c.workerId);
            const enriched = { ...c, wName: w ? `${w.prezime} ${w.ime}` : '', wId: w?.id };
            const diff = new Date(c.vrijediDo) - now;
            if (diff < 0) {
                expiredCertsRaw.push(enriched);
            } else if (diff <= d30) {
                expiringCertsRaw.push(enriched);
            }
        });

        const overdueMedRaw = medicalExams.filter(m => m.vrijediDo && new Date(m.vrijediDo) < now).map(m => {
            const w = workerMap.get(m.workerId);
            return { ...m, wName: w ? `${w.prezime} ${w.ime}` : '', wId: w?.id };
        });
        
        const equipDueRaw = equipment.filter(e => e.iduci && new Date(e.iduci) < now);

        const riskMeasuresDueRaw = [];
        const riskMeasuresSoonRaw = [];
        
        riskItems.forEach(ri => {
            if (!ri.rokProvedbe || !ri.predlozeneMjere) return;
            if (!activeAssessmentIds.has(ri.procjenaId)) return;
            
            const ra = activeAssessmentMap.get(ri.procjenaId);
            const enriched = { ...ri, raName: ra?.nazivTvrtke || 'Procjena' };
            const diff = new Date(ri.rokProvedbe) - now;
            
            if (diff < 0) {
                riskMeasuresDueRaw.push(enriched);
            } else if (diff <= d30) {
                riskMeasuresSoonRaw.push(enriched);
            }
        });

        return [
            expiredCertsRaw.length > 0 && {
                key: 'expCert', icon: '📜', color: 'var(--danger)', bg: 'rgba(244,67,54,0.08)', border: 'rgba(244,67,54,0.18)',
                label: t('isteklaUvjerenja'),
                items: expiredCertsRaw,
                onItemClick: c => c.wId ? router.push('/dashboard/workers?openWorker=' + c.wId + '&section=uvjerenja') : router.push('/dashboard/worker-certificates'),
                itemLabel: c => <><strong>{c.wName || '?'}</strong> — {c.ime || c.oznaka}</>,
                itemSub: c => formatDate(c.vrijediDo),
            },
            expiringCertsRaw.length > 0 && {
                key: 'expirCert', icon: '⏰', color: 'var(--warning)', bg: 'rgba(255,152,0,0.08)', border: 'rgba(255,152,0,0.18)',
                label: t('isticeZa30Dana'),
                items: expiringCertsRaw,
                onItemClick: c => c.wId ? router.push('/dashboard/workers?openWorker=' + c.wId + '&section=uvjerenja') : router.push('/dashboard/worker-certificates'),
                itemLabel: c => <><strong>{c.wName || '?'}</strong> — {c.ime || c.oznaka}</>,
                itemSub: c => formatDate(c.vrijediDo),
            },
            overdueMedRaw.length > 0 && {
                key: 'med', icon: '🩺', color: 'var(--danger)', bg: 'rgba(244,67,54,0.08)', border: 'rgba(244,67,54,0.18)',
                label: t('prekoraceniMedPregledi'),
                items: overdueMedRaw,
                onItemClick: m => router.push('/dashboard/medical-exams'),
                itemLabel: m => <><strong>{m.wName || '?'}</strong>{m.tipPregleda ? ` — ${m.tipPregleda}` : ''}</>,
                itemSub: m => formatDate(m.vrijediDo),
            },
            equipDueRaw.length > 0 && {
                key: 'equip', icon: '⚙️', color: 'var(--warning)', bg: 'rgba(255,152,0,0.08)', border: 'rgba(255,152,0,0.18)',
                label: t('zakasnjeliPreglediOpreme'),
                items: equipDueRaw,
                onItemClick: e => router.push('/dashboard/equipment'),
                itemLabel: e => <>{e.naziv}</>,
                itemSub: e => formatDate(e.iduci),
            },
            riskMeasuresDueRaw.length > 0 && {
                key: 'riskDue', icon: '🛡️', color: 'var(--danger)', bg: 'rgba(244,67,54,0.08)', border: 'rgba(244,67,54,0.18)',
                label: t('istekliRokoviMjeraProcjena'),
                items: riskMeasuresDueRaw,
                onItemClick: r => router.push('/dashboard/risk-assessment'),
                itemLabel: r => <><strong>{r.raName}</strong> — {r.predlozeneMjere.substring(0, 40)}{r.predlozeneMjere.length > 40 ? '...' : ''}</>,
                itemSub: r => formatDate(r.rokProvedbe),
            },
            riskMeasuresSoonRaw.length > 0 && {
                key: 'riskSoon', icon: '🛡️', color: 'var(--warning)', bg: 'rgba(255,152,0,0.08)', border: 'rgba(255,152,0,0.18)',
                label: t('mjereIsticuZa30Dana'),
                items: riskMeasuresSoonRaw,
                onItemClick: r => router.push('/dashboard/risk-assessment'),
                itemLabel: r => <><strong>{r.raName}</strong> — {r.predlozeneMjere.substring(0, 40)}{r.predlozeneMjere.length > 40 ? '...' : ''}</>,
                itemSub: r => formatDate(r.rokProvedbe),
            },
        ].filter(Boolean);
    }, [certs, workers, medicalExams, equipment, riskAssessments, riskItems, lang, router]);

    // Show all active workers (not just recent hires - date might be too old)
    const activeWorkers = workers.filter(w => w.aktivan !== false);
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
            case 'new': return t('radniciZaposleniUPosljednjih30');
            case 'terminations': return t('prestanciRadnogOdnosa');
            case 'certs': return t('uvjerenjaIOsposobljavanja');
            case 'ppe': return t('osobnaZastitnaSredstva');
            default: return '';
        }
    };

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    const MONTH_LABELS_BS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
    const MONTH_LABELS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = `${(lang !== 'en' ? MONTH_LABELS_BS : MONTH_LABELS_EN)[month]} ${year}`;
    
    const dayNames = lang !== 'en'
        ? ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned']
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const tabs = [
        { key: 'new', label: t('newEmployments'), count: activeWorkers.length },
        { key: 'terminations', label: t('terminations'), count: terminatedWorkers.length },
        { key: 'certs', label: t('certificatesAndTraining'), count: stats.activeCerts },
        { key: 'ppe', label: t('personalProtective'), count: ppeAssignments.length },
    ];

    const handleEventClick = (ev, e) => {
        if (e && e.stopPropagation) e.stopPropagation();

        // ── Cert events → open worker page at Uvjerenja section ──
        if (ev.tip === 'cert') {
            if (ev.sourceId) {
                const certRecord = getRawAll(COLLECTIONS.CERTIFICATES).find(c => c.id === ev.sourceId);
                if (certRecord && certRecord.workerId) {
                    router.push('/dashboard/workers?openWorker=' + certRecord.workerId + '&section=uvjerenja&returnTo=/dashboard');
                    return;
                }
            }
            if (ev.workerId) {
                router.push('/dashboard/workers?openWorker=' + ev.workerId + '&section=uvjerenja&returnTo=/dashboard');
                return;
            }
            router.push('/dashboard/worker-certificates?sort=expiry');
            return;
        }

        // ── Fleet events → open fleet page ──
        if (ev.tip === 'fleet' || ev.tip === 'fleet_inspection' || ev.tip === 'fleet_registration') {
            if (ev.vehicleId) {
                router.push('/dashboard/fleet?openId=' + ev.vehicleId + '&returnTo=/dashboard');
                return;
            }
            if (ev.sourceId) {
                router.push('/dashboard/fleet?openId=' + ev.sourceId + '&returnTo=/dashboard');
                return;
            }
            router.push('/dashboard/fleet');
            return;
        }

        // ── Service events → open equipment page for the specific machine ──
        if (ev.tip === 'service') {
            if (ev.machineId) {
                router.push('/dashboard/equipment?openItem=' + ev.machineId + '&tab=servis&returnTo=/dashboard');
                return;
            }
            if (ev.sourceId) {
                router.push('/dashboard/equipment?openItem=' + ev.sourceId + '&tab=servis&returnTo=/dashboard');
                return;
            }
            router.push('/dashboard/equipment');
            return;
        }

        // ── Fire Protection events ──
        if (ev.tip === 'fire_service') {
            if (ev.sourceId) {
                router.push('/dashboard/fire-protection?openItem=' + ev.sourceId + '&tab=extinguishers');
                return;
            }
            if (ev.extinguisherId) {
                router.push('/dashboard/fire-protection?openItem=' + ev.extinguisherId + '&tab=extinguishers');
                return;
            }
            router.push('/dashboard/fire-protection');
            return;
        }
        if (ev.tip === 'hydrant_inspection') {
            if (ev.sourceId) {
                router.push('/dashboard/fire-protection?openItem=' + ev.sourceId + '&tab=hydrants');
                return;
            }
            if (ev.hydrantId) {
                router.push('/dashboard/fire-protection?openItem=' + ev.hydrantId + '&tab=hydrants');
                return;
            }
            router.push('/dashboard/fire-protection');
            return;
        }

        // ── Evacuation drill events ──
        if (ev.tip === 'evac_drill') {
            if (ev.sourceId) {
                router.push('/dashboard/evacuation-drills?openId=' + ev.sourceId + '&returnTo=/dashboard');
                return;
            }
            router.push('/dashboard/evacuation-drills');
            return;
        }

        // ── Medical & Training events ──
        if (ev.tip === 'medical') {
            if (ev.sourceId) {
                router.push('/dashboard/medical-exams?openId=' + ev.sourceId + '&returnTo=/dashboard');
                return;
            }
            if (ev.workerId) {
                router.push('/dashboard/workers?openWorker=' + ev.workerId + '&section=pregledi&returnTo=/dashboard');
                return;
            }
            router.push('/dashboard/medical-exams');
            return;
        }
        if (ev.tip === 'training') {
            if (ev.sourceId) {
                router.push('/dashboard/trainings?openId=' + ev.sourceId + '&returnTo=/dashboard');
                return;
            }
            router.push('/dashboard/trainings');
            return;
        }

        // ── Equipment inspection events → open specific equipment item ──
        if (ev.tip === 'equip') {
            if (ev.sourceId) {
                router.push('/dashboard/equipment?openItem=' + ev.sourceId + '&returnTo=/dashboard');
                return;
            }
            router.push('/dashboard/equipment');
            return;
        }

        // ── PPE events → open worker page at OZO section ──
        if (ev.tip === 'ppe') {
            // Try to find worker from manual event's workerId or auto-generated
            const evRecord = ev.auto ? null : getRawAll(COLLECTIONS.CALENDAR_EVENTS).find(c => c.id === ev.id);
            const wId = evRecord?.workerId || ev.workerId;
            if (wId) {
                router.push('/dashboard/workers?openWorker=' + wId + '&section=ozo');
                return;
            }
            router.push('/dashboard/worker-ppe');
            return;
        }

        // ── Doc events → open employer docs ──
        if (ev.tip === 'doc') {
            if (ev.sourceId) {
                router.push('/dashboard/employer-docs?highlight=' + ev.sourceId);
                return;
            }
            router.push('/dashboard/employer-docs');
            return;
        }

        // ── Risk measure events → open risk assessment ──
        if (ev.tip === 'risk') {
            router.push('/dashboard/risk-assessment');
            return;
        }

        if (ev.tip === 'med') { router.push('/dashboard/medical-exams?returnTo=/dashboard'); return; }
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
        setDeleteEventTarget(null);
        loadDashboardData();
    };

    const handleStatClick = (path) => {
        router.push(path);
    };

    const handleWorkerAction = (action, worker) => {
        setActionMenuId(null);
        switch (action) {
            case 'open': router.push(`/dashboard/workers?openWorker=${worker.id}`); break;
            case 'certs': router.push(`/dashboard/workers?openWorker=${worker.id}&section=uvjerenja`); break;
            case 'ppe': router.push(`/dashboard/workers?openWorker=${worker.id}&section=ozo`); break;
            case 'delete': handleDeleteWorker(worker); break;
            case 'print': window.print(); break;
            default: break;
        }
    };

    const handleDeleteWorker = async (worker) => {
        const ok = await confirm(lang !== 'en'
            ? `Obrisati radnika ${worker.ime} ${worker.prezime}? Svi povezani podaci (uvjerenja, OZO, događaji) će biti obrisani.`
            : `Delete worker ${worker.ime} ${worker.prezime}? All associated data (certs, PPE, events) will be deleted.`);
        if (ok) {
            removeWorkerCascade(worker.id);
            setWorkers(getAll(COLLECTIONS.WORKERS));
            setCerts(getAll(COLLECTIONS.CERTIFICATES));
            setPpeAssignments(getAll(COLLECTIONS.PPE_ASSIGNMENTS));
        }
    };

    // ── Mobile detection ──
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // ── Long-press menu state ──
    const [lpMenu, setLpMenu] = useState({ open: false, pos: null, worker: null });
    const longPressHandlers = useLongPress((pos) => {
        // Will be set per-row via data attribute
    }, 500);

    const handleWorkerLongPress = (worker, pos) => {
        setLpMenu({ open: true, pos, worker });
    };

    // ── Pull-to-refresh handler ──
    const reloadAllData = async () => {
        const uids = user?.companyIds || [];
        setWorkers(getAllForCompany(COLLECTIONS.WORKERS, activeCompanyId, uids));
        setCerts(getAllForCompany(COLLECTIONS.CERTIFICATES, activeCompanyId, uids));
        setPpeAssignments(getAllForCompany(COLLECTIONS.PPE_ASSIGNMENTS, activeCompanyId, uids));
        setEquipment(getAllForCompany(COLLECTIONS.EQUIPMENT, activeCompanyId, uids));
        setFleetVehicles(getAllForCompany(COLLECTIONS.VEHICLES, activeCompanyId, uids));
        setEmployerDocs(getAllForCompany(COLLECTIONS.EMPLOYER_DOCS, activeCompanyId, uids));
        setCalEvents(getAllForCompany(COLLECTIONS.CALENDAR_EVENTS, activeCompanyId, uids));
        setMedicalExams(getAllForCompany(COLLECTIONS.MEDICAL_EXAMS, activeCompanyId, uids));
        setInjuriesData(getAllForCompany(COLLECTIONS.INJURIES, activeCompanyId, uids));
        setDiseasesData(getAllForCompany(COLLECTIONS.DISEASES, activeCompanyId, uids));
        setNotifSettings(getNotificationSettings() || {});
        if (typeof window !== 'undefined' && window.eznrToast) {
            window.eznrToast(t('podaciOsvjezeni'), 'success', 2000);
        }
    };

    // ── Stale state check: prevent layout flash during company switching ──
    if (ds.companyId !== activeCompanyId || !isDataReady()) {
        return (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                {lang !== 'en' ? 'Učitavanje...' : 'Loading...'}
            </div>
        );
    }

    // ── Empty state: show onboarding wizard for brand-new companies ──
    if (((workers.length === 0 && certs.length === 0 && equipment.length === 0) && !wizardCompleted) || forceWizard) {
        return (
            <PullToRefresh onRefresh={reloadAllData}>
                <EmptyDashboard onComplete={() => {
                    setDs(prev => ({ ...prev, wizardCompleted: true }));
                    setForceWizard(false);
                }} />
            </PullToRefresh>
        );
    }

    const dashboardContent = (
        <div className="animate-fadeIn">

            {/* Long-press context menu (mobile only) */}
            <LongPressMenu
                isOpen={lpMenu.open}
                position={lpMenu.pos}
                onClose={() => setLpMenu({ open: false, pos: null, worker: null })}
                items={lpMenu.worker ? [
                    { icon: '👤', label: t('otvoriProfil'), onClick: () => handleWorkerAction('open', lpMenu.worker) },
                    { icon: '📜', label: t('uvjerenja'), onClick: () => handleWorkerAction('certs', lpMenu.worker) },
                    { icon: '🦺', label: t('ozoOprema'), onClick: () => handleWorkerAction('ppe', lpMenu.worker) },
                    { icon: '🏥', label: t('ljekarski'), onClick: () => router.push('/dashboard/medical-exams') },
                    { icon: '🗑️', label: t('obrisi'), onClick: () => handleWorkerAction('delete', lpMenu.worker), danger: true },
                ] : []}
            />

            {/* Stats Cards — now clickable */}
            <CollapsibleWidget id="stats" title={lang !== 'en' ? 'Pregled' : 'Overview'} icon="📊" isMobile={isMobile}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(${stats.totalExpired > 0 ? 5 : 4}, 1fr)`, gap: 10, marginBottom: 24 }}>
                    <StatCard icon="👥" label={t('workers')} value={stats.activeWorkers} color="var(--primary)" onClick={() => handleStatClick('/dashboard/workers')} trend={!isMobile ? stats.recentWorkers : undefined} />
                    <StatCard icon="📜" label={t('certificatesAndTraining')} value={stats.activeCerts} color="var(--secondary)" onClick={() => handleStatClick('/dashboard/worker-certificates')} trend={!isMobile ? stats.recentCerts : undefined} />
                    <StatCard icon="⏰" label={t('isticeUskoro')} value={stats.expiringSoon} color="#FF9800" onClick={() => handleStatClick('/dashboard/worker-certificates?sort=expiry')} total={stats.activeCerts} />
                    <StatCard icon="⚙️" label={t('workEquipment')} value={stats.activeEquip} color="#607D8B" onClick={() => handleStatClick('/dashboard/equipment')} />
                    {stats.totalExpired> 0 && (
                        <StatCard icon="🚨" label={t('isteklo')} value={stats.totalExpired} color="#D32F2F" onClick={() => handleStatClick('/dashboard/worker-certificates?sort=expiry')} isAlert total={stats.activeCerts + stats.activeEquip} />
                    )}
                </div>
            </CollapsibleWidget>

            {/* ── Actionable Alerts Widget ── */}
            <CollapsibleWidget id="alerts" title={t('upozorenja')} icon="🚨" isMobile={isMobile}>
                {(() => {
                    const total = alertsGroups.reduce((s, g) => s + g.items.length, 0);
                    if (total === 0) return null;
                    return <AlertsWidget groups={alertsGroups} total={total} lang={lang} isMobile={isMobile} />;
                })()}
            </CollapsibleWidget>

            {/* Analytics Charts */}
            <CollapsibleWidget id="analytics" title={t('analitika')} icon="📊" isMobile={isMobile} alwaysCollapsible={true} defaultCollapsed={true}>
                <AnalyticsWidgets
                    workers={workers}
                    certs={certs}
                    equipment={equipment}
                    injuries={injuriesData}
                    diseases={diseasesData}
                    riskItems={riskItems}
                    riskAssessments={riskAssessments}
                    medicalExams={medicalExams}
                    lang={lang}
                    companyName={companies.find(c => c.id === activeCompanyId)?.naziv || companies[0]?.naziv || ''}
                    companyLogo={companies.find(c => c.id === activeCompanyId)?.logo || companies[0]?.logo || ''}
                />
            </CollapsibleWidget>

            {/* Calendar */}
            <CollapsibleWidget id="calendar" title={t('kalendar')} icon="📅" isMobile={isMobile}>
                <div className="card" style={{ marginBottom: 24 }}>
                    <div className="card-body">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: 16 }}>
                            <div style={{ justifySelf: 'start' }}>
                                <button className="btn btn-sm" style={{ background: 'transparent', color: 'var(--text-muted)' }} onClick={prevMonth} title={t('prethodniMjesec')}>
                                    ◀ {!isMobile && (t('prethodni2'))}
                                </button>
                            </div>

                            {/* ── Custom Month/Year Picker ── */}
                            <div ref={monthPickerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                <h2
                                    onClick={() => { setPickerYear(year); setShowMonthPicker(p => !p); }}
                                    style={{
                                        margin: 0, textTransform: 'capitalize', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 6, whiteSpace: 'nowrap',
                                        padding: '4px 12px', borderRadius: 'var(--radius-md)',
                                        transition: 'background 0.15s',
                                        background: showMonthPicker ? 'rgba(0,191,166,0.1)' : 'transparent',
                                        userSelect: 'none',
                                    }}>
                                    📅 {monthName}
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 2 }}>{showMonthPicker ? '▲' : '▼'}</span>
                                </h2>

                                {showMonthPicker && (() => {
                                    const MONTH_LABELS = lang !== 'en'
                                        ? ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']
                                        : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                    const now = new Date();
                                    return (
                                        <div style={{
                                            position: 'absolute', top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
                                            zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none',
                                            background: 'var(--bg-card)',
                                            border: '1px solid var(--border)',
                                            borderRadius: 'var(--radius-lg)',
                                            boxShadow: '0 16px 48px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.12)',
                                            padding: '16px',
                                            minWidth: 260,
                                            maxHeight: '320px',
                                            overflowY: 'auto',
                                            WebkitOverflowScrolling: 'touch',
                                            overscrollBehavior: 'contain',
                                            backdropFilter: 'blur(12px)',
                                            animation: 'fadeIn 0.15s ease',
                                        }}>
                                            {/* Year navigator */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                                <button
                                                    onClick={() => setPickerYear(y => y - 1)}
                                                    style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', color: 'var(--text)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.12s' }}>‹</button>
                                                <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)', letterSpacing: '0.02em' }}>{pickerYear}</span>
                                                <button
                                                    onClick={() => setPickerYear(y => y + 1)}
                                                    style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', color: 'var(--text)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.12s' }}>›</button>
                                            </div>

                                            {/* Month grid */}
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 14 }}>
                                                {MONTH_LABELS.map((lbl, idx) => {
                                                    const isActive = pickerYear === year && idx === month;
                                                    const isToday = pickerYear === now.getFullYear() && idx === now.getMonth();
                                                    return (
                                                        <button
                                                            key={idx}
                                                            onClick={() => {
                                                                setCurrentDate(new Date(pickerYear, idx, 1));
                                                                setShowMonthPicker(false);
                                                            }}
                                                            style={{
                                                                padding: '7px 4px',
                                                                borderRadius: 8,
                                                                border: isToday && !isActive ? '1.5px solid var(--primary)' : '1.5px solid transparent',
                                                                background: isActive
                                                                    ? 'var(--primary)'
                                                                    : 'var(--bg-input)',
                                                                color: isActive ? '#fff' : isToday ? 'var(--primary)' : 'var(--text)',
                                                                fontWeight: isActive || isToday ? 700 : 500,
                                                                fontSize: '0.8rem',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.12s',
                                                                boxShadow: isActive ? '0 2px 8px rgba(0,191,166,0.35)' : 'none',
                                                            }}>{lbl}</button>
                                                    );
                                                })}
                                            </div>

                                            {/* Footer shortcuts */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: 10 }}>
                                                <button
                                                    onClick={() => { setCurrentDate(new Date(year, -1, 1)); setShowMonthPicker(false); }}
                                                    className="hover-text-danger"
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: 6, transition: 'color 0.12s' }}
                                                    >{t('ponisti')}</button>
                                                <button
                                                    onClick={() => { setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1)); setShowMonthPicker(false); }}
                                                    className="hover-opacity-075"
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700, padding: '2px 6px', borderRadius: 6, transition: 'opacity 0.12s' }}
                                                    >{t('ovajMjesec')}</button>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            <div style={{ justifySelf: 'end' }}>
                                <button className="btn btn-sm" style={{ background: 'transparent', color: 'var(--text-muted)' }} onClick={nextMonth} title={t('sljedeciMjesec')}>
                                    {!isMobile && (t('sljedeci'))}▶
                                </button>
                            </div>
                        </div>

                        <div className="cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '1px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--border)' }}>
                            {dayNames.map(d => (
                                <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-table-header)', textTransform: 'uppercase' }}>{d}</div>
                            ))}
                            {Array.from({ length: startPad }).map((_, i) => (
                                <div key={`pad-${i}`} className="cal-cell cal-cell-pad" style={{ padding: 8, minHeight: 80, minWidth: 0 }} />
                            ))}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1;
                                const events = getDayEvents(day);
                                const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
                                return (
                                    <div key={day}
                                        className={`cal-cell${isToday ? ' cal-today' : ''}`}
                                        style={{
                                            padding: '6px 8px', minHeight: 80, minWidth: 0,
                                            cursor: 'pointer',
                                            WebkitTapHighlightColor: 'transparent',
                                        }}
                                        onClick={() => {
                                            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                            if (events.length> 0) {
                                                setDayDetailDate(dateStr);
                                                setDayDetailEvents(events);
                                            } else {
                                                setEventFormDate(dateStr);
                                                setEventFormData({
                                                    tip: 'cert', opis: '', count: 1, companyId: activeCompanyId === 'all' ? (user?.companyIds?.[0] || '') : activeCompanyId,
                                                    workerId: '', certNaziv: '', certOznaka: '', certTip: '', certDatum: dateStr, certVrijediDo: '', certSposobnost: 'Sposoban',
                                                    ppeNaziv: '', ppeDatum: dateStr, ppeKolicina: 1, machineId: '',
                                                });
                                                setEventFormError(''); setShowEventForm(true);
                                            }
                                        }}>
                                        <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center' }}>
                                            {isToday ? (
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                    width: 24, height: 24, borderRadius: '50%',
                                                    background: 'var(--primary)',
                                                    color: 'white', fontWeight: 800, fontSize: '0.8rem',
                                                    boxShadow: '0 2px 6px rgba(0,191,166,0.45)',
                                                }}>{day}</span>
                                            ) : (
                                                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>{day}</span>
                                            )}
                                        </div>
                                        {events.map((ev, idx) => {
                                            const isExpired = ev.datum && new Date(ev.datum) < today;
                                            const diff = ev.datum ? (new Date(ev.datum) - today) / (1000 * 60 * 60 * 24) : 999;
                                            const isSoon = diff>= 0 && diff <= 30;
                                            const statusIcon = ev.auto ? (isExpired ? ' ⚠️' : isSoon ? ' ⏰' : '') : '';
                                            const bgColor = ev.auto && isExpired
                                                ? (ev.tip === 'cert' ? 'rgba(244,67,54,0.12)' : ev.tip === 'equip' ? '#FBE9E7' : ev.tip === 'fleet' ? '#FBE9E7' : 'rgba(244,67,54,0.12)')
                                                : (ev.tip === 'cert' ? 'rgba(33,150,243,0.12)' : ev.tip === 'ppe' ? 'rgba(255,152,0,0.12)' : ev.tip === 'equip' ? 'rgba(76,175,80,0.12)' : ev.tip === 'fleet' ? 'rgba(156,39,176,0.12)' : ev.tip === 'risk' ? 'rgba(156,39,176,0.12)' : '#F3E5F5');
                                            const fgColor = ev.auto && isExpired
                                                ? 'var(--danger)'
                                                : (ev.tip === 'cert' ? 'var(--info)' : ev.tip === 'ppe' ? 'var(--warning)' : ev.tip === 'equip' ? 'var(--success)' : ev.tip === 'fleet' ? '#9C27B0' : ev.tip === 'risk' ? '#9C27B0' : '#6A1B9A');
                                            return (
                                                <div key={ev.id || idx}
                                                    style={{
                                                        fontSize: '0.65rem', padding: '2px 4px', borderRadius: 3, marginBottom: 2,
                                                        cursor: 'pointer', position: 'relative',
                                                        display: 'flex', alignItems: 'center', gap: 2,
                                                        background: bgColor,
                                                        color: fgColor,
                                                        borderLeft: ev.auto ? `3px solid ${fgColor}` : 'none',
                                                        transition: 'opacity 0.15s',
                                                    }}
                                                    title={`${ev.opis}${statusIcon ? (isExpired ? ' (Isteklo)' : ' (Uskoro ističe)') : ''}`}>
                                                    <span
                                                        className="hover-underline"
                                                        onClick={(e) => handleEventClick(ev, e)}
                                                        style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                        >
                                                        {ev.tip === 'cert' ? '📜' : ev.tip === 'ppe' ? '🦺' : ev.tip === 'equip' ? '⚙️' : ev.tip === 'doc' ? '📄' : ev.tip === 'fleet' ? '🚗' : ev.tip === 'service' ? '🔧' : ev.tip === 'risk' ? '🛡️' : ''} {ev.opis || `(${ev.count})`}{statusIcon}
                                                        {ev.companyName && <span style={{ fontSize: '0.55rem', opacity: 0.7, marginLeft: 4, fontWeight: 700 }}>({ev.companyName})</span>}
                                                    </span>
                                                    {!ev.auto && (
                                                        <button
                                                            onClick={(e) => handleDeleteEvent(ev, e)}
                                                            title={t('obrisiDogaaj')}
                                                            style={{
                                                                background: 'none', border: 'none', cursor: 'pointer',
                                                                padding: '0 2px', lineHeight: 1, fontSize: '0.7rem',
                                                                color: 'inherit', opacity: 0.5, flexShrink: 0,
                                                                borderRadius: 2,
                                                            }}>✕</button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                            {Array.from({ length: (startPad + daysInMonth) % 7 === 0 ? 0 : 7 - ((startPad + daysInMonth) % 7) }).map((_, i) => (
                                <div key={`endpad-${i}`} className="cal-cell cal-cell-pad" style={{ padding: 8, minHeight: 80, minWidth: 0 }} />
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 16, fontSize: '0.8rem', flexWrap: 'wrap' }}>
                            <Legend color="var(--info)" bg="rgba(33,150,243,0.12)" label={t('uvjerenja1')} />
                            <Legend color="var(--success)" bg="rgba(76,175,80,0.12)" label={t('servis')} />
                            <Legend color="var(--warning)" bg="rgba(255,152,0,0.12)" label="🦺 ZS" />
                            <Legend color="var(--success)" bg="rgba(76,175,80,0.12)" label={t('oprema1')} />
                            <Legend color="#9C27B0" bg="rgba(156,39,176,0.12)" label={t('mjereRizika')} />
                            <Legend color="#6A1B9A" bg="#F3E5F5" label={t('dokumenti')} />
                            <Legend color="var(--danger)" bg="rgba(244,67,54,0.12)" label={t('isteklo1')} />
                            <Legend color="var(--warning)" bg="#FFF8E1" label={t('uskoro')} />
                        </div>
                    </div>
                </div>

                {/* ── Day Detail Popover ── */}
                {dayDetailDate && (
                    <div className="modal-overlay" onClick={() => setDayDetailDate(null)}>
                        <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #00695C, #00897B)' }}>
                                <h2 style={{ color: 'white' }}>📅 {new Date(dayDetailDate + 'T12:00:00').toLocaleDateString(t('bsba'), { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
                                <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setDayDetailDate(null)}>✕</button>
                            </div>
                            <div className="modal-body" style={{ maxHeight: 400, overflowY: 'auto' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase' }}>
                                    {dayDetailEvents.length} {t('dogaaja')}
                                </div>
                                {dayDetailEvents.map((ev, idx) => {
                                    const tipIconMap = { cert: '📜', ppe: '🦺', equip: '⚙️', doc: '📄', service: '🔧', risk: '🛡️', fleet_inspection: '🚗', fleet_registration: '📋', fire_service: '🧯', hydrant_inspection: '🚰', evac_drill: '🏃', medical: '🏥', training: '📚' };
                                    const tipLabelMap = { cert: t('uvjerenje'), ppe: 'OZO', equip: t('oprema'), doc: t('dokument'), service: 'Servis', risk: t('mjeraRizika'), fleet_inspection: t('tehnicki'), fleet_registration: t('registracija'), fire_service: t('ppServis'), hydrant_inspection: t('hidrant'), evac_drill: t('evakuacija'), medical: t('ljekarski'), training: t('obuka') };
                                    const tipIcon = tipIconMap[ev.tip] || '📌';
                                    const tipLabel = tipLabelMap[ev.tip] || (t('dogaaj'));
                                    const isExpired = ev.datum && new Date(ev.datum) < new Date();
                                    return (
                                        <div key={ev.id || idx} className="hover-translate-x" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, marginBottom: 6, background: isExpired ? 'rgba(198,40,40,0.06)' : 'rgba(0,191,166,0.04)', border: '1px solid ' + (isExpired ? 'rgba(198,40,40,0.15)' : 'var(--border-light)'), cursor: 'pointer', transition: 'all 0.15s' }}
                                            onClick={() => { setDayDetailDate(null); handleEventClick(ev, { stopPropagation: () => { } }); }}
                                            >
                                            <span style={{ fontSize: '1.3rem' }}>{tipIcon}</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>{ev.opis || tipLabel}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                                                    <span style={{ background: isExpired ? 'rgba(244,67,54,0.12)' : 'rgba(33,150,243,0.12)', color: isExpired ? 'var(--danger)' : 'var(--info)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>{isExpired ? (t('isteklo')) : tipLabel}</span>
                                                    {ev.auto && <span style={{ background: 'rgba(255,152,0,0.1)', color: 'var(--warning)', padding: '1px 6px', borderRadius: 4 }}>{t('auto')}</span>}
                                                    {ev.companyName && <span style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 6px', borderRadius: 4 }}>🏢 {ev.companyName}</span>}
                                                </div>
                                            </div>
                                            {!ev.auto && <button className="hover-opacity-1" onClick={e => { e.stopPropagation(); setDayDetailDate(null); handleDeleteEvent(ev, e); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--danger)', opacity: 0.5, padding: 4 }}>🗑️</button>}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="modal-footer" style={{ justifyContent: 'center' }}>
                                <button className="btn btn-primary" onClick={() => {
                                    setDayDetailDate(null);
                                    setEventFormDate(dayDetailDate);
                                    setEventFormData({
                                        tip: 'cert', opis: '', count: 1, companyId: activeCompanyId === 'all' ? (user?.companyIds?.[0] || '') : activeCompanyId,
                                        workerId: '', certNaziv: '', certOznaka: '', certTip: '', certDatum: dayDetailDate, certVrijediDo: '', certSposobnost: 'Sposoban',
                                        ppeNaziv: '', ppeDatum: dayDetailDate, ppeKolicina: 1, machineId: '',
                                        vehicleId: '', extinguisherId: '', hydrantId: '', evacPlanId: '', drillDuration: '', trainingName: '',
                                    });
                                    setEventFormError(''); setShowEventForm(true);
                                }}>➕ {t('noviDogaaj')}</button>
                            </div>
                        </div>
                    </div>
                )}

                {showEventForm && (
                    <div className="modal-overlay" onClick={() => setShowEventForm(false)}>
                        <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>📅 {lang !== 'en' ? 'Novi događaj' : 'New Event'} — {formatDate(eventFormDate)}</h2>
                                <button className="btn btn-ghost btn-icon" onClick={() => setShowEventForm(false)}>✕</button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                                {/* Validation error banner */}
                                {eventFormError && (
                                    <div style={{ background: 'rgba(244,67,54,0.08)', border: '1px solid rgba(244,67,54,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: '0.85rem', color: '#D32F2F', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        ⚠️ {eventFormError}
                                        <button onClick={() => setEventFormError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#D32F2F', fontSize: '1rem' }}>✕</button>
                                    </div>
                                )}

                                {/* Event type */}
                                <div className="form-group">
                                    <label className="form-label">{t('tipDogaaja')}</label>
                                    <select className="form-select" value={eventFormData.tip}
                                        onChange={e => setEventFormData(prev => ({ ...prev, tip: e.target.value }))}>
                                        <option value="cert">{t('uvjerenjaOsposobljavanje')}</option>
                                        <option value="service">{t('servisOdrzavanje')}</option>
                                        <option value="ppe">{t('zastitnaOpremaOzo')}</option>
                                        <option value="equip">{t('radnaOpremaObjekti')}</option>
                                        <option value="fleet_inspection">{t('tehnickiPregledVozila')}</option>
                                        <option value="fleet_registration">{t('registracijaVozila')}</option>
                                        <option value="fire_service">{t('servisPpAparata')}</option>
                                        <option value="hydrant_inspection">{t('pregledHidranta')}</option>
                                        <option value="evac_drill">{t('vjezbaEvakuacije')}</option>
                                        <option value="medical">{t('ljekarskiPregled')}</option>
                                        <option value="training">{t('obukaRadnika')}</option>
                                        <option value="doc">{t('dokumentacija')}</option>
                                        <option value="other">{t('ostalo')}</option>
                                    </select>
                                </div>

                                {/* Company selector */}
                                <div className="form-group">
                                    <label className="form-label">🏢 {t('firma')}</label>
                                    <select className="form-select" value={eventFormData.companyId}
                                        onChange={e => setEventFormData(prev => ({ ...prev, companyId: e.target.value, workerId: '' }))}>
                                        {companies.filter(c => (user?.companyIds || []).includes(c.id)).map(c => (
                                            <option key={c.id} value={c.id}>{c.naziv}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Machine selector for Service */}
                                {eventFormData.tip === 'service' && (
                                    <div className="form-group">
                                        <label className="form-label">⚙️ {t('strojOprema')}</label>
                                        <select className="form-select" value={eventFormData.machineId}
                                            onChange={e => setEventFormData(prev => ({ ...prev, machineId: e.target.value }))}>
                                            <option value="">{t('odaberiStroj')}</option>
                                            {equipment.filter(e => !eventFormData.companyId || e.companyId === eventFormData.companyId).map(eq => (
                                                <option key={eq.id} value={eq.id}>{eq.naziv} ({eq.invBroj || eq.serijskiBroj})</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Worker selector — searchable combobox */}
                                {(eventFormData.tip === 'cert' || eventFormData.tip === 'ppe' || eventFormData.tip === 'medical' || eventFormData.tip === 'training') && (() => {
                                    const sortedWorkers = [...workers]
                                        .filter(w => w.aktivan !== false)
                                        .sort((a, b) => {
                                            const pa = (a.prezime || '').localeCompare(b.prezime || '', 'hr', { sensitivity: 'base' });
                                            return pa !== 0 ? pa : (a.ime || '').localeCompare(b.ime || '', 'hr', { sensitivity: 'base' });
                                        });
                                    const q = workerSearch.toLowerCase();
                                    const filtered = q
                                        ? sortedWorkers.filter(w =>
                                            (w.prezime + ' ' + w.ime).toLowerCase().includes(q) ||
                                            (w.ime + ' ' + w.prezime).toLowerCase().includes(q)
                                        )
                                        : sortedWorkers;
                                    const selectedWorker = workers.find(w => w.id === eventFormData.workerId);
                                    return (
                                        <div className="form-group">
                                            <label className="form-label">
                                                👤 {t('radnikOpcionalno')}
                                            </label>
                                            <div ref={workerDropRef} style={{ position: 'relative' }}>
                                                <div style={{
                                                    display: 'flex', alignItems: 'center',
                                                    border: workerDropOpen ? '1px solid var(--primary)' : '1px solid var(--border)',
                                                    borderRadius: 'var(--radius-md)', background: 'var(--bg-input)',
                                                    boxShadow: workerDropOpen ? '0 0 0 3px rgba(0,191,166,0.15)' : 'none',
                                                    transition: 'border-color 0.15s',
                                                }}>
                                                    <input
                                                        value={workerSearch}
                                                        onChange={e => {
                                                            setWorkerSearch(e.target.value);
                                                            setWorkerDropOpen(true);
                                                            if (!e.target.value) setEventFormData(prev => ({ ...prev, workerId: '' }));
                                                        }}
                                                        onFocus={() => setWorkerDropOpen(true)}
                                                        placeholder={selectedWorker ? (selectedWorker.prezime + ' ' + selectedWorker.ime) : (t('pretraziRadnika1'))}
                                                        style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', padding: '10px 12px', fontSize: '0.9rem', fontFamily: 'var(--font-body)', color: 'var(--text)' }}
                                                    />
                                                    {(eventFormData.workerId || workerSearch) && (
                                                        <button onClick={() => { setEventFormData(prev => ({ ...prev, workerId: '' })); setWorkerSearch(''); setWorkerDropOpen(false); }}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 10px', color: 'var(--text-muted)', fontSize: '1rem' }}>×</button>
                                                    )}
                                                    <button onClick={() => setWorkerDropOpen(o => !o)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 10px', color: 'var(--text-muted)', fontSize: '0.8rem', transform: workerDropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</button>
                                                </div>
                                                {selectedWorker && !workerDropOpen && (
                                                    <div style={{ fontSize: '0.78rem', color: 'var(--primary)', marginTop: 4, paddingLeft: 2, fontWeight: 600 }}>
                                                        ✓ {selectedWorker.prezime} {selectedWorker.ime}
                                                    </div>
                                                )}
                                                {workerDropOpen && (
                                                    <div style={{
                                                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none',
                                                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                                                        borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                                                        maxHeight: 220, overflowY: 'auto',
                                                    }}>
                                                        <div
                                                            onClick={() => { setEventFormData(prev => ({ ...prev, workerId: '' })); setWorkerSearch(''); setWorkerDropOpen(false); }}
                                                            style={{ padding: '9px 14px', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', fontStyle: 'italic' }}>— {t('bezRadnika')} —</div>
                                                        {filtered.length === 0 && (
                                                            <div style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                                                {t('nemaRezultata')}
                                                            </div>
                                                        )}
                                                        {filtered.map(w => (
                                                            <div key={w.id}
                                                                onClick={() => { setEventFormData(prev => ({ ...prev, workerId: w.id })); setWorkerSearch(''); setWorkerDropOpen(false); }}
                                                                style={{
                                                                    padding: '9px 14px', cursor: 'pointer', fontSize: '0.88rem',
                                                                    background: eventFormData.workerId === w.id ? 'rgba(0,191,166,0.12)' : 'transparent',
                                                                    color: eventFormData.workerId === w.id ? 'var(--primary)' : 'var(--text)',
                                                                    fontWeight: eventFormData.workerId === w.id ? 700 : 400,
                                                                }}>
                                                                <strong>{w.prezime}</strong> {w.ime}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* ── CERT fields ── */}
                                {eventFormData.tip === 'cert' && (
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <div className="form-group">
                                                <label className="form-label">{t('nazivUvjerenja')}</label>
                                                <input className="form-input" value={eventFormData.certNaziv}
                                                    onChange={e => setEventFormData(prev => ({ ...prev, certNaziv: e.target.value }))}
                                                    placeholder={t('nprOsposobljavanjeZnr')} />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">{t('tipUvjerenja')}</label>
                                                <select className="form-select" value={eventFormData.certTip}
                                                    onChange={e => {
                                                        const ct = certTypes.find(c => c.naziv === e.target.value);
                                                        const vrijediDo = ct && eventFormData.certDatum
                                                            ? (() => { const d = new Date(eventFormData.certDatum); d.setMonth(d.getMonth() + ct.trajanjeMjeseci); return d.toISOString().split('T')[0]; })()
                                                            : eventFormData.certVrijediDo;
                                                        setEventFormData(prev => ({ ...prev, certTip: e.target.value, certNaziv: ct?.naziv || prev.certNaziv, certOznaka: ct?.oznaka || prev.certOznaka, certVrijediDo: vrijediDo }));
                                                    }}>
                                                    <option value="">{t('odaberi1')}</option>
                                                    {certTypes.filter((ct, idx, arr) => arr.findIndex(x => x.naziv === ct.naziv) === idx).map(ct => <option key={ct.id} value={ct.naziv}>{ct.naziv}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                            <div className="form-group">
                                                <label className="form-label">{t('oznaka')}</label>
                                                <input className="form-input" value={eventFormData.certOznaka}
                                                    onChange={e => setEventFormData(prev => ({ ...prev, certOznaka: e.target.value }))}
                                                    placeholder="ZNR-001" />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">{t('datumIzdavanja')}</label>
                                                <DateInput value={eventFormData.certDatum}
                                                    onChange={v => setEventFormData(prev => ({ ...prev, certDatum: v }))} />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">{t('vrijediDo')}</label>
                                                <DateInput value={eventFormData.certVrijediDo}
                                                    onChange={v => setEventFormData(prev => ({ ...prev, certVrijediDo: v }))} />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('sposobnost')}</label>
                                            <select className="form-select" value={eventFormData.certSposobnost}
                                                onChange={e => setEventFormData(prev => ({ ...prev, certSposobnost: e.target.value }))}>
                                                <option value="Sposoban">{t('sposoban')}</option>
                                                <option value="Nesposoban">{t('nesposoban')}</option>
                                                <option value="Uvjetno sposoban">{t('uvjetnoSposoban')}</option>
                                            </select>
                                        </div>
                                    </>
                                )}

                                {/* ── PPE fields ── */}
                                {eventFormData.tip === 'ppe' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 12 }}>
                                        <div className="form-group">
                                            <label className="form-label">{lang !== 'en' ? 'Naziv OZO *' : 'PPE name *'}</label>
                                            <select className="form-select" value={eventFormData.ppeNaziv}
                                                onChange={e => setEventFormData(prev => ({ ...prev, ppeNaziv: e.target.value }))}>
                                                <option value="">{t('odaberi1')}</option>
                                                {ppeTypes.map(pt => <option key={pt.id} value={pt.naziv}>{pt.naziv}</option>)}
                                                <option value="__custom">{t('unesiRucno')}</option>
                                            </select>
                                            {eventFormData.ppeNaziv === '__custom' && (
                                                <input className="form-input" style={{ marginTop: 6 }}
                                                    placeholder={t('nazivOzo2')}
                                                    onChange={e => setEventFormData(prev => ({ ...prev, ppeNaziv: e.target.value }))} />
                                            )}
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('datumZaduzenja')}</label>
                                            <DateInput value={eventFormData.ppeDatum}
                                                onChange={v => setEventFormData(prev => ({ ...prev, ppeDatum: v }))} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('kol')}</label>
                                            <input className="form-input" type="number" min="1" value={eventFormData.ppeKolicina}
                                                onChange={e => setEventFormData(prev => ({ ...prev, ppeKolicina: parseInt(e.target.value) || 1 }))} />
                                        </div>
                                    </div>
                                )}


                                {/* ── Fleet Vehicle fields ── */}
                                {(eventFormData.tip === 'fleet_inspection' || eventFormData.tip === 'fleet_registration') && (
                                    <div className="form-group">
                                        <label className="form-label">🚗 {t('vozilo')}</label>
                                        <select className="form-select" value={eventFormData.vehicleId}
                                            onChange={e => setEventFormData(prev => ({ ...prev, vehicleId: e.target.value }))}>
                                            <option value="">{t('odaberiVozilo')}</option>
                                            {fleetVehicles.filter(v => !eventFormData.companyId || v.companyId === eventFormData.companyId).map(v => (
                                                <option key={v.id} value={v.id}>{v.marka} {v.model} ({v.registracija})</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* ── Fire Extinguisher Service fields ── */}
                                {eventFormData.tip === 'fire_service' && (
                                    <div className="form-group">
                                        <label className="form-label">🧯 {t('ppAparat')}</label>
                                        <select className="form-select" value={eventFormData.extinguisherId}
                                            onChange={e => setEventFormData(prev => ({ ...prev, extinguisherId: e.target.value }))}>
                                            <option value="">{t('odaberiAparat')}</option>
                                            {fireExtinguishers.map(fe => (
                                                <option key={fe.id} value={fe.id}>{fe.serijskiBroj} — {fe.lokacija || fe.tip}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* ── Hydrant Inspection fields ── */}
                                {eventFormData.tip === 'hydrant_inspection' && (
                                    <div className="form-group">
                                        <label className="form-label">🚰 {t('hidrant1')}</label>
                                        <select className="form-select" value={eventFormData.hydrantId}
                                            onChange={e => setEventFormData(prev => ({ ...prev, hydrantId: e.target.value }))}>
                                            <option value="">{t('odaberiHidrant')}</option>
                                            {hydrants.map(h => (
                                                <option key={h.id} value={h.id}>{h.oznaka} — {h.lokacija || (h.tip === 'unutarnji' ? 'Unutarnji' : 'Vanjski')}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* ── Evacuation Drill fields ── */}
                                {eventFormData.tip === 'evac_drill' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
                                        <div className="form-group">
                                            <label className="form-label">📍 {t('planEvakuacijeLokacija')}</label>
                                            <select className="form-select" value={eventFormData.evacPlanId}
                                                onChange={e => setEventFormData(prev => ({ ...prev, evacPlanId: e.target.value }))}>
                                                <option value="">{t('odaberiPlan')}</option>
                                                {evacuationPlans.map(p => (
                                                    <option key={p.id} value={p.id}>{p.lokacija}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('trajanjeMin')}</label>
                                            <input className="form-input" type="number" min="1" value={eventFormData.drillDuration}
                                                onChange={e => setEventFormData(prev => ({ ...prev, drillDuration: e.target.value }))} />
                                        </div>
                                    </div>
                                )}

                                {/* ── Training fields ── */}
                                {eventFormData.tip === 'training' && (
                                    <div className="form-group">
                                        <label className="form-label">📚 {t('nazivObuke')}</label>
                                        <input className="form-input" value={eventFormData.trainingName}
                                            onChange={e => setEventFormData(prev => ({ ...prev, trainingName: e.target.value }))}
                                            placeholder={t('nprObukaZnrObukaZop')} />
                                    </div>
                                )}

                                {/* Description + count for non-cert/ppe */}
                                <div className="form-group">
                                    <label className="form-label">
                                        {t('opisDogaaja')}
                                        {(eventFormData.tip !== 'cert' && eventFormData.tip !== 'ppe') ? ` (${t('opcionalno')})` : ` (${t('opcionalno')})`}
                                    </label>
                                    <input className="form-input" value={eventFormData.opis}
                                        onChange={e => setEventFormData(prev => ({ ...prev, opis: e.target.value }))}
                                        placeholder={t('opisDogaaja1')} />
                                </div>

                                {eventFormData.tip !== 'cert' && eventFormData.tip !== 'ppe' && !['fleet_inspection','fleet_registration','fire_service','hydrant_inspection','evac_drill','training','medical'].includes(eventFormData.tip) && (
                                    <div className="form-group">
                                        <label className="form-label">{t('brojRadnika')}</label>
                                        <input className="form-input" type="number" min="1" value={eventFormData.count}
                                            onChange={e => setEventFormData(prev => ({ ...prev, count: parseInt(e.target.value) || 1 }))} />
                                    </div>
                                )}

                                {/* Info banner for connected events */}
                                {eventFormData.workerId && (eventFormData.tip === 'cert' || eventFormData.tip === 'ppe') && (
                                    <div style={{ background: 'rgba(0,191,166,0.1)', border: '1px solid rgba(0,191,166,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem', color: '#009985' }}>
                                        ✅ {lang !== 'en'
                                            ? `Zapis će biti dodan i u ${eventFormData.tip === 'cert' ? 'Popis uvjerenja' : 'Zaštitnu opremu'} radnika.`
                                            : `Record will also be added to worker's ${eventFormData.tip === 'cert' ? 'certificates list' : 'PPE list'}.`}
                                    </div>
                                )}
                                {(eventFormData.tip === 'fleet_inspection' || eventFormData.tip === 'fleet_registration') && eventFormData.vehicleId && (
                                    <div style={{ background: 'rgba(0,191,166,0.1)', border: '1px solid rgba(0,191,166,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem', color: '#009985' }}>
                                        ✅ {lang !== 'en'
                                            ? `Datum ${eventFormData.tip === 'fleet_inspection' ? 'tehničkog pregleda' : 'registracije'} vozila će biti automatski ažuriran, a istek produžen za 1 godinu.`
                                            : `Vehicle's ${eventFormData.tip === 'fleet_inspection' ? 'inspection' : 'registration'} date will be updated automatically, expiry extended by 1 year.`}
                                    </div>
                                )}
                                {eventFormData.tip === 'fire_service' && eventFormData.extinguisherId && (
                                    <div style={{ background: 'rgba(0,191,166,0.1)', border: '1px solid rgba(0,191,166,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem', color: '#009985' }}>
                                        ✅ {t('datumServisaPpAparataCe')}
                                    </div>
                                )}
                                {eventFormData.tip === 'hydrant_inspection' && eventFormData.hydrantId && (
                                    <div style={{ background: 'rgba(0,191,166,0.1)', border: '1px solid rgba(0,191,166,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem', color: '#009985' }}>
                                        ✅ {t('datumPregledaHidrantaCeBiti')}
                                    </div>
                                )}
                                {eventFormData.tip === 'evac_drill' && eventFormData.evacPlanId && (
                                    <div style={{ background: 'rgba(0,191,166,0.1)', border: '1px solid rgba(0,191,166,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem', color: '#009985' }}>
                                        ✅ {t('vjezbaEvakuacijeCeBitiAutomatski')}
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer">
                                <button className="btn btn-ghost" onClick={() => setShowEventForm(false)}>{t('cancel')}</button>
                                <button className="btn btn-primary" onClick={() => {
                                    const { tip, opis, count, workerId, companyId, machineId,
                                        certNaziv, certOznaka, certTip, certDatum, certVrijediDo, certSposobnost,
                                        ppeNaziv, ppeDatum, ppeKolicina,
                                        vehicleId, extinguisherId, hydrantId, evacPlanId, drillDuration, trainingName } = eventFormData;

                                    // Validation
                                    if (tip === 'cert' && !certNaziv.trim() && !certTip) { setEventFormError(t('nazivIliTipUvjerenjaJe')); return; }
                                    if (tip === 'ppe' && (!ppeNaziv || ppeNaziv === '__custom')) { setEventFormError(t('nazivOzoJeObavezan')); return; }
                                    if (tip === 'service' && !machineId) { setEventFormError(t('strojJeObavezan')); return; }
                                    if ((tip === 'fleet_inspection' || tip === 'fleet_registration') && !vehicleId) { setEventFormError(t('voziloJeObavezno')); return; }
                                    if (tip === 'fire_service' && !extinguisherId) { setEventFormError(t('ppAparatJeObavezan')); return; }
                                    if (tip === 'hydrant_inspection' && !hydrantId) { setEventFormError(t('hidrantJeObavezan')); return; }
                                    if (tip === 'evac_drill' && !evacPlanId) { setEventFormError(t('planEvakuacijeJeObavezan')); return; }
                                    if (tip === 'training' && !trainingName.trim()) { setEventFormError(t('nazivObukeJeObavezan')); return; }
                                    if (!['cert','ppe','service','fleet_inspection','fleet_registration','fire_service','hydrant_inspection','evac_drill','training','medical'].includes(tip) && !opis.trim()) { setEventFormError(t('opisJeObavezan')); return; }

                                    // Auto-generate description
                                    let autoOpis = opis;
                                    if (tip === 'cert' && !opis) autoOpis = (certNaziv || certTip || 'Uvjerenje') + (workerId ? ` — ${workers.find(w => w.id === workerId)?.ime} ${workers.find(w => w.id === workerId)?.prezime}` : '');
                                    if (tip === 'ppe' && !opis) autoOpis = ppeNaziv + (workerId ? ` — ${workers.find(w => w.id === workerId)?.ime} ${workers.find(w => w.id === workerId)?.prezime}` : '');
                                    if (tip === 'service' && !opis) { const m = equipment.find(e => e.id === machineId); autoOpis = `${t('servis1')}: ${m?.naziv || ''}`; }
                                    if ((tip === 'fleet_inspection' || tip === 'fleet_registration') && !opis) { const v = fleetVehicles.find(v => v.id === vehicleId); autoOpis = `${tip === 'fleet_inspection' ? (t('tehnickiPregled')) : (t('registracija'))}: ${v?.marka || ''} ${v?.model || ''} (${v?.registracija || ''})`; }
                                    if (tip === 'fire_service' && !opis) { const fe = fireExtinguishers.find(f => f.id === extinguisherId); autoOpis = `${t('servisPpAparata1')}: ${fe?.serijskiBroj || ''}`; }
                                    if (tip === 'hydrant_inspection' && !opis) { const h = hydrants.find(h => h.id === hydrantId); autoOpis = `${t('pregledHidranta1')}: ${h?.oznaka || ''}`; }
                                    if (tip === 'evac_drill' && !opis) { const p = evacuationPlans.find(p => p.id === evacPlanId); autoOpis = `${t('vjezbaEvakuacije1')}: ${p?.lokacija || ''}`; }
                                    if (tip === 'medical' && !opis) autoOpis = (t('ljekarskiPregled1')) + (workerId ? ` — ${workers.find(w => w.id === workerId)?.ime} ${workers.find(w => w.id === workerId)?.prezime}` : '');
                                    if (tip === 'training' && !opis) autoOpis = trainingName + (workerId ? ` — ${workers.find(w => w.id === workerId)?.ime} ${workers.find(w => w.id === workerId)?.prezime}` : '');

                                    // ── Connected record updates ──
                                    let newSourceId = null;

                                    // 1. Cert → create certificate
                                    if (tip === 'cert' && workerId) {
                                        const newCert = createForCompany(COLLECTIONS.CERTIFICATES, {
                                            workerId,
                                            ime: certNaziv || certTip || 'Uvjerenje',
                                            naziv: certNaziv || certTip || 'Uvjerenje',
                                            oznaka: certOznaka,
                                            tipUvjerenja: certTip,
                                            datum: certDatum || eventFormDate,
                                            vrijediDo: certVrijediDo,
                                            sposobnost: certSposobnost,
                                            upisao: 'Kalendar',
                                            ogranicenje: '',
                                        }, companyId);
                                        newSourceId = newCert.id;
                                    }

                                    // 2. PPE → create PPE assignment
                                    if (tip === 'ppe' && workerId) {
                                        const newPpe = createForCompany(COLLECTIONS.PPE_ASSIGNMENTS, {
                                            workerId,
                                            naziv: ppeNaziv,
                                            datumZaduzenja: ppeDatum || eventFormDate,
                                            datumRazduzenja: '',
                                            kolicina: ppeKolicina,
                                        }, companyId);
                                        newSourceId = newPpe.id;
                                    }

                                    // 3. Fleet inspection → update vehicle's datumTehnickogPregleda + tehnickiIstice (+1 year)
                                    if (tip === 'fleet_inspection' && vehicleId) {
                                        const nextYear = new Date(new Date(eventFormDate).getTime() + 365 * 86400000).toISOString().split('T')[0];
                                        update(COLLECTIONS.VEHICLES, vehicleId, { datumTehnickogPregleda: eventFormDate, tehnickiIstice: nextYear });
                                        newSourceId = vehicleId;
                                    }

                                    // 4. Fleet registration → update vehicle's datumRegistracije + registracijaIstice (+1 year)
                                    if (tip === 'fleet_registration' && vehicleId) {
                                        const nextYear = new Date(new Date(eventFormDate).getTime() + 365 * 86400000).toISOString().split('T')[0];
                                        update(COLLECTIONS.VEHICLES, vehicleId, { datumRegistracije: eventFormDate, registracijaIstice: nextYear });
                                        newSourceId = vehicleId;
                                    }

                                    // 5. Fire extinguisher service → update zadnjiServis + sljedeciServis (+1 year)
                                    if (tip === 'fire_service' && extinguisherId) {
                                        const nextYear = new Date(new Date(eventFormDate).getTime() + 365 * 86400000).toISOString().split('T')[0];
                                        update(COLLECTIONS.FIRE_EXTINGUISHERS, extinguisherId, { zadnjiServis: eventFormDate, sljedeciServis: nextYear, status: 'ispravan' });
                                        newSourceId = extinguisherId;
                                    }

                                    // 6. Hydrant inspection → update inspection dates (+6 months)
                                    if (tip === 'hydrant_inspection' && hydrantId) {
                                        const in6m = new Date(new Date(eventFormDate).getTime() + 182 * 86400000).toISOString().split('T')[0];
                                        update(COLLECTIONS.HYDRANTS, hydrantId, { datumZadnjegPregleda: eventFormDate, sljedeciPregled: in6m, status: 'ispravan' });
                                        newSourceId = hydrantId;
                                    }

                                    // 7. Evacuation drill → create drill record
                                    if (tip === 'evac_drill' && evacPlanId) {
                                        const plan = evacuationPlans.find(p => p.id === evacPlanId);
                                        const newDrill = createForCompany(COLLECTIONS.EVACUATION_DRILLS, {
                                            planId: evacPlanId,
                                            lokacija: plan?.lokacija || '',
                                            datumVjezbe: eventFormDate,
                                            trajanjeMinuta: drillDuration || '',
                                            brojEvakuisanihOsoba: '',
                                            rukovodilac: '',
                                            napomena: opis || '',
                                            status: 'zakazano',
                                        }, companyId);
                                        newSourceId = newDrill.id;
                                    }

                                    // 8. Medical exam → create medical exam record
                                    if (tip === 'medical' && workerId) {
                                        const newMed = createForCompany(COLLECTIONS.MEDICAL_EXAMS, {
                                            workerId,
                                            datumPregleda: eventFormDate,
                                            tipPregleda: 'periodični',
                                            rezultat: '',
                                            napomena: opis || '',
                                        }, companyId);
                                        newSourceId = newMed.id;
                                    }

                                    // 9. Training → create training record
                                    if (tip === 'training') {
                                        const newTraining = createForCompany(COLLECTIONS.TRAININGS, {
                                            naziv: trainingName,
                                            datum: eventFormDate,
                                            workerId: workerId || '',
                                            napomena: opis || '',
                                            status: 'zakazano',
                                        }, companyId);
                                        newSourceId = newTraining.id;
                                    }

                                    // 10. Service → update equipment dates and history
                                    if (tip === 'service' && machineId) {
                                        const eq = equipment.find(e => e.id === machineId);
                                        if (eq) {
                                            const in1y = new Date(new Date(eventFormDate).getTime() + 365 * 86400000).toISOString().split('T')[0];
                                            const newLog = {
                                                id: Date.now().toString(),
                                                equipmentId: machineId,
                                                datum: eventFormDate,
                                                tip: 'pregled',
                                                servisirao: 'Kalendar',
                                                napomena: opis || '',
                                                iduciServis: in1y
                                            };
                                            // Create log in SERVICE_LOG collection to match equipment page logic
                                            create(COLLECTIONS.SERVICE_LOG, newLog);
                                            update(COLLECTIONS.EQUIPMENT, machineId, { posljednji: eventFormDate, iduci: in1y });
                                            newSourceId = machineId;
                                        }
                                    }

                                    // Create calendar event (company-scoped)
                                    createForCompany(COLLECTIONS.CALENDAR_EVENTS, { 
                                        datum: eventFormDate, 
                                        tip, 
                                        opis: autoOpis || opis, 
                                        count: workerId ? 1 : count, 
                                        machineId, 
                                        vehicleId, 
                                        extinguisherId, 
                                        hydrantId, 
                                        evacPlanId, 
                                        workerId: workerId || '',
                                        sourceId: newSourceId || ''
                                    }, companyId);

                                    setEventFormError(''); setShowEventForm(false);
                                    loadDashboardData();

                                    // Auto-navigate to relevant page for service events
                                    if (tip === 'service' && machineId) {
                                        router.push('/dashboard/equipment?openItem=' + machineId + '&tab=servis&returnTo=/dashboard');
                                    }
                                }}>💾 {t('save')}</button>
                            </div>
                        </div>
                    </div>
                )}
                {/* ── Delete Event Confirmation Modal ── */}
                {deleteEventTarget && (
                    <div className="modal-overlay" onClick={() => setDeleteEventTarget(null)} style={{ zIndex: 100000 }}>
                        <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #C62828, #B71C1C)' }}>
                                <h2 style={{ color: 'white' }}>🗑️ {t('obrisiDogaaj')}</h2>
                                <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setDeleteEventTarget(null)}>✕</button>
                            </div>
                            <div className="modal-body">
                                <p style={{ marginBottom: 12, color: 'var(--text)' }}>
                                    {t('sigurnoZelisObrisatiOvajDogaaj')}
                                </p>
                                <div style={{ background: 'rgba(0,0,0,0.06)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4, color: 'var(--text)' }}>
                                        {deleteEventTarget.tip === 'cert' ? '📜' : deleteEventTarget.tip === 'ppe' ? '🦺' : deleteEventTarget.tip === 'equip' ? '⚙️' : '📋'}{' '}
                                        {deleteEventTarget.opis || deleteEventTarget.tip}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        📅 {formatDate(deleteEventTarget.datum)}
                                    </div>
                                </div>
                                <p style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    ⚠️ {t('ovoBriseSamoUnosS')}
                                </p>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-ghost" onClick={() => setDeleteEventTarget(null)}>
                                    {t('cancel')}
                                </button>
                                <button className="btn btn-danger" onClick={confirmDeleteEvent}
                                    style={{ background: '#D32F2F', color: 'white', border: 'none' }}>
                                    🗑️ {t('obrisi')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </CollapsibleWidget>

            {/* Quick Tabs */}
            <CollapsibleWidget id="workers" title={t('radniciPodaci')} icon="👷" isMobile={isMobile}>
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
                                        color: activeTab === tb.key ? 'white' : 'var(--text-light)',
                                        borderRadius: activeTab === tb.key ? 'var(--radius-md) var(--radius-md) 0 0' : 0,
                                        transition: 'all 0.2s',
                                    }}>
                                    {tb.label}
                                    {tb.count> 0 && <span style={{
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
                            <button className="btn btn-primary btn-sm" onClick={() => {
                                if (activeTab === 'certs') router.push('/dashboard/worker-certificates');
                                else if (activeTab === 'ppe') router.push('/dashboard/worker-ppe');
                                else router.push('/dashboard/workers');
                            }} title={t('dodajNoviUnos')}>+ {t('add')}</button>
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
                                        {(activeTab === 'new' ? activeWorkers : terminatedWorkers).map((w, idx) => {
                                            let lpTimer = null;
                                            let lpMoved = false;
                                            let lpPos = { x: 0, y: 0 };
                                            return (
                                                <tr key={w.id}
                                                    onTouchStart={isMobile ? (e) => {
                                                        lpMoved = false;
                                                        lpPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                                                        lpTimer = setTimeout(() => {
                                                            if (!lpMoved) handleWorkerLongPress(w, lpPos);
                                                        }, 500);
                                                    } : undefined}
                                                    onTouchMove={isMobile ? (e) => {
                                                        const dx = Math.abs(e.touches[0].clientX - lpPos.x);
                                                        const dy = Math.abs(e.touches[0].clientY - lpPos.y);
                                                        if (dx> 10 || dy> 10) { lpMoved = true; clearTimeout(lpTimer); }
                                                    } : undefined}
                                                    onTouchEnd={isMobile ? () => clearTimeout(lpTimer) : undefined}>
                                                    <td style={{ position: 'relative' }} ref={actionMenuId === w.id ? actionRef : null}>
                                                        <button className="btn btn-primary btn-sm"
                                                            onClick={() => setActionMenuId(actionMenuId === w.id ? null : w.id)}
                                                            title={t('prikaziAkcijeZaRadnika')}>
                                                            {t('actions')} ▼
                                                        </button>
                                                        {actionMenuId === w.id && (
                                                            <div className="dropdown-menu" style={{ top: 'calc(100% + 4px)', left: 0, zIndex: 50 }}>
                                                                <button className="dropdown-item" onClick={() => handleWorkerAction('open', w)}>📂 {t('open')}</button>
                                                                <button className="dropdown-item" onClick={() => handleWorkerAction('certs', w)}>📜 {t('certificatesAndTraining')}</button>
                                                                <button className="dropdown-item" onClick={() => handleWorkerAction('ppe', w)}>🦺 {t('personalProtective')}</button>
                                                                <div className="dropdown-divider" />
                                                                <button className="dropdown-item" onClick={() => handleWorkerAction('print', w)}>🖨️ {t('print')}</button>
                                                                <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={() => handleWorkerAction('delete', w)}>🗑️ {t('obrisi')}</button>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>{idx + 1}</td>
                                                    <td style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--primary)' }}
                                                        onClick={() => router.push(`/dashboard/workers?openWorker=${w.id}`)}>
                                                        {w.ime}
                                                    </td>
                                                    <td style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--primary)' }}
                                                        onClick={() => router.push(`/dashboard/workers?openWorker=${w.id}`)}>
                                                        {w.prezime}
                                                    </td>
                                                    <td><code style={{ fontSize: '0.85rem' }}>{w.jmbg}</code></td>
                                                    <td>{formatDate(w.datumZaposlenja)}</td>
                                                    <td>{getOrgUnitName(w.orgJedinicaId)}</td>
                                                </tr>
                                            );
                                        })}
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
                                            <th>{t('radnik1')}</th>
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
                                                    <td style={{ position: 'relative' }} ref={actionMenuId === `cert-${c.id}` ? actionRef : null}>
                                                        <button className="btn btn-primary btn-sm" onClick={() => setActionMenuId(actionMenuId === `cert-${c.id}` ? null : `cert-${c.id}`)} title={t('prikaziAkcijeZaUvjerenje')}>
                                                            {t('actions')} ▼
                                                        </button>
                                                        {actionMenuId === `cert-${c.id}` && (
                                                            <div className="dropdown-menu" style={{ top: 'calc(100% + 4px)', left: 0, zIndex: 50 }}>
                                                                <button className="dropdown-item" onClick={() => { setActionMenuId(null); if (worker) router.push(`/dashboard/workers?openWorker=${worker.id}&section=uvjerenja`); }}>📂 {t('open')}</button>
                                                                <button className="dropdown-item" onClick={() => { setActionMenuId(null); if (worker) setViewWorkerId(worker.id); }}>👤 {t('profilRadnika')}</button>
                                                                <div className="dropdown-divider" />
                                                                <button className="dropdown-item" onClick={() => { setActionMenuId(null); router.push('/dashboard/worker-certificates'); }}>📜 {t('svaUvjerenja')}</button>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ fontWeight: 600 }}>
                                                        <button
                                                            onClick={() => { if (worker) setViewWorkerId(worker.id); }}
                                                            style={{ background: 'none', border: 'none', cursor: worker ? 'pointer' : 'default', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: worker ? 'underline' : 'none', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)' }}
                                                            title={worker ? (t('klikniZaPregledProfilaRadnika')) : ''}>{worker ? `${worker.ime} ${worker.prezime}` : '-'}</button>
                                                    </td>
                                                    <td>
                                                        <button
                                                            onClick={() => { if (worker) setViewWorkerId(worker.id); }}
                                                            style={{ background: 'none', border: 'none', cursor: worker ? 'pointer' : 'default', color: 'var(--primary)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: worker ? 'underline' : 'none', textDecorationStyle: 'solid', textDecorationColor: 'var(--primary)' }}
                                                            title={worker ? (t('klikniZaPregledUvjerenjaRadnika')) : ''}>{c.naziv || c.ime || '—'}</button>
                                                    </td>
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
                                            <th>{t('radnik1')}</th>
                                            <th>{t('name')}</th>
                                            <th>{t('datumZaduzenja')}</th>
                                            <th>{t('kolicina')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ppeAssignments.map((p, idx) => {
                                            const worker = workers.find(w => w.id === p.workerId);
                                            return (
                                                <tr key={p.id || idx}>
                                                    <td style={{ position: 'relative' }} ref={actionMenuId === `ppe-${p.id}` ? actionRef : null}>
                                                        <button className="btn btn-primary btn-sm" onClick={() => setActionMenuId(actionMenuId === `ppe-${p.id}` ? null : `ppe-${p.id}`)} title={lang !== 'en' ? 'Prikaži akcije za opremu' : 'Show PPE actions'}>
                                                            {t('actions')} ▼
                                                        </button>
                                                        {actionMenuId === `ppe-${p.id}` && (
                                                            <div className="dropdown-menu" style={{ top: 'calc(100% + 4px)', left: 0, zIndex: 50 }}>
                                                                <button className="dropdown-item" onClick={() => { setActionMenuId(null); if (worker) router.push(`/dashboard/workers?openWorker=${worker.id}&section=ozo`); }}>📂 {t('open')}</button>
                                                                <button className="dropdown-item" onClick={() => { setActionMenuId(null); if (worker) setViewWorkerId(worker.id); }}>👤 {t('profilRadnika')}</button>
                                                                <div className="dropdown-divider" />
                                                                <button className="dropdown-item" onClick={() => { setActionMenuId(null); router.push('/dashboard/worker-ppe'); }}>🦺 {t('svaOzoZaduzenja')}</button>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ fontWeight: 600 }}>
                                                        <button
                                                            onClick={() => { if (worker) setViewWorkerId(worker.id); }}
                                                            style={{ background: 'none', border: 'none', cursor: worker ? 'pointer' : 'default', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: worker ? 'underline' : 'none', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)' }}
                                                            title={worker ? (t('klikniZaPregledProfilaRadnika')) : ''}>{worker ? `${worker.ime} ${worker.prezime}` : '-'}</button>
                                                    </td>
                                                    <td>
                                                        <button
                                                            onClick={() => { if (worker) setViewWorkerId(worker.id); }}
                                                            style={{ background: 'none', border: 'none', cursor: worker ? 'pointer' : 'default', color: 'var(--primary)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: worker ? 'underline' : 'none', textDecorationStyle: 'solid', textDecorationColor: 'var(--primary)' }}
                                                            title={worker ? (t('klikniZaPregledOzoZaduzenja')) : ''}>{p.naziv || '—'}</button>
                                                    </td>
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
            </CollapsibleWidget>

            {viewWorkerId && (
                <WorkerProfileModal
                    workerId={viewWorkerId}
                    onClose={() => setViewWorkerId(null)}
                    onSaved={() => setViewWorkerId(null)}
                />
            )}
            <DialogRenderer />
        </div>
    );

    // Always wrap in PullToRefresh to maintain stable DOM depth and prevent layout shift.
    // The component inherently only responds to touch events anyway.
    return (
        <PullToRefresh onRefresh={reloadAllData}>
            {dashboardContent}
        </PullToRefresh>
    );
}

function StatCard({ icon, label, value, color, onClick, isAlert, trend, total }) {
    const pct = total && total > 0 ? Math.min(100, Math.round((value / total) * 100)) : null;
    // Hover only on non-touch devices
    const hoverIn = (e) => {
        if (!window.matchMedia('(hover: hover)').matches) return;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
    };
    const hoverOut = (e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '';
    };
    return (
        <div
            className="card"
            style={{
                borderLeft: `4px solid ${color}`,
                cursor: 'pointer',
                background: isAlert ? 'rgba(244,67,54,0.12)' : undefined,
                transition: 'all 0.2s ease',
            }}
            onClick={onClick}
            onMouseEnter={hoverIn}
            onMouseLeave={hoverOut}
        >
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 10px' }}>
                {/* Icon in circular badge — smaller on mobile via clamp */}
                <div style={{
                    width: 'clamp(32px, 5vw, 40px)', height: 'clamp(32px, 5vw, 40px)', borderRadius: '50%',
                    background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, fontSize: 'clamp(1rem, 2vw, 1.25rem)',
                    animation: isAlert ? 'pulse 1.5s infinite' : undefined,
                }}>{icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', fontWeight: 800, fontFamily: 'var(--font-heading)', color }}>{value}</span>
                        {trend != null && trend !== 0 && (
                            <span style={{
                                fontSize: '0.65rem', fontWeight: 700,
                                color: trend > 0 ? 'var(--success)' : 'var(--danger)',
                            }}>
                                {trend > 0 ? `▲+${trend}` : `▼${trend}`}
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: 'clamp(0.65rem, 1.5vw, 0.75rem)', lineHeight: 1.2, color: isAlert ? 'var(--danger)' : 'var(--text-muted)', fontWeight: isAlert ? 700 : undefined, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{label}</div>
                    {/* Mini progress bar */}
                    {pct != null && (
                        <div style={{ marginTop: 4, height: 3, borderRadius: 2, background: 'var(--border-light)', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 0.6s ease' }} />
                        </div>
                    )}
                </div>
                {isAlert && <span style={{ marginLeft: 'auto', fontSize: '1rem', flexShrink: 0 }}>⚠️</span>}
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
