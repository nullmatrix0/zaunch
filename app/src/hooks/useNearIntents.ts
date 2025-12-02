/**
 * useNearIntents - React Hook for NEAR Intents
 *
 * This hook provides a convenient way to use NEAR Intents in React components.
 * It handles initialization and provides the NearIntents instance.
 */

import { useMemo } from 'react';
import { createNearIntents, NearIntents } from '@/lib/intents';

/**
 * React hook that provides a NearIntents instance
 *
 * Returns null if JWT token is not configured, allowing components to handle
 * the missing dependency gracefully instead of crashing.
 *
 * Usage:
 * ```tsx
 * const nearIntents = useNearIntents();
 *
 * if (!nearIntents) {
 *   // Handle missing configuration
 *   return <div>NEAR Intents not configured</div>;
 * }
 *
 * const quote = await nearIntents.getPaymentQuote({
 *   amount: "1000000000000000000000000",
 *   paymentToken: "wNEAR",
 *   receiveToken: "SOL",
 *   recipientAddress: solanaAddress,
 *   refundAddress: nearAddress
 * });
 * ```
 */
export function useNearIntents(): NearIntents | null {
  const nearIntents = useMemo(() => {
    try {
      return createNearIntents();
    } catch (error) {
      console.warn('Failed to initialize NEAR Intents:', error);
      // Return null instead of throwing to allow graceful degradation
      // Components should check for null before using nearIntents
      return null;
    }
  }, []);

  return nearIntents;
}

export default useNearIntents;
