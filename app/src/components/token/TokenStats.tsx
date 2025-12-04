'use client';

import { Token } from '@/types/token';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { TEE_ENDPOINT } from '@/configs/env.config';
import useSWR from 'swr';

interface TokenStatsProps {
  token: Token;
}

interface LaunchStats {
  launch_id: string;
  tickets_created: number;
  shielded_value_usd: string;
  total_tokens_sold: number;
}

const fetcher = (url: string) => fetch(url).then(res => res.ok ? res.json() : null);

export function TokenStats({ token }: TokenStatsProps) {
  const { prices } = useCryptoPrices();
  
  // Fetch launch-specific stats from TEE for participant count
  const { data: launchStats } = useSWR<LaunchStats>(
    token.name ? `${TEE_ENDPOINT}/launches/${token.name}/stats` : null,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: false }
  );

  const amountToSell = Number(token.amountToSell) / Math.pow(10, token.decimals);
  const totalClaimed = Number(token.totalClaimed) / Math.pow(10, token.decimals);
  
  // Price per token is in micro-USD (USD * 10^6), convert to USD
  const pricePerTokenUSD = Number(token.pricePerToken) / 1e6;
  
  // Calculate target in USD, then convert to ZEC
  const targetUSD = amountToSell * pricePerTokenUSD;
  const zecPrice = prices.zcash || 30; // fallback to $30 if not available
  const targetZEC = targetUSD / zecPrice;
  
  // Get participants from TEE stats (tickets_created = proofs generated for this launch)
  const participants = launchStats?.tickets_created ?? 0;

  // Format price nicely - handle very small prices
  const formatPrice = (price: number): string => {
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    if (price >= 0.0001) return `$${price.toFixed(6)}`;
    // For very small prices like $0.0000495, show as ~$0.0{4}95
    const str = price.toFixed(10);
    const match = str.match(/0\.(0+)(\d+)/);
    if (match) {
      const zeros = match[1].length;
      const significantDigits = match[2].slice(0, 2);
      return `~$0.0{${zeros}}${significantDigits}`;
    }
    return `$${price.toExponential(2)}`;
  };

  const stats = [
    {
      label: 'TOKEN PRICE',
      value: formatPrice(pricePerTokenUSD),
      subValue: 'per token',
      borderClass: 'border-l-2 border-l-green-500',
    },
    {
      label: 'TARGET',
      value: `${targetZEC.toLocaleString('en-US', { maximumFractionDigits: 4 })} ZEC`,
      subValue: `~$${targetUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
      borderClass: 'border-l-2 border-l-pink-600',
    },
    {
      label: 'TOKENS SOLD',
      value: totalClaimed.toLocaleString('en-US', { maximumFractionDigits: 0 }),
      subValue: token.tokenSymbol,
      borderClass: 'border-l-2 border-l-purple-500',
    },
    {
      label: 'PARTICIPANTS',
      value: participants.toLocaleString('en-US', { maximumFractionDigits: 0 }),
      subValue: launchStats ? 'tickets generated' : 'loading...',
      borderClass: 'border-l-2 border-l-blue-500',
    },
  ];

  return (
    <div className="w-full">
      {/* Mobile: Grid layout - 2 columns for 4 items */}
      <div className="w-full grid grid-cols-2 gap-2 sm:hidden">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`relative ${stat.borderClass} bg-[#050505] border-y border-r border-gray-800`}
          >
            <div className="p-2 sm:p-3 flex flex-col gap-0.5">
              <div className="font-rajdhani text-[10px] sm:text-xs text-gray-500 leading-tight">
                {stat.label}
              </div>
              <div className="font-rajdhani font-bold text-sm sm:text-base text-gray-300 leading-tight break-words">
                {stat.value}
              </div>
              {stat.subValue && (
                <div className="font-rajdhani text-[10px] text-gray-500 leading-tight">
                  {stat.subValue}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* Desktop: Grid layout - 4 columns */}
      <div className="hidden sm:grid sm:grid-cols-4 gap-3 md:gap-4 w-full">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`relative ${stat.borderClass} bg-[#050505] border-y border-r border-gray-800`}
          >
            <div className="p-3 md:p-4 flex flex-col gap-1">
              <div className="font-rajdhani text-xs md:text-sm text-gray-500 leading-tight">
                {stat.label}
              </div>
              <div className="font-rajdhani font-bold text-lg md:text-xl text-gray-300 leading-tight break-words">
                {stat.value}
              </div>
              {stat.subValue && (
                <div className="font-rajdhani text-xs text-gray-500 leading-tight">
                  {stat.subValue}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
