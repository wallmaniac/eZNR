import './globals.css';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider } from '@/contexts/AuthContext';

export const metadata = {
  title: 'eZNR - Digitalna platforma za zaštitu na radu',
  description: 'eZNR je digitalna platforma za zaštitu na radu i zaštitu od požara u Bosni i Hercegovini. Vodite evidencije, upravljajte dokumentacijom i osigurajte usklađenost sa zakonom.',
  keywords: 'zaštita na radu, zaštita od požara, BiH, Bosna i Hercegovina, eZNR, evidencija, procjena rizika',
};

export default function RootLayout({ children }) {
  return (
    <html lang="bs">
      <head>
        <link rel="icon" href="/logo-icon.png" />
      </head>
      <body>
        <AuthProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
