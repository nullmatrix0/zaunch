import { PublicKey, Connection, SystemProgram } from '@solana/web3.js';
import { addressToBytes32 } from '@layerzerolabs/lz-v2-utilities';

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

export const ENDPOINT_PROGRAM_ID = new PublicKey('76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6');
export const ULN_PROGRAM_ID = new PublicKey('7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH');
export const SIMPLE_MESSAGELIB_PROGRAM_ID = new PublicKey(
  '7Nv6sbKf4kxAxnbcVfKvKvbFGXQqHDhkVvNZHcpvhvvP',
);
export const DEFAULT_MESSAGE_LIB = new PublicKey('11111111111111111111111111111111');

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

function deserializeSendLibraryConfig(data: Buffer): PublicKey {
  return new PublicKey(data.slice(8, 40));
}

function deserializeSendConfig(data: Buffer): {
  executor: PublicKey;
  requiredDvns: PublicKey[];
  optionalDvns: PublicKey[];
} {
  let offset = 8;
  offset += 1;

  offset += 8;
  offset += 1;
  offset += 1;
  offset += 1;

  const requiredDvnsLength = data.readUInt32LE(offset);
  offset += 4;
  const requiredDvns: PublicKey[] = [];
  for (let i = 0; i < requiredDvnsLength; i++) {
    requiredDvns.push(new PublicKey(data.slice(offset, offset + 32)));
    offset += 32;
  }

  const optionalDvnsLength = data.readUInt32LE(offset);
  offset += 4;
  const optionalDvns: PublicKey[] = [];
  for (let i = 0; i < optionalDvnsLength; i++) {
    optionalDvns.push(new PublicKey(data.slice(offset, offset + 32)));
    offset += 32;
  }

  offset += 4;
  const executor = new PublicKey(data.slice(offset, offset + 32));

  return { executor, requiredDvns, optionalDvns };
}

function deserializeExecutorConfig(data: Buffer): { priceFeed: PublicKey } {
  let offset = 8;
  offset += 1;
  offset += 32;

  const allowListLen = data.readUInt32LE(offset);
  offset += 4 + allowListLen * 32;
  const denyListLen = data.readUInt32LE(offset);
  offset += 4 + denyListLen * 32;

  const adminsLen = data.readUInt32LE(offset);
  offset += 4 + adminsLen * 32;

  const executorsLen = data.readUInt32LE(offset);
  offset += 4 + executorsLen * 32;

  const msglibsLen = data.readUInt32LE(offset);
  offset += 4 + msglibsLen * 32;

  offset += 1;
  offset += 2;

  const priceFeed = new PublicKey(data.slice(offset, offset + 32));
  return { priceFeed };
}

function deserializeDvnConfig(data: Buffer): { priceFeed: PublicKey } {
  let offset = 8;
  offset += 4;
  offset += 1;

  const signersLen = data.readUInt32LE(offset);
  offset += 4 + signersLen * 64;
  offset += 1;
  const allowListLen = data.readUInt32LE(offset);
  offset += 4 + allowListLen * 32;
  const denyListLen = data.readUInt32LE(offset);
  offset += 4 + denyListLen * 32;

  offset += 1;

  const msglibsLen = data.readUInt32LE(offset);
  offset += 4 + msglibsLen * 32;

  const adminsLen = data.readUInt32LE(offset);
  offset += 4 + adminsLen * 32;

  const priceFeed = new PublicKey(data.slice(offset, offset + 32));
  return { priceFeed };
}

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

function getExecutorAccounts(
  priceFeedConfig: PublicKey,
  priceFeedProgram: PublicKey,
  payment: boolean,
): AccountMeta[] {
  const [executorConfig] = deriveExecutorConfig();

  const accounts: AccountMeta[] = [
    { pubkey: EXECUTOR_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: executorConfig, isSigner: false, isWritable: payment },
    { pubkey: priceFeedProgram, isSigner: false, isWritable: false },
    { pubkey: priceFeedConfig, isSigner: false, isWritable: false },
  ];

  return accounts;
}

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
  const [msgLibInfo] = deriveMessageLibraryInfo(msgLib);
  const [nonce] = deriveNonce(sender, dstEid, receiverBytes);
  const [endpointSettings] = deriveEndpointSettings();
  const [eventAuthority] = deriveEventAuthority(ENDPOINT_PROGRAM_ID);

  const endpointAccounts: AccountMeta[] = [
    { pubkey: ENDPOINT_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: sender, isSigner: false, isWritable: false },
    { pubkey: msgLibProgram, isSigner: false, isWritable: false },
    { pubkey: sendLibConfig, isSigner: false, isWritable: false },
    { pubkey: defaultSendLibConfig, isSigner: false, isWritable: false },
    { pubkey: msgLibInfo, isSigner: false, isWritable: false },
    { pubkey: endpointSettings, isSigner: false, isWritable: false },
    { pubkey: nonce, isSigner: false, isWritable: true },
    { pubkey: eventAuthority, isSigner: false, isWritable: false },
    { pubkey: ENDPOINT_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  if (msgLib.equals(simpleMsgLib)) {
    return [
      ...endpointAccounts,
      { pubkey: simpleMsgLib, isSigner: false, isWritable: false },
      { pubkey: payer, isSigner: false, isWritable: true },
    ];
  }

  if (!ulnBuf || !ulnDefaultSendConfigBuf) {
    throw new Error('ULN send library not initialized');
  }

  const defaultSendConfigState = deserializeSendConfig(ulnDefaultSendConfigBuf.data);
  const sendConfigState = ulnSendConfigBuf ? deserializeSendConfig(ulnSendConfigBuf.data) : null;

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

  const [ulnSettings] = deriveUlnSettings();
  const [ulnEventAuthority] = deriveEventAuthority(ULN_PROGRAM_ID);
  const ulnAccounts: AccountMeta[] = [
    { pubkey: ulnSettings, isSigner: false, isWritable: false },
    { pubkey: ulnSendConfig, isSigner: false, isWritable: false },
    { pubkey: ulnDefaultSendConfig, isSigner: false, isWritable: false },
    { pubkey: payer, isSigner: false, isWritable: true },
    { pubkey: ULN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: ulnEventAuthority, isSigner: false, isWritable: false },
    { pubkey: ULN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

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

  const priceFeeds = [executorConfig.priceFeed, ...dvnConfigs.map((d) => d.priceFeed)];
  const priceFeedBufs = await connection.getMultipleAccountsInfo(priceFeeds);

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
  const dvnAccounts: AccountMeta[] = [];
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
    const dvnPriceFeedBuf = priceFeedBufs[i + 1];
    const dvnPriceFeedProgram = dvnPriceFeedBuf ? dvnPriceFeedBuf.owner : SystemProgram.programId;

    if (!dvnPriceFeedBuf) {
      console.warn(
        `⚠️  DVN price feed not found: ${config.priceFeed.toBase58()}, using SystemProgram`,
      );
    }

    // 4. Use CONFIG ADDRESS (dvnsKey[i]) directly.
    dvnAccounts.push({ pubkey: dvnProgramId, isSigner: false, isWritable: false });
    dvnAccounts.push({ pubkey: dvnsKey[i], isSigner: false, isWritable: true });
    dvnAccounts.push({ pubkey: dvnPriceFeedProgram, isSigner: false, isWritable: false });
    dvnAccounts.push({ pubkey: config.priceFeed, isSigner: false, isWritable: false });
  });

  const finalAccounts = [...endpointAccounts, ...ulnAccounts, ...executorAccounts, ...dvnAccounts];

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
