import { useMemo } from 'react';
import { ONECLICK_API_BASE_URL, ONECLICK_JWT_TOKEN } from '@/configs/env.config';
import { NearIntents } from '@/lib/intents';

/**
 * Hook to initialize and use the NearIntents SDK
 * Creates a singleton instance of NearIntents for use throughout the app
 */
export const useNearIntents = () => {
  const nearIntents = useMemo(() => {
    if (!ONECLICK_JWT_TOKEN) {
      console.warn('ONECLICK_JWT_TOKEN is not set. NearIntents functionality will be limited.');
    }
    return new NearIntents(ONECLICK_JWT_TOKEN, ONECLICK_API_BASE_URL);
  }, []);

  return nearIntents;
};
