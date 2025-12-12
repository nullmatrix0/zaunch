import { Connection, PublicKey } from '@solana/web3.js';
import { Token } from '@/types/token';
import { getRpcSOLEndpoint } from './sol';
import { LAUNCH_PROGRAM_ID } from '@/configs/env.config';

export const CONNECTION = new Connection(getRpcSOLEndpoint(), 'confirmed');
const PROGRAM_ID = new PublicKey(LAUNCH_PROGRAM_ID);
export interface RegistryData {
  launchPubkeys: PublicKey[];
  totalLaunches: number;
}

export function getRegistryPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('registry_v2')], PROGRAM_ID);
  return pda;
}

export function getLaunchPda(creator: PublicKey, launchName: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('launch'), creator.toBuffer(), Buffer.from(launchName)],
    PROGRAM_ID,
  );
  return pda;
}

export function getVaultPda(launchPda: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), launchPda.toBuffer()],
    PROGRAM_ID,
  );
  return pda;
}

export function getVkPda(circuitId: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('verifying_key'), Buffer.from(circuitId)],
    PROGRAM_ID,
  );
  return pda;
}

export async function getRegistry(): Promise<RegistryData> {
  const registryPda = getRegistryPda();
  console.log('[Registry] Fetching from PDA:', registryPda.toBase58());
  
  const accountInfo = await CONNECTION.getAccountInfo(registryPda);

  if (!accountInfo || accountInfo.data.length === 0) {
    console.log('[Registry] No data found in registry');
    return { launchPubkeys: [], totalLaunches: 0 };
  }

  const data = accountInfo.data;
  const numPubkeys = data.readUInt32LE(0);
  let offset = 4;

  const launchPubkeys: PublicKey[] = [];
  for (let i = 0; i < numPubkeys && offset + 32 <= data.length; i++) {
    launchPubkeys.push(new PublicKey(data.slice(offset, offset + 32)));
    offset += 32;
  }

  const totalLaunches = Number(data.readBigUInt64LE(offset));

  console.log('[Registry] Found', launchPubkeys.length, 'launches in registry, totalLaunches counter:', totalLaunches);
  console.log('[Registry] Launch PDAs:', launchPubkeys.map(p => p.toBase58()));

  return { launchPubkeys, totalLaunches };
}

export async function getLaunchData(launchAddress: PublicKey): Promise<Token | null> {
  try {
    const accountInfo = await CONNECTION.getAccountInfo(launchAddress);
    if (!accountInfo || accountInfo.data.length === 0) {
      return null;
    }

    const token = parseLaunchAccount(launchAddress, accountInfo.data);
    return token;
  } catch (e) {
    return null;
  }
}

export async function getMultipleLaunches(launchAddresses: PublicKey[]): Promise<(Token | null)[]> {
  const accountInfos = await CONNECTION.getMultipleAccountsInfo(launchAddresses);

  return accountInfos.map((info, index) => {
    const address = launchAddresses[index];
    if (!info || info.data.length === 0) {
      console.warn('[Launches] No data for launch:', address.toBase58());
      return null;
    }
    const parsed = parseLaunchAccount(address, info.data);
    if (!parsed) {
      console.warn('[Launches] Failed to parse launch:', address.toBase58(), 'data length:', info.data.length);
    }
    return parsed;
  });
}

export async function getAllLaunches(): Promise<Token[]> {
  const registry = await getRegistry();
  if (registry.launchPubkeys.length === 0) {
    return [];
  }

  const launches = await getMultipleLaunches(registry.launchPubkeys);
  return launches.filter((l): l is Token => l !== null);
}

export async function getRecentLaunches(count: number = 10): Promise<Token[]> {
  const registry = await getRegistry();

  // Get last N addresses
  const recentAddresses = registry.launchPubkeys.slice(-count);

  if (recentAddresses.length === 0) {
    return [];
  }

  const launches = await getMultipleLaunches(recentAddresses);
  return launches.filter((l): l is Token => l !== null);
}

export async function getLaunchesByCreator(creator: PublicKey): Promise<Token[]> {
  const allLaunches = await getAllLaunches();
  return allLaunches.filter((l) => l.creator === creator.toBase58());
}

export async function getActiveLaunches(): Promise<Token[]> {
  const allLaunches = await getAllLaunches();
  return allLaunches.filter((l) => l.isActive);
}

function parseLaunchAccount(address: PublicKey, data: Buffer): Token | null {
  try {
    let offset = 0;

    // Creator (Pubkey - 32 bytes)
    const creator = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32;

    // LaunchParams
    // name: String
    const nameLen = data.readUInt32LE(offset);
    offset += 4;
    const name = data.slice(offset, offset + nameLen).toString('utf8');
    offset += nameLen;

    // description: String
    const descLen = data.readUInt32LE(offset);
    offset += 4;
    const description = data.slice(offset, offset + descLen).toString('utf8');
    offset += descLen;

    // creator_wallet: String (4 bytes length + content)
    const creatorWalletLen = data.readUInt32LE(offset);
    offset += 4;
    const creatorWallet = data.slice(offset, offset + creatorWalletLen).toString('utf8');
    offset += creatorWalletLen;

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

    // price_per_ticket: u64 (NEW - ticket price in micro-USD)
    const pricePerTicket = data.readBigUInt64LE(offset);
    offset += 8;

    // total_tickets: u64 (NEW - total tickets available)
    const totalTickets = data.readBigUInt64LE(offset);
    offset += 8;

    // escrow_enabled: bool (NEW - escrow field in LaunchParams)
    const escrowEnabled = data[offset] !== 0;
    offset += 1;

    // escrow_address: String (NEW - escrow field in LaunchParams)
    const escrowAddressLen = data.readUInt32LE(offset);
    offset += 4;
    const escrowAddress = data.slice(offset, offset + escrowAddressLen).toString('utf8');
    offset += escrowAddressLen;

    // TokenDetails
    // token_name: String
    const tokenNameLen = data.readUInt32LE(offset);
    offset += 4;
    const tokenName = data.slice(offset, offset + tokenNameLen).toString('utf8');
    offset += tokenNameLen;

    // token_symbol: String
    const symbolLen = data.readUInt32LE(offset);
    offset += 4;
    const tokenSymbol = data.slice(offset, offset + symbolLen).toString('utf8');
    offset += symbolLen;

    // token_uri: String
    const uriLen = data.readUInt32LE(offset);
    offset += 4;
    const tokenUri = data.slice(offset, offset + uriLen).toString('utf8');
    offset += uriLen;

    // decimals: u8
    const decimals = data[offset];
    offset += 1;

    // token_mint: Pubkey
    const tokenMint = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32;

    // token_vault: Pubkey
    const tokenVault = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32;

    // total_claimed: u64
    const totalClaimed = data.readBigUInt64LE(offset);
    offset += 8;

    // verified_proofs_count: u64
    const verifiedProofsCount = data.readBigUInt64LE(offset);
    offset += 8;

    // total_claims_count: u64 (comes BEFORE is_active in the contract)
    const totalClaimsCount = data.readBigUInt64LE(offset);
    offset += 8;

    // is_active: bool
    const isActive = data[offset] !== 0;
    offset += 1;

    // creator_refunded: bool
    const creatorRefunded = data[offset] !== 0;
    offset += 1;

    // escrow_finalized: bool (new field)
    const escrowFinalized = data[offset] !== 0;
    offset += 1;

    // refunds_enabled: bool (new field)
    const refundsEnabled = data[offset] !== 0;
    offset += 1;

    // total_escrowed_usd: u64 (new field)
    const totalEscrowedUsd = data.readBigUInt64LE(offset);
    offset += 8;

    // bump: u8 (not needed in frontend but read to complete parsing)
    // const bump = data[offset];
    // offset += 1;

    return {
      address: address.toBase58(),
      creator,
      creatorWallet,
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
      pricePerTicket,
      totalTickets,
      startTime,
      endTime,
      maxClaimsPerUser,
      totalClaimed,
      verifiedProofsCount,
      totalClaimsCount,
      isActive,
      creatorRefunded,
      escrowEnabled,
      escrowAddress,
      escrowFinalized,
      refundsEnabled,
      totalEscrowedUsd,
    };
  } catch (e) {
    return null;
  }
}
