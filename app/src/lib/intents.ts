import {
  type GetExecutionStatusResponse,
  OneClickService,
  OpenAPI,
  QuoteRequest,
  type QuoteResponse,
  type SubmitDepositTxRequest,
  type TokenResponse,
} from '@defuse-protocol/one-click-sdk-typescript';
import { Account } from '@near-js/accounts';
import type { KeyPairString } from '@near-js/crypto';
import { JsonRpcProvider, type Provider } from '@near-js/providers';
import { KeyPairSigner } from '@near-js/signers';
import { NEAR } from '@near-js/tokens';

export class NearIntents {
  constructor(jwtToken: string, apiBaseUrl: string = 'https://1click.chaindefuser.com') {
    OpenAPI.BASE = apiBaseUrl;
    OpenAPI.TOKEN = jwtToken;
  }

  /**
   * Get a 1-Click NEAR Intents quote and deposit address for a swap.
   *
   * Parameters accept token symbols or asset identifiers for origin/destination assets.
   * Example originAsset: "wNEAR" or assetId "nep141:wrap.near".
   *
   * @param senderAddress Address to refund to if swap fails (origin chain format)
   * @param recipientAddress Address to receive output tokens (destination chain format)
   * @param originAsset Symbol of input token (e.g., "wNEAR") or assetId
   * @param destinationAsset Symbol of output token (e.g., "SOL") or assetId
   * @param amount Token amount in smallest units for swap type
   * @param dry When true, estimate only (no depositAddress returned)
   */
  async getQuote(
    senderAddress: string,
    recipientAddress: string,
    originAsset: string,
    destinationAsset: string,
    amount: string,
    dry: boolean = false,
  ): Promise<QuoteResponse> {
    // Resolve input parameters to supported assetIds
    const originSupport = await this.checkNearIntentSupport(originAsset);
    if (!originSupport.supported || !originSupport.token?.assetId) {
      throw new Error(`Input token not supported: ${originAsset}`);
    }
    const destinationSupport = await this.checkNearIntentSupport(destinationAsset);
    if (!destinationSupport.supported || !destinationSupport.token?.assetId) {
      throw new Error(`Output token not supported: ${destinationAsset}`);
    }

    const originAssetId = originSupport.token.assetId;
    const destinationAssetId = destinationSupport.token.assetId;

    const quoteRequest: QuoteRequest = {
      dry,
      swapType: QuoteRequest.swapType.EXACT_INPUT,
      slippageTolerance: 100,
      originAsset: originAssetId,
      depositType: QuoteRequest.depositType.ORIGIN_CHAIN,
      destinationAsset: destinationAssetId,
      amount,
      refundTo: senderAddress,
      refundType: QuoteRequest.refundType.ORIGIN_CHAIN,
      recipient: recipientAddress,
      recipientType: QuoteRequest.recipientType.DESTINATION_CHAIN,
      deadline: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
      referral: 'referral',
      quoteWaitingTimeMs: 3000,
    };
    const quote = await OneClickService.getQuote(quoteRequest);
    return quote;
  }

  /**
   * Submit the origin-chain transaction hash to the 1-Click API.
   * Must be called after you transfer funds to the provided deposit address.
   *
   * @param txHash Origin chain transaction hash
   * @param depositAddress Deposit address from the quote
   */
  async submitTxHash(txHash: string, depositAddress: string): Promise<void> {
    const req: SubmitDepositTxRequest = {
      txHash,
      depositAddress,
    };
    await OneClickService.submitDepositTx(req);
  }

  /**
   * Get execution status for a deposit address.
   *
   * @param depositAddress Deposit address from the quote
   */
  async checkStatus(depositAddress: string): Promise<GetExecutionStatusResponse> {
    const status = await OneClickService.getExecutionStatus(depositAddress);
    return status;
  }

  /**
   * Poll execution status until terminal state (SUCCESS, REFUNDED, FAILED).
   *
   * @param depositAddress Deposit address from the quote
   * @param intervalMs Poll interval in milliseconds
   */
  async pollStatusUntilSuccess(
    depositAddress: string,
    intervalMs: number = 5000,
  ): Promise<GetExecutionStatusResponse> {
    while (true) {
      const statusResponse = await this.checkStatus(depositAddress);
      const s = statusResponse.status;
      console.log(`Status: ${s}`);
      if (s === 'SUCCESS' || s === 'REFUNDED' || s === 'FAILED') {
        return statusResponse;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  // ===================================================================
  // NEW: DEPOSIT-FIRST WORKFLOW METHODS
  // ===================================================================

  /**
   * Generate a deposit address for users to fund before a swap executes.
   * This is the entry point for your "Deposit" tab workflow.
   *
   * @param senderAddress - Origin chain address for refunds if swap fails
   * @param recipientAddress - Destination chain address to receive output tokens
   * @param originAsset - Input token symbol (e.g., "wNEAR") or assetId
   * @param destinationAsset - Output token symbol (e.g., "SOL", "MUSK") or assetId
   * @param amount - Amount to swap in smallest units (e.g., yoctoNEAR)
   * @returns Deposit address and full quote details
   */
  async generateDepositAddress(params: {
    senderAddress: string;
    recipientAddress: string;
    originAsset: string;
    destinationAsset: string;
    amount: string;
  }): Promise<{
    depositAddress: string;
    depositMemo?: string;
    quote: QuoteResponse;
  }> {
    const { senderAddress, recipientAddress, originAsset, destinationAsset, amount } = params;

    // Get a non-dry quote to obtain the deposit address
    const quote = await this.getQuote(
      senderAddress,
      recipientAddress,
      originAsset,
      destinationAsset,
      amount,
      false, // dry=false is required to get depositAddress
    );

    const depositAddress = quote.quote?.depositAddress;
    if (!depositAddress) {
      throw new Error('Deposit address missing from quote. Ensure dry=false in quote request.');
    }

    // Some chains require a memo (e.g., Stellar, Cosmos)
    const depositMemo = quote.quote?.depositMemo;

    return {
      depositAddress,
      depositMemo,
      quote,
    };
  }

  /**
   * Provide detailed lifecycle information for a token purchase.
   * Use this to display swap details to users before they commit funds.
   *
   * Returns expected output amount, slippage tolerance, deadline, and other
   * critical information users need to make informed decisions.
   *
   * @param originAsset - Input token symbol or assetId
   * @param destinationAsset - Output token symbol or assetId
   * @param amount - Amount to swap in smallest units
   * @param senderAddress - Origin chain refund address
   * @param recipientAddress - Destination chain recipient address
   * @returns Purchase lifecycle details
   */
  async getPurchaseInfo(params: {
    originAsset: string;
    destinationAsset: string;
    amount: string;
    senderAddress: string;
    recipientAddress: string;
  }): Promise<{
    expectedOut: string;
    minAmountOut: string;
    slippageBps: number;
    deadline: string;
    timeEstimate: number;
    destinationAssetSymbol: string;
    originAssetSymbol: string;
    amountOutUsd?: string;
    amountInUsd?: string;
  }> {
    const { senderAddress, recipientAddress, originAsset, destinationAsset, amount } = params;

    // Resolve tokens to get their symbols
    const originSupport = await this.checkNearIntentSupport(originAsset);
    if (!originSupport.supported || !originSupport.token?.assetId) {
      throw new Error(`Input token not supported: ${originAsset}`);
    }
    const destinationSupport = await this.checkNearIntentSupport(destinationAsset);
    if (!destinationSupport.supported || !destinationSupport.token?.assetId) {
      throw new Error(`Output token not supported: ${destinationAsset}`);
    }

    // Use dry quote (estimation only, no deposit address generated)
    const quote = await this.getQuote(
      senderAddress,
      recipientAddress,
      originAsset,
      destinationAsset,
      amount,
      true, // dry=true for estimation
    );

    if (!quote.quote) {
      throw new Error('Quote data missing from response');
    }

    return {
      expectedOut: quote.quote.amountOutFormatted || '0',
      minAmountOut: quote.quote.minAmountOut || '0',
      slippageBps: quote.quoteRequest?.slippageTolerance || 0,
      deadline: quote.quote.deadline || '',
      timeEstimate: quote.quote.timeEstimate || 0,
      destinationAssetSymbol: destinationSupport.token.symbol || destinationAsset,
      originAssetSymbol: originSupport.token.symbol || originAsset,
      amountOutUsd: quote.quote.amountOutUsd,
      amountInUsd: quote.quote.amountInUsd,
    };
  }

  /**
   * After user deposits funds to the depositAddress, this settles the swap.
   *
   * Workflow:
   * 1. (Optional) Submit txHash to speed up detection
   * 2. Poll swap status until terminal state
   * 3. Return final execution status
   *
   * @param depositAddress - Deposit address from generateDepositAddress()
   * @param txHash - Optional transaction hash to speed up processing
   * @param depositMemo - Optional memo if required by the chain
   * @param waitForSettlement - If true, polls until terminal state
   * @returns Final execution status
   */
  async settleDeposit(params: {
    depositAddress: string;
    txHash?: string;
    depositMemo?: string;
    waitForSettlement?: boolean;
  }): Promise<GetExecutionStatusResponse> {
    const { depositAddress, txHash, depositMemo, waitForSettlement = true } = params;

    // Step 1: Submit txHash if provided (speeds up swap detection)
    if (txHash) {
      const submitRequest: SubmitDepositTxRequest = {
        txHash,
        depositAddress,
        ...(depositMemo && { memo: depositMemo }),
      };
      await OneClickService.submitDepositTx(submitRequest);
      console.log(`Submitted txHash: ${txHash} for depositAddress: ${depositAddress}`);
    }

    // Step 2: If not waiting, return current status immediately
    if (!waitForSettlement) {
      return await this.checkStatus(depositAddress);
    }

    // Step 3: Poll until swap reaches terminal state
    console.log(`Polling settlement for depositAddress: ${depositAddress}`);
    return await this.pollStatusUntilSuccess(depositAddress);
  }

  /**
   * Get comprehensive swap status with detailed transaction information.
   * Useful for displaying progress to users in the UI.
   *
   * @param depositAddress - Deposit address to check
   * @returns Enhanced status response with swap details
   */
  async getDetailedSwapStatus(depositAddress: string): Promise<{
    status: string;
    updatedAt: string;
    swapDetails?: {
      amountIn?: string;
      amountInFormatted?: string;
      amountOut?: string;
      amountOutFormatted?: string;
      originChainTxHashes?: Array<{ hash: string; explorerUrl: string }>;
      destinationChainTxHashes?: Array<{ hash: string; explorerUrl: string }>;
      refundedAmount?: string;
      slippage?: number;
    };
    isComplete: boolean;
    isSuccess: boolean;
    isFailed: boolean;
  }> {
    const statusResponse = await this.checkStatus(depositAddress);

    const status = statusResponse.status || 'UNKNOWN';
    const isComplete = ['SUCCESS', 'REFUNDED', 'FAILED'].includes(status);
    const isSuccess = status === 'SUCCESS';
    const isFailed = status === 'FAILED';

    return {
      status,
      updatedAt: statusResponse.updatedAt || new Date().toISOString(),
      swapDetails: statusResponse.swapDetails,
      isComplete,
      isSuccess,
      isFailed,
    };
  }

  // ===================================================================
  // EXISTING METHODS
  // ===================================================================

  /**
   * nearIntentSwap: Use NEAR Intents to swap to native assets.
   *
   * Parameters:
   * - inputToken: token symbol (e.g., "wNEAR") or assetId
   * - outputToken: token symbol (e.g., "SOL") or assetId
   * - amount: input amount in smallest units (string)
   * - slippage: acceptable slippage as a percentage (e.g., 1.0 for 1%)
   *
   * Optional options:
   * - senderAddress: origin chain refund address (required for quote)
   * - recipientAddress: destination chain recipient address (required for quote)
   * - waitForSettlement: when true, poll status until terminal and return final status
   *
   * Returns: { txHash, receivedAmountFormatted, depositAddress, status }
   * - txHash is returned when NEAR-native transfer is executed by this helper
   * - receivedAmountFormatted is taken from quote expectation (not a guarantee)
   */
  async nearIntentSwap(params: {
    inputToken: string;
    outputToken: string;
    amount: string;
    slippage: number;
    senderAddress: string;
    senderPrivateKey: string;
    recipientAddress: string;
    waitForSettlement?: boolean;
  }): Promise<{
    txHash?: string;
    receivedAmountFormatted?: string;
    depositAddress: string;
    status?: GetExecutionStatusResponse;
    quote: QuoteResponse;
  }> {
    const {
      inputToken,
      outputToken,
      amount,
      slippage,
      senderAddress,
      senderPrivateKey,
      recipientAddress,
      waitForSettlement = true,
    } = params;

    const slippageBps = Math.round(slippage * 100);

    // Resolve tokens (assetId, contract name, or symbol) to supported tokens
    const originSupport = await this.checkNearIntentSupport(inputToken);
    if (!originSupport.supported || !originSupport.token?.assetId) {
      throw new Error(`Input token not supported: ${inputToken}`);
    }
    const destinationSupport = await this.checkNearIntentSupport(outputToken);
    if (!destinationSupport.supported || !destinationSupport.token?.assetId) {
      throw new Error(`Output token not supported: ${outputToken}`);
    }

    const originAssetId = originSupport.token.assetId;
    const destinationAssetId = destinationSupport.token.assetId;

    const quoteRequest: QuoteRequest = {
      dry: false,
      swapType: QuoteRequest.swapType.EXACT_INPUT,
      slippageTolerance: slippageBps,
      originAsset: originAssetId,
      depositType: QuoteRequest.depositType.ORIGIN_CHAIN,
      destinationAsset: destinationAssetId,
      amount,
      refundTo: senderAddress,
      refundType: QuoteRequest.refundType.ORIGIN_CHAIN,
      recipient: recipientAddress,
      recipientType: QuoteRequest.recipientType.DESTINATION_CHAIN,
      deadline: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
      referral: 'referral',
      quoteWaitingTimeMs: 3000,
    };

    const quote = await OneClickService.getQuote(quoteRequest);
    const depositAddress = quote.quote?.depositAddress as string | undefined;
    if (!depositAddress) {
      throw new Error('No deposit address in quote');
    }
    const confirmedDepositAddress = depositAddress as string;

    let txHash: string | undefined;

    // If origin is NEAR and credentials provided, send funds programmatically
    if (originAssetId === 'nep141:wrap.near' && senderAddress && senderPrivateKey) {
      const account = await this.getAccount(senderAddress, senderPrivateKey);
      const res = await account.transfer({
        token: NEAR,
        amount,
        receiverId: confirmedDepositAddress,
      });
      txHash = res.transaction.hash;

      if (txHash) {
        await this.submitTxHash(txHash, confirmedDepositAddress);
      }
    }

    const receivedAmountFormatted = quote.quote?.amountOutFormatted;

    if (!waitForSettlement) {
      return { txHash, receivedAmountFormatted, depositAddress: confirmedDepositAddress, quote };
    }

    const status = await this.pollStatusUntilSuccess(confirmedDepositAddress);
    return {
      txHash,
      receivedAmountFormatted,
      depositAddress: confirmedDepositAddress,
      status,
      quote,
    };
  }

  /**
   * checkNearIntentSupport: Check if a token is supported by NEAR Intents
   *
   * Parameters:
   * - input: token symbol (e.g., wNEAR, SOL). AssetId/contract name are also accepted.
   *
   * Returns: { supported: boolean, token: TokenResponse }
   */
  async checkNearIntentSupport(
    input: string,
  ): Promise<{ supported: boolean; token: TokenResponse }> {
    const tokens = await OneClickService.getTokens();

    const normalized = (input || '').trim().toLowerCase();

    const resolved = tokens.find((t) => {
      const assetMatch = t.assetId && t.assetId.toLowerCase() === normalized;
      const contractMatch = t.contractAddress && t.contractAddress.toLowerCase() === normalized;
      const symbolMatch = t.symbol && t.symbol.toLowerCase() === normalized;
      return Boolean(assetMatch || contractMatch || symbolMatch);
    });

    const supported = Boolean(resolved);
    return { supported, token: resolved as TokenResponse };
  }

  private async getAccount(address: string, privateKey: string): Promise<Account> {
    const signer = KeyPairSigner.fromSecretKey(privateKey as KeyPairString);
    const provider = new JsonRpcProvider({ url: 'https://rpc.mainnet.fastnear.com' });
    return new Account(address, provider as Provider, signer);
  }
}
