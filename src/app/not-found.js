// Custom 404 page — overrides Next.js built-in /_not-found
// Simple, no dynamic imports, no context hooks = passes static prerendering
export default function NotFound() {
    return (
        <html lang="bs">
            <body style={{ margin: 0, background: '#0B2A3C', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
                <div style={{ textAlign: 'center', color: 'white' }}>
                    <div style={{ fontSize: '5rem', marginBottom: 16 }}>404</div>
                    <div style={{ fontSize: '1.2rem', opacity: 0.7, marginBottom: 24 }}>Stranica nije pronađena</div>
                    <a href="/dashboard" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 8, background: '#00BFA6', color: 'white', textDecoration: 'none', fontWeight: 700 }}>
                        ← Nazad na Dashboard
                    </a>
                </div>
            </body>
        </html>
    );
}
