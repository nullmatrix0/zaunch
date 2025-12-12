'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { AlertTriangle, DollarSign, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { 
  checkTicketUsage, 
  claimRefund, 
  getEscrowStatus,
  EscrowStatus, 
  RefundClaimResult 
} from '@/lib/tee-client';

interface RefundClaimButtonProps {
  launchId: string;
  launchPda: string;
  saleEndTime: number;
  className?: string;
}

export default function RefundClaimButton({
  launchId,
  launchPda,
  saleEndTime,
  className = '',
}: RefundClaimButtonProps) {
  const { publicKey, connected } = useWallet();
  const [escrowStatus, setEscrowStatus] = useState<EscrowStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<RefundClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasEnded = Date.now() > saleEndTime * 1000;

  // Fetch escrow status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setIsLoading(true);
        const status = await getEscrowStatus(launchId);
        setEscrowStatus(status);
        setError(null);
      } catch (err) {
        // If escrow not found, sale might not have escrow enabled
        setEscrowStatus(null);
        setError(null); // Silently handle - just means no escrow
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
  }, [launchId]);

  // Can only claim refund if:
  // 1. Sale has ended
  // 2. Escrow is finalized
  // 3. Goal was NOT reached (refunds enabled)
  // 4. User has a deposit
  const canClaimRefund = escrowStatus && 
    hasEnded && 
    escrowStatus.finalized && 
    escrowStatus.refunds_enabled;

  const handleClaimRefund = async () => {
    if (!publicKey || !connected) {
      setError('Please connect your wallet');
      return;
    }

    setIsClaiming(true);
    setError(null);

    try {
      const result = await claimRefund(launchId, publicKey.toBase58());
      setClaimResult(result);
      
      if (!result.success && result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim refund');
    } finally {
      setIsClaiming(false);
    }
  };

  // If no escrow status found, don't render anything
  if (!escrowStatus) {
    return null;
  }

  // Sale not ended yet
  if (!hasEnded) {
    return (
      <div className={`bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] p-4 rounded ${className}`}>
        <div className="flex items-center gap-2 text-[#79767d]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[14px] font-rajdhani">Sale in progress...</span>
        </div>
        <div className="mt-2">
          <div className="flex justify-between text-[12px] font-rajdhani">
            <span className="text-[#656565]">Goal Progress</span>
            <span className="text-[#d08700] font-bold">
              {escrowStatus.goal_progress_percent.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-2 bg-[rgba(255,255,255,0.1)] rounded-full mt-1">
            <div 
              className="h-full bg-[#d08700] rounded-full transition-all"
              style={{ width: `${Math.min(100, escrowStatus.goal_progress_percent)}%` }}
            />
          </div>
          <p className="text-[11px] text-[#656565] font-rajdhani mt-1">
            ${escrowStatus.total_usd.toFixed(2)} / ${escrowStatus.min_goal_usd.toFixed(2)} raised
          </p>
        </div>
      </div>
    );
  }

  // Sale ended but not finalized yet
  if (!escrowStatus.finalized) {
    return (
      <div className={`bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] p-4 rounded ${className}`}>
        <div className="flex items-center gap-2 text-[#79767d]">
          <RefreshCw className="w-4 h-4" />
          <span className="text-[14px] font-rajdhani">Awaiting finalization...</span>
        </div>
        <p className="text-[12px] text-[#656565] font-rajdhani mt-2">
          The sale has ended. Results will be available shortly.
        </p>
      </div>
    );
  }

  // Goal was reached - no refunds
  if (escrowStatus.goal_reached) {
    return (
      <div className={`bg-[rgba(0,200,100,0.1)] border border-[rgba(0,200,100,0.3)] p-4 rounded ${className}`}>
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle className="w-4 h-4" />
          <span className="text-[14px] font-rajdhani font-bold">Sale Successful!</span>
        </div>
        <p className="text-[12px] text-[#79767d] font-rajdhani mt-2">
          The funding goal was reached. Use your ticket to claim tokens instead.
        </p>
      </div>
    );
  }

  // Refund already claimed
  if (claimResult?.success) {
    return (
      <div className={`bg-[rgba(0,200,100,0.1)] border border-[rgba(0,200,100,0.3)] p-4 rounded ${className}`}>
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle className="w-4 h-4" />
          <span className="text-[14px] font-rajdhani font-bold">Refund Claimed!</span>
        </div>
        <p className="text-[12px] text-[#79767d] font-rajdhani mt-2">
          ${claimResult.refund_amount_usd.toFixed(2)} refunded to {claimResult.sol_address.slice(0, 8)}...
        </p>
        {claimResult.tx_id && (
          <a 
            href={`https://solscan.io/tx/${claimResult.tx_id}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[#d08700] hover:underline font-rajdhani mt-1 block"
          >
            View transaction →
          </a>
        )}
      </div>
    );
  }

  // Can claim refund
  return (
    <div className={`bg-[rgba(221,51,69,0.1)] border border-[rgba(221,51,69,0.3)] p-4 rounded ${className}`}>
      <div className="flex items-center gap-2 text-[#dd3345] mb-3">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-[14px] font-rajdhani font-bold">Sale Did Not Reach Goal</span>
      </div>
      
      <div className="bg-[rgba(0,0,0,0.2)] p-3 rounded mb-3">
        <div className="flex justify-between text-[12px] font-rajdhani">
          <span className="text-[#656565]">Raised</span>
          <span className="text-white font-bold">${escrowStatus.total_usd.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[12px] font-rajdhani mt-1">
          <span className="text-[#656565]">Goal</span>
          <span className="text-[#dd3345] font-bold">${escrowStatus.min_goal_usd.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[12px] font-rajdhani mt-1">
          <span className="text-[#656565]">Progress</span>
          <span className="text-[#dd3345] font-bold">{escrowStatus.goal_progress_percent.toFixed(1)}%</span>
        </div>
      </div>

      <p className="text-[12px] text-[#79767d] font-rajdhani mb-3">
        Use your ticket (ZK proof) to claim a refund in SOL.
      </p>

      {error && (
        <div className="bg-[rgba(221,51,69,0.2)] border border-[#dd3345] p-2 rounded mb-3">
          <p className="text-[11px] text-[#dd3345] font-rajdhani">{error}</p>
        </div>
      )}

      <button
        onClick={handleClaimRefund}
        disabled={!connected || isClaiming}
        className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded font-rajdhani font-bold text-[14px] transition-all ${
          !connected
            ? 'bg-[rgba(255,255,255,0.1)] text-[#656565] cursor-not-allowed'
            : isClaiming
            ? 'bg-[#d08700] text-black cursor-wait'
            : 'bg-[#d08700] text-black hover:bg-[#e09800]'
        }`}
      >
        {isClaiming ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing Refund...
          </>
        ) : (
          <>
            <DollarSign className="w-4 h-4" />
            Claim Refund in SOL
          </>
        )}
      </button>

      {!connected && (
        <p className="text-[11px] text-[#656565] font-rajdhani mt-2 text-center">
          Connect your wallet to claim refund
        </p>
      )}
    </div>
  );
}
