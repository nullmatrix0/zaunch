'use client';

import type { PublicKey } from '@solana/web3.js';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { getTokenBalanceOnSOL } from '@/lib/sol';
import { formatNumberToCurrency } from '@/utils';
import { triggerProgressBar } from './layout/PageProgressBar';

interface MyTokenCardProps {
  id: string;
  mint: string;
  user: PublicKey;
  decimals: number;
  totalSupply: string | number;
  tokenUri: string;
  name: string;
  symbol: string;
  description: string;
  className?: string;
  pricePerToken?: number | bigint;
  amountToSell?: number | bigint;
  minAmountToSell?: number | bigint;
  totalClaimed?: number | bigint;
  startTime?: string | number | bigint;
  endTime?: string | number | bigint;
}

export function MyTokenCard({
  mint,
  user,
  decimals,
  totalSupply,
  tokenUri,
  name,
  symbol,
  description,
  className,
  pricePerToken = 0,
  amountToSell = 0,
  minAmountToSell = 0,
  totalClaimed = 0,
  startTime,
  endTime,
}: MyTokenCardProps) {
  const navigate = useRouter();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);

  const fetchTokenUri = useCallback(async () => {
    try {
      const re = await fetch(tokenUri);
      const data = await re.json();
      setImageUrl(data.image);
    } catch (e) {
      return null;
    }
  }, [tokenUri]);

  const getStatus = () => {
    if (!startTime || !endTime) return { label: 'LIVE', color: '#34c759' };

    const now = Date.now();

    let start: number;
    let end: number;

    if (typeof startTime === 'bigint') {
      start = Number(startTime) * 1000;
    } else if (typeof startTime === 'string') {
      const parsed = Number(startTime);
      if (!isNaN(parsed)) {
        start = parsed * 1000;
      } else {
        start = new Date(startTime).getTime();
      }
    } else {
      start = Number(startTime) * 1000;
    }

    if (typeof endTime === 'bigint') {
      end = Number(endTime) * 1000;
    } else if (typeof endTime === 'string') {
      const parsed = Number(endTime);
      if (!isNaN(parsed)) {
        end = parsed * 1000;
      } else {
        end = new Date(endTime).getTime();
      }
    } else {
      end = Number(endTime) * 1000;
    }

    if (now < start) {
      return { label: 'UPCOMING', color: '#3b82f6' };
    } else if (now >= start && now <= end) {
      return { label: 'LIVE', color: '#34c759' };
    } else {
      return { label: 'ENDED', color: '#ef4444' };
    }
  };

  const status = getStatus();

  const fetchBalanceToken = useCallback(async () => {
    const balance = await getTokenBalanceOnSOL(mint, user?.toBase58() || '');
    setBalance(balance);
  }, [mint, user]);

  useEffect(() => {
    fetchTokenUri();
    fetchBalanceToken();
  }, [fetchTokenUri, fetchBalanceToken]);

  const supply = typeof totalSupply === 'string' ? parseFloat(totalSupply) : totalSupply;
  const totalClaimedNum =
    typeof totalClaimed === 'bigint' ? Number(totalClaimed) : totalClaimed || 0;
  const amountToSellNum =
    typeof amountToSell === 'bigint' ? Number(amountToSell) : amountToSell || 0;
  const pricePerTokenNum =
    typeof pricePerToken === 'bigint' ? Number(pricePerToken) : pricePerToken || 0;

  const sold = totalClaimedNum / 10 ** decimals;
  const goal = amountToSellNum / 10 ** decimals;
  const progressPercent = goal > 0 ? (sold / goal) * 100 : 0;

  const priceInSol = pricePerTokenNum / 1e9;

  const allocation = goal;

  const canClaim = status.label === 'LIVE' || status.label === 'ENDED';
  const isLocked = status.label === 'UPCOMING';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`backdrop-blur-[2px] bg-[#0a0a0a] border border-[rgba(255,255,255,0.1)] relative w-full ${className}`}
    >
      <div className="overflow-hidden relative">
        {/* Corner decorations */}
        <div className="absolute border-[#d08700] border-b-0 border-l-2 border-r-0 border-solid border-t-2 left-[0.67px] w-[14px] h-[14px] top-[0.67px]" />
        <div className="absolute border-[#d08700] border-b-0 border-l-0 border-r-2 border-solid border-t-2 right-[0.67px] w-[14px] h-[14px] top-[0.67px]" />
        <div className="absolute border-[rgba(245,245,245,0.3)] border-b-2 border-l-2 border-r-0 border-solid border-t-0 bottom-[0.67px] left-[0.67px] w-[14px] h-[14px]" />
        <div className="absolute border-[rgba(245,245,245,0.3)] border-b-2 border-l-0 border-r-2 border-solid border-t-0 bottom-[0.67px] right-[0.67px] w-[14px] h-[14px]" />

        <div className="flex flex-col gap-4 p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3 md:gap-4 flex-1">
              <div className="bg-[#301342] border border-[rgba(20,184,166,0.5)] rounded-lg w-12 h-12 md:w-14 md:h-14 flex items-center justify-center shrink-0">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <span className="text-white font-bold text-xl font-rajdhani">
                    {name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5 md:gap-2 flex-1 min-w-0">
                <div className="flex flex-col">
                  <h3 className="font-rajdhani font-bold text-lg md:text-xl text-white leading-tight truncate">
                    {name}
                  </h3>
                  <span className="font-rajdhani font-medium text-sm md:text-base text-gray-400 leading-tight">
                    ${symbol}
                  </span>
                </div>
                <div className="bg-[rgba(208,135,0,0.15)] border border-[rgba(208,135,0,0.15)] rounded px-2 py-1 w-fit">
                  <span className="font-rajdhani font-medium text-xs md:text-sm text-[#d08700]">
                    {formatNumberToCurrency(sold)} {symbol} SOLD
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 md:gap-2 ml-0 md:ml-4">
                <div className="font-rajdhani font-medium text-xs md:text-sm text-[#d08700]">
                  TOTAL ALLOCATION
                </div>
                <div className="flex items-end gap-2 md:gap-3">
                  <div className="font-rajdhani font-bold text-xl md:text-2xl text-[#d08700] leading-tight">
                    {formatNumberToCurrency(allocation)}
                  </div>
                  <div className="font-rajdhani font-medium text-xs md:text-sm text-[#d08700] leading-tight pb-0.5">
                    {symbol}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-row md:flex-col gap-2 md:gap-2.5 items-start md:items-end">
              <div
                className={`border rounded px-2 py-1 flex items-center gap-1.5 ${
                  status.label === 'LIVE'
                    ? 'border-[#16a34a] bg-transparent'
                    : status.label === 'ENDED'
                      ? 'border-gray-400 bg-transparent'
                      : 'border-[#3b82f6] bg-transparent'
                }`}
              >
                {status.label === 'LIVE' && (
                  <div className="w-1.5 h-1.5 bg-[#16a34a] rounded-full"></div>
                )}
                <span
                  className={`font-rajdhani font-medium text-xs md:text-sm ${
                    status.label === 'LIVE'
                      ? 'text-[#16a34a]'
                      : status.label === 'ENDED'
                        ? 'text-gray-400'
                        : 'text-[#3b82f6]'
                  }`}
                >
                  {status.label === 'LIVE'
                    ? 'SALES LIVE'
                    : status.label === 'ENDED'
                      ? 'SALES ENDED'
                      : 'UPCOMING'}
                </span>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  triggerProgressBar();
                  navigate.push(`/token/${mint}`);
                }}
                className={`border rounded flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 h-9 md:h-10 cursor-pointer ${
                  isLocked
                    ? 'border-[rgba(229,229,229,0.3)] bg-transparent'
                    : 'border-[rgba(208,135,0,0.15)] bg-[rgba(208,135,0,0.15)]'
                }`}
                disabled={isLocked}
              >
                <LockKeyhole
                  className={`w-3.5 h-3.5 md:w-4 md:h-4 ${
                    isLocked ? 'text-[rgba(229,229,229,0.7)]' : 'text-[#d08700]'
                  }`}
                />
                <span
                  className={`font-rajdhani font-bold text-xs md:text-sm ${
                    isLocked ? 'text-[rgba(229,229,229,0.7)]' : 'text-[#d08700]'
                  }`}
                >
                  {isLocked ? 'LOCKED' : 'VIEW POOL'}
                </span>
              </motion.button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="font-rajdhani text-sm text-gray-500">
                Sold: {formatNumberToCurrency(sold)} {symbol}
              </span>
              <span className="font-rajdhani text-sm text-gray-500">
                Goal: {formatNumberToCurrency(goal)} {symbol}
              </span>
            </div>
            <div className="bg-[rgba(72,72,72,0.6)] h-[7px] relative overflow-hidden">
              <div
                className="bg-[#d08700] h-full relative transition-all duration-300"
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              >
                <div className="absolute bg-white bottom-0 right-0 shadow-[0px_0px_10px_0px_#ffffff] top-0 w-[3.5px]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
