/**
 * TEE Client for browser - handles encrypted communication with Phala TEE
 * Uses X25519 for key exchange and ChaCha20-Poly1305 for encryption
 * Includes functions for:
 * - Generating proofs from TEE
 * - Downloading proofs as ZIP
 * - Loading/validating proofs from ZIP (for claims)
 * - Creator refund proof generation
 */

import JSZip from 'jszip';
import { x25519 } from '@noble/curves/ed25519.js';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/ciphers/utils.js';

const TEE_ENDPOINT = process.env.NEXT_PUBLIC_TEE_ENDPOINT || 
  'https://66a817b166c0b222ae386af54c178986e90beb0a-3000.dstack-pha-prod7.phala.network';

// TEE Response interfaces
export interface TEEProofResult {
  proof: number[];
  public_inputs: number[];
  compact_proof: number[];
  verification: {
    verified: boolean;
    swap_status: string;
    recipient_verified: boolean;
    asset_verified: boolean;
    error?: string;
  };
  metadata: {
    proofReference: string;
    userPubkey: string;
    depositAddress: string;
    swapAmountIn: string;
    swapAmountUsd: string;
    swapTokenSymbol: string;
    claimAmount: string;
    launchId: string;
    launchPda: string;
    tokenMint: string;
    tokenSymbol: string;
    pricePerToken: string;
    creatorWallet: string;
    createdAt: string;
    swapTimestamp: number;
  };
  error?: string;
}

export interface ProofZipMetadata {
  userPubkey: string;
  depositAddress: string;
  swapAmountIn: string;
  swapAmountUsd: string;
  swapTokenSymbol: string;
  claimAmount: string;
  launchId: string;
  launchPda: string;
  tokenMint: string;
  tokenSymbol: string;
  pricePerToken: string;
  creatorWallet: string;
  proofReference: string;
  createdAt: string;
  swapTimestamp: number;
}

// Helper: Convert hex to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Helper: Convert Uint8Array to hex
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Derive encryption key using SHA256 (matches TEE's derive_key function)
function deriveKey(sharedSecret: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const suffix = encoder.encode('tee-proof-generator-key-v1');
  const combined = new Uint8Array(sharedSecret.length + suffix.length);
  combined.set(sharedSecret);
  combined.set(suffix, sharedSecret.length);
  return sha256(combined);
}

// Generate X25519 key pair
function generateKeyPair(): { publicKey: Uint8Array; privateKey: Uint8Array } {
  const privateKey = randomBytes(32);
  const publicKey = x25519.getPublicKey(privateKey);
  return { publicKey, privateKey };
}

// Derive shared secret using X25519
function deriveSharedSecret(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  return x25519.getSharedSecret(privateKey, publicKey);
}

// Encrypt data using ChaCha20-Poly1305
function encryptChaCha(key: Uint8Array, plaintext: Uint8Array): { ciphertext: Uint8Array; nonce: Uint8Array } {
  const nonce = randomBytes(12);
  const cipher = chacha20poly1305(key, nonce);
  const ciphertext = cipher.encrypt(plaintext);
  return { ciphertext, nonce };
}

// Decrypt data using ChaCha20-Poly1305
function decryptChaCha(key: Uint8Array, ciphertext: Uint8Array, nonce: Uint8Array): Uint8Array {
  const cipher = chacha20poly1305(key, nonce);
  return cipher.decrypt(ciphertext);
}

/**
 * Generate proof from TEE with full encryption
 * Uses X25519 key exchange + ChaCha20-Poly1305 encryption
 */
// Check if creator refund proof has been generated for a launch
export async function checkRefundStatus(launchId: string): Promise<{
  launchId: string;
  refundGenerated: boolean;
  refundReference: string | null;
}> {
  try {
    const url = `${TEE_ENDPOINT}/launches/${encodeURIComponent(launchId)}/refund-status`;
    const response = await fetch(url);
    
    // If endpoint not found (TEE not updated), return default state
    if (response.status === 404) {
      console.log('[RefundStatus] Endpoint not found, assuming no refund generated yet');
      return {
        launchId,
        refundGenerated: false,
        refundReference: null,
      };
    }
    
    if (!response.ok) {
      throw new Error(`Failed to check refund status: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      launchId: data.launch_id,
      refundGenerated: data.refund_generated,
      refundReference: data.refund_reference,
    };
  } catch (error) {
    // If any error (network, etc), assume no refund generated
    console.error('[RefundStatus] Error checking status:', error);
    return {
      launchId,
      refundGenerated: false,
      refundReference: null,
    };
  }
}

// Check how many tokens are still available for a launch
export async function checkLaunchAvailability(params: {
  launchId: string;
  amountToSell?: number;
  pricePerToken?: number;
}): Promise<{
  launchId: string;
  amountToSell: number;
  totalTokensReserved: number;
  tokensAvailable: number;
  pricePerTokenUsd: number;
  maxUsdAvailable: string;
  isSoldOut: boolean;
  ticketsCreated: number;
}> {
  const queryParams = new URLSearchParams();
  if (params.amountToSell) queryParams.set('amount_to_sell', params.amountToSell.toString());
  if (params.pricePerToken) queryParams.set('price_per_token', params.pricePerToken.toString());
  
  const url = `${TEE_ENDPOINT}/launches/${encodeURIComponent(params.launchId)}/availability?${queryParams}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to check availability: ${response.statusText}`);
  }
  
  const data = await response.json();
  return {
    launchId: data.launch_id,
    amountToSell: data.amount_to_sell,
    totalTokensReserved: data.total_tokens_reserved,
    tokensAvailable: data.tokens_available,
    pricePerTokenUsd: data.price_per_token_usd,
    maxUsdAvailable: data.max_usd_available,
    isSoldOut: data.is_sold_out,
    ticketsCreated: data.tickets_created,
  };
}

export async function generateProofFromTEE(params: {
  depositAddress: string;
  creatorAddress: string;
  launchPda: string;
  userPubkey: string;
  launchId: string;
  tokenMint: string;
  tokenSymbol: string;
  pricePerToken: string;
  amountToSell: string;
  decimals: number;
  tokensPerProof: string;
}): Promise<TEEProofResult> {
  console.log('[TEE] Generating proof with params:', params);
  
  // Step 1: Get enclave public key
  const pubkeyResp = await fetch(`${TEE_ENDPOINT}/pubkey`);
  if (!pubkeyResp.ok) {
    throw new Error(`Failed to get TEE pubkey: ${pubkeyResp.statusText}`);
  }
  const { pubkey: enclavePubkeyHex } = await pubkeyResp.json();
  const enclavePubkey = hexToBytes(enclavePubkeyHex);
  
  console.log('[TEE] Got enclave pubkey');
  
  // Step 2: Generate user keypair (for decrypting response)
  const userKeyPair = generateKeyPair();
  
  // Step 3: Generate ephemeral keypair (for encrypting request)
  const ephemeralKeyPair = generateKeyPair();
  
  // Step 4: Derive shared secret and encryption key
  const sharedSecret = deriveSharedSecret(ephemeralKeyPair.privateKey, enclavePubkey);
  const encryptionKey = deriveKey(sharedSecret);
  
  console.log('[TEE] Derived encryption key');
  
  // Step 5: Prepare request payload
  const requestPayload = JSON.stringify({
    deposit_address: params.depositAddress,
    creator_address: params.creatorAddress,
    launch_pda: params.launchPda,
    user_pubkey: params.userPubkey,
    token_symbol: params.tokenSymbol,
    launch_id: params.launchId,
    price_per_token: parseInt(params.pricePerToken) || 0,
    amount_to_sell: parseInt(params.amountToSell) || 0,
    decimals: params.decimals,
    tokens_per_proof: parseInt(params.tokensPerProof) || 0,
  });
  
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(requestPayload);
  
  // Step 6: Encrypt with ChaCha20-Poly1305
  const { ciphertext, nonce } = encryptChaCha(encryptionKey, plaintextBytes);
  
  // Step 7: Build encrypted request (matching TEE's EncryptedRequest struct)
  const encryptedRequest = {
    ephemeral_pubkey: bytesToHex(ephemeralKeyPair.publicKey),
    nonce: bytesToHex(nonce),
    ciphertext: bytesToHex(ciphertext),
    user_pubkey: bytesToHex(userKeyPair.publicKey),
  };
  
  console.log('[TEE] Sending encrypted request to /generate-proof');
  
  // Step 8: Send to TEE
  const response = await fetch(`${TEE_ENDPOINT}/generate-proof`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(encryptedRequest),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TEE request failed: ${errorText}`);
  }
  
  const encryptedResponse = await response.json();
  
  // Step 9: Decrypt response
  // TEE encrypts response with user_pubkey, so we use userKeyPair.privateKey
  const responsePubkey = hexToBytes(encryptedResponse.ephemeral_pubkey);
  const responseShared = deriveSharedSecret(userKeyPair.privateKey, responsePubkey);
  const responseKey = deriveKey(responseShared);
  
  const responseCiphertext = hexToBytes(encryptedResponse.ciphertext);
  const responseNonce = hexToBytes(encryptedResponse.nonce);
  
  const decryptedBytes = decryptChaCha(responseKey, responseCiphertext, responseNonce);
  const decoder = new TextDecoder();
  const decryptedJson = decoder.decode(decryptedBytes);
  const result = JSON.parse(decryptedJson) as TEEProofResult;
  
  console.log('[TEE] Decrypted response:', {
    verified: result.verification?.verified,
    claimAmount: result.metadata?.claimAmount,
    proofReference: result.metadata?.proofReference,
  });
  
  return result;
}

/**
 * Download proof as ZIP file from TEE result
 */
export async function downloadProofFromTEE(teeResult: TEEProofResult): Promise<void> {
  if (teeResult.error || !teeResult.verification?.verified) {
    throw new Error(teeResult.error || 'Proof verification failed');
  }
  
  const zip = new JSZip();
  
  // Add proof binaries
  const proof = new Uint8Array(teeResult.proof);
  const publicInputs = new Uint8Array(teeResult.public_inputs);
  const compactProof = new Uint8Array(teeResult.compact_proof);
  
  zip.file('proof.bin', proof);
  zip.file('public_inputs.bin', publicInputs);
  zip.file('compact_proof.bin', compactProof);
  
  // Build metadata
  const metadata: ProofZipMetadata = {
    userPubkey: teeResult.metadata.userPubkey,
    depositAddress: teeResult.metadata.depositAddress,
    swapAmountIn: teeResult.metadata.swapAmountIn,
    swapAmountUsd: teeResult.metadata.swapAmountUsd,
    swapTokenSymbol: teeResult.metadata.swapTokenSymbol,
    claimAmount: teeResult.metadata.claimAmount,
    launchId: teeResult.metadata.launchId,
    launchPda: teeResult.metadata.launchPda,
    tokenMint: teeResult.metadata.tokenMint,
    tokenSymbol: teeResult.metadata.tokenSymbol,
    pricePerToken: teeResult.metadata.pricePerToken,
    creatorWallet: teeResult.metadata.creatorWallet,
    proofReference: teeResult.metadata.proofReference,
    createdAt: teeResult.metadata.createdAt,
    swapTimestamp: teeResult.metadata.swapTimestamp,
  };
  
  zip.file('metadata.json', JSON.stringify(metadata, null, 2));
  
  // Format claim amount for display
  const claimAmountFormatted = formatTokenAmount(teeResult.metadata.claimAmount, 9);
  
  // Add README
  zip.file('README.txt', `
╔═══════════════════════════════════════════════════════════╗
║              ZK PROOF - TOKEN CLAIM TICKET                ║
╚═══════════════════════════════════════════════════════════╝

This ZIP contains your ZK proof for claiming tokens.

📋 PURCHASE DETAILS:
   You Paid: $${teeResult.metadata.swapAmountUsd} (${teeResult.metadata.swapAmountIn} ${teeResult.metadata.swapTokenSymbol})
   You'll Receive: ${claimAmountFormatted} ${teeResult.metadata.tokenSymbol}
   Price per Token: $${(parseInt(teeResult.metadata.pricePerToken) / 1000000).toFixed(6)}

📋 LAUNCH INFO:
   Launch: ${teeResult.metadata.launchId}
   Token: ${teeResult.metadata.tokenSymbol}
   Creator: ${teeResult.metadata.creatorWallet.slice(0, 12)}...
   Proof Reference: ${teeResult.metadata.proofReference}
   Generated: ${new Date(teeResult.metadata.createdAt).toLocaleString()}

🔐 HOW TO CLAIM:
   1. Go to the claim page after the sale ends
   2. Upload this ZIP file
   3. Click "Claim Tokens"
   4. Sign the transaction

⚠️  IMPORTANT:
   - Keep this file safe and private
   - Each proof can only be used ONCE
   - Do not share this file with anyone
   - You can claim anytime after the sale ends

═══════════════════════════════════════════════════════════
  `.trim());
  
  // Generate and download
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `proof-${teeResult.metadata.launchId}-${teeResult.metadata.proofReference}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Format token amount with decimals
 */
function formatTokenAmount(amount: string, decimals: number = 9): string {
  try {
    const value = BigInt(amount);
    const divisor = BigInt(10 ** decimals);
    const whole = value / divisor;
    const fraction = value % divisor;
    const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 4);
    return `${whole.toLocaleString()}.${fractionStr}`;
  } catch {
    return amount;
  }
}

/**
 * Get formatted claim amount from TEE result
 */
export function getFormattedClaimAmount(teeResult: TEEProofResult, decimals: number = 9): string {
  return formatTokenAmount(teeResult.metadata.claimAmount, decimals);
}

// ============================================================================
// PROOF LOADING FUNCTIONS (for claim flow - user uploads ZIP)
// ============================================================================

export interface ProofZipData {
  proof: Uint8Array;
  publicInputs: Uint8Array;
  compactProof: Uint8Array;
  metadata: ProofZipMetadata;
}

/**
 * Load proof from a ZIP file (uploaded by user for claiming)
 * Returns the proof data needed for the claim transaction
 */
export async function loadProofFromZip(zipFile: File | Blob): Promise<ProofZipData> {
  const zip = await JSZip.loadAsync(zipFile);
  
  // Load proof binary
  const proofFile = zip.file('proof.bin');
  if (!proofFile) {
    throw new Error('Invalid proof ZIP: missing proof.bin');
  }
  const proof = new Uint8Array(await proofFile.async('arraybuffer'));
  
  // Load public inputs binary
  const inputsFile = zip.file('public_inputs.bin');
  if (!inputsFile) {
    throw new Error('Invalid proof ZIP: missing public_inputs.bin');
  }
  const publicInputs = new Uint8Array(await inputsFile.async('arraybuffer'));
  
  // Load compact proof (optional for backwards compatibility)
  let compactProof: Uint8Array;
  const compactFile = zip.file('compact_proof.bin');
  if (compactFile) {
    compactProof = new Uint8Array(await compactFile.async('arraybuffer'));
  } else {
    // Build compact proof from proof + publicInputs
    compactProof = buildCompactProof(proof, publicInputs);
  }
  
  // Load metadata
  const metadataFile = zip.file('metadata.json');
  if (!metadataFile) {
    throw new Error('Invalid proof ZIP: missing metadata.json');
  }
  const metadataJson = await metadataFile.async('string');
  const metadata = JSON.parse(metadataJson) as ProofZipMetadata;
  
  return {
    proof,
    publicInputs,
    compactProof,
    metadata,
  };
}

/**
 * Build compact proof format from proof and public inputs
 */
function buildCompactProof(proof: Uint8Array, publicInputs: Uint8Array): Uint8Array {
  const proofLen = new Uint8Array(4);
  new DataView(proofLen.buffer).setUint32(0, proof.length, true);
  
  const inputsLen = new Uint8Array(4);
  new DataView(inputsLen.buffer).setUint32(0, publicInputs.length, true);
  
  const compact = new Uint8Array(4 + proof.length + 4 + publicInputs.length);
  compact.set(proofLen, 0);
  compact.set(proof, 4);
  compact.set(inputsLen, 4 + proof.length);
  compact.set(publicInputs, 4 + proof.length + 4);
  
  return compact;
}

/**
 * Validate a proof ZIP file
 */
export async function validateProofZip(zipFile: File | Blob): Promise<{
  valid: boolean;
  error?: string;
  metadata?: ProofZipMetadata;
  claimAmount?: bigint;
}> {
  try {
    const data = await loadProofFromZip(zipFile);
    
    // Basic validation
    if (data.proof.length < 256) {
      return { valid: false, error: 'Proof data too short' };
    }
    if (data.publicInputs.length < 64) {
      return { valid: false, error: 'Public inputs too short' };
    }
    if (!data.metadata.launchPda) {
      return { valid: false, error: 'Missing launch PDA in metadata' };
    }
    if (!data.metadata.claimAmount) {
      return { valid: false, error: 'Missing claim amount in metadata' };
    }
    
    const claimAmount = BigInt(data.metadata.claimAmount);
    
    return { valid: true, metadata: data.metadata, claimAmount };
  } catch (e: unknown) {
    return { valid: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Get claim amount from loaded proof (convenience function)
 */
export function getClaimAmountFromProof(proofData: ProofZipData): bigint {
  return BigInt(proofData.metadata.claimAmount);
}

/**
 * Get a summary of the proof for display
 */
export function getProofSummary(proofData: ProofZipData): {
  claimAmount: string;
  claimAmountFormatted: string;
  tokenSymbol: string;
  swapAmount: string;
  swapAmountUsd: string;
  swapToken: string;
  launchName: string;
  launchPda: string;
  depositAddress: string;
  proofReference: string;
  createdAt: string;
} {
  return {
    claimAmount: proofData.metadata.claimAmount,
    claimAmountFormatted: formatTokenAmount(proofData.metadata.claimAmount),
    tokenSymbol: proofData.metadata.tokenSymbol,
    swapAmount: proofData.metadata.swapAmountIn,
    swapAmountUsd: proofData.metadata.swapAmountUsd || 'N/A',
    swapToken: proofData.metadata.swapTokenSymbol,
    launchName: proofData.metadata.launchId,
    launchPda: proofData.metadata.launchPda,
    depositAddress: proofData.metadata.depositAddress,
    proofReference: proofData.metadata.proofReference || 'N/A',
    createdAt: proofData.metadata.createdAt,
  };
}

// ============================================================================
// CREATOR REFUND FUNCTIONS (for creators to claim unsold tokens)
// ============================================================================

export interface CreatorRefundResult {
  success: boolean;
  refund_reference: string;
  launch_id: string;
  launch_pda: string;
  creator_address: string;
  total_sold: number;
  total_proofs: number;
  amount_to_sell: number;
  refundable_amount: number;
  timestamp: string;
  error?: string;
}

/**
 * Generate creator refund proof from TEE
 * Used by launch creators to claim unsold tokens after sale ends
 * Note: This endpoint uses plain JSON (not encrypted request) but returns encrypted response
 */
export async function generateCreatorRefundProof(params: {
  launchId: string;
  launchPda: string;
  creatorAddress: string;
  amountToSell: string;
  userPubkey: string;
}): Promise<CreatorRefundResult> {
  console.log('[TEE] Generating creator refund proof for launch:', params.launchId);
  
  // Generate user keypair for decrypting response
  const userKeyPair = generateKeyPair();
  
  // Build plain JSON request (this endpoint doesn't use encrypted request)
  const requestPayload = {
    launch_id: params.launchId,
    launch_pda: params.launchPda,
    creator_address: params.creatorAddress,
    amount_to_sell: parseInt(params.amountToSell, 10),  // TEE expects u64
    user_pubkey: bytesToHex(userKeyPair.publicKey),     // For response encryption
  };
  
  console.log('[TEE] Sending request to /generate-creator-refund-proof:', requestPayload);
  
  // Send to TEE
  const response = await fetch(`${TEE_ENDPOINT}/generate-creator-refund-proof`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestPayload),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TEE request failed: ${errorText}`);
  }
  
  const encryptedResponse = await response.json();
  
  // Decrypt response using user keypair
  const responsePubkey = hexToBytes(encryptedResponse.ephemeral_pubkey);
  const responseShared = deriveSharedSecret(userKeyPair.privateKey, responsePubkey);
  const responseKey = deriveKey(responseShared);
  
  const responseCiphertext = hexToBytes(encryptedResponse.ciphertext);
  const responseNonce = hexToBytes(encryptedResponse.nonce);
  
  const decryptedBytes = decryptChaCha(responseKey, responseCiphertext, responseNonce);
  const decoder = new TextDecoder();
  const decryptedJson = decoder.decode(decryptedBytes);
  const result = JSON.parse(decryptedJson) as CreatorRefundResult;
  
  console.log('[TEE] Creator refund proof result:', {
    refundableAmount: result.refundable_amount,
    totalSold: result.total_sold,
    error: result.error,
  });
  
  return result;
}

/**
 * Download creator refund proof as ZIP
 */
export async function downloadCreatorRefundProof(refundResult: CreatorRefundResult): Promise<void> {
  if (refundResult.error) {
    throw new Error(refundResult.error);
  }
  
  if (!refundResult.success) {
    throw new Error('Refund proof generation was not successful');
  }
  
  const zip = new JSZip();
  
  // Build metadata (this is a verification proof, not a ZK proof)
  const metadata = {
    type: 'creator_refund',
    refundReference: refundResult.refund_reference,
    launchId: refundResult.launch_id,
    launchPda: refundResult.launch_pda,
    creatorAddress: refundResult.creator_address,
    refundableAmount: refundResult.refundable_amount.toString(),
    totalSold: refundResult.total_sold.toString(),
    totalProofs: refundResult.total_proofs,
    amountToSell: refundResult.amount_to_sell.toString(),
    timestamp: refundResult.timestamp,
  };
  
  zip.file('metadata.json', JSON.stringify(metadata, null, 2));
  
  // Add refund data as JSON for contract verification
  const refundData = {
    refund_reference: refundResult.refund_reference,
    launch_pda: refundResult.launch_pda,
    refundable_amount: refundResult.refundable_amount,
    total_sold: refundResult.total_sold,
    amount_to_sell: refundResult.amount_to_sell,
  };
  zip.file('refund_data.json', JSON.stringify(refundData, null, 2));
  
  // Add README
  const refundFormatted = formatTokenAmount(refundResult.refundable_amount.toString());
  const soldFormatted = formatTokenAmount(refundResult.total_sold.toString());
  zip.file('README.txt', `
╔═══════════════════════════════════════════════════════════╗
║           CREATOR REFUND - UNSOLD TOKENS PROOF            ║
╚═══════════════════════════════════════════════════════════╝

This file contains verification data for claiming unsold tokens.

📋 REFUND DETAILS:
   Launch: ${refundResult.launch_id}
   Reference: ${refundResult.refund_reference}
   Unsold Tokens: ${refundFormatted}
   Total Sold: ${soldFormatted}
   Total Proofs: ${refundResult.total_proofs}
   
📋 HOW TO CLAIM:
   1. Go to the token page
   2. Use the "Claim Unsold Tokens" section
   3. Upload this ZIP file
   4. Sign the transaction

⚠️  IMPORTANT:
   - Only the launch creator can use this
   - This can only be used ONCE
   - Sale must have ended before claiming

═══════════════════════════════════════════════════════════
  `.trim());
  
  // Generate and download
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `creator-refund-${refundResult.launch_id}-${refundResult.refund_reference}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// TEE STATS FUNCTIONS
// ============================================================================

export interface TEEStats {
  total_proofs_generated: number;
  total_verified_swaps: number;
  total_failed_verifications: number;
  total_zec_amount: number;
  total_zec_usd_value: number;
}

export interface LaunchStats {
  launch_id: string;
  tickets_created: number;
  shielded_value_usd: string;
  total_tokens_sold: number;
  proof_references: string[];
}

/**
 * Get global TEE stats
 */
export async function getTEEStats(): Promise<TEEStats> {
  const response = await fetch(`${TEE_ENDPOINT}/stats`);
  if (!response.ok) {
    throw new Error(`Failed to get TEE stats: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get stats for a specific launch
 */
export async function getLaunchStats(launchId: string): Promise<LaunchStats> {
  const response = await fetch(`${TEE_ENDPOINT}/launches/${encodeURIComponent(launchId)}/stats`);
  if (!response.ok) {
    throw new Error(`Failed to get launch stats: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get all launches and their proof references
 */
export async function getAllLaunches(): Promise<Array<{
  launch_id: string;
  launch_pda: string;
  proofs: Array<{ reference_id: string; claim_amount: string; created_at: string }>;
  total_proofs: number;
}>> {
  const response = await fetch(`${TEE_ENDPOINT}/launches`);
  if (!response.ok) {
    throw new Error(`Failed to get launches: ${response.statusText}`);
  }
  return response.json();
}

