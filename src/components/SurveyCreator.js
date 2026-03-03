'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/* ═══════════════════════════════════════════════════════
   SurveyJS Creator Component — SSR-safe wrapper
   Dynamically loads SurveyJS Creator and renders it
   ═══════════════════════════════════════════════════════ */

export default function SurveyCreatorWidget({ json, onJsonChange }) {
    const [CreatorComponent, setCreatorComponent] = useState(null);
    const [creator, setCreator] = useState(null);
    const [error, setError] = useState(null);
    const initDone = useRef(false);

    useEffect(() => {
        if (initDone.current) return;
        initDone.current = true;

        async function loadSurveyJS() {
            try {
                // Dynamic imports — SSR safe
                const [creatorCoreModule, creatorReactModule] = await Promise.all([
                    import('survey-creator-core'),
                    import('survey-creator-react'),
                    import('survey-core/survey-core.min.css'),
                    import('survey-creator-core/survey-creator-core.min.css'),
                ]);

                const SurveyCreatorModel = creatorCoreModule.SurveyCreatorModel;

                // Create the creator instance
                const creatorInstance = new SurveyCreatorModel({
                    showLogicTab: true,
                    showJSONEditorTab: true,
                    showTranslationTab: false,
                    isAutoSave: true,
                });

                // Load existing JSON
                try {
                    const parsed = typeof json === 'string' ? JSON.parse(json || '{}') : (json || {});
                    creatorInstance.JSON = parsed.pages ? parsed : { pages: [{ name: 'page1', elements: [] }] };
                } catch {
                    creatorInstance.JSON = { pages: [{ name: 'page1', elements: [] }] };
                }

                // Auto-save callback
                creatorInstance.saveSurveyFunc = (saveNo, callback) => {
                    if (onJsonChange) {
                        onJsonChange(JSON.stringify(creatorInstance.JSON, null, 2));
                    }
                    callback(saveNo, true);
                };

                setCreator(creatorInstance);
                setCreatorComponent(() => creatorReactModule.SurveyCreatorComponent);
            } catch (err) {
                console.error('SurveyJS Creator load error:', err);
                setError(err.message);
            }
        }

        loadSurveyJS();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (error) {
        return (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚠️</div>
                <div>Failed to load Survey Creator: {error}</div>
            </div>
        );
    }

    if (!creator || !CreatorComponent) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: 500, color: 'var(--text-muted)', flexDirection: 'column', gap: 12,
            }}>
                <div className="loading-spinner" style={{
                    width: 36, height: 36,
                    border: '3px solid var(--border)',
                    borderTopColor: 'var(--primary)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                }} />
                <div style={{ fontSize: '0.9rem' }}>Loading SurveyJS Creator...</div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <div style={{ minHeight: 500 }}>
            <CreatorComponent creator={creator} />
        </div>
    );
}
