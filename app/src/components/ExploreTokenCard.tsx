'use client';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { formatNumberToCurrency, formatTinyPrice } from '@/utils';
import { triggerProgressBar } from './layout/PageProgressBar';
import { useCallback, useEffect, useState } from 'react';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { CalendarClock } from 'lucide-react';

interface ExploreTokenCardProps {
  id: string;
  mint: string;
  decimals: number;
  totalSupply: string | number;
  tokenUri: string;
  name: string;
  symbol: string;
  description: string;
  className?: string;
  // Launch-specific data
  pricePerToken?: number | bigint;
  pricePerTicket?: number | bigint;
  totalTickets?: number | bigint;
  tokensPerProof?: number | bigint;
  amountToSell?: number | bigint;
  minAmountToSell?: number | bigint;
  totalClaimed?: number | bigint;
  verifiedProofsCount?: number | bigint;  // On-chain ticket claims
  startTime?: string | number | bigint;
  endTime?: string | number | bigint;
}

export default function ExploreTokenCard({
  mint,
  decimals,
  totalSupply,
  tokenUri,
  name,
  symbol,
  description,
  className,
  pricePerToken = 0,
  pricePerTicket = 0,
  totalTickets = 0,
  tokensPerProof = 0,
  amountToSell = 0,
  minAmountToSell = 0,
  totalClaimed = 0,
  verifiedProofsCount = 0,
  startTime,
  endTime,
}: ExploreTokenCardProps) {
  const navigate = useRouter();
  const { prices } = useCryptoPrices();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const fetchTokenUri = useCallback(async () => {
    try {
      const re = await fetch(tokenUri);
      const data = await re.json();
      setImageUrl(data.image);
    } catch (e) {
      return null;
    }
  }, [tokenUri]);

  useEffect(() => {
    fetchTokenUri();
  }, [fetchTokenUri]);

  const totalClaimedNum =
    typeof totalClaimed === 'bigint' ? Number(totalClaimed) : totalClaimed || 0;
  const amountToSellNum =
    typeof amountToSell === 'bigint' ? Number(amountToSell) : amountToSell || 0;
  const pricePerTokenNum =
    typeof pricePerToken === 'bigint' ? Number(pricePerToken) : pricePerToken || 0;
  const pricePerTicketNum =
    typeof pricePerTicket === 'bigint' ? Number(pricePerTicket) : pricePerTicket || 0;
  const totalTicketsNum =
    typeof totalTickets === 'bigint' ? Number(totalTickets) : totalTickets || 0;

  // Use ON-CHAIN data for tickets claimed (verifiedProofsCount)
  // This persists across TEE redeployments
  const verifiedProofsNum = typeof verifiedProofsCount === 'bigint' ? Number(verifiedProofsCount) : verifiedProofsCount || 0;
  const ticketsClaimed = verifiedProofsNum;
  const ticketsLeft = Math.max(0, totalTicketsNum - ticketsClaimed);

  const sold = totalClaimedNum / 10 ** decimals;
  const goal = amountToSellNum / 10 ** decimals;
  
  // Calculate progress based on tickets claimed vs total tickets
  const progressPercent = totalTicketsNum > 0 ? (ticketsClaimed / totalTicketsNum) * 100 : 0;

  // pricePerTicket is in micro-USD (USD * 10^6)
  const ticketPriceUsd = pricePerTicketNum / 1_000_000;
  
  // Convert USD price to ZEC price  
  const zecPrice = prices.zcash || 30; // fallback
  const ticketPriceZec = ticketPriceUsd / zecPrice;

  // pricePerToken is in micro-USD (USD * 10^6), NOT lamports
  const pricePerTokenUsd = pricePerTokenNum / 1_000_000;
  const priceInZec = pricePerTokenUsd / zecPrice;
  const priceInUsd = pricePerTokenUsd;

  // Calculate goal in ZEC (total tickets * ticket price)
  const goalInUsd = totalTicketsNum * ticketPriceUsd;
  const goalInZec = zecPrice > 0 ? goalInUsd / zecPrice : 0;
  
  // Calculate sold in ZEC
  const soldInUsd = ticketsClaimed * ticketPriceUsd;
  const soldInZec = zecPrice > 0 ? soldInUsd / zecPrice : 0;

  // Helper function to parse time value (handles bigint, string, number)
  const parseTime = (time: any): number => {
    if (typeof time === 'bigint') {
      return Number(time) * 1000;
    } else if (typeof time === 'string') {
      const parsed = Number(time);
      if (!isNaN(parsed)) {
        return parsed * 1000;
      } else {
        return new Date(time).getTime();
      }
    } else {
      return Number(time) * 1000;
    }
  };

  // Check if token is in claim period
  const isInClaimPeriod = (): boolean => {
    if (!endTime) return false;
    const now = Date.now();
    const end = parseTime(endTime);
    return now > end;
  };

  const getStatus = () => {
    if (!startTime || !endTime) return { label: 'SALE LIVE', color: '#34c759' };
    const now = Date.now();
    const start = parseTime(startTime);
    const end = parseTime(endTime);

    if (now < start) {
      return { label: 'UPCOMING', color: '#3b82f6' };
    } else if (now >= start && now <= end) {
      return { label: 'SALE LIVE', color: '#34c759' };
    } else if (isInClaimPeriod()) {
      return { label: 'CLAIM LIVE', color: '#d08700' };
    } else {
      return { label: 'ENDED', color: '#ef4444' };
    }
  };

  const status = getStatus();

  // Calculate claim type: Vested or Immediate based on time (similar to status)
  const getClaimType = (): { label: 'Vested' | 'Immediate'; color: string } => {
    if (!endTime) return { label: 'Immediate', color: '#34c759' };
    
    const now = Date.now();
    const end = parseTime(endTime);

    if (now > end) {
      return { label: 'Vested', color: '#475569' };
    } else {
      return { label: 'Immediate', color: '#34c759' };
    }
  };

  const claimType = getClaimType();

  return (
    <motion.div
      whileHover={{
        scale: 1.02,
        y: -4,
        transition: { duration: 0.2, ease: 'easeOut' },
      }}
      whileTap={{
        scale: 0.98,
        transition: { duration: 0.1, ease: 'easeIn' },
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`backdrop-blur-[2px] backdrop-filter bg-[#000000] border border-[rgba(255,255,255,0.1)] border-solid relative cursor-pointer w-full max-w-[408px] ${className}`}
    >
      <div className="h-full overflow-hidden relative">
        {/* Corner decorations */}
        <div className="absolute border-[#d08700] border-b-0 border-l-2 border-r-0 border-solid border-t-2 left-[-0.33px] w-[14px] h-[14px] top-[-0.33px]" />
        <div className="absolute border-[#d08700] border-b-0 border-l-0 border-r-2 border-solid border-t-2 right-[-0.33px] w-[14px] h-[14px] top-[-0.33px]" />
        <div className="absolute border-[#d08700] border-b-2 border-l-2 border-r-0 border-solid border-t-0 bottom-[-0.33px] left-[-0.33px] w-[14px] h-[14px]" />
        <div className="absolute border-[#d08700] border-b-2 border-l-0 border-r-2 border-solid border-t-0 bottom-[-0.33px] right-[-0.33px] w-[14px] h-[14px]" />

        {/* Card Content - Using flex instead of absolute positioning */}
        <div className="p-4 sm:p-5 flex flex-col gap-4">
          {/* Header: Logo + Badges */}
          <div className="flex items-start justify-between gap-2">
            <div className="border border-[rgba(255,255,255,0.1)] border-solid rounded-[7px] w-12 h-12 sm:w-14 sm:h-14 shrink-0 overflow-hidden">
              {imageUrl && (
                <motion.img
                  src={imageUrl}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
              <div className="border border-solid box-border flex items-center px-2 sm:px-3 py-1 shrink-0" style={{ borderColor: status.color }}>
                <span className="font-rajdhani font-medium text-xs sm:text-sm leading-none" style={{ color: status.color }}>
                  {status.label}
                </span>
              </div>
              <div className="bg-[rgba(248,250,252,0.06)] border border-solid box-border flex gap-1 items-center px-2 sm:px-3 py-1 shrink-0" style={{ borderColor: claimType.color }}>
                <CalendarClock className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" style={{ color: claimType.color }} strokeWidth={1.5} />
                <span className="font-rajdhani font-medium text-xs sm:text-sm leading-none" style={{ color: claimType.color }}>
                  {claimType.label}
                </span>
              </div>
            </div>
          </div>

          {/* Token Name & Symbol */}
          <div className="flex flex-col gap-0.5">
            <h3 className="font-rajdhani font-bold text-lg sm:text-xl md:text-2xl text-white leading-tight truncate">{name}</h3>
            <span className="font-rajdhani font-medium text-sm text-[#d08700] leading-tight">${symbol}</span>
          </div>

          {/* Description - 2 lines max */}
          <div className="min-h-[36px]">
            <p className="font-rajdhani text-xs sm:text-sm text-gray-400 leading-[1.4] line-clamp-2">
              {description || 'No description available'}
            </p>
          </div>

          {/* Stats Box */}
          <div className="border border-[rgba(255,255,255,0.09)] border-solid box-border flex flex-col gap-3 sm:gap-4 p-3 sm:p-4">
            {/* Raised / Goal */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-rajdhani text-xs text-gray-500 uppercase">Raised</span>
                <span className="font-rajdhani text-xs text-gray-500 uppercase">Goal</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="font-rajdhani font-bold text-white text-sm sm:text-base">
                    {formatNumberToCurrency(soldInZec)} ZEC
                  </span>
                  {prices.zcash && soldInUsd > 0 && (
                    <span className="font-rajdhani text-xs text-gray-500">${formatNumberToCurrency(soldInUsd)}</span>
                  )}
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-rajdhani font-bold text-white text-sm sm:text-base">
                    {formatNumberToCurrency(goalInZec)} ZEC
                  </span>
                  {prices.zcash && goalInUsd > 0 && (
                    <span className="font-rajdhani text-xs text-gray-500">${formatNumberToCurrency(goalInUsd)}</span>
                  )}
                </div>
              </div>
              {/* Progress Bar */}
              <div className="bg-gray-800 h-1.5 sm:h-2 w-full overflow-hidden relative rounded-sm">
                <div
                  className="bg-[#d08700] h-full relative transition-all duration-300"
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                >
                  <div className="absolute bg-white right-0 top-0 bottom-0 w-[2px] shadow-[0px_0px_8px_0px_#ffffff]" />
                </div>
              </div>
            </div>

            {/* Tickets Info */}
            <div className="border-t border-[rgba(255,255,255,0.1)] pt-3 flex items-center justify-between gap-2">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-rajdhani text-xs text-gray-500 uppercase">Tickets Sold</span>
                <span className="font-rajdhani font-bold text-[#d08700] text-sm sm:text-base">
                  {ticketsClaimed.toLocaleString('en-US')}/{totalTicketsNum.toLocaleString('en-US')}
                </span>
              </div>
              <div className="flex flex-col gap-1 items-end shrink-0">
                <span className="font-rajdhani text-xs text-gray-500 uppercase">Price per Ticket</span>
                <span className="font-rajdhani font-bold text-white text-sm sm:text-base">
                  ${ticketPriceUsd.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              triggerProgressBar();
              navigate.push(`/token/${mint}`);
            }}
            className="w-full bg-transparent border-2 border-[#d08700] border-solid box-border flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 cursor-pointer hover:bg-[#d08700]/10 transition-colors"
          >
            <svg
              width="20"
              height="20"
              fill="none"
              stroke="#d08700"
              viewBox="0 0 24 24"
              className="w-4 h-4 sm:w-5 sm:h-5 shrink-0"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
            <span className="font-share-tech-mono text-xs sm:text-sm text-[#d08700] text-center tracking-wider uppercase">
              VIEW PROTOCOL
            </span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
