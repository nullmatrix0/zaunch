'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Token } from '@/types/token';
import { X, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type PoolType = 'BALANCED' | 'ONE_SIDED';

export interface PoolConfig {
  type: PoolType;
  baseAmount: number;
  quoteAmount?: number; // Optional calling code needs to handle this
  initPrice: number;
  maxPrice?: number; // Only for One-Sided
  baseFeeMode: number;
  rateLimiterParam?: {
    baseFeeBps: number;
    feeIncrementBps: number;
    referenceAmount: number;
    maxLimiterDuration: number;
    maxFeeBps: number;
  };

  startFee?: number;
  endFee?: number;
  feeDuration?: number;
}

interface CreatePoolModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: Token;
  onConfirm: (config: PoolConfig) => void;
}

export function CreatePoolModal({ open, onOpenChange, token, onConfirm }: CreatePoolModalProps) {
  const [poolType, setPoolType] = useState<PoolType>('BALANCED');
  const [baseAmount, setBaseAmount] = useState<string>('');
  const [quoteAmount, setQuoteAmount] = useState<string>('');
  const [initPrice, setInitPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [startFee, setStartFee] = useState<string>('1.0');
  const [endFee, setEndFee] = useState<string>('0.1');
  const [feeDuration, setFeeDuration] = useState<string>('3600'); // Default 1 hour
  const [showAdvancedConfig, setShowAdvancedConfig] = useState<boolean>(false);

  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [solBalance, setSolBalance] = useState<number>(0);
  const [tokenBalance, setTokenBalance] = useState<number>(0);

  // Base Fee Mode State
  const [baseFeeMode, setBaseFeeMode] = useState<number>(2);

  // Rate Limiter Params
  const [rateLimiterBaseFeeBps, setRateLimiterBaseFeeBps] = useState<string>('1.2');
  const [rateLimiterFeeIncrementBps, setRateLimiterFeeIncrementBps] = useState<string>('1.0');
  const [rateLimiterReferenceAmount, setRateLimiterReferenceAmount] = useState<string>('1');
  const [rateLimiterMaxFeeBps, setRateLimiterMaxFeeBps] = useState<string>('50');

  // Reset fields when pool type changes or modal opens
  useEffect(() => {
    if (open) {
      setBaseAmount('');
      setQuoteAmount('');
      setInitPrice('');
      setMaxPrice('');
      setStartFee('1.0');
      setEndFee('0.1');
      setFeeDuration('3600');
      setBaseFeeMode(2);
      setRateLimiterBaseFeeBps('1.2');
      setRateLimiterFeeIncrementBps('1.0');
      setRateLimiterReferenceAmount('1');
      setRateLimiterMaxFeeBps('50');
      setShowAdvancedConfig(false);
      fetchBalances();
    }
  }, [open, poolType]);

  const fetchBalances = async () => {
    if (!publicKey || !connection) return;

    try {
      // Fetch SOL Balance
      const balance = await connection.getBalance(publicKey);
      setSolBalance(balance / 1e9); // Convert lamports to SOL

      // Fetch Token Balance
      if (token.tokenMint) {
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
          mint: new PublicKey(token.tokenMint),
        });

        if (tokenAccounts.value.length > 0) {
          const amount = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
          setTokenBalance(amount || 0);
        } else {
          setTokenBalance(0);
        }
      }
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  };

  const formatNumber = (val: string) => {
    if (!val) return '';
    const parts = val.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const cleanNumber = (val: string) => {
    return val.replace(/,/g, '');
  };

  const handleNumberInput = (value: string, setter: (val: string) => void) => {
    // Remove existing commas to check validity and re-format
    const raw = value.replace(/,/g, '');
    const sanitized = raw.replace(/[^\d.]/g, '');
    const parts = sanitized.split('.');
    // Limit to one decimal point and format with commas
    const clean = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : sanitized;
    const formatted = formatNumber(clean);
    setter(formatted);
  };

  const handleConfirm = () => {
    const base = parseFloat(cleanNumber(baseAmount));
    const price = parseFloat(cleanNumber(initPrice));

    // Fee Scheduler Params (for mode 0 & 1)
    const start = parseFloat(cleanNumber(startFee));
    const end = parseFloat(cleanNumber(endFee));
    const duration = parseInt(cleanNumber(feeDuration));

    // Rate Limiter Params (for mode 2)
    const rlBaseFee = parseFloat(cleanNumber(rateLimiterBaseFeeBps));
    const rlFeeIncrement = parseFloat(cleanNumber(rateLimiterFeeIncrementBps));
    const rlRefAmount = parseFloat(cleanNumber(rateLimiterReferenceAmount));
    const rlMaxFee = parseFloat(cleanNumber(rateLimiterMaxFeeBps));

    // Common validations for base amount & price
    if (isNaN(base) || base <= 0 || isNaN(price) || price <= 0) return;

    // Mode-specific validation
    if (baseFeeMode === 0 || baseFeeMode === 1) {
      if (isNaN(start) || start < 0 || isNaN(end) || end < 0 || isNaN(duration) || duration <= 0)
        return;
    } else {
      // Rate Limiter validation
      if (
        isNaN(rlBaseFee) ||
        rlBaseFee < 0 ||
        isNaN(rlFeeIncrement) ||
        rlFeeIncrement < 0 ||
        isNaN(rlRefAmount) ||
        rlRefAmount <= 0 ||
        isNaN(rlMaxFee) ||
        rlMaxFee < 0
      )
        return;
    }

    // Balance Validation
    if (base > tokenBalance) {
      toast.error(`Insufficient ${token.tokenSymbol} balance`);
      return;
    }

    const networkFeeBuffer = 0.01; // SOL buffer for fees

    if (poolType === 'BALANCED') {
      const quote = parseFloat(cleanNumber(quoteAmount));
      if (isNaN(quote) || quote <= 0) return;

      if (quote + networkFeeBuffer > solBalance) {
        toast.error('Insufficient SOL balance');
        return;
      }
    } else {
      // For One-Sided, we just need enough SOL for fees
      if (networkFeeBuffer > solBalance) {
        toast.error('Insufficient SOL balance for network fees');
        return;
      }
    }

    const commonConfig: any = {
      baseAmount: base,
      initPrice: price,
      baseFeeMode,
    };

    if (baseFeeMode === 0 || baseFeeMode === 1) {
      commonConfig.startFee = start;
      commonConfig.endFee = end;
      commonConfig.feeDuration = duration;
    } else {
      commonConfig.rateLimiterParam = {
        baseFeeBps: rlBaseFee,
        feeIncrementBps: rlFeeIncrement,
        referenceAmount: rlRefAmount,
        maxLimiterDuration: duration,
        maxFeeBps: rlMaxFee,
      };
    }

    if (poolType === 'BALANCED') {
      const quote = parseFloat(cleanNumber(quoteAmount));
      if (isNaN(quote) || quote <= 0) return;

      onConfirm({
        type: 'BALANCED',
        quoteAmount: quote,
        ...commonConfig,
      });
    } else {
      const max = parseFloat(cleanNumber(maxPrice));
      if (isNaN(max) || max <= 0) return;

      onConfirm({
        type: 'ONE_SIDED',
        maxPrice: max,
        ...commonConfig,
      });
    }
    onOpenChange(false);
  };

  const isValid = () => {
    const base = parseFloat(cleanNumber(baseAmount));
    const price = parseFloat(cleanNumber(initPrice));

    // Fee Scheduler Validations
    const start = parseFloat(cleanNumber(startFee));
    const end = parseFloat(cleanNumber(endFee));
    const duration = parseInt(cleanNumber(feeDuration));

    // Rate Limiter Validations
    const rlBaseFee = parseFloat(cleanNumber(rateLimiterBaseFeeBps));
    const rlFeeIncrement = parseFloat(cleanNumber(rateLimiterFeeIncrementBps));
    const rlRefAmount = parseFloat(cleanNumber(rateLimiterReferenceAmount));
    const rlMaxFee = parseFloat(cleanNumber(rateLimiterMaxFeeBps));

    const isCommonValid = !isNaN(base) && base > 0 && !isNaN(price) && price > 0;

    let isFeeConfigValid = false;
    if (baseFeeMode === 0 || baseFeeMode === 1) {
      isFeeConfigValid =
        !isNaN(start) && start >= 0 && !isNaN(end) && end >= 0 && !isNaN(duration) && duration > 0;
    } else {
      isFeeConfigValid =
        !isNaN(rlBaseFee) &&
        rlBaseFee >= 0 &&
        !isNaN(rlFeeIncrement) &&
        rlFeeIncrement >= 0 &&
        !isNaN(rlRefAmount) &&
        rlRefAmount > 0 &&
        !isNaN(rlMaxFee) &&
        rlMaxFee >= 0;
    }

    if (poolType === 'BALANCED') {
      const quote = parseFloat(cleanNumber(quoteAmount));
      return isCommonValid && !isNaN(quote) && quote > 0 && isFeeConfigValid;
    } else {
      const max = parseFloat(cleanNumber(maxPrice));
      return isCommonValid && !isNaN(max) && max > 0 && isFeeConfigValid;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md max-h-[90vh] flex flex-col border-none bg-black/85 backdrop-blur-xl p-0 overflow-hidden text-white w-full max-w-lg rounded-none"
      >
        <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-[#d08700] z-50 pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-[#d08700] z-50 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-white z-50 pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-white z-50 pointer-events-none"></div>

        <div className="p-6 pb-0 relative z-20 shrink-0">
          <DialogHeader className="pb-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-linear-to-br from-[#d08700] to-[#ffa500] rounded-none rotate-45 flex items-center justify-center border border-[#d08700]">
                  <svg
                    className="w-5 h-5 text-white -rotate-45"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                </div>
                <DialogTitle className="text-2xl font-rajdhani font-bold text-white tracking-wide">
                  CREATE LIQUIDITY POOL
                </DialogTitle>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <DialogDescription className="text-base text-gray-400 font-rajdhani mt-2">
              Create a new liquidity pool for{' '}
              <strong className="uppercase text-[#d08700]">{token.tokenSymbol}</strong>
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 pt-6 flex flex-col gap-6 relative z-20 flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-[#d08700]/50 scrollbar-track-transparent">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-rajdhani font-bold text-gray-300 uppercase tracking-wider">
                Pool Type:
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-4 py-2 bg-black/50 border border-gray-700 hover:border-[#d08700] text-white font-rajdhani font-bold uppercase transition-colors outline-none cursor-pointer">
                    {poolType === 'BALANCED' ? 'Balanced Pool' : 'One-Sided Pool'}
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-black border border-gray-700 text-white font-rajdhani rounded-none">
                  <DropdownMenuItem
                    onClick={() => setPoolType('BALANCED')}
                    className="flex justify-between items-center cursor-pointer hover:bg-gray-800 focus:bg-gray-800 focus:text-white"
                  >
                    <span>Balanced Pool</span>
                    {poolType === 'BALANCED' && <Check className="w-4 h-4 text-[#d08700]" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setPoolType('ONE_SIDED')}
                    className="flex justify-between items-center cursor-pointer hover:bg-gray-800 focus:bg-gray-800 focus:text-white"
                  >
                    <span>One-Sided Pool</span>
                    {poolType === 'ONE_SIDED' && <Check className="w-4 h-4 text-[#d08700]" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Detailed Description */}
            <div className="bg-[rgba(208,135,0,0.1)] border border-[#d08700]/30 rounded-none p-4 text-sm font-rajdhani text-gray-300 leading-relaxed">
              {poolType === 'BALANCED' ? (
                <>
                  <p className="mb-2">
                    <strong className="text-[#d08700]">Balanced Pool</strong> allows adding
                    liquidity with a standard 50/50 ratio (or custom balanced ratio) of both tokens.
                    Ideal for providing full-range liquidity.
                  </p>
                  <p className="text-xs text-gray-400">
                    Features: DAMM (Dynamic Automated Market Maker), Auto-Yield Accrual.
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-2">
                    <strong className="text-[#d08700]">One-Sided Pool</strong> (DLMM) allows
                    launching a token with single-sided liquidity. You set an initial price and a
                    max price range to concentrate liquidity.
                  </p>
                  <p className="text-xs text-gray-400">
                    Features: High Capital Efficiency, Reduced Creation Costs, Price Range
                    Concentration.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-rajdhani font-bold text-gray-300 uppercase tracking-wider">
                Base Token Amount ({token.tokenSymbol})
              </label>
              <div className="relative group">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={baseAmount}
                  onChange={(e) => handleNumberInput(e.target.value, setBaseAmount)}
                  className={cn(
                    'w-full bg-black/50 border px-4 py-3 pr-20 text-white placeholder-gray-600 focus:outline-none transition-colors font-rajdhani text-lg rounded-none',
                    parseFloat(cleanNumber(baseAmount)) > tokenBalance
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-gray-700 focus:border-[#d08700]',
                  )}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#d08700] font-bold font-rajdhani uppercase">
                  {token.tokenSymbol}
                </span>

                {/* Corner accents for input */}
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
              {parseFloat(cleanNumber(baseAmount)) > tokenBalance && (
                <p className="text-red-500 text-xs font-rajdhani mt-1">
                  Insufficient {token.tokenSymbol} balance (Max: {tokenBalance})
                </p>
              )}
            </div>

            {/* Quote Token Amount - ONLY FOR BALANCED */}
            {poolType === 'BALANCED' && (
              <div className="space-y-2">
                <label className="block text-sm font-rajdhani font-bold text-gray-300 uppercase tracking-wider">
                  Quote Token Amount (SOL)
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={quoteAmount}
                    onChange={(e) => handleNumberInput(e.target.value, setQuoteAmount)}
                    className={cn(
                      'w-full bg-black/50 border px-4 py-3 pr-14 text-white placeholder-gray-600 focus:outline-none transition-colors font-rajdhani text-lg rounded-none',
                      parseFloat(cleanNumber(quoteAmount)) + 0.01 > solBalance
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-gray-700 focus:border-[#d08700]',
                    )}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#d08700] font-bold font-rajdhani">
                    SOL
                  </span>
                  {/* Corner accents for input */}
                  <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                {parseFloat(cleanNumber(quoteAmount)) + 0.01 > solBalance && (
                  <p className="text-red-500 text-xs font-rajdhani mt-1">
                    Insufficient SOL balance
                  </p>
                )}
              </div>
            )}

            {/* Initial Price */}
            <div className="space-y-2">
              <label className="block text-sm font-rajdhani font-bold text-gray-300 uppercase tracking-wider">
                Initial Price (SOL per {token.tokenSymbol})
              </label>
              <div className="relative group">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={initPrice}
                  onChange={(e) => handleNumberInput(e.target.value, setInitPrice)}
                  className="w-full bg-black/50 border border-gray-700 px-4 py-3 pr-14 text-white placeholder-gray-600 focus:outline-none focus:border-[#d08700] transition-colors font-rajdhani text-lg rounded-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#d08700] font-bold font-rajdhani">
                  SOL
                </span>
                {/* Corner accents for input */}
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            </div>

            {/* Max Price - ONLY FOR ONE-SIDED */}
            {poolType === 'ONE_SIDED' && (
              <div className="space-y-2">
                <label className="block text-sm font-rajdhani font-bold text-gray-300 uppercase tracking-wider">
                  Max Price (SOL per {token.tokenSymbol})
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={maxPrice}
                    onChange={(e) => handleNumberInput(e.target.value, setMaxPrice)}
                    className="w-full bg-black/50 border border-gray-700 px-4 py-3 pr-14 text-white placeholder-gray-600 focus:outline-none focus:border-[#d08700] transition-colors font-rajdhani text-lg rounded-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#d08700] font-bold font-rajdhani">
                    SOL
                  </span>
                  {/* Corner accents for input */}
                  <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
              </div>
            )}

            {/* Advanced Configuration (Collapsible) */}
            <div className="space-y-4 pt-2 border-t border-gray-700">
              <button
                type="button"
                onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                className="flex items-center gap-2 text-sm font-rajdhani font-bold text-[#d08700] uppercase tracking-wider hover:text-[#ffa500] transition-colors cursor-pointer"
              >
                <span>Advanced Configuration</span>
                <svg
                  className={cn(
                    'w-4 h-4 transition-transform duration-200',
                    showAdvancedConfig ? 'rotate-180' : '',
                  )}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {showAdvancedConfig && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-rajdhani font-bold text-gray-300 uppercase tracking-wider">
                      Fee Configuration
                    </label>
                    <p className="text-xs text-gray-400 font-rajdhani">
                      Configure the base fee mechanism for the pool.
                    </p>
                  </div>

                  {/* Base Fee Mode Selection */}
                  <div className="space-y-2">
                    <label className="block text-xs font-rajdhani font-bold text-gray-300 uppercase tracking-wider">
                      Base Fee Mode
                    </label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-full flex items-center justify-between px-4 py-2 bg-black/50 border border-gray-700 hover:border-[#d08700] text-white font-rajdhani text-base transition-colors outline-none cursor-pointer">
                          <span>
                            {baseFeeMode === 0
                              ? 'Fee Scheduler (Linear)'
                              : baseFeeMode === 1
                                ? 'Fee Scheduler (Exponential)'
                                : 'Rate Limiter'}
                          </span>
                          <svg
                            className="w-4 h-4 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] bg-black border border-gray-700 text-white font-rajdhani rounded-none z-50">
                        <DropdownMenuItem
                          onClick={() => setBaseFeeMode(0)}
                          className="flex justify-between items-center cursor-pointer hover:bg-gray-800 focus:bg-gray-800 focus:text-white"
                        >
                          <span>Fee Scheduler (Linear)</span>
                          {baseFeeMode === 0 && <Check className="w-4 h-4 text-[#d08700]" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setBaseFeeMode(1)}
                          className="flex justify-between items-center cursor-pointer hover:bg-gray-800 focus:bg-gray-800 focus:text-white"
                        >
                          <span>Fee Scheduler (Exponential)</span>
                          {baseFeeMode === 1 && <Check className="w-4 h-4 text-[#d08700]" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setBaseFeeMode(2)}
                          className="flex justify-between items-center cursor-pointer hover:bg-gray-800 focus:bg-gray-800 focus:text-white"
                        >
                          <span>Rate Limiter</span>
                          {baseFeeMode === 2 && <Check className="w-4 h-4 text-[#d08700]" />}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Fee Scheduler Inputs (Mode 0 & 1) */}
                  {(baseFeeMode === 0 || baseFeeMode === 1) && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-xs font-rajdhani font-bold text-gray-300 uppercase tracking-wider">
                            Start Fee (%)
                          </label>
                          <div className="relative group">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="1.0"
                              value={startFee}
                              onChange={(e) => handleNumberInput(e.target.value, setStartFee)}
                              className="w-full bg-black/50 border border-gray-700 px-4 py-2 pr-10 text-white placeholder-gray-600 focus:outline-none focus:border-[#d08700] transition-colors font-rajdhani text-base rounded-none"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#d08700] font-bold font-rajdhani">
                              %
                            </span>
                            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs font-rajdhani font-bold text-gray-300 uppercase tracking-wider">
                            End Fee (%)
                          </label>
                          <div className="relative group">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0.1"
                              value={endFee}
                              onChange={(e) => handleNumberInput(e.target.value, setEndFee)}
                              className="w-full bg-black/50 border border-gray-700 px-4 py-2 pr-10 text-white placeholder-gray-600 focus:outline-none focus:border-[#d08700] transition-colors font-rajdhani text-base rounded-none"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#d08700] font-bold font-rajdhani">
                              %
                            </span>
                            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-rajdhani font-bold text-gray-300 uppercase tracking-wider">
                          Duration (Seconds)
                        </label>
                        <div className="relative group">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="86400"
                            value={feeDuration}
                            onChange={(e) => handleNumberInput(e.target.value, setFeeDuration)}
                            className="w-full bg-black/50 border border-gray-700 px-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-[#d08700] transition-colors font-rajdhani text-base rounded-none"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#d08700] font-bold font-rajdhani uppercase">
                            Sec
                          </span>
                          <div className="absolute right-12 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 font-rajdhani pointer-events-none hidden sm:block">
                            ~{(parseInt(cleanNumber(feeDuration) || '0') / 86400).toFixed(1)} days
                          </div>
                          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                      </div>

                      <div className="bg-[rgba(255,255,255,0.03)] border border-gray-700 p-4 text-sm font-rajdhani text-gray-300 leading-relaxed">
                        <p>
                          <strong className="text-[#d08700]">Dynamic Fees:</strong> The pool will
                          start with a{' '}
                          <strong className="text-white">
                            {parseFloat(cleanNumber(startFee) || '0')}%
                          </strong>{' '}
                          fee, {baseFeeMode === 0 ? 'linearly' : 'exponentially'} decreasing to{' '}
                          <strong className="text-white">
                            {parseFloat(cleanNumber(endFee) || '0')}%
                          </strong>{' '}
                          over{' '}
                          <strong className="text-white">
                            {(parseInt(cleanNumber(feeDuration) || '0') / 86400).toFixed(2)} days
                          </strong>
                          . This protects against snipers at launch.
                        </p>
                      </div>
                    </>
                  )}

                  {/* Rate Limiter Inputs (Mode 2) */}
                  {baseFeeMode === 2 && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-xs font-rajdhani font-bold text-gray-300 uppercase tracking-wider">
                            Base Fee (%)
                          </label>
                          <div className="relative group">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="1.2"
                              value={rateLimiterBaseFeeBps}
                              onChange={(e) =>
                                handleNumberInput(e.target.value, setRateLimiterBaseFeeBps)
                              }
                              className="w-full bg-black/50 border border-gray-700 px-4 py-2 pr-10 text-white placeholder-gray-600 focus:outline-none focus:border-[#d08700] transition-colors font-rajdhani text-base rounded-none"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#d08700] font-bold font-rajdhani">
                              %
                            </span>
                            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs font-rajdhani font-bold text-gray-300 uppercase tracking-wider">
                            Max Fee (%)
                          </label>
                          <div className="relative group">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="50"
                              value={rateLimiterMaxFeeBps}
                              onChange={(e) =>
                                handleNumberInput(e.target.value, setRateLimiterMaxFeeBps)
                              }
                              className="w-full bg-black/50 border border-gray-700 px-4 py-2 pr-10 text-white placeholder-gray-600 focus:outline-none focus:border-[#d08700] transition-colors font-rajdhani text-base rounded-none"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#d08700] font-bold font-rajdhani">
                              %
                            </span>
                            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-xs font-rajdhani font-bold text-gray-300 uppercase tracking-wider">
                            Fee Increment (%)
                          </label>
                          <div className="relative group">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="1.0"
                              value={rateLimiterFeeIncrementBps}
                              onChange={(e) =>
                                handleNumberInput(e.target.value, setRateLimiterFeeIncrementBps)
                              }
                              className="w-full bg-black/50 border border-gray-700 px-4 py-2 pr-10 text-white placeholder-gray-600 focus:outline-none focus:border-[#d08700] transition-colors font-rajdhani text-base rounded-none"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#d08700] font-bold font-rajdhani">
                              %
                            </span>
                            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs font-rajdhani font-bold text-gray-300 uppercase tracking-wider">
                            Reference Amount
                          </label>
                          <div className="relative group">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="1"
                              value={rateLimiterReferenceAmount}
                              onChange={(e) =>
                                handleNumberInput(e.target.value, setRateLimiterReferenceAmount)
                              }
                              className="w-full bg-black/50 border border-gray-700 px-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-[#d08700] transition-colors font-rajdhani text-base rounded-none"
                            />
                            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-rajdhani font-bold text-gray-300 uppercase tracking-wider">
                          Max Limiter Duration (Seconds)
                        </label>
                        <div className="relative group">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="3600"
                            value={feeDuration}
                            onChange={(e) => handleNumberInput(e.target.value, setFeeDuration)}
                            className="w-full bg-black/50 border border-gray-700 px-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-[#d08700] transition-colors font-rajdhani text-base rounded-none"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#d08700] font-bold font-rajdhani uppercase">
                            Sec
                          </span>
                          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#d08700] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                      </div>

                      <div className="bg-[rgba(255,255,255,0.03)] border border-gray-700 p-4 text-sm font-rajdhani text-gray-300 leading-relaxed">
                        <p>
                          <strong className="text-[#d08700]">Rate Limiter:</strong> Fees increase as
                          trading volume spikes.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Pool Summary */}
            {isValid() && (
              <div className="bg-[rgba(255,255,255,0.03)] border border-gray-700 p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400 font-rajdhani">Base Amount:</span>
                  <span className="text-base font-bold text-white font-rajdhani uppercase">
                    {parseFloat(cleanNumber(baseAmount)).toFixed(4)} {token.tokenSymbol}
                  </span>
                </div>
                {poolType === 'BALANCED' && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400 font-rajdhani">Quote Amount:</span>
                    <span className="text-base font-bold text-white font-rajdhani">
                      {parseFloat(cleanNumber(quoteAmount)).toFixed(4)} SOL
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400 font-rajdhani">Initial Price:</span>
                  <span className="text-base font-bold text-white font-rajdhani">
                    {parseFloat(cleanNumber(initPrice)).toFixed(6)} SOL
                  </span>
                </div>
                {poolType === 'ONE_SIDED' && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400 font-rajdhani">Max Price:</span>
                    <span className="text-base font-bold text-white font-rajdhani">
                      {parseFloat(cleanNumber(maxPrice)).toFixed(6)} SOL
                    </span>
                  </div>
                )}
                <div className="border-t border-gray-700 pt-3 mt-2">
                  <p className="text-xs text-gray-500 font-rajdhani">
                    Plus network fees (~0.01 SOL)
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto px-6 py-3 text-sm font-bold font-rajdhani uppercase tracking-wider border border-gray-600 bg-transparent text-gray-400 hover:text-white hover:border-gray-400 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!isValid()}
              className={cn(
                'w-full sm:w-auto px-8 py-3 text-sm font-bold font-rajdhani uppercase tracking-wider transition-all shadow-lg hover:shadow-[#d08700]/20 border border-transparent',
                isValid()
                  ? 'bg-linear-to-r from-[#d08700] to-[#ffa500] hover:from-[#b87600] hover:to-[#e89400] text-white border-[#d08700] cursor-pointer'
                  : 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed',
              )}
            >
              Create Pool
            </button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
