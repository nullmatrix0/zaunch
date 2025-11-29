import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from '@solana/web3.js';
import { useCallback, useState } from 'react';

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const SYSVAR_RENT_PUBKEY = new PublicKey('SysvarRent111111111111111111111111111111111');
const PROGRAM_ID = new PublicKey('HDFv1zjKQzvHuNJeH7D6A8DFKAxwJKw8X47qW4MYxYpA');

export interface LaunchParams {
  name: string;
  description: string;
  start_time: bigint;
  end_time: bigint;
  max_claims_per_user: bigint;
  total_supply: bigint;
  tokens_per_proof: bigint;
  price_per_token: bigint;
  min_amount_to_sell: bigint;
  amount_to_sell: bigint;
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
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  return pda;
}

// Helper function to serialize instruction data for createLaunch
function serializeCreateLaunchInstruction(
  launchParams: LaunchParams,
  tokenDetails: TokenDetails
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

  // Build the instruction data
  const parts = [
    discriminator,
    // LaunchParams
    serializeString(launchParams.name),
    serializeString(launchParams.description),
    serializeI64(launchParams.start_time),
    serializeI64(launchParams.end_time),
    serializeU64(launchParams.max_claims_per_user),
    serializeU64(launchParams.total_supply),
    serializeU64(launchParams.tokens_per_proof),
    serializeU64(launchParams.price_per_token),
    serializeU64(launchParams.min_amount_to_sell),
    serializeU64(launchParams.amount_to_sell),
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
          PROGRAM_ID
        );

        const [registryPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('registry_v2')],
          PROGRAM_ID
        );

        const [tokenVaultPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('vault'), launchPda.toBuffer()],
          PROGRAM_ID
        );

        // Derive creator's associated token account
        const creatorAtaAddress = getAssociatedTokenAddressSync(
          tokenMint.publicKey,
          publicKey
        );

        // Derive metadata account
        const metadataPda = getMetadataPDA(tokenMint.publicKey);

        console.log('📝 PDAs derived:');
        console.log('  Launch PDA:', launchPda.toString());
        console.log('  Registry PDA:', registryPda.toString());
        console.log('  Token Vault PDA:', tokenVaultPda.toString());
        console.log('  Creator ATA:', creatorAtaAddress.toString());
        console.log('  Metadata PDA:', metadataPda.toString());

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

        console.log('🔍 Simulating transaction...');

        // Simulate transaction before sending (with sigVerify: false to skip signature verification)
        try {
          const simulation = await connection.simulateTransaction(transaction, undefined);

          if (simulation.value.err) {
            console.error('❌ Simulation failed:', simulation.value.err);
            console.error('Logs:', simulation.value.logs);
            throw new Error(
              `Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`
            );
          }

          console.log('✅ Simulation successful!');
          if (simulation.value.logs) {
            console.log('Simulation logs:', simulation.value.logs.join('\n'));
          }
        } catch (simError: any) {
          console.error('❌ Simulation error:', simError);
          throw new Error(
            `Failed to simulate transaction: ${simError.message || 'Unknown error'}`
          );
        }

        console.log('📤 Sending transaction...');

        // Send transaction (wallet will sign it)
        const signature = await sendTransaction(transaction, connection, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });

        console.log('⏳ Confirming transaction...');

        // Confirm transaction
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, 'confirmed');

        console.log('✅ Token deployed successfully!');
        console.log('Launch PDA:', launchPda.toString());
        console.log('Token Mint:', tokenMint.publicKey.toString());
        console.log('Signature:', signature);

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
          if (errorMessage.includes('InsufficientFundsForRent') || errorMessage.includes('insufficient lamports')) {
            errorMessage = 'Insufficient SOL for rent. You need more SOL in your wallet to create accounts.';
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
        } else if (errorMessage.includes('User rejected the request') || errorMessage.includes('User rejected')) {
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
    [connection, publicKey, sendTransaction]
  );

  return {
    deployToken,
    isLoading,
    error,
  };
};
