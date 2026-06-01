'use client';
export default function DashboardLoading() {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: '60vh', width: '100%',
        }}>
            <div style={{ textAlign: 'center' }}>
                <div className="loading-spinner" style={{
                    width: 40, height: 40, border: '3px solid var(--border-light)',
                    borderTopColor: 'var(--primary)', borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
                }} />
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
