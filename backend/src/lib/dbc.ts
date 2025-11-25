import {
  buildCurve,
  buildCurveWithLiquidityWeights,
  buildCurveWithMarketCap,
  buildCurveWithTwoSegments,
  type ConfigParameters,
  DAMM_V1_MIGRATION_FEE_ADDRESS,
  DAMM_V2_MIGRATION_FEE_ADDRESS,
  deriveBaseKeyForLocker,
  deriveDammV1MigrationMetadataAddress,
  deriveDammV2MigrationMetadataAddress,
  deriveEscrow,
  DynamicBondingCurveClient,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import BN from 'bn.js';

import { modifyComputeUnitPriceIx } from '../helpers';
import { IPFSService } from '../services/ipfsService';
import type { DbcConfig } from '../types/dbc';

export async function createDbcConfig(
  config: DbcConfig,
  connection: Connection,
  payer: PublicKey,
  configKeypair: Keypair,
  quoteMint: PublicKey,
): Promise<VersionedTransaction | Transaction> {
  if (!config.dbcConfig) {
    throw new Error('Missing dbc configuration');
  }
  console.log('\n> Initializing DBC config...');

  let curveConfig: ConfigParameters | null = null;

  switch (config.dbcConfig.buildCurveMode) {
    case 0:
      curveConfig = buildCurve(config.dbcConfig);
      break;
    case 1:
      curveConfig = buildCurveWithMarketCap(config.dbcConfig);
      break;
    case 2:
      curveConfig = buildCurveWithTwoSegments(config.dbcConfig);
      break;
    case 3:
      curveConfig = buildCurveWithLiquidityWeights(config.dbcConfig);
      break;
    default:
      throw new Error(`Unsupported DBC build curve mode: ${config.dbcConfig}`);
  }

  if (!curveConfig) {
    throw new Error('Failed to build curve config');
  }

  const dbcInstance = new DynamicBondingCurveClient(connection, 'confirmed');

  const createConfigTx = await dbcInstance.partner.createConfig({
    config: configKeypair.publicKey,
    quoteMint,
    feeClaimer: new PublicKey(config.dbcConfig.feeClaimer),
    leftoverReceiver: new PublicKey(config.dbcConfig.leftoverReceiver),
    payer,
    ...curveConfig,
  });

  if (!createConfigTx) {
    throw new Error('Failed to create DBC config transaction');
  }

  modifyComputeUnitPriceIx(createConfigTx, config.computeUnitPriceMicroLamports);

  return createConfigTx;
}

/**
 * Create a DBC pool
 * @param config - The DBC config
 * @param connection - The connection to the network
 * @param payer - The wallet to use for the transaction
 * @param baseMint - The base mint
 */
export async function createDbcPool(
  config: DbcConfig,
  connection: Connection,
  payer: PublicKey,
  baseMint: Keypair,
  dbcConfigKey: Keypair,
): Promise<Transaction> {
  if (!config.dbcConfig) {
    throw new Error('Missing dbc configuration');
  }
  if (!config.dbcPool) {
    throw new Error('Missing dbc pool configuration');
  }

  if (!dbcConfigKey) {
    throw new Error('Missing dbc config key');
  }

  const dbcInstance = new DynamicBondingCurveClient(connection, 'confirmed');

  let metadataUri: string;
  if (config.dbcPool.metadata.uri) {
    console.log('Using existing metadata URI:', config.dbcPool.metadata.uri);
    metadataUri = config.dbcPool.metadata.uri;
  } else {
    console.log('Uploading metadata via IPFS Service...');
    if (!config.dbcPool.metadata.imageUri) {
      throw new Error('Image is required for DBC pool metadata');
    }

    const email = process.env.STORACHA_EMAIL;
    const privateKey = process.env.STORACHA_PRIVATE_KEY;
    const proof = process.env.STORACHA_PROOF;
    const spaceDid = process.env.STORACHA_SPACE_DID;

    if (!email) {
      throw new Error('STORACHA_EMAIL not found in environment variables');
    }

    const ipfsService = new IPFSService(email, privateKey, proof, spaceDid);

    metadataUri = await ipfsService.uploadTokenMetadata(
      config.dbcPool.name,
      config.dbcPool.symbol,
      config.dbcPool.metadata.imageUri,
      config.dbcPool.metadata.bannerUri || '',
      config.dbcPool.metadata.description || '',
      config.dbcPool.metadata.website || '',
      config.dbcPool.metadata.twitter || '',
      config.dbcPool.metadata.telegram || '',
    );
  }

  console.log(`>> Creating pool transaction...`);
  const createPoolTx = await dbcInstance.pool.createPool({
    baseMint: baseMint.publicKey,
    config: dbcConfigKey.publicKey,
    name: config.dbcPool.name,
    symbol: config.dbcPool.symbol,
    uri: metadataUri,
    payer,
    poolCreator: payer,
  });

  if (!createPoolTx) {
    throw new Error('Failed to create DBC pool transaction');
  }

  modifyComputeUnitPriceIx(createPoolTx, config.computeUnitPriceMicroLamports);

  console.log(`>> Sending create pool transaction...`);
  return createPoolTx;
}

/**
 * Claim trading fee from a DBC pool
 * @param config - The DBC config
 * @param connection - The connection to the network
 * @param payer - The wallet to use for the transaction
 * @param baseMint - The wallet to use for the transaction
 */
export async function claimTradingFee(
  config: DbcConfig,
  connection: Connection,
  payer: PublicKey,
  baseMint: PublicKey,
): Promise<Transaction[] | null> {
  console.log('\n> Initializing DBC claim trading fee...');

  const dbcInstance = new DynamicBondingCurveClient(connection, 'confirmed');

  const poolState = await dbcInstance.state.getPoolByBaseMint(baseMint);
  if (!poolState) {
    throw new Error(`DBC Pool not found for ${baseMint.toString()}`);
  }

  const dbcConfigAddress = poolState.account.config;
  const poolConfig = await dbcInstance.state.getPoolConfig(dbcConfigAddress);
  if (!poolConfig) {
    throw new Error(`DBC Pool config not found for ${dbcConfigAddress.toString()}`);
  }

  const poolAddress = poolState.publicKey;
  const creator = poolState.account.creator;
  const partner = poolConfig.feeClaimer;
  const feeMetrics = await dbcInstance.state.getPoolFeeMetrics(poolAddress);

  const isCreator = creator.toString() === payer.toString();
  console.log(`> Is creator: ${isCreator}`);
  const isPartner = partner.toString() === payer.toString();
  console.log(`> Is partner: ${isPartner}`);

  if (!isCreator && !isPartner) {
    console.log('> User is neither the creator nor the launchpad fee claimer');
    return null;
  }

  const transactions: Transaction[] = [];

  if (isCreator) {
    const claimCreatorTradingFeeTx = await dbcInstance.creator.claimCreatorTradingFee({
      creator: payer,
      pool: poolAddress,
      maxBaseAmount: feeMetrics.current.creatorBaseFee,
      maxQuoteAmount: feeMetrics.current.creatorQuoteFee,
      payer,
    });
    modifyComputeUnitPriceIx(claimCreatorTradingFeeTx, config.computeUnitPriceMicroLamports);
    transactions.push(claimCreatorTradingFeeTx);
  } else {
    console.log('> This is not the creator of the pool');
  }

  if (isPartner) {
    const claimPartnerTradingFeeTx = await dbcInstance.partner.claimPartnerTradingFee({
      feeClaimer: payer,
      pool: poolAddress,
      maxBaseAmount: feeMetrics.current.partnerBaseFee,
      maxQuoteAmount: feeMetrics.current.partnerQuoteFee,
      payer,
    });
    modifyComputeUnitPriceIx(claimPartnerTradingFeeTx, config.computeUnitPriceMicroLamports);
    transactions.push(claimPartnerTradingFeeTx);
  } else {
    console.log('> This is not the launchpad fee claimer');
  }

  if (transactions.length === 0) {
    console.log('> No trading fees to claim');
    return null;
  }

  return transactions;
}

/**
 * Migrate DBC pool to DAMM V1 pool
 * @param config - The DBC config
 * @param connection - The connection to the network
 * @param payer - The wallet to use for the transaction
 * @param baseMint - The wallet to use for the transaction
 */
export async function migrateDammV1(
  config: DbcConfig,
  connection: Connection,
  payer: PublicKey,
  baseMint: PublicKey,
): Promise<Transaction[] | null> {
  console.log('\n> Initializing migration from DBC to DAMM v1...');

  const dbcInstance = new DynamicBondingCurveClient(connection, 'confirmed');

  const poolState = await dbcInstance.state.getPoolByBaseMint(baseMint);
  if (!poolState) {
    throw new Error(`DBC Pool not found for ${baseMint.toString()}`);
  }

  const dbcConfigAddress = poolState.account.config;
  const poolConfig = await dbcInstance.state.getPoolConfig(dbcConfigAddress);
  if (!poolConfig) {
    throw new Error(`DBC Pool config not found for ${dbcConfigAddress.toString()}`);
  }

  console.log('> Pool Quote Reserve:', poolState.account.quoteReserve.toString());
  console.log('> Pool Migration Quote Threshold:', poolConfig.migrationQuoteThreshold.toString());

  if (poolState.account.quoteReserve.lt(poolConfig.migrationQuoteThreshold)) {
    throw new Error(
      'Unable to migrate DBC to DAMM V1: Pool quote reserve is less than migration quote threshold',
    );
  }

  const migrationFeeOption = poolConfig.migrationFeeOption;
  const dammConfigAddress = DAMM_V1_MIGRATION_FEE_ADDRESS[migrationFeeOption];
  if (!dammConfigAddress) {
    throw new Error(`No DAMM config address found for migration fee option: ${migrationFeeOption}`);
  }

  const poolAddress = poolState.publicKey;

  const finalTransactions: Transaction[] = [];

  // check if migration metadata exists
  console.log('> Checking if migration metadata exists...');
  const migrationMetadata = deriveDammV1MigrationMetadataAddress(poolAddress);
  console.log('> Migration metadata address:', migrationMetadata.toString());

  const metadataAccount = await connection.getAccountInfo(migrationMetadata);
  if (!metadataAccount) {
    console.log('Creating migration metadata...');
    const createMetadataTx = await dbcInstance.migration.createDammV1MigrationMetadata({
      payer,
      virtualPool: poolAddress,
      config: dbcConfigAddress,
    });
    modifyComputeUnitPriceIx(createMetadataTx, config.computeUnitPriceMicroLamports);
    finalTransactions.push(createMetadataTx);
  } else {
    console.log('Migration metadata already exists');
  }

  // check if locked vesting exists
  if (poolConfig.lockedVestingConfig.amountPerPeriod.gt(new BN(0))) {
    // check if locker already exists
    const base = deriveBaseKeyForLocker(poolAddress);
    const escrow = deriveEscrow(base);
    const escrowAccount = await connection.getAccountInfo(escrow);

    if (!escrowAccount) {
      console.log('> Locker not found, creating locker...');
      const createLockerTx = await dbcInstance.migration.createLocker({
        virtualPool: poolAddress,
        payer,
      });
      modifyComputeUnitPriceIx(createLockerTx, config.computeUnitPriceMicroLamports);
      finalTransactions.push(createLockerTx);
    } else {
      console.log('> Locker already exists, skipping creation');
    }
  } else {
    console.log('> No locked vesting found, skipping locker creation');
  }

  // migrate to DAMM V1
  console.log('Migrating to DAMM V1...');
  if (poolState.account.isMigrated === 0) {
    const migrateTx = await dbcInstance.migration.migrateToDammV1({
      payer,
      virtualPool: poolAddress,
      dammConfig: dammConfigAddress,
    });
    finalTransactions.push(migrateTx);
  } else {
    console.log('> Pool already migrated to DAMM V1');
  }

  // fetch the migration metadata after it has been created
  let dammv1MigrationMetadata;
  try {
    dammv1MigrationMetadata = await dbcInstance.state.getDammV1MigrationMetadata(poolAddress);
  } catch (error) {
    throw new Error(`DAMM v1 migration metadata not found for ${poolAddress.toString()}: ${error}`);
  }

  // check if creator and partner are the same address
  const creator = poolState.account.creator;
  const partner = poolConfig.feeClaimer;
  const isCreatorSameAsPartner = creator.toString() === partner.toString();

  if (isCreatorSameAsPartner) {
    console.log(
      '> Creator and partner are the same address, will handle LP locking carefully to avoid conflicts',
    );
  }

  if (!dammv1MigrationMetadata) {
    throw new Error(`DAMM v1 migration metadata not found for ${poolAddress.toString()}`);
  }

  if (poolState.account.isMigrated === 0) {
    console.log('> Pool not actually migrated in dry-run mode, skipping LP operations');
    return null;
  }

  // if creator and partner are the same, combine the amounts and do a single claim
  if (isCreatorSameAsPartner) {
    const totalClaimableLp = dammv1MigrationMetadata.creatorLp.add(
      dammv1MigrationMetadata.partnerLp,
    );
    const hasClaimableLp = totalClaimableLp.gt(new BN(0));
    const bothNotClaimed =
      dammv1MigrationMetadata.creatorClaimStatus === 0 &&
      dammv1MigrationMetadata.partnerClaimStatus === 0;

    if (hasClaimableLp && bothNotClaimed) {
      console.log('> Claiming combined Creator+Partner DAMM V1 LP tokens...');
      const claimCreatorLpTx = await dbcInstance.migration.claimDammV1LpToken({
        payer,
        virtualPool: poolAddress,
        dammConfig: dammConfigAddress,
        isPartner: false, // Use creator (false) for the combined claim
      });
      modifyComputeUnitPriceIx(claimCreatorLpTx, config.computeUnitPriceMicroLamports);
      finalTransactions.push(claimCreatorLpTx);
    } else if (!hasClaimableLp) {
      console.log('> There are no LP tokens to claim for creator+partner');
    } else {
      console.log('> LP tokens already claimed for creator+partner');
    }
  } else {
    if (
      dammv1MigrationMetadata.creatorClaimStatus === 0 &&
      dammv1MigrationMetadata.creatorLp.gt(new BN(0))
    ) {
      console.log('> Claiming Creator DAMM V1 LP tokens...');
      const claimCreatorLpTx = await dbcInstance.migration.claimDammV1LpToken({
        payer,
        virtualPool: poolAddress,
        dammConfig: dammConfigAddress,
        isPartner: false,
      });
      modifyComputeUnitPriceIx(claimCreatorLpTx, config.computeUnitPriceMicroLamports);
      finalTransactions.push(claimCreatorLpTx);
    } else {
      console.log('> There is no creator LP tokens to claim');
    }

    if (
      dammv1MigrationMetadata.partnerClaimStatus === 0 &&
      dammv1MigrationMetadata.partnerLp.gt(new BN(0))
    ) {
      console.log('> Claiming Partner DAMM V1 LP tokens...');
      const claimPartnerLpTx = await dbcInstance.migration.claimDammV1LpToken({
        payer,
        virtualPool: poolAddress,
        dammConfig: dammConfigAddress,
        isPartner: true,
      });
      modifyComputeUnitPriceIx(claimPartnerLpTx, config.computeUnitPriceMicroLamports);
      finalTransactions.push(claimPartnerLpTx);
    } else {
      console.log('> There is no partner LP tokens to claim');
    }
  }

  // if creator and partner are the same, combine the amounts and do a single lock
  if (isCreatorSameAsPartner) {
    const totalLockedLp = dammv1MigrationMetadata.creatorLockedLp.add(
      dammv1MigrationMetadata.partnerLockedLp,
    );
    const hasLockedLp = totalLockedLp.gt(new BN(0));
    const bothNotLocked =
      dammv1MigrationMetadata.creatorLockedStatus === 0 &&
      dammv1MigrationMetadata.partnerLockedStatus === 0;

    if (hasLockedLp && bothNotLocked) {
      console.log('> Locking combined Creator+Partner DAMM V1 LP tokens...');
      const lockCreatorLpTx = await dbcInstance.migration.lockDammV1LpToken({
        payer,
        virtualPool: poolAddress,
        dammConfig: dammConfigAddress,
        isPartner: false, // Use creator (false) for the combined lock
      });
      modifyComputeUnitPriceIx(lockCreatorLpTx, config.computeUnitPriceMicroLamports);
      finalTransactions.push(lockCreatorLpTx);
    } else if (!hasLockedLp) {
      console.log('> There are no LP tokens to lock for creator+partner');
    } else {
      console.log('> LP tokens already locked for creator+partner');
    }
  } else {
    if (
      dammv1MigrationMetadata.creatorLockedStatus === 0 &&
      dammv1MigrationMetadata.creatorLockedLp.gt(new BN(0))
    ) {
      console.log('> Locking Creator DAMM V1 LP tokens...');
      const lockCreatorLpTx = await dbcInstance.migration.lockDammV1LpToken({
        payer,
        virtualPool: poolAddress,
        dammConfig: dammConfigAddress,
        isPartner: false,
      });
      modifyComputeUnitPriceIx(lockCreatorLpTx, config.computeUnitPriceMicroLamports);
      finalTransactions.push(lockCreatorLpTx);
    } else {
      console.log('> There is no creator LP tokens to lock');
    }

    if (
      dammv1MigrationMetadata.partnerLockedStatus === 0 &&
      dammv1MigrationMetadata.partnerLockedLp.gt(new BN(0))
    ) {
      console.log('> Locking Partner DAMM V1 LP tokens...');
      const lockPartnerLpTx = await dbcInstance.migration.lockDammV1LpToken({
        payer,
        virtualPool: poolAddress,
        dammConfig: dammConfigAddress,
        isPartner: true,
      });

      modifyComputeUnitPriceIx(lockPartnerLpTx, config.computeUnitPriceMicroLamports);
      finalTransactions.push(lockPartnerLpTx);
    } else {
      console.log('> There is no partner LP tokens to lock');
    }
  }

  // execute LP claim/lock transactions if any
  if (finalTransactions.length === 0) {
    console.log('> No LP claim/lock transactions to execute');
    return null;
  }

  return finalTransactions;
}

/**
 * Migrate DBC pool to DAMM V2 pool
 * @param config - The DBC config
 * @param connection - The connection to the network
 * @param payer - The wallet to use for the transaction
 * @param baseMint -
 */
export async function migrateDammV2(
  config: DbcConfig,
  connection: Connection,
  payer: PublicKey,
  baseMint: PublicKey,
): Promise<Transaction[]> {
  console.log('\n> Initializing migration from DBC to DAMM v2...');

  const dbcInstance = new DynamicBondingCurveClient(connection, 'confirmed');

  const poolState = await dbcInstance.state.getPoolByBaseMint(baseMint);
  if (!poolState) {
    throw new Error(`DBC Pool not found for ${baseMint.toString()}`);
  }

  const dbcConfigAddress = poolState.account.config;
  const poolConfig = await dbcInstance.state.getPoolConfig(dbcConfigAddress);
  if (!poolConfig) {
    throw new Error(`DBC Pool config not found for ${dbcConfigAddress.toString()}`);
  }

  console.log('> Pool Quote Reserve:', poolState.account.quoteReserve.toString());
  console.log('> Pool Migration Quote Threshold:', poolConfig.migrationQuoteThreshold.toString());

  if (poolState.account.quoteReserve.lt(poolConfig.migrationQuoteThreshold)) {
    throw new Error(
      'Unable to migrate DBC to DAMM V2: Pool quote reserve is less than migration quote threshold',
    );
  }

  const finalTransactions: Transaction[] = [];

  const migrationFeeOption = poolConfig.migrationFeeOption;
  const dammConfigAddress = DAMM_V2_MIGRATION_FEE_ADDRESS[migrationFeeOption];

  // TODO CHECK IF THIS IS NEEDED
  // if (config.rpcUrl === LOCALNET_RPC_URL) {
  //   const poolAuthority = deriveDbcPoolAuthority();
  //   dammConfigAddress = await createDammV2Config(
  //     connection,
  //     wallet.payer as Keypair,
  //     poolAuthority,
  //     migrationFeeOption
  //   );
  // }

  if (!dammConfigAddress) {
    throw new Error(
      `No DAMM V2 config address found for migration fee option: ${migrationFeeOption}`,
    );
  }

  const poolAddress = poolState.publicKey;

  // check if migration metadata exists
  console.log('> Checking if migration metadata exists...');
  const migrationMetadata = deriveDammV2MigrationMetadataAddress(poolAddress);
  console.log('> Migration metadata address:', migrationMetadata.toString());

  const metadataAccount = await connection.getAccountInfo(migrationMetadata);
  if (!metadataAccount) {
    console.log('Creating migration metadata...');
    const createMetadataTx = await dbcInstance.migration.createDammV1MigrationMetadata({
      payer,
      virtualPool: poolAddress,
      config: dbcConfigAddress,
    });
    modifyComputeUnitPriceIx(createMetadataTx, config.computeUnitPriceMicroLamports);
    finalTransactions.push(createMetadataTx);
  } else {
    console.log('Migration metadata already exists');
  }

  // check if locked vesting exists
  if (poolConfig.lockedVestingConfig.amountPerPeriod.gt(new BN(0))) {
    // check if locker already exists
    const base = deriveBaseKeyForLocker(poolAddress);
    const escrow = deriveEscrow(base);
    const escrowAccount = await connection.getAccountInfo(escrow);

    if (!escrowAccount) {
      console.log('> Locker not found, creating locker...');
      const createLockerTx = await dbcInstance.migration.createLocker({
        virtualPool: poolAddress,
        payer,
      });
      modifyComputeUnitPriceIx(createLockerTx, config.computeUnitPriceMicroLamports);
      finalTransactions.push(createLockerTx);
    } else {
      console.log('> Locker already exists, skipping creation');
    }
  } else {
    console.log('> No locked vesting found, skipping locker creation');
  }

  // migrate to DAMM V2
  console.log('Migrating to DAMM V2...');
  if (poolState.account.isMigrated === 0) {
    const { transaction: migrateTx } = await dbcInstance.migration.migrateToDammV2({
      payer,
      virtualPool: poolAddress,
      dammConfig: dammConfigAddress,
    });

    modifyComputeUnitPriceIx(migrateTx, config.computeUnitPriceMicroLamports);
    finalTransactions.push(migrateTx);
  } else {
    console.log('> Pool already migrated to DAMM V2');
  }
  return finalTransactions;
}
