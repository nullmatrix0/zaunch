import { Token } from '@/types/token';

interface TokenStatsProps {
  token: Token;
}

export function TokenStats({ token }: TokenStatsProps) {
  const amountToSell = Number(token.amountToSell) / Math.pow(10, token.decimals);
  const totalClaimed = Number(token.totalClaimed) / Math.pow(10, token.decimals);
  const pricePerToken = Number(token.pricePerToken) / 1e9;
  const tokensPerProof = Number(token.tokensPerProof) / Math.pow(10, token.decimals);
  
  const participants = tokensPerProof > 0.001
    ? Math.floor(totalClaimed / tokensPerProof)
    : Math.max(1, Math.floor(totalClaimed / Math.max(pricePerToken, 0.001)));

  const stats = [
    {
      label: `USED AMOUNT${token.tokenSymbol ? `(ZEC)` : ''}`,
      value: totalClaimed.toLocaleString('en-US', { maximumFractionDigits: 0 }),
      borderClass: 'border-l-2 border-l-purple-500',
    },
    {
      label: 'TARGET',
      value: `${amountToSell.toLocaleString('en-US', { maximumFractionDigits: 0 })} ZEC`,
      borderClass: 'border-l-2 border-l-pink-600',
    },
    {
      label: 'TICKET PRICE',
      value: `${pricePerToken.toFixed(0)} ZEC`,
      borderClass: 'border-l-2 border-l-green-500',
    },
    {
      label: 'PARTICIPANTS',
      value: participants.toLocaleString('en-US', { maximumFractionDigits: 0 }),
      borderClass: 'border-l-2 border-l-blue-500/20',
    },
  ];

  return (
    <div className="w-full">
      {/* Mobile: Horizontal scroll */}
      <div className="w-full grid grid-cols-2 gap-3 md:hidden">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`relative shrink-0 w-[140px] sm:w-[160px] md:w-[185px] ${stat.borderClass} bg-[#050505] border-y border-r border-gray-800`}
          >
            <div className="p-3 sm:p-4 flex flex-col gap-1">
              <div className="font-rajdhani text-xs sm:text-sm text-gray-500 leading-tight">
                {stat.label}
              </div>
              <div className="font-rajdhani font-bold text-lg sm:text-xl text-gray-300 leading-tight break-words">
                {stat.value}
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Desktop: Grid layout */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 w-full">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`relative shrink-0 w-[140px] sm:w-[160px] md:w-[185px] ${stat.borderClass} bg-[#050505] border-y border-r border-gray-800`}
          >
            <div className="p-3 md:p-4 flex flex-col gap-1">
              <div className="font-rajdhani text-xs md:text-sm text-gray-500 leading-tight">
                {stat.label}
              </div>
              <div className="font-rajdhani font-bold text-lg md:text-xl text-gray-300 leading-tight break-words">
                {stat.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
