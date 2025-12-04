import { LockKeyhole } from 'lucide-react';
import { Token } from '@/types/token';

interface TokenomicsProps {
  token: Token;
}

export function Tokenomics({ token }: TokenomicsProps) {
  const totalSupply = Number(token.totalSupply) / Math.pow(10, token.decimals);
  const amountToSell = Number(token.amountToSell) / Math.pow(10, token.decimals);
  const pricePerToken = Number(token.pricePerToken) / 1e9;

  const salePercentage = ((amountToSell / totalSupply) * 100).toFixed(1);
  const remainingPercentage = 100 - parseFloat(salePercentage);
  const liquidityPercentage = (remainingPercentage * 0.45).toFixed(1);
  const teamPercentage = (remainingPercentage * 0.2).toFixed(1);
  const treasuryPercentage = (remainingPercentage * 0.35).toFixed(1);

  const fdv = totalSupply * pricePerToken;
  const initialMarketCap = amountToSell * pricePerToken;

  return (
    <div className="relative w-full backdrop-blur-[2px] bg-[rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.1)] mt-6">
      {/* Corner Borders */}
      <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-[#d08700] z-10"></div>
      <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-[#d08700] z-10"></div>
      <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-white z-10"></div>
      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-white z-10"></div>

      <div className="p-4 sm:p-5 md:p-6 flex flex-col gap-4 sm:gap-5 md:gap-6">
        {/* Supply & Valuation */}
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-[#d08700]"></div>
            <h3 className="font-rajdhani font-bold text-lg sm:text-xl md:text-2xl text-white">
              SUPPLY & VALUATION
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-rajdhani font-medium text-xs sm:text-sm text-gray-300">
                    IMPLIED FDV
                  </span>
                  {/* Info Icon */}
                </div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-rajdhani font-bold text-xl sm:text-2xl text-[#d08700]">
                    ${fdv.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                  <span className="font-rajdhani text-xs sm:text-sm text-gray-300">
                    (Fully Diluted)
                  </span>
                </div>
                <span className="font-rajdhani font-medium text-xs sm:text-sm text-gray-300">
                  Based on current SOL Price
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-rajdhani font-medium text-xs sm:text-sm text-gray-300">
                  INITIAL MARKET CAP
                </span>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-rajdhani font-bold text-xl sm:text-2xl text-[#d08700]">
                    ${initialMarketCap.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                  <span className="font-rajdhani text-xs sm:text-sm text-gray-300">
                    (Sale only)
                  </span>
                </div>
                <span className="font-rajdhani font-medium text-xs sm:text-sm text-gray-300">
                  Starting market cap at launch
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tokenomics Distribution - Coming Soon */}
        <div className="relative flex flex-col gap-3 sm:gap-4 mt-3 sm:mt-4">
          {/* Coming Soon Overlay */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] z-20 flex items-center justify-center rounded">
            <div className="bg-[rgba(208,135,0,0.15)] border border-[#d08700]/50 px-4 py-2 rounded-md">
              <span className="font-rajdhani font-bold text-sm sm:text-base text-[#d08700] uppercase tracking-wider">
                🚧 Coming Soon
              </span>
            </div>
          </div>

          {/* Grayed out content */}
          <div className="opacity-40 pointer-events-none select-none">
            <div className="flex items-center gap-1">
              <img src="/icons/pie-chart.svg" alt="Pie Chart" className="w-6 h-6 grayscale" />
              <h3 className="font-rajdhani font-bold text-lg sm:text-xl text-gray-500">
                TOKENOMICS DISTRIBUTION
              </h3>
            </div>

            {/* Progress Bar */}
            <div className="relative h-[40px] sm:h-[44px] md:h-[48px] bg-gray-700 w-full overflow-hidden flex text-gray-400 font-rajdhani font-bold text-[10px] sm:text-xs md:text-sm mt-3 sm:mt-4">
              {/* Sale */}
              <div
                className="h-full bg-gray-600 flex items-center justify-center relative min-w-[30px]"
                style={{ width: `${salePercentage}%` }}
              >
                <div className="flex items-center gap-1 z-10 px-1 sm:px-2">
                  <span className="hidden sm:inline">SALE</span>
                  <span className="sm:hidden text-[9px]">S</span>
                </div>
              </div>
              {/* Liquidity */}
              <div
                className="h-full bg-gray-500 flex items-center justify-center relative min-w-[30px]"
                style={{ width: `${liquidityPercentage}%` }}
              >
                <div className="flex items-center gap-1 sm:gap-2 z-10 px-1 sm:px-2">
                  <span className="hidden lg:inline">LIQUIDITY</span>
                  <span className="hidden sm:inline lg:hidden">LIQ</span>
                  <LockKeyhole className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 shrink-0" />
                </div>
              </div>
              {/* Team */}
              <div
                className="h-full bg-gray-600 flex items-center justify-center relative min-w-[30px]"
                style={{ width: `${teamPercentage}%` }}
              >
                <div className="flex items-center gap-1 sm:gap-2 z-10 px-1 sm:px-2">
                  <LockKeyhole className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 shrink-0" />
                </div>
              </div>
              {/* Treasury */}
              <div
                className="h-full bg-gray-700 flex items-center justify-center relative min-w-[30px]"
                style={{ width: `${treasuryPercentage}%` }}
              >
                <div className="flex items-center gap-1 sm:gap-2 z-10 px-1 sm:px-2">
                  <LockKeyhole className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 shrink-0" />
                </div>
              </div>
            </div>

            {/* Legend / Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mt-4">
              {/* Sale Card */}
              <div className="bg-[rgba(100,100,100,0.06)] border border-gray-600 p-2 sm:p-2.5 md:p-3 flex flex-col gap-2 sm:gap-2.5 md:gap-3">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gray-600"></div>
                  <span className="font-rajdhani font-bold text-xs sm:text-sm text-gray-500">
                    SALE
                  </span>
                </div>
                <div className="font-rajdhani font-bold text-xl sm:text-2xl text-gray-400">
                  {salePercentage}%
                </div>
                <div className="font-rajdhani font-medium text-xs sm:text-sm text-gray-500 break-words">
                  {amountToSell.toLocaleString('en-US', { maximumFractionDigits: 0 })}{' '}
                  {token.tokenSymbol}
                </div>
              </div>
              {/* Liquidity Card */}
              <div className="bg-[rgba(100,100,100,0.06)] border border-gray-600 p-2 sm:p-2.5 md:p-3 flex flex-col gap-2 sm:gap-2.5 md:gap-3">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gray-500"></div>
                  <span className="font-rajdhani font-bold text-xs sm:text-sm text-gray-500">
                    LIQUIDITY
                  </span>
                </div>
                <div className="font-rajdhani font-bold text-xl sm:text-2xl text-gray-400">
                  {liquidityPercentage}%
                </div>
                <div className="font-rajdhani font-medium text-xs sm:text-sm text-gray-500 break-words">
                  DEX pools
                </div>
              </div>
              {/* Team Card */}
              <div className="bg-[rgba(100,100,100,0.06)] border border-gray-600 p-2 sm:p-2.5 md:p-3 flex flex-col gap-2 sm:gap-2.5 md:gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gray-600"></div>
                    <span className="font-rajdhani font-bold text-xs sm:text-sm text-gray-500">
                      TEAM
                    </span>
                  </div>
                  <LockKeyhole className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                </div>
                <div className="font-rajdhani font-bold text-xl sm:text-2xl text-gray-400">
                  {teamPercentage}%
                </div>
                <div className="font-rajdhani font-medium text-xs sm:text-sm text-gray-500 break-words">
                  Vesting
                </div>
              </div>
              {/* Treasury Card */}
              <div className="bg-[rgba(100,100,100,0.06)] border border-gray-600 p-2 sm:p-2.5 md:p-3 flex flex-col gap-2 sm:gap-2.5 md:gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gray-700"></div>
                    <span className="font-rajdhani font-bold text-xs sm:text-sm text-gray-500">
                      TREASURY
                    </span>
                  </div>
                  <LockKeyhole className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                </div>
                <div className="font-rajdhani font-bold text-xl sm:text-2xl text-gray-400">
                  {treasuryPercentage}%
                </div>
                <div className="font-rajdhani font-medium text-xs sm:text-sm text-gray-500 break-words">
                  Future Growth
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
