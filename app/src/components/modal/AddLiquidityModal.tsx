'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Token } from '@/types/token';
import { X } from 'lucide-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { CpAmm, getTokenProgram } from '@meteora-ag/cp-amm-sdk';
import { unpackMint } from '@solana/spl-token';
import { getAmountInLamports, getAmountInTokens } from '@/lib/dammv2';
// @ts-ignore
import BN from 'bn.js';

interface AddLiquidityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: Token;
  positions: any[];
  onConfirm: (amount: number, isTokenA: boolean, selectedPosition: any) => void;
  connection: Connection;
  poolAddress: string;
  userPublicKey: PublicKey | null;
}

export function AddLiquidityModal({
  open,
  onOpenChange,
  token,
  positions,
  onConfirm,
  connection,
  poolAddress,
  userPublicKey,
}: AddLiquidityModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [isTokenA, setIsTokenA] = useState<boolean>(true);
  const [selectedPositionIndex, setSelectedPositionIndex] = useState<number>(0);
  const [requiredAmount, setRequiredAmount] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [userSolBalance, setUserSolBalance] = useState<number>(0);
  const [userTokenBalance, setUserTokenBalance] = useState<number>(0);
  const [hasInsufficientBalance, setHasInsufficientBalance] = useState<boolean>(false);

  // Reset form to initial state
  const resetForm = () => {
    setAmount('');
    setIsTokenA(true);
    setSelectedPositionIndex(0);
    setRequiredAmount('');
    setHasInsufficientBalance(false);
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const handleConfirm = () => {
    const amountNum = parseFloat(amount);

    if (isNaN(amountNum) || amountNum <= 0) {
      return;
    }

    const selectedPosition = positions[selectedPositionIndex];
    onConfirm(amountNum, isTokenA, selectedPosition);
    onOpenChange(false);
  };

  // Format number with thousand separators
  const formatNumberWithCommas = (value: string): string => {
    if (!value) return '';

    const parts = value.split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return parts.length > 1 ? `${integerPart}.${parts[1]}` : integerPart;
  };

  // Parse formatted number back to plain number
  const parseFormattedNumber = (value: string): string => {
    return value.replace(/,/g, '');
  };

  const handleNumberInput = (value: string) => {
    // Remove all commas first
    const withoutCommas = value.replace(/,/g, '');

    // Only allow numbers and decimal point
    const sanitized = withoutCommas.replace(/[^\d.]/g, '');

    // Prevent multiple decimal points
    const parts = sanitized.split('.');
    const formatted = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : sanitized;

    setAmount(formatted);
  };

  const isValid = () => {
    const amountNum = parseFloat(amount);
    return !isNaN(amountNum) && amountNum > 0 && !hasInsufficientBalance;
  };

  // Fetch user balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!userPublicKey || !poolAddress) return;

      try {
        // Fetch SOL balance
        const solBalance = await connection.getBalance(userPublicKey);
        setUserSolBalance(solBalance / 1e9); // Convert lamports to SOL

        // Fetch token balance
        const cpAmmInstance = new CpAmm(connection);
        const poolState = await cpAmmInstance.fetchPoolState(new PublicKey(poolAddress));

        const tokenMint = poolState.tokenAMint;
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(userPublicKey, {
          mint: tokenMint,
        });

        if (tokenAccounts.value.length > 0) {
          const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
          setUserTokenBalance(balance || 0);
        } else {
          setUserTokenBalance(0);
        }
      } catch (error) {
        console.error('Error fetching balances:', error);
      }
    };

    fetchBalances();
  }, [userPublicKey, poolAddress, connection]);

  // Calculate required amount when user inputs amount
  useEffect(() => {
    const calculateRequiredAmount = async () => {
      if (!amount || parseFloat(amount) <= 0 || !poolAddress) {
        setRequiredAmount('');
        return;
      }

      setIsCalculating(true);
      try {
        const cpAmmInstance = new CpAmm(connection);
        const poolState = await cpAmmInstance.fetchPoolState(new PublicKey(poolAddress));

        const tokenAMintInfo = await connection.getAccountInfo(poolState.tokenAMint);
        const tokenBMintInfo = await connection.getAccountInfo(poolState.tokenBMint);

        if (!tokenAMintInfo || !tokenBMintInfo) {
          return;
        }

        const tokenAMintData = unpackMint(
          poolState.tokenAMint,
          tokenAMintInfo,
          tokenAMintInfo.owner,
        );
        const tokenBMintData = unpackMint(
          poolState.tokenBMint,
          tokenBMintInfo,
          tokenBMintInfo.owner,
        );

        const amountInLamports = getAmountInLamports(
          parseFloat(amount),
          isTokenA ? tokenAMintData.decimals : tokenBMintData.decimals,
        );

        const depositQuote = await cpAmmInstance.getDepositQuote({
          inAmount: amountInLamports,
          isTokenA,
          minSqrtPrice: poolState.sqrtMinPrice,
          maxSqrtPrice: poolState.sqrtMaxPrice,
          sqrtPrice: poolState.sqrtPrice,
        });

        const outputDecimals = isTokenA ? tokenBMintData.decimals : tokenAMintData.decimals;
        const requiredAmountStr = getAmountInTokens(depositQuote.outputAmount, outputDecimals);
        setRequiredAmount(requiredAmountStr);

        // Check if user has sufficient balance
        const requiredAmountNum = parseFloat(requiredAmountStr);
        const inputAmountNum = parseFloat(amount);

        if (isTokenA) {
          // User is adding token A, needs SOL (token B)
          const insufficientInput = inputAmountNum > userTokenBalance;
          const insufficientRequired = requiredAmountNum > userSolBalance;
          setHasInsufficientBalance(insufficientInput || insufficientRequired);
        } else {
          // User is adding SOL (token B), needs token A
          const insufficientInput = inputAmountNum > userSolBalance;
          const insufficientRequired = requiredAmountNum > userTokenBalance;
          setHasInsufficientBalance(insufficientInput || insufficientRequired);
        }
      } catch (error) {
        console.error('Error calculating required amount:', error);
        setRequiredAmount('');
      } finally {
        setIsCalculating(false);
      }
    };

    const debounceTimer = setTimeout(calculateRequiredAmount, 500);
    return () => clearTimeout(debounceTimer);
  }, [amount, isTokenA, poolAddress, connection]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md max-h-[90vh] flex flex-col border-none bg-black/85 backdrop-blur-xl p-0 overflow-hidden text-white w-full max-w-lg rounded-none"
      >
        {/* Corner Borders */}
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
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <DialogTitle className="text-2xl font-rajdhani font-bold text-white tracking-wide">
                  ADD LIQUIDITY
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
              Add more liquidity to your{' '}
              <strong className="uppercase text-[#d08700]">{token.tokenSymbol}</strong> pool
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 pt-6 flex flex-col gap-6 relative z-20 flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-[#d08700]/50 scrollbar-track-transparent">
          {/* Info Banner */}
          <div className="bg-[rgba(208,135,0,0.1)] border border-[#d08700]/30 rounded-none p-4">
            <div className="flex gap-3">
              <div className="shrink-0">
                <svg className="w-5 h-5 text-[#d08700]" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-[#d08700] font-rajdhani font-bold mb-1 uppercase tracking-wider">
                  You have {positions.length} active position{positions.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-gray-400 font-rajdhani">
                  Add liquidity to earn more trading fees
                </p>
              </div>
            </div>
          </div>

          {/* Liquidity Configuration */}
          <div className="space-y-5">
            {/* Position Selection */}
            {positions.length > 1 && (
              <div className="space-y-2">
                <label className="block text-sm font-rajdhani font-bold text-gray-300 uppercase tracking-wider">
                  Select Position
                </label>
                <select
                  value={selectedPositionIndex}
                  onChange={(e) => setSelectedPositionIndex(parseInt(e.target.value))}
                  className="w-full bg-black/50 border border-gray-700 px-4 py-3 text-white focus:outline-none focus:border-[#d08700] transition-colors font-rajdhani text-lg rounded-none appearance-none cursor-pointer"
                >
                  {positions.map((position, index) => (
                    <option key={index} value={index} className="bg-black text-white">
                      Position #{index + 1} -{' '}
                      {position.userPosition.position.toString().slice(0, 8)}...
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Token Type Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-rajdhani font-bold text-gray-300 uppercase tracking-wider">
                Token Type
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setIsTokenA(true)}
                  className={cn(
                    'px-4 py-3 border transition-all duration-200 cursor-pointer relative group overflow-hidden',
                    isTokenA
                      ? 'bg-[rgba(208,135,0,0.1)] border-[#d08700]'
                      : 'bg-black/30 border-gray-700 hover:border-gray-500',
                  )}
                >
                  <div className="flex flex-col items-center gap-1 relative z-10">
                    <span
                      className={cn(
                        'font-rajdhani font-bold text-lg uppercase',
                        isTokenA ? 'text-[#d08700]' : 'text-gray-400 group-hover:text-gray-200',
                      )}
                    >
                      {token.tokenSymbol}
                    </span>
                    <span className="text-xs font-rajdhani text-gray-500">Token A</span>
                  </div>
                  {/* Corner accents for button */}
                  {isTokenA && (
                    <>
                      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#d08700]"></div>
                      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#d08700]"></div>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsTokenA(false)}
                  className={cn(
                    'px-4 py-3 border transition-all duration-200 cursor-pointer relative group overflow-hidden',
                    !isTokenA
                      ? 'bg-[rgba(208,135,0,0.1)] border-[#d08700]'
                      : 'bg-black/30 border-gray-700 hover:border-gray-500',
                  )}
                >
                  <div className="flex flex-col items-center gap-1 relative z-10">
                    <span
                      className={cn(
                        'font-rajdhani font-bold text-lg uppercase',
                        !isTokenA ? 'text-[#d08700]' : 'text-gray-400 group-hover:text-gray-200',
                      )}
                    >
                      SOL
                    </span>
                    <span className="text-xs font-rajdhani text-gray-500">Token B</span>
                  </div>
                  {/* Corner accents for button */}
                  {!isTokenA && (
                    <>
                      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#d08700]"></div>
                      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#d08700]"></div>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <label className="block text-sm font-rajdhani font-bold text-gray-300 uppercase tracking-wider">
                Amount to Add
              </label>
              <div className="relative group">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={formatNumberWithCommas(amount)}
                  onChange={(e) => handleNumberInput(e.target.value)}
                  className={cn(
                    'w-full bg-black/50 border px-4 py-3 pr-20 text-white placeholder-gray-600 focus:outline-none transition-colors font-rajdhani text-lg rounded-none',
                    hasInsufficientBalance && amount
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-gray-700 focus:border-[#d08700]',
                  )}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#d08700] font-bold font-rajdhani uppercase">
                  {isTokenA ? token.tokenSymbol : 'SOL'}
                </span>
                {/* Corner accents for input */}
                <div
                  className={cn(
                    'absolute top-0 right-0 w-2 h-2 border-t border-r opacity-0 group-hover:opacity-100 transition-opacity',
                    hasInsufficientBalance && amount ? 'border-red-500' : 'border-[#d08700]',
                  )}
                ></div>
                <div
                  className={cn(
                    'absolute bottom-0 left-0 w-2 h-2 border-b border-l opacity-0 group-hover:opacity-100 transition-opacity',
                    hasInsufficientBalance && amount ? 'border-red-500' : 'border-[#d08700]',
                  )}
                ></div>
              </div>
              {/* Error message */}
              {hasInsufficientBalance && amount && (
                <p className="text-xs text-red-500 font-rajdhani mt-1">
                  ⚠️ Insufficient balance. You need{' '}
                  {formatNumberWithCommas(parseFloat(requiredAmount || '0').toFixed(6))}{' '}
                  {isTokenA ? 'SOL' : token.tokenSymbol}
                  {isTokenA &&
                    parseFloat(amount) > userTokenBalance &&
                    ` (You have ${formatNumberWithCommas(userTokenBalance.toFixed(6))} ${token.tokenSymbol})`}
                  {!isTokenA &&
                    parseFloat(amount) > userSolBalance &&
                    ` (You have ${formatNumberWithCommas(userSolBalance.toFixed(6))} SOL)`}
                </p>
              )}
            </div>

            {/* Liquidity Summary */}
            {isValid() && (
              <div className="bg-[rgba(255,255,255,0.03)] border border-gray-700 p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400 font-rajdhani">Adding:</span>
                  <span className="text-base font-bold text-white font-rajdhani uppercase">
                    {formatNumberWithCommas(parseFloat(amount).toFixed(4))}{' '}
                    {isTokenA ? token.tokenSymbol : 'SOL'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400 font-rajdhani">Token Type:</span>
                  <span className="text-base font-bold text-white font-rajdhani">
                    {isTokenA ? 'Token A (Base)' : 'Token B (Quote)'}
                  </span>
                </div>
                {/* Required Amount Display */}
                <div className="flex justify-between items-center border-t border-gray-700 pt-3">
                  <span className="text-sm text-gray-400 font-rajdhani">
                    Required {isTokenA ? 'SOL' : token.tokenSymbol}:
                  </span>
                  <span className="text-base font-bold text-[#d08700] font-rajdhani uppercase">
                    {isCalculating ? (
                      <span className="text-gray-500">Calculating...</span>
                    ) : requiredAmount ? (
                      <>
                        {formatNumberWithCommas(parseFloat(requiredAmount).toFixed(6))}{' '}
                        {isTokenA ? 'SOL' : token.tokenSymbol}
                      </>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </span>
                </div>
                {positions.length > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400 font-rajdhani">Position:</span>
                    <span className="text-base font-mono text-white font-rajdhani">
                      #{selectedPositionIndex + 1}
                    </span>
                  </div>
                )}
                <div className="border-t border-gray-700 pt-3 mt-2">
                  <p className="text-xs text-gray-500 font-rajdhani">
                    Plus network fees (~0.001 SOL)
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
              Add Liquidity
            </button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
