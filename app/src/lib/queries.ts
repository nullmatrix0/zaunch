/**
 * Zaunchpad SDK - Query Functions
 *
 * FREE QUERIES: Just RPC calls, no SOL cost
 */

import {
  Connection,
  PublicKey,
} from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey('HDFv1zjKQzvHuNJeH7D6A8DFKAxwJKw8X47qW4MYxYpA');

// ============================================================================
// TYPES
// ============================================================================

export interface LaunchData {
  address: string;
  creator: string;
  creatorWallet: string;
  name: string;
  description: string;
  tokenMint: string;
  tokenVault: string;
  tokenSymbol: string;
  tokenName: string;
  tokenUri: string;
  decimals: number;
  totalSupply: bigint;
  amountToSell: bigint;
  pricePerToken: bigint;
  minAmountToSell: bigint;
  tokensPerProof: bigint;
  startTime: bigint;
  endTime: bigint;
  maxClaimsPerUser: bigint;
  totalClaimed: bigint;
  isActive: boolean;
}

export interface RegistryData {
  launchPubkeys: PublicKey[];
  totalLaunches: number;
}

// ============================================================================
// PDA DERIVATIONS
// ============================================================================

export function getRegistryPda(programId: PublicKey = PROGRAM_ID): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('registry_v2')],
    programId
  );
  return pda;
}

export function getLaunchPda(
  creator: PublicKey,
  launchName: string,
  programId: PublicKey = PROGRAM_ID
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('launch'), creator.toBuffer(), Buffer.from(launchName)],
    programId
  );
  return pda;
}

export function getVaultPda(
  launchPda: PublicKey,
  programId: PublicKey = PROGRAM_ID
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), launchPda.toBuffer()],
    programId
  );
  return pda;
}

// ============================================================================
// FREE QUERY FUNCTIONS
// ============================================================================

/**
 * Get all launch addresses from the registry (FREE)
 */
export async function getRegistry(
  connection: Connection,
  programId: PublicKey = PROGRAM_ID
): Promise<RegistryData> {
  const registryPda = getRegistryPda(programId);
  const accountInfo = await connection.getAccountInfo(registryPda);

  if (!accountInfo || accountInfo.data.length === 0) {
    return { launchPubkeys: [], totalLaunches: 0 };
  }

  const data = accountInfo.data;

  // Parse Borsh Vec<Pubkey> structure: u32 (length) + Pubkeys (32 bytes each)
  const numPubkeys = data.readUInt32LE(0);
  let offset = 4;

  const launchPubkeys: PublicKey[] = [];
  for (let i = 0; i < numPubkeys && offset + 32 <= data.length; i++) {
    try {
      launchPubkeys.push(new PublicKey(data.slice(offset, offset + 32)));
      offset += 32;
    } catch (err) {
      console.warn(`Failed to parse pubkey at index ${i}:`, err);
      offset += 32;
    }
  }

  // Read total_launches (u64) at the end
  const totalLaunches = offset + 8 <= data.length ? Number(data.readBigUInt64LE(offset)) : launchPubkeys.length;

  return { launchPubkeys, totalLaunches };
}

/**
 * Get full launch data from a launch address (FREE)
 */
export async function getLaunchData(
  connection: Connection,
  launchAddress: PublicKey
): Promise<LaunchData | null> {
  const accountInfo = await connection.getAccountInfo(launchAddress);

  if (!accountInfo || accountInfo.data.length === 0) {
    return null;
  }

  return parseLaunchAccount(launchAddress, accountInfo.data);
}

/**
 * Get multiple launches at once (FREE - uses getMultipleAccountsInfo)
 */
export async function getMultipleLaunches(
  connection: Connection,
  launchAddresses: PublicKey[]
): Promise<(LaunchData | null)[]> {
  const accountInfos = await connection.getMultipleAccountsInfo(launchAddresses);

  return accountInfos.map((info, index) => {
    if (!info || info.data.length === 0) return null;
    return parseLaunchAccount(launchAddresses[index], info.data);
  });
}

/**
 * Get ALL launches with full data (FREE)
 * Combines registry read + batch account fetch
 */
export async function getAllLaunches(
  connection: Connection,
  programId: PublicKey = PROGRAM_ID
): Promise<LaunchData[]> {
  // Step 1: Get all launch addresses from registry (1 RPC call)
  const registry = await getRegistry(connection, programId);

  if (registry.launchPubkeys.length === 0) {
    return [];
  }

  // Step 2: Batch fetch all launch accounts (1 RPC call)
  const launches = await getMultipleLaunches(connection, registry.launchPubkeys);

  // Filter out nulls
  return launches.filter((l): l is LaunchData => l !== null);
}

/**
 * Get recent launches (last N) with full data (FREE)
 */
export async function getRecentLaunches(
  connection: Connection,
  count: number = 10,
  programId: PublicKey = PROGRAM_ID
): Promise<LaunchData[]> {
  const registry = await getRegistry(connection, programId);

  // Get last N addresses
  const recentAddresses = registry.launchPubkeys.slice(-count);

  if (recentAddresses.length === 0) {
    return [];
  }

  const launches = await getMultipleLaunches(connection, recentAddresses);
  return launches.filter((l): l is LaunchData => l !== null);
}

/**
 * Get launches by creator (FREE)
 */
export async function getLaunchesByCreator(
  connection: Connection,
  creator: PublicKey,
  programId: PublicKey = PROGRAM_ID
): Promise<LaunchData[]> {
  const allLaunches = await getAllLaunches(connection, programId);
  return allLaunches.filter(l => l.creator === creator.toBase58());
}

/**
 * Get active launches only (FREE)
 */
export async function getActiveLaunches(
  connection: Connection,
  programId: PublicKey = PROGRAM_ID
): Promise<LaunchData[]> {
  const allLaunches = await getAllLaunches(connection, programId);
  return allLaunches.filter(l => l.isActive);
}

// ============================================================================
// PARSER
// ============================================================================

/**
 * Parse a Launch account according to the IDL structure:
 * - creator: Pubkey (32 bytes)
 * - launchParams: LaunchParams struct
 * - tokenDetails: TokenDetails struct
 * - tokenMint: Pubkey (32 bytes)
 * - tokenVault: Pubkey (32 bytes)
 * - totalClaimed: u64 (8 bytes)
 * - isActive: bool (1 byte)
 * - bump: u8 (1 byte)
 */
function parseLaunchAccount(address: PublicKey, data: Buffer): LaunchData | null {
  try {
    let offset = 0;

    // Creator (Pubkey - 32 bytes)
    const creator = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32;

    // LaunchParams struct
    // name: String (u32 length + bytes)
    const nameLen = data.readUInt32LE(offset);
    offset += 4;
    const name = data.slice(offset, offset + nameLen).toString('utf8');
    offset += nameLen;

    // description: String (u32 length + bytes)
    const descLen = data.readUInt32LE(offset);
    offset += 4;
    const description = data.slice(offset, offset + descLen).toString('utf8');
    offset += descLen;

    // start_time: i64
    const startTime = data.readBigInt64LE(offset);
    offset += 8;

    // end_time: i64
    const endTime = data.readBigInt64LE(offset);
    offset += 8;

    // max_claims_per_user: u64
    const maxClaimsPerUser = data.readBigUInt64LE(offset);
    offset += 8;

    // total_supply: u64
    const totalSupply = data.readBigUInt64LE(offset);
    offset += 8;

    // tokens_per_proof: u64
    const tokensPerProof = data.readBigUInt64LE(offset);
    offset += 8;

    // price_per_token: u64
    const pricePerToken = data.readBigUInt64LE(offset);
    offset += 8;

    // min_amount_to_sell: u64
    const minAmountToSell = data.readBigUInt64LE(offset);
    offset += 8;

    // amount_to_sell: u64
    const amountToSell = data.readBigUInt64LE(offset);
    offset += 8;

    // TokenDetails struct
    // token_name: String (u32 length + bytes)
    const tokenNameLen = data.readUInt32LE(offset);
    offset += 4;
    const tokenName = data.slice(offset, offset + tokenNameLen).toString('utf8');
    offset += tokenNameLen;

    // token_symbol: String (u32 length + bytes)
    const symbolLen = data.readUInt32LE(offset);
    offset += 4;
    const tokenSymbol = data.slice(offset, offset + symbolLen).toString('utf8');
    offset += symbolLen;

    // token_uri: String (u32 length + bytes)
    const uriLen = data.readUInt32LE(offset);
    offset += 4;
    const tokenUri = data.slice(offset, offset + uriLen).toString('utf8');
    offset += uriLen;

    // decimals: u8
    const decimals = data[offset];
    offset += 1;

    // token_mint: Pubkey (32 bytes)
    const tokenMint = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32;

    // token_vault: Pubkey (32 bytes)
    const tokenVault = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32;

    // total_claimed: u64
    const totalClaimed = data.readBigUInt64LE(offset);
    offset += 8;

    // is_active: bool (1 byte)
    const isActive = data[offset] !== 0;
    offset += 1;

    // bump: u8 (1 byte) - we don't need this for display
    // offset += 1;

    return {
      address: address.toBase58(),
      creator,
      creatorWallet: creator, // Use creator as wallet for now
      name,
      description,
      tokenMint,
      tokenVault,
      tokenSymbol,
      tokenName,
      tokenUri,
      decimals,
      totalSupply,
      amountToSell,
      pricePerToken,
      minAmountToSell,
      tokensPerProof,
      startTime,
      endTime,
      maxClaimsPerUser,
      totalClaimed,
      isActive,
    };
  } catch (e) {
    console.error('Failed to parse launch:', e);
    console.error('Data length:', data.length);
    return null;
  }
}
