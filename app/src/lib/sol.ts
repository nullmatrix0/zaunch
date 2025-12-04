import { deserializeMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { TOKEN_PROGRAM_ID, getMint } from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';
import { HELIUS_API_KEY, SOL_NETWORK } from '../configs/env.config';
import { getIpfsUrl } from './utils';

const PRICE_APIS = [
  { url: 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', parse: (d: any) => d?.solana?.usd },
  { url: 'https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT', parse: (d: any) => parseFloat(d?.price) },
  { url: 'https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=SOL-USDT', parse: (d: any) => parseFloat(d?.data?.price) },
];

interface PriceCache {
  price: number;
  timestamp: number;
}

export interface TokenInfo {
  mint: string;
  name: string;
  symbol: string;
  image?: string;
  balance: number;
  decimals: number;
  tokenAccount: string;
}

let solPriceCache: PriceCache | null = null;
const CACHE_DURATION = 5 * 60 * 1000;
const FETCH_TIMEOUT = 5000;

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

const fetchWithTimeout = async (url: string, timeout: number): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

export const getSolPrice = async (): Promise<number | null> => {
  // Return cached price if fresh
  if (solPriceCache && Date.now() - solPriceCache.timestamp < CACHE_DURATION) {
    return solPriceCache.price;
  }

  // Try each API in order
  for (const api of PRICE_APIS) {
    try {
      const res = await fetchWithTimeout(api.url, FETCH_TIMEOUT);
      if (!res.ok) continue;
      const data = await res.json();
      const price = api.parse(data);
      
      if (price && !Number.isNaN(price) && price > 0) {
        solPriceCache = { price, timestamp: Date.now() };
        return price;
      }
    } catch {
      continue;
    }
  }

  // Return stale cache if all APIs fail
  if (solPriceCache) {
    console.warn('Using stale SOL price cache');
    return solPriceCache.price;
  }

  return null;
};

export const getRpcSOLEndpoint = (): string => {
  switch (SOL_NETWORK) {
    case 'mainnet':
      return `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
    case 'testnet':
      return `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
    default:
      return `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
  }
};

/**
 * Get SOL balance for a wallet address
 * @param walletAddress - The wallet address to get SOL balance for
 * @returns The SOL balance in SOL units
 */
export const getSolBalance = async (walletAddress: string): Promise<number> => {
  try {
    const connection = new Connection(getRpcSOLEndpoint());
    const publicKey = new PublicKey(walletAddress);

    if (!PublicKey.isOnCurve(publicKey)) {
      throw new Error('Invalid wallet address');
    }

    const balance = await connection.getBalance(publicKey);

    // Convert lamports to SOL (1 SOL = 1,000,000,000 lamports)
    const solBalance = balance / 1_000_000_000;

    return solBalance;
  } catch (error) {
    console.error('Error getting SOL balance:', error);
    throw new Error(
      `Failed to get SOL balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

/**
 * Get token balance for a specific token mint and wallet address
 * @param tokenMintAddress - The token mint address
 * @param walletAddress - The wallet address to get token balance for
 * @returns The token balance
 */
export const getTokenBalanceOnSOL = async (
  tokenMintAddress: string,
  walletAddress: string,
): Promise<number> => {
  try {
    const connection = new Connection(getRpcSOLEndpoint());
    const walletPublicKey = new PublicKey(walletAddress);

    if (!PublicKey.isOnCurve(walletPublicKey)) {
      throw new Error('Invalid wallet address');
    }

    // Get all token accounts for the wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletPublicKey, {
      programId: TOKEN_PROGRAM_ID,
    });

    // Find the token account for the specific mint
    const tokenAccount = tokenAccounts.value.find(
      (account) => account.account.data.parsed.info.mint === tokenMintAddress,
    );

    if (!tokenAccount) {
      return 0; // No token account found for this mint
    }

    const balance = tokenAccount.account.data.parsed.info.tokenAmount.uiAmount;
    return balance;
  } catch (error) {
    console.error('Error getting token balance:', error);
    throw new Error(
      `Failed to get token balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

/**
 * Get all tokens for a Solana account
 * @param walletAddress - The wallet address to get tokens for
 * @returns Array of token information including metadata
 */
export async function getAllTokens(walletAddress: string): Promise<TokenInfo[]> {
  try {
    const connection = new Connection(getRpcSOLEndpoint());
    const publicKey = new PublicKey(walletAddress);

    if (!PublicKey.isOnCurve(publicKey)) {
      throw new Error('Invalid wallet address');
    }

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      programId: TOKEN_PROGRAM_ID,
    });

    const tokens: TokenInfo[] = [];

    // Process each token account (limit to 10)
    const limitedTokenAccounts = tokenAccounts.value.slice(0, 30);
    for (const { account, pubkey } of limitedTokenAccounts) {
      const accountInfo = account.data.parsed.info;
      const mint = accountInfo.mint;
      const balance = accountInfo.tokenAmount.uiAmount;
      const decimals = accountInfo.tokenAmount.decimals;

      // Skip if balance is 0
      if (balance === 0) {
        continue;
      }

      // Get token metadata
      const metadata = await getTokenMetadata(mint);
      tokens.push({
        mint,
        name: metadata?.name || 'Unknown Token',
        symbol: metadata?.symbol || 'UNKNOWN',
        image: metadata?.image,
        balance,
        decimals,
        tokenAccount: pubkey.toString(),
      });
    }

    tokens.sort((a, b) => b.balance - a.balance);

    return tokens;
  } catch (error) {
    console.error('Error getting tokens:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      walletAddress,
      network: SOL_NETWORK,
      rpcEndpoint: getRpcSOLEndpoint(),
    });
    throw new Error(
      `Failed to get tokens: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  image?: string;
  description?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  decimals: number;
}

/**
 * Get token metadata from Metaplex metadata program
 */
async function getTokenMetadata(mint: string): Promise<TokenMetadata | null> {
  try {
    const connection = new Connection(getRpcSOLEndpoint());
    const mintPublicKey = new PublicKey(mint);

    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintPublicKey.toBuffer()],
      TOKEN_METADATA_PROGRAM_ID,
    );

    const accountInfo = await connection.getAccountInfo(metadataPDA);

    if (!accountInfo?.data) {
      console.warn(`Token metadata account not found for mint ${mint}`);
      return null;
    }

    //@ts-expect-error
    const metadata = deserializeMetadata(accountInfo);
    let imageUrl: string | undefined;
    let description: string | undefined;
    let website: string | undefined;
    let twitter: string | undefined;
    let telegram: string | undefined;

    try {
      const imageResponse = await fetch(getIpfsUrl(metadata.uri));
      if (imageResponse.ok) {
        const imageData = await imageResponse.json();
        imageUrl = imageData?.image;
        description = imageData?.description;
        website = imageData?.website;
        twitter = imageData?.twitter;
        telegram = imageData?.telegram;
      }
    } catch (fetchError) {
      console.warn(`Unable to fetch metadata JSON for mint ${mint}`, fetchError);
    }

    return {
      name: metadata.name.replace(/\0/g, ''),
      symbol: metadata.symbol.replace(/\0/g, ''),
      image: imageUrl,
      description,
      website,
      twitter,
      telegram,
      decimals: 0,
    };
  } catch (error) {
    console.error('Error fetching token metadata:', error);
    return null;
  }
}

/**
 * Get complete token information including metadata and decimals
 */
export async function getTokenInfo(mint: string): Promise<{
  name: string;
  symbol: string;
  image?: string;
  description?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  decimals: number;
} | null> {
  try {
    const connection = new Connection(getRpcSOLEndpoint());
    const mintPublicKey = new PublicKey(mint);

    // Get decimals from mint account
    let decimals = 9; // Default to 9 if we can't fetch
    try {
      const mintInfo = await getMint(connection, mintPublicKey);
      decimals = mintInfo.decimals;
    } catch (error) {
      console.warn(`Could not fetch mint info for ${mint}:`, error);
    }

    // Get metadata
    const metadata = await getTokenMetadata(mint);

    if (!metadata) {
      // Return basic info with decimals even if metadata is not found
      return {
        name: 'Unknown Token',
        symbol: 'UNKNOWN',
        decimals,
      };
    }

    return {
      ...metadata,
      decimals,
    };
  } catch (error) {
    console.error('Error fetching token info:', error);
    return null;
  }
}
