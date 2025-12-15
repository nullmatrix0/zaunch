import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { useCallback, useState } from 'react';
import { LAUNCH_PROGRAM_ID } from '@/configs/env.config';

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const SYSVAR_RENT_PUBKEY = new PublicKey('SysvarRent111111111111111111111111111111111');
const PROGRAM_ID = new PublicKey(LAUNCH_PROGRAM_ID);

export interface LaunchParams {
  name: string;
  description: string;
  creator_wallet: string;
  start_time: bigint;
  end_time: bigint;
  max_claims_per_user: bigint;
  total_supply: bigint;
  tokens_per_proof: bigint;      // Tokens per ticket
  price_per_token: bigint;
  min_amount_to_sell: bigint;
  amount_to_sell: bigint;
  price_per_ticket: bigint;      // Price per ticket in micro-USD (6 decimals)
  total_tickets: bigint;         // Total number of tickets
  escrow_enabled: boolean;       // 🛡️ Platform Escrow toggle
  escrow_address: string;        // TEE-controlled escrow address (generated per purchase)
}

export interface TokenDetails {
  token_name: string;
  token_symbol: string;
  token_uri: string;
  decimals: number;
}

// Helper function to derive metadata PDA
function getMetadataPDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID,
  );
  return pda;
}

// Helper function to serialize instruction data for createLaunch
function serializeCreateLaunchInstruction(
  launchParams: LaunchParams,
  tokenDetails: TokenDetails,
): Buffer {
  // Instruction discriminator for createLaunch is [1]
  const discriminator = Buffer.from([1]);

  // Serialize strings with length prefix (4 bytes)
  const serializeString = (str: string): Buffer => {
    const strBuf = Buffer.from(str, 'utf-8');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32LE(strBuf.length, 0);
    return Buffer.concat([lenBuf, strBuf]);
  };

  // Serialize u64/i64 as 8 bytes little-endian (browser-compatible)
  const serializeU64 = (val: bigint): Buffer => {
    const arr = new Uint8Array(8);
    let n = val;
    for (let i = 0; i < 8; i++) {
      arr[i] = Number(n & BigInt(0xff));
      n = n >> BigInt(8);
    }
    return Buffer.from(arr);
  };

  const serializeI64 = (val: bigint): Buffer => {
    const arr = new Uint8Array(8);
    let n = val;
    for (let i = 0; i < 8; i++) {
      arr[i] = Number(n & BigInt(0xff));
      n = n >> BigInt(8);
    }
    return Buffer.from(arr);
  };

  // Serialize u8
  const serializeU8 = (val: number): Buffer => {
    const buf = Buffer.alloc(1);
    buf.writeUInt8(val, 0);
    return buf;
  };

  // Serialize bool as u8
  const serializeBool = (val: boolean): Buffer => {
    const buf = Buffer.alloc(1);
    buf.writeUInt8(val ? 1 : 0, 0);
    return buf;
  };

  // Build the instruction data
  const parts = [
    discriminator,
    // LaunchParams
    serializeString(launchParams.name),
    serializeString(launchParams.description),
    serializeString(launchParams.creator_wallet),
    serializeI64(launchParams.start_time),
    serializeI64(launchParams.end_time),
    serializeU64(launchParams.max_claims_per_user),
    serializeU64(launchParams.total_supply),
    serializeU64(launchParams.tokens_per_proof),
    serializeU64(launchParams.price_per_token),
    serializeU64(launchParams.min_amount_to_sell),
    serializeU64(launchParams.amount_to_sell),
    serializeU64(launchParams.price_per_ticket),
    serializeU64(launchParams.total_tickets),
    serializeBool(launchParams.escrow_enabled),  // 🛡️ Platform Escrow
    serializeString(launchParams.escrow_address),
    // TokenDetails
    serializeString(tokenDetails.token_name),
    serializeString(tokenDetails.token_symbol),
    serializeString(tokenDetails.token_uri),
    serializeU8(tokenDetails.decimals),
  ];

  return Buffer.concat(parts);
}

export const useDeployToken = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deployWithExistingToken = useCallback(
    async (
      launchParams: LaunchParams,
      tokenDetails: TokenDetails,
      existingMintAddress: string,
      tokenAmount: bigint,
    ) => {
      if (!publicKey) {
        setError('Wallet not connected');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log('🚀 Starting launch with existing token...');
        console.log('Wallet public key:', publicKey.toString());
        console.log('Existing token mint:', existingMintAddress);

        // Validate and parse the mint address
        let tokenMint: PublicKey;
        try {
          tokenMint = new PublicKey(existingMintAddress);
        } catch (err) {
          throw new Error('Invalid token mint address');
        }

        // Derive PDAs
        const [launchPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('launch'), publicKey.toBuffer(), Buffer.from(launchParams.name)],
          PROGRAM_ID,
        );

        const [registryPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('registry_v2')],
          PROGRAM_ID,
        );

        const [tokenVaultPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('vault'), launchPda.toBuffer()],
          PROGRAM_ID,
        );

        // Get creator's token account
        const creatorTokenAccount = getAssociatedTokenAddressSync(tokenMint, publicKey);
        // Serialize instruction data
        const variantBuffer = Buffer.from([13]); // CreateLaunchWithExistingToken = variant 13

        // Serialize strings with length prefix (4 bytes)
        const serializeString = (str: string): Buffer => {
          const strBuf = Buffer.from(str, 'utf-8');
          const lenBuf = Buffer.alloc(4);
          lenBuf.writeUInt32LE(strBuf.length, 0);
          return Buffer.concat([lenBuf, strBuf]);
        };

        // Serialize u64/i64 as 8 bytes little-endian
        const serializeU64 = (val: bigint): Buffer => {
          const arr = new Uint8Array(8);
          let n = val;
          for (let i = 0; i < 8; i++) {
            arr[i] = Number(n & BigInt(0xff));
            n = n >> BigInt(8);
          }
          return Buffer.from(arr);
        };

        const serializeI64 = (val: bigint): Buffer => {
          const arr = new Uint8Array(8);
          let n = val;
          for (let i = 0; i < 8; i++) {
            arr[i] = Number(n & BigInt(0xff));
            n = n >> BigInt(8);
          }
          return Buffer.from(arr);
        };

        const serializeU8 = (val: number): Buffer => {
          const buf = Buffer.alloc(1);
          buf.writeUInt8(val, 0);
          return buf;
        };

        // Build the instruction data
        const instructionData = Buffer.concat([
          variantBuffer,
          serializeString(launchParams.name),
          serializeString(launchParams.description),
          serializeString(launchParams.creator_wallet),
          serializeI64(launchParams.start_time),
          serializeI64(launchParams.end_time),
          serializeU64(launchParams.max_claims_per_user),
          serializeU64(launchParams.total_supply),
          serializeU64(launchParams.tokens_per_proof),
          serializeU64(launchParams.price_per_token),
          serializeU64(launchParams.min_amount_to_sell),
          serializeU64(launchParams.amount_to_sell),
          serializeU64(launchParams.price_per_ticket),
          serializeU64(launchParams.total_tickets),
          // Escrow fields
          Buffer.from([launchParams.escrow_enabled ? 1 : 0]),  // bool as u8
          serializeString(launchParams.escrow_address),
          // TokenDetails
          serializeString(tokenDetails.token_name),
          serializeString(tokenDetails.token_symbol),
          serializeString(tokenDetails.token_uri),
          serializeU8(tokenDetails.decimals),
          serializeU64(tokenAmount),
        ]);

        // Build the instruction
        const createLaunchIx = new TransactionInstruction({
          keys: [
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: launchPda, isSigner: false, isWritable: true },
            { pubkey: registryPda, isSigner: false, isWritable: true },
            { pubkey: tokenMint, isSigner: false, isWritable: false },
            { pubkey: tokenVaultPda, isSigner: false, isWritable: true },
            { pubkey: creatorTokenAccount, isSigner: false, isWritable: true },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
          ],
          programId: PROGRAM_ID,
          data: instructionData,
        });

        console.log('📤 Preparing transaction...');

        // Create and send transaction
        const transaction = new Transaction().add(createLaunchIx);
        transaction.feePayer = publicKey;

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;

        // Skip simulation for faster deployment
        console.log('🚀 Sending transaction (skipping simulation for speed)...');

        // Send transaction with skipPreflight for maximum speed
        const signature = await sendTransaction(transaction, connection, {
          skipPreflight: true,
          maxRetries: 3,
        });

        console.log('📝 Transaction sent:', signature);
        console.log('⏳ Waiting for confirmation...');

        // Use 'processed' for faster confirmation
        await connection.confirmTransaction(
          {
            signature,
            blockhash,
            lastValidBlockHeight,
          },
          'processed',
        );

        console.log('✅ Launch created with existing token successfully!');
        console.log('Launch PDA:', launchPda.toString());
        console.log('Token Mint:', tokenMint.toString());
        console.log('Signature:', signature);

        return {
          signature,
          launchPda: launchPda.toString(),
          tokenMint: tokenMint.toString(),
        };
      } catch (err: any) {
        console.error('❌ Deploy with existing token error:', err);

        // Try to get more details from error
        if (err.logs) {
          console.error('Transaction logs:', err.logs);
        }

        // Check for specific error patterns
        let errorMessage = err.message || 'Failed to create launch with existing token';

        // Simulation-specific errors
        if (errorMessage.includes('simulation failed')) {
          if (
            errorMessage.includes('InsufficientFundsForRent') ||
            errorMessage.includes('insufficient lamports')
          ) {
            errorMessage =
              'Insufficient SOL for rent. You need more SOL in your wallet to create accounts.';
          } else if (errorMessage.includes('InvalidAccountData')) {
            errorMessage = 'Invalid account data. Please check your input parameters.';
          } else if (errorMessage.includes('AccountAlreadyInitialized')) {
            errorMessage = 'A launch with this name already exists. Please use a different name.';
          } else if (errorMessage.includes('custom program error')) {
            errorMessage = 'Program execution failed. Check the browser console for detailed logs.';
          }
        } else if (errorMessage.includes('0x1')) {
          errorMessage = 'Program error: Insufficient funds for transaction';
        } else if (errorMessage.includes('0x0')) {
          errorMessage = 'Program error: Custom program error';
        } else if (errorMessage.includes('Signature verification failed')) {
          errorMessage = 'Transaction signing failed. Please try again.';
        } else if (errorMessage.includes('invalid program argument')) {
          errorMessage =
            'Invalid program argument. This usually means a PDA mismatch. Check console logs.';
        } else if (
          errorMessage.includes('User rejected the request') ||
          errorMessage.includes('User rejected')
        ) {
          errorMessage = 'Transaction rejected by user.';
        } else if (errorMessage.includes('Blockhash not found')) {
          errorMessage = 'Transaction expired. Please try again.';
        }

        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [connection, publicKey, sendTransaction],
  );

  const deployToken = useCallback(
    async (launchParams: LaunchParams, tokenDetails: TokenDetails) => {
      if (!publicKey) {
        setError('Wallet not connected');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log('🚀 Starting token deployment...');
        console.log('Wallet public key:', publicKey.toString());

        // Generate Token Mint Keypair
        const tokenMint = Keypair.generate();
        console.log('Token Mint:', tokenMint.publicKey.toString());

        // Derive PDAs
        const [launchPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('launch'), publicKey.toBuffer(), Buffer.from(launchParams.name)],
          PROGRAM_ID,
        );

        const [registryPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('registry_v2')],
          PROGRAM_ID,
        );

        const [tokenVaultPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('vault'), launchPda.toBuffer()],
          PROGRAM_ID,
        );

        // Derive creator's associated token account
        const creatorAtaAddress = getAssociatedTokenAddressSync(tokenMint.publicKey, publicKey);

        // Derive metadata account
        const metadataPda = getMetadataPDA(tokenMint.publicKey);
        // Serialize instruction data
        const createLaunchData = serializeCreateLaunchInstruction(launchParams, tokenDetails);

        // Build the instruction
        const createLaunchIx = new TransactionInstruction({
          keys: [
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: launchPda, isSigner: false, isWritable: true },
            { pubkey: registryPda, isSigner: false, isWritable: true },
            { pubkey: tokenMint.publicKey, isSigner: true, isWritable: true },
            { pubkey: tokenVaultPda, isSigner: false, isWritable: true },
            { pubkey: creatorAtaAddress, isSigner: false, isWritable: true },
            { pubkey: metadataPda, isSigner: false, isWritable: true },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
          ],
          programId: PROGRAM_ID,
          data: createLaunchData,
        });

        console.log('📤 Preparing transaction...');

        // Create and send transaction
        const transaction = new Transaction().add(createLaunchIx);
        transaction.feePayer = publicKey;

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;

        // Sign with tokenMint keypair first
        transaction.partialSign(tokenMint);

        // Skip simulation for faster deployment - preflight will catch errors
        console.log('🚀 Sending transaction (skipping simulation for speed)...');

        // Send transaction with skipPreflight for maximum speed
        // The wallet will still validate, and we'll catch errors on confirmation
        const signature = await sendTransaction(transaction, connection, {
          skipPreflight: true, // Skip preflight for faster submission
          maxRetries: 3,
        });

        console.log('📝 Transaction sent:', signature);
        console.log('⏳ Waiting for confirmation...');

        // Use 'processed' for faster confirmation (still reliable)
        // 'confirmed' takes longer as it waits for more validators
        await connection.confirmTransaction(
          {
            signature,
            blockhash,
            lastValidBlockHeight,
          },
          'processed', // Faster than 'confirmed'
        );

        return {
          signature,
          launchPda: launchPda.toString(),
          tokenMint: tokenMint.publicKey.toString(),
        };
      } catch (err: any) {
        console.error('❌ Deploy token error:', err);

        // Try to get more details from error
        if (err.logs) {
          console.error('Transaction logs:', err.logs);
        }

        // Check for specific error patterns
        let errorMessage = err.message || 'Failed to deploy token';

        // Simulation-specific errors
        if (errorMessage.includes('simulation failed')) {
          if (
            errorMessage.includes('InsufficientFundsForRent') ||
            errorMessage.includes('insufficient lamports')
          ) {
            errorMessage =
              'Insufficient SOL for rent. You need more SOL in your wallet to create accounts.';
          } else if (errorMessage.includes('InvalidAccountData')) {
            errorMessage = 'Invalid account data. Please check your input parameters.';
          } else if (errorMessage.includes('AccountAlreadyInitialized')) {
            errorMessage = 'A launch with this name already exists. Please use a different name.';
          } else if (errorMessage.includes('custom program error')) {
            errorMessage = 'Program execution failed. Check the browser console for detailed logs.';
          }
        } else if (errorMessage.includes('0x1')) {
          errorMessage = 'Program error: Insufficient funds for transaction';
        } else if (errorMessage.includes('0x0')) {
          errorMessage = 'Program error: Custom program error';
        } else if (errorMessage.includes('Signature verification failed')) {
          errorMessage = 'Transaction signing failed. Please try again.';
        } else if (errorMessage.includes('invalid program argument')) {
          errorMessage =
            'Invalid program argument. This usually means a PDA mismatch. Check console logs.';
        } else if (
          errorMessage.includes('User rejected the request') ||
          errorMessage.includes('User rejected')
        ) {
          errorMessage = 'Transaction rejected by user.';
        } else if (errorMessage.includes('Blockhash not found')) {
          errorMessage = 'Transaction expired. Please try again.';
        }

        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [connection, publicKey, sendTransaction],
  );

  return {
    deployToken,
    deployWithExistingToken,
    isLoading,
    error,
  };
};
