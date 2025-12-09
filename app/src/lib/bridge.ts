/**
 * DeBridge Cross-Chain Bridge Library
 * 
 * This library provides functions to bridge tokens from Solana to other chains
 * using the DeBridge DLN (Liquidity Network) API.
 * 
 * Documentation: https://docs.debridge.finance/
 * API Base: Configured via NEXT_PUBLIC_DEBRIDGE_DLN_API_BASE
 * Stats API: Configured via NEXT_PUBLIC_DEBRIDGE_STATS_API_BASE
 */

import { Connection, VersionedTransaction, PublicKey } from '@solana/web3.js';
import { DEBRIDGE_DLN_API_BASE, DEBRIDGE_STATS_API_BASE } from '@/configs/env.config';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * DeBridge Chain IDs
 * Full list: https://docs.debridge.finance/dln-details/overview/fees-supported-chains
 */
export enum ChainId {
  // EVM Chains
  ETHEREUM = 1,
  BSC = 56,
  POLYGON = 137,
  AVALANCHE = 43114,
  ARBITRUM = 42161,
  OPTIMISM = 10,
  BASE = 8453,
  LINEA = 59144,
  FANTOM = 250,
  
  // Non-EVM Chains
  SOLANA = 7565164,
  // Note: NEAR support might use a different integration pattern
}

/**
 * Supported chains map for easy lookup
 */
export const SUPPORTED_CHAINS = {
  ethereum: { id: ChainId.ETHEREUM, name: 'Ethereum', nativeToken: 'ETH' },
  bsc: { id: ChainId.BSC, name: 'BNB Chain', nativeToken: 'BNB' },
  polygon: { id: ChainId.POLYGON, name: 'Polygon', nativeToken: 'MATIC' },
  avalanche: { id: ChainId.AVALANCHE, name: 'Avalanche', nativeToken: 'AVAX' },
  arbitrum: { id: ChainId.ARBITRUM, name: 'Arbitrum', nativeToken: 'ETH' },
  optimism: { id: ChainId.OPTIMISM, name: 'Optimism', nativeToken: 'ETH' },
  base: { id: ChainId.BASE, name: 'Base', nativeToken: 'ETH' },
  linea: { id: ChainId.LINEA, name: 'Linea', nativeToken: 'ETH' },
  fantom: { id: ChainId.FANTOM, name: 'Fantom', nativeToken: 'FTM' },
  solana: { id: ChainId.SOLANA, name: 'Solana', nativeToken: 'SOL' },
} as const;

export type SupportedChainKey = keyof typeof SUPPORTED_CHAINS;

/**
 * Order estimation returned by DeBridge API
 */
export interface BridgeEstimation {
  srcChainTokenIn: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    amount: string;
    approximateOperatingExpense: string;
    mutatedWithOperatingExpense: boolean;
  };
  srcChainTokenOut: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    amount: string;
    maxRefundAmount: string;
  };
  dstChainTokenOut: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    amount: string;
    recommendedAmount: string;
    maxTheoreticalAmount: string;
  };
  recommendedSlippage: number;
  costsDetails: string[];
}

/**
 * Transaction data for Solana
 */
export interface SolanaBridgeTransaction {
  data: string; // hex-encoded VersionedTransaction
}

/**
 * Order creation response
 */
export interface BridgeOrderResponse {
  estimation: BridgeEstimation;
  tx?: SolanaBridgeTransaction;
  orderId?: string;
  prependedOperatingExpenseCost?: string;
  order?: {
    approximateFulfillmentDelay: number;
  };
}

/**
 * Order status
 */
export enum OrderStatus {
  NONE = 'None',
  CREATED = 'Created',
  FULFILLED = 'Fulfilled',
  SENT_UNLOCK = 'SentUnlock',
  CLAIMED_UNLOCK = 'ClaimedUnlock',
  CANCELLED = 'Cancelled',
  SENT_ORDER_CANCEL = 'SentOrderCancel',
  CLAIMED_CANCEL = 'ClaimedCancel',
}

/**
 * Order tracking info
 */
export interface OrderInfo {
  orderId: string;
  status: OrderStatus;
  give: {
    chainId: number;
    tokenAddress: string;
    amount: string;
  };
  take: {
    chainId: number;
    tokenAddress: string;
    amount: string;
  };
  makerOrderNonce: string;
  makerSrc: string;
  giveTokenAddress: string;
  takeTokenAddress: string;
  takeChainId: number;
  receiverDst: string;
  givePatchAuthoritySrc: string;
  orderAuthorityAddressDst: string;
  allowedTakerDst: string | null;
  externalCall: any | null;
  allowedCancelBeneficiarySrc: string | null;
}

/**
 * Bridge quote parameters
 */
export interface BridgeQuoteParams {
  srcChainId: ChainId;
  srcChainTokenIn: string; // Token address on source chain
  srcChainTokenInAmount: string; // Amount with decimals
  dstChainId: ChainId;
  dstChainTokenOut: string; // Token address on destination chain
  dstChainTokenOutAmount?: 'auto' | string; // 'auto' recommended
  affiliateFeePercent?: number; // Optional fee (e.g., 0.1 for 0.1%)
  affiliateFeeRecipient?: string; // Your fee recipient address
}

/**
 * Bridge order creation parameters
 */
export interface BridgeOrderParams extends BridgeQuoteParams {
  dstChainTokenOutRecipient: string; // Recipient address on destination chain
  srcChainOrderAuthorityAddress: string; // Authority on source chain (user wallet)
  dstChainOrderAuthorityAddress: string; // Authority on dest chain (user wallet)
  prependOperatingExpenses?: boolean; // Add operating expenses to amount
}

// ============================================================================
// API CONFIGURATION
// ============================================================================

const DLN_API_BASE = DEBRIDGE_DLN_API_BASE;
const STATS_API_BASE = DEBRIDGE_STATS_API_BASE;

// ============================================================================
// CORE BRIDGE FUNCTIONS
// ============================================================================

/**
 * Get a quote/estimation for bridging without wallet addresses
 * Use this before wallet is connected to show estimated amounts
 * 
 * @param params - Quote parameters
 * @returns Promise with estimation data
 */
export async function getBridgeQuote(
  params: BridgeQuoteParams
): Promise<BridgeEstimation> {
  const queryParams = new URLSearchParams({
    srcChainId: params.srcChainId.toString(),
    srcChainTokenIn: params.srcChainTokenIn,
    srcChainTokenInAmount: params.srcChainTokenInAmount,
    dstChainId: params.dstChainId.toString(),
    dstChainTokenOut: params.dstChainTokenOut,
    dstChainTokenOutAmount: params.dstChainTokenOutAmount || 'auto',
  });

  if (params.affiliateFeePercent) {
    queryParams.append('affiliateFeePercent', params.affiliateFeePercent.toString());
  }
  if (params.affiliateFeeRecipient) {
    queryParams.append('affiliateFeeRecipient', params.affiliateFeeRecipient);
  }

  const url = `${DLN_API_BASE}/dln/order/create-tx?${queryParams.toString()}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeBridge API Error: ${response.statusText}. ${errorText}`);
  }

  const data: BridgeOrderResponse = await response.json();
  
  if (!data.estimation) {
    throw new Error('No estimation returned from DeBridge API');
  }

  return data.estimation;
}

/**
 * Create a bridge order transaction
 * This returns the transaction data that needs to be signed
 * 
 * IMPORTANT: Sign and submit the transaction within 30 seconds for >99.9% fill probability
 * 
 * @param params - Order creation parameters
 * @returns Promise with order response including transaction data
 */
export async function createBridgeOrder(
  params: BridgeOrderParams
): Promise<BridgeOrderResponse> {
  const queryParams = new URLSearchParams({
    srcChainId: params.srcChainId.toString(),
    srcChainTokenIn: params.srcChainTokenIn,
    srcChainTokenInAmount: params.srcChainTokenInAmount,
    dstChainId: params.dstChainId.toString(),
    dstChainTokenOut: params.dstChainTokenOut,
    dstChainTokenOutAmount: params.dstChainTokenOutAmount || 'auto',
    dstChainTokenOutRecipient: params.dstChainTokenOutRecipient,
    srcChainOrderAuthorityAddress: params.srcChainOrderAuthorityAddress,
    dstChainOrderAuthorityAddress: params.dstChainOrderAuthorityAddress,
  });

  if (params.prependOperatingExpenses !== undefined) {
    queryParams.append('prependOperatingExpenses', params.prependOperatingExpenses.toString());
  }
  if (params.affiliateFeePercent) {
    queryParams.append('affiliateFeePercent', params.affiliateFeePercent.toString());
  }
  if (params.affiliateFeeRecipient) {
    queryParams.append('affiliateFeeRecipient', params.affiliateFeeRecipient);
  }

  const url = `${DLN_API_BASE}/dln/order/create-tx?${queryParams.toString()}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeBridge API Error: ${response.statusText}. ${errorText}`);
  }

  const data: BridgeOrderResponse = await response.json();
  
  if (!data.tx) {
    throw new Error('No transaction data returned from DeBridge API');
  }

  return data;
}

/**
 * Execute bridge transaction on Solana
 * 
 * @param connection - Solana connection
 * @param transactionData - Hex-encoded transaction from createBridgeOrder
 * @param signTransaction - Wallet's sign transaction function
 * @returns Promise with transaction signature
 */
export async function executeSolanaBridge(
  connection: Connection,
  transactionData: string,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
): Promise<string> {
  try {
    // Decode hex string to buffer
    const buffer = Buffer.from(transactionData, 'hex');
    
    // Deserialize to VersionedTransaction
    const transaction = VersionedTransaction.deserialize(buffer);
    
    // Sign transaction with user's wallet
    const signedTx = await signTransaction(transaction);
    
    // Send transaction
    const signature = await connection.sendTransaction(signedTx, {
      skipPreflight: false,
      maxRetries: 3,
    });
    
    // Confirm transaction
    await connection.confirmTransaction(signature, 'confirmed');
    
    return signature;
  } catch (error) {
    throw new Error(`Failed to execute Solana bridge transaction: ${error}`);
  }
}

/**
 * Get order ID from transaction hash
 * Use this after submitting the bridge transaction
 * 
 * @param txHash - Transaction hash
 * @returns Promise with array of order IDs
 */
export async function getOrderIdFromTx(txHash: string): Promise<string[]> {
  const url = `${STATS_API_BASE}/Transaction/${txHash}/orderIds`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get order IDs: ${response.statusText}. ${errorText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`DeBridge API Error: ${data.error}`);
  }

  return data.orderIds || [];
}

/**
 * Get order status and details
 * 
 * Order is considered complete when status is:
 * - Fulfilled
 * - SentUnlock
 * - ClaimedUnlock
 * 
 * @param orderId - Order ID to track
 * @returns Promise with order information
 */
export async function getOrderStatus(orderId: string): Promise<OrderInfo> {
  const url = `${STATS_API_BASE}/Orders/${orderId}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get order status: ${response.statusText}. ${errorText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`DeBridge API Error: ${data.error}`);
  }

  return data;
}

/**
 * Check if order is complete
 * 
 * @param status - Order status
 * @returns true if order is successfully completed
 */
export function isOrderComplete(status: OrderStatus): boolean {
  return [
    OrderStatus.FULFILLED,
    OrderStatus.SENT_UNLOCK,
    OrderStatus.CLAIMED_UNLOCK,
  ].includes(status);
}

/**
 * Get order details by creation transaction hash
 * 
 * @param txHash - Transaction hash that created the order
 * @returns Promise with order information
 */
export async function getOrderByTxHash(txHash: string): Promise<OrderInfo> {
  const url = `${STATS_API_BASE}/Orders/creationTxHash/${txHash}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get order by tx hash: ${response.statusText}. ${errorText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`DeBridge API Error: ${data.error}`);
  }

  return data;
}

/**
 * Get all orders for a wallet address
 * 
 * @param walletAddress - User's wallet address
 * @param options - Optional filtering options
 * @returns Promise with array of orders
 */
export async function getUserOrders(
  walletAddress: string,
  options?: {
    skip?: number;
    take?: number;
    orderStates?: OrderStatus[];
  }
): Promise<{ orders: OrderInfo[]; total: number }> {
  const url = `${STATS_API_BASE}/Orders/filteredList`;
  
  const requestBody = {
    skip: options?.skip || 0,
    take: options?.take || 20,
    maker: walletAddress,
    orderStates: options?.orderStates || undefined,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get user orders: ${response.statusText}. ${errorText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`DeBridge API Error: ${data.error}`);
  }

  return {
    orders: data.orders || [],
    total: data.totalCount || 0,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get supported chains list
 * 
 * @returns Array of supported chains
 */
export function getSupportedChains() {
  return Object.entries(SUPPORTED_CHAINS).map(([key, value]) => ({
    key: key as SupportedChainKey,
    ...value,
  }));
}

/**
 * Get chain info by ID
 * 
 * @param chainId - Chain ID
 * @returns Chain info or undefined
 */
export function getChainInfo(chainId: ChainId) {
  return Object.values(SUPPORTED_CHAINS).find(chain => chain.id === chainId);
}

/**
 * Format amount for display
 * 
 * @param amount - Amount string with decimals
 * @param decimals - Token decimals
 * @returns Formatted amount as number
 */
export function formatBridgeAmount(amount: string, decimals: number): number {
  return Number(amount) / Math.pow(10, decimals);
}

/**
 * Parse amount to send to API
 * 
 * @param amount - Human-readable amount (e.g., "100.5")
 * @param decimals - Token decimals
 * @returns Amount string with decimals
 */
export function parseBridgeAmount(amount: string | number, decimals: number): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  return (value * Math.pow(10, decimals)).toFixed(0);
}

/**
 * Estimate bridge time
 * 
 * @param srcChainId - Source chain ID
 * @param dstChainId - Destination chain ID
 * @returns Estimated time in seconds
 */
export function estimateBridgeTime(srcChainId: ChainId, dstChainId: ChainId): number {
  // Solana bridges are typically very fast (1-3 seconds)
  if (srcChainId === ChainId.SOLANA) {
    return 2;
  }
  
  // EVM to EVM bridges take longer
  return 60;
}

/**
 * Validate wallet address format
 * 
 * @param address - Wallet address
 * @param chainId - Chain ID
 * @returns true if valid
 */
export function isValidAddress(address: string, chainId: ChainId): boolean {
  if (chainId === ChainId.SOLANA) {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }
  
  // EVM chains: starts with 0x and is 42 characters
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// ============================================================================
// USAGE EXAMPLE (commented out)
// ============================================================================

/*
// Example: Bridge USDC from Solana to Base

import { Connection, clusterApiUrl } from '@solana/web3.js';

async function bridgeExample() {
  const connection = new Connection(clusterApiUrl('mainnet-beta'));
  
  // 1. Get quote first (before wallet connection)
  const quote = await getBridgeQuote({
    srcChainId: ChainId.SOLANA,
    srcChainTokenIn: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC on Solana
    srcChainTokenInAmount: parseBridgeAmount('100', 6), // 100 USDC
    dstChainId: ChainId.BASE,
    dstChainTokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
    dstChainTokenOutAmount: 'auto',
  });
  
  console.log('You will receive approximately:', 
    formatBridgeAmount(quote.dstChainTokenOut.amount, 6), 'USDC on Base');
  
  // 2. Create order (after wallet connection)
  const order = await createBridgeOrder({
    srcChainId: ChainId.SOLANA,
    srcChainTokenIn: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    srcChainTokenInAmount: parseBridgeAmount('100', 6),
    dstChainId: ChainId.BASE,
    dstChainTokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    dstChainTokenOutAmount: 'auto',
    dstChainTokenOutRecipient: '0xYourBaseAddress...',
    srcChainOrderAuthorityAddress: 'YourSolanaAddress...',
    dstChainOrderAuthorityAddress: '0xYourBaseAddress...',
  });
  
  // 3. Execute transaction (sign within 30 seconds!)
  const signature = await executeSolanaBridge(
    connection,
    order.tx!.data,
    wallet.signTransaction
  );
  
  console.log('Bridge transaction submitted:', signature);
  
  // 4. Track order status
  const orderIds = await getOrderIdFromTx(signature);
  const orderId = orderIds[0];
  
  // Poll for status
  const checkStatus = async () => {
    const status = await getOrderStatus(orderId);
    console.log('Order status:', status.status);
    
    if (isOrderComplete(status.status)) {
      console.log('Bridge complete!');
    } else {
      setTimeout(checkStatus, 5000); // Check every 5 seconds
    }
  };
  
  checkStatus();
}
*/