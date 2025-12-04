'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { ChevronDown, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MyTokenCard } from '@/components/MyTokenCard';
import { NoTokensFound } from '@/components/NoTokensFound';
import { TokenCardSkeleton } from '@/components/TokenCardSkeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TicketVaultContent } from '@/components/token/TicketVaultContent';
import { useOnChainSearch, useUserOnChainTokens } from '@/hooks/useOnChainTokens';
import { getSolPrice, getTokenBalanceOnSOL } from '@/lib/sol';

interface MyTokensClientProps {
  solPrice: number;
}

type TimeRangeType = 'all' | '24h' | '7d' | '30d' | '90d' | 'custom';

export default function MyTokensClient({ solPrice: initialSolPrice }: MyTokensClientProps) {
  const { publicKey } = useWallet();
  const router = useRouter();
  const [solPrice, setSolPrice] = useState<number>(initialSolPrice);
  const [portfolioValue, setPortfolioValue] = useState<number>(0);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRangeType>('all');

  // Use the on-chain search hook with owner filter
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    error: searchError,
    timeRange,
    setTimeRange,
    clearSearch,
    clearFilters: clearSearchFilters,
  } = useOnChainSearch({
    owner: publicKey?.toBase58(),
    debounceMs: 500,
  });

  const handleTimeRangeChange = useCallback(
    (range: TimeRangeType) => {
      setSelectedTimeRange(range);

      if (range === 'all') {
        setTimeRange(undefined);
      } else {
        const date = new Date();
        if (range === '24h') {
          date.setHours(date.getHours() - 24);
        } else if (range === '7d') {
          date.setDate(date.getDate() - 7);
        } else if (range === '30d') {
          date.setDate(date.getDate() - 30);
        } else if (range === '90d') {
          date.setDate(date.getDate() - 90);
        }
        setTimeRange(date.toISOString());
      }
    },
    [setTimeRange],
  );

  const getTimeRangeLabel = useCallback((range: TimeRangeType): string => {
    switch (range) {
      case '24h':
        return '24 Hours';
      case '7d':
        return '7 Days';
      case '30d':
        return '30 Days';
      case '90d':
        return '90 Days';
      case 'custom':
        return 'Custom';
      default:
        return 'All Time';
    }
  }, []);

  const handleClearFilters = useCallback(() => {
    setSelectedTimeRange('all');
    setTimeRange(undefined);
    clearSearchFilters();
  }, [clearSearchFilters, setTimeRange]);

  const fetchSolPrice = useCallback(async () => {
    const solPrice = await getSolPrice();
    setSolPrice(solPrice || 0);
  }, []);

  const {
    tokens: listTokens,
    isLoading: loading,
    error,
    refresh: refreshTokens,
  } = useUserOnChainTokens(publicKey?.toBase58());

  // Calculate portfolio value
  const calculatePortfolioValue = useCallback(async () => {
    if (!publicKey || !solPrice) return;

    try {
      let totalValue = 0;

      for (const token of listTokens) {
        try {
          // Get user's balance
          const balance = await getTokenBalanceOnSOL(token.tokenMint, publicKey.toBase58());

          if (balance > 0) {
            // Calculate value
            const tokenValue = balance;
            totalValue += tokenValue;
          }
        } catch (error) {
          console.error(`Error calculating value for token ${token.tokenMint}:`, error);
        }
      }

      setPortfolioValue(totalValue);
    } catch (error) {
      console.error('Error calculating portfolio value:', error);
    }
  }, [publicKey, solPrice, listTokens]);

  useEffect(() => {
    fetchSolPrice();
  }, [fetchSolPrice]);

  useEffect(() => {
    if (listTokens.length > 0) {
      calculatePortfolioValue();
    }
  }, [listTokens, calculatePortfolioValue]);

  const filteredTokens = useMemo(() => {
    let filtered = [...listTokens];

    if (timeRange) {
      const filterDate = new Date(timeRange);
      filtered = filtered.filter((token) => {
        const tokenDate = new Date(Number(token.startTime) * 1000);
        return tokenDate.getTime() >= filterDate.getTime();
      });
    }

    return filtered;
  }, [listTokens, timeRange]);

  const filteredSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    let filtered = [...searchResults];

    if (timeRange) {
      const filterDate = new Date(timeRange);
      filtered = filtered.filter((token) => {
        const tokenDate = new Date(Number(token.startTime) * 1000);
        return tokenDate.getTime() >= filterDate.getTime();
      });
    }

    return filtered;
  }, [searchResults, timeRange, searchQuery]);

  const displayTokens = searchQuery.trim() && !isSearching ? filteredSearchResults : filteredTokens;

  const totalTokens = displayTokens.length;

  if (!publicKey) {
    return (
      <div className="min-h-screen py-6 md:py-10 bg-[#050505]">
        <div className="max-w-[1280px] mx-auto px-4">
          <div className="flex flex-col gap-4 items-start mb-6">
            <div className="flex flex-col gap-2 items-start">
              <h1 className="text-2xl md:text-3xl font-rajdhani font-bold text-white leading-tight">
                MY COMMAND CENTRE
              </h1>
              <p className="text-sm md:text-base font-rajdhani text-gray-400 leading-relaxed">
                Manage assets, claims, and deployments.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <h3 className="text-lg md:text-xl font-semibold text-gray-300 mb-2 font-rajdhani">
              Solana wallet not connected
            </h3>
            <p className="text-sm md:text-base text-gray-500 mb-6 max-w-md px-4 font-rajdhani">
              Connect your Solana wallet to view and manage your tokens.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen py-6 md:py-10 w-full bg-[#050505]">
        <div className="max-w-[1280px] mx-auto px-4 w-full">
          <div className="flex flex-col gap-4 items-start mb-6">
            <div className="flex flex-col gap-2 items-start">
              <h1 className="text-2xl md:text-3xl font-rajdhani font-bold text-white leading-tight">
                MY COMMAND CENTRE
              </h1>
              <p className="text-sm md:text-base font-rajdhani text-gray-400 leading-relaxed">
                Manage assets, claims, and deployments.
              </p>
            </div>
            {/* <Tabs defaultValue="tokens" className="w-full">
              <TabsList className="border border-[rgba(255,255,255,0.1)] h-[45px] bg-transparent p-[4px] w-[414px]">
                <TabsTrigger
                  value="tokens"
                  className="data-[state=active]:bg-[rgba(27,31,38,0.72)] data-[state=active]:text-gray-300 text-gray-400 font-rajdhani font-medium text-xs sm:text-sm px-3 sm:px-4 py-1.5"
                >
                  MY TOKENS
                </TabsTrigger>
                <TabsTrigger
                  value="vault"
                  disabled
                  className="data-[state=active]:bg-[#d08700] data-[state=active]:text-black text-gray-400 font-rajdhani font-bold text-xs sm:text-sm px-3 sm:px-4 py-1.5"
                >
                  MY TICKET VAULT
                </TabsTrigger>
              </TabsList>
            </Tabs> */}
          </div>

          <div className="flex flex-col gap-2 mb-6 md:mb-8">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search your tokens..."
                  disabled
                  className="w-full px-3 py-2.5 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-none text-sm md:text-base font-medium text-gray-400 placeholder-gray-600 cursor-not-allowed font-rajdhani"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {[...Array(3)].map((_, index) => (
              <TokenCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Removed empty listTokens check - we now show tabs even when no launches exist
  // Users might have tickets without having created launches

  return (
    <div className="min-h-screen py-6 md:py-10 bg-[#050505]">
      <div className="max-w-[1280px] mx-auto px-4">
        <div className="flex flex-col gap-4 items-start mb-6">
          <div className="flex flex-col gap-2 items-start">
            <h1 className="text-2xl md:text-3xl font-rajdhani font-bold text-white leading-tight">
              MY COMMAND CENTRE
            </h1>
            <p className="text-sm md:text-base font-rajdhani text-gray-400 leading-relaxed">
              Manage assets, claims, and deployments.
            </p>
          </div>
          <Tabs defaultValue="tickets" className="w-full">
            <TabsList className="border border-[rgba(255,255,255,0.1)] h-10 bg-transparent p-1 w-full md:w-[400px]">
              <TabsTrigger
                value="tickets"
                className="flex-1 data-[state=active]:bg-[#d08700] data-[state=active]:text-black text-gray-400 font-rajdhani font-bold text-xs sm:text-sm px-3 sm:px-4 py-1.5 transition-colors"
              >
                MY TICKETS
              </TabsTrigger>
              <TabsTrigger
                value="launches"
                className="flex-1 data-[state=active]:bg-[rgba(27,31,38,0.72)] data-[state=active]:text-white text-gray-400 font-rajdhani font-medium text-xs sm:text-sm px-3 sm:px-4 py-1.5 transition-colors"
              >
                MY LAUNCHES
              </TabsTrigger>
            </TabsList>
            <TabsContent value="tickets" className="mt-4">
              <TicketVaultContent />
            </TabsContent>
            <TabsContent value="launches" className="mt-4">
              <div className="flex flex-col gap-2 mb-4">
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search your launches..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-none text-base font-medium text-white placeholder-gray-500 focus:outline-none focus:border-[#d08700] font-rajdhani"
                    />
                    {searchQuery && (
                      <button
                        onClick={clearSearch}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {isSearching && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#d08700]"></div>
                      </div>
                    )}
                  </div>
                </div>

                {selectedTimeRange !== 'all' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleTimeRangeChange('all')}
                      className="inline-flex items-center gap-1.5 sm:gap-2 rounded-none border border-[rgba(208,135,0,0.5)] bg-[rgba(208,135,0,0.1)] px-2.5 sm:px-3 py-1 text-xs sm:text-sm text-[#d08700] transition hover:bg-[rgba(208,135,0,0.2)] cursor-pointer font-rajdhani uppercase"
                    >
                      <span>{getTimeRangeLabel(selectedTimeRange)}</span>
                      <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </button>
                    <button
                      onClick={handleClearFilters}
                      className="inline-flex items-center gap-1.5 sm:gap-2 rounded-none border border-[rgba(255,255,255,0.1)] bg-transparent px-2.5 sm:px-3 py-1 text-xs sm:text-sm text-gray-400 transition hover:bg-[rgba(255,255,255,0.05)] hover:text-white cursor-pointer font-rajdhani uppercase"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4">
                {searchQuery.trim() && isSearching ? (
                  [...Array(3)].map((_, index) => <TokenCardSkeleton key={index} />)
                ) : searchQuery.trim() && !isSearching && searchResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center px-4 py-20">
                    <NoTokensFound
                      searchQuery={searchQuery}
                      className="pt-3"
                      width="170px"
                      height="170px"
                      titleSize="text-[2rem]"
                      subTitleSize="text-base"
                    />
                  </div>
                ) : displayTokens.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center px-4 py-20">
                    <NoTokensFound
                      searchQuery=""
                      className="pt-3"
                      width="170px"
                      height="170px"
                      titleSize="text-[2rem]"
                      subTitleSize="text-base"
                    />
                    <button
                      onClick={() => router.push('/create')}
                      className="bg-[#d08700] hover:bg-[#e89600] text-black px-4 sm:px-6 py-2.5 sm:py-3 rounded-none text-sm sm:text-base font-medium transition-colors duration-200 font-rajdhani uppercase mt-6"
                    >
                      Create Your First Launch
                    </button>
                  </div>
                ) : (
                  displayTokens?.map((token) => (
                    <MyTokenCard
                      key={token.address}
                      className="w-full"
                      id={token.address}
                      user={publicKey}
                      mint={token.address}
                      decimals={token.decimals}
                      totalSupply={token.totalSupply.toString()}
                      tokenUri={token.tokenUri}
                      name={token.tokenName}
                      symbol={token.tokenSymbol}
                      description={token.description || ''}
                      pricePerToken={token.pricePerToken}
                      amountToSell={token.amountToSell}
                      minAmountToSell={token.minAmountToSell}
                      totalClaimed={token.totalClaimed || 0}
                      startTime={token.startTime.toString()}
                      endTime={token.endTime.toString()}
                    />
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
