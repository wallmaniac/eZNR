'use client';
export const dynamic = 'force-dynamic';

// Custom global error page — must be a client component per Next.js requirement
// Simple implementation to avoid workUnitAsyncStorage prerender bug
export default function GlobalError({ error, reset }) {
    return (
        <html lang="bs">
            <body style={{ margin: 0, background: '#0B2A3C', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
                <div style={{ textAlign: 'center', color: 'white', maxWidth: 480, padding: 24 }}>
                    <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 8 }}>Došlo je do greške</div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.6, marginBottom: 24 }}>Aplikacija je naišla na neočekivani problem.</div>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <button onClick={() => reset()} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#00BFA6', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                            Pokušaj ponovo
                        </button>
                        <a href="/dashboard" style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', color: 'white', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
                            ← Dashboard
                        </a>
                    </div>
                </div>
            </body>
        </html>
    );
}
