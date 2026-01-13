import {
  Connection,
  Keypair,
  PublicKey,
  ComputeBudgetProgram,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getMint, unpackMint } from '@solana/spl-token';
import {
  BaseFee,
  BIN_STEP_BPS_DEFAULT,
  BIN_STEP_BPS_U128_DEFAULT,
  calculateTransferFeeIncludedAmount,
  CpAmm,
  getBaseFeeParams,
  getDynamicFeeParams,
  getPriceFromSqrtPrice,
  getSqrtPriceFromPrice,
  getTokenProgram,
  getUnClaimLpFee,
  MAX_SQRT_PRICE,
  MIN_SQRT_PRICE,
  PoolFeesParams,
  getLiquidityDeltaFromAmountA,
  Swap2Params,
  SwapMode,
  GetQuote2Params,
} from '@meteora-ag/cp-amm-sdk';
import { ActivationType } from '@meteora-ag/dynamic-bonding-curve-sdk';
import Decimal from 'decimal.js';
// @ts-ignore
import BN from 'bn.js';
import {
  SOL_TOKEN_DECIMALS,
  QUOTE_MINT_SOL,
  COMPUTE_UNIT_PRICE_MICRO_LAMPORTS,
} from '../utils/contants';

// Interface

// Fee Scheduler Parameters (for baseFeeMode 0 or 1)
export interface FeeSchedulerParam {
  startingFeeBps: number; // starting base fee (in basis points)
  endingFeeBps: number; // ending base fee (in basis points)
  numberOfPeriod: number; // number of periods
  totalDuration: number; // total duration (If activationType is 0 (slots), totalDuration = duration / 0.4 | If activationType is 1 (timestamp), totalDuration = duration)
}

// Rate Limiter Parameters (for baseFeeMode 2)
export interface RateLimiterParam {
  baseFeeBps: number; // base fee (max 50% base fee === 5000 bps)
  feeIncrementBps: number; // fee increment (max fee increment = 5000 bps - baseFeeBps)
  referenceAmount: number; // reference amount (not in lamports)
  maxLimiterDuration: number; // if activationType is 0 (slots), maxLimiterDuration = duration / 0.4, if activationType is 1 (timestamp), maxLimiterDuration = duration)
  maxFeeBps: number; // max 50% base fee can go to === 5000 bps
}

// Dynamic Fee Configuration (optional)
export interface DynamicFeeConfig {
  filterPeriod: number; // Time period (in slots/seconds) over which volatility is measured and smoothed
  decayPeriod: number; // Time period (in slots/seconds) over which volatility accumulator decays back to zero
  reductionFactor: number; // Volatility decay rate in basis points (5000 = 50% reduction per decay period)
  variableFeeControl: number; // Scaling factor that controls how much volatility affects dynamic fees
  maxVolatilityAccumulator: number; // Maximum allowed volatility accumulator value (caps dynamic fee calculation)
}

// Base Fee Configuration
export interface BaseFeeConfig {
  baseFeeMode: 0 | 1 | 2; // 0 - Fee Scheduler: Linear | 1 - Fee Scheduler: Exponential | 2 - Rate Limiter
  feeSchedulerParam?: FeeSchedulerParam; // Required if baseFeeMode is 0 or 1
  rateLimiterParam?: RateLimiterParam; // Required if baseFeeMode is 2
}

// Pool Fees Configuration
export interface PoolFeesConfig {
  baseFee: BaseFeeConfig;
  dynamicFeeEnabled: boolean; // if dynamicFeeEnabled is true and dynamicFeeConfig is null, the default dynamic fee configuration will be 20% of the base fee
  dynamicFeeConfig?: DynamicFeeConfig; // Optional: Only used if you want to configure dynamic fee and not use the default dynamic fee configuration
}

export interface DAMMV2Config {
  baseAmount: number; // base token amount
  quoteAmount: number | null; // quote token amount
  initPrice: number; // initial price (supports decimals, e.g. 0.000000001)
  minPrice: number | null; // min price (in terms of quote/base price) - NOTE: null would use the MIN_SQRT_PRICE for the DAMM v2 balanced pool
  maxPrice: number | null; // max price (in terms of quote/base price) - NOTE: null would use the MAX_SQRT_PRICE for the DAMM v2 balanced pool
  poolFees: PoolFeesConfig; // pool fees configuration
  hasAlphaVault: boolean; // if true, the alpha vault will be created after the pool is created
  activationPoint: number | null; // activation time of the pool depending on activationType (Calculate in slots if activationType is 0 (slots) | Calculate in seconds if activationType is 1 (timestamp))
  activationType: number; // 0 - Slot | 1 - Timestamp
  collectFeeMode: number; // 0 - Both Token | 1 - Token B Only
}

// Helper functions

export function getDecimalizedAmount(amountLamport: BN, decimals: number): BN {
  return amountLamport.div(new BN(10 ** decimals));
}

export async function getCurrentPoint(
  connection: Connection,
  activationType: ActivationType,
): Promise<BN> {
  const currentSlot = await connection.getSlot();

  if (activationType === ActivationType.Slot) {
    return new BN(currentSlot);
  } else {
    const currentTime = await connection.getBlockTime(currentSlot);
    if (currentTime === null) {
      throw new Error('Failed to get block time');
    }
    return new BN(currentTime);
  }
}

export function getAmountInTokens(amountLamport: BN, decimals: number): string {
  const amountDecimal = new Decimal(amountLamport.toString());
  const divisor = new Decimal(10 ** decimals);
  const formatted = amountDecimal.div(divisor);
  return formatted.toString();
}

export function getAmountInLamports(amount: number | string, decimals: number): BN {
  const amountD = new Decimal(amount);
  const amountLamports = amountD.mul(new Decimal(10 ** decimals));
  return new BN(amountLamports.toString());
}

export async function getQuoteDecimals(
  connection: Connection,
  quoteMint?: string,
): Promise<number> {
  if (quoteMint) {
    const quoteMintInfo = await connection.getAccountInfo(new PublicKey(quoteMint));
    if (!quoteMintInfo) {
      throw new Error(`Quote mint account not found: ${quoteMint}`);
    }
    const mintAccount = await getMint(
      connection,
      new PublicKey(quoteMint),
      connection.commitment,
      quoteMintInfo.owner,
    );
    const decimals = mintAccount.decimals;
    return decimals;
  }
  return SOL_TOKEN_DECIMALS;
}

/**
 * Modify priority fee in transaction
 * @param tx
 * @param newPriorityFee
 * @returns {boolean} true if priority fee was modified
 **/
export const modifyComputeUnitPriceIx = (
  tx: VersionedTransaction | Transaction,
  newPriorityFee: number,
): boolean => {
  if (!tx) {
    console.warn(
      'modifyComputeUnitPriceIx: Transaction is null or undefined, skipping modification',
    );
    return false;
  }

  if ('version' in tx) {
    for (const ix of tx.message.compiledInstructions) {
      const programId = tx.message.staticAccountKeys[ix.programIdIndex];
      if (programId && ComputeBudgetProgram.programId.equals(programId)) {
        if (ix.data[0] === 3) {
          ix.data = Uint8Array.from(
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: newPriorityFee,
            }).data,
          );
          return true;
        }
      }
    }
  } else {
    for (const ix of tx.instructions) {
      if (ComputeBudgetProgram.programId.equals(ix.programId)) {
        if (ix.data[0] === 3) {
          ix.data = ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: newPriorityFee,
          }).data;
          return true;
        }
      }
    }

    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: newPriorityFee,
      }),
    );
    return true;
  }

  return false;
};

// Main functions

/**
 * Create a one-sided DAMM V2 pool
 * @param config - The DAMM V2 config
 * @param connection - The connection to the network
 * @param wallet - The wallet to use for the transaction
 * @param baseTokenMint - The base token mint
 * @param quoteTokenMint - The quote token mint
 */
export async function createDammV2OneSidedPool(
  config: DAMMV2Config,
  connection: Connection,
  payer: PublicKey,
  creator: PublicKey,
  baseTokenMint: PublicKey,
  quoteTokenMint: PublicKey,
) {
  console.log('\n> Initializing one-sided DAMM V2 pool...');
  const quoteDecimals = await getQuoteDecimals(connection, QUOTE_MINT_SOL);

  let baseTokenInfo = null;
  let baseTokenProgram = TOKEN_PROGRAM_ID;

  const baseMintAccountInfo = await connection.getAccountInfo(
    new PublicKey(baseTokenMint),
    connection.commitment,
  );

  if (!baseMintAccountInfo) {
    throw new Error(`Base mint account not found: ${baseTokenMint}`);
  }

  const baseMint = unpackMint(baseTokenMint, baseMintAccountInfo, baseMintAccountInfo.owner);

  if (baseMintAccountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    const epochInfo = await connection.getEpochInfo();
    baseTokenInfo = {
      mint: baseMint,
      currentEpoch: epochInfo.epoch,
    };
    baseTokenProgram = TOKEN_2022_PROGRAM_ID;
  }

  const baseDecimals = baseMint.decimals;

  const cpAmmInstance = new CpAmm(connection);

  const {
    initPrice,
    maxPrice,
    poolFees,
    baseAmount,
    quoteAmount,
    hasAlphaVault,
    activationPoint,
    activationType,
    collectFeeMode,
  } = config;

  const { baseFee, dynamicFeeEnabled, dynamicFeeConfig } = poolFees;

  let tokenAAmount = getAmountInLamports(baseAmount, baseDecimals);
  let tokenBAmount = new BN(0);

  // transfer fee if token2022
  if (baseTokenInfo) {
    tokenAAmount = tokenAAmount.sub(
      calculateTransferFeeIncludedAmount(
        tokenAAmount,
        baseTokenInfo.mint,
        baseTokenInfo.currentEpoch,
      ).transferFee,
    );
  }

  const maxSqrtPrice = maxPrice
    ? getSqrtPriceFromPrice(maxPrice.toString(), baseDecimals, quoteDecimals)
    : MAX_SQRT_PRICE;

  const initSqrtPrice = getSqrtPriceFromPrice(initPrice.toString(), baseDecimals, quoteDecimals);
  let minSqrtPrice = initSqrtPrice;

  const liquidityDelta = getLiquidityDeltaFromAmountA(tokenAAmount, initSqrtPrice, maxSqrtPrice);

  if (quoteAmount) {
    tokenBAmount = getAmountInLamports(quoteAmount, quoteDecimals);
    // L = Δb / (√P_upper - √P_lower)
    // √P_lower = √P_upper - Δb / L
    const numerator = tokenBAmount.shln(128).div(liquidityDelta);
    minSqrtPrice = initSqrtPrice.sub(numerator);
  }

  let dynamicFee = null;
  if (dynamicFeeEnabled) {
    if (dynamicFeeConfig) {
      dynamicFee = {
        binStep: BIN_STEP_BPS_DEFAULT,
        binStepU128: BIN_STEP_BPS_U128_DEFAULT,
        filterPeriod: dynamicFeeConfig.filterPeriod,
        decayPeriod: dynamicFeeConfig.decayPeriod,
        reductionFactor: dynamicFeeConfig.reductionFactor,
        variableFeeControl: dynamicFeeConfig.variableFeeControl,
        maxVolatilityAccumulator: dynamicFeeConfig.maxVolatilityAccumulator,
      };
    } else {
      const flatFeeBps =
        baseFee.baseFeeMode === 2
          ? (baseFee.rateLimiterParam?.baseFeeBps ?? 0)
          : (baseFee.feeSchedulerParam?.startingFeeBps ?? 0);
      dynamicFee = getDynamicFeeParams(flatFeeBps);
    }
  }

  const baseFeeParams: BaseFee = getBaseFeeParams(baseFee, quoteDecimals, activationType);

  const poolFeesParams: PoolFeesParams = {
    baseFee: baseFeeParams,
    padding: [],
    dynamicFee,
  };
  const positionNft = Keypair.generate();

  const {
    tx: initCustomizePoolTx,
    pool,
    position,
  } = await cpAmmInstance.createCustomPool({
    payer,
    creator,
    positionNft: positionNft.publicKey,
    tokenAMint: baseTokenMint,
    tokenBMint: quoteTokenMint,
    tokenAAmount: tokenAAmount,
    tokenBAmount: tokenBAmount,
    sqrtMinPrice: minSqrtPrice,
    sqrtMaxPrice: maxSqrtPrice,
    liquidityDelta: liquidityDelta,
    initSqrtPrice,
    poolFees: poolFeesParams,
    hasAlphaVault: hasAlphaVault,
    activationType,
    collectFeeMode: collectFeeMode,
    activationPoint: activationPoint ? new BN(activationPoint) : null,
    tokenAProgram: baseTokenProgram,
    tokenBProgram: TOKEN_PROGRAM_ID,
  });

  modifyComputeUnitPriceIx(initCustomizePoolTx, COMPUTE_UNIT_PRICE_MICRO_LAMPORTS ?? 0);

  console.log(`\n> Pool address: ${pool}`);
  console.log(`\n> Position address: ${position}`);

  return {
    pool,
    position,
    initCustomizePoolTx,
    signers: [positionNft],
  };
}

/**
 * Create a balanced DAMM V2 pool
 * @param baseTokenMint - The base token mint
 * @param quoteTokenMint - The quote token mint
 */
export async function createDammV2BalancedPool(
  config: DAMMV2Config,
  connection: Connection,
  payer: PublicKey,
  creator: PublicKey,
  baseTokenMint: PublicKey,
  quoteTokenMint: PublicKey,
) {
  const quoteDecimals = await getQuoteDecimals(connection, QUOTE_MINT_SOL);

  let baseTokenInfo = null;
  let baseTokenProgram = TOKEN_PROGRAM_ID;

  const baseMintAccountInfo = await connection.getAccountInfo(
    new PublicKey(baseTokenMint),
    connection.commitment,
  );

  if (!baseMintAccountInfo) {
    throw new Error(`Base mint account not found: ${baseTokenMint}`);
  }

  const baseMint = unpackMint(baseTokenMint, baseMintAccountInfo, baseMintAccountInfo.owner);

  if (baseMintAccountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    const epochInfo = await connection.getEpochInfo();
    baseTokenInfo = {
      mint: baseMint,
      currentEpoch: epochInfo.epoch,
    };
    baseTokenProgram = TOKEN_2022_PROGRAM_ID;
  }

  let quoteTokenInfo = null;
  let quoteTokenProgram = TOKEN_PROGRAM_ID;

  const quoteMintAccountInfo = await connection.getAccountInfo(
    new PublicKey(quoteTokenMint),
    connection.commitment,
  );

  if (!quoteMintAccountInfo) {
    throw new Error(`Quote mint account not found: ${quoteTokenMint}`);
  }

  const quoteMint = unpackMint(quoteTokenMint, quoteMintAccountInfo, quoteMintAccountInfo.owner);

  if (quoteMintAccountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    const epochInfo = await connection.getEpochInfo();
    quoteTokenInfo = {
      mint: quoteMint,
      currentEpoch: epochInfo.epoch,
    };
    quoteTokenProgram = TOKEN_2022_PROGRAM_ID;
  }

  const baseDecimals = baseMint.decimals;

  // create cp amm instance
  const cpAmmInstance = new CpAmm(connection);
  const {
    baseAmount,
    quoteAmount,
    initPrice,
    minPrice,
    maxPrice,
    poolFees,
    hasAlphaVault,
    activationPoint,
    activationType,
    collectFeeMode,
  } = config;

  const { baseFee, dynamicFeeEnabled, dynamicFeeConfig } = poolFees;

  if (!quoteAmount) {
    throw new Error('Quote amount is required for balanced pool');
  }

  let tokenAAmount = getAmountInLamports(baseAmount, baseDecimals);
  let tokenBAmount = getAmountInLamports(quoteAmount, quoteDecimals);

  if (baseTokenInfo) {
    tokenAAmount = tokenAAmount.sub(
      calculateTransferFeeIncludedAmount(
        tokenAAmount,
        baseTokenInfo.mint,
        baseTokenInfo.currentEpoch,
      ).transferFee,
    );
  }

  if (quoteTokenInfo) {
    tokenBAmount = tokenBAmount.sub(
      calculateTransferFeeIncludedAmount(
        tokenBAmount,
        quoteTokenInfo.mint,
        quoteTokenInfo.currentEpoch,
      ).transferFee,
    );
  }

  const initSqrtPrice = getSqrtPriceFromPrice(initPrice.toString(), baseDecimals, quoteDecimals);

  const minSqrtPrice = minPrice
    ? getSqrtPriceFromPrice(minPrice.toString(), baseDecimals, quoteDecimals)
    : MIN_SQRT_PRICE;
  const maxSqrtPrice = maxPrice
    ? getSqrtPriceFromPrice(maxPrice.toString(), baseDecimals, quoteDecimals)
    : MAX_SQRT_PRICE;

  const liquidityDelta = cpAmmInstance.getLiquidityDelta({
    maxAmountTokenA: tokenAAmount,
    maxAmountTokenB: tokenBAmount,
    sqrtPrice: initSqrtPrice,
    sqrtMinPrice: minSqrtPrice,
    sqrtMaxPrice: maxSqrtPrice,
    tokenAInfo: baseTokenInfo || undefined,
  });

  let dynamicFee = null;
  if (dynamicFeeEnabled) {
    if (dynamicFeeConfig) {
      dynamicFee = {
        binStep: BIN_STEP_BPS_DEFAULT,
        binStepU128: BIN_STEP_BPS_U128_DEFAULT,
        filterPeriod: dynamicFeeConfig.filterPeriod,
        decayPeriod: dynamicFeeConfig.decayPeriod,
        reductionFactor: dynamicFeeConfig.reductionFactor,
        variableFeeControl: dynamicFeeConfig.variableFeeControl,
        maxVolatilityAccumulator: dynamicFeeConfig.maxVolatilityAccumulator,
      };
    } else {
      const flatFeeBps =
        baseFee.baseFeeMode === 2
          ? (baseFee.rateLimiterParam?.baseFeeBps ?? 0)
          : (baseFee.feeSchedulerParam?.startingFeeBps ?? 0);
      dynamicFee = getDynamicFeeParams(flatFeeBps);
    }
  }

  const baseFeeParams: BaseFee = getBaseFeeParams(baseFee, quoteDecimals, activationType);

  const poolFeesParams: PoolFeesParams = {
    baseFee: baseFeeParams,
    padding: [],
    dynamicFee,
  };

  const positionNft = Keypair.generate();

  const {
    tx: initCustomizePoolTx,
    pool,
    position,
  } = await cpAmmInstance.createCustomPool({
    payer,
    creator,
    positionNft: positionNft.publicKey,
    tokenAMint: baseTokenMint,
    tokenBMint: quoteTokenMint,
    tokenAAmount: tokenAAmount,
    tokenBAmount: tokenBAmount,
    sqrtMinPrice: minSqrtPrice,
    sqrtMaxPrice: maxSqrtPrice,
    liquidityDelta: liquidityDelta,
    initSqrtPrice,
    poolFees: poolFeesParams,
    hasAlphaVault: hasAlphaVault,
    activationType,
    collectFeeMode: collectFeeMode,
    activationPoint: activationPoint ? new BN(activationPoint) : null,
    tokenAProgram: baseTokenProgram,
    tokenBProgram: TOKEN_PROGRAM_ID,
  });

  modifyComputeUnitPriceIx(initCustomizePoolTx, COMPUTE_UNIT_PRICE_MICRO_LAMPORTS ?? 0);

  return {
    pool,
    position,
    initCustomizePoolTx,
    signers: [positionNft],
  };
}

export async function getPositions(
  connection: Connection,
  user: PublicKey,
  poolAddress: PublicKey,
) {
  if (!user) {
    throw new Error('User is required');
  }

  console.log('\n> Fetching positions...');

  const cpAmmInstance = new CpAmm(connection);

  const poolState = await cpAmmInstance.fetchPoolState(poolAddress);

  const userPositions = await cpAmmInstance.getUserPositionByPool(poolAddress, user);

  if (userPositions.length === 0) {
    console.log('> No position found');
    return;
  }

  const positionDataArray = [];
  for (const userPosition of userPositions) {
    const positionState = await cpAmmInstance.fetchPositionState(userPosition.position);
    const unclaimedLpFee = getUnClaimLpFee(poolState, positionState);
    positionDataArray.push({
      userPosition,
      positionState,
      unclaimedLpFee,
    });
  }

  return positionDataArray;
}

/**
 * Add liquidity to a position
 * @param config - The DAMM V2 config
 * @param connection - The connection to the network
 * @param wallet - The wallet to use for the transaction
 * @param poolAddress - The pool address
 */
export async function addLiquidity(
  connection: Connection,
  amountIn: number,
  isTokenA: boolean,
  user: PublicKey,
  poolAddress: PublicKey,
  selectedPositionData: any,
) {
  if (!poolAddress) {
    throw new Error('Pool address is required');
  }

  console.log('\n> Adding liquidity...');

  const cpAmmInstance = new CpAmm(connection);

  const poolState = await cpAmmInstance.fetchPoolState(poolAddress);

  console.log(`\n> Pool address: ${poolAddress.toString()}`);

  if (!selectedPositionData) {
    throw new Error('No position selected');
  }
  const { userPosition } = selectedPositionData;

  const tokenAMintInfo = await connection.getAccountInfo(poolState.tokenAMint);
  const tokenBMintInfo = await connection.getAccountInfo(poolState.tokenBMint);

  if (!tokenAMintInfo || !tokenBMintInfo) {
    throw new Error('Failed to fetch token mint information');
  }

  const tokenAMintData = unpackMint(poolState.tokenAMint, tokenAMintInfo, tokenAMintInfo.owner);
  const tokenBMintData = unpackMint(poolState.tokenBMint, tokenBMintInfo, tokenBMintInfo.owner);

  const amountInLamports = getAmountInLamports(
    amountIn,
    isTokenA ? tokenAMintData.decimals : tokenBMintData.decimals,
  );

  const depositQuote = await cpAmmInstance.getDepositQuote({
    inAmount: amountInLamports,
    isTokenA,
    minSqrtPrice: poolState.sqrtMinPrice,
    maxSqrtPrice: poolState.sqrtMaxPrice,
    sqrtPrice: poolState.sqrtPrice,
  });

  const maxAmountTokenA = isTokenA ? amountInLamports : depositQuote.outputAmount;
  const maxAmountTokenB = isTokenA ? depositQuote.outputAmount : amountInLamports;

  const tokenAAmountThreshold = isTokenA ? amountInLamports : depositQuote.outputAmount;
  const tokenBAmountThreshold = isTokenA ? depositQuote.outputAmount : amountInLamports;

  const addLiquidityTx = await cpAmmInstance.addLiquidity({
    owner: user,
    pool: poolAddress,
    position: userPosition.position,
    positionNftAccount: userPosition.positionNftAccount,
    liquidityDelta: depositQuote.liquidityDelta,
    maxAmountTokenA,
    maxAmountTokenB,
    tokenAAmountThreshold,
    tokenBAmountThreshold,
    tokenAMint: poolState.tokenAMint,
    tokenBMint: poolState.tokenBMint,
    tokenAVault: poolState.tokenAVault,
    tokenBVault: poolState.tokenBVault,
    tokenAProgram: getTokenProgram(poolState.tokenAFlag),
    tokenBProgram: getTokenProgram(poolState.tokenBFlag),
  });

  modifyComputeUnitPriceIx(addLiquidityTx, COMPUTE_UNIT_PRICE_MICRO_LAMPORTS ?? 0);

  return addLiquidityTx;
}

/**
 * Remove liquidity from a position
 * @param config - The DAMM V2 config
 * @param connection - The connection to the network
 * @param wallet - The wallet to use for the transaction
 * @param poolAddress - The pool address
 */
export async function removeLiquidity(
  connection: Connection,
  user: PublicKey,
  poolAddress: PublicKey,
  selectedPositionData: any,
  activationType: ActivationType,
) {
  if (!poolAddress) {
    throw new Error('Pool address is required');
  }

  console.log('\n> Removing liquidity...');

  const cpAmmInstance = new CpAmm(connection);

  const poolState = await cpAmmInstance.fetchPoolState(poolAddress);

  const userPositions = await cpAmmInstance.getUserPositionByPool(poolAddress, user);

  if (userPositions.length === 0) {
    console.log('> No position found');
    return;
  }

  console.log(`\n> Pool address: ${poolAddress.toString()}`);
  console.log(`\n> Found ${userPositions.length} position(s) in this pool`);

  const positionDataArray = [];
  for (const userPosition of userPositions) {
    const positionState = await cpAmmInstance.fetchPositionState(userPosition.position);
    const unclaimedLpFee = getUnClaimLpFee(poolState, positionState);
    positionDataArray.push({
      userPosition,
      positionState,
      unclaimedLpFee,
      totalPositionFeeA: positionState.metrics.totalClaimedAFee.add(unclaimedLpFee.feeTokenA),
      totalPositionFeeB: positionState.metrics.totalClaimedBFee.add(unclaimedLpFee.feeTokenB),
    });
  }

  if (!selectedPositionData) {
    throw new Error('No position selected');
  }
  const { userPosition, positionState, unclaimedLpFee, totalPositionFeeA, totalPositionFeeB } =
    selectedPositionData;

  console.log('\n> Position Fee Information:');
  console.log(`- Position Address: ${userPosition.position.toString()}`);
  console.log(`- Total Claimed Fee A: ${positionState.metrics.totalClaimedAFee.toString()}`);
  console.log(`- Unclaimed Fee A: ${unclaimedLpFee.feeTokenA.toString()}`);
  console.log(`- TOTAL POSITION FEE A: ${totalPositionFeeA.toString()}`);
  console.log(`- Total Claimed Fee B: ${positionState.metrics.totalClaimedBFee.toString()}`);
  console.log(`- Unclaimed Fee B: ${unclaimedLpFee.feeTokenB.toString()}`);
  console.log(`- TOTAL POSITION FEE B: ${totalPositionFeeB.toString()}`);

  const tokenAMintInfo = await connection.getAccountInfo(poolState.tokenAMint);
  const tokenBMintInfo = await connection.getAccountInfo(poolState.tokenBMint);

  if (!tokenAMintInfo || !tokenBMintInfo) {
    throw new Error('Failed to fetch token mint information');
  }

  const tokenAMintData = unpackMint(poolState.tokenAMint, tokenAMintInfo, tokenAMintInfo.owner);
  const tokenBMintData = unpackMint(poolState.tokenBMint, tokenBMintInfo, tokenBMintInfo.owner);

  const currentPositionState = await cpAmmInstance.fetchPositionState(userPosition.position);

  console.log(`\n> Current position liquidity:`);
  console.log(`- Unlocked liquidity: ${currentPositionState.unlockedLiquidity.toString()}`);
  console.log(`- Vested liquidity: ${currentPositionState.vestedLiquidity.toString()}`);
  console.log(
    `- Permanent locked liquidity: ${currentPositionState.permanentLockedLiquidity.toString()}`,
  );

  const vestings = await cpAmmInstance.getAllVestingsByPosition(userPosition.position);
  console.log(`\n> Found ${vestings.length} vesting account(s) for this position`);

  // total liquidity to remove (unlocked + vested)
  const finalPositionState = await cpAmmInstance.fetchPositionState(userPosition.position);
  const totalRemovableLiquidity = finalPositionState.unlockedLiquidity.add(
    finalPositionState.vestedLiquidity,
  );
  const liquidityToRemove = totalRemovableLiquidity;

  if (liquidityToRemove.isZero()) {
    console.log('> No removable liquidity to remove');
    return;
  }

  const withdrawQuote = await cpAmmInstance.getWithdrawQuote({
    liquidityDelta: liquidityToRemove,
    sqrtPrice: poolState.sqrtPrice,
    minSqrtPrice: poolState.sqrtMinPrice,
    maxSqrtPrice: poolState.sqrtMaxPrice,
  });

  const currentPoint = await getCurrentPoint(connection, activationType);

  const removeLiquidityTx = await cpAmmInstance.removeLiquidity({
    owner: user,
    position: userPosition.position,
    pool: poolAddress,
    positionNftAccount: userPosition.positionNftAccount,
    liquidityDelta: liquidityToRemove,
    tokenAAmountThreshold: withdrawQuote.outAmountA,
    tokenBAmountThreshold: withdrawQuote.outAmountB,
    tokenAMint: poolState.tokenAMint,
    tokenBMint: poolState.tokenBMint,
    tokenAVault: poolState.tokenAVault,
    tokenBVault: poolState.tokenBVault,
    tokenAProgram: getTokenProgram(poolState.tokenAFlag),
    tokenBProgram: getTokenProgram(poolState.tokenBFlag),
    currentPoint,
    vestings: vestings.map((vesting) => ({
      account: vesting.publicKey,
      vestingState: vesting.account,
    })),
  });

  modifyComputeUnitPriceIx(removeLiquidityTx, COMPUTE_UNIT_PRICE_MICRO_LAMPORTS ?? 0);

  return removeLiquidityTx;
}

/**
 *
 * @param config - The DAMM V2 config
 * @param connection - The connection to the network
 * @param wallet - The wallet to use for the transaction
 * @param poolAddress - The pool address
 */
export async function closePosition(
  user: PublicKey,
  poolAddress: PublicKey,
  selectedPositionData: any,
) {
  if (!poolAddress) {
    throw new Error('Pool address is required');
  }
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  console.log('\n> Closing position...');

  const cpAmmInstance = new CpAmm(connection);

  const poolState = await cpAmmInstance.fetchPoolState(poolAddress);

  const userPositions = await cpAmmInstance.getUserPositionByPool(poolAddress, user);

  if (userPositions.length === 0) {
    console.log('> No position found');
    return;
  }

  console.log(`\n> Pool address: ${poolAddress.toString()}`);

  if (!selectedPositionData) {
    throw new Error('No position selected');
  }
  const { userPosition } = selectedPositionData;

  const currentPositionState = await cpAmmInstance.fetchPositionState(userPosition.position);

  const closePositionTx = await cpAmmInstance.closePosition({
    owner: user,
    pool: poolAddress,
    position: userPosition.position,
    positionNftMint: currentPositionState.nftMint,
    positionNftAccount: userPosition.positionNftAccount,
  });

  modifyComputeUnitPriceIx(closePositionTx, COMPUTE_UNIT_PRICE_MICRO_LAMPORTS ?? 0);

  return closePositionTx;
}

/**
 * Claim position fee for user positions (with interactive selection if multiple positions exist)
 * @param config - The DAMM V2 config
 * @param connection - The connection to the network
 * @param wallet - The wallet to use for the transaction
 * @param poolAddress - The pool address
 */
export async function claimPositionFee(
  connection: Connection,
  user: PublicKey,
  poolAddress: PublicKey,
  selectedPositionData: any, // We will select position in UI, so no interactive prompt here
) {
  if (!poolAddress) {
    throw new Error('Pool address is required');
  }

  console.log('\n> Claiming position fee...');

  const cpAmmInstance = new CpAmm(connection);

  const poolState = await cpAmmInstance.fetchPoolState(poolAddress);

  if (!selectedPositionData) {
    throw new Error('No position selected for claiming fees');
  }

  const { userPosition } = selectedPositionData;

  const claimPositionFeeTx = await cpAmmInstance.claimPositionFee({
    owner: user,
    receiver: user,
    pool: poolAddress,
    position: userPosition.position,
    positionNftAccount: userPosition.positionNftAccount,
    tokenAVault: poolState.tokenAVault,
    tokenBVault: poolState.tokenBVault,
    tokenAMint: poolState.tokenAMint,
    tokenBMint: poolState.tokenBMint,
    tokenAProgram: getTokenProgram(poolState.tokenAFlag),
    tokenBProgram: getTokenProgram(poolState.tokenBFlag),
    feePayer: user,
  });

  modifyComputeUnitPriceIx(claimPositionFeeTx, COMPUTE_UNIT_PRICE_MICRO_LAMPORTS ?? 0);

  return claimPositionFeeTx;
}

/**
 * Get pool address for a token pair
 * @param connection - The connection to the network
 * @param baseTokenMint - The base token mint
 * @param quoteTokenMint - The quote token mint
 */
export async function getPoolAddress(
  connection: Connection,
  baseTokenMint: PublicKey,
  quoteTokenMint: PublicKey,
): Promise<PublicKey | null> {
  const cpAmmInstance = new CpAmm(connection);
  try {
    const pools = await cpAmmInstance.fetchPoolStatesByTokenAMint(baseTokenMint);
    // filter by quote token mint
    const pool = pools.find(
      (p: { publicKey: PublicKey; account: any }) =>
        p.account.tokenBMint && p.account.tokenBMint.equals(quoteTokenMint),
    );

    if (pool) {
      return pool.publicKey;
    }

    // Also try checking if baseToken is tokenB (swap order)
    const poolsB = await cpAmmInstance.fetchPoolStatesByTokenAMint(quoteTokenMint);
    const poolB = poolsB.find(
      (p: { publicKey: PublicKey; account: any }) =>
        p.account.tokenBMint && p.account.tokenBMint.equals(baseTokenMint),
    );

    if (poolB) {
      return poolB.publicKey;
    }

    return null;
  } catch (error) {
    console.error('Error fetching pool address:', error);
    return null;
  }
}

/**
 * Get pool info (state)
 * @param connection - The connection to the network
 * @param poolAddress - The pool address
 */
export async function getPoolInfo(connection: Connection, poolAddress: PublicKey) {
  const cpAmmInstance = new CpAmm(connection);
  try {
    const poolState = await cpAmmInstance.fetchPoolState(poolAddress);
    return poolState;
  } catch (error) {
    console.error('Error fetching pool info:', error);
    return null;
  }
}

// 24h Statistics Interface
export interface Pool24hStats {
  volume24h: number;
  fees24h: number;
  trades24h?: number;
}

/**
 * Fetch 24h trading statistics from Meteora API
 * @param poolAddress - The pool address
 * @returns Pool24hStats or null if unavailable
 */
export async function getPool24hStats(poolAddress: string): Promise<Pool24hStats | null> {
  try {
    const response = await fetch(`https://app.meteora.ag/amm/api/pair/${poolAddress}`);
    if (!response.ok) return null;

    const data = await response.json();
    return {
      volume24h: data.volume_24h || 0,
      fees24h: data.fees_24h || 0,
      trades24h: data.trades_24h,
    };
  } catch (error) {
    console.error('Error fetching 24h stats:', error);
    return null;
  }
}

export async function getAmountOut(
  connection: Connection,
  poolAddress: PublicKey,
  amountIn: number,
  inputTokenMint: PublicKey,
  outputTokenMint: PublicKey,
  inputDecimals: number,
  outputDecimals: number,
) {
  const cpAmmInstance = new CpAmm(connection);
  try {
    const poolState = await cpAmmInstance.fetchPoolState(poolAddress);
    const currentPoint = await getCurrentPoint(connection, poolState.activationType);
    const amountInBN = getAmountInLamports(amountIn, inputDecimals);

    let tokenADecimal = inputDecimals;
    let tokenBDecimal = outputDecimals;

    // If input is Token B, swap decimals
    if (poolState.tokenBMint.equals(inputTokenMint)) {
      tokenADecimal = outputDecimals;
      tokenBDecimal = inputDecimals;
    }

    const quote2Params: GetQuote2Params = {
      poolState,
      inputTokenMint,
      swapMode: SwapMode.ExactIn,
      amountIn: amountInBN,
      currentPoint,
      tokenADecimal,
      tokenBDecimal,
      hasReferral: false,
      slippage: 0,
    };

    const quote2Result = cpAmmInstance.getQuote2(quote2Params);
    return {
      amountOut: getAmountInTokens(quote2Result.outputAmount, outputDecimals),
      amountOutBN: quote2Result.outputAmount,
      priceImpact: quote2Result.priceImpact,
    };
  } catch (error) {
    console.error('Error fetching amount out:', error);
    return null;
  }
}

export async function swap(
  connection: Connection,
  poolAddress: PublicKey,
  payer: PublicKey,
  inputTokenMint: PublicKey,
  outputTokenMint: PublicKey,
  amountIn: number,
  minAmountOut: number,
  inputDecimals: number,
  outputDecimals: number,
) {
  const cpAmmInstance = new CpAmm(connection);
  try {
    const amountInBN = getAmountInLamports(amountIn, inputDecimals);
    const minAmountOutBN = getAmountInLamports(minAmountOut, outputDecimals);
    const poolState = await cpAmmInstance.fetchPoolState(poolAddress);

    const swapParams: Swap2Params = {
      payer,
      pool: poolAddress,
      inputTokenMint,
      outputTokenMint,
      tokenAMint: poolState.tokenAMint,
      tokenBMint: poolState.tokenBMint,
      tokenAVault: poolState.tokenAVault,
      tokenBVault: poolState.tokenBVault,
      tokenAProgram: getTokenProgram(poolState.tokenAFlag),
      tokenBProgram: getTokenProgram(poolState.tokenBFlag),
      referralTokenAccount: null,
      swapMode: SwapMode.ExactIn,
      amountIn: amountInBN,
      minimumAmountOut: minAmountOutBN,
    };
    const swapTx = await cpAmmInstance.swap2(swapParams);
    modifyComputeUnitPriceIx(swapTx, COMPUTE_UNIT_PRICE_MICRO_LAMPORTS ?? 0);
    return swapTx;
  } catch (error) {
    console.error('Error executing swap:', error);
    return null;
  }
}
