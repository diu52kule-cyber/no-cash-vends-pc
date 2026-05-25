import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NoCashVends — Dashboard',
  description: 'Cafe & restaurant management',
  // PWA / mobile webapp hints
  manifest: undefined,
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'NoCashVends' },
  formatDetection: { telephone: false },
  themeColor: '#0a0a0c',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover' as const,
  themeColor: '#0a0a0c',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
