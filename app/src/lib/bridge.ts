/**
 * LayerZero Bridge Library
 * 
 * This library provides functions to bridge tokens from Solana to EVM chains
 * using LayerZero protocol and our custom smart contract.
 */

import { PublicKey, Connection, SystemProgram, ComputeBudgetProgram, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';
import { Program, BN } from '@coral-xyz/anchor';
import { BRIDGE_PROGRAM_ID, LZ_ENDPOINT_PROGRAM_ID } from '@/configs/env.config';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export enum ChainId {
  ETHEREUM = 40161,
  BSC = 40102,
  POLYGON = 40109,
  AVALANCHE = 40106,
  ARBITRUM = 40110,
  OPTIMISM = 40111,
  BASE = 40245,
  LINEA = 40183,
  FANTOM = 40112,
  SOLANA = 40168,
}

export const SUPPORTED_CHAINS = {
  ethereum: { id: ChainId.ETHEREUM, name: 'Ethereum', nativeToken: 'ETH' },
  bsc: { id: ChainId.BSC, name: 'BNB Chain', nativeToken: 'BNB' },
  polygon: { id: ChainId.POLYGON, name: 'Polygon', nativeToken: 'MATIC' },
  avalanche: { id: ChainId.AVALANCHE, name: 'Avalanche', nativeToken: 'AVAX' },
  arbitrum: { id: ChainId.ARBITRUM, name: 'Arbitrum', nativeToken: 'ETH' },
  optimism: { id: ChainId.OPTIMISM, name: 'Optimism', nativeToken: 'ETH' },
  base: { id: ChainId.BASE, name: 'Base', nativeToken: 'ETH' },
  linea: { id: ChainId.LINEA, name: 'Linea', nativeToken: 'ETH' },
  fantom: { id: ChainId.FANTOM, name: 'Fantom', nativeToken: 'FTM' },
  solana: { id: ChainId.SOLANA, name: 'Solana', nativeToken: 'SOL' },
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
  destinationChainId: ChainId;
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

// ============================================================================
// CONSTANTS
// ============================================================================

const BRIDGE_PROGRAM_ID_PK = new PublicKey(BRIDGE_PROGRAM_ID);
const LZ_ENDPOINT_PROGRAM_ID_PK = new PublicKey(LZ_ENDPOINT_PROGRAM_ID);
const MESSAGE_LIB_PROGRAM_ID = new PublicKey('7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH');
const ESTIMATED_LZ_FEE = 100_000_000; // 0.1 SOL

// ============================================================================
// PDA DERIVATION FUNCTIONS
// ============================================================================

export function deriveStorePDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('Store')],
    BRIDGE_PROGRAM_ID_PK
  );
}

export function derivePeerPDA(dstEid: number): [PublicKey, number] {
  const [storePDA] = deriveStorePDA();
  const eidBuffer = Buffer.alloc(4);
  eidBuffer.writeUInt32BE(dstEid, 0);
  
  return PublicKey.findProgramAddressSync(
    [Buffer.from('Peer'), storePDA.toBuffer(), eidBuffer],
    BRIDGE_PROGRAM_ID_PK
  );
}

export function deriveTokenVaultPDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('TokenVault'), mint.toBuffer()],
    BRIDGE_PROGRAM_ID_PK
  );
}

export function deriveVaultAuthorityPDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('VaultAuthority'), mint.toBuffer()],
    BRIDGE_PROGRAM_ID_PK
  );
}

export function deriveTicketPDA(owner: PublicKey, ticketId: BN): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('Ticket'), owner.toBuffer(), ticketId.toArrayLike(Buffer, 'le', 8)],
    BRIDGE_PROGRAM_ID_PK
  );
}

export function deriveEndpointPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('Endpoint')],
    LZ_ENDPOINT_PROGRAM_ID_PK
  );
}

// ============================================================================
// LAYERZERO ACCOUNT DERIVATION
// ============================================================================

function deriveLzAccounts(
  sender: PublicKey,
  senderPDA: PublicKey,
  dstEid: number,
  peerPDA: PublicKey
): Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }> {
  
  const [endpointPDA] = deriveEndpointPDA();
  
  const [sendLibraryConfigPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('SendLibraryConfig'), senderPDA.toBuffer()],
    LZ_ENDPOINT_PROGRAM_ID_PK
  );
  
  const [defaultSendLibraryConfigPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('DefaultSendLibraryConfig'), senderPDA.toBuffer()],
    LZ_ENDPOINT_PROGRAM_ID_PK
  );
  
  const eidBuffer = Buffer.alloc(4);
  eidBuffer.writeUInt32BE(dstEid, 0);
  
  const [noncePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('Nonce'), senderPDA.toBuffer(), eidBuffer, peerPDA.toBuffer()],
    LZ_ENDPOINT_PROGRAM_ID_PK
  );
  
  const [pendingInboundNoncePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('PendingInboundNonce'), senderPDA.toBuffer(), eidBuffer, peerPDA.toBuffer()],
    LZ_ENDPOINT_PROGRAM_ID_PK
  );
  
  const [payloadHashPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('PayloadHash'), senderPDA.toBuffer(), eidBuffer, peerPDA.toBuffer()],
    LZ_ENDPOINT_PROGRAM_ID_PK
  );
  
  const [eventAuthorityPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('__event_authority')],
    LZ_ENDPOINT_PROGRAM_ID_PK
  );
  
  return [
    { pubkey: sender, isSigner: true, isWritable: true },
    { pubkey: endpointPDA, isSigner: false, isWritable: true },
    { pubkey: sendLibraryConfigPDA, isSigner: false, isWritable: false },
    { pubkey: defaultSendLibraryConfigPDA, isSigner: false, isWritable: false },
    { pubkey: MESSAGE_LIB_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: noncePDA, isSigner: false, isWritable: true },
    { pubkey: pendingInboundNoncePDA, isSigner: false, isWritable: true },
    { pubkey: payloadHashPDA, isSigner: false, isWritable: true },
    { pubkey: peerPDA, isSigner: false, isWritable: false },
    { pubkey: senderPDA, isSigner: false, isWritable: false },
    { pubkey: eventAuthorityPDA, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: LZ_ENDPOINT_PROGRAM_ID_PK, isSigner: false, isWritable: false },
  ];
}

// ============================================================================
// VAULT FUNCTIONS
// ============================================================================

export async function checkVaultStatus(
  connection: Connection,
  tokenMint: string,
  programId?: PublicKey
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
    
    const vaultTokenAccount = await getAssociatedTokenAddress(
      mintPk,
      vaultAuthorityPDA,
      true
    );
    
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
  sendTransaction: (tx: Transaction, connection: Connection) => Promise<string>
): Promise<string> {
  const mintPk = new PublicKey(tokenMint);
  const [vaultPDA] = deriveTokenVaultPDA(mintPk);
  const [vaultAuthorityPDA] = deriveVaultAuthorityPDA(mintPk);
  const vaultTokenAccount = await getAssociatedTokenAddress(
    mintPk,
    vaultAuthorityPDA,
    true
  );
  
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

// ============================================================================
// BRIDGE FUNCTIONS
// ============================================================================

export async function executeBridgeWithSendTransaction(
  connection: Connection,
  params: BridgeParams,
  program: Program,
  sendTransaction: (tx: Transaction, connection: Connection) => Promise<string>
): Promise<BridgeResult> {
  const {
    tokenMint,
    amount,
    destinationChainId,
    recipientAddress,
    userWallet,
    tokenMetadata,
  } = params;
  
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
  const vaultTokenAccount = await getAssociatedTokenAddress(
    mintPk,
    vaultAuthorityPDA,
    true
  );
  
  // ============================================================================
  // Step 1: Lock Tokens
  // ============================================================================
  
  console.log('Step 1: Locking tokens...');
  
  const lockParams = {
    ticket_id: ticketId,
    amount: amountBN,
  };
  
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
  
  console.log('Sending lock transaction (wallet handles blockhash)...');
  const lockSignature = await sendTransaction(lockTx, connection);
  
  console.log('⏳ Confirming lock transaction:', lockSignature);
  await connection.confirmTransaction(lockSignature, 'confirmed');
  console.log('✅ Lock successful:', lockSignature);
  
  // ============================================================================
  // Step 2: Bridge Tokens
  // ============================================================================
  
  console.log('🌉 Step 2: Bridging tokens via LayerZero...');
  
  const cleanAddress = recipientAddress.startsWith('0x') 
    ? recipientAddress.slice(2) 
    : recipientAddress;
  const recipientBytes = new Uint8Array(32);
  const addressBytes = Buffer.from(cleanAddress, 'hex');
  recipientBytes.set(addressBytes, 12);
  
  const options = Buffer.from([0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0f, 0x42, 0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  
  const nativeFee = new BN(ESTIMATED_LZ_FEE);
  
  const finalTokenUri = tokenMetadata.uri && tokenMetadata.uri.trim() !== ''
    ? tokenMetadata.uri
    : 'https://arweave.net/default';
  
  const bridgeParams = {
    ticket_id: ticketId,
    dst_eid: destinationChainId,
    recipient_evm_address: Array.from(recipientBytes),
    options: Array.from(options),
    native_fee: nativeFee,
    lz_token_fee: new BN(0),
    token_name: tokenMetadata.name.slice(0, 32),
    token_symbol: tokenMetadata.symbol.slice(0, 8),
    token_uri: finalTokenUri,
  };
  
  const remainingAccounts = deriveLzAccounts(
    walletPk,
    storePDA,
    destinationChainId,
    peerPDA
  );
  
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 600_000,
  });
  
  const bridgeTx = await program.methods
    .bridge(bridgeParams)
    .accounts({
      payer: walletPk,
      ticket: ticketPDA,
      owner: walletPk,
      store: storePDA,
      peer: peerPDA,
      unknownEndpointProgram: LZ_ENDPOINT_PROGRAM_ID_PK,
    })
    .remainingAccounts(remainingAccounts)
    .preInstructions([computeBudgetIx])
    .transaction();
  
  bridgeTx.feePayer = walletPk;
  
  console.log('📤 Sending bridge transaction (wallet handles blockhash)...');
  const bridgeSignature = await sendTransaction(bridgeTx, connection);
  
  console.log('⏳ Confirming bridge transaction:', bridgeSignature);
  await connection.confirmTransaction(bridgeSignature, 'confirmed');
  console.log('✅ Bridge successful:', bridgeSignature);
  
  // Try to extract GUID
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
        if (returnData.programId === LZ_ENDPOINT_PROGRAM_ID) {
          const buffer = Buffer.from(returnData.data[0], 'base64');
          const guidBuffer = buffer.subarray(0, 32);
          guid = '0x' + guidBuffer.toString('hex');
        }
      }
    }
  } catch (error) {
    console.warn('Could not extract GUID from transaction');
  }
  
  return {
    lockSignature,
    bridgeSignature,
    ticketId: ticketId.toString(),
    guid,
    explorerUrl: `https://solscan.io/tx/${bridgeSignature}`,
    layerZeroScanUrl: guid ? `https://layerzeroscan.com/tx/${bridgeSignature}` : undefined,
  };
}

export async function executeBridgeWithWallet(
  connection: Connection,
  params: BridgeParams,
  program: Program,
  wallet: any,
  sendAndConfirm: (connection: any, tx: any, wallet: any) => Promise<string>
): Promise<BridgeResult> {
  const {
    tokenMint,
    amount,
    destinationChainId,
    recipientAddress,
    userWallet,
    tokenMetadata,
  } = params;
  
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
  const vaultTokenAccount = await getAssociatedTokenAddress(
    mintPk,
    vaultAuthorityPDA,
    true
  );
  
  // ============================================================================
  // Step 1: Lock Tokens
  // ============================================================================
  
  console.log('Step 1: Locking tokens...');
  
  const lockParams = {
    ticket_id: ticketId,
    amount: amountBN,
  };
  
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
  
  const lockSignature = await sendAndConfirm(connection, lockTx, wallet);
  console.log('✅ Lock successful:', lockSignature);
  
  // ============================================================================
  // Step 2: Bridge Tokens
  // ============================================================================
  
  console.log('🌉 Step 2: Bridging tokens via LayerZero...');
  
  const cleanAddress = recipientAddress.startsWith('0x') 
    ? recipientAddress.slice(2) 
    : recipientAddress;
  const recipientBytes = new Uint8Array(32);
  const addressBytes = Buffer.from(cleanAddress, 'hex');
  recipientBytes.set(addressBytes, 12);
  
  const options = Buffer.from([0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0f, 0x42, 0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  
  const nativeFee = new BN(ESTIMATED_LZ_FEE);
  
  const finalTokenUri = tokenMetadata.uri && tokenMetadata.uri.trim() !== ''
    ? tokenMetadata.uri
    : 'https://arweave.net/default';
  
  const bridgeParams = {
    ticket_id: ticketId,
    dst_eid: destinationChainId,
    recipient_evm_address: Array.from(recipientBytes),
    options: Array.from(options),
    native_fee: nativeFee,
    lz_token_fee: new BN(0),
    token_name: tokenMetadata.name.slice(0, 32),
    token_symbol: tokenMetadata.symbol.slice(0, 8),
    token_uri: finalTokenUri,
  };
  
  const remainingAccounts = deriveLzAccounts(
    walletPk,
    storePDA,
    destinationChainId,
    peerPDA
  );
  
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 600_000,
  });
  
  const bridgeTx = await program.methods
    .bridge(bridgeParams)
    .accounts({
      payer: walletPk,
      ticket: ticketPDA,
      owner: walletPk,
      store: storePDA,
      peer: peerPDA,
      unknownEndpointProgram: LZ_ENDPOINT_PROGRAM_ID_PK,
    })
    .remainingAccounts(remainingAccounts)
    .preInstructions([computeBudgetIx])
    .transaction();
  
  bridgeTx.feePayer = walletPk;
  
  const bridgeSignature = await sendAndConfirm(connection, bridgeTx, wallet);
  console.log('✅ Bridge successful:', bridgeSignature);
  
  // Try to extract GUID
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
        if (returnData.programId === LZ_ENDPOINT_PROGRAM_ID) {
          const buffer = Buffer.from(returnData.data[0], 'base64');
          const guidBuffer = buffer.subarray(0, 32);
          guid = '0x' + guidBuffer.toString('hex');
        }
      }
    }
  } catch (error) {
    console.warn('Could not extract GUID from transaction');
  }
  
  return {
    lockSignature,
    bridgeSignature,
    ticketId: ticketId.toString(),
    guid,
    explorerUrl: `https://solscan.io/tx/${bridgeSignature}`,
    layerZeroScanUrl: guid ? `https://layerzeroscan.com/tx/${bridgeSignature}` : undefined,
  };
}

export async function executeBridge(
  connection: Connection,
  params: BridgeParams,
  program: Program,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<BridgeResult> {
  const {
    tokenMint,
    amount,
    destinationChainId,
    recipientAddress,
    userWallet,
    tokenMetadata,
  } = params;
  
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
  const vaultTokenAccount = await getAssociatedTokenAddress(
    mintPk,
    vaultAuthorityPDA,
    true
  );
  
  // ============================================================================
  // Step 1: Lock Tokens
  // ============================================================================
  
  console.log('Step 1: Locking tokens...');
  
  const lockParams = {
    ticket_id: ticketId,
    amount: amountBN,
  };
  
  const lockIx = await program.methods
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
    .instruction();
  
  const { blockhash: lockBlockhash, lastValidBlockHeight: lockLastValid } = 
    await connection.getLatestBlockhash('finalized');
  
  const lockTx = new Transaction({
    feePayer: walletPk,
    blockhash: lockBlockhash,
    lastValidBlockHeight: lockLastValid,
  }).add(lockIx);
  
  console.log('🔄 Signing lock transaction...');
  const signedLockTx = await signTransaction(lockTx);
  
  console.log('📤 Sending lock transaction...');
  const lockSignature = await connection.sendRawTransaction(signedLockTx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  
  console.log('⏳ Confirming lock transaction:', lockSignature);
  await connection.confirmTransaction({
    signature: lockSignature,
    blockhash: lockBlockhash,
    lastValidBlockHeight: lockLastValid,
  }, 'confirmed');
  
  console.log('✅ Lock successful:', lockSignature);
  
  // ============================================================================
  // Step 2: Bridge Tokens
  // ============================================================================
  
  console.log('🌉 Step 2: Bridging tokens via LayerZero...');
  
  const cleanAddress = recipientAddress.startsWith('0x') 
    ? recipientAddress.slice(2) 
    : recipientAddress;
  const recipientBytes = new Uint8Array(32);
  const addressBytes = Buffer.from(cleanAddress, 'hex');
  recipientBytes.set(addressBytes, 12);
  
  const options = Buffer.from([0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0f, 0x42, 0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  
  const nativeFee = new BN(ESTIMATED_LZ_FEE);
  
  const finalTokenUri = tokenMetadata.uri && tokenMetadata.uri.trim() !== ''
    ? tokenMetadata.uri
    : 'https://arweave.net/default';
  
  const bridgeParams = {
    ticket_id: ticketId,
    dst_eid: destinationChainId,
    recipient_evm_address: Array.from(recipientBytes),
    options: Array.from(options),
    native_fee: nativeFee,
    lz_token_fee: new BN(0),
    token_name: tokenMetadata.name.slice(0, 32),
    token_symbol: tokenMetadata.symbol.slice(0, 8),
    token_uri: finalTokenUri,
  };
  
  const remainingAccounts = deriveLzAccounts(
    walletPk,
    storePDA,
    destinationChainId,
    peerPDA
  );
  
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 600_000,
  });
  
  const bridgeIx = await program.methods
    .bridge(bridgeParams)
    .accounts({
      payer: walletPk,
      ticket: ticketPDA,
      owner: walletPk,
      store: storePDA,
      peer: peerPDA,
      unknownEndpointProgram: LZ_ENDPOINT_PROGRAM_ID_PK,
    })
    .remainingAccounts(remainingAccounts)
    .instruction();
  
  const { blockhash: bridgeBlockhash, lastValidBlockHeight: bridgeLastValid } = 
    await connection.getLatestBlockhash('finalized');
  
  const bridgeTx = new Transaction({
    feePayer: walletPk,
    blockhash: bridgeBlockhash,
    lastValidBlockHeight: bridgeLastValid,
  }).add(computeBudgetIx, bridgeIx);
  
  console.log('🔄 Signing bridge transaction...');
  const signedBridgeTx = await signTransaction(bridgeTx);
  
  console.log('📤 Sending bridge transaction...');
  const bridgeSignature = await connection.sendRawTransaction(signedBridgeTx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  
  console.log('⏳ Confirming bridge transaction:', bridgeSignature);
  await connection.confirmTransaction({
    signature: bridgeSignature,
    blockhash: bridgeBlockhash,
    lastValidBlockHeight: bridgeLastValid,
  }, 'confirmed');
  
  console.log('✅ Bridge successful:', bridgeSignature);
  
  // Try to extract GUID
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
        if (returnData.programId === LZ_ENDPOINT_PROGRAM_ID) {
          const buffer = Buffer.from(returnData.data[0], 'base64');
          const guidBuffer = buffer.subarray(0, 32);
          guid = '0x' + guidBuffer.toString('hex');
        }
      }
    }
  } catch (error) {
    console.warn('Could not extract GUID from transaction');
  }
  
  return {
    lockSignature,
    bridgeSignature,
    ticketId: ticketId.toString(),
    guid,
    explorerUrl: `https://solscan.io/tx/${bridgeSignature}`,
    layerZeroScanUrl: guid ? `https://layerzeroscan.com/tx/${bridgeSignature}` : undefined,
  };
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

export function getChainInfo(chainId: ChainId) {
  return Object.values(SUPPORTED_CHAINS).find(chain => chain.id === chainId);
}

export function formatBridgeAmount(amount: string, decimals: number): number {
  return Number(amount) / Math.pow(10, decimals);
}

export function parseBridgeAmount(amount: string | number, decimals: number): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  return (value * Math.pow(10, decimals)).toFixed(0);
}

export function estimateBridgeTime(srcChainId: ChainId, dstChainId: ChainId): number {
  return 180;
}

export function isValidAddress(address: string, chainId: ChainId): boolean {
  if (chainId === ChainId.SOLANA) {
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

export function getExplorerUrl(txHash: string, chainId?: ChainId): string {
  if (!chainId || chainId === ChainId.SOLANA) {
    return `https://solscan.io/tx/${txHash}`;
  }
  
  switch (chainId) {
    case ChainId.ETHEREUM:
      return `https://etherscan.io/tx/${txHash}`;
    case ChainId.BASE:
      return `https://basescan.org/tx/${txHash}`;
    case ChainId.ARBITRUM:
      return `https://arbiscan.io/tx/${txHash}`;
    case ChainId.POLYGON:
      return `https://polygonscan.com/tx/${txHash}`;
    default:
      return `https://etherscan.io/tx/${txHash}`;
  }
}