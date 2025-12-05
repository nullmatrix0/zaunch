'use client';

import { Token } from '@/types/token';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';

interface TokenStatsProps {
  token: Token;
}

export function TokenStats({ token }: TokenStatsProps) {
  const { prices } = useCryptoPrices();

  const zecPrice = prices.zcash || 30; // fallback to $30 if not available
  
  // Ticket price in USD (stored as micro-USD)
  const ticketPriceUSD = Number(token.pricePerTicket) / 1e6;
  const ticketPriceZEC = ticketPriceUSD / zecPrice;
  
  // Tokens per ticket
  const tokensPerTicket = Number(token.tokensPerProof) / Math.pow(10, token.decimals);
  
  // Total tickets for the sale
  const totalTickets = Number(token.totalTickets);
  
  // Use ON-CHAIN data for tickets sold (verified_proofs_count = successful claims)
  // This persists across TEE redeployments
  const ticketsClaimed = Number(token.verifiedProofsCount || 0);
  
  // Tickets remaining
  const ticketsLeft = Math.max(0, totalTickets - ticketsClaimed);
  
  // Calculate target in ZEC (total tickets * ticket price)
  const targetUSD = totalTickets * ticketPriceUSD;
  const targetZEC = targetUSD / zecPrice;

  const stats = [
    {
      label: 'TICKET PRICE',
      value: `${ticketPriceZEC.toFixed(6)} ZEC`,
      subValue: `~$${ticketPriceUSD.toFixed(2)}`,
      borderClass: 'border-l-2 border-l-green-500',
    },
    {
      label: 'TARGET',
      value: `${targetZEC.toLocaleString('en-US', { maximumFractionDigits: 4 })} ZEC`,
      subValue: `~$${targetUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
      borderClass: 'border-l-2 border-l-pink-600',
    },
    {
      label: 'TOKENS/TICKET',
      value: tokensPerTicket.toLocaleString('en-US', { maximumFractionDigits: 2 }),
      subValue: token.tokenSymbol,
      borderClass: 'border-l-2 border-l-purple-500',
    },
    {
      label: 'TICKETS CLAIMED',
      value: ticketsClaimed === 0 ? 'None' : ticketsClaimed.toLocaleString('en-US'),
      subValue: `${ticketsLeft} left of ${totalTickets}`,
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
