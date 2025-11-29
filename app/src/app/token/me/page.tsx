import type { Metadata } from 'next';
import MyTokensClient from '@/components/token/MyTokensClient';
import { getSolPrice } from '@/lib/sol';

// Force dynamic rendering since we're fetching data from external API
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const title = 'My Portfolio | Zaunchpad';
  const description =
    "View and manage all the tokens you've created on Zaunchpad. Track your portfolio performance and manage your token launches.";

  // Create structured data for better SEO
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'My Portfolio - ZAUNCHPAD',
    description: description,
    url: 'https://www.zaunchpad.com/me',
    isPartOf: {
      '@type': 'WebSite',
      name: 'ZAUNCHPAD',
      url: 'https://www.zaunchpad.com',
    },
    provider: {
      '@type': 'Organization',
      name: 'ZAUNCHPAD',
      url: 'https://www.zaunchpad.com',
    },
  };

  return {
    title,
    description,
    keywords: [
      'portfolio',
      'my tokens',
      'token management',
      'cryptocurrency portfolio',
      'token creator',
      'DeFi',
      'Solana',
      'token dashboard',
      'ZAUNCHPAD',
    ],
    authors: [{ name: 'ZAUNCHPAD' }],
    creator: 'ZAUNCHPAD',
    publisher: 'ZAUNCHPAD',
    robots: {
      index: false, // Private page, don't index
      follow: false,
    },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: 'https://www.zaunchpad.com/me',
      title,
      description,
      siteName: 'ZAUNCHPAD',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: 'ZAUNCHPAD My Portfolio',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@zaunchpad',
      creator: '@zaunchpad',
      title,
      description,
      images: ['/og-image.png'],
    },
    alternates: {
      canonical: 'https://www.zaunchpad.com/me',
    },
    other: {
      'application/ld+json': JSON.stringify(structuredData),
    },
  };
}

export default async function MyTokensPage() {
  // Fetch initial data server-side
  let solPrice: number = 0;

  try {
    const fetchedSolPrice = await getSolPrice();
    solPrice = fetchedSolPrice || 0;
  } catch (error) {
    console.error('Error fetching initial data:', error);
    solPrice = 0;
  }

  return <MyTokensClient solPrice={solPrice} />;
}
