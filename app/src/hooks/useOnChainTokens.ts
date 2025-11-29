import { useCallback, useEffect, useState } from 'react';
import type { Token } from '@/types/api';
import { getAllLaunches } from '@/lib/onchain-launch';


interface UseOnChainTokensOptions {
  tag?: string;
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
export function useOnChainTokens(
  options: UseOnChainTokensOptions = {},
): UseOnChainTokensReturn {
  const { tag, startDate, active, searchQuery } = options;

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

      // Filter by active status
      if (active !== undefined) {
        filtered = filtered.filter((token) => {
          if (active) {
            return token.status === 'live' || token.status === 'pending';
          } else {
            return (
              token.status === 'upcoming' ||
              token.status === 'ended' ||
              token.status === 'completed'
            );
          }
        });
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter((token) => {
          return (
            token.name.toLowerCase().includes(query) ||
            token.symbol.toLowerCase().includes(query) ||
            token.description?.toLowerCase().includes(query) ||
            token.mintAddress.toLowerCase().includes(query)
          );
        });
      }

      // Sort by creation date (newest first)
      const sortedTokens = filtered.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setTokens(sortedTokens);
    } catch (err) {
      console.error('Error fetching on-chain tokens:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch tokens'));
      setTokens([]);
    } finally {
      setIsLoading(false);
    }
  }, [tag, startDate, active, searchQuery]);

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

/**
 * Hook to search tokens on-chain with debouncing
 * This replaces the API-based search with on-chain queries
 */
export function useOnChainSearch(options: {
  owner?: string;
  debounceMs?: number;
  active?: boolean;
} = {}) {
  const { owner, debounceMs = 300, active } = options;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Token[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [tag, setTag] = useState<string | undefined>(undefined);
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
            token.symbol.toLowerCase().includes(queryLower) ||
            token.description?.toLowerCase().includes(queryLower) ||
            token.mintAddress.toLowerCase().includes(queryLower)
          );
        });

        // Apply additional filters
        let filtered = [...searchResults];

        if (active !== undefined) {
          filtered = filtered.filter((token) => {
            if (active) {
              return token.status === 'live' || token.status === 'pending';
            } else {
              return (
                token.status === 'upcoming' ||
                token.status === 'ended' ||
                token.status === 'completed'
              );
            }
          });
        }

        if (tag) {
          filtered = filtered.filter((token) => {
            const description = token.description?.toLowerCase() || '';
            const tags = token.tags?.map((t: string) => t.toLowerCase()) || [];
            return (
              description.includes(tag.toLowerCase()) || tags.includes(tag.toLowerCase())
            );
          });
        }

        if (timeRange) {
          const startDate = new Date(timeRange);
          filtered = filtered.filter((token) => {
            const createdAt = new Date(token.createdAt);
            return createdAt >= startDate;
          });
        }

        if (owner) {
          filtered = filtered.filter((token) => token.owner === owner);
        }

        const finalResults = filtered;

        // Sort by relevance (exact matches first, then partial matches)
        const sorted = finalResults.sort((a, b) => {
          const queryLower = query.toLowerCase();
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();
          const aSymbol = a.symbol.toLowerCase();
          const bSymbol = b.symbol.toLowerCase();

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
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        setSearchResults(sorted);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [owner, tag, timeRange, active],
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
    setTag(undefined);
    setTimeRange(undefined);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    error,
    isSearching,
    tag,
    setTag,
    timeRange,
    setTimeRange,
    clearSearch,
    clearFilters,
  };
}

/**
 * Hook to get user's created tokens from on-chain data
 */
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
      const userTokens = allLaunches.filter((token) => token.owner === address);

      // Sort by creation date (newest first)
      const sorted = userTokens.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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
