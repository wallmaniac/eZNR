import { Suspense } from 'react';
import './globals.css';
import { LanguageProvider, CountryAutoSwitch } from '@/contexts/LanguageContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { CountryProvider } from '@/contexts/CountryContext';

// App completely relies on client-side state hooks, HTML is static skeleton


export const metadata = {
  title: 'eZNR — Digitalna platforma za zaštitu na radu',
  description: 'eZNR je digitalna platforma za zaštitu na radu i zaštitu od požara u Bosni i Hercegovini. Vodite evidencije, upravljajte dokumentacijom i osigurajte usklađenost sa zakonom.',
  keywords: 'zaštita na radu, zaštita od požara, BiH, Bosna i Hercegovina, eZNR, evidencija, procjena rizika',
  metadataBase: new URL('https://zastitanaradu.ba'),
  openGraph: {
    title: 'eZNR — Digitalna platforma za zaštitu na radu',
    description: 'Vodite evidencije, upravljajte dokumentacijom i osigurajte usklađenost sa zakonom o zaštiti na radu u BiH.',
    url: 'https://zastitanaradu.ba',
    siteName: 'eZNR',
    images: [{ url: '/logo-full.png', width: 1200, height: 630, alt: 'eZNR — Digitalna platforma za zaštitu na radu' }],
    locale: 'bs_BA',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'eZNR — Digitalna platforma za zaštitu na radu',
    description: 'Vodite evidencije, upravljajte dokumentacijom i osigurajte usklađenost sa zakonom o zaštiti na radu u BiH.',
    images: ['/logo-full.png'],
  },
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#121212',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({ children }) {
  return (
    <html lang="bs">
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/logo-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          <ThemeProvider>
            <LanguageProvider>
              <CountryProvider>
                <CountryAutoSwitch />
                <ToastProvider>
                  <Suspense fallback={null}>
                    {children}
                  </Suspense>
                </ToastProvider>
              </CountryProvider>
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

