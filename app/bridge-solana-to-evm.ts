import * as anchor from '@coral-xyz/anchor';
import { Program, BN, Wallet } from '@coral-xyz/anchor';
import {
  PublicKey,
  Connection,
  Keypair,
  SystemProgram,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
} from '@solana/spl-token';
import { Zaunchpad } from '../target/types/zaunchpad';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey } from '@metaplex-foundation/umi';
import { fetchMetadata, findMetadataPda } from '@metaplex-foundation/mpl-token-metadata';
import { SendHelper } from '@layerzerolabs/lz-solana-sdk-v2';
import { Options } from '@layerzerolabs/lz-v2-utilities';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { EndpointId } from '@layerzerolabs/lz-definitions';

/**
 * Example: Bridge an existing SPL token from Solana to EVM chain using LayerZero
 *
 * This example demonstrates how to:
 * 1. Connect to Solana and load the token bridge program
 * 2. Fetch token metadata from Metaplex
 * 3. Lock SPL tokens in a vault
 * 4. Send a cross-chain message to mint equivalent tokens on EVM
 *
 * Token: D6M7cYVuRDci76MoLa1bgdh6sTzGPw9xYrttbuzvfFhH
 */

async function main() {
  // ============================================================================
  // Configuration
  // ============================================================================

  // Load environment variables
  const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const SOLANA_KEYPAIR_PATH =
    process.env.SOLANA_KEYPAIR_PATH || path.join(process.env.HOME || '~', '.config/solana/id.json');

  console.log('🚀 Starting Token Bridge Example');
  console.log('RPC URL:', SOLANA_RPC_URL);
  console.log('Keypair Path:', SOLANA_KEYPAIR_PATH);

  // Load keypair from file
  if (!fs.existsSync(SOLANA_KEYPAIR_PATH)) {
    throw new Error(`Keypair file not found at: ${SOLANA_KEYPAIR_PATH}`);
  }

  const keypairData = JSON.parse(fs.readFileSync(SOLANA_KEYPAIR_PATH, 'utf-8'));
  const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
  const wallet = new Wallet(keypair);

  console.log('Wallet:', wallet.publicKey.toString());

  // Set up connection and provider
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  anchor.setProvider(provider);

  // Load program
  const programId = new PublicKey('5KZn4QgDQs8MaPEt8D852cpog3h7C9E2TbsrqWb4dWfU');
  const idl = JSON.parse(fs.readFileSync('./target/idl/zaunchpad.json', 'utf-8'));
  // Fix the address in IDL if it's corrupted
  idl.address = programId.toString();
  const program = new Program(idl, provider) as Program<Zaunchpad>;

  console.log('Program ID:', program.programId.toString());

  // Token configuration
  const TOKEN_MINT = new PublicKey('8ofaztLG7uhMZ3hzHk5YSt9Xm4KZn7m5cghn4sBM3fLh');
  const AMOUNT_TO_BRIDGE = new BN(1_000_000_000);

  // EVM Chain configurations
  const EVM_CHAINS = {
    '1': {
      name: 'Sepolia',
      eid: EndpointId.SEPOLIA_V2_TESTNET,
      address: '0x42f8FF3550cAB12662E92ed6E75c0bf1e877216B',
    },
    '2': {
      name: 'Optimism Sepolia',
      eid: EndpointId.OPTSEP_V2_TESTNET,
      address: '0xfd48f8e855Aee39d4954B89C30cE115A26575C47',
    },
    '3': {
      name: 'Base Sepolia',
      eid: EndpointId.BASESEP_TESTNET,
      address: '0xfd48f8e855Aee39d4954B89C30cE115A26575C47',
    },
    '4': {
      name: 'Arbitrum Sepolia',
      eid: EndpointId.ARBSEP_V2_TESTNET,
      address: '0xfd48f8e855Aee39d4954B89C30cE115A26575C47',
    },
    '5': {
      name: 'Avalanche Fuji',
      eid: EndpointId.AVALANCHE_V2_TESTNET,
      address: '0x9cbe33d14aF7d8d91B5053aCf38C27b461A5155D',
    },
  };

  // Display chain selection menu
  console.log('\n🌐 Select destination EVM chain:');
  Object.entries(EVM_CHAINS).forEach(([key, chain]) => {
    console.log(`  ${key}. ${chain.name} (EID: ${chain.eid})`);
  });

  // Get user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const selectedChain = await new Promise<(typeof EVM_CHAINS)[keyof typeof EVM_CHAINS]>(
    (resolve) => {
      rl.question('\nEnter chain number (1-5): ', (answer) => {
        rl.close();
        const chain = EVM_CHAINS[answer as keyof typeof EVM_CHAINS];
        if (!chain) {
          console.error('❌ Invalid selection, using Sepolia as default');
          resolve(EVM_CHAINS['1']);
        } else {
          resolve(chain);
        }
      });
    },
  );

  // LayerZero configuration
  const DST_EID = selectedChain.eid;
  // EVM recipient address (example - replace with your actual address)
  const EVM_RECIPIENT = '0x3A0571538d772ab764C1cE8f2e08F6Bb52beC3fb';

  // ============================================================================
  // Derive PDAs (Program Derived Addresses)
  // ============================================================================

  const [storePDA] = PublicKey.findProgramAddressSync([Buffer.from('Store')], program.programId);

  // Create big-endian bytes for EID (matching Rust's to_be_bytes())
  const eidBuffer = Buffer.alloc(4);
  eidBuffer.writeUInt32BE(DST_EID, 0);

  const [peerPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('Peer'), storePDA.toBuffer(), eidBuffer],
    program.programId,
  );

  const [tokenVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('TokenVault'), TOKEN_MINT.toBuffer()],
    program.programId,
  );

  const [vaultAuthorityPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('VaultAuthority'), TOKEN_MINT.toBuffer()],
    program.programId,
  );

  const [endpointPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('Endpoint')],
    new PublicKey('76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6'), // LayerZero Endpoint program ID
  );

  // Define Constant for Endpoint Program ID
  const LZ_ENDPOINT_PROGRAM_ID = new PublicKey('76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6');

  const [enforcedOptionsPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('Peer'), storePDA.toBuffer(), TOKEN_MINT.toBuffer(), eidBuffer],
    program.programId,
  );

  console.log('\n📍 Derived PDAs:');
  console.log('  Store:', storePDA.toString());
  console.log('  Peer Config:', peerPDA.toString());
  console.log('  Token Vault:', tokenVaultPDA.toString());
  console.log('  Vault Authority:', vaultAuthorityPDA.toString());
  console.log('  Endpoint:', endpointPDA.toString());
  console.log('  Enforced Options:', enforcedOptionsPDA.toString());

  // ============================================================================
  // Fetch Token Metadata
  // ============================================================================

  console.log('\n🔍 Fetching token metadata...');

  // Get token mint info
  const mintInfo = await connection.getParsedAccountInfo(TOKEN_MINT);
  const parsedMint = (mintInfo.value?.data as any).parsed.info;
  const decimals = parsedMint.decimals;

  // Fetch metadata from Metaplex using UMI
  const metaplexUmi = createUmi(connection.rpcEndpoint);
  const metadataPda = findMetadataPda(metaplexUmi, { mint: publicKey(TOKEN_MINT.toString()) });

  let tokenName = 'Unknown Token';
  let tokenSymbol = 'UNKNOWN';
  let tokenUri = '';

  try {
    const metadata = await fetchMetadata(metaplexUmi, metadataPda);
    tokenName = metadata.name.replace(/\0/g, '').trim();
    tokenSymbol = metadata.symbol.replace(/\0/g, '').trim();
    tokenUri = metadata.uri.replace(/\0/g, '').trim();

    console.log('  Name:', tokenName);
    console.log('  Symbol:', tokenSymbol);
    console.log('  Decimals:', decimals);
    console.log('  URI:', tokenUri);
  } catch (error) {
    console.log('  ⚠️  Could not fetch Metaplex metadata, using defaults');
    console.log('  Decimals:', decimals);
  }

  // ============================================================================
  // Get User's Token Account
  // ============================================================================

  const userTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT, wallet.publicKey);

  console.log('\n💰 User Token Account:', userTokenAccount.toString());

  try {
    const tokenAccountInfo = await getAccount(connection, userTokenAccount);
    console.log('  Balance:', tokenAccountInfo.amount.toString());
  } catch (error) {
    console.error('❌ Error: User does not have a token account for this mint');
    console.error('   Please create a token account and acquire some tokens first');
    return;
  }

  // ============================================================================
  // Check and Auto-Initialize Token Vault
  // ============================================================================

  console.log('\n🏦 Checking Token Vault...');

  // Get vault token account address
  const vaultTokenAccount = await getAssociatedTokenAddress(
    TOKEN_MINT,
    vaultAuthorityPDA,
    true, // allowOwnerOffCurve for PDA
  );

  let vaultExists = false;
  try {
    const vaultAccount = await program.account.tokenVault.fetch(tokenVaultPDA);
    vaultExists = true;
    console.log('  ✅ Token Vault exists');
    console.log('     Total Locked:', vaultAccount.totalLocked.toString());
    console.log('     Vault Token Account:', vaultTokenAccount.toString());
  } catch (error) {
    console.log('  ⚠️  Token Vault not found, will initialize automatically...');
  }

  // Auto-initialize vault if it doesn't exist (permissionless - anyone can do this)
  if (!vaultExists) {
    console.log('\n  🔧 Initializing Token Vault (first-time setup)...');
    console.log('  ℹ️  Anyone can initialize a vault for any token (permissionless)');
    console.log('  📍 Vault PDA:', tokenVaultPDA.toString());
    console.log('  📍 Vault Authority:', vaultAuthorityPDA.toString());
    console.log('  📍 Vault Token Account:', vaultTokenAccount.toString());

    try {
      // Create init vault transaction (no admin check needed - permissionless!)
      const signature = await program.methods
        .initVault({})
        .accounts({
          payer: wallet.publicKey,
          mint: TOKEN_MINT,
          tokenVault: tokenVaultPDA,
          vaultAuthority: vaultAuthorityPDA,
          vaultTokenAccount: vaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('  ✅ Vault initialized!');
      console.log('     Transaction:', signature);
      console.log('     Explorer:', `https://explorer.solana.com/tx/${signature}?cluster=devnet`);

      // Verify vault was created
      const vaultAccount = await program.account.tokenVault.fetch(tokenVaultPDA);
      console.log('  ✅ Vault verified');
      console.log('     Mint:', vaultAccount.mint.toString());
      console.log('     Total Locked:', vaultAccount.totalLocked.toString());
    } catch (error: any) {
      console.error('\n  ❌ Failed to initialize vault:');
      console.error(error);

      if (error?.logs) {
        console.error('\n  📝 Program Logs:');
        error.logs.forEach((log: string) => console.error('    ', log));
      }

      throw new Error('Vault initialization failed. Please check the error above.');
    }
  }

  // Remove 0x prefix if present
  const cleanAddress = EVM_RECIPIENT.startsWith('0x') ? EVM_RECIPIENT.slice(2) : EVM_RECIPIENT;

  // Pad address to 32 bytes (20 bytes address + 12 bytes zeros at the start)
  const recipientBytes = new Uint8Array(32);
  const addressBytes = Buffer.from(cleanAddress, 'hex');
  recipientBytes.set(addressBytes, 12); // Left-pad with zeros

  console.log('\n🎯 Destination:');
  console.log('  Chain:', selectedChain.name);
  console.log('  Chain EID:', DST_EID);
  console.log('  TokenBridge Contract:', selectedChain.address);
  console.log('  Recipient (EVM):', '0x' + cleanAddress);

  const options = Options.newOptions().addExecutorLzReceiveOption(1000000, 0).toBytes();

  // Get fee quote placeholder (will be calculated before bridging)
  let nativeFee = new BN(0);

  console.log('\n Preparing lock and bridge transaction...');
  console.log('  Amount:', AMOUNT_TO_BRIDGE.toString());

  console.log('\n🔧 Building LayerZero endpoint accounts...');
  const sendHelper = new SendHelper();

  let peerAddress = new Uint8Array(32);
  try {
    const peerAccount = await program.account.peerConfig.fetch(peerPDA);
    peerAddress = new Uint8Array(peerAccount.peerAddress);
  } catch (e) {
    console.warn(
      'Could not fetch peer address, using zeros. Transaction might fail if verification requires it.',
    );
  }

  const receiverHex = '0x' + Buffer.from(peerAddress).toString('hex');

  const remainingAccounts = await sendHelper.getSendAccounts(
    connection,
    wallet.publicKey,
    storePDA, // sender
    DST_EID,
    receiverHex, // receiver (string)
    'confirmed',
  );

  if (!remainingAccounts) {
    throw new Error('Failed to generate remaining accounts for LayerZero endpoint.');
  }

  console.log(`  ✅ Generated ${remainingAccounts.length} remaining accounts for Endpoint CPI`);

  // Execute Lock and Bridge (Two-Step Process)
  // ============================================================================

  console.log('\n✅ Starting two-step lock and bridge process...');

  try {
    // ============================================================================
    // Step 1: Lock Tokens (Create Ticket)
    // ============================================================================

    const ticketId = new BN(Math.floor(Math.random() * 1000000000)); // Random ID

    // Derive Ticket PDA
    const [ticketPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('Ticket'), wallet.publicKey.toBuffer(), ticketId.toArrayLike(Buffer, 'le', 8)],
      program.programId,
    );

    console.log(`\n🎫 Step 1: Locking tokens...`);
    console.log(`   Ticket ID: ${ticketId.toString()}`);
    console.log(`   Ticket PDA: ${ticketPDA.toBase58()}`);

    // Lock Params
    const lockParams = {
      ticketId: ticketId,
      amount: AMOUNT_TO_BRIDGE,
    };

    try {
      const txLock = await program.methods
        .lock(lockParams)
        .accounts({
          payer: wallet.publicKey,
          userTokenAccount: userTokenAccount,
          store: storePDA,
          tokenVault: tokenVaultPDA,
          vaultAuthority: vaultAuthorityPDA,
          vaultTokenAccount: vaultTokenAccount,
          mint: TOKEN_MINT,
          ticket: ticketPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log(
        `   ✅ Lock Transaction: https://explorer.solana.com/tx/${txLock}?cluster=devnet`,
      );
      await connection.confirmTransaction(txLock, 'confirmed');
      console.log(`   ✅ Tokens locked & ticket created`);
    } catch (e) {
      console.error('   ❌ Lock failed:', e);
      throw e;
    }

    // ============================================================================
    // Step 2: Bridge Tokens (Consume Ticket & Send LayerZero)
    // ============================================================================

    console.log(`\n🌉 Step 2: Bridging tokens to ${selectedChain.name}...`);
    console.log('💸 Calculating LayerZero fee...');
    const ESTIMATED_FEE = 100_000_000;
    nativeFee = new BN(ESTIMATED_FEE);

    const bridgeParams = {
      ticketId: ticketId,
      dstEid: DST_EID,
      recipientEvmAddress: Array.from(recipientBytes),
      options: Buffer.from(Array.from(options)),
      nativeFee: nativeFee,
      lzTokenFee: new BN(0),
      tokenName: tokenName.slice(0, 32),
      tokenSymbol: tokenSymbol.slice(0, 8),
      tokenUri: tokenUri.slice(0, 200),
    };

    try {
      const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 600_000,
      });

      const txBridge = await program.methods
        .bridge(bridgeParams)
        .accounts({
          payer: wallet.publicKey,
          ticketOwner: wallet.publicKey,
          ticket: ticketPDA,
          store: storePDA,
          peer: peerPDA,
          unknownEndpointProgram: LZ_ENDPOINT_PROGRAM_ID,
        })
        .remainingAccounts(remainingAccounts)
        .preInstructions([computeBudgetIx])
        .rpc();

      console.log(
        `   ✅ Bridge Transaction: https://explorer.solana.com/tx/${txBridge}?cluster=devnet`,
      );

      // Wait for confirmation to get logs
      await connection.confirmTransaction(txBridge, 'confirmed');

      // Parse logs for GUID
      const txDetails = await connection.getTransaction(txBridge, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (txDetails?.meta) {
        const meta = txDetails.meta as any;
        if (meta.returnData) {
          const returnData = meta.returnData;
          if (returnData.programId === LZ_ENDPOINT_PROGRAM_ID.toBase58()) {
            const buffer = Buffer.from(returnData.data[0], 'base64');
            const guidBuffer = buffer.subarray(0, 32);
            const guidHex = guidBuffer.toString('hex');
            console.log('\n✅ LayerZero GUID:', `0x${guidHex}`);
            console.log('🔗 LayerZero Scan:', `https://testnet.layerzeroscan.com/tx/${txBridge}`);
          }
        } else {
          console.log('🔗 LayerZero Scan:', `https://testnet.layerzeroscan.com/tx/${txBridge}`);
        }
      }
    } catch (e) {
      console.error('   ❌ Bridge failed:', e);
      if (e instanceof anchor.AnchorError) {
        console.error('   Logs:', e.logs);
      }
      throw e;
    }

    console.log(`\n✅ Bridge completed successfully!`);
    console.log(`   ${AMOUNT_TO_BRIDGE.toString()} tokens locked on Solana`);
    console.log(`   Cross-chain message sent to ${selectedChain.name} (EID: ${DST_EID})`);
    console.log(`   Recipient: 0x${cleanAddress}`);
  } catch (error: any) {
    console.error('\n❌ Transaction failed:');
    console.error(error);

    if (error?.logs) {
      console.error('\n📝 Program Logs:');
      error.logs.forEach((log: string) => console.error('  ', log));
    }
  }
}

main()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:');
    console.error(error);
    process.exit(1);
  });
