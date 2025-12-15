'use client';

import { useState, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { Loader2, Upload, CheckCircle2, AlertCircle, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { Token } from '@/types/token';
import { getRpcSOLEndpoint } from '@/lib/sol';
import { 
  loadProofFromZip, 
  validateProofZip, 
  getProofSummary,
  getClaimAmountFromProof,
  ProofZipData,
  processTicket,
  ProcessTicketResult,
} from '@/lib/tee-client';
import { LAUNCH_PROGRAM_ID } from '@/configs/env.config';

interface ClaimProofProps {
  token: Token;
  launchAddress: string;
  onClaimSuccess?: () => void;
}

const PROGRAM_ID = new PublicKey(LAUNCH_PROGRAM_ID);

export function ClaimProof({ token, launchAddress, onClaimSuccess }: ClaimProofProps) {
  const { publicKey, sendTransaction, connected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [processingTicket, setProcessingTicket] = useState(false);
  const [ticketResult, setTicketResult] = useState<ProcessTicketResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proofData, setProofData] = useState<ProofZipData | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if sale has ended (claims allowed)
  const saleEnded = Date.now() / 1000 > Number(token.endTime);

  const handleFileSelect = useCallback(async (file: File) => {
    setValidating(true);
    setError(null);
    setProofData(null);
    setProofFile(file);

    try {
      // Validate the proof ZIP
      const validation = await validateProofZip(file);
      
      if (!validation.valid) {
        setError(validation.error || 'Invalid proof file');
        setProofFile(null);
        return;
      }

      // Verify the proof is for this launch
      if (validation.metadata?.launchPda !== launchAddress) {
        setError('This proof is for a different launch');
        setProofFile(null);
        return;
      }

      // Load full proof data
      const data = await loadProofFromZip(file);
      setProofData(data);
      
      toast.success('Proof validated successfully!');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to validate proof');
      setProofFile(null);
    } finally {
      setValidating(false);
    }
  }, [launchAddress]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.zip')) {
      handleFileSelect(file);
    } else {
      setError('Please upload a .zip file');
    }
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const clearProof = useCallback(() => {
    setProofData(null);
    setProofFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleClaim = useCallback(async () => {
    if (!proofData || !publicKey || !connected) {
      toast.error('Please connect wallet and upload a valid proof');
      return;
    }

    if (!saleEnded) {
      toast.error('Sale has not ended yet');
      return;
    }

    setProcessingTicket(true);
    setError(null);
    setTicketResult(null);

    try {
      // Get claim amount from proof (TEE-calculated)
      const claimAmount = getClaimAmountFromProof(proofData);
      
      console.log('[ClaimProof] Processing ticket with metadata:', proofData.metadata);
      
      // Step 1: Call processTicket to check sale status and route accordingly
      const result = await processTicket({
        launchPda: proofData.metadata.launchPda,
        launchId: proofData.metadata.launchId,
        userPubkey: proofData.metadata.userPubkey,
        userSolanaWallet: publicKey.toBase58(),
        depositAddress: proofData.metadata.depositAddress,
        escrowZAddress: proofData.metadata.escrowZAddress || '',
        claimAmount: Number(claimAmount),
      });
      
      console.log('[ClaimProof] Process ticket result:', result);
      setTicketResult(result);
      
      if (!result.success) {
        setError(result.error || result.message);
        toast.error(result.message);
        setProcessingTicket(false);
        return;
      }
      
      // Step 2: Route based on sale outcome
      if (result.action === 'claim_tokens') {
        // Sale succeeded - proceed with Solana claim
        toast.info('Sale succeeded! Claiming your tokens...');
        setProcessingTicket(false);
        setLoading(true);
        
        const connection = new Connection(getRpcSOLEndpoint(), 'confirmed');
        const launchPda = new PublicKey(launchAddress);
        const tokenMint = new PublicKey(token.tokenMint);
        
        console.log('Claiming tokens:', {
          launchPda: launchPda.toBase58(),
          tokenMint: tokenMint.toBase58(),
          claimAmount: claimAmount.toString(),
          depositAddress: proofData.metadata.depositAddress,
        });

        // Import the createClaimTransactionCompact function dynamically
        const { createClaimTransactionCompact } = await import('@/lib/solana-claim');
        
        const transaction = await createClaimTransactionCompact(
          connection,
          PROGRAM_ID,
          publicKey,
          launchPda,
          tokenMint,
          proofData.compactProof,
          Number(claimAmount),
          proofData.metadata.depositAddress,
          'swap_circuit_v15'
        );

        // Get latest blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        // Send transaction
        const signature = await sendTransaction(transaction, connection);
        
        // Confirm transaction
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        });

        toast.success('Tokens claimed successfully!');
        console.log('Claim transaction:', signature);
        
        clearProof();
        onClaimSuccess?.();
        
      } else if (result.action === 'refund_initiated') {
        // Sale failed - refund is being processed by TEE
        toast.success('Refund initiated! ZEC is being swapped to SOL for your wallet.');
        console.log('[ClaimProof] Refund details:', {
          oneclickDepositAddress: result.oneclickDepositAddress,
          refundAmount: result.refundAmountZatoshis,
          userWallet: result.userSolWallet,
        });
        // Keep ticketResult to show refund UI
        
      } else if (result.action === 'wait') {
        // Sale still active or pending
        toast.info(result.message);
      }

    } catch (err: unknown) {
      console.error('Claim error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to process ticket';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setProcessingTicket(false);
      setLoading(false);
    }
  }, [proofData, publicKey, connected, saleEnded, launchAddress, token.tokenMint, sendTransaction, clearProof, onClaimSuccess]);

  const summary = proofData ? getProofSummary(proofData) : null;

  if (!saleEnded) {
    return (
      <div className="bg-neutral-950 border border-gray-800 p-4 sm:p-5 w-full">
        <div className="flex items-center gap-2 text-yellow-400">
          <AlertCircle className="w-5 h-5" />
          <span className="font-rajdhani font-medium">
            Claims open after {new Date(Number(token.endTime) * 1000).toLocaleString()}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-950 border border-gray-800 p-4 sm:p-5 w-full">
      <h3 className="font-rajdhani font-bold text-lg sm:text-xl text-white mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5 text-[#d08700]" />
        Claim Your Tokens
      </h3>

      {!proofData ? (
        // Upload Zone
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={`
            border-2 border-dashed rounded-lg p-6 sm:p-8 text-center transition-colors
            ${validating ? 'border-yellow-500 bg-yellow-500/5' : 'border-gray-600 hover:border-[#d08700] hover:bg-[#d08700]/5'}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleInputChange}
            className="hidden"
          />
          
          {validating ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
              <p className="text-yellow-500 font-rajdhani">Validating proof...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-gray-400" />
              <p className="text-gray-400 font-rajdhani">
                Drag & drop your proof ZIP file here, or{' '}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[#d08700] hover:underline"
                >
                  browse
                </button>
              </p>
              <p className="text-gray-500 text-sm">Accepts .zip files only</p>
            </div>
          )}
        </div>
      ) : (
        // Proof Summary & Claim
        <div className="flex flex-col gap-4">
          {/* Proof File Info */}
          <div className="flex items-center justify-between bg-[#d08700]/10 border border-[#d08700]/30 rounded p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="font-mono text-sm text-gray-300">{proofFile?.name}</span>
            </div>
            <button onClick={clearProof} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Summary */}
          {summary && (
            <div className="bg-black/30 border border-gray-700 rounded p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Tokens to Claim</span>
                <span className="text-[#d08700] font-bold text-lg">
                  {summary.claimAmountFormatted} {summary.tokenSymbol}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Original Payment</span>
                <span className="text-white">${summary.swapAmountUsd}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Proof Reference</span>
                <span className="text-gray-300 font-mono text-xs">{summary.proofReference}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Created</span>
                <span className="text-gray-300 text-xs">
                  {new Date(summary.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Refund Result UI */}
          {ticketResult && ticketResult.action === 'refund_initiated' && (
            <div className="bg-green-900/20 border border-green-600/50 rounded p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-400 font-medium">
                <CheckCircle2 className="w-5 h-5" />
                <span>Refund Initiated!</span>
              </div>
              <p className="text-sm text-gray-300">
                The sale did not meet its minimum goal. Your ZEC is being swapped to SOL via 1Click.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Raised</span>
                  <span className="text-white">${ticketResult.totalRaisedUsd?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Goal</span>
                  <span className="text-white">${ticketResult.minGoalUsd?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Refund To</span>
                  <span className="text-gray-300 font-mono text-xs truncate max-w-[200px]">
                    {ticketResult.userSolWallet}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {ticketResult.nextStep || 'SOL will be deposited to your wallet shortly.'}
              </p>
            </div>
          )}

          {/* Claim Button */}
          {(!ticketResult || ticketResult.action !== 'refund_initiated') && (
            <button
              onClick={handleClaim}
              disabled={loading || processingTicket || !connected}
              className={`
                w-full py-3 px-4 font-rajdhani font-bold text-base
                flex items-center justify-center gap-2 transition-all rounded
                ${connected && !loading && !processingTicket
                  ? 'bg-[#d08700] hover:bg-[#b87600] text-black cursor-pointer'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              {processingTicket ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking sale status...
                </>
              ) : loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Claiming...
                </>
              ) : !connected ? (
                'Connect Wallet to Claim'
              ) : (
                `Claim ${summary?.claimAmountFormatted || ''} ${token.tokenSymbol}`
              )}
            </button>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm mt-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

