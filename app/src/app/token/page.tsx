import type { Metadata } from 'next';
import TokenSearch from '@/components/token/TokenSearch';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const title = 'Token Launchpad | ZAUNCHPAD';
    const description = `Discover and participate in token launches on ZAUNCHPAD. Support projects you believe in and explore the latest cryptocurrency tokens.`;

    // Create structured data for better SEO
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'ZAUNCHPAD Token Launchpad',
      description: description,
      url: 'https://www.zaunchpad.com/token',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://www.zaunchpad.com/token?q={search_term_string}',
        'query-input': 'required name=search_term_string',
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
        'token launchpad',
        'cryptocurrency',
        'token launch',
        'DeFi',
        'Solana',
        'token trading',
        'crypto projects',
        'token discovery',
        'ZAUNCHPAD',
      ],
      authors: [{ name: 'ZAUNCHPAD' }],
      creator: 'ZAUNCHPAD',
      publisher: 'ZAUNCHPAD',
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
      openGraph: {
        type: 'website',
        locale: 'en_US',
        url: 'https://www.zaunchpad.com/token',
        title,
        description,
        siteName: 'ZAUNCHPAD',
        images: [
          {
            url: '/og-image.png',
            width: 1200,
            height: 630,
            alt: 'ZAUNCHPAD Token Launchpad',
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
        canonical: 'https://www.zaunchpad.com/token',
      },
      other: {
        'application/ld+json': JSON.stringify(structuredData),
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);

    // Fallback metadata
    return {
      title: 'Token Launchpad | ZAUNCHPAD',
      description:
        'Discover and participate in token launches on ZAUNCHPAD. Support projects you believe in and explore the latest cryptocurrency tokens.',
      openGraph: {
        title: 'Token Launchpad | ZAUNCHPAD',
        description:
          'Discover and participate in token launches on ZAUNCHPAD. Support projects you believe in and explore the latest cryptocurrency tokens.',
        images: [
          {
            url: '/og-image.png',
            width: 1200,
            height: 630,
            alt: 'ZAUNCHPAD Token Launchpad',
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Token Launchpad | ZAUNCHPAD',
        description:
          'Discover and participate in token launches on ZAUNCHPAD. Support projects you believe in and explore the latest cryptocurrency tokens.',
        images: ['/og-image.png'],
      },
    };
  }
}

export default async function TokenPage() {
  return (
    <div className="min-h-screen pt-10 pb-20">
      <div className="container mx-auto px-4 lg:px-6">
        <div className="flex flex-col gap-[54px] mb-12">
          <div className="flex flex-col gap-2">
            <h1 className="font-rajdhani font-bold text-[31.5px] leading-[35px] text-white">
              EXPLORE LAUNCHES
            </h1>
            <p className="font-share-tech-mono text-sm text-gray-400 leading-[21px]">
              Verified encrypted sales. Capital secured by math.
            </p>
          </div>
        </div>

        <TokenSearch />
      </div>
    </div>
  );
}
