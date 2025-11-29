'use client';

import type { PublicKey } from '@solana/web3.js';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getPoolStateByMint } from '@/lib/api';
import { getTokenBalanceOnSOL } from '@/lib/sol';
import {
  calculateTokenPrice,
  formatNumberToCurrency,
  formatPriceChange,
} from '@/utils';
import { triggerProgressBar } from './layout/PageProgressBar';

interface MyTokenCardProps {
  id: string;
  mint: string;
  user: PublicKey;
  decimals: number;
  banner: string;
  avatar: string;
  name: string;
  symbol: string;
  description: string;
  solPrice: number;
  actionButton: {
    text: string;
    variant: 'presale' | 'curve' | 'trade';
  };
  className?: string;
}

export function MyTokenCard({
  mint,
  user,
  decimals,
  banner,
  avatar,
  name,
  symbol,
  description,
  solPrice,
  actionButton,
  className,
}: MyTokenCardProps) {
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange24h, setPriceChange24h] = useState<number>(0);
  const [balance, setBalance] = useState<number>(0);
  const [isLoadingPrice, setIsLoadingPrice] = useState<boolean>(true);

  const fetchBalanceToken = useCallback(async () => {
    const balance = await getTokenBalanceOnSOL(mint, user?.toBase58() || '');
    setBalance(balance);
  }, [mint, user]);

  const fetchTokenPrice = useCallback(async () => {
    try {
      setIsLoadingPrice(true);
      const poolState = await getPoolStateByMint(mint);
      const priceData = calculateTokenPrice(poolState, decimals, solPrice);
      setCurrentPrice(priceData.priceInSol);

      setPriceChange24h(0);
    } catch (error) {
      console.error('Error fetching token price:', error);
      setCurrentPrice(0);
      setPriceChange24h(0);
    } finally {
      setIsLoadingPrice(false);
    }
  }, [mint, solPrice]);

  useEffect(() => {
    fetchBalanceToken();
    fetchTokenPrice();
  }, [fetchBalanceToken, fetchTokenPrice]);

  const router = useRouter();

  const getActionButtonStyle = (variant: string) => {
    switch (variant) {
      case 'presale':
        return 'bg-red-500 hover:bg-red-600';
      case 'curve':
        return 'bg-red-500 hover:bg-red-600';
      case 'trade':
        return 'bg-red-500 hover:bg-red-600';
      default:
        return 'bg-red-500 hover:bg-red-600';
    }
  };

  const value = balance * currentPrice * solPrice || 0;

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
      className={`backdrop-blur-[2px] bg-[#000000] border border-[rgba(255,255,255,0.1)] h-[384px] relative cursor-pointer w-full max-w-[408px] ${className}`}
    >
      <div className="h-full overflow-hidden relative">
        {/* Corner decorations */}
        <div className="absolute border-[#d08700] border-b-0 border-l-2 border-r-0 border-solid border-t-2 left-[0.67px] w-[14px] h-[14px] top-[0.67px]" />
        <div className="absolute border-[#d08700] border-b-0 border-l-0 border-r-2 border-solid border-t-2 right-[0.67px] w-[14px] h-[14px] top-[0.67px]" />
        <div className="absolute border-[#d08700] border-b-2 border-l-2 border-r-0 border-solid border-t-0 bottom-[0.67px] left-[0.67px] w-[14px] h-[14px]" />
        <div className="absolute border-[#d08700] border-b-2 border-l-0 border-r-2 border-solid border-t-0 bottom-[0.67px] right-[0.67px] w-[14px] h-[14px]" />

        <div className="absolute left-[21.67px] right-[21.66px] top-[21.67px] flex items-start justify-between">
          <div className="border border-[rgba(255,255,255,0.1)] rounded-[7px] w-14 h-14" />
          <div className="border border-[#34c759] px-[11.167px] py-[4.167px]">
            <span className="font-rajdhani font-medium text-sm text-[#34c759]">Active</span>
          </div>
        </div>

        <div className="absolute left-[21.67px] right-[21.66px] top-[98.67px]">
          <h3 className="font-rajdhani font-bold text-2xl text-white leading-[28px]">{name}</h3>
        </div>

        <div className="absolute left-[21.67px] right-[21.66px] top-[130.17px]">
          <span className="font-rajdhani font-medium text-sm text-[#d08700]">${symbol}</span>
        </div>

        <div className="absolute left-[21.67px] right-[21.66px] top-[161.67px] h-[35px] overflow-hidden">
          <p className="font-rajdhani text-sm text-gray-400 leading-[17.5px] line-clamp-2">
            {description}
          </p>
        </div>

        <div className="absolute left-[21.67px] right-[21.66px] top-[217.67px] flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center flex flex-col">
              <span className="font-rajdhani font-bold text-sm text-white">
                {formatNumberToCurrency(balance)} {symbol}
              </span>
              <span className="font-rajdhani text-xs text-gray-500">Your Balance</span>
            </div>
            <div className="text-center flex flex-col">
              {isLoadingPrice ? (
                <span className="font-rajdhani font-bold text-sm text-white">...</span>
              ) : (
                <span className="font-rajdhani font-bold text-sm text-white">
                  ${formatNumberToCurrency(value)}
                </span>
              )}
              <span className="font-rajdhani text-xs text-gray-500">Value</span>
            </div>
            <div className="text-center flex flex-col">
              {isLoadingPrice ? (
                <span className="font-rajdhani font-bold text-sm text-white">...</span>
              ) : (
                <span
                  className={`font-rajdhani font-bold text-sm ${
                    priceChange24h > 0
                      ? 'text-green-500'
                      : priceChange24h < 0
                        ? 'text-red-500'
                        : 'text-white'
                  }`}
                >
                  {formatPriceChange(priceChange24h)}
                </span>
              )}
              <span className="font-rajdhani text-xs text-gray-500">24h Change</span>
            </div>
          </div>
        </div>

        <div className="absolute left-[21.67px] right-[21.66px] top-[266.67px] border-t border-[rgba(255,255,255,0.05)] pt-[14.667px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 text-gray-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                <rect x="9" y="9" width="6" height="6" strokeWidth="1.5" />
              </svg>
            </div>
            <span className="font-rajdhani text-sm text-gray-400">12 ZEC</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 text-gray-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <span className="font-rajdhani text-sm text-gray-400">420</span>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            triggerProgressBar();
            router.push(`/token/${mint}`);
          }}
          className="absolute left-[21.67px] right-[21.66px] top-[316.33px] bg-transparent border-2 border-[#d08700] px-6 py-3 flex items-center justify-center gap-2"
        >
          <svg
            width="20"
            height="20"
            fill="none"
            stroke="#d08700"
            viewBox="0 0 24 24"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
          <span className="font-share-tech-mono text-sm text-[#d08700] uppercase tracking-[0.7px]">
            VIEW Pool
          </span>
        </motion.button>
      </div>
    </motion.div>
  );
}
