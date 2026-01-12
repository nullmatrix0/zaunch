'use client';

import { useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Token } from '@/types/token';
import { formatNumberToCurrency } from '@/utils';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';

interface ClaimRecord {
  user: string;
  claimAmount: number;
  timestamp: number;
  claimIndex: number;
}

interface ClaimNetworkMonitorProps {
  token: Token;
  launchAddress: string;
}

export function ClaimNetworkMonitor({ token, launchAddress }: ClaimNetworkMonitorProps) {
  // Check if sale has ended - only show claim monitor when claim period is active
  const saleEnded = Date.now() / 1000 > Number(token.endTime);
  
  // Hide component when sale is still active
  if (!saleEnded) {
    return null;
  }

  const { connection } = useConnection();
  const { prices } = useCryptoPrices();
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalClaimsCount, setTotalClaimsCount] = useState(0);

  // Calculate pool depth in ZEC based on total remaining tokens to sell
  const remainingTokens = Number(token.amountToSell) - Number(token.totalClaimed);
  const pricePerTokenUsd = Number(token.pricePerToken) / 1_000_000;
  const poolDepthUsd = (remainingTokens / Math.pow(10, token.decimals)) * pricePerTokenUsd;
  const zecPrice = prices.zcash || 30;
  const poolDepthZec = zecPrice > 0 ? poolDepthUsd / zecPrice : 0;

  // For now, show verified proofs count as claims redeemed
  const claimsRedeemed = Number(token.verifiedProofsCount || 0);

  // Generate mock claim data based on verifiedProofsCount
  // In production, this would call the contract's GetClaimRecords instruction
  useEffect(() => {
    const loadClaims = async () => {
      setLoading(true);
      setTotalClaimsCount(claimsRedeemed);
      
      // For demo purposes, generate fake claim records
      // In production, query the contract using GetClaimRecords (instruction 16)
      const mockClaims: ClaimRecord[] = [];
      const now = Date.now() / 1000;
      
      for (let i = 0; i < Math.min(claimsRedeemed, 10); i++) {
        // Generate pseudo-random but deterministic addresses
        const userBytes = new Uint8Array(32);
        userBytes[0] = i;
        userBytes[31] = i * 7;
        const fakeUser = new PublicKey(userBytes).toBase58();
        
        mockClaims.push({
          user: fakeUser,
          claimAmount: Math.floor(Math.random() * 1000000) + 100000,
          timestamp: now - Math.random() * 7200, // Within last 2 hours
          claimIndex: i,
        });
      }
      
      setClaims(mockClaims.reverse()); // Most recent first
      setLoading(false);
    };

    loadClaims();
  }, [claimsRedeemed, launchAddress]);

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  const shortenAddress = (address: string) => {
    return `...${address.slice(-5)}`;
  };

  return (
    <div className="bg-neutral-950 border border-gray-800 p-3 sm:p-4 md:p-5 w-full">
      <h3 className="font-rajdhani font-bold text-base sm:text-lg md:text-xl text-white mb-3 sm:mb-4">
        CLAIM NETWORK MONITOR
      </h3>

      {/* Stats Row */}
      <div className="border border-gray-800 flex w-full mb-4">
        <div className="flex-1 border-r border-gray-800 p-2 sm:p-3 flex flex-col items-center justify-center gap-1">
          <span className="font-rajdhani text-[10px] sm:text-xs text-[#79767d] text-center">
            Pool Depth
          </span>
          <span className="font-rajdhani font-bold text-sm sm:text-base md:text-lg text-white">
            {formatNumberToCurrency(poolDepthZec)} ZEC
          </span>
        </div>
        <div className="flex-1 p-2 sm:p-3 flex flex-col items-center justify-center gap-1">
          <span className="font-rajdhani text-[10px] sm:text-xs text-[#79767d] text-center">
            Claims Redeemed
          </span>
          <span className="font-rajdhani font-bold text-sm sm:text-base md:text-lg text-white">
            {claimsRedeemed.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Latest Shielded Inputs */}
      <div className="flex flex-col gap-2">
        <h4 className="font-rajdhani font-medium text-xs sm:text-sm text-[#79767d] uppercase">
          Latest Shielded Inputs
        </h4>
        
        <div className="border border-gray-800 overflow-hidden">
          {loading ? (
            <div className="p-4 text-center text-gray-500 font-rajdhani text-sm">
              Loading claim history...
            </div>
          ) : claims.length === 0 ? (
            <div className="p-4 text-center text-gray-500 font-rajdhani text-sm">
              No claims yet
            </div>
          ) : (
            <div className="max-h-[240px] overflow-y-auto">
              {claims.map((claim, index) => (
                <div
                  key={claim.claimIndex}
                  className={`flex items-center justify-between px-3 py-2 ${
                    index !== claims.length - 1 ? 'border-b border-gray-800/50' : ''
                  } hover:bg-gray-900/30 transition-colors`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 font-rajdhani text-xs">&gt;</span>
                    <span className="font-rajdhani text-xs sm:text-sm text-white">
                      Claim Redeemed: {shortenAddress(claim.user)}
                    </span>
                  </div>
                  <span className="font-rajdhani text-xs text-[#79767d]">
                    {formatTimeAgo(claim.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {totalClaimsCount > 10 && (
          <button className="text-[#d08700] font-rajdhani text-xs sm:text-sm hover:underline text-center py-2">
            See more
          </button>
        )}
      </div>
    </div>
  );
}

