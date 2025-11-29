import {
  Connection,
  PublicKey,
} from '@solana/web3.js';
import type { Token } from '@/types/api';
import { getRpcSOLEndpoint } from './sol';
import { getAllLaunches as sdkGetAllLaunches, type LaunchData } from './queries';

// Your custom launchpad program ID
const LAUNCHPAD_PROGRAM_ID = new PublicKey('HDFv1zjKQzvHuNJeH7D6A8DFKAxwJKw8X47qW4MYxYpA');

/**
 * Convert LaunchData from SDK to Token format
 */
function convertLaunchDataToToken(launchData: LaunchData): Token {
  return {
    id: launchData.address,
    mintAddress: launchData.tokenMint,
    name: launchData.tokenName,
    symbol: launchData.tokenSymbol,
    description: launchData.description,
    image: launchData.tokenUri,
    createdAt: new Date(Number(launchData.startTime) * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    owner: launchData.creator,
    status: launchData.isActive ? 'live' : 'ended',
    tags: [],
    marketCap: 0,
    replies: 0,
    totalSupply: Number(launchData.totalSupply),
    decimals: launchData.decimals,
    poolAddress: launchData.address,
    metadata: {
      tokenUri: launchData.tokenUri
    },
    // Additional fields from LaunchData
    pricePerToken: Number(launchData.pricePerToken),
    minAmountToSell: Number(launchData.minAmountToSell),
    amountToSell: Number(launchData.amountToSell),
  } as unknown as Token;
}

/**
 * Query all launches using the SDK
 */
export async function queryLaunches(): Promise<Token[]> {
  try {
    const connection = new Connection(getRpcSOLEndpoint(), 'confirmed');

    console.log('Fetching launches from blockchain using SDK...');

    // Use SDK to get all launches
    const launches = await sdkGetAllLaunches(connection, LAUNCHPAD_PROGRAM_ID);

    console.log(`Found ${launches.length} launches`);

    // Convert to Token format
    const tokens = launches.map(convertLaunchDataToToken);
    console.log(tokens);
    console.log(`Successfully converted ${tokens.length} launches to tokens`);
    return tokens;
  } catch (error) {
    console.error('Error querying launches:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    return [];
  }
}

/**
 * Main function to get all pools (used by hooks)
 */
export async function getAllLaunches(): Promise<Token[]> {
  return queryLaunches();
}
