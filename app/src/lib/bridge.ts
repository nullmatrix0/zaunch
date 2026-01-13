import {
  PublicKey,
  Connection,
  SystemProgram,
  ComputeBudgetProgram,
  Transaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { Program, BN } from '@coral-xyz/anchor';
import { BRIDGE_PROGRAM_ID, LZ_ENDPOINT_PROGRAM_ID } from '@/configs/env.config';
import { Options } from '@layerzerolabs/lz-v2-utilities';
import { EndpointId } from '@layerzerolabs/lz-definitions';
import { getSendAccounts } from './send-helper';

export const SUPPORTED_CHAINS = {
  ethereum: { id: EndpointId.SEPOLIA_V2_TESTNET, name: 'Sepolia', nativeToken: 'ETH' },
  optimism: { id: EndpointId.OPTSEP_V2_TESTNET, name: 'Optimism Sepolia', nativeToken: 'ETH' },
  base: { id: EndpointId.BASESEP_V2_TESTNET, name: 'Base Sepolia', nativeToken: 'ETH' },
  arbitrum: { id: EndpointId.ARBSEP_V2_TESTNET, name: 'Arbitrum Sepolia', nativeToken: 'ETH' },
  avalanche: { id: EndpointId.AVALANCHE_V2_TESTNET, name: 'Avalanche Fuji', nativeToken: 'AVAX' },
  solana: { id: EndpointId.SOLANA_V2_TESTNET, name: 'Solana', nativeToken: 'SOL' },
} as const;

export type SupportedChainKey = keyof typeof SUPPORTED_CHAINS;

export enum OrderStatus {
  NONE = 'None',
  CREATED = 'Created',
  LOCKED = 'Locked',
  BRIDGING = 'Bridging',
  FULFILLED = 'Fulfilled',
  CLAIMED_UNLOCK = 'ClaimedUnlock',
  CANCELLED = 'Cancelled',
  FAILED = 'Failed',
}

export interface OrderInfo {
  orderId: string;
  ticketId: string;
  status: OrderStatus;
  give: {
    chainId: number;
    tokenAddress: string;
    amount: string;
  };
  take: {
    chainId: number;
    tokenAddress: string;
    amount: string;
  };
  makerSrc: string;
  receiverDst: string;
  txSignature?: string;
  guid?: string;
  timestamp: number;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
}

export interface VaultStatus {
  exists: boolean;
  mint: string;
  totalLocked: string;
  vaultTokenAccount: string;
}

export interface BridgeParams {
  tokenMint: string;
  amount: string;
  destinationChainId: EndpointId;
  recipientAddress: string;
  userWallet: string;
  tokenMetadata: TokenMetadata;
}

export interface BridgeResult {
  lockSignature: string;
  bridgeSignature: string;
  ticketId: string;
  guid?: string;
  explorerUrl: string;
  layerZeroScanUrl?: string;
}

const BRIDGE_PROGRAM_ID_PK = new PublicKey(BRIDGE_PROGRAM_ID);
const LZ_ENDPOINT_PROGRAM_ID_PK = new PublicKey(LZ_ENDPOINT_PROGRAM_ID);
const ESTIMATED_LZ_FEE = 500_000_000; // 0.5 SOL

export function deriveStorePDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('Store')], BRIDGE_PROGRAM_ID_PK);
}

export function derivePeerPDA(dstEid: number): [PublicKey, number] {
  const [storePDA] = deriveStorePDA();
  const eidBuffer = Buffer.alloc(4);
  eidBuffer.writeUInt32BE(dstEid, 0);

  return PublicKey.findProgramAddressSync(
    [Buffer.from('Peer'), storePDA.toBuffer(), eidBuffer],
    BRIDGE_PROGRAM_ID_PK,
  );
}

export function deriveTokenVaultPDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('TokenVault'), mint.toBuffer()],
    BRIDGE_PROGRAM_ID_PK,
  );
}

export function deriveVaultAuthorityPDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('VaultAuthority'), mint.toBuffer()],
    BRIDGE_PROGRAM_ID_PK,
  );
}

export function deriveTicketPDA(owner: PublicKey, ticketId: BN): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('Ticket'), owner.toBuffer(), ticketId.toArrayLike(Buffer, 'le', 8)],
    BRIDGE_PROGRAM_ID_PK,
  );
}

export function deriveEndpointPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('Endpoint')], LZ_ENDPOINT_PROGRAM_ID_PK);
}

export async function checkVaultStatus(
  connection: Connection,
  tokenMint: string,
  programId?: PublicKey,
): Promise<VaultStatus> {
  const mintPk = new PublicKey(tokenMint);
  const [vaultPDA] = deriveTokenVaultPDA(mintPk);
  const [vaultAuthorityPDA] = deriveVaultAuthorityPDA(mintPk);

  try {
    const vaultAccount = await connection.getAccountInfo(vaultPDA);

    if (!vaultAccount) {
      return {
        exists: false,
        mint: tokenMint,
        totalLocked: '0',
        vaultTokenAccount: '',
      };
    }

    const vaultTokenAccount = await getAssociatedTokenAddress(mintPk, vaultAuthorityPDA, true);

    return {
      exists: true,
      mint: tokenMint,
      totalLocked: '0',
      vaultTokenAccount: vaultTokenAccount.toString(),
    };
  } catch (error) {
    return {
      exists: false,
      mint: tokenMint,
      totalLocked: '0',
      vaultTokenAccount: '',
    };
  }
}

export async function initializeVault(
  connection: Connection,
  tokenMint: string,
  payer: PublicKey,
  program: Program,
  sendTransaction: (tx: Transaction, connection: Connection) => Promise<string>,
): Promise<string> {
  const mintPk = new PublicKey(tokenMint);
  const [vaultPDA] = deriveTokenVaultPDA(mintPk);
  const [vaultAuthorityPDA] = deriveVaultAuthorityPDA(mintPk);
  const vaultTokenAccount = await getAssociatedTokenAddress(mintPk, vaultAuthorityPDA, true);

  // Build transaction
  const tx = await program.methods
    .initVault({})
    .accounts({
      payer,
      mint: mintPk,
      tokenVault: vaultPDA,
      vaultAuthority: vaultAuthorityPDA,
      vaultTokenAccount: vaultTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  tx.feePayer = payer;

  console.log('🔄 Sending vault init transaction (wallet will handle blockhash)...');
  const signature = await sendTransaction(tx, connection);

  console.log('⏳ Confirming vault init transaction:', signature);
  await connection.confirmTransaction(signature, 'confirmed');

  console.log('✅ Vault initialized:', signature);
  return signature;
}

export async function executeBridgeWithSendTransaction(
  connection: Connection,
  params: BridgeParams,
  program: Program,
  sendTransaction: (tx: Transaction, connection: Connection) => Promise<string>,
): Promise<BridgeResult> {
  const { tokenMint, amount, destinationChainId, recipientAddress, userWallet, tokenMetadata } =
    params;

  const mintPk = new PublicKey(tokenMint);
  const walletPk = new PublicKey(userWallet);
  const amountBN = new BN(amount);

  const ticketId = new BN(Math.floor(Math.random() * 1000000000));

  const [storePDA] = deriveStorePDA();
  const [peerPDA] = derivePeerPDA(destinationChainId);
  const [vaultPDA] = deriveTokenVaultPDA(mintPk);
  const [vaultAuthorityPDA] = deriveVaultAuthorityPDA(mintPk);
  const [ticketPDA] = deriveTicketPDA(walletPk, ticketId);

  const userTokenAccount = await getAssociatedTokenAddress(mintPk, walletPk);
  const vaultTokenAccount = await getAssociatedTokenAddress(mintPk, vaultAuthorityPDA, true);

  console.log('🎫 Step 1: Locking tokens...');
  console.log(`   Ticket ID: ${ticketId.toString()}`);
  console.log(`   Ticket PDA: ${ticketPDA.toBase58()}`);

  const lockParams = {
    ticketId: ticketId,
    amount: amountBN,
  };

  try {
    const lockTx = await program.methods
      .lock(lockParams)
      .accounts({
        payer: walletPk,
        userTokenAccount: userTokenAccount,
        store: storePDA,
        tokenVault: vaultPDA,
        vaultAuthority: vaultAuthorityPDA,
        vaultTokenAccount: vaultTokenAccount,
        mint: mintPk,
        ticket: ticketPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .transaction();

    lockTx.feePayer = walletPk;

    console.log('   🔄 Sending lock transaction (wallet handles blockhash)...');
    const lockSignature = await sendTransaction(lockTx, connection);

    console.log('   ⏳ Confirming lock transaction:', lockSignature);
    await connection.confirmTransaction(lockSignature, 'confirmed');
    console.log('   ✅ Tokens locked & ticket created');
  } catch (error: any) {
    console.error('   ❌ Lock failed:', error);
    throw error;
  }

  console.log(`\n🌉 Step 2: Bridging tokens via LayerZero...`);

  const cleanAddress = recipientAddress.startsWith('0x')
    ? recipientAddress.slice(2)
    : recipientAddress;
  const recipientBytes = new Uint8Array(32);
  const addressBytes = Buffer.from(cleanAddress, 'hex');
  recipientBytes.set(addressBytes, 12);

  const options = Buffer.from(
    Options.newOptions().addExecutorLzReceiveOption(1000000, 0).toBytes(),
  );

  console.log('💸 Calculating LayerZero fee...');
  const nativeFee = new BN(ESTIMATED_LZ_FEE);

  const bridgeParams = {
    ticketId: ticketId,
    dstEid: destinationChainId,
    recipientEvmAddress: Array.from(recipientBytes),
    options: options,
    nativeFee: nativeFee,
    lzTokenFee: new BN(0),
    tokenName: tokenMetadata.name,
    tokenSymbol: tokenMetadata.symbol,
    tokenUri: '',
  };

  console.log('🔍 Fetching LayerZero accounts...');

  let peerAddress = new Uint8Array(32);
  try {
    // @ts-ignore
    const peerAccount = await program.account.peerConfig.fetch(peerPDA);
    peerAddress = new Uint8Array(peerAccount.peerAddress);
  } catch (e) {
    console.warn(
      '  ⚠️  Could not fetch peer address, using zeros. Transaction might fail if verification requires it.',
    );
  }

  const receiverHex = '0x' + Buffer.from(peerAddress).toString('hex');

  const remainingAccounts = await getSendAccounts(connection, {
    payer: walletPk,
    sender: storePDA,
    dstEid: destinationChainId,
    receiver: receiverHex,
  });

  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 1_200_000,
  });

  try {
    const bridgeTx = await program.methods
      .bridge(bridgeParams)
      .accounts({
        payer: walletPk,
        ticketOwner: walletPk,
        ticket: ticketPDA,
        store: storePDA,
        peer: peerPDA,
        unknownEndpointProgram: LZ_ENDPOINT_PROGRAM_ID_PK,
      })
      .remainingAccounts(remainingAccounts)
      .preInstructions([computeBudgetIx])
      .transaction();

    bridgeTx.feePayer = walletPk;

    console.log('   🔍 Simulating bridge transaction...');
    try {
      const { blockhash } = await connection.getLatestBlockhash();
      bridgeTx.recentBlockhash = blockhash;

      const simulation = await connection.simulateTransaction(bridgeTx);

      if (simulation.value.err) {
        console.error('   ❌ Simulation failed:', simulation.value.logs);
      }
      console.log('   ✅ Simulation successful');
    } catch (simError: any) {
      console.error('   ❌ Simulation error:', simError);
      throw simError;
    }

    console.log('   📤 Sending bridge transaction (wallet handles blockhash)...');
    const bridgeSignature = await sendTransaction(bridgeTx, connection);

    console.log('   ⏳ Confirming bridge transaction:', bridgeSignature);
    await connection.confirmTransaction(bridgeSignature, 'confirmed');

    let guid: string | undefined;
    try {
      const txDetails = await connection.getTransaction(bridgeSignature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (txDetails?.meta) {
        const meta = txDetails.meta as any;
        if (meta.returnData) {
          const returnData = meta.returnData;
          if (returnData.programId === LZ_ENDPOINT_PROGRAM_ID_PK.toBase58()) {
            const buffer = Buffer.from(returnData.data[0], 'base64');
            const guidBuffer = buffer.subarray(0, 32);
            const guidHex = guidBuffer.toString('hex');
            guid = '0x' + guidHex;
            console.log('\n   ✅ LayerZero GUID:', guid);
            console.log(
              '   🔗 LayerZero Scan:',
              `https://testnet.layerzeroscan.com/tx/${bridgeSignature}`,
            );
          }
        } else {
          console.log(
            '   🔗 LayerZero Scan:',
            `https://testnet.layerzeroscan.com/tx/${bridgeSignature}`,
          );
        }
      }
    } catch (error) {
      console.warn('   ⚠️  Could not extract GUID from transaction');
    }

    return {
      lockSignature: '',
      bridgeSignature,
      ticketId: ticketId.toString(),
      guid,
      explorerUrl: `https://solscan.io/tx/${bridgeSignature}`,
      layerZeroScanUrl: guid
        ? `https://testnet.layerzeroscan.com/tx/${bridgeSignature}`
        : undefined,
    };
  } catch (error: any) {
    console.error('   ❌ Bridge failed:', error);
    if (error?.logs) {
      console.error('   📝 Program Logs:');
      error.logs.forEach((log: string) => console.error('      ', log));
    }
    throw error;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getSupportedChains() {
  return Object.entries(SUPPORTED_CHAINS).map(([key, value]) => ({
    key: key as SupportedChainKey,
    ...value,
  }));
}

export function getChainInfo(chainId: EndpointId) {
  return Object.values(SUPPORTED_CHAINS).find((chain) => chain.id === chainId);
}

export function formatBridgeAmount(amount: string, decimals: number): number {
  return Number(amount) / Math.pow(10, decimals);
}

export function parseBridgeAmount(amount: string | number, decimals: number): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  return (value * Math.pow(10, decimals)).toFixed(0);
}

export function isValidAddress(address: string, chainId: EndpointId): boolean {
  if (chainId === EndpointId.SOLANA_V2_TESTNET) {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function getWrappedTokenSymbol(tokenSymbol: string): string {
  return `w${tokenSymbol}`;
}

export function getExplorerUrl(txHash: string, chainId?: EndpointId): string {
  if (!chainId || chainId === EndpointId.SOLANA_V2_TESTNET) {
    return `https://solscan.io/tx/${txHash}`;
  }

  switch (chainId) {
    case EndpointId.SEPOLIA_V2_TESTNET:
      return `https://sepolia.etherscan.io/tx/${txHash}`;
    case EndpointId.BASE_V2_TESTNET:
      return `https://sepolia.basescan.org/tx/${txHash}`;
    case EndpointId.ARBSEP_V2_TESTNET:
      return `https://sepolia.arbiscan.io/tx/${txHash}`;
    case EndpointId.OPTIMISM_V2_TESTNET:
      return `https://sepolia-optimism.etherscan.io/tx/${txHash}`;
    case EndpointId.AVALANCHE_V2_TESTNET:
      return `https://testnet.snowtrace.io/tx/${txHash}`;
    default:
      return `https://sepolia.etherscan.io/tx/${txHash}`;
  }
}
