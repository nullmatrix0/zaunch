export interface TokenMetadata {
  uri?: string;
  imageUri?: string;
  bannerUri?: string;
  description?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
}

export interface Token {
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
  pricePerTicket: bigint;      // Price per ticket in micro-USD
  totalTickets: bigint;        // Total tickets available
  startTime: bigint;
  endTime: bigint;
  maxClaimsPerUser: bigint;
  totalClaimed: bigint;
  verifiedProofsCount: bigint;
  totalClaimsCount?: bigint;
  remainingTokens?: bigint;
  isActive: boolean;
  creatorRefunded: boolean;
}
