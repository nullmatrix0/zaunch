// 1Click API Integration for Cross-Chain Swaps to ZEC
// API Documentation: https://1click.chaindefuser.com

const ONECLICK_API_BASE = 'https://1click.chaindefuser.com/v0';

// Supported blockchain addresses for refunds
export const BLOCKCHAIN_ADDRESSES = {
  btc: 'bc1q0fnht2ngtaeexp3gypd55k5ejfwxtgxmdmx0gh',
  zec: 'u1emhhzu6ddmfay5sxx7qj6ptty6vxwdmg54865d547syghnl22k8zeptj9jhuz64p9kshqe6s7jn8gdpatn96wtdwrgcvsaljtv6tqt7g',
  ton: 'UQCl-Z6_RKnINhWTZIIzysIGjyZTcJsRscdaKP-Oof-PfOne',
  doge: 'DHpEpCboQcnxNWpVknvc9dpx3Q1TeHmUH',
  sol: 'BK3HqkkH9T8QSsiXDvWSdfYEojviAHrhqeCXP1zvADbU',
  near: 'zaunch.near',
  xrp: 'rsGvT1oyqRx5Ls6qmq6Q3Tuh8GCFLZVPxM',
  sui: '0x27e5a115617a8c2c4dfb5da3f3a88d70cfae7bf59cfc739a60792db15e31656c',
};

export const EVM_ADDRESS = '0x88B93d4D440155448fbB3Cf260208b75FC0117C0';
export const EVM_CHAINS = [
  'evm',
  'eth',
  'arb',
  'arbitrum',
  'gnosis',
  'base',
  'bera',
  'pol',
  'tron',
  'avax',
  'op',
];

// Token interface from 1Click API
export interface OneClickToken {
  blockchain: string;
  symbol: string;
  assetId: string;
  decimals: number;
  price: number;
}

// Quote request parameters
export interface QuoteRequest {
  originAsset: string; // e.g., "solana:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  destinationAsset: string; // e.g., "zec:..." for ZEC
  amount: string; // Amount in smallest unit (with decimals applied)
  recipient: string; // Creator's wallet address (ZEC address)
  refundTo: string; // User's refund address on origin chain
  slippageTolerance?: number; // Default: 100 (1%)
  appFees?: Array<{ recipient: string; fee: number }>; // Fee in basis points
}

// Quote response - matches 1Click API response structure
export interface QuoteResponse {
  quote: {
    depositAddress: string;
    depositMemo?: string;
    deadline?: string;
    amountIn: string;
    amountInFormatted: string;
    amountInUsd: string;
    minAmountIn?: string;
    amountOut: string;
    amountOutFormatted: string;
    amountOutUsd: string;
    minAmountOut: string;
    minAmountOutFormatted?: string;
    timeEstimate?: number;
    timeWhenInactive?: string;
  };
}

// Status response
export interface StatusResponse {
  status: 'SUCCESS' | 'PENDING' | 'INCOMPLETE_DEPOSIT' | 'FAILED' | 'REFUNDED';
  swapDetails?: {
    amountOutFormatted: string;
    amountInUsd: string;
    receivedAmountFormatted?: string;
    nearTxHashes?: string[];
  };
  isComplete: boolean;
  isSuccess: boolean;
  isFailed: boolean;
  receivedAmountFormatted?: string;
}

/**
 * Fetch all available tokens from 1Click API
 */
export async function fetchAvailableTokens(): Promise<OneClickToken[]> {
  try {
    const response = await fetch(`${ONECLICK_API_BASE}/tokens`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tokens: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching tokens:', error);
    throw error;
  }
}

/**
 * Get unique blockchains from token list
 */
export function getUniqueBlockchains(tokens: OneClickToken[]): string[] {
  return [...new Set(tokens.map((token) => token.blockchain))];
}

/**
 * Get tokens for a specific blockchain
 */
export function getTokensByBlockchain(
  tokens: OneClickToken[],
  blockchain: string,
): OneClickToken[] {
  return tokens.filter(
    (token) =>
      token.blockchain.toLowerCase() === blockchain.toLowerCase() &&
      token.symbol !== 'TESTNEBULA' &&
      token.symbol !== 'wNEAR',
  );
}

/**
 * Convert amount to smallest unit using decimals
 */
export function convertToUnit(amount: string | number, decimals: number): string {
  const amountStr = typeof amount === 'number' ? amount.toString() : amount.trim();
  if (parseFloat(amountStr) === 0) return '0';

  const [integerPart, fractionalPart = ''] = amountStr.split('.');
  const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals);
  const combined = integerPart + paddedFractional;

  return combined.replace(/^0+/, '') || '0';
}

/**
 * Calculate fee in basis points
 */
export function calculateBasisPoints(feeAmount: number, totalAmount: number): number {
  if (totalAmount === 0) {
    throw new Error('Total amount cannot be zero.');
  }
  const basisPoints = (feeAmount / totalAmount) * 10000;
  return Math.round(basisPoints);
}

/**
 * Get refund address based on blockchain type
 */
export function getRefundAddress(blockchain: string): string | null {
  const normalized = blockchain.toLowerCase();

  if (EVM_CHAINS.includes(normalized)) {
    return EVM_ADDRESS;
  }

  return BLOCKCHAIN_ADDRESSES[normalized as keyof typeof BLOCKCHAIN_ADDRESSES] || null;
}

/**
 * Generate deadline timestamp (1 hour from now)
 */
export function generateDeadline(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString().split('.')[0] + 'Z';
}

/**
 * Create a swap quote for token to ZEC
 */
export async function createSwapQuote(params: QuoteRequest): Promise<QuoteResponse> {
  try {
    const deadline = generateDeadline();

    const requestBody = {
      dry: false,
      swapType: 'FLEX_INPUT',
      slippageTolerance: params.slippageTolerance || 100,
      originAsset: params.originAsset,
      depositType: 'ORIGIN_CHAIN',
      destinationAsset: params.destinationAsset,
      amount: params.amount,
      refundTo: params.refundTo,
      refundType: 'ORIGIN_CHAIN',
      recipient: params.recipient,
      recipientType: 'DESTINATION_CHAIN',
      deadline: deadline,
      referral: 'referral',
      quoteWaitingTimeMs: 3000,
      appFees: params.appFees || [],
    };
    console.log('[1Click] Quote request:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${ONECLICK_API_BASE}/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[1Click] Quote error:', response.status, errorText);
      throw new Error(`Failed to create quote: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating swap quote:', error);
    throw error;
  }
}

/**
 * Check swap status by deposit address
 */
export async function checkSwapStatus(depositAddress: string): Promise<StatusResponse> {
  try {
    const response = await fetch(
      `${ONECLICK_API_BASE}/status?depositAddress=${depositAddress}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to check status: ${response.status}`);
    }

    const data = await response.json();

    // Normalize the response
    return {
      status: data.status,
      swapDetails: data.swapDetails,
      isComplete: data.status === 'SUCCESS' || data.status === 'FAILED' || data.status === 'REFUNDED',
      isSuccess: data.status === 'SUCCESS',
      isFailed: data.status === 'FAILED',
      receivedAmountFormatted: data.swapDetails?.amountOutFormatted,
    };
  } catch (error) {
    console.error('Error checking swap status:', error);
    throw error;
  }
}

/**
 * Get ZEC token from available tokens
 */
export async function getZecToken(): Promise<OneClickToken | null> {
  try {
    const tokens = await fetchAvailableTokens();
    const zecToken = tokens.find(
      (token) => token.blockchain.toLowerCase() === 'zcash' || token.symbol === 'ZEC',
    );
    return zecToken || null;
  } catch (error) {
    console.error('Error getting ZEC token:', error);
    return null;
  }
}

/**
 * Estimate swap output (for display purposes)
 */
export async function estimateSwap(
  originAsset: string,
  destinationAsset: string,
  amount: string,
  recipientAddress: string,
  refundAddress: string,
): Promise<{
  expectedOut: string;
  minAmountOut: string;
  timeEstimate: number;
  estimatedValueUsd: string;
} | null> {
  try {
    // Create a quote to get estimates
    const quote = await createSwapQuote({
      originAsset,
      destinationAsset,
      amount,
      recipient: recipientAddress,
      refundTo: refundAddress,
    });

    return {
      expectedOut: quote.quote.amountOutFormatted,
      minAmountOut: quote.quote.minAmountOut,
      timeEstimate: quote.quote.timeEstimate || 60,
      estimatedValueUsd: quote.quote.amountOutUsd || quote.quote.amountInUsd,
    };
  } catch (error) {
    console.error('Error estimating swap:', error);
    return null;
  }
}

