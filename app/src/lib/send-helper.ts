/**
 * LayerZero Send Helper - Browser Compatible
 *
 * This implementation matches the LayerZero SDK's getSendAccounts() exactly
 * but doesn't use the SDK to remain browser-compatible.
 *
 * Account structure based on Kinobi-generated serializers from SDK v2.
 */

import { PublicKey, Connection, SystemProgram } from '@solana/web3.js';
import { addressToBytes32 } from '@layerzerolabs/lz-v2-utilities';

// ============================================================================
// TYPES
// ============================================================================

export interface AccountMeta {
  pubkey: PublicKey;
  isSigner: boolean;
  isWritable: boolean;
}

export interface SendAccountsParams {
  payer: PublicKey;
  sender: PublicKey;
  dstEid: number;
  receiver: string | Uint8Array;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const ENDPOINT_PROGRAM_ID = new PublicKey('76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6');
export const ULN_PROGRAM_ID = new PublicKey('7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH');
export const SIMPLE_MESSAGELIB_PROGRAM_ID = new PublicKey(
  '7Nv6sbKf4kxAxnbcVfKvKvbFGXQqHDhkVvNZHcpvhvvP',
);
export const DEFAULT_MESSAGE_LIB = new PublicKey('11111111111111111111111111111111');

// ============================================================================
// PDA DERIVATION
// ============================================================================

function deriveSendLibraryConfig(sender: PublicKey, dstEid: number): [PublicKey, number] {
  const eidBuffer = Buffer.alloc(4);
  eidBuffer.writeUInt32BE(dstEid, 0);

  return PublicKey.findProgramAddressSync(
    [Buffer.from('SendLibraryConfig'), sender.toBuffer(), eidBuffer],
    ENDPOINT_PROGRAM_ID,
  );
}

function deriveDefaultSendLibraryConfig(dstEid: number): [PublicKey, number] {
  const eidBuffer = Buffer.alloc(4);
  eidBuffer.writeUInt32BE(dstEid, 0);

  return PublicKey.findProgramAddressSync(
    [Buffer.from('SendLibraryConfig'), eidBuffer],
    ENDPOINT_PROGRAM_ID,
  );
}

function deriveMessageLibraryInfo(messageLib: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('MessageLib'), messageLib.toBuffer()],
    ENDPOINT_PROGRAM_ID,
  );
}

function deriveNonce(sender: PublicKey, dstEid: number, receiver: Uint8Array): [PublicKey, number] {
  const eidBuffer = Buffer.alloc(4);
  eidBuffer.writeUInt32BE(dstEid, 0);

  return PublicKey.findProgramAddressSync(
    [Buffer.from('Nonce'), sender.toBuffer(), eidBuffer, Buffer.from(receiver)],
    ENDPOINT_PROGRAM_ID,
  );
}

function deriveEndpointSettings(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('Endpoint')], ENDPOINT_PROGRAM_ID);
}

function deriveEventAuthority(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('__event_authority')], programId);
}

function deriveUlnSettings(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('MessageLib')], ULN_PROGRAM_ID);
}

function deriveUlnSendConfig(dstEid: number, sender: PublicKey): [PublicKey, number] {
  const eidBuffer = Buffer.alloc(4);
  eidBuffer.writeUInt32BE(dstEid, 0);

  return PublicKey.findProgramAddressSync(
    [Buffer.from('SendConfig'), eidBuffer, sender.toBuffer()],
    ULN_PROGRAM_ID,
  );
}

function deriveUlnDefaultSendConfig(dstEid: number): [PublicKey, number] {
  const eidBuffer = Buffer.alloc(4);
  eidBuffer.writeUInt32BE(dstEid, 0);

  return PublicKey.findProgramAddressSync([Buffer.from('SendConfig'), eidBuffer], ULN_PROGRAM_ID);
}

function deriveSimpleMessageLib(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('MessageLib')],
    SIMPLE_MESSAGELIB_PROGRAM_ID,
  );
}

function deriveUlnMessageLib(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('MessageLib')], ULN_PROGRAM_ID);
}

// ============================================================================
// ACCOUNT DESERIALIZATION
// ============================================================================

/**
 * Deserialize SendLibraryConfig account
 * Structure: discriminator (8) + messageLib (32)
 */
function deserializeSendLibraryConfig(data: Buffer): PublicKey {
  // Skip discriminator (8 bytes), read messageLib (32 bytes)
  return new PublicKey(data.slice(8, 40));
}

/**
 * Deserialize SendConfig account
 * Structure: discriminator (8) + bump (1) + UlnConfig + ExecutorConfig
 *
 * UlnConfig: confirmations (8) + requiredDvnCount (1) + optionalDvnCount (1) +
 *            optionalDvnThreshold (1) + requiredDvns (array) + optionalDvns (array)
 * ExecutorConfig: maxMessageSize (4) + executor (32)
 */
function deserializeSendConfig(data: Buffer): {
  executor: PublicKey;
  requiredDvns: PublicKey[];
  optionalDvns: PublicKey[];
} {
  let offset = 8; // Skip discriminator
  offset += 1; // Skip bump

  // UlnConfig
  offset += 8; // Skip confirmations (u64)
  const requiredDvnCount = data.readUInt8(offset);
  offset += 1;
  const optionalDvnCount = data.readUInt8(offset);
  offset += 1;
  offset += 1; // Skip optionalDvnThreshold

  // Read required DVNs array length (u32 LE) then pubkeys
  const requiredDvnsLength = data.readUInt32LE(offset);
  offset += 4;
  const requiredDvns: PublicKey[] = [];
  for (let i = 0; i < requiredDvnsLength; i++) {
    requiredDvns.push(new PublicKey(data.slice(offset, offset + 32)));
    offset += 32;
  }

  // Read optional DVNs array length (u32 LE) then pubkeys
  const optionalDvnsLength = data.readUInt32LE(offset);
  offset += 4;
  const optionalDvns: PublicKey[] = [];
  for (let i = 0; i < optionalDvnsLength; i++) {
    optionalDvns.push(new PublicKey(data.slice(offset, offset + 32)));
    offset += 32;
  }

  // ExecutorConfig
  offset += 4; // Skip maxMessageSize (u32)
  const executor = new PublicKey(data.slice(offset, offset + 32));

  return { executor, requiredDvns, optionalDvns };
}

/**
 * Deserialize ExecutorConfig account
 * Structure based on generated/kinobi/executor/accounts/executorConfig.ts:
 * - discriminator (8)
 * - bump (1)
 * - owner (32)
 * - acl: allowList (array), denyList (array)
 * - admins (array)
 * - executors (array)
 * - msglibs (array)
 * - paused (1)
 * - defaultMultiplierBps (2)
 * - priceFeed (32)
 */
function deserializeExecutorConfig(data: Buffer): { priceFeed: PublicKey } {
  let offset = 8; // discriminator
  offset += 1; // bump
  offset += 32; // owner

  // ACL
  const allowListLen = data.readUInt32LE(offset);
  offset += 4 + allowListLen * 32;
  const denyListLen = data.readUInt32LE(offset);
  offset += 4 + denyListLen * 32;

  // Admins
  const adminsLen = data.readUInt32LE(offset);
  offset += 4 + adminsLen * 32;

  // Executors
  const executorsLen = data.readUInt32LE(offset);
  offset += 4 + executorsLen * 32;

  // Msglibs
  const msglibsLen = data.readUInt32LE(offset);
  offset += 4 + msglibsLen * 32;

  offset += 1; // paused
  offset += 2; // defaultMultiplierBps

  const priceFeed = new PublicKey(data.slice(offset, offset + 32));
  return { priceFeed };
}

/**
 * Deserialize DVN Config account
 * Structure: discriminator (8) + priceFeed (32) + ...
 */
/**
 * Deserialize DVN Config account
 * Structure based on generated/kinobi/dvn/accounts/dvnConfig.ts:
 * - discriminator (8)
 * - vid (4)
 * - bump (1)
 * - multisig: signers (array of 64 bytes), quorum (1)
 * - acl: allowList (array PubKey), denyList (array PubKey)
 * - paused (1)
 * - msglibs (array PubKey)
 * - admins (array PubKey)
 * - priceFeed (32)
 */
function deserializeDvnConfig(data: Buffer): { priceFeed: PublicKey } {
  let offset = 8; // discriminator
  offset += 4; // vid
  offset += 1; // bump

  // Multisig
  // Structure: signers (array of 64 bytes), quorum (u8)
  const signersLen = data.readUInt32LE(offset);
  offset += 4 + signersLen * 64; // Signers are 64 bytes each (likely secp256k1)
  offset += 1; // quorum

  // ACL
  const allowListLen = data.readUInt32LE(offset);
  offset += 4 + allowListLen * 32;
  const denyListLen = data.readUInt32LE(offset);
  offset += 4 + denyListLen * 32;

  offset += 1; // paused

  // Msglibs
  const msglibsLen = data.readUInt32LE(offset);
  offset += 4 + msglibsLen * 32;

  // Admins
  const adminsLen = data.readUInt32LE(offset);
  offset += 4 + adminsLen * 32;

  const priceFeed = new PublicKey(data.slice(offset, offset + 32));
  return { priceFeed };
}

// ============================================================================
// EXECUTOR AND DVN ACCOUNT HELPERS
// ============================================================================

const EXECUTOR_PROGRAM_ID = new PublicKey('6doghB248px58JSSwG4qejQ46kFMW4AMj7vzJnWZHNZn');
const DVN_PROGRAM_ID = new PublicKey('HtEYV4xB4wvsj5fgTkcfuChYpvGYzgzwvNhgDZQNh7wW');
const PRICE_FEED_PROGRAM_ID = new PublicKey('8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP');

function deriveExecutorConfig(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('ExecutorConfig')], EXECUTOR_PROGRAM_ID);
}

function deriveDvnConfig(dvnProgramId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('DvnConfig')], dvnProgramId);
}

function derivePriceFeed(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('PriceFeed')], PRICE_FEED_PROGRAM_ID);
}

/**
 * Get executor accounts for CPI (Cross-Program Invocation)
 * Matches the SDK's getQuoteIXAccountMetaForCPI method
 */
function getExecutorAccounts(
  priceFeedConfig: PublicKey,
  priceFeedProgram: PublicKey,
  payment: boolean,
): AccountMeta[] {
  const [executorConfig] = deriveExecutorConfig();

  /*
   * Executor accounts structure for ULN Send:
   * 1. Executor Program ID (Checked by ULN, used for CPI)
   * 2. Executor Config (Account 0 of Quote instruction)
   * 3. Price Feed Program (Account 1 of Quote instruction)
   * 4. Price Feed Config (Account 2 of Quote instruction)
   */
  const accounts: AccountMeta[] = [
    { pubkey: EXECUTOR_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: executorConfig, isSigner: false, isWritable: payment },
    { pubkey: priceFeedProgram, isSigner: false, isWritable: false },
    { pubkey: priceFeedConfig, isSigner: false, isWritable: false },
  ];

  return accounts;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Gets the required accounts for a LayerZero send operation.
 * This matches the SDK's getSendAccounts() exactly.
 */
export async function getSendAccounts(
  connection: Connection,
  params: SendAccountsParams,
): Promise<AccountMeta[]> {
  const { payer, sender, dstEid, receiver } = params;

  const receiverBytes = typeof receiver === 'string' ? addressToBytes32(receiver) : receiver;

  // Derive PDAs
  const [sendLibConfig] = deriveSendLibraryConfig(sender, dstEid);
  const [defaultSendLibConfig] = deriveDefaultSendLibraryConfig(dstEid);
  const [simpleMsgLib] = deriveSimpleMessageLib();
  const [uln] = deriveUlnMessageLib();
  const [ulnDefaultSendConfig] = deriveUlnDefaultSendConfig(dstEid);
  const [ulnSendConfig] = deriveUlnSendConfig(dstEid, sender);

  // Fetch accounts
  console.log('🔍 Fetching LayerZero accounts...');
  console.log('  sendLibConfig:', sendLibConfig.toBase58());
  console.log('  defaultSendLibConfig:', defaultSendLibConfig.toBase58());
  console.log('  dstEid:', dstEid);

  const [
    sendLibConfigBuf,
    defaultSendLibConfigBuf,
    simpleMsgLibBuf,
    ulnBuf,
    ulnDefaultSendConfigBuf,
    ulnSendConfigBuf,
  ] = await connection.getMultipleAccountsInfo([
    sendLibConfig,
    defaultSendLibConfig,
    simpleMsgLib,
    uln,
    ulnDefaultSendConfig,
    ulnSendConfig,
  ]);

  console.log('📊 Account fetch results:');
  console.log('  sendLibConfigBuf:', sendLibConfigBuf ? '✅ exists' : '❌ null');
  console.log('  defaultSendLibConfigBuf:', defaultSendLibConfigBuf ? '✅ exists' : '❌ null');
  console.log('  simpleMsgLibBuf:', simpleMsgLibBuf ? '✅ exists' : '❌ null');
  console.log('  ulnBuf:', ulnBuf ? '✅ exists' : '❌ null');
  console.log('  ulnDefaultSendConfigBuf:', ulnDefaultSendConfigBuf ? '✅ exists' : '❌ null');
  console.log('  ulnSendConfigBuf:', ulnSendConfigBuf ? '✅ exists' : '❌ null');

  if (!sendLibConfigBuf) {
    throw new Error(`Send library config not initialized: ${sendLibConfig.toBase58()}`);
  }

  if (!defaultSendLibConfigBuf) {
    throw new Error(
      `Default send library config not initialized: ${defaultSendLibConfig.toBase58()}`,
    );
  }

  // Deserialize configs
  const sendLibConfigInfo = deserializeSendLibraryConfig(sendLibConfigBuf.data);
  const defaultSendLibConfigInfo = deserializeSendLibraryConfig(defaultSendLibConfigBuf.data);

  // Determine message library
  const msgLib = sendLibConfigInfo.equals(DEFAULT_MESSAGE_LIB)
    ? defaultSendLibConfigInfo
    : sendLibConfigInfo;

  // Determine message library program ID
  const msgLibProgram = msgLib.equals(simpleMsgLib) ? SIMPLE_MESSAGELIB_PROGRAM_ID : ULN_PROGRAM_ID;

  // Derive MessageLib Info PDA
  // IMPORTANT: SDK uses msgLib (the account PDA) to derive messageLibraryInfo, NOT the program ID!
  // See: @layerzerolabs/lz-solana-sdk-v2/src/send-helper.ts: getEndpointAccounts() -> this.endpoint.pda.messageLibraryInfo(msgLib)
  const [msgLibInfo] = deriveMessageLibraryInfo(msgLib);
  const [nonce] = deriveNonce(sender, dstEid, receiverBytes);
  const [endpointSettings] = deriveEndpointSettings();
  const [eventAuthority] = deriveEventAuthority(ENDPOINT_PROGRAM_ID);

  // Build Endpoint accounts
  // Note: Account order matches generated/kinobi/endpoint/instructions/send.ts
  // Plus we prepend the Endpoint Program ID at index 0 as strict SDK behavior
  const endpointAccounts: AccountMeta[] = [
    { pubkey: ENDPOINT_PROGRAM_ID, isSigner: false, isWritable: false }, // index 0: Endpoint Program ID (SDK adds this manually)
    { pubkey: sender, isSigner: false, isWritable: false }, // index 1: sender (Signer in instruction, but handled via CPI/seeds)
    { pubkey: msgLibProgram, isSigner: false, isWritable: false }, // index 2: sendLibraryProgram
    { pubkey: sendLibConfig, isSigner: false, isWritable: false }, // index 3: sendLibraryConfig
    { pubkey: defaultSendLibConfig, isSigner: false, isWritable: false }, // index 4: defaultSendLibraryConfig
    { pubkey: msgLibInfo, isSigner: false, isWritable: false }, // index 5: sendLibraryInfo (MessageLibInfo)
    { pubkey: endpointSettings, isSigner: false, isWritable: false }, // index 6: endpoint (Settings)
    { pubkey: nonce, isSigner: false, isWritable: true }, // index 7: nonce
    { pubkey: eventAuthority, isSigner: false, isWritable: false }, // index 8: eventAuthority
    { pubkey: ENDPOINT_PROGRAM_ID, isSigner: false, isWritable: false }, // index 9: program
  ];

  // Check if using SimpleMessageLib
  if (msgLib.equals(simpleMsgLib)) {
    return [
      ...endpointAccounts,
      { pubkey: simpleMsgLib, isSigner: false, isWritable: false },
      { pubkey: payer, isSigner: false, isWritable: true },
    ];
  }

  // Using ULN - need to add ULN accounts
  if (!ulnBuf || !ulnDefaultSendConfigBuf) {
    throw new Error('ULN send library not initialized');
  }

  const defaultSendConfigState = deserializeSendConfig(ulnDefaultSendConfigBuf.data);
  const sendConfigState = ulnSendConfigBuf ? deserializeSendConfig(ulnSendConfigBuf.data) : null;

  // Merge configs
  let executor = defaultSendConfigState.executor;
  let requiredDvns = defaultSendConfigState.requiredDvns;
  let optionalDvns = defaultSendConfigState.optionalDvns;

  if (sendConfigState) {
    if (!sendConfigState.executor.equals(DEFAULT_MESSAGE_LIB)) {
      executor = sendConfigState.executor;
    }
    if (sendConfigState.requiredDvns.length > 0) {
      requiredDvns = sendConfigState.requiredDvns.filter((dvn) => !dvn.equals(DEFAULT_MESSAGE_LIB));
    }
    if (sendConfigState.optionalDvns.length > 0) {
      optionalDvns = sendConfigState.optionalDvns.filter((dvn) => !dvn.equals(DEFAULT_MESSAGE_LIB));
    }
  }

  // Build ULN base accounts
  const [ulnSettings] = deriveUlnSettings();
  const [ulnEventAuthority] = deriveEventAuthority(ULN_PROGRAM_ID);

  console.log('🔍 ULN account addresses:');
  console.log('  uln:', uln.toBase58());
  console.log('  ulnSettings:', ulnSettings.toBase58());
  console.log('  ulnSendConfig:', ulnSendConfig.toBase58());
  console.log('  ulnDefaultSendConfig:', ulnDefaultSendConfig.toBase58());
  console.log('  payer:', payer.toBase58());
  console.log('  ulnEventAuthority:', ulnEventAuthority.toBase58());

  // Note: ULN_PROGRAM_ID is already included in endpoint accounts, so we don't add it here
  // Note: 'uln' and 'ulnSettings' are the same account (both use 'MessageLib' seed), so we only include ulnSettings
  // Account order matches generated/kinobi/uln/instructions/send.ts
  // (SDK removes index 0 endpoint, so we start with ulnSettings)
  const ulnAccounts: AccountMeta[] = [
    { pubkey: ulnSettings, isSigner: false, isWritable: false }, // index 1: uln (MessageLib)
    { pubkey: ulnSendConfig, isSigner: false, isWritable: false }, // index 2: sendConfig
    { pubkey: ulnDefaultSendConfig, isSigner: false, isWritable: false }, // index 3: defaultSendConfig
    { pubkey: payer, isSigner: false, isWritable: true }, // index 4: payer
    { pubkey: ULN_PROGRAM_ID, isSigner: false, isWritable: false }, // index 5: treasury (optional, defaults to programId if missing)
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // index 6: systemProgram
    { pubkey: ulnEventAuthority, isSigner: false, isWritable: false }, // index 7: eventAuthority
    { pubkey: ULN_PROGRAM_ID, isSigner: false, isWritable: false }, // index 8: program
  ];

  // Fetch executor and DVN configs to get price feed information
  console.log('🔍 Fetching executor and DVN configs...');
  console.log('  executor:', executor.toBase58());
  console.log(
    '  requiredDvns:',
    requiredDvns.map((d) => d.toBase58()),
  );
  console.log(
    '  optionalDvns:',
    optionalDvns.map((d) => d.toBase58()),
  );

  const dvnsKey = requiredDvns.concat(optionalDvns);
  const [executorBuf, ...dvnBufs] = await connection.getMultipleAccountsInfo([
    executor,
    ...dvnsKey,
  ]);

  if (!executorBuf) {
    throw new Error(`Executor not initialized: ${executor.toBase58()}`);
  }

  // Deserialize executor config to get price feed
  const executorConfig = deserializeExecutorConfig(executorBuf.data);
  console.log('  executorPriceFeed:', executorConfig.priceFeed.toBase58());

  // Deserialize DVN configs to get price feeds
  const dvnConfigs = dvnBufs.map((buf, i) => {
    if (!buf) {
      throw new Error(`DVN not initialized: ${dvnsKey[i].toBase58()}`);
    }
    return deserializeDvnConfig(buf.data);
  });

  // Fetch price feed accounts to get their owners (program IDs)
  // Note: Price feed accounts may not exist on devnet/testnet
  const priceFeeds = [executorConfig.priceFeed, ...dvnConfigs.map((d) => d.priceFeed)];
  const priceFeedBufs = await connection.getMultipleAccountsInfo(priceFeeds);

  console.log('✅ Executor and DVN configs fetched successfully');

  // Build executor accounts (payment = true for send operation)
  // Use the price feed program owner if available, otherwise use SystemProgram (owner of uninitialized accounts)
  const executorPriceFeedBuf = priceFeedBufs[0];
  const executorPriceFeedProgram = executorPriceFeedBuf
    ? executorPriceFeedBuf.owner
    : SystemProgram.programId;

  if (!executorPriceFeedBuf) {
    console.warn(
      `⚠️  Executor price feed not found: ${executorConfig.priceFeed.toBase58()}, using SystemProgram`,
    );
  }

  const executorAccounts = getExecutorAccounts(
    executorConfig.priceFeed,
    executorPriceFeedProgram,
    true,
  );

  // Build DVN accounts for all DVNs
  // IMPORTANT: The 'requiredDvns' in SendConfig are CONFIG ADDRESSES, not Program IDs!
  // We must fetch these accounts. The OWNER of these accounts is the DVN PROGRAM ID.
  const dvnAccounts: AccountMeta[] = [];

  // Note: We already have 'dvnBufs' available? No, we need to fetch them.
  // In previous block we fetched priceFeeds, but we didn't save the DVN Config AccountInfos.
  // We need to fetch DVN Config AccountInfos again (or refactor to fetch earlier).
  // Let's fetch them now to be safe and explicit.
  const dvnConfigInfos = await connection.getMultipleAccountsInfo(dvnsKey);

  dvnConfigs.forEach((config, i) => {
    // 1. Get DVN Config Info
    const dvnConfigBuf = dvnConfigInfos[i];
    if (!dvnConfigBuf) {
      throw new Error(`DVN config account not found: ${dvnsKey[i].toBase58()}`);
    }

    // 2. Extract DVN Program ID from OWNER
    const dvnProgramId = dvnConfigBuf.owner;

    // 3. Get Price Feed Program ID
    const dvnPriceFeedBuf = priceFeedBufs[i + 1]; // +1 because executor is at index 0
    const dvnPriceFeedProgram = dvnPriceFeedBuf ? dvnPriceFeedBuf.owner : SystemProgram.programId;

    if (!dvnPriceFeedBuf) {
      console.warn(
        `⚠️  DVN price feed not found: ${config.priceFeed.toBase58()}, using SystemProgram`,
      );
    }

    // 4. Use CONFIG ADDRESS (dvnsKey[i]) directly. Do NOT derive it.
    // DVN Account Order: [Program ID, Config Address, PriceFeed Program, PriceFeed Config]
    // Note: getDvnAccounts helper assumes we pass Program ID and it derives Config. THIS IS WRONG.
    // We should construct the list manually here to correspond to SDK logic exactly.
    // SDK: new DVN(owner).getQuoteIXAccountMetaForCPI(...) -> [Program, Config, FeedProg, FeedConfig]

    dvnAccounts.push({ pubkey: dvnProgramId, isSigner: false, isWritable: false }); // Program ID (from owner)
    dvnAccounts.push({ pubkey: dvnsKey[i], isSigner: false, isWritable: true }); // Config Address (from SendConfig). Payment=true
    dvnAccounts.push({ pubkey: dvnPriceFeedProgram, isSigner: false, isWritable: false }); // PriceFeed Program
    dvnAccounts.push({ pubkey: config.priceFeed, isSigner: false, isWritable: false }); // PriceFeed Config
  });

  console.log(
    `✅ Built ${executorAccounts.length} executor accounts and ${dvnAccounts.length} DVN accounts`,
  );

  const finalAccounts = [...endpointAccounts, ...ulnAccounts, ...executorAccounts, ...dvnAccounts];

  // Debug: Print all accounts for comparison
  console.log('\n📋 Final account list:');
  console.log(`  Total accounts: ${finalAccounts.length}`);
  finalAccounts.forEach((acc, i) => {
    console.log(
      `  [${i}] ${acc.pubkey.toBase58()} - signer:${acc.isSigner} writable:${acc.isWritable}`,
    );
  });

  return finalAccounts;
}

export async function getQuoteAccounts(
  connection: Connection,
  params: SendAccountsParams,
): Promise<AccountMeta[]> {
  const accounts = await getSendAccounts(connection, params);
  return accounts.map((account) => ({
    ...account,
    isWritable: false,
  }));
}
