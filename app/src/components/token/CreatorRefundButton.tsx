'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Loader2, Wallet, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { Token } from '@/types/token';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import {
  generateCreatorRefundProof,
  downloadCreatorRefundProof,
  CreatorRefundResult,
  checkRefundStatus,
} from '@/lib/tee-client';

interface CreatorRefundButtonProps {
  token: Token;
  launchAddress: string;
}

export function CreatorRefundButton({ token, launchAddress }: CreatorRefundButtonProps) {
  console.log('token', token);
  const { publicKey, connected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refundResult, setRefundResult] = useState<CreatorRefundResult | null>(null);

  // Track if refund proof was already generated (from TEE)
  const [refundAlreadyGenerated, setRefundAlreadyGenerated] = useState(false);
  const [refundReference, setRefundReference] = useState<string | null>(null);
  const [checkingRefundStatus, setCheckingRefundStatus] = useState(true);

  // Check if current user is the creator
  const isCreator = connected && publicKey?.toBase58() === token.creator;

  // Check if sale has ended
  const saleEnded = Date.now() / 1000 > Number(token.endTime);

  // Calculate unsold tokens
  const amountToSell = Number(token.amountToSell);
  const totalClaimed = Number(token.totalClaimed);
  const unsoldTokens = amountToSell - totalClaimed;
  const hasUnsoldTokens = unsoldTokens > 0;

  // Check if creator has already claimed unsold tokens on-chain
  // Contract sets creator_refunded = true after claiming (is_active stays true for user claims)
  const hasClaimedUnsoldOnChain = token.creatorRefunded;

  // Check refund status from TEE on load
  useEffect(() => {
    const checkStatus = async () => {
      if (!token.name) return;

      try {
        setCheckingRefundStatus(true);
        const status = await checkRefundStatus(token.name);
        setRefundAlreadyGenerated(status.refundGenerated);
        setRefundReference(status.refundReference);
      } catch (err) {
        console.error('[RefundStatus] Error checking:', err);
      } finally {
        setCheckingRefundStatus(false);
      }
    };

    checkStatus();
  }, [token.name]);

  // Don't render if not creator
  if (!isCreator) {
    return null;
  }

  const handleGenerateRefundProof = async () => {
    if (!publicKey || !saleEnded || !hasUnsoldTokens) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Generate refund proof from TEE with encryption
      const result = await generateCreatorRefundProof({
        launchId: token.name,
        launchPda: launchAddress,
        creatorAddress: token.creatorWallet || '',
        amountToSell: amountToSell.toString(),
        userPubkey: publicKey.toBase58(),
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setRefundResult(result);
      setRefundAlreadyGenerated(true);
      setRefundReference(result.refund_reference);

      console.log('Refund proof generated:', result);

      // Auto-download the proof immediately after generation
      try {
        await downloadCreatorRefundProof(result);
        setSuccess(
          `Refund proof generated and downloaded! Refundable: ${formatTokens(Number(result.refundable_amount))} ${token.tokenSymbol}`,
        );
      } catch (downloadErr) {
        console.error('Auto-download failed:', downloadErr);
        setSuccess(`Refund proof generated! Click download below to save your proof.`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate refund proof');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadRefundProof = async () => {
    if (!refundResult) return;

    try {
      await downloadCreatorRefundProof(refundResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to download proof');
    }
  };

  const formatTokens = (amount: number) => {
    return (amount / Math.pow(10, token.decimals)).toLocaleString('en-US', {
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="bg-neutral-950 border border-gray-800 p-3 sm:p-4 md:p-5 w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-[#d08700]" />
          <h3 className="font-rajdhani font-bold text-base sm:text-lg text-white">
            Creator Actions
          </h3>
          <InfoTooltip
            title="Creator Refund"
            content="As the launch creator, you can claim unsold tokens after the sale ends. The TEE verifies the exact amount of unbought tokens to ensure fairness."
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* Status Info */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Sale Status:</span>
            <span className={saleEnded ? 'text-green-400' : 'text-yellow-400'}>
              {saleEnded ? 'Ended' : 'Active'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Unsold:</span>
            <span
              className={
                hasClaimedUnsoldOnChain
                  ? 'text-green-400 font-semibold'
                  : 'text-white font-semibold'
              }
            >
              {hasClaimedUnsoldOnChain
                ? 'Claimed ✓'
                : `${formatTokens(unsoldTokens)} ${token.tokenSymbol}`}
            </span>
          </div>
        </div>

        {/* Refund Buttons */}
        {checkingRefundStatus ? (
          // Loading state while checking TEE
          <button
            disabled
            className="w-full py-2.5 sm:py-3 px-4 font-rajdhani font-bold text-sm sm:text-base
              flex items-center justify-center gap-2 bg-gray-700 text-gray-400 cursor-not-allowed"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking refund status...
          </button>
        ) : hasClaimedUnsoldOnChain ? (
          // Already claimed on-chain - show disabled state
          <div className="flex flex-col gap-2">
            <button
              disabled
              className="w-full py-2.5 sm:py-3 px-4 font-rajdhani font-bold text-sm sm:text-base
                flex items-center justify-center gap-2 bg-green-900/30 border border-green-500/30 
                text-green-400 cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" />
              Unsold Tokens Claimed
            </button>
            <p className="text-green-400/70 text-xs text-center">
              You have successfully claimed your unsold tokens
            </p>
          </div>
        ) : refundAlreadyGenerated ? (
          // Refund proof already generated but not yet claimed on-chain
          <div className="flex flex-col gap-2">
            <div
              className="w-full py-2.5 sm:py-3 px-4 font-rajdhani font-bold text-sm sm:text-base
              flex items-center justify-center gap-2 bg-yellow-900/30 border border-yellow-500/30 
              text-yellow-400 rounded"
            >
              <AlertCircle className="w-4 h-4" />
              Refund Proof Already Generated
            </div>
            <div className="bg-yellow-900/10 border border-yellow-500/20 rounded p-3 text-xs">
              <p className="text-yellow-400 font-semibold mb-1">
                Reference: <span className="font-mono">{refundReference || 'N/A'}</span>
              </p>
              <p className="text-yellow-400/70">
                Use the proof ZIP you previously downloaded to claim your tokens in the "Claim
                Tokens" section below.
              </p>
              <p className="text-yellow-400/50 mt-2 text-[10px]">
                ⚠️ If you lost the proof file, contact support with your reference ID. For security,
                proofs can only be generated once.
              </p>
            </div>
          </div>
        ) : !refundResult ? (
          <button
            onClick={handleGenerateRefundProof}
            disabled={loading || !saleEnded || !hasUnsoldTokens}
            className={`
              w-full py-2.5 sm:py-3 px-4 font-rajdhani font-bold text-sm sm:text-base
              flex items-center justify-center gap-2 transition-all
              ${
                saleEnded && hasUnsoldTokens
                  ? 'bg-[#d08700] hover:bg-[#b87600] text-black cursor-pointer'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Proof...
              </>
            ) : !saleEnded ? (
              'Sale Not Ended Yet'
            ) : !hasUnsoldTokens ? (
              'All Tokens Sold'
            ) : (
              `Generate Refund Proof (${formatTokens(unsoldTokens)} ${token.tokenSymbol})`
            )}
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              onClick={handleDownloadRefundProof}
              className="w-full py-2.5 sm:py-3 px-4 font-rajdhani font-bold text-sm sm:text-base
                flex items-center justify-center gap-2 transition-all
                bg-[#d08700] hover:bg-[#b87600] text-black cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download Refund Proof
            </button>
            <p className="text-gray-400 text-xs text-center">
              Upload this proof to the "Claim Tokens" section below to claim your unsold tokens
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="flex items-center gap-2 text-green-400 text-xs sm:text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Info Note */}
        {!saleEnded && !hasClaimedUnsoldOnChain && (
          <p className="text-gray-500 text-[10px] sm:text-xs">
            You can claim unsold tokens after the sale ends on{' '}
            {new Date(Number(token.endTime) * 1000).toLocaleDateString()}.
          </p>
        )}
      </div>
    </div>
  );
}
