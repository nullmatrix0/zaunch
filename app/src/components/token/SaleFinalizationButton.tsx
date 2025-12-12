'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { CheckCircle, Loader2, Flag, DollarSign, AlertTriangle } from 'lucide-react';
import { 
  finalizeSale, 
  getEscrowStatus,
  EscrowStatus, 
  FinalizeResult 
} from '@/lib/tee-client';

interface SaleFinalizationButtonProps {
  launchId: string;
  creatorAddress: string;
  saleEndTime: number;
  className?: string;
}

export default function SaleFinalizationButton({
  launchId,
  creatorAddress,
  saleEndTime,
  className = '',
}: SaleFinalizationButtonProps) {
  const { publicKey, connected } = useWallet();
  const [escrowStatus, setEscrowStatus] = useState<EscrowStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeResult, setFinalizeResult] = useState<FinalizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasEnded = Date.now() > saleEndTime * 1000;
  const isCreator = publicKey?.toBase58() === creatorAddress;

  // Fetch escrow status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setIsLoading(true);
        const status = await getEscrowStatus(launchId);
        setEscrowStatus(status);
        setError(null);
      } catch (err) {
        setEscrowStatus(null);
        setError(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
  }, [launchId]);

  const handleFinalize = async () => {
    if (!isCreator) {
      setError('Only the creator can finalize this sale');
      return;
    }

    setIsFinalizing(true);
    setError(null);

    try {
      const result = await finalizeSale(launchId);
      setFinalizeResult(result);
      
      // Refresh status
      const status = await getEscrowStatus(launchId);
      setEscrowStatus(status);
      
      if (!result.success && result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize sale');
    } finally {
      setIsFinalizing(false);
    }
  };

  // No escrow enabled
  if (!escrowStatus && !isLoading) {
    return null;
  }

  // Loading
  if (isLoading) {
    return null;
  }

  if (!escrowStatus) return null;

  // Not the creator
  if (!isCreator) {
    return null;
  }

  // Sale hasn't ended
  if (!hasEnded) {
    return (
      <div className={`bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] p-4 rounded ${className}`}>
        <div className="flex items-center gap-2 text-[#79767d]">
          <Flag className="w-4 h-4" />
          <span className="text-[14px] font-rajdhani font-bold">Finalization Available After Sale Ends</span>
        </div>
        <p className="text-[12px] text-[#656565] font-rajdhani mt-2">
          Once the sale ends, you can finalize it to:
        </p>
        <ul className="text-[11px] text-[#656565] font-rajdhani mt-1 pl-4 list-disc">
          <li>Receive funds if goal is met</li>
          <li>Enable refunds for buyers if goal is not met</li>
        </ul>
      </div>
    );
  }

  // Already finalized
  if (escrowStatus.finalized || finalizeResult?.success) {
    const result = finalizeResult || escrowStatus;
    const goalReached = result.goal_reached;

    return (
      <div className={`p-4 rounded ${className} ${
        goalReached 
          ? 'bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.3)]'
          : 'bg-[rgba(221,51,69,0.1)] border border-[rgba(221,51,69,0.3)]'
      }`}>
        <div className={`flex items-center gap-2 ${goalReached ? 'text-green-400' : 'text-[#dd3345]'}`}>
          <CheckCircle className="w-4 h-4" />
          <span className="text-[14px] font-rajdhani font-bold">Sale Finalized</span>
        </div>
        
        {goalReached ? (
          <div className="mt-3">
            <div className="flex items-center gap-2 text-green-400">
              <DollarSign className="w-4 h-4" />
              <span className="text-[14px] font-rajdhani">Funds Disbursed</span>
            </div>
            <p className="text-[12px] text-[#79767d] font-rajdhani mt-1">
              ${escrowStatus.total_usd.toFixed(2)} sent to your wallet as SOL
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <div className="flex items-center gap-2 text-[#dd3345]">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-[14px] font-rajdhani">Refunds Enabled</span>
            </div>
            <p className="text-[12px] text-[#79767d] font-rajdhani mt-1">
              Goal was not met. Buyers can claim refunds with their tickets.
            </p>
          </div>
        )}
      </div>
    );
  }

  // Can finalize
  return (
    <div className={`bg-[rgba(208,135,0,0.1)] border border-[rgba(208,135,0,0.3)] p-4 rounded ${className}`}>
      <div className="flex items-center gap-2 text-[#d08700] mb-3">
        <Flag className="w-4 h-4" />
        <span className="text-[14px] font-rajdhani font-bold">Finalize Sale</span>
      </div>
      
      <div className="bg-[rgba(0,0,0,0.2)] p-3 rounded mb-3">
        <div className="flex justify-between text-[12px] font-rajdhani">
          <span className="text-[#656565]">Total Raised</span>
          <span className="text-white font-bold">${escrowStatus.total_usd.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[12px] font-rajdhani mt-1">
          <span className="text-[#656565]">Goal</span>
          <span className="text-white font-bold">${escrowStatus.min_goal_usd.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[12px] font-rajdhani mt-1">
          <span className="text-[#656565]">Status</span>
          <span className={`font-bold ${
            escrowStatus.goal_progress_percent >= 100 ? 'text-green-400' : 'text-[#dd3345]'
          }`}>
            {escrowStatus.goal_progress_percent >= 100 ? 'Goal Reached ✓' : 'Goal Not Reached'}
          </span>
        </div>
      </div>

      <p className="text-[12px] text-[#79767d] font-rajdhani mb-3">
        {escrowStatus.goal_progress_percent >= 100 
          ? 'Finalize to receive funds as SOL.'
          : 'Finalize to enable refunds for buyers.'}
      </p>

      {error && (
        <div className="bg-[rgba(221,51,69,0.2)] border border-[#dd3345] p-2 rounded mb-3">
          <p className="text-[11px] text-[#dd3345] font-rajdhani">{error}</p>
        </div>
      )}

      <button
        onClick={handleFinalize}
        disabled={isFinalizing}
        className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded font-rajdhani font-bold text-[14px] transition-all ${
          isFinalizing
            ? 'bg-[#d08700] text-black cursor-wait'
            : 'bg-[#d08700] text-black hover:bg-[#e09800]'
        }`}
      >
        {isFinalizing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Finalizing...
          </>
        ) : (
          <>
            <Flag className="w-4 h-4" />
            Finalize Sale
          </>
        )}
      </button>
    </div>
  );
}
