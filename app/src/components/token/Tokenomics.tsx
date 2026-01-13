'use client';

import { ExternalLink, LockKeyhole } from 'lucide-react';
import { Token } from '@/types/token';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { CreatePoolModal, PoolConfig } from '@/components/modal/CreatePoolModal';
import { AddLiquidityModal } from '@/components/modal/AddLiquidityModal';
import {
  getPositions,
  createDammV2BalancedPool,
  createDammV2OneSidedPool,
  addLiquidity,
  claimPositionFee,
  getPoolAddress,
  getPoolInfo,
  getPool24hStats,
  DAMMV2Config,
  PoolFeesConfig,
  Pool24hStats,
} from '@/lib/dammv2';
import { ActivationType } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { CpAmm } from '@meteora-ag/cp-amm-sdk';
import Link from 'next/link';

interface TokenomicsProps {
  token: Token;
}

// Default fees if not provided (fallback)
const DEFAULT_START_FEE = 1; // 1%
const DEFAULT_END_FEE = 0.1; // 0.1%
const DEFAULT_DURATION = 86400; // 1 day

export function Tokenomics({ token }: TokenomicsProps) {
  const { prices } = useCryptoPrices();
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const zecPrice = prices.zcash || 30; // fallback to $30 if not available

  const [isCreatePoolModalOpen, setIsCreatePoolModalOpen] = useState(false);
  const [isAddLiquidityModalOpen, setIsAddLiquidityModalOpen] = useState(false);
  const [userPositions, setUserPositions] = useState<any[] | null>(null);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const [poolAddress, setPoolAddress] = useState<string | null>(null);
  const [poolInfo, setPoolInfo] = useState<any | null>(null);
  const [pool24hStats, setPool24hStats] = useState<Pool24hStats | null>(null);

  // Helper function to check if token is in claim period
  const isInClaimPeriod = (): boolean => {
    if (!token.endTime) return false;

    const now = Date.now();
    const endTime = Number(token.endTime) * 1000; // Convert to milliseconds

    // Claim period starts when sale ends (now > endTime)
    return now > endTime;
  };

  // Fetch pool address
  useEffect(() => {
    const fetchAddress = async () => {
      if (!token.tokenMint || !connection) return;
      try {
        const address = await getPoolAddress(
          connection,
          new PublicKey(token.tokenMint),
          new PublicKey('So11111111111111111111111111111111111111112'), // WSOL Mint
        );
        if (address) {
          console.log('Found pool address:', address.toString());
          setPoolAddress(address.toString());
        }
      } catch (error) {
        console.error('Failed to fetch pool address:', error);
      }
    };
    fetchAddress();
  }, [token.tokenMint, connection]);

  // Fetch pool info when poolAddress is found
  useEffect(() => {
    const fetchPoolInfoData = async () => {
      if (!poolAddress || !connection) return;
      try {
        const info = await getPoolInfo(connection, new PublicKey(poolAddress));
        console.log('Pool Info:', info);
        setPoolInfo(info);
      } catch (error) {
        console.error('Failed to fetch pool info:', error);
      }
    };
    fetchPoolInfoData();
  }, [poolAddress, connection]);

  // Fetch 24h stats when poolAddress is found
  useEffect(() => {
    const fetch24hStats = async () => {
      if (!poolAddress) return;
      try {
        const stats = await getPool24hStats(poolAddress);
        setPool24hStats(stats);
      } catch (error) {
        console.error('Failed to fetch 24h stats:', error);
      }
    };
    fetch24hStats();
  }, [poolAddress]);

  // Check for user positions when wallet is connected and poolAddress is available
  useEffect(() => {
    const checkPositions = async () => {
      if (!publicKey || !poolAddress) {
        setUserPositions(null);
        return;
      }

      setIsLoadingPositions(true);
      try {
        const positions = await getPositions(connection, publicKey, new PublicKey(poolAddress));
        setUserPositions(positions || null);
      } catch (error) {
        console.error('Error fetching positions:', error);
        setUserPositions(null);
      } finally {
        setIsLoadingPositions(false);
      }
    };

    checkPositions();
  }, [publicKey, poolAddress, connection]);

  const totalSupply = Number(token.totalSupply) / Math.pow(10, token.decimals);
  const amountToSell = Number(token.amountToSell) / Math.pow(10, token.decimals);
  const pricePerTokenZec = Number(token.pricePerToken) / 1e9; // Price per token in ZEC

  const salePercentage = ((amountToSell / totalSupply) * 100).toFixed(1);
  const remainingPercentage = 100 - parseFloat(salePercentage);

  // Calculate amount raised (target raise goal) in USD
  const amountRaisedUsd = amountToSell * pricePerTokenZec * zecPrice;

  const saleRatio = amountToSell / totalSupply;
  const fdv = saleRatio > 0 ? amountRaisedUsd / saleRatio : 0;

  // Initial market cap is the amount raised (sale only)
  const initialMarketCap = amountRaisedUsd;

  // Handler for creating a new pool
  const handleCreatePool = async (config: PoolConfig) => {
    if (!publicKey) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      toast.info('Creating pool transaction...');

      const startFeeBps = (config.startFee ?? DEFAULT_START_FEE) * 100;
      const endFeeBps = (config.endFee ?? DEFAULT_END_FEE) * 100;
      const duration = config.feeDuration ?? DEFAULT_DURATION;

      const poolFees: PoolFeesConfig = {
        baseFee: {
          baseFeeMode: config.baseFeeMode as 0 | 1 | 2,
          // Only add feeSchedulerParam if mode is 0 or 1
          ...(config.baseFeeMode === 0 || config.baseFeeMode === 1
            ? {
                feeSchedulerParam: {
                  startingFeeBps: Math.floor(startFeeBps),
                  endingFeeBps: Math.floor(endFeeBps),
                  numberOfPeriod: 1, // Default to 1 period if not specified
                  totalDuration: duration,
                },
              }
            : {}),
          // Only add rateLimiterParam if mode is 2
          ...(config.baseFeeMode === 2 && config.rateLimiterParam
            ? {
                rateLimiterParam: {
                  baseFeeBps: Math.floor(config.rateLimiterParam.baseFeeBps * 100), // Convert to bps? Input was %, need to check if SDK expects bps or %. Usually bps. CreatePoolModal uses %. 1% = 100 bps
                  feeIncrementBps: Math.floor(config.rateLimiterParam.feeIncrementBps * 100),
                  referenceAmount: config.rateLimiterParam.referenceAmount,
                  maxLimiterDuration: config.rateLimiterParam.maxLimiterDuration,
                  maxFeeBps: Math.floor(config.rateLimiterParam.maxFeeBps * 100),
                },
              }
            : {}),
        },
        dynamicFeeEnabled: true,
      };

      const dammConfig: DAMMV2Config = {
        baseAmount: config.baseAmount,
        quoteAmount: config.quoteAmount || null,
        initPrice: config.initPrice,
        minPrice: null, // Let SDK handle defaults or derive from initPrice
        maxPrice: null,
        poolFees: poolFees,
        hasAlphaVault: false,
        activationPoint: null,
        activationType: ActivationType.Slot, // Use Timestamp for seconds-based duration
        collectFeeMode: 1,
      };

      const baseTokenMint = new PublicKey(token.tokenMint);
      const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

      const result =
        config.type === 'BALANCED'
          ? await createDammV2BalancedPool(
              dammConfig,
              connection,
              publicKey,
              publicKey, // Creator is payer
              baseTokenMint,
              WSOL_MINT,
            )
          : await createDammV2OneSidedPool(
              dammConfig,
              connection,
              publicKey,
              publicKey,
              baseTokenMint,
              WSOL_MINT,
            );

      console.log('Result:', result);
      if (result && result.initCustomizePoolTx) {
        result.initCustomizePoolTx.feePayer = publicKey;
        console.log('Simulating transaction...');
        const simulation = await connection.simulateTransaction(result.initCustomizePoolTx);
        console.error('Simulation logs:', simulation.value.logs);

        const signature = await sendTransaction(result.initCustomizePoolTx, connection, {
          signers: result.signers,
        });
        await connection.confirmTransaction(signature, 'confirmed');

        setPoolAddress(result.pool.toString());
        toast.success('Pool created successfully!');
        console.log('Pool Address:', result.pool.toString());
      }
    } catch (error: any) {
      console.error('Error creating pool:', error);
      toast.error(`Failed to create pool: ${error.message}`);
    }
  };

  // Handler for adding liquidity
  const handleAddLiquidity = async (amount: number, isTokenA: boolean, selectedPosition: any) => {
    if (!publicKey || !poolAddress) {
      toast.error('Wallet not connected or pool not found');
      return;
    }

    try {
      toast.info('Preparing add liquidity transaction...');

      const tx = await addLiquidity(
        connection,
        amount,
        isTokenA,
        publicKey,
        new PublicKey(poolAddress),
        selectedPosition,
      );

      if (tx) {
        // Set fee payer before sending transaction
        tx.feePayer = publicKey;
        const signature = await sendTransaction(tx, connection);
        await connection.confirmTransaction(signature, 'confirmed');
        toast.success('Liquidity added successfully');

        // Refresh positions after successful add
        const positions = await getPositions(connection, publicKey, new PublicKey(poolAddress));
        setUserPositions(positions || null);
      }
    } catch (error: any) {
      console.error('Error adding liquidity:', error);
      toast.error(`Failed to add liquidity: ${error.message}`);
    }
  };

  return (
    <div className="relative w-full backdrop-blur-[2px] bg-[rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.1)] mt-6">
      {/* Corner Borders */}
      <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-[#d08700] z-10"></div>
      <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-[#d08700] z-10"></div>
      <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-white z-10"></div>
      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-white z-10"></div>

      <div className="p-4 sm:p-5 md:p-6 flex flex-col gap-4 sm:gap-5 md:gap-6">
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
                  Based on current ZEC Price
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

        {/* Only show liquidity-related sections when token is in claim period */}
        {isInClaimPeriod() && (
          <>
            {/* User Positions Section (New) */}
            {userPositions && userPositions.length > 0 && (
              <div className="flex flex-col gap-3 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-[#d08700]"></div>
                  <h3 className="font-rajdhani font-bold text-lg sm:text-xl md:text-2xl text-white">
                    YOUR POSITIONS
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {userPositions.map((position, index) => (
                    <div
                      key={index}
                      className="bg-[rgba(100,100,100,0.06)] border border-gray-600 p-3 sm:p-4 flex flex-col gap-2"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-rajdhani font-bold text-gray-300">
                          Position #{index + 1}
                        </span>
                        <Link
                          href={`https://www.meteora.ag/dammv2/${position.userPosition.position}`}
                          target="_blank"
                          className="flex items-center gap-2 font-rajdhani text-sm text-gray-500 hover:text-white"
                        >
                          {position.userPosition.position.toString().slice(0, 8)}...
                          <ExternalLink className="w-4 h-4 hover:text-white" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex flex-col gap-3 sm:gap-4 mt-3 sm:mt-4">
                <div className="flex items-center justify-between gap-2 sm:gap-3">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <img
                      className="w-5 h-5 sm:w-7 sm:h-7"
                      src="/icons/pie-chart.svg"
                      alt="Pie Chart"
                    />
                    <h3 className="font-rajdhani font-bold text-lg sm:text-xl md:text-2xl text-white">
                      LIQUIDITY DISTRIBUTION
                    </h3>
                  </div>
                  {publicKey && userPositions && userPositions?.length > 0 && (
                    <button
                      onClick={() => setIsAddLiquidityModalOpen(true)}
                      className="bg-linear-to-r from-[#d08700] to-[#ffa500] hover:from-[#b87600] hover:to-[#e89400] border border-[#d08700] px-3 py-2 rounded-none transition-all duration-200 shadow-lg hover:shadow-[#d08700]/20 cursor-pointer group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/50 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/50 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                      <span className="font-rajdhani font-bold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                        Add Liquidity
                      </span>
                    </button>
                  )}
                </div>

                {(!userPositions || userPositions.length === 0) && (
                  <div className="flex items-center justify-center p-6 bg-[rgba(100,100,100,0.06)] border border-gray-600 border-dashed">
                    <div className="flex flex-col items-center gap-3">
                      {isLoadingPositions ? (
                        <span className="font-rajdhani font-bold text-sm sm:text-base text-[#d08700] uppercase tracking-wider">
                          Loading...
                        </span>
                      ) : !publicKey ? (
                        <span className="font-rajdhani font-bold text-sm sm:text-base text-[#d08700] uppercase tracking-wider">
                          Connect Wallet to Add Liquidity
                        </span>
                      ) : (
                        <button
                          onClick={() => setIsCreatePoolModalOpen(true)}
                          className="bg-linear-to-r from-[#d08700] to-[#ffa500] hover:from-[#b87600] hover:to-[#e89400] border border-[#d08700] px-6 py-3 rounded-none transition-all duration-200 shadow-lg hover:shadow-[#d08700]/20 cursor-pointer group relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/50 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/50 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                          <span className="font-rajdhani font-bold text-sm sm:text-base text-white uppercase tracking-wider flex items-center gap-2">
                            Create Pool
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Pool Stats - Show all available pool information in horizontal layout */}
                {poolInfo && (
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    {/* Base Fee */}
                    {poolInfo.poolFees?.baseFee?.baseFeeInfo?.data && (
                      <div className="flex justify-between items-center border-b border-white/10 pb-2 sm:pb-1.5">
                        <span className="text-gray-400 font-rajdhani text-sm">Base Fee</span>
                        <span className="text-white font-rajdhani font-bold text-base">
                          {((poolInfo.poolFees.baseFee.baseFeeInfo.data[1] || 0) / 100).toFixed(1)}%
                        </span>
                      </div>
                    )}

                    {/* Dynamic Fee */}
                    {poolInfo.poolFees?.dynamicFee?.initialized !== undefined && (
                      <div className="flex justify-between items-center border-b border-white/10 pb-2 sm:pb-1.5">
                        <span className="text-gray-400 font-rajdhani text-sm">Dynamic Fee</span>
                        <span className="text-white font-rajdhani font-bold text-base">
                          {poolInfo.poolFees.dynamicFee.initialized === 1 ? 'Yes' : 'No'}
                        </span>
                      </div>
                    )}

                    {/* Total Trading Fee */}
                    {poolInfo.poolFees?.baseFee?.baseFeeInfo?.data && (
                      <div className="flex justify-between items-center border-b border-white/10 pb-2 sm:pb-1.5">
                        <span className="text-gray-400 font-rajdhani text-sm">
                          Total Trading Fee
                        </span>
                        <span className="text-white font-rajdhani font-bold text-base">
                          {((poolInfo.poolFees.baseFee.baseFeeInfo.data[1] || 0) / 100).toFixed(1)}%
                        </span>
                      </div>
                    )}

                    {/* Variable Fee Control */}
                    {poolInfo.poolFees?.dynamicFee?.variableFeeControl !== undefined && (
                      <div className="flex justify-between items-center border-b border-white/10 pb-2 sm:pb-1.5">
                        <span className="text-gray-400 font-rajdhani text-sm">
                          Variable Fee Control
                        </span>
                        <span className="text-white font-rajdhani font-bold text-base">
                          {poolInfo.poolFees.dynamicFee.variableFeeControl}
                        </span>
                      </div>
                    )}

                    {/* Protocol Fee */}
                    {poolInfo.poolFees?.protocolFeePercent !== undefined && (
                      <div className="flex justify-between items-center border-b border-white/10 pb-2 sm:pb-1.5">
                        <span className="text-gray-400 font-rajdhani text-sm">Protocol Fee</span>
                        <span className="text-white font-rajdhani font-bold text-base">
                          {(poolInfo.poolFees.protocolFeePercent / 100).toFixed(1)}%
                        </span>
                      </div>
                    )}

                    {/* Total Positions */}
                    {poolInfo.metrics?.totalPosition !== undefined && (
                      <div className="flex justify-between items-center border-b border-white/10 pb-2 sm:pb-1.5">
                        <span className="text-gray-400 font-rajdhani text-sm">Total Positions</span>
                        <span className="text-white font-rajdhani font-bold text-base">
                          {poolInfo.metrics.totalPosition.toString()}
                        </span>
                      </div>
                    )}

                    {/* 24h Volume */}
                    {pool24hStats?.volume24h !== undefined && pool24hStats.volume24h > 0 && (
                      <div className="flex justify-between items-center border-b border-white/10 pb-2 sm:pb-1.5">
                        <span className="text-gray-400 font-rajdhani text-sm">24h Volume</span>
                        <span className="text-white font-rajdhani font-bold text-base">
                          $
                          {pool24hStats.volume24h.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    )}

                    {/* 24h Fee */}
                    {pool24hStats?.fees24h !== undefined && pool24hStats.fees24h > 0 && (
                      <div className="flex justify-between items-center border-b border-white/10 pb-2 sm:pb-1.5">
                        <span className="text-gray-400 font-rajdhani text-sm">24h Fee</span>
                        <span className="text-white font-rajdhani font-bold text-base">
                          $
                          {pool24hStats.fees24h.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <CreatePoolModal
        open={isCreatePoolModalOpen}
        onOpenChange={setIsCreatePoolModalOpen}
        token={token}
        onConfirm={handleCreatePool}
      />

      <AddLiquidityModal
        open={isAddLiquidityModalOpen}
        onOpenChange={setIsAddLiquidityModalOpen}
        token={token}
        positions={userPositions || []}
        onConfirm={handleAddLiquidity}
        connection={connection}
        poolAddress={poolAddress || ''}
        userPublicKey={publicKey}
      />
    </div>
  );
}
