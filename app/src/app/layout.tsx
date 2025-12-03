import type { Metadata } from 'next';
import { Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import { Suspense } from 'react';
import { Toaster } from 'sonner';
import WalletContextProvider from '@/contexts/WalletProviderContext';
import { Footer } from '../components/layout/Footer';
import Header from '../components/layout/Header';
import { Notification } from '../components/layout/Notification';
import { PageProgressBar } from '../components/layout/PageProgressBar';
import { Warning } from '../components/layout/Warning';

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'ZAUNCHPAD - Privacy-First Token Launchpad',
    template: '%s | ZAUNCHPAD',
  },
  description:
    'Privacy-first cross-chain token launchpad enabling anonymous participation in crypto token launches using Zcash shielded pools. Create, launch, and manage tokens across multiple blockchains with zero-knowledge proofs.',
  keywords: [
    'token launch',
    'cryptocurrency',
    'blockchain',
    'privacy',
    'anonymous',
    'Zcash',
    'zero-knowledge',
    'Solana',
    'Layer Zero',
    'cross-chain',
    'DeFi',
    'token creation',
    'IDO',
    'web3',
    'decentralized',
  ],
  authors: [{ name: 'Zaunchpad', url: 'https://app.zaunchpad.com' }],
  creator: 'Zaunchpad',
  publisher: 'Zaunchpad',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://app.zaunchpad.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://app.zaunchpad.com',
    siteName: 'ZAUNCHPAD',
    title: 'ZAUNCHPAD - Privacy-First Token Launchpad',
    description:
      'Privacy-first cross-chain token launchpad enabling anonymous participation using Zcash shielded pools. Create, launch, and manage tokens with zero-knowledge proofs.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ZAUNCHPAD - Privacy-first cross-chain token launch platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@zaunchpad',
    creator: '@zaunchpad',
    title: 'ZAUNCHPAD - Privacy-First Token Launchpad',
    description:
      'Privacy-first cross-chain token launchpad enabling anonymous participation using Zcash shielded pools.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  category: 'technology',
  classification: 'Cryptocurrency, Blockchain, DeFi, Token Launch Platform',
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'ZAUNCHPAD',
    'application-name': 'ZAUNCHPAD',
    'msapplication-TileColor': '#000000',
    'msapplication-config': '/browserconfig.xml',
    'theme-color': '#000000',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ZAUNCHPAD" />
        <meta name="application-name" content="ZAUNCHPAD" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
      </head>
      <body className={`${spaceGrotesk.variable} antialiased`}>
        <Suspense fallback={null}>
          <PageProgressBar />
        </Suspense>
        <Analytics />
        <WalletContextProvider>
          <Header />
          <Warning />
          <Notification />
          <div className='pt-24'>
            {children}
          </div>
          <Footer />
          <Toaster
            position="bottom-right"
            theme="dark"
            toastOptions={{
              style: {
                background: '#050505',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontFamily: 'var(--font-rajdhani), sans-serif',
              },
              className: 'font-rajdhani',
              descriptionClassName: 'text-gray-400',
              actionButtonStyle: {
                background: '#d08700',
                color: 'black',
              },
            }}
          />
        </WalletContextProvider>
      </body>
    </html>
  );
}
