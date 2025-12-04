'use client';

import { useState, useRef, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, TransactionInstruction, AccountMeta } from '@solana/web3.js';
import { Loader2, Ticket, AlertCircle, CheckCircle2, Upload, FileCheck, X, Wallet } from 'lucide-react';
import { Token } from '@/types/token';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { loadProofFromZip, validateProofZip, getProofSummary } from '@/lib/tee-client';
import { createClaimTransactionCompact, createCreatorRefundTransaction } from '@/lib/solana-claim';
import { toast } from 'sonner';
import { getTicketsByLaunch, updateTicketStatus } from '@/lib/ticket-storage';
import JSZip from 'jszip';

const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!);

interface UserClaimButtonProps {
  token: Token;
  launchAddress: string;
}

type ProofType = 'user_claim' | 'creator_refund';

interface UserProofData {
  type: 'user_claim';
  proof: number[];
  publicInputs: number[];
  compactProof: number[];
  metadata: {
    proofReference: string;
    claimAmount: string;
    depositAddress: string;
    launchPda: string;
    tokenSymbol: string;
  };
}

interface CreatorRefundData {
  type: 'creator_refund';
  metadata: {
    refundReference: string;
    launchId: string;
    launchPda: string;
    creatorAddress: string;
    refundableAmount: string;
    totalSold: string;
    totalProofs: number;
    amountToSell: string;
    timestamp: string;
  };
}

type ProofData = UserProofData | CreatorRefundData;

export function UserClaimButton({ token, launchAddress }: UserClaimButtonProps) {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [proofData, setProofData] = useState<ProofData | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // Check if sale has ended
  const saleEnded = Date.now() / 1000 > Number(token.endTime);
  
  // Check if current user is the creator
  const isCreator = publicKey?.toBase58() === token.creator;
  
  // Check if user has tickets for this launch
  const userTickets = getTicketsByLaunch(launchAddress);
  const hasTickets = userTickets.length > 0;
  const pendingTickets = userTickets.filter(t => t.status === 'pending').length;

  const formatTokens = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return (num / Math.pow(10, token.decimals)).toLocaleString('en-US', { maximumFractionDigits: 4 });
  };

  // Detect proof type from ZIP metadata
  const detectProofType = async (file: File): Promise<{ type: ProofType; metadata: Record<string, unknown> }> => {
    const zip = await JSZip.loadAsync(file);
    const metadataFile = zip.file('metadata.json');
    
    if (!metadataFile) {
      throw new Error('Invalid proof file: missing metadata.json');
    }
    
    const metadataStr = await metadataFile.async('string');
    const metadata = JSON.parse(metadataStr);
    
    // Check for type field or infer from structure
    if (metadata.type === 'creator_refund' || metadata.refundReference) {
      return { type: 'creator_refund', metadata };
    }
    
    return { type: 'user_claim', metadata };
  };

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setProofData(null);
    setFileName(file.name);

    try {
      // Detect proof type first
      const { type, metadata } = await detectProofType(file);
      console.log('[ClaimButton] Detected proof type:', type);
      
      if (type === 'creator_refund') {
        // Handle creator refund proof
        if (metadata.launchPda !== launchAddress) {
          throw new Error('This refund proof is for a different launch.');
        }
        
        // Verify user is the creator
        if (!isCreator) {
          throw new Error('Only the launch creator can use refund proofs.');
        }
        
        setProofData({
          type: 'creator_refund',
          metadata: {
            refundReference: metadata.refundReference as string,
            launchId: metadata.launchId as string,
            launchPda: metadata.launchPda as string,
            creatorAddress: metadata.creatorAddress as string,
            refundableAmount: metadata.refundableAmount as string,
            totalSold: metadata.totalSold as string,
            totalProofs: metadata.totalProofs as number,
            amountToSell: metadata.amountToSell as string,
            timestamp: metadata.timestamp as string,
          },
        });
        
        console.log('[ClaimButton] Creator refund proof loaded:', metadata.refundReference);
        
      } else {
        // Handle user claim proof
        const validation = await validateProofZip(file);
        if (!validation.valid) {
          throw new Error(validation.error || 'Invalid proof ZIP file.');
        }

        const proof = await loadProofFromZip(file);
        
        if (proof.metadata.launchPda !== launchAddress) {
          throw new Error('This proof is for a different launch.');
        }

        setProofData({
          type: 'user_claim',
          proof: Array.from(proof.proof),
          publicInputs: Array.from(proof.publicInputs),
          compactProof: Array.from(proof.compactProof),
          metadata: {
            proofReference: proof.metadata.proofReference,
            claimAmount: proof.metadata.claimAmount,
            depositAddress: proof.metadata.depositAddress,
            launchPda: proof.metadata.launchPda,
            tokenSymbol: proof.metadata.tokenSymbol,
          },
        });

        console.log('[ClaimButton] User proof loaded:', proof.metadata.proofReference);
      }

    } catch (err) {
      console.error('Error loading proof:', err);
      setError(err instanceof Error ? err.message : 'Failed to load proof file');
      setFileName(null);
    } finally {
      setLoading(false);
    }
  }, [launchAddress, isCreator]);

  const handleClaim = useCallback(async () => {
    if (!proofData || !publicKey || !connected) {
      toast.error('Please connect your wallet and upload a valid proof');
      return;
    }

    setClaiming(true);
    setError(null);

    try {
      let transaction: Transaction;
      let claimAmount: number;
      let reference: string;
      
      if (proofData.type === 'creator_refund') {
        // Creator refund claim
        console.log('[Claim] Starting creator refund:', proofData.metadata.refundReference);
        console.log('[Claim] Raw refundable amount:', proofData.metadata.refundableAmount, typeof proofData.metadata.refundableAmount);
        
        // Handle both string and number types
        const rawAmount = proofData.metadata.refundableAmount;
        claimAmount = typeof rawAmount === 'string' ? parseInt(rawAmount, 10) : Number(rawAmount);
        reference = proofData.metadata.refundReference;
        
        console.log('[Claim] Parsed claimAmount:', claimAmount, 'isNaN:', isNaN(claimAmount));
        
        if (isNaN(claimAmount) || claimAmount <= 0) {
          throw new Error(`Invalid refundable amount: ${rawAmount}`);
        }
        
        const launchPda = new PublicKey(launchAddress);
        const tokenMint = new PublicKey(token.tokenMint);
        
        console.log('[Claim] Creating creator refund transaction...');
        
        transaction = await createCreatorRefundTransaction(
          connection,
          PROGRAM_ID,
          publicKey,
          launchPda,
          tokenMint,
          BigInt(claimAmount)
        );
        
        console.log('[Claim] Transaction created successfully');
        
      } else {
        // User claim
        console.log('[Claim] Starting user claim:', proofData.metadata.proofReference);
        console.log('[Claim] Claim amount:', proofData.metadata.claimAmount);
        
        const launchPda = new PublicKey(launchAddress);
        const tokenMint = new PublicKey(token.tokenMint);
        claimAmount = parseInt(proofData.metadata.claimAmount, 10);
        reference = proofData.metadata.proofReference;
        
        const compactProofArray = new Uint8Array(proofData.compactProof);
        
        transaction = await createClaimTransactionCompact(
          connection,
          PROGRAM_ID,
          publicKey,
          launchPda,
          tokenMint,
          compactProofArray,
          claimAmount,
          proofData.metadata.depositAddress
        );
      }

      console.log('[Claim] Preparing transaction...');
      
      // Set transaction properties (same as deploy token)
      transaction.feePayer = publicKey;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      
      // Log transaction details for debugging
      console.log('[Claim] Transaction details:', {
        feePayer: publicKey.toBase58(),
        blockhash,
        instructionCount: transaction.instructions.length,
      });
      
      // Log each instruction for debugging
      transaction.instructions.forEach((ix: TransactionInstruction, i: number) => {
        console.log(`[Claim] Instruction ${i}:`, {
          programId: ix.programId.toBase58(),
          keys: ix.keys.map((k: AccountMeta) => ({
            pubkey: k.pubkey.toBase58(),
            isSigner: k.isSigner,
            isWritable: k.isWritable,
          })),
          dataLength: ix.data.length,
          dataHex: Buffer.from(ix.data).toString('hex').slice(0, 50) + '...',
        });
      });
      
      console.log('[Claim] Sending transaction...');
      
      // Send transaction - use same options as deploy for wallet compatibility
      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: true,  // Skip preflight for better wallet compatibility
        maxRetries: 3,
      });
      console.log('[Claim] Transaction sent:', signature);

      // Wait for confirmation - use same pattern as deploy
      console.log('[Claim] Waiting for confirmation...');
      
      try {
        const confirmation = await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          'processed'  // Use 'processed' like deploy for faster confirmation
        );
        
        if (confirmation.value.err) {
          const txError = JSON.stringify(confirmation.value.err);
          console.error('[Claim] Transaction error:', txError);
          
          // Parse common error codes
          if (txError.includes('101') || txError.includes('Custom(101)')) {
            throw new Error('This proof has already been used to claim tokens!');
          } else if (txError.includes('102') || txError.includes('Custom(102)')) {
            throw new Error('This deposit address has already been used!');
          } else if (txError.includes('InsufficientTokens') || txError.includes('Custom(5)')) {
            throw new Error('Insufficient tokens in vault - creator may have claimed unsold tokens');
          } else if (txError.includes('LaunchInactive') || txError.includes('Custom(1)')) {
            throw new Error('Launch is no longer active');
          } else {
            throw new Error(`Transaction failed: ${txError}`);
          }
        }
        
        console.log('[Claim] Transaction confirmed!');
      } catch (confirmError: unknown) {
        // If confirmation times out, check transaction status
        console.log('[Claim] Confirmation timeout, checking status...');
        
        const status = await connection.getSignatureStatus(signature, {
          searchTransactionHistory: true,
        });
        
        if (status.value?.err) {
          const txError = JSON.stringify(status.value.err);
          if (txError.includes('101') || txError.includes('Custom(101)')) {
            throw new Error('This proof has already been used to claim tokens!');
          } else if (txError.includes('102') || txError.includes('Custom(102)')) {
            throw new Error('This deposit address has already been used!');
          } else {
            throw new Error(`Transaction failed: ${txError}`);
          }
        } else if (status.value?.confirmationStatus) {
          console.log('[Claim] Transaction status:', status.value.confirmationStatus);
        } else {
          // Transaction might still be processing
          console.log('[Claim] Transaction sent. Check explorer:', signature);
          toast.info(`Transaction sent! Signature: ${signature.slice(0, 8)}...`);
        }
      }

      // Update ticket status in localStorage (only for user claims)
      if (proofData.type === 'user_claim') {
        updateTicketStatus(reference, 'claimed');
      }

      const claimType = proofData.type === 'creator_refund' ? 'Refunded' : 'Claimed';
      setSuccess(`Successfully ${claimType.toLowerCase()} ${formatTokens(claimAmount)} ${token.tokenSymbol}!`);
      toast.success(`${claimType} tokens successfully!`);
      
      setProofData(null);
      setFileName(null);

    } catch (err) {
      console.error('[Claim] Error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to claim tokens';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setClaiming(false);
    }
  }, [proofData, publicKey, connected, launchAddress, token, sendTransaction, connection]);

  const handleClearProof = () => {
    setProofData(null);
    setFileName(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-neutral-950 border border-gray-800 p-3 sm:p-4 md:p-5 w-full">
        <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Ticket className="w-4 h-4 sm:w-5 sm:h-5 text-[#d08700]" />
          <h3 className="font-rajdhani font-bold text-base sm:text-lg text-white">
            Claim Tokens
          </h3>
          <InfoTooltip
            title="Claim Your Tokens"
            content="Upload your downloaded proof ZIP file to claim tokens. For users: upload your ZK proof ticket. For creators: upload your refund proof to claim unsold tokens."
          />
        </div>
        {hasTickets && (
          <div className="bg-[rgba(208,135,0,0.15)] border border-[rgba(208,135,0,0.3)] px-2 py-1 rounded">
            <span className="font-rajdhani text-xs text-[#d08700]">
              {pendingTickets} pending
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {/* Status Info */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Claim Status:</span>
            <span className={saleEnded ? 'text-green-400' : 'text-yellow-400'}>
              {saleEnded ? 'Claims Open' : 'Waiting for Sale End'}
            </span>
          </div>
          {hasTickets && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">Your Tickets:</span>
              <span className="text-white font-semibold">{userTickets.length}</span>
            </div>
          )}
        </div>

        {/* File Upload Area */}
        {saleEnded && !proofData && (
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileSelect}
              disabled={loading || !connected}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className={`
              border-2 border-dashed rounded-lg p-4 sm:p-6 text-center transition-colors
              ${connected 
                ? 'border-gray-600 hover:border-[#d08700] hover:bg-[rgba(208,135,0,0.05)]' 
                : 'border-gray-700 bg-gray-800/30'
              }
            `}>
              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 text-[#d08700] animate-spin" />
                  <span className="text-gray-400 text-sm">Loading proof...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-6 h-6 text-gray-400" />
                  <span className="text-gray-300 text-sm font-rajdhani">
                    {connected ? 'Drop your proof ZIP here or click to browse' : 'Connect wallet to upload proof'}
                  </span>
                  <span className="text-gray-500 text-xs">
                    .zip files only
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loaded Proof Preview */}
        {proofData && (
          <div className={`border rounded-lg p-3 sm:p-4 ${
            proofData.type === 'creator_refund' 
              ? 'bg-[rgba(168,85,247,0.1)] border-purple-500/30' 
              : 'bg-[rgba(34,197,94,0.1)] border-green-500/30'
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {proofData.type === 'creator_refund' ? (
                  <Wallet className="w-5 h-5 text-purple-400 shrink-0" />
                ) : (
                  <FileCheck className="w-5 h-5 text-green-500 shrink-0" />
                )}
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${
                      proofData.type === 'creator_refund' ? 'text-purple-400' : 'text-green-400'
                    }`}>
                      {fileName}
                    </span>
                    {proofData.type === 'creator_refund' && (
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">
                        CREATOR REFUND
                      </span>
                    )}
                  </div>
                  <span className="text-gray-400 text-xs">
                    {proofData.type === 'creator_refund' 
                      ? `Refund: ${formatTokens(proofData.metadata.refundableAmount)} ${token.tokenSymbol}`
                      : `Claim: ${formatTokens(proofData.metadata.claimAmount)} ${token.tokenSymbol}`
                    }
                  </span>
                  {proofData.type === 'creator_refund' && (
                    <span className="text-gray-500 text-[10px]">
                      Total Sold: {formatTokens(proofData.metadata.totalSold)} • Proofs: {proofData.metadata.totalProofs}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={handleClearProof}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Claim Button */}
        {saleEnded && proofData && (
          <button
            onClick={handleClaim}
            disabled={claiming || !connected}
            className={`
              w-full py-2.5 sm:py-3 px-4 font-rajdhani font-bold text-sm sm:text-base
              flex items-center justify-center gap-2 transition-all
              ${connected
                ? proofData.type === 'creator_refund'
                  ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                  : 'bg-[#d08700] hover:bg-[#b87600] text-black cursor-pointer'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            {claiming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {proofData.type === 'creator_refund' ? 'Refunding...' : 'Claiming...'}
              </>
            ) : proofData.type === 'creator_refund' ? (
              `Refund ${formatTokens(proofData.metadata.refundableAmount)} ${token.tokenSymbol}`
            ) : (
              `Claim ${formatTokens(proofData.metadata.claimAmount)} ${token.tokenSymbol}`
            )}
          </button>
        )}

        {/* Sale Not Ended Message */}
        {!saleEnded && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 sm:p-4 text-center">
            <span className="text-gray-400 text-sm">
              Claims will open after sale ends on{' '}
              <span className="text-white font-semibold">
                {new Date(Number(token.endTime) * 1000).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-start gap-2 text-red-400 text-xs sm:text-sm bg-red-500/10 border border-red-500/30 rounded p-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="flex items-center gap-2 text-green-400 text-xs sm:text-sm bg-green-500/10 border border-green-500/30 rounded p-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Help Text */}
        {saleEnded && !proofData && connected && (
          <p className="text-gray-500 text-[10px] sm:text-xs text-center">
            {isCreator 
              ? 'Upload your ticket proof or refund proof (from Creator Actions) to claim tokens.'
              : 'Upload the ZIP file you downloaded when generating your ticket.'
            }
          </p>
        )}
      </div>
    </div>
  );
}

