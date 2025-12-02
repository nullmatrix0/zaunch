import { Token } from '@/types/token';

interface TokenStatsProps {
  token: Token;
}

export function TokenStats({ token }: TokenStatsProps) {
  const totalSupply = Number(token.totalSupply) / Math.pow(10, token.decimals);
  const amountToSell = Number(token.amountToSell) / Math.pow(10, token.decimals);
  const totalClaimed = Number(token.totalClaimed) / Math.pow(10, token.decimals);
  const pricePerToken = Number(token.pricePerToken) / 1e9;

  const stats = [
    {
      label: 'TOTAL CLAIMED',
      value: totalClaimed.toLocaleString('en-US', { maximumFractionDigits: 2 }),
      borderClass: 'border-l-2 border-l-purple-500',
    },
    {
      label: 'AMOUNT TO SELL',
      value: `${amountToSell.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${token.tokenSymbol}`,
      borderClass: 'border-l-2 border-l-pink-600',
    },
    {
      label: 'PRICE PER TOKEN',
      value: `${pricePerToken.toFixed(6)} SOL`,
      borderClass: 'border-l-2 border-l-green-500',
    },
    {
      label: 'TOTAL SUPPLY',
      value: totalSupply.toLocaleString('en-US', { maximumFractionDigits: 0 }),
      borderClass: 'border-l-2 border-l-blue-500/20',
    },
  ];

  return (
    <div className="flex gap-2 sm:gap-3 md:gap-4 w-full overflow-x-auto pb-2 scrollbar-hide">
      {stats.map((stat, index) => (
        <div
          key={index}
          className={`relative shrink-0 w-[140px] sm:w-[160px] md:w-[185px] ${stat.borderClass} bg-[#050505] border-y border-r border-gray-800`}
        >
          <div className="p-3 sm:p-3.5 md:p-4 flex flex-col gap-1">
            <div className="font-rajdhani text-xs sm:text-sm text-gray-500 leading-tight">
              {stat.label}
            </div>
            <div className="font-rajdhani font-bold text-base sm:text-lg md:text-xl text-gray-300 break-words">
              {stat.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
