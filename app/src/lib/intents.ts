import {
  OpenAPI,
  OneClickService,
  QuoteRequest,
  SubmitDepositTxRequest,
  GetExecutionStatusResponse,
  QuoteResponse,
  TokenResponse,
} from '@defuse-protocol/one-click-sdk-typescript';
import { NEAR } from '@near-js/tokens';
import { KeyPairSigner } from '@near-js/signers';
import { KeyPairString } from '@near-js/crypto';
import { JsonRpcProvider, Provider } from '@near-js/providers';
import { Account } from '@near-js/accounts';

/**
 * Payment status types that match 1Click API lifecycle
 */
export type PaymentStatus =
  | 'PENDING_DEPOSIT' // Awaiting deposit
  | 'PROCESSING' // Deposit detected, being processed
  | 'SUCCESS' // Funds delivered
  | 'INCOMPLETE_DEPOSIT' // Deposit below required amount
  | 'REFUNDED' // Funds returned to refund address
  | 'FAILED'; // Swap failed

/**
 * Simplified payment request for frontend
 */
export interface PaymentRequest {
  /** Amount to pay in smallest units (e.g., yoctoNEAR, lamports) */
  amount: string;
  /** Token to pay with (e.g., "wNEAR", "SOL", "USDC") */
  paymentToken: string;
  /** Token to receive (e.g., "SOL", "MUSK", "wNEAR") */
  receiveToken: string;
  /** Address to send received tokens to */
  recipientAddress: string;
  /** Address to refund to if payment fails */
  refundAddress: string;
  /** Slippage tolerance in percentage (e.g., 1.0 for 1%) */
  slippage?: number;
}

/**
 * Payment quote with all details needed for user confirmation
 */
export interface PaymentQuote {
  /** Unique deposit address where user sends funds */
  depositAddress: string;
  /** Memo required for some chains (Stellar, Cosmos) */
  depositMemo?: string;
  /** Amount user will receive (formatted with decimals) */
  expectedReceiveAmount: string;
  /** Minimum amount user will receive after slippage */
  minReceiveAmount: string;
  /** Estimated USD value of output */
  estimatedValueUsd?: string;
  /** Estimated time to complete in seconds */
  estimatedTimeSeconds: number;
  /** Deadline timestamp - must deposit before this */
  deadline: string;
  /** Slippage tolerance in basis points (100 = 1%) */
  slippageBps: number;
  /** Raw quote response for advanced usage */
  rawQuote: QuoteResponse;
}

/**
 * Detailed payment status with progress information
 */
export interface PaymentStatusDetails {
  /** Current status of the payment */
  status: PaymentStatus;
  /** Last update timestamp */
  lastUpdated: string;
  /** Is payment in terminal state? */
  isComplete: boolean;
  /** Did payment succeed? */
  isSuccess: boolean;
  /** Did payment fail? */
  isFailed: boolean;
  /** Amount deposited (if detected) */
  depositedAmount?: string;
  /** Amount deposited (formatted) */
  depositedAmountFormatted?: string;
  /** Amount received (if completed) */
  receivedAmount?: string;
  /** Amount received (formatted) */
  receivedAmountFormatted?: string;
  /** USD value of received amount */
  receivedAmountUsd?: string;
  /** Origin chain transaction hashes */
  originTxHashes?: Array<{ hash: string; explorerUrl: string }>;
  /** Destination chain transaction hashes */
  destinationTxHashes?: Array<{ hash: string; explorerUrl: string }>;
  /** Refunded amount if swap failed */
  refundedAmount?: string;
  /** Raw status response for advanced usage */
  rawStatus: GetExecutionStatusResponse;
}

/**
 * NearIntents - Complete abstraction for seamless NEAR/SOL payments
 *
 * This class provides everything needed for a frontend payment flow:
 * 1. Get payment quote with deposit address
 * 2. User sends funds to deposit address
 * 3. Submit transaction hash (optional, speeds up processing)
 * 4. Monitor payment status until complete
 *
 * Usage:
 * ```typescript
 * const nearIntents = new NearIntents(process.env.NEAR_INTENTS_JWT!);
 *
 * // Step 1: Get quote
 * const quote = await nearIntents.getPaymentQuote({
 *   amount: "1000000000000000000000000", // 1 NEAR
 *   paymentToken: "wNEAR",
 *   receiveToken: "SOL",
 *   recipientAddress: "SolanaAddress...",
 *   refundAddress: "near-account.near"
 * });
 *
 * // Step 2: User sends funds to quote.depositAddress
 * // ... user wallet interaction ...
 *
 * // Step 3: Submit tx hash (optional but recommended)
 * await nearIntents.notifyPayment(quote.depositAddress, txHash);
 *
 * // Step 4: Monitor status
 * const status = await nearIntents.trackPayment(quote.depositAddress);
 * ```
 */
export class NearIntents {
  private readonly DEFAULT_SLIPPAGE_BPS = 100; // 1%
  private readonly DEFAULT_DEADLINE_MINUTES = 10;
  private readonly POLL_INTERVAL_MS = 5000;

  constructor(jwtToken: string, apiBaseUrl: string = 'https://1click.chaindefuser.com') {
    if (!jwtToken) {
      throw new Error('JWT token is required. Set NEAR_INTENTS_JWT in your .env file');
    }
    OpenAPI.BASE = apiBaseUrl;
    OpenAPI.TOKEN = jwtToken;
  }

  // ============================================================================
  // HIGH-LEVEL PAYMENT METHODS - Use these in your frontend
  // ============================================================================

  /**
   * Get a payment quote for the user to review before paying.
   * This shows them exactly what they'll receive and where to send funds.
   *
   * This is the FIRST step in the payment flow.
   *
   * @param request Payment request details
   * @returns Complete payment quote with deposit address
   */
  async getPaymentQuote(request: PaymentRequest): Promise<PaymentQuote> {
    const {
      amount,
      paymentToken,
      receiveToken,
      recipientAddress,
      refundAddress,
      slippage = 1.0,
    } = request;

    const slippageBps = Math.round(slippage * 100);

    // Resolve token symbols to assetIds
    const originSupport = await this.checkNearIntentSupport(paymentToken);
    if (!originSupport.supported || !originSupport.token?.assetId) {
      throw new Error(`Payment token not supported: ${paymentToken}`);
    }

    const destinationSupport = await this.checkNearIntentSupport(receiveToken);
    if (!destinationSupport.supported || !destinationSupport.token?.assetId) {
      throw new Error(`Receive token not supported: ${receiveToken}`);
    }

    // Build quote request
    const quoteRequest: QuoteRequest = {
      dry: false, // MUST be false to get deposit address
      swapType: QuoteRequest.swapType.EXACT_INPUT,
      slippageTolerance: slippageBps,
      originAsset: originSupport.token.assetId,
      depositType: QuoteRequest.depositType.ORIGIN_CHAIN,
      destinationAsset: destinationSupport.token.assetId,
      amount,
      refundTo: refundAddress,
      refundType: QuoteRequest.refundType.ORIGIN_CHAIN,
      recipient: recipientAddress,
      recipientType: QuoteRequest.recipientType.DESTINATION_CHAIN,
      deadline: new Date(Date.now() + this.DEFAULT_DEADLINE_MINUTES * 60 * 1000).toISOString(),
      referral: 'nearintents-sdk',
      quoteWaitingTimeMs: 3000,
    };

    const quote = await OneClickService.getQuote(quoteRequest);

    if (!quote.quote?.depositAddress) {
      throw new Error('Failed to generate deposit address. Quote may have failed.');
    }

    return {
      depositAddress: quote.quote.depositAddress,
      depositMemo: quote.quote.depositMemo,
      expectedReceiveAmount: quote.quote.amountOutFormatted || '0',
      minReceiveAmount: quote.quote.minAmountOut || '0',
      estimatedValueUsd: quote.quote.amountOutUsd,
      estimatedTimeSeconds: quote.quote.timeEstimate || 120,
      deadline: quote.quote.deadline || quoteRequest.deadline || '',
      slippageBps,
      rawQuote: quote,
    };
  }

  /**
   * Get a price estimate WITHOUT generating a deposit address.
   * Use this for displaying prices before user commits to payment.
   *
   * This uses dry=true to avoid creating unnecessary quotes.
   *
   * @param request Payment request details
   * @returns Price estimate details
   */
  async estimatePayment(request: PaymentRequest): Promise<{
    expectedReceiveAmount: string;
    estimatedValueUsd?: string;
    estimatedTimeSeconds: number;
    priceImpact?: number;
  }> {
    const {
      amount,
      paymentToken,
      receiveToken,
      recipientAddress,
      refundAddress,
      slippage = 1.0,
    } = request;

    const slippageBps = Math.round(slippage * 100);

    // Resolve tokens
    const originSupport = await this.checkNearIntentSupport(paymentToken);
    if (!originSupport.supported || !originSupport.token?.assetId) {
      throw new Error(`Payment token not supported: ${paymentToken}`);
    }

    const destinationSupport = await this.checkNearIntentSupport(receiveToken);
    if (!destinationSupport.supported || !destinationSupport.token?.assetId) {
      throw new Error(`Receive token not supported: ${receiveToken}`);
    }

    const quoteRequest: QuoteRequest = {
      dry: true, // No deposit address generated
      swapType: QuoteRequest.swapType.EXACT_INPUT,
      slippageTolerance: slippageBps,
      originAsset: originSupport.token.assetId,
      depositType: QuoteRequest.depositType.ORIGIN_CHAIN,
      destinationAsset: destinationSupport.token.assetId,
      amount,
      refundTo: refundAddress,
      refundType: QuoteRequest.refundType.ORIGIN_CHAIN,
      recipient: recipientAddress,
      recipientType: QuoteRequest.recipientType.DESTINATION_CHAIN,
      deadline: new Date(Date.now() + this.DEFAULT_DEADLINE_MINUTES * 60 * 1000).toISOString(),
      referral: 'nearintents-sdk',
      quoteWaitingTimeMs: 3000,
    };

    const quote = await OneClickService.getQuote(quoteRequest);

    return {
      expectedReceiveAmount: quote.quote?.amountOutFormatted || '0',
      estimatedValueUsd: quote.quote?.amountOutUsd,
      estimatedTimeSeconds: quote.quote?.timeEstimate || 120,
    };
  }

  /**
   * Notify 1Click that payment has been sent to the deposit address.
   * This is OPTIONAL but speeds up processing significantly.
   *
   * Call this immediately after user confirms the transaction.
   *
   * @param depositAddress Deposit address from quote
   * @param txHash Transaction hash from user's wallet
   * @param depositMemo Memo if required by the chain
   */
  async notifyPayment(depositAddress: string, txHash: string, depositMemo?: string): Promise<void> {
    const request: SubmitDepositTxRequest = {
      txHash,
      depositAddress,
      ...(depositMemo && { memo: depositMemo }),
    };

    await OneClickService.submitDepositTx(request);
    console.log(`[NearIntents] Payment notification sent: ${txHash}`);
  }

  /**
   * Get current payment status.
   * Use this to show users real-time progress.
   *
   * @param depositAddress Deposit address from quote
   * @returns Current payment status with details
   */
  async getPaymentStatus(depositAddress: string): Promise<PaymentStatusDetails> {
    const statusResponse = await OneClickService.getExecutionStatus(depositAddress);

    const status = (statusResponse.status || 'PENDING_DEPOSIT') as PaymentStatus;
    const isComplete = ['SUCCESS', 'REFUNDED', 'FAILED'].includes(status);
    const isSuccess = status === 'SUCCESS';
    const isFailed = status === 'FAILED';

    return {
      status,
      lastUpdated: statusResponse.updatedAt || new Date().toISOString(),
      isComplete,
      isSuccess,
      isFailed,
      depositedAmount: statusResponse.swapDetails?.amountIn,
      depositedAmountFormatted: statusResponse.swapDetails?.amountInFormatted,
      receivedAmount: statusResponse.swapDetails?.amountOut,
      receivedAmountFormatted: statusResponse.swapDetails?.amountOutFormatted,
      receivedAmountUsd: statusResponse.swapDetails?.amountOutUsd,
      originTxHashes: statusResponse.swapDetails?.originChainTxHashes,
      destinationTxHashes: statusResponse.swapDetails?.destinationChainTxHashes,
      refundedAmount: statusResponse.swapDetails?.refundedAmount,
      rawStatus: statusResponse,
    };
  }

  /**
   * Track payment until completion.
   * This polls the status endpoint until payment reaches a terminal state.
   *
   * Use this with a progress indicator in your UI.
   *
   * @param depositAddress Deposit address from quote
   * @param onProgress Optional callback for status updates
   * @returns Final payment status
   */
  async trackPayment(
    depositAddress: string,
    onProgress?: (status: PaymentStatusDetails) => void,
  ): Promise<PaymentStatusDetails> {
    console.log(`[NearIntents] Tracking payment: ${depositAddress}`);

    while (true) {
      const status = await this.getPaymentStatus(depositAddress);

      // Call progress callback if provided
      if (onProgress) {
        onProgress(status);
      }

      console.log(`[NearIntents] Status: ${status.status}`);

      // Check if terminal state reached
      if (status.isComplete) {
        if (status.isSuccess) {
          console.log(
            `[NearIntents] Payment successful! Received: ${status.receivedAmountFormatted}`,
          );
        } else if (status.status === 'REFUNDED') {
          console.log(`[NearIntents] Payment refunded: ${status.refundedAmount}`);
        } else {
          console.log(`[NearIntents] Payment failed with status: ${status.status}`);
        }
        return status;
      }

      // Wait before next poll
      await this.sleep(this.POLL_INTERVAL_MS);
    }
  }

  /**
   * Complete payment flow with automatic tracking.
   * This combines all steps: quote, wait for deposit, track until completion.
   *
   * Note: This assumes the user will send funds to the deposit address.
   * You still need to handle the actual wallet interaction in your frontend.
   *
   * @param request Payment request
   * @param onQuoteReady Callback when quote is ready (user should send funds here)
   * @param onProgress Optional callback for status updates
   * @returns Final payment status
   */
  async processPayment(
    request: PaymentRequest,
    onQuoteReady: (quote: PaymentQuote) => Promise<{ txHash?: string }>,
    onProgress?: (status: PaymentStatusDetails) => void,
  ): Promise<PaymentStatusDetails> {
    // Step 1: Get quote
    console.log(`[NearIntents] Getting payment quote...`);
    const quote = await this.getPaymentQuote(request);

    // Step 2: Callback for user to send funds
    console.log(`[NearIntents] Quote ready. Waiting for user to send funds...`);
    const { txHash } = await onQuoteReady(quote);

    // Step 3: Notify if tx hash provided
    if (txHash) {
      await this.notifyPayment(quote.depositAddress, txHash, quote.depositMemo);
    }

    // Step 4: Track until completion
    return await this.trackPayment(quote.depositAddress, onProgress);
  }

  // ============================================================================
  // TOKEN SUPPORT METHODS
  // ============================================================================

  /**
   * Check if a token is supported by NEAR Intents.
   *
   * @param tokenSymbolOrAssetId Token symbol (e.g., "wNEAR", "SOL") or assetId
   * @returns Support status and token details
   */
  async checkNearIntentSupport(
    tokenSymbolOrAssetId: string,
  ): Promise<{ supported: boolean; token?: TokenResponse }> {
    const tokens = await OneClickService.getTokens();
    const normalized = (tokenSymbolOrAssetId || '').trim().toLowerCase();

    const resolved = tokens.find((t) => {
      const assetMatch = t.assetId && t.assetId.toLowerCase() === normalized;
      const contractMatch = t.contractAddress && t.contractAddress.toLowerCase() === normalized;
      const symbolMatch = t.symbol && t.symbol.toLowerCase() === normalized;
      return Boolean(assetMatch || contractMatch || symbolMatch);
    });

    return {
      supported: Boolean(resolved),
      token: resolved,
    };
  }

  /**
   * Get all supported tokens.
   * Use this to populate token selection dropdowns in your UI.
   *
   * @returns List of all supported tokens
   */
  async getSupportedTokens(): Promise<TokenResponse[]> {
    return await OneClickService.getTokens();
  }

  /**
   * Get tokens filtered by blockchain.
   *
   * @param blockchain Blockchain name (e.g., "near", "solana")
   * @returns Tokens available on that blockchain
   */
  async getTokensByBlockchain(blockchain: string): Promise<TokenResponse[]> {
    const tokens = await OneClickService.getTokens();
    return tokens.filter((t) => t.blockchain?.toLowerCase() === blockchain.toLowerCase());
  }

  // ============================================================================
  // ADVANCED: NEAR-NATIVE TRANSACTION EXECUTION
  // ============================================================================

  /**
   * Execute a complete payment using NEAR wallet credentials.
   * This handles the NEAR transfer programmatically.
   *
   * SECURITY WARNING: Only use this server-side or in secure contexts.
   * Never expose private keys in client-side code.
   *
   * @param request Payment request with NEAR credentials
   * @returns Payment result with transaction hash
   */
  async executeNearPayment(params: {
    amount: string;
    paymentToken: string;
    receiveToken: string;
    recipientAddress: string;
    senderAddress: string;
    senderPrivateKey: string;
    slippage?: number;
    waitForCompletion?: boolean;
  }): Promise<{
    txHash: string;
    depositAddress: string;
    quote: PaymentQuote;
    finalStatus?: PaymentStatusDetails;
  }> {
    const {
      amount,
      paymentToken,
      receiveToken,
      recipientAddress,
      senderAddress,
      senderPrivateKey,
      slippage = 1.0,
      waitForCompletion = true,
    } = params;

    // Get quote
    const quote = await this.getPaymentQuote({
      amount,
      paymentToken,
      receiveToken,
      recipientAddress,
      refundAddress: senderAddress,
      slippage,
    });

    // Only execute if origin is NEAR
    const originSupport = await this.checkNearIntentSupport(paymentToken);
    if (!originSupport.token?.assetId.includes('near')) {
      throw new Error(
        'executeNearPayment only works with NEAR tokens. Use getPaymentQuote for other chains.',
      );
    }

    // Execute NEAR transfer
    const account = await this.getAccount(senderAddress, senderPrivateKey);
    const result = await account.transfer({
      token: NEAR,
      amount,
      receiverId: quote.depositAddress,
    });

    const txHash = result.transaction.hash;
    console.log(`[NearIntents] NEAR transfer executed: ${txHash}`);

    // Notify 1Click
    await this.notifyPayment(quote.depositAddress, txHash);

    if (!waitForCompletion) {
      return { txHash, depositAddress: quote.depositAddress, quote };
    }

    // Track to completion
    const finalStatus = await this.trackPayment(quote.depositAddress);

    return {
      txHash,
      depositAddress: quote.depositAddress,
      quote,
      finalStatus,
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private async getAccount(address: string, privateKey: string): Promise<Account> {
    const signer = KeyPairSigner.fromSecretKey(privateKey as KeyPairString);
    const provider = new JsonRpcProvider({ url: 'https://rpc.mainnet.fastnear.com' });
    return new Account(address, provider as Provider, signer);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// CONVENIENCE FACTORY FUNCTION
// ============================================================================

/**
 * Create a NearIntents instance from environment variables.
 *
 * Usage:
 * ```typescript
 * // .env file:
 * // NEAR_INTENTS_JWT=your_jwt_token
 *
 * import { createNearIntents } from './NearIntents';
 * const nearIntents = createNearIntents();
 * ```
 */
export function createNearIntents(jwtToken?: string, apiBaseUrl?: string): NearIntents {
  const token = jwtToken || process.env.NEXT_PUBLIC_ONECLICK_JWT;
  if (!token) {
    throw new Error(
      'NEXT_PUBLIC_ONECLICK_JWT environment variable not set. ' +
        'Add it to your .env file or pass it directly.',
    );
  }
  return new NearIntents(token, apiBaseUrl);
}

export default NearIntents;
