import type { Metadata, Viewport } from 'next';
import ServiceWorker from '@/components/ServiceWorker';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ultra100',
  description: '100 km — 2 oktober 2027.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Ultra100', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EFEEE8' },
    { media: '(prefers-color-scheme: dark)', color: '#151814' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/* Zet het thema vóór de eerste verf, anders knippert de app. Leest een expliciete
   keuze uit localStorage; zonder keuze blijft prefers-color-scheme leidend. */
const themeScript = `try{var t=localStorage.getItem('ultra100-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
