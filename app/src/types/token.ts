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
  // Escrow fields from LaunchParams
  escrowEnabled?: boolean;     // If true, funds go to platform escrow
  escrowAddress?: string;      // TEE-provided escrow z-address
  // Escrow state fields from Launch
  escrowFinalized?: boolean;   // True when sale ends and escrow is finalized
  refundsEnabled?: boolean;    // True if min_amount_to_sell not reached
  totalEscrowedUsd?: bigint;   // Total USD value in escrow (micro-USD)
}
