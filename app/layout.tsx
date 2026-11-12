import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, Inter } from 'next/font/google';
import './globals.css';

const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Rep: Strength & Running Ledger',
  description: 'A minimalist training ledger for lifters who run. Fast logging, honest insights, works offline.',
  applicationName: 'Rep',
  appleWebApp: { capable: true, title: 'Rep', statusBarStyle: 'default' },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://rep.example.com'),
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FFFFFF',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${inter.variable}`} style={{ background: '#ffffff' }}>
      <body suppressHydrationWarning>
        <div className="app-frame">
          <div className="app-root">{children}</div>
        </div>
      </body>
    </html>
  );
}
