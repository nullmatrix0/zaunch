'use client';

import { X, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import ExploreTokenCard from '@/components/ExploreTokenCard';
import { NoTokensFound } from '@/components/NoTokensFound';
import { TokenCardSkeleton } from '@/components/TokenCardSkeleton';
import { useOnChainSearch } from '@/hooks/useOnChainTokens';
import { useOnChainTokens } from '@/hooks/useOnChainTokens';

type Tab = 'ALL' | 'SALE LIVE' | 'CLAIM LIVE' | 'UPCOMING';

export default function TokenSearch() {
  const [activeTab, setActiveTab] = useState<Tab>('ALL');

  const activeFilter = undefined;

  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    clearSearch,
    clearFilters,
  } = useOnChainSearch({
    active: activeFilter,
  });

  // Use on-chain tokens hook for default list (when not searching)
  const { tokens: defaultTokens, isLoading: isTokensLoading } = useOnChainTokens({
    startDate: undefined,
    active: activeFilter,
  });

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

  /**
   * Check if a token is in the claim period.
   * Claim period starts immediately after the sale ends (when now > endTime).
   * There's no explicit claim end time, so the claim period is indefinite.
   * 
   * @param token - The token object with startTime and endTime
   * @returns true if the token is in the claim period, false otherwise
   */
  const isInClaimPeriod = (token: any): boolean => {
    if (!token.endTime) return false;
    
    const now = Date.now();
    const endTime = parseTime(token.endTime);
    
    // Claim period starts when sale ends (now > endTime)
    return now > endTime;
  };

  const getTokenStatus = (token: any): 'upcoming' | 'sale-live' | 'claim-live' | 'ended' => {
    if (!token.startTime || !token.endTime) return 'sale-live';

    const now = Date.now();
    const startTime = parseTime(token.startTime);
    const endTime = parseTime(token.endTime);

    if (now < startTime) {
      return 'upcoming';
    }
    else if (now >= startTime && now <= endTime) {
      return 'sale-live';
    }
    else if (isInClaimPeriod(token)) {
      return 'claim-live';
    }
    else {
      return 'ended';
    }
  };

  const filteredDefaultTokens = useMemo(() => {
    return defaultTokens.filter((token) => {
      if (activeTab === 'ALL') return true;
      const status = getTokenStatus(token);
      if (activeTab === 'SALE LIVE') return status === 'sale-live';
      if (activeTab === 'CLAIM LIVE') return status === 'claim-live';
      if (activeTab === 'UPCOMING') return status === 'upcoming';
      return true;
    });
  }, [defaultTokens, activeTab]);

  const filteredSearchResults = useMemo(() => {
    return searchResults.filter((token) => {
      if (activeTab === 'ALL') return true;
      const status = getTokenStatus(token);
      if (activeTab === 'SALE LIVE') return status === 'sale-live';
      if (activeTab === 'CLAIM LIVE') return status === 'claim-live';
      if (activeTab === 'UPCOMING') return status === 'upcoming';
      return true;
    });
  }, [searchResults, activeTab]);

  // Determine which tokens to display
  const displayTokens = searchQuery.trim() ? filteredSearchResults : filteredDefaultTokens;
  const isLoading = searchQuery.trim() ? isSearching : isTokensLoading;

  return (
    <>
      <div className="flex flex-col gap-4 mb-8">
        {/* Search and Filters Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex-1 w-full sm:max-w-[727px]">
            <div className="relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="SEARCH"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-11 pr-12 py-3 bg-transparent border border-[rgba(255,255,255,0.1)] text-sm font-share-tech-mono text-gray-500 placeholder-gray-500 tracking-[0.7px] focus:outline-none focus:border-[rgba(255,255,255,0.2)]"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              {isLoading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-[14px]">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-[14.667px] py-[7.667px] border font-share-tech-mono text-[12.3px] leading-[17.5px] transition-colors cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-[rgba(208,135,0,0.05)] border-[#d08700] text-[#d08700]'
                  : 'border-[rgba(255,255,255,0.1)] text-gray-500 hover:text-gray-400'
              }`}
            >
              ALL
            </button>
            <button
              onClick={() => setActiveTab('SALE LIVE')}
              className={`px-[14.667px] py-[7.667px] border font-share-tech-mono text-[12.3px] leading-[17.5px] transition-colors cursor-pointer ${
                activeTab === 'SALE LIVE'
                  ? 'bg-[rgba(208,135,0,0.05)] border-[#d08700] text-[#d08700]'
                  : 'border-[rgba(255,255,255,0.1)] text-gray-500 hover:text-gray-400'
              }`}
            >
              SALE LIVE
            </button>
            <button
              onClick={() => setActiveTab('CLAIM LIVE')}
              className={`px-[14.667px] py-[7.667px] border font-share-tech-mono text-[12.3px] leading-[17.5px] transition-colors cursor-pointer ${
                activeTab === 'CLAIM LIVE'
                  ? 'bg-[rgba(208,135,0,0.05)] border-[#d08700] text-[#d08700]'
                  : 'border-[rgba(255,255,255,0.1)] text-gray-500 hover:text-gray-400'
              }`}
            >
              CLAIM LIVE
            </button>
            <button
              onClick={() => setActiveTab('UPCOMING')}
              className={`px-[14.667px] py-[7.667px] border font-share-tech-mono text-[12.3px] leading-[17.5px] transition-colors cursor-pointer ${
                activeTab === 'UPCOMING'
                  ? 'bg-[rgba(208,135,0,0.05)] border-[#d08700] text-[#d08700]'
                  : 'border-[rgba(255,255,255,0.1)] text-gray-500 hover:text-gray-400'
              }`}
            >
              UPCOMING
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, index) => (
              <TokenCardSkeleton key={index} />
            ))}
          </div>
        </div>
      ) : displayTokens.length === 0 ? (
        <div className='relative'>
          <NoTokensFound
            searchQuery={searchQuery}
            className=""
            width="170px"
            height="170px"
            titleSize="text-[2rem]"
            subTitleSize="text-base"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayTokens.map((token) => (
            <ExploreTokenCard
              key={token.address}
              className="lg:max-w-[400px]"
              id={token.address}
              mint={token.address}
              tokenUri={token.tokenUri}
              name={token.tokenName}
              symbol={token.tokenSymbol}
              description={token.description || ''}
              decimals={token.decimals}
              totalSupply={token.totalSupply.toString()}
              pricePerToken={(token as any).pricePerToken}
              pricePerTicket={(token as any).pricePerTicket}
              totalTickets={(token as any).totalTickets}
              tokensPerProof={(token as any).tokensPerProof}
              amountToSell={(token as any).amountToSell}
              minAmountToSell={(token as any).minAmountToSell}
              totalClaimed={(token as any).totalClaimed || 0}
              verifiedProofsCount={(token as any).verifiedProofsCount || 0}
              startTime={token.startTime.toString()}
              endTime={token.endTime.toString()}
            />
          ))}
        </div>
      )}
    </>
  );
}
