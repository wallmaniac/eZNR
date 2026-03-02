'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter, usePathname } from 'next/navigation';

// ─── App knowledge base for the AI system prompt ───────────────────────────
const APP_KNOWLEDGE = {
    pages: [
        { path: '/dashboard', label_bs: 'Kontrolna ploča', label_en: 'Dashboard', desc_en: 'Main overview with statistics, calendar and recent activity', desc_bs: 'Pregled statistika, kalendara i nedavnih aktivnosti' },
        { path: '/dashboard/news', label_bs: 'Početna / Novosti', label_en: 'Home / News', desc_en: 'News, laws and regulations about occupational safety', desc_bs: 'Novosti, zakoni i pravilnici o zaštiti na radu' },
        { path: '/dashboard/org-units', label_bs: 'Organizacijske jedinice', label_en: 'Organizational Units', desc_en: 'Manage company departments and organizational structure', desc_bs: 'Upravljanje odjelima i organizacijskom strukturom firme' },
        { path: '/dashboard/workplaces', label_bs: 'Radna mjesta', label_en: 'Workplaces', desc_en: 'Define and manage job positions and workplaces', desc_bs: 'Definisanje i upravljanje radnim mjestima' },
        { path: '/dashboard/workers', label_bs: 'Radnici', label_en: 'Workers', desc_en: 'Manage employees: personal data, certificates, training, PPE', desc_bs: 'Upravljanje radnicima: lični podaci, uvjerenja, obuke, zaštitna oprema' },
        { path: '/dashboard/equipment', label_bs: 'Radna oprema i objekti', label_en: 'Equipment & Testing Objects', desc_en: 'Track work equipment and testing facilities with inspection records', desc_bs: 'Praćenje radne opreme i objekata ispitivanja s evidencijom pregleda' },
        { path: '/dashboard/injuries', label_bs: 'Prijava povrede na radu', label_en: 'Work Injury Report', desc_en: 'Report and document workplace injuries', desc_bs: 'Prijava i evidentiranje povreda na radu' },
        { path: '/dashboard/diseases', label_bs: 'Prijava profesionalne bolesti', label_en: 'Professional Disease Report', desc_en: 'Report professional diseases to relevant authorities', desc_bs: 'Prijava profesionalnih bolesti nadležnim organima' },
        { path: '/dashboard/form-oir1', label_bs: 'Obrazac OIR1', label_en: 'Form OIR1', desc_en: 'Official injury report form OIR1', desc_bs: 'Zvanični obrazac za prijavu povrede OIR1' },
        { path: '/dashboard/annual-injuries', label_bs: 'Godišnji izvještaj o povredama', label_en: 'Annual Injury Report', desc_en: 'Annual statistics and reporting on workplace injuries', desc_bs: 'Godišnja statistika i izvještavanje o povredama na radu' },
        { path: '/dashboard/referral-ra1', label_bs: 'Ljekarska uputnica RA1', label_en: 'Medical Referral RA1', desc_en: 'Generate RA1 medical referral forms for workers', desc_bs: 'Generisanje RA1 ljekarskih uputnica za radnike' },
        { path: '/dashboard/form-ro1', label_bs: 'Obrazac RO1', label_en: 'Form RO1', desc_en: 'RO1 report form for occupational safety', desc_bs: 'Obrazac RO1 za zaštitu na radu' },
        { path: '/dashboard/form-ro2', label_bs: 'Obrazac RO2', label_en: 'Form RO2', desc_en: 'RO2 report form for occupational safety', desc_bs: 'Obrazac RO2 za zaštitu na radu' },
        { path: '/dashboard/night-work', label_bs: 'Uputnica za noćni rad', label_en: 'Night Work Referral', desc_en: 'Medical referrals and records for night shift workers', desc_bs: 'Ljekarske uputnice i evidencija za radnike na noćnoj smjeni' },
        { path: '/dashboard/archive', label_bs: 'Digitalna arhiva', label_en: 'Digital Archive', desc_en: 'Store and manage all company documents digitally', desc_bs: 'Čuvanje i upravljanje svim dokumentima firme digitalno' },
        { path: '/dashboard/requests', label_bs: 'Zahtjevnice', label_en: 'Requests', desc_en: 'Manage procurement and material requests', desc_bs: 'Upravljanje zahtjevnicama za nabavku i materijal' },
        { path: '/dashboard/risk-assessment', label_bs: 'Procjena rizika', label_en: 'Risk Assessment', desc_en: 'Perform and document workplace risk assessments', desc_bs: 'Provođenje i dokumentovanje procjene rizika na radnom mjestu' },
        { path: '/dashboard/questionnaires', label_bs: 'Upitnici', label_en: 'Questionnaires', desc_en: 'Create and manage safety questionnaires for workers', desc_bs: 'Kreiranje i upravljanje sigurnosnim upitnicima za radnike' },
        { path: '/dashboard/countries', label_bs: 'Države', label_en: 'Countries', desc_en: 'Reference list of countries', desc_bs: 'Referentna lista država' },
        { path: '/dashboard/counties', label_bs: 'Županije/Kantoni', label_en: 'Counties/Cantons', desc_en: 'Reference list of counties and cantons in BiH', desc_bs: 'Referentna lista županija i kantona u BiH' },
        { path: '/dashboard/places', label_bs: 'Mjesta', label_en: 'Places', desc_en: 'Reference list of cities and places', desc_bs: 'Referentna lista gradova i mjesta' },
        { path: '/dashboard/org-groups', label_bs: 'Grupe org. jedinica', label_en: 'Org. Unit Groups', desc_en: 'Group organizational units for easier management', desc_bs: 'Grupiranje organizacijskih jedinica za lakše upravljanje' },
        { path: '/dashboard/authorized-companies', label_bs: 'Ovlaštene firme', label_en: 'Authorized Companies', desc_en: 'Registered companies authorized for safety inspections', desc_bs: 'Registrirane ovlaštene firme za inspekcije sigurnosti' },
        { path: '/dashboard/examiners', label_bs: 'Ispitivači', label_en: 'Examiners', desc_en: 'Personnel authorized to conduct safety examinations', desc_bs: 'Osoblje ovlašteno za provođenje sigurnosnih ispitivanja' },
        { path: '/dashboard/doctors', label_bs: 'Doktori', label_en: 'Doctors', desc_en: 'Occupational medicine doctors for worker health checks', desc_bs: 'Doktori medicine rada za zdravstvene preglede radnika' },
        { path: '/dashboard/exam-types', label_bs: 'Tipovi pregleda', label_en: 'Examination Types', desc_en: 'Define types of medical and safety examinations', desc_bs: 'Definisanje tipova ljekarskih i sigurnosnih pregleda' },
        { path: '/dashboard/cert-types', label_bs: 'Tipovi uvjerenja', label_en: 'Certification Types', desc_en: 'Define types of worker certifications and training certificates', desc_bs: 'Definisanje tipova radničkih uvjerenja i certifikata obuke' },
        { path: '/dashboard/equipment-types', label_bs: 'Vrste opreme', label_en: 'Equipment Types', desc_en: 'Categorize work equipment and testing objects', desc_bs: 'Kategorizacija radne opreme i objekata ispitivanja' },
        { path: '/dashboard/ppe', label_bs: 'Zaštitna oprema (PPE)', label_en: 'Personal Protective Equipment', desc_en: 'Catalog of personal protective equipment items', desc_bs: 'Katalog osobnih zaštitnih sredstava' },
        { path: '/dashboard/file-types', label_bs: 'Vrsta datoteke', label_en: 'File Types', desc_en: 'Define file type categories for the digital archive', desc_bs: 'Definisanje kategorija vrsta datoteka za digitalnu arhivu' },
        { path: '/dashboard/extra-fields', label_bs: 'Dodatna polja', label_en: 'Extra Fields', desc_en: 'Add custom data fields to records', desc_bs: 'Dodavanje prilagođenih polja podataka u evidencije' },
        { path: '/dashboard/address-book', label_bs: 'Adresar', label_en: 'Address Book', desc_en: 'Contact directory of workers and companies', desc_bs: 'Adresar radnika i firmi' },
        { path: '/dashboard/worker-certificates', label_bs: 'Uvjerenja radnika', label_en: 'Worker Certificates', desc_en: 'List and track all worker training certificates and expiry dates', desc_bs: 'Lista i praćenje svih uvjerenja radnika i datuma isteka' },
        { path: '/dashboard/worker-ppe', label_bs: 'Zaštitna oprema radnika', label_en: 'Worker PPE', desc_en: 'Track PPE assigned to each worker', desc_bs: 'Praćenje zaštitne opreme dodijeljene svakom radniku' },
        { path: '/dashboard/workplace-list', label_bs: 'Popis radnih mjesta', label_en: 'Workplace List', desc_en: 'Report listing all workplaces and their details', desc_bs: 'Izvještaj sa popisom svih radnih mjesta i njihovim detaljima' },
        { path: '/dashboard/injury-list', label_bs: 'Popis povreda', label_en: 'Injury List', desc_en: 'Full list of recorded workplace injuries', desc_bs: 'Cjeloviti popis evidentiranih povreda na radu' },
        { path: '/dashboard/training-book', label_bs: 'Matična knjiga osposobljavanja', label_en: 'Training Master Book', desc_en: 'Official training records for all workers', desc_bs: 'Zvanična evidencija obuke za sve radnike' },
        { path: '/dashboard/ek-workers', label_bs: 'EK - Radnici', label_en: 'EK - Workers', desc_en: 'Worker records exported for EK format', desc_bs: 'Evidencija radnika u EK formatu' },
        { path: '/dashboard/ek-equipment', label_bs: 'EK - Oprema', label_en: 'EK - Equipment', desc_en: 'Equipment records exported for EK format', desc_bs: 'Evidencija opreme u EK formatu' },
        { path: '/dashboard/equipment-exams', label_bs: 'Pregledi opreme', label_en: 'Equipment Exam List', desc_en: 'List of all scheduled and completed equipment inspections', desc_bs: 'Lista svih planiranih i izvršenih pregleda opreme' },
        { path: '/dashboard/isznr-documents', label_bs: 'ISZNR Dokumenti', label_en: 'ISZNR Documents', desc_en: 'Official documents submitted to the ISZNR system', desc_bs: 'Zvanični dokumenti predati ISZNR sistemu' },
        { path: '/dashboard/isznr-parties', label_bs: 'ISZNR Stranke', label_en: 'ISZNR Parties', desc_en: 'Parties and clients in the ISZNR system', desc_bs: 'Stranke i klijenti u ISZNR sistemu' },
        { path: '/dashboard/isznr-doc-types', label_bs: 'ISZNR Tipovi dokumenata', label_en: 'ISZNR Document Types', desc_en: 'Document type definitions for the ISZNR module', desc_bs: 'Definicije tipova dokumenata za ISZNR modul' },
        { path: '/dashboard/isznr-signing', label_bs: 'Digitalno potpisivanje', label_en: 'Digital Signing', desc_en: 'Digitally sign official documents', desc_bs: 'Digitalno potpisivanje zvaničnih dokumenata' },
        { path: '/dashboard/isznr-examiners', label_bs: 'ISZNR Ispitivači', label_en: 'ISZNR Examiners', desc_en: 'Examiners registered in the ISZNR system', desc_bs: 'Ispitivači registrirani u ISZNR sistemu' },
        { path: '/dashboard/isznr-measure-equipment', label_bs: 'Mjerna oprema', label_en: 'Measuring Equipment', desc_en: 'Calibrated measuring and testing equipment', desc_bs: 'Kalibrisana mjerna i ispitna oprema' },
        { path: '/dashboard/employer-docs', label_bs: 'Dokumentacija za poslodavca', label_en: 'Employer Documentation', desc_en: 'Mandatory employer safety documentation and periodic reviews', desc_bs: 'Obavezna sigurnosna dokumentacija poslodavca i periodični pregledi' },
        { path: '/dashboard/settings', label_bs: 'Postavke', label_en: 'Settings', desc_en: 'Application settings, user profile and company information', desc_bs: 'Postavke aplikacije, korisnički profil i podaci o firmi' },
    ],
};

function buildSystemPrompt(lang, currentPath) {
    const currentPage = APP_KNOWLEDGE.pages.find(p => p.path === currentPath);
    const pageDesc = currentPage
        ? (lang === 'bs' ? `Korisnik se trenutno nalazi na: ${currentPage.label_bs} — ${currentPage.desc_bs}` : `User is currently on: ${currentPage.label_en} — ${currentPage.desc_en}`)
        : '';

    const pagesText = APP_KNOWLEDGE.pages
        .map(p => lang === 'bs'
            ? `• ${p.label_bs} (${p.path}): ${p.desc_bs}`
            : `• ${p.label_en} (${p.path}): ${p.desc_en}`)
        .join('\n');

    if (lang === 'bs') {
        return `Ti si Zia, napredni AI asistent za eZNR — digitalnu platformu za zaštitu na radu i zaštitu od požara u Bosni i Hercegovini. Razgovaraš na bosanskom jeziku.

TVOJA ULOGA:
- Pomaži korisnicima da se snađu unutar aplikacije
- Objasni svrhu svake stranice i modula
- Daj savjete o toku rada i najboljim praksama u zaštiti na radu
- Usmjeri korisnike na odgovarajuće sekcije aplikacije

${pageDesc}

STRANICE APLIKACIJE:
${pagesText}

UPUTE:
- Budi prijatan, stručan i koncizan
- Kada preporučuješ stranicu, navedi njenu putanju u formatu: [Naziv](putanja)
- Fokusiraj se na pomoć unutar platforme eZNR
- Ako korisnik pita o specifičnim propisima zaštite na radu u BiH, pomozi im uz napomenu da uvijek proverite sa nadležnim tijelima
- Odgovaraj kratko i jasno, bez dugih uvoda`;
    } else {
        return `You are Zia, an advanced AI assistant for eZNR — a digital platform for occupational safety and fire safety in Bosnia and Herzegovina. You communicate in English.

YOUR ROLE:
- Help users navigate the application
- Explain the purpose of each page and module
- Provide workflow tips and best practices for occupational safety
- Direct users to the appropriate application sections

${pageDesc}

APPLICATION PAGES:
${pagesText}

INSTRUCTIONS:
- Be friendly, professional, and concise
- When recommending a page, mention its path in format: [Name](path)
- Focus on helping within the eZNR platform
- If users ask about specific occupational safety regulations in BiH, help them while noting to always verify with competent authorities
- Keep responses short and clear, without long introductions`;
    }
}

// ─── Quick suggestion chips ─────────────────────────────────────────────────
const SUGGESTIONS = {
    bs: [
        { label: '👷 Dodati novog radnika', text: 'Kako dodati novog radnika u sistem?' },
        { label: '📜 Pratiti uvjerenja', text: 'Gdje mogu pratiti uvjerenja radnika i kada ističu?' },
        { label: '⚠️ Procjena rizika', text: 'Kako napraviti procjenu rizika za radno mjesto?' },
        { label: '📊 Godišnji izvještaj', text: 'Gdje se pravi godišnji izvještaj o povredama na radu?' },
        { label: '🦺 Zaštitna oprema', text: 'Kako evidentirati zaštitnu opremu za radnike?' },
        { label: '📋 Obavezna dokumentacija', text: 'Koja je obavezna dokumentacija za poslodavca?' },
    ],
    en: [
        { label: '👷 Add a worker', text: 'How do I add a new worker to the system?' },
        { label: '📜 Track certificates', text: 'Where can I track worker certificates and their expiry?' },
        { label: '⚠️ Risk assessment', text: 'How do I create a risk assessment for a workplace?' },
        { label: '📊 Annual report', text: 'Where do I create the annual injury report?' },
        { label: '🦺 Protective gear', text: 'How do I record personal protective equipment for workers?' },
        { label: '📋 Mandatory docs', text: 'What mandatory documentation is required for employers?' },
    ],
};

// ─── Main component ─────────────────────────────────────────────────────────
export default function AIAssistant() {
    const { lang } = useLanguage();
    const router = useRouter();
    const pathname = usePathname();

    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [hasNewMessage, setHasNewMessage] = useState(false);
    const [pulseAnimation, setPulseAnimation] = useState(true);
    const [retryCountdown, setRetryCountdown] = useState(0);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const chatHistoryRef = useRef([]); // keep full history for context
    const retryTimerRef = useRef(null);
    const pendingRetryRef = useRef(null); // stores { text, history } for auto-retry
    const retryAttemptRef = useRef(0);    // counts how many auto-retries done

    // Stop pulse after 8 seconds
    useEffect(() => {
        const timer = setTimeout(() => setPulseAnimation(false), 8000);
        return () => clearTimeout(timer);
    }, []);

    // Cleanup retry timer on unmount
    useEffect(() => {
        return () => { if (retryTimerRef.current) clearInterval(retryTimerRef.current); };
    }, []);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Focus input when chat opens
    useEffect(() => {
        if (isOpen && !isMinimized && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [isOpen, isMinimized]);

    const handleOpen = useCallback(() => {
        setIsOpen(true);
        setIsMinimized(false);
        setHasNewMessage(false);
        setPulseAnimation(false);

        // Show welcome message on first open
        if (messages.length === 0) {
            const welcome = lang === 'bs'
                ? `Zdravo! Ja sam **Zia**, vaš AI asistent za eZNR platformu. 👋\n\nMogu vam pomoći da:\n• Pronađete pravu stranicu ili funkciju\n• Razumijete kako koristiti module\n• Pratite tokove rada za zaštitu na radu\n\nŠta vas zanima?`
                : `Hello! I'm **Zia**, your AI assistant for the eZNR platform. 👋\n\nI can help you:\n• Find the right page or feature\n• Understand how to use the modules\n• Navigate occupational safety workflows\n\nWhat would you like to know?`;
            const welcomeMsg = { role: 'assistant', content: welcome, timestamp: new Date() };
            setMessages([welcomeMsg]);
        }
    }, [lang, messages.length]);

    const handleClose = useCallback(() => {
        setIsOpen(false);
    }, []);

    const handleMinimize = useCallback(() => {
        setIsMinimized(prev => !prev);
    }, []);

    // Parse assistant response for navigation links
    const parseResponse = useCallback((text) => {
        // Look for [Label](/dashboard/path) patterns and make them clickable
        return text.replace(/\[([^\]]+)\]\((\/dashboard[^\)]*)\)/g, (match, label, path) => {
            return `__NAV_LINK__${label}__${path}__END_NAV__`;
        });
    }, []);

    // ── Core API call (single model attempt) ────────────────────────────────
    const callGemini = useCallback(async (model, history, systemPrompt, apiKey) => {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: systemPrompt }] },
                    contents: history,
                    generationConfig: { temperature: 0.7, maxOutputTokens: 600, topP: 0.95 },
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
                    ],
                }),
            }
        );
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const err = new Error(errData.error?.message || `API error ${response.status}`);
            err.status = response.status;
            err.isRateLimit = response.status === 429 || (errData.error?.message || '').toLowerCase().includes('quota');
            // Parse retry-after seconds from error message e.g. "retry in 22.299...s"
            const match = (errData.error?.message || '').match(/retry in ([\d.]+)s/i);
            err.retryAfter = match ? Math.ceil(parseFloat(match[1])) + 2 : 30;
            throw err;
        }
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }, []);

    // ── Start retry countdown, then auto-resend ───────────────────────────────
    const startRetryCountdown = useCallback((seconds, text, history) => {
        const MAX_RETRIES = 2;
        retryAttemptRef.current += 1;

        // If we've retried too many times, the quota is truly exhausted for the day
        if (retryAttemptRef.current > MAX_RETRIES) {
            if (retryTimerRef.current) clearInterval(retryTimerRef.current);
            setRetryCountdown(0);
            pendingRetryRef.current = null;
            const quotaMsg = lang === 'bs'
                ? `🚫 **Dnevna kvota iscrpljena.** Vaš API ključ je dostigao besplatni dnevni limit.

**Šta uraditi:**
• 🔗 Omogućite naplatu na [Google Cloud Console](https://console.cloud.google.com/billing) za više zahtjeva
• ⏳ Ili pričekajte do suće dok se limiti ne resetuju (oko pononoći po pacifičkom vremenu)
• 🔑 Alternativno, koristite novi API ključ sa [Google AI Studio](https://aistudio.google.com/apikey)`
                : `🚫 **Daily quota exhausted.** Your API key has hit the free daily limit.

**What to do:**
• 🔗 Enable billing on [Google Cloud Console](https://console.cloud.google.com/billing) for higher limits
• ⏳ Or wait until tomorrow when limits reset (around midnight Pacific Time)
• 🔑 Alternatively, use a new API key from [Google AI Studio](https://aistudio.google.com/apikey)`;
            setMessages(prev => [...prev, { role: 'assistant', content: quotaMsg, timestamp: new Date() }]);
            return;
        }

        if (retryTimerRef.current) clearInterval(retryTimerRef.current);
        setRetryCountdown(seconds);
        pendingRetryRef.current = { text, history };

        retryTimerRef.current = setInterval(() => {
            setRetryCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(retryTimerRef.current);
                    retryTimerRef.current = null;
                    // Auto-resend
                    const pending = pendingRetryRef.current;
                    pendingRetryRef.current = null;
                    if (pending) sendMessageInternal(pending.text, pending.history, true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Internal send (supports retry loop) ───────────────────────────────────
    const sendMessageInternal = useCallback(async (text, existingHistory, isRetry = false) => {
        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyDmT2L5fjmwvQs1HThancNnImhxb9QCGe0';
        if (!apiKey) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: lang === 'bs' ? '⚠️ API ključ nije konfigurisan.' : '⚠️ API key is not configured.',
                timestamp: new Date(),
            }]);
            setIsLoading(false);
            return;
        }

        const newHistory = existingHistory || [...chatHistoryRef.current, { role: 'user', parts: [{ text }] }];
        if (!existingHistory) chatHistoryRef.current = newHistory;

        setIsLoading(true);
        const systemPrompt = buildSystemPrompt(lang, pathname);
        const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash-lite-001'];

        for (let i = 0; i < MODELS.length; i++) {
            try {
                const rawText = await callGemini(MODELS[i], newHistory, systemPrompt, apiKey);
                const reply = rawText || (lang === 'bs' ? 'Nema odgovora.' : 'No response.');
                chatHistoryRef.current = [...newHistory, { role: 'model', parts: [{ text: reply }] }];
                setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: new Date() }]);
                if (isMinimized) setHasNewMessage(true);
                retryAttemptRef.current = 0; // reset on success
                setIsLoading(false);
                return; // success — done
            } catch (err) {
                console.warn(`Model ${MODELS[i]} failed:`, err.message);
                if (err.isRateLimit) {
                    if (i === MODELS.length - 1) {
                        // All models exhausted — show countdown and schedule retry
                        const waitSec = err.retryAfter || 30;
                        const countdownMsg = lang === 'bs'
                            ? `⏳ Dostignut limit besplatnog nivoa. Automatski pokušavam ponovo za **${waitSec}s**...`
                            : `⏳ Free tier rate limit reached. Auto-retrying in **${waitSec}s**...`;
                        setMessages(prev => [...prev, { role: 'assistant', content: countdownMsg, timestamp: new Date(), isRetryMsg: true }]);
                        setIsLoading(false);
                        startRetryCountdown(waitSec, text, newHistory);
                        return;
                    }
                    // Try next model immediately
                    continue;
                }
                // Non-rate-limit error — show it and stop
                const errText = lang === 'bs'
                    ? `⚠️ Greška: ${err.message}`
                    : `⚠️ Error: ${err.message}`;
                setMessages(prev => [...prev, { role: 'assistant', content: errText, timestamp: new Date() }]);
                setIsLoading(false);
                return;
            }
        }
    }, [callGemini, isMinimized, lang, pathname, startRetryCountdown]);

    const sendMessage = useCallback(async (text) => {
        if (!text.trim() || isLoading || retryCountdown > 0) return;
        const userMessage = { role: 'user', content: text.trim(), timestamp: new Date() };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setShowSuggestions(false);
        await sendMessageInternal(text.trim());
    }, [isLoading, retryCountdown, sendMessageInternal]);

    const handleSuggestion = useCallback((suggestion) => {
        sendMessage(suggestion.text);
    }, [sendMessage]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(inputValue);
        }
    }, [inputValue, sendMessage]);

    const handleNavLink = useCallback((path) => {
        router.push(path);
        setIsMinimized(true);
    }, [router]);

    const clearChat = useCallback(() => {
        setMessages([]);
        chatHistoryRef.current = [];
        setShowSuggestions(true);
        // Re-show welcome
        const welcome = lang === 'bs'
            ? `Zdravo! Ja sam **Zia**, vaš AI asistent za eZNR platformu. 👋\n\nŠta vas zanima?`
            : `Hello! I'm **Zia**, your AI assistant for the eZNR platform. 👋\n\nWhat would you like to know?`;
        setMessages([{ role: 'assistant', content: welcome, timestamp: new Date() }]);
    }, [lang]);

    const formatTime = (date) => {
        return date.toLocaleTimeString(lang === 'bs' ? 'bs-BA' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    };

    // ── Render message content with bold and nav links ──────────────────────
    const renderMessageContent = (content) => {
        const parsed = parseResponse(content);
        // Split by nav links
        const parts = parsed.split(/(__NAV_LINK__.*?__END_NAV__)/g);

        return parts.map((part, idx) => {
            if (part.startsWith('__NAV_LINK__')) {
                const inner = part.replace('__NAV_LINK__', '').replace('__END_NAV__', '');
                const [label, path] = inner.split('__');
                return (
                    <button key={idx} onClick={() => handleNavLink(path)} style={chatStyles.navLink}>
                        🔗 {label}
                    </button>
                );
            }
            // Render markdown-ish formatting (bold, bullets)
            return (
                <span key={idx} dangerouslySetInnerHTML={{
                    __html: part
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\n•\s/g, '<br/>• ')
                        .replace(/\n/g, '<br/>')
                }} />
            );
        });
    };

    const suggestions = SUGGESTIONS[lang] || SUGGESTIONS.bs;

    return (
        <>
            {/* ── Floating Action Button ── */}
            <button
                id="ai-assistant-fab"
                onClick={isOpen ? handleClose : handleOpen}
                style={{
                    ...fabStyles.fab,
                    ...(isOpen ? { width: 36, height: 36, bottom: 20, right: 20, boxShadow: '0 2px 10px rgba(0,0,0,0.2)' } : {}),
                    animation: !isOpen && pulseAnimation ? 'aiPulse 2s ease-in-out infinite' : 'none',
                }}
                title={isOpen
                    ? (lang === 'bs' ? 'Zatvori AI asistenta Zia' : 'Close AI assistant Zia')
                    : (lang === 'bs' ? 'Otvori AI asistenta Zia' : 'Open AI assistant Zia')}
            >
                <span style={{ ...fabStyles.fabIcon, fontSize: isOpen ? '0.9rem' : '1.5rem' }}>{isOpen ? '✕' : '✨'}</span>
                {!isOpen && hasNewMessage && <span style={fabStyles.fabBadge} />}
                {!isOpen && <span style={fabStyles.fabLabel}>Zia</span>}
            </button>

            {/* ── Chat Window ── */}
            {isOpen && (
                <div id="ai-assistant-window" style={{
                    ...chatStyles.window,
                    height: isMinimized ? 'auto' : 580,
                }}>
                    {/* Header */}
                    <div style={chatStyles.header}>
                        <div style={chatStyles.headerLeft}>
                            <div style={chatStyles.avatar}>
                                <span style={{ fontSize: '1.2rem' }}>✨</span>
                            </div>
                            <div>
                                <div style={chatStyles.avatarName}>Zia</div>
                                <div style={chatStyles.avatarStatus}>
                                    <span style={{
                                        ...chatStyles.statusDot,
                                        background: retryCountdown > 0 ? '#FF9800' : '#4CAF50',
                                    }} />
                                    {retryCountdown > 0
                                        ? (lang === 'bs' ? `Pokušavam ponovo za ${retryCountdown}s...` : `Retrying in ${retryCountdown}s...`)
                                        : isLoading
                                            ? (lang === 'bs' ? 'Tipka...' : 'Typing...')
                                            : (lang === 'bs' ? 'Online • AI Asistent' : 'Online • AI Assistant')}
                                </div>
                            </div>
                        </div>
                        <div style={chatStyles.headerActions}>
                            <button onClick={clearChat} style={chatStyles.actionBtn} title={lang === 'bs' ? 'Novi razgovor' : 'New conversation'}>↺</button>
                            <button onClick={handleMinimize} style={chatStyles.actionBtn} title={lang === 'bs' ? 'Minimiziraj' : 'Minimize'}>
                                {isMinimized ? '▲' : '▼'}
                            </button>
                            <button onClick={handleClose} style={{ ...chatStyles.actionBtn, ...chatStyles.closeBtn }} title={lang === 'bs' ? 'Zatvori' : 'Close'}>✕</button>
                        </div>
                    </div>

                    {/* Body — hidden when minimized */}
                    {!isMinimized && (
                        <>
                            {/* Messages */}
                            <div style={chatStyles.messages}>
                                {messages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            ...chatStyles.messageRow,
                                            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                        }}
                                    >
                                        {msg.role === 'assistant' && (
                                            <div style={chatStyles.botAvatarSmall}>✨</div>
                                        )}
                                        <div style={{
                                            ...chatStyles.bubble,
                                            ...(msg.role === 'user' ? chatStyles.userBubble : chatStyles.botBubble),
                                        }}>
                                            <div style={chatStyles.bubbleContent}>
                                                {renderMessageContent(msg.content)}
                                            </div>
                                            <div style={chatStyles.timestamp}>{formatTime(msg.timestamp)}</div>
                                        </div>
                                    </div>
                                ))}

                                {/* Loading indicator */}
                                {isLoading && (
                                    <div style={{ ...chatStyles.messageRow, justifyContent: 'flex-start' }}>
                                        <div style={chatStyles.botAvatarSmall}>✨</div>
                                        <div style={{ ...chatStyles.bubble, ...chatStyles.botBubble }}>
                                            <div style={{ display: 'flex', gap: 4, padding: '4px 2px', alignItems: 'center' }}>
                                                <span className="ai-typing-dot" />
                                                <span className="ai-typing-dot" />
                                                <span className="ai-typing-dot" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>

                            {/* Suggestions */}
                            {showSuggestions && messages.length <= 1 && (
                                <div style={chatStyles.suggestions}>
                                    <div style={chatStyles.suggestionsLabel}>
                                        {lang === 'bs' ? 'Česta pitanja:' : 'Quick questions:'}
                                    </div>
                                    <div style={chatStyles.suggestionsGrid}>
                                        {suggestions.map((s, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleSuggestion(s)}
                                                style={chatStyles.suggestionChip}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-glow-strong)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'var(--primary-glow)'}
                                            >
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Input */}
                            <div style={chatStyles.inputArea}>
                                <div style={chatStyles.inputWrapper}>
                                    <textarea
                                        ref={inputRef}
                                        id="ai-assistant-input"
                                        style={chatStyles.input}
                                        placeholder={lang === 'bs' ? 'Postavite pitanje Zia...' : 'Ask Zia a question...'}
                                        value={inputValue}
                                        onChange={e => setInputValue(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        rows={1}
                                        onInput={e => {
                                            e.target.style.height = 'auto';
                                            e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                                        }}
                                    />
                                    <button
                                        id="ai-assistant-send"
                                        onClick={() => sendMessage(inputValue)}
                                        disabled={!inputValue.trim() || isLoading || retryCountdown > 0}
                                        style={{
                                            ...chatStyles.sendBtn,
                                            opacity: (!inputValue.trim() || isLoading || retryCountdown > 0) ? 0.4 : 1,
                                        }}
                                        title={lang === 'bs' ? 'Pošalji' : 'Send'}
                                    >
                                        ➤
                                    </button>
                                </div>
                                <div style={chatStyles.inputFooter}>
                                    {lang === 'bs' ? 'Pokretano sa Google Gemini' : 'Powered by Google Gemini'} ·{' '}
                                    {lang === 'bs' ? 'Enter za slanje' : 'Enter to send'}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── CSS Animations ── */}
            <style>{`
                @keyframes aiPulse {
                    0%, 100% { box-shadow: 0 4px 20px rgba(0,191,166,0.4), 0 0 0 0 rgba(0,191,166,0.4); }
                    50% { box-shadow: 0 4px 20px rgba(0,191,166,0.6), 0 0 0 12px rgba(0,191,166,0); }
                }
                @keyframes aiTyping {
                    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
                    30% { transform: translateY(-6px); opacity: 1; }
                }
                #ai-assistant-input:focus { outline: none; }
                #ai-assistant-fab:hover { transform: scale(1.08) translateY(-2px) !important; }
            `}</style>
        </>
    );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const fabStyles = {
    fab: {
        position: 'fixed',
        bottom: 28,
        right: 28,
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #00BFA6, #009985)',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(0,191,166,0.4)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        gap: 1,
    },
    fabIcon: {
        fontSize: '1.5rem',
        lineHeight: 1,
    },
    fabLabel: {
        fontSize: '0.6rem',
        fontWeight: 700,
        color: 'white',
        fontFamily: 'var(--font-heading)',
        letterSpacing: 0.5,
    },
    fabBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: '#F44336',
        border: '2px solid white',
    },
};

const chatStyles = {
    window: {
        position: 'fixed',
        bottom: 28,
        right: 28,
        zIndex: 999,
        width: 380,
        background: 'white',
        borderRadius: 20,
        boxShadow: '0 20px 60px rgba(11,42,60,0.2), 0 0 0 1px rgba(0,191,166,0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        fontFamily: 'var(--font-body)',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        background: 'linear-gradient(135deg, #0B2A3C, #143d54)',
        flexShrink: 0,
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #00BFA6, #4CAF50)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,191,166,0.4)',
    },
    avatarName: {
        color: 'white',
        fontWeight: 700,
        fontSize: '0.9rem',
        fontFamily: 'var(--font-heading)',
    },
    avatarStatus: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: '0.7rem',
        color: 'rgba(255,255,255,0.6)',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: '#4CAF50',
        flexShrink: 0,
    },
    headerActions: {
        display: 'flex',
        gap: 4,
    },
    actionBtn: {
        width: 28,
        height: 28,
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.15)',
        background: 'rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.7)',
        cursor: 'pointer',
        fontSize: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
        fontWeight: 600,
    },
    closeBtn: {
        background: 'rgba(244,67,54,0.15)',
        borderColor: 'rgba(244,67,54,0.3)',
        color: '#ef9a9a',
    },
    messages: {
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: '#f8fafb',
    },
    messageRow: {
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
    },
    botAvatarSmall: {
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #00BFA6, #4CAF50)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: '0.75rem',
    },
    bubble: {
        maxWidth: '78%',
        padding: '10px 14px',
        borderRadius: 16,
        fontSize: '0.85rem',
        lineHeight: 1.5,
    },
    userBubble: {
        background: 'linear-gradient(135deg, #00BFA6, #009985)',
        color: 'white',
        borderBottomRightRadius: 4,
    },
    botBubble: {
        background: 'white',
        color: '#263238',
        border: '1px solid #eef2f5',
        borderBottomLeftRadius: 4,
        boxShadow: '0 1px 3px rgba(11,42,60,0.06)',
    },
    bubbleContent: {
        wordBreak: 'break-word',
    },
    timestamp: {
        fontSize: '0.65rem',
        opacity: 0.6,
        marginTop: 4,
        textAlign: 'right',
    },
    typingDots: {
        display: 'flex',
        gap: 4,
        padding: '4px 2px',
        '& span': {
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#90A4AE',
            animation: 'aiTyping 1.2s ease-in-out infinite',
        },
    },
    suggestions: {
        padding: '8px 14px 4px',
        background: 'white',
        borderTop: '1px solid #eef2f5',
        flexShrink: 0,
    },
    suggestionsLabel: {
        fontSize: '0.7rem',
        color: '#90A4AE',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    suggestionsGrid: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        maxHeight: 120,
        overflowY: 'auto',
    },
    suggestionChip: {
        padding: '5px 10px',
        borderRadius: 20,
        border: '1px solid rgba(0,191,166,0.3)',
        background: 'rgba(0,191,166,0.08)',
        color: '#009985',
        cursor: 'pointer',
        fontSize: '0.75rem',
        fontWeight: 500,
        fontFamily: 'var(--font-body)',
        transition: 'background 0.15s',
        whiteSpace: 'nowrap',
    },
    inputArea: {
        padding: '10px 14px 12px',
        borderTop: '1px solid #eef2f5',
        flexShrink: 0,
        background: 'white',
    },
    inputWrapper: {
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        background: '#f8fafb',
        border: '2px solid #dde4e9',
        borderRadius: 14,
        padding: '6px 8px 6px 14px',
        transition: 'border-color 0.15s',
    },
    input: {
        flex: 1,
        border: 'none',
        background: 'transparent',
        fontFamily: 'var(--font-body)',
        fontSize: '0.875rem',
        color: '#263238',
        resize: 'none',
        lineHeight: 1.5,
        maxHeight: 100,
        overflow: 'auto',
    },
    sendBtn: {
        width: 34,
        height: 34,
        borderRadius: '50%',
        border: 'none',
        background: 'linear-gradient(135deg, #00BFA6, #009985)',
        color: 'white',
        cursor: 'pointer',
        fontSize: '0.9rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'opacity 0.15s, transform 0.15s',
    },
    inputFooter: {
        fontSize: '0.65rem',
        color: '#90A4AE',
        textAlign: 'center',
        marginTop: 6,
    },
    navLink: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 10px',
        borderRadius: 20,
        border: '1px solid rgba(0,191,166,0.4)',
        background: 'rgba(0,191,166,0.08)',
        color: '#009985',
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontWeight: 600,
        fontFamily: 'var(--font-body)',
        margin: '2px 0',
        transition: 'background 0.15s',
    },
};
