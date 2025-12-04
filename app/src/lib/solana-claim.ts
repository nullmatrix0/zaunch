/**
 * Solana claim transaction builder for browser
 * Uses Web Crypto API instead of Node.js crypto
 */

import { 
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction, 
  SystemProgram 
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction 
} from '@solana/spl-token';

/**
 * SHA256 hash using Web Crypto API (browser compatible)
 */
async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return new Uint8Array(hashBuffer);
}

/**
 * Create a claim transaction using compact proof + shared VK (browser compatible)
 */
export async function createClaimTransactionCompact(
  connection: Connection,
  programId: PublicKey,
  userWallet: PublicKey,
  launchPda: PublicKey,
  tokenMint: PublicKey,
  compactProof: Uint8Array,
  amount: number,
  depositAddress: string,
  circuitId: string = "swap_circuit_v15"
): Promise<Transaction> {
  
  // Derive PDAs
  const [userClaimPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("claim"), userWallet.toBuffer(), launchPda.toBuffer()],
    programId
  );
  
  const [tokenVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), launchPda.toBuffer()],
    programId
  );
  
  const [vkPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("verifying_key"), Buffer.from(circuitId)],
    programId
  );
  
  // Parse compact proof to extract proof and public inputs
  const compactBuffer = compactProof;
  const proofLen = new DataView(compactBuffer.buffer, compactBuffer.byteOffset).getUint32(0, true);
  const proofBytes = compactBuffer.slice(4, 4 + proofLen);
  
  // Compute proof hash for nullifier (proof replay protection)
  const proofHash = await sha256(proofBytes);
  
  // Derive proof nullifier PDA
  const [proofNullifierPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nullifier"), proofHash],
    programId
  );
  
  // Hash deposit address for PDA derivation
  const depositHash = await sha256(new TextEncoder().encode(depositAddress));
  
  // Derive deposit_used PDA GLOBALLY
  const [depositUsedPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("deposit_used_global"), depositHash],
    programId
  );
  
  // Derive global stats PDA
  const [globalStatsPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_stats")],
    programId
  );
  
  // Get User ATA
  const userTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    userWallet
  );
  
  // Check if user token account exists, if not create it
  const accountInfo = await connection.getAccountInfo(userTokenAccount);
  const tx = new Transaction();
  
  if (!accountInfo) {
    console.log('Creating user token account...');
    tx.add(
      createAssociatedTokenAccountInstruction(
        userWallet, // payer
        userTokenAccount, // associated token account
        userWallet, // owner
        tokenMint // mint
      )
    );
  }
  
  // Read public inputs
  const publicInputsOffset = 4 + proofLen;
  const publicInputsLen = new DataView(compactBuffer.buffer, compactBuffer.byteOffset + publicInputsOffset).getUint32(0, true);
  const publicInputsBytes = compactBuffer.slice(publicInputsOffset + 4, publicInputsOffset + 4 + publicInputsLen);
  
  console.log(`Proof: ${proofLen} bytes, Public Inputs: ${publicInputsLen} bytes`);
  console.log(`Proof Nullifier PDA: ${proofNullifierPda.toBase58()}`);
  
  // Build instruction data
  // Variant 10: ClaimTokensCompact { proof_data: ProofDataCompact, amount: u64 }
  const variantBuffer = new Uint8Array([10]);
  
  const proofLenBuffer = new Uint8Array(4);
  new DataView(proofLenBuffer.buffer).setUint32(0, proofBytes.length, true);
  
  const publicInputsLenBuffer = new Uint8Array(4);
  new DataView(publicInputsLenBuffer.buffer).setUint32(0, publicInputsBytes.length, true);
  
  const amountBuffer = new Uint8Array(8);
  new DataView(amountBuffer.buffer).setBigUint64(0, BigInt(amount), true);
  
  // Deposit address (String: 4 bytes len + content)
  const depositAddressBytes = new TextEncoder().encode(depositAddress);
  const depositAddressLenBuffer = new Uint8Array(4);
  new DataView(depositAddressLenBuffer.buffer).setUint32(0, depositAddressBytes.length, true);
  
  // claim_amount is part of ProofDataCompact
  const claimAmountBuffer = new Uint8Array(8);
  new DataView(claimAmountBuffer.buffer).setBigUint64(0, BigInt(amount), true);
  
  // Concatenate all buffers
  const instructionData = new Uint8Array([
    ...variantBuffer,
    ...proofLenBuffer,
    ...proofBytes,
    ...publicInputsLenBuffer,
    ...publicInputsBytes,
    ...claimAmountBuffer,  // claim_amount inside ProofDataCompact
    ...amountBuffer,       // amount parameter (ignored by contract, kept for backwards compat)
    ...depositAddressLenBuffer,
    ...depositAddressBytes
  ]);
  
  // Create instruction with VK account, proof nullifier, and deposit_used
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: userWallet, isSigner: true, isWritable: true },
      { pubkey: launchPda, isSigner: false, isWritable: true },
      { pubkey: vkPda, isSigner: false, isWritable: false }, // Shared VK
      { pubkey: userClaimPda, isSigner: false, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: tokenVaultPda, isSigner: false, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: proofNullifierPda, isSigner: false, isWritable: true }, // Proof nullifier
      { pubkey: depositUsedPda, isSigner: false, isWritable: true }, // Deposit used
      { pubkey: globalStatsPda, isSigner: false, isWritable: true }, // Global stats
    ],
    programId,
    data: Buffer.from(instructionData),
  });
  
  tx.add(instruction);
  return tx;
}

/**
 * Get global stats PDA
 */
export function getGlobalStatsPda(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('global_stats')],
    programId
  );
  return pda;
}

/**
 * Create a creator refund transaction for claiming unsold tokens (instruction 15)
 */
export async function createCreatorRefundTransaction(
  connection: Connection,
  programId: PublicKey,
  creatorWallet: PublicKey,
  launchPda: PublicKey,
  tokenMint: PublicKey,
  refundableAmount: bigint
): Promise<Transaction> {
  
  // Derive token vault PDA
  const [tokenVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), launchPda.toBuffer()],
    programId
  );
  
  // Get creator's ATA
  const creatorTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    creatorWallet
  );
  
  const tx = new Transaction();
  
  // Check if creator token account exists, if not create it
  const accountInfo = await connection.getAccountInfo(creatorTokenAccount);
  if (!accountInfo) {
    console.log('[CreatorRefund] Creating creator token account...');
    tx.add(
      createAssociatedTokenAccountInstruction(
        creatorWallet,
        creatorTokenAccount,
        creatorWallet,
        tokenMint
      )
    );
  }
  
  // Build instruction data for ClaimUnsoldTokens (instruction 15)
  // Format: [variant: u8] [refundable_amount: u64]
  const variantBuffer = new Uint8Array([15]);
  const amountBuffer = new Uint8Array(8);
  new DataView(amountBuffer.buffer).setBigUint64(0, refundableAmount, true);
  
  const instructionData = new Uint8Array([...variantBuffer, ...amountBuffer]);
  
  console.log('[CreatorRefund] Building transaction:', {
    creator: creatorWallet.toBase58(),
    launchPda: launchPda.toBase58(),
    tokenVaultPda: tokenVaultPda.toBase58(),
    creatorTokenAccount: creatorTokenAccount.toBase58(),
    refundableAmount: refundableAmount.toString(),
    instructionDataHex: Buffer.from(instructionData).toString('hex'),
  });
  
  // Contract expects 5 accounts in this order:
  // 1. creator (signer)
  // 2. launch_account
  // 3. token_vault
  // 4. creator_token_account
  // 5. token_program
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: creatorWallet, isSigner: true, isWritable: true },
      { pubkey: launchPda, isSigner: false, isWritable: true },
      { pubkey: tokenVaultPda, isSigner: false, isWritable: true },
      { pubkey: creatorTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId,
    data: Buffer.from(instructionData),
  });
  
  tx.add(instruction);
  return tx;
}

