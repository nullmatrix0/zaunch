import type { Metadata } from 'next';
import QuickLaunch from '@/components/create-token/QuickLaunch';

export const metadata: Metadata = {
  title: 'Create Token - Launch Your Token',
  description:
    'Create and launch your token across multiple blockchains with ZAUNCHPAD. Deploy tokens on Solana, NEAR Protocol, and other supported chains with fair launch mechanisms, bonding curves, and community funding.',
  keywords: [
    'create token',
    'token deployment',
    'token launch',
    'Solana token',
    'NEAR token',
    'cross-chain token',
    'token creation tool',
    'DeFi token',
    'cryptocurrency creation',
    'blockchain token',
    'ZAUNCHPAD',
    'bonding curve',
    'community token',
    'tokenomics',
    'token vesting',
  ],
  openGraph: {
    title: 'Create Token - Launch Your Token Everywhere',
    description:
      'Create and launch your token across multiple blockchains with ZAUNCHPAD. Deploy tokens on Solana, NEAR Protocol, and other supported chains.',
    type: 'website',
    url: 'https://www.zaunchpad.com/create',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ZAUNCHPAD - Create Token Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Create Token - Launch Your Token Everywhere',
    description: 'Create and launch your token across multiple blockchains with ZAUNCHPAD.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: '/create',
  },
};

export default function CreatePage() {
  return <QuickLaunch />;
}
