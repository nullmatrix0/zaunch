import type { Metadata } from 'next';
import Link from 'next/link';
import { AboutProject } from '@/components/token/AboutProject';
import { AnonymityMetrics } from '@/components/token/AnonymityMetrics';
import { SaleInformation } from '@/components/token/SaleInformation';
import { TokenHeader } from '@/components/token/TokenHeader';
import { TokenStats } from '@/components/token/TokenStats';
import { Tokenomics } from '@/components/token/Tokenomics';
import { TradingInterface } from '@/components/token/TradingInterface';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { PublicKey } from '@solana/web3.js';
import { getLaunchData } from '@/lib/queries';
import { notFound } from 'next/navigation';
import { fetchImageFromUri } from '@/utils';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>;
}): Promise<Metadata> {
  const { address } = await params;

  try {
    const launchPubkey = new PublicKey(address);
    const token = await getLaunchData(launchPubkey);

    if (!token) {
      return {
        title: 'Token Not Found | ZAUNCHPAD',
        description: 'The requested token could not be found.',
      };
    }

    const title = `${token.name} (${token.tokenSymbol}) | ZAUNCHPAD`;
    const description = token.description;
    const image = await fetchImageFromUri(token.tokenUri);

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: image ? [image] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: image ? [image] : undefined,
      },
    };
  } catch (error) {
    return {
      title: 'Invalid Token Address | ZAUNCHPAD',
      description: 'The provided token address is invalid.',
    };
  }
}

export default async function TokenDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;

  let token;
  try {
    const launchPubkey = new PublicKey(address);
    token = await getLaunchData(launchPubkey);

    if (!token) {
      notFound();
    }
  } catch (error) {
    console.error('Error fetching token data:', error);
    notFound();
  }

  return (
    <div className="min-h-screen xl:container mx-auto py-5 px-4 md:px-6 pb-10 md:pb-20 lg:pb-28 xl:pb-40">
      <Breadcrumb className="mb-6">
        <BreadcrumbList className="text-sm">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">EXPLORE</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{token.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 flex flex-col gap-6 max-w-[789px]">
          <TokenHeader token={token} />
          <TokenStats token={token} />
          {
            token.description && (
              <AboutProject token={token} />
            )
          }
          <Tokenomics token={token} />
          <SaleInformation token={token} />
        </div>

        <div className="w-full lg:w-[395px] lg:min-w-[395px] flex flex-col gap-4 sm:gap-5 md:gap-6 shrink-0">
          <TradingInterface token={token} address={address} />
          <AnonymityMetrics />
        </div>
      </div>
    </div>
  );
}
