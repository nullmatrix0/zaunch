import type { Token } from '@/types/api';

/**
 * In-memory cache for token data
 * This reduces the number of on-chain queries by storing data locally
 */
class TokenCache {
  private cache: Token[] = [];
  private lastUpdate: number = 0;
  private cacheDuration: number = 60 * 1000; // 1 minute default
  private isUpdating: boolean = false;
  private updatePromise: Promise<Token[]> | null = null;

  /**
   * Set cache duration in milliseconds
   */
  setCacheDuration(ms: number) {
    this.cacheDuration = ms;
  }

  /**
   * Get all cached tokens
   * Returns null if cache is empty or expired
   */
  getAll(): Token[] | null {
    if (this.cache.length === 0) {
      return null;
    }

    const now = Date.now();
    const isExpired = now - this.lastUpdate > this.cacheDuration;

    if (isExpired) {
      return null;
    }

    return this.cache;
  }

  /**
   * Update the cache with new token data
   */
  set(tokens: Token[]) {
    this.cache = tokens;
    this.lastUpdate = Date.now();
    this.isUpdating = false;
    this.updatePromise = null;
  }

  /**
   * Check if cache is valid (not expired)
   */
  isValid(): boolean {
    if (this.cache.length === 0) {
      return false;
    }

    const now = Date.now();
    return now - this.lastUpdate <= this.cacheDuration;
  }

  /**
   * Get cache age in milliseconds
   */
  getAge(): number {
    return Date.now() - this.lastUpdate;
  }

  /**
   * Clear the cache
   */
  clear() {
    this.cache = [];
    this.lastUpdate = 0;
    this.isUpdating = false;
    this.updatePromise = null;
  }

  /**
   * Mark that an update is in progress
   */
  setUpdating(promise: Promise<Token[]>) {
    this.isUpdating = true;
    this.updatePromise = promise;
  }

  /**
   * Check if an update is in progress
   */
  isCurrentlyUpdating(): boolean {
    return this.isUpdating;
  }

  /**
   * Get the current update promise if one exists
   */
  getUpdatePromise(): Promise<Token[]> | null {
    return this.updatePromise;
  }

  /**
   * Search tokens in cache
   */
  search(query: string): Token[] {
    if (!this.isValid()) {
      return [];
    }

    const queryLower = query.toLowerCase().trim();
    if (!queryLower) {
      return this.cache;
    }

    return this.cache.filter((token) => {
      return (
        token.name.toLowerCase().includes(queryLower) ||
        token.symbol.toLowerCase().includes(queryLower) ||
        token.description?.toLowerCase().includes(queryLower) ||
        token.mintAddress.toLowerCase().includes(queryLower)
      );
    });
  }

  /**
   * Filter tokens by various criteria
   */
  filter(options: {
    tag?: string;
    startDate?: string;
    endDate?: string;
    active?: boolean;
    owner?: string;
  }): Token[] {
    if (!this.isValid()) {
      return [];
    }

    let filtered = [...this.cache];

    // Filter by active status
    if (options.active !== undefined) {
      filtered = filtered.filter((token) => {
        if (options.active) {
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

    // Filter by tag
    if (options.tag) {
      filtered = filtered.filter((token) => {
        const description = token.description?.toLowerCase() || '';
        const tags = token.tags?.map((t: string) => t.toLowerCase()) || [];
        return (
          description.includes(options.tag!.toLowerCase()) ||
          tags.includes(options.tag!.toLowerCase())
        );
      });
    }

    // Filter by start date
    if (options.startDate) {
      const startDate = new Date(options.startDate);
      filtered = filtered.filter((token) => {
        const createdAt = new Date(token.createdAt);
        return createdAt >= startDate;
      });
    }

    // Filter by end date
    if (options.endDate) {
      const endDate = new Date(options.endDate);
      filtered = filtered.filter((token) => {
        const createdAt = new Date(token.createdAt);
        return createdAt <= endDate;
      });
    }

    // Filter by owner
    if (options.owner) {
      filtered = filtered.filter((token) => token.owner === options.owner);
    }

    return filtered;
  }

  /**
   * Get tokens sorted by various criteria
   */
  sort(tokens: Token[], sortBy: 'date' | 'name' | 'relevance' = 'date'): Token[] {
    const sorted = [...tokens];

    switch (sortBy) {
      case 'date':
        return sorted.sort((a, b) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

      case 'name':
        return sorted.sort((a, b) => {
          return a.name.localeCompare(b.name);
        });

      case 'relevance':
        // For now, relevance is same as date
        // Can be enhanced with scoring algorithm
        return sorted.sort((a, b) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

      default:
        return sorted;
    }
  }

  /**
   * Get statistics about the cache
   */
  getStats() {
    return {
      totalTokens: this.cache.length,
      lastUpdate: this.lastUpdate,
      age: this.getAge(),
      isValid: this.isValid(),
      isUpdating: this.isUpdating,
    };
  }
}

// Create a singleton instance
export const tokenCache = new TokenCache();

// Set default cache duration to 5 minutes (no auto-refresh, only on user load)
tokenCache.setCacheDuration(5 * 60 * 1000);
