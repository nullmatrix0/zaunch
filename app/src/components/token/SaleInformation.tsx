'use client';

import { Info } from 'lucide-react';
import { Token } from '@/types/token';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { InfoTooltip } from '@/components/ui/info-tooltip';

interface SaleInformationProps {
  token: Token;
}

export function SaleInformation({ token }: SaleInformationProps) {
  const { prices } = useCryptoPrices();
  const amountToSell = Number(token.amountToSell) / Math.pow(10, token.decimals);
  // minAmountToSell is stored in micro-USD (USD * 10^6), not token amount
  const minRaiseUsd = Number(token.minAmountToSell) / 1_000_000;
  const totalClaimed = Number(token.totalClaimed) / Math.pow(10, token.decimals);
  const pricePerToken = Number(token.pricePerToken) / 1e9; // SOL price

  // Calculate raise goal
  const raiseGoal = amountToSell * pricePerToken;
  const currentRaised = totalClaimed * pricePerToken;
  const raiseProgress = amountToSell > 0 ? (totalClaimed / amountToSell) * 100 : 0;

  // Format dates
  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  return (
    <div className="relative w-full backdrop-blur-[2px] bg-[rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.1)] p-px mt-6">
      <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-[#d08700] z-10"></div>
      <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-[#d08700] z-10"></div>
      <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-white z-10"></div>
      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-white z-10"></div>

      <div className="p-4 sm:p-5 md:p-6 flex flex-col gap-4 sm:gap-5 md:gap-6 relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-7 md:gap-8">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-[#d08700] shrink-0"></div>
              <h3 className="font-rajdhani font-bold text-base sm:text-lg md:text-xl lg:text-2xl text-white">
                SALE INFORMATION
              </h3>
            </div>

            {/* Total Raise Goal */}
            <div className="flex flex-col gap-1">
              <span className="font-rajdhani font-medium text-xs sm:text-sm text-gray-300">
                TOTAL RAISE GOAL
              </span>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-rajdhani font-bold text-xl sm:text-2xl text-white">
                  {raiseGoal.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </span>
                <span className="font-rajdhani font-bold text-xs sm:text-sm text-[#d08700]">
                  ZEC
                </span>
              </div>
              <span className="font-rajdhani font-medium text-xs sm:text-sm text-gray-400">
                ≈ $
                {prices.zcash
                  ? (raiseGoal * prices.zcash).toLocaleString('en-US', { maximumFractionDigits: 0 })
                  : '---'}{' '}
                USDC
              </span>
            </div>

            {/* Raise Progress */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-gray-400 font-rajdhani font-medium text-xs sm:text-sm">
                <span>RAISE PROGRESS</span>
                <span>{raiseProgress.toFixed(1)}%</span>
              </div>
              <div className="h-2.5 sm:h-3 bg-gray-800 w-full relative">
                <div
                  className="absolute h-full left-0 bg-gradient-to-r from-[#d08700] to-[#eab308]"
                  style={{ width: `${Math.min(raiseProgress, 100)}%` }}
                ></div>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 text-gray-600 font-rajdhani text-[10px] sm:text-xs md:text-sm">
                <span className="break-words sm:text-left">
                  {totalClaimed.toLocaleString('en-US', { maximumFractionDigits: 0 })}{' '}
                  {token.tokenSymbol}
                </span>
                <span className="text-center sm:text-center px-1">
                  ${minRaiseUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })} MIN.
                </span>
                <span className="text-right sm:text-right break-words">
                  {amountToSell.toLocaleString('en-US', { maximumFractionDigits: 0 })}{' '}
                  {token.tokenSymbol}
                </span>
              </div>
            </div>

            {/* Pool Stats */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 md:gap-6">
              <div className="flex-1 bg-[#1d1b20] p-2.5 sm:p-3 flex flex-col justify-center">
                <span className="font-rajdhani text-xs sm:text-sm text-gray-600">
                  TOKENS IN POOL
                </span>
                <div className="flex flex-wrap items-baseline gap-1">
                  <span className="font-rajdhani font-bold text-xl sm:text-2xl text-white">
                    {amountToSell.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                  <span className="font-rajdhani font-bold text-xs sm:text-sm text-[#d08700]">
                    {token.tokenSymbol}
                  </span>
                </div>
              </div>
              <div className="flex-1 bg-[#1d1b20] p-2.5 sm:p-3 flex flex-col justify-center">
                <div className="flex items-center gap-1">
                  <span className="font-rajdhani text-xs sm:text-sm text-gray-600">
                    Minimum Raise
                  </span>
                  <Info className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-600" />
                </div>
                <div className="flex flex-wrap items-baseline gap-1">
                  <span className="font-rajdhani font-bold text-xl sm:text-2xl text-white">
                    ${minRaiseUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                  <span className="font-rajdhani font-bold text-xs sm:text-sm text-[#d08700]">
                    USD
                  </span>
                </div>
              </div>
            </div>
          </div>
          {/* Token Info List */}
          <div className="flex flex-col gap-3 sm:gap-4 md:gap-5 md:border-l md:pl-5 lg:ml-6 lg:border-white/10 pt-0 lg:pt-0">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 border-b border-white/10 pb-2 sm:pb-1.5">
              <span className="font-rajdhani text-xs sm:text-sm text-white shrink-0">Token Name</span>
              <span className="font-rajdhani font-semibold text-xs sm:text-sm text-white sm:text-right break-words">
                {token.tokenName || token.name}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 border-b border-white/10 pb-2 sm:pb-1.5">
              <span className="font-rajdhani text-xs sm:text-sm text-white shrink-0">Sale Start</span>
              <span className="font-rajdhani font-semibold text-xs sm:text-sm text-white sm:text-right">
                {formatDate(token.startTime)}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 border-b border-white/10 pb-2 sm:pb-1.5">
              <span className="font-rajdhani text-xs sm:text-sm text-white shrink-0">Sale End</span>
              <span className="font-rajdhani font-semibold text-xs sm:text-sm text-white sm:text-right">
                {formatDate(token.endTime)}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-2 border-b border-white/10 pb-2 sm:pb-1.5">
              <span className="font-rajdhani text-xs sm:text-sm text-white shrink-0">Claim Period</span>
              <span className="font-rajdhani font-semibold text-xs sm:text-sm text-white sm:text-right break-words">
                Opens immediately after sales
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 border-b border-white/10 pb-2 sm:pb-1.5">
              <div className="flex items-center gap-1 shrink-0">
                <span className="font-rajdhani text-xs sm:text-sm text-white">Refund Policy</span>
                <InfoTooltip
                  title="Refund Policy"
                  content="Creator Refund: After sale ends, the launch creator can claim unsold tokens via ZK proof verification. The TEE calculates the exact amount of unbought tokens (total supply minus all generated tickets), ensuring creators cannot claim tokens that users have purchased. User Refund: Future feature - if target is not hit, users will be able to use their ticket to get back funds."
                />
              </div>
              <span className="font-rajdhani font-semibold text-xs sm:text-sm text-[#d08700] sm:text-right">Creator Only</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
