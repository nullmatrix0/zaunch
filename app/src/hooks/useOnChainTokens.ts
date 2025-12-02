import { useCallback, useEffect, useState } from 'react';
import type { Token } from '@/types/token';
import { getAllLaunches } from '@/lib/queries';

interface UseOnChainTokensOptions {
  startDate?: string;
  endDate?: string;
  active?: boolean;
  searchQuery?: string;
}

interface UseOnChainTokensReturn {
  tokens: Token[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch tokens from on-chain data using Meteora DBC SDK
 * This replaces API calls with direct blockchain queries
 *
 * @param options - Filter and configuration options
 * @returns Token data, loading state, and refresh function
 */
export function useOnChainTokens(options: UseOnChainTokensOptions = {}): UseOnChainTokensReturn {
  const { startDate, active, searchQuery } = options;

  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTokens = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch from on-chain directly (no cache for now)
      console.log('Fetching tokens from blockchain...');
      const allLaunches = await getAllLaunches();

      console.log('Fetched tokens:', allLaunches.length);

      // Apply filters manually
      let filtered = [...allLaunches];

      // Filter by active status based on time
      if (active !== undefined) {
        const now = Date.now();
        filtered = filtered.filter((token) => {
          // Calculate status from start and end time
          const startTime = token.startTime
            ? typeof token.startTime === 'string'
              ? new Date(token.startTime).getTime()
              : Number(token.startTime) * 1000
            : 0;
          const endTime = token.endTime
            ? typeof token.endTime === 'string'
              ? new Date(token.endTime).getTime()
              : Number(token.endTime) * 1000
            : 0;

          // Determine actual status
          let actualStatus = 'live';
          if (startTime && endTime) {
            // If start time hasn't started → UPCOMING
            if (now < startTime) {
              actualStatus = 'upcoming';
            }
            // If start time has started and end time hasn't passed → LIVE
            else if (now >= startTime && now <= endTime) {
              actualStatus = 'live';
            }
            // If end time has passed → ENDED
            else {
              actualStatus = 'ended';
            }
          }

          if (active) {
            // LIVE tab: show only live tokens
            return actualStatus === 'live';
          } else {
            // For UPCOMING and ENDED tabs, show non-live tokens
            return actualStatus === 'upcoming' || actualStatus === 'ended';
          }
        });
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter((token) => {
          return (
            token.name.toLowerCase().includes(query) ||
            token.description?.toLowerCase().includes(query) ||
            token.tokenSymbol.toLowerCase().includes(query) ||
            token.tokenMint.toLowerCase().includes(query)
          );
        });
      }

      // Sort by creation date (newest first)
      const sortedTokens = filtered.sort((a, b) => {
        return Number(b.startTime) - Number(a.startTime);
      });

      setTokens(sortedTokens);
    } catch (err) {
      console.error('Error fetching on-chain tokens:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch tokens'));
      setTokens([]);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, active, searchQuery]);

  // Initial fetch only (no auto-refresh)
  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  return {
    tokens,
    isLoading,
    error,
    refresh: fetchTokens,
  };
}

export function useOnChainSearch(
  options: { owner?: string; debounceMs?: number; active?: boolean } = {},
) {
  const { owner, debounceMs = 300, active } = options;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Token[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [timeRange, setTimeRange] = useState<string | undefined>(undefined);

  const performSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setError(null);

      try {
        // Fetch from blockchain directly
        console.log('Fetching tokens for search...');
        const allLaunches = await getAllLaunches();

        // Search by query
        const queryLower = query.toLowerCase();
        const searchResults = allLaunches.filter((token) => {
          return (
            token.name.toLowerCase().includes(queryLower) ||
            token.tokenSymbol.toLowerCase().includes(queryLower) ||
            token.description?.toLowerCase().includes(queryLower) ||
            token.tokenMint.toLowerCase().includes(queryLower)
          );
        });

        // Apply additional filters
        let filtered = [...searchResults];

        if (active !== undefined) {
          const now = Date.now();
          filtered = filtered.filter((token) => {
            // Calculate status from start and end time
            const startTime = token.startTime
              ? typeof token.startTime === 'string'
                ? new Date(token.startTime).getTime()
                : Number(token.startTime) * 1000
              : 0;
            const endTime = token.endTime
              ? typeof token.endTime === 'string'
                ? new Date(token.endTime).getTime()
                : Number(token.endTime) * 1000
              : 0;

            // Determine actual status
            let actualStatus = 'live';
            if (startTime && endTime) {
              // If start time hasn't started → UPCOMING
              if (now < startTime) {
                actualStatus = 'upcoming';
              }
              // If start time has started and end time hasn't passed → LIVE
              else if (now >= startTime && now <= endTime) {
                actualStatus = 'live';
              }
              // If end time has passed → ENDED
              else {
                actualStatus = 'ended';
              }
            }

            if (active) {
              // LIVE tab: show only live tokens
              return actualStatus === 'live';
            } else {
              // For UPCOMING and ENDED tabs, show non-live tokens
              return actualStatus === 'upcoming' || actualStatus === 'ended';
            }
          });
        }

        if (timeRange) {
          const startDate = new Date(timeRange);
          filtered = filtered.filter((token) => {
            const createdAt = new Date(Number(token.startTime) * 1000);
            return createdAt >= startDate;
          });
        }

        if (owner) {
          filtered = filtered.filter((token) => token.creatorWallet === owner);
        }

        const finalResults = filtered;

        // Sort by relevance (exact matches first, then partial matches)
        const sorted = finalResults.sort((a, b) => {
          const queryLower = query.toLowerCase();
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();
          const aSymbol = a.tokenSymbol.toLowerCase();
          const bSymbol = b.tokenSymbol.toLowerCase();

          // Exact name match
          if (aName === queryLower && bName !== queryLower) return -1;
          if (aName !== queryLower && bName === queryLower) return 1;

          // Exact symbol match
          if (aSymbol === queryLower && bSymbol !== queryLower) return -1;
          if (aSymbol !== queryLower && bSymbol === queryLower) return 1;

          // Name starts with query
          if (aName.startsWith(queryLower) && !bName.startsWith(queryLower)) return -1;
          if (!aName.startsWith(queryLower) && bName.startsWith(queryLower)) return 1;

          // Symbol starts with query
          if (aSymbol.startsWith(queryLower) && !bSymbol.startsWith(queryLower)) return -1;
          if (!aSymbol.startsWith(queryLower) && bSymbol.startsWith(queryLower)) return 1;

          // Default to date sort (newest first)
          return Number(b.startTime) - Number(a.startTime);
        });

        setSearchResults(sorted);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [owner, timeRange, active],
  );

  // Debounced search effect
  useEffect(() => {
    if (searchQuery.trim()) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
      setSearchResults([]);
    }

    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch(searchQuery);
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, performSearch, debounceMs]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setError(null);
    setIsSearching(false);
  }, []);

  const clearFilters = useCallback(() => {
    setTimeRange(undefined);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    error,
    isSearching,
    timeRange,
    setTimeRange,
    clearSearch,
    clearFilters,
  };
}

export function useUserOnChainTokens(address?: string) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchUserTokens = useCallback(async () => {
    if (!address) {
      setTokens([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('Fetching tokens for user...');
      const allLaunches = await getAllLaunches();

      // Filter by owner
      const userTokens = allLaunches.filter((token) => token.creatorWallet === address);

      // Sort by creation date (newest first)
      const sorted = userTokens.sort((a, b) => {
        return Number(b.startTime) - Number(a.startTime);
      });

      setTokens(sorted);
    } catch (err) {
      console.error('Error fetching user tokens:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch user tokens'));
      setTokens([]);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchUserTokens();
  }, [fetchUserTokens]);

  return {
    tokens,
    isLoading,
    error,
    refresh: fetchUserTokens,
  };
}
