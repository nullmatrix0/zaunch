'use client';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { getIpfsUrl } from '@/lib/utils';
import { formatNumberToCurrency } from '@/utils';
import { triggerProgressBar } from './layout/PageProgressBar';

interface ExploreTokenCardProps {
  id: string;
  mint: string;
  decimals: number;
  totalSupply: string | number;
  banner: string;
  avatar: string;
  name: string;
  symbol: string;
  description: string;
  actionButton: {
    text: string;
    variant: 'presale' | 'curve' | 'trade';
  };
  className?: string;
  // Launch-specific data
  pricePerToken?: number;
  amountToSell?: number;
  minAmountToSell?: number;
  totalClaimed?: number;
}

export default function ExploreTokenCard({
  mint,
  decimals,
  totalSupply,
  banner,
  avatar,
  name,
  symbol,
  description,
  actionButton,
  className,
  pricePerToken = 0,
  amountToSell = 0,
  minAmountToSell = 0,
  totalClaimed = 0,
}: ExploreTokenCardProps) {
  const navigate = useRouter();

  // Calculate progress based on launch data
  const supply = typeof totalSupply === 'string' ? parseFloat(totalSupply) : totalSupply;
  const sold = totalClaimed / (10 ** decimals); // Convert from raw amount
  const goal = amountToSell / (10 ** decimals); // Convert from raw amount
  const progressPercent = goal > 0 ? (sold / goal) * 100 : 0;

  // Price in lamports to SOL (assuming pricePerToken is in lamports)
  const priceInSol = pricePerToken / 1e9;

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
          <div className="border border-[rgba(255,255,255,0.1)] rounded-[7px] w-14 h-14">
            <motion.img
              src={getIpfsUrl(avatar)}
              alt={name}
              className="w-full h-full object-cover rounded-[7px]"
            />
          </div>
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
          <div className="flex justify-between">
            <span className="font-rajdhani text-sm text-gray-500">
              Sold: {formatNumberToCurrency(sold)} {symbol}
            </span>
            <span className="font-rajdhani text-sm text-gray-500">
              Goal: {formatNumberToCurrency(goal)} {symbol}
            </span>
          </div>
          <div className="bg-gray-800 h-[7px] relative overflow-hidden">
            <div
              className="bg-[#d08700] h-full relative transition-all duration-300"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            >
              <div className="absolute bg-white bottom-0 right-0 shadow-[0px_0px_10px_0px_#ffffff] top-0 w-[3.5px]" />
            </div>
            <div className="absolute inset-0 opacity-20" />
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
            <span className="font-rajdhani text-sm text-gray-400">
              {priceInSol.toFixed(6)} SOL
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 text-gray-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <span className="font-rajdhani text-sm text-gray-400">
              {formatNumberToCurrency(supply)}
            </span>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            triggerProgressBar();
            navigate.push(`/token/${mint}`);
          }}
          className="absolute left-[21.67px] right-[21.66px] top-[316.33px] bg-transparent border-2 border-[#d08700] px-6 py-3 flex items-center justify-center gap-2 cursor-pointer"
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
