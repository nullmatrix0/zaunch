'use client';

import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ExploreTokenCard from '@/components/ExploreTokenCard';
import { TAG_ICONS } from '@/components/modal/TagsSelectModal';
import { NoTokensFound } from '@/components/NoTokensFound';
import { TokenCardSkeleton } from '@/components/TokenCardSkeleton';
import { useOnChainSearch } from '@/hooks/useOnChainTokens';
import { useOnChainTokens } from '@/hooks/useOnChainTokens';

type TimeRangeType = 'all' | '24h' | '7d' | '30d' | '90d' | 'custom';
type Tab = 'LIVE' | 'UPCOMING' | 'ENDED';

export default function TokenSearch() {
  const [activeTab, setActiveTab] = useState<Tab>('LIVE');

  // Determine active filter for hooks based on tab
  const activeFilter = useMemo(() => {
    switch (activeTab) {
      case 'LIVE':
        return true;
      case 'UPCOMING':
      case 'ENDED':
        return false;
      default:
        return undefined;
    }
  }, [activeTab]);

  // Use on-chain search hook
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    tag,
    setTag,
    timeRange,
    setTimeRange,
    clearSearch,
    clearFilters,
  } = useOnChainSearch({
    active: activeFilter,
  });

  // Use on-chain tokens hook for default list (when not searching)
  const { tokens: defaultTokens, isLoading: isTokensLoading } = useOnChainTokens({
    tag,
    startDate: timeRange,
    active: activeFilter,
  });

  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRangeType>('all');

  const filteredDefaultTokens = useMemo(() => {
    if (activeTab === 'LIVE') return defaultTokens;

    const now = new Date();
    return defaultTokens.filter((token) => {
      // If token status is explicitly set
      if (token.status) {
        if (activeTab === 'UPCOMING')
          return token.status === 'upcoming' || token.status === 'pending';
        if (activeTab === 'ENDED') return token.status === 'ended' || token.status === 'completed';
      }

      return true;
    });
  }, [defaultTokens, activeTab]);

  const filteredSearchResults = useMemo(() => {
    if (activeTab === 'LIVE') return searchResults;

    // Apply same client-side filtering for search results if backend only filters by active=false
    return searchResults.filter((token) => {
      if (token.status) {
        if (activeTab === 'UPCOMING')
          return token.status === 'upcoming' || token.status === 'pending';
        if (activeTab === 'ENDED') return token.status === 'ended' || token.status === 'completed';
      }
      return true;
    });
  }, [searchResults, activeTab]);

  // Determine which tokens to display
  const displayTokens = defaultTokens;
  const isLoading = searchQuery.trim() ? isSearching : isTokensLoading;

  const handleTimeRangeChange = (range: TimeRangeType) => {
    setSelectedTimeRange(range);

    if (range === 'all') {
      setTimeRange(undefined);
    } else if (range === '24h') {
      const date = new Date();
      date.setHours(date.getHours() - 24);
      setTimeRange(date.toISOString());
    } else if (range === '7d') {
      const date = new Date();
      date.setDate(date.getDate() - 7);
      setTimeRange(date.toISOString());
    } else if (range === '30d') {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      setTimeRange(date.toISOString());
    } else if (range === '90d') {
      const date = new Date();
      date.setDate(date.getDate() - 90);
      setTimeRange(date.toISOString());
    }
  };

  const handleClearAll = () => {
    clearFilters();
    setSelectedTimeRange('all');
  };

  const getTimeRangeLabel = (range: TimeRangeType): string => {
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
  };

  return (
    <>
      <div className="flex flex-col gap-4 mb-8">
        {/* Search and Filters Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex-1 w-full sm:max-w-[727px]">
            <div className="relative">
              <input
                type="text"
                placeholder="SEARCH"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-3 pr-6 py-[10px] bg-transparent border border-[rgba(255,255,255,0.1)] text-sm font-share-tech-mono text-gray-500 placeholder-gray-500 uppercase tracking-[0.7px] focus:outline-none focus:border-[rgba(255,255,255,0.2)]"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {isLoading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-[14px]">
            <button
              onClick={() => setActiveTab('LIVE')}
              className={`px-[14.667px] py-[7.667px] border font-share-tech-mono text-[12.3px] leading-[17.5px] transition-colors ${
                activeTab === 'LIVE'
                  ? 'bg-[rgba(208,135,0,0.05)] border-[#d08700] text-[#d08700]'
                  : 'border-[rgba(255,255,255,0.1)] text-gray-500 hover:text-gray-400'
              }`}
            >
              LIVE
            </button>
            <button
              onClick={() => setActiveTab('UPCOMING')}
              className={`px-[14.667px] py-[7.667px] border font-share-tech-mono text-[12.3px] leading-[17.5px] transition-colors ${
                activeTab === 'UPCOMING'
                  ? 'bg-[rgba(208,135,0,0.05)] border-[#d08700] text-[#d08700]'
                  : 'border-[rgba(255,255,255,0.1)] text-gray-500 hover:text-gray-400'
              }`}
            >
              UPCOMING
            </button>
            <button
              onClick={() => setActiveTab('ENDED')}
              className={`px-[14.667px] py-[7.667px] border font-share-tech-mono text-[12.3px] leading-[17.5px] transition-colors ${
                activeTab === 'ENDED'
                  ? 'bg-[rgba(208,135,0,0.05)] border-[#d08700] text-[#d08700]'
                  : 'border-[rgba(255,255,255,0.1)] text-gray-500 hover:text-gray-400'
              }`}
            >
              ENDED
            </button>
          </div>
        </div>
        {(selectedTimeRange !== 'all' || tag) && (
          <div className="flex flex-wrap items-center gap-2">
            {selectedTimeRange !== 'all' && (
              <button
                onClick={() => handleTimeRangeChange('all')}
                className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm text-blue-700 transition hover:bg-blue-100"
              >
                <span>{getTimeRangeLabel(selectedTimeRange)}</span>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {tag && (
              <button
                onClick={() => setTag(undefined)}
                className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm text-blue-700 transition hover:bg-blue-100"
              >
                <span className="capitalize flex items-center gap-2">
                  <span>{TAG_ICONS[tag]}</span>
                  <span>{tag}</span>
                </span>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {(selectedTimeRange !== 'all' || tag) && (
              <button
                onClick={handleClearAll}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-600 transition hover:bg-gray-100 cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>
        )}
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
        <NoTokensFound
          searchQuery={searchQuery}
          className="pt-10"
          width="170px"
          height="170px"
          titleSize="text-[2rem]"
          subTitleSize="text-base"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayTokens.map((token) => (
            <ExploreTokenCard
              key={token.id}
              className="lg:max-w-[400px]"
              id={token.id.toString()}
              mint={token.mintAddress}
              banner={token.metadata?.bannerUri || token.metadata?.tokenUri || ''}
              avatar={token.metadata?.tokenUri || ''}
              name={token.name}
              symbol={token.symbol}
              description={token.description || ''}
              decimals={token.decimals}
              totalSupply={token.totalSupply}
              pricePerToken={(token as any).pricePerToken}
              amountToSell={(token as any).amountToSell}
              minAmountToSell={(token as any).minAmountToSell}
              totalClaimed={(token as any).totalClaimed || 0}
              actionButton={{
                text: `Buy $${token.symbol}`,
                variant: 'presale' as const,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
