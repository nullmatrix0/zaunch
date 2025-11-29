import type { Metadata } from 'next';
import { AboutProject } from '@/components/token/AboutProject';
import { AnonymityMetrics } from '@/components/token/AnonymityMetrics';
import { SaleInformation } from '@/components/token/SaleInformation';
import { TokenHeader } from '@/components/token/TokenHeader';
import { TokenStats } from '@/components/token/TokenStats';
import { Tokenomics } from '@/components/token/Tokenomics';
import { TradingInterface } from '@/components/token/TradingInterface';


// Force dynamic rendering since we're fetching data from external API
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>;
}): Promise<Metadata> {
  const { address } = await params;

  // Dummy token for metadata
  const token = {
    name: 'DarkFi DEX',
    symbol: 'DARK',
    description: 'DarkFi DEX utilizes Multi-Party Computation (MPC) to enable swaps without revealing trade size or direction until execution.',
    metadata: {
        tokenUri: '',
        bannerUri: ''
    }
  };

  const title = `${token.name} (${token.symbol}) | ZAUNCHPAD`;
  const description = token.description;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function TokenDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  
  // Dummy data for design preview
  const token = {
    name: 'DarkFi DEX',
    symbol: 'DARK',
    description: 'DarkFi DEX utilizes Multi-Party Computation (MPC) to enable swaps without revealing trade size or direction until execution. The protocol creates a dark pool effect for all assets. DARK token holders capture protocol fees. This launch aims to bootstrap the initial liquidity pools.',
    metadata: {
      tokenUri: '/images/broken-pot.png', // Placeholder
      bannerUri: '/images/broken-pot.png', // Placeholder
    }
  };

  return (
    <div className="min-h-screen xl:container mx-auto py-10 px-4 md:px-6">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main Column */}
        <div className="flex-1 flex flex-col gap-6 max-w-[789px]">
           <TokenHeader token={token} address={address} />
           <TokenStats />
           <AboutProject />
           <Tokenomics />
           <SaleInformation />
        </div>

        {/* Sidebar Column */}
        <div className="w-full lg:w-[395px] flex flex-col gap-6 shrink-0">
           <TradingInterface token={token} address={address} />
           <AnonymityMetrics />
        </div>
      </div>
    </div>
  );
}
