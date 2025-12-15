#!/usr/bin/env node
/**
 * Deposit Recovery Script
 * 
 * This script calls the TEE directly with the correct escrow_z_address
 * to generate proof tickets for stuck deposits.
 * 
 * Usage: 
 *   cd /Users/hilary/solana-zk-proof-example/zaunch/app/scripts
 *   pnpm add @noble/curves @noble/ciphers @noble/hashes
 *   node recover-deposits.js
 */

import { x25519 } from '@noble/curves/ed25519.js';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/ciphers/utils.js';
import fs from 'fs';

// Configuration
const TEE_ENDPOINT = 'https://66a817b166c0b222ae386af54c178986e90beb0a-3000.dstack-pha-prod7.phala.network';

// Stuck deposits to recover - add your deposits here
const STUCK_DEPOSITS = [
  {
    depositAddress: 'FKYZ7RzVR6rLTtYwAhH5tbkGRetxFBYxUBTAL15zjFYX',
    escrowZAddress: 't1gfohgBxBm7HX1nJ43tmPTDwix2oatwDSE',
    creatorAddress: 't1Yf8KMstVBhiJATMqcqbbvMb8okxortfsN',
    launchPda: '8qvS952UCLYLyY6WWoZsaeV7UHCXuSqBsGFhfijAY5oo',
    userPubkey: 'E1YEzC6c5XSLzXZM5QLfz8mRTXhnQ7ecLXFjkZYEfknw',
    launchId: 'TestToken_3209NZ',
    tokenMint: '',
    tokenSymbol: 'TEST',
    pricePerToken: 1000000,
    amountToSell: 1000000000,
    decimals: 9,
    tokensPerProof: 100000000,
  },
  // Add more deposits as needed - just copy the block above and change the values
];

// Helper functions
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Derive encryption key using SHA256 (matches TEE's derive_key function)
function deriveKey(sharedSecret) {
  const encoder = new TextEncoder();
  const suffix = encoder.encode('tee-proof-generator-key-v1');
  const combined = new Uint8Array(sharedSecret.length + suffix.length);
  combined.set(sharedSecret);
  combined.set(suffix, sharedSecret.length);
  return sha256(combined);
}

// Generate X25519 key pair
function generateKeyPair() {
  const privateKey = randomBytes(32);
  const publicKey = x25519.getPublicKey(privateKey);
  return { publicKey, privateKey };
}

// Derive shared secret using X25519
function deriveSharedSecret(privateKey, publicKey) {
  return x25519.getSharedSecret(privateKey, publicKey);
}

// Encrypt data using ChaCha20-Poly1305
function encryptChaCha(key, plaintext) {
  const nonce = randomBytes(12);
  const cipher = chacha20poly1305(key, nonce);
  const ciphertext = cipher.encrypt(plaintext);
  return { ciphertext, nonce };
}

// Decrypt data using ChaCha20-Poly1305
function decryptChaCha(key, ciphertext, nonce) {
  const cipher = chacha20poly1305(key, nonce);
  return cipher.decrypt(ciphertext);
}

async function recoverDeposit(deposit) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Recovering deposit: ${deposit.depositAddress}`);
  console.log(`Escrow address: ${deposit.escrowZAddress}`);
  console.log(`${'='.repeat(60)}`);

  try {
    // Step 1: Get enclave public key
    console.log('\n[1] Getting TEE public key...');
    const pubkeyResp = await fetch(`${TEE_ENDPOINT}/pubkey`);
    if (!pubkeyResp.ok) {
      throw new Error(`Failed to get TEE pubkey: ${pubkeyResp.statusText}`);
    }
    const { pubkey: enclavePubkeyHex } = await pubkeyResp.json();
    const enclavePubkey = hexToBytes(enclavePubkeyHex);
    console.log('   ✅ Got TEE public key:', enclavePubkeyHex.slice(0, 16) + '...');

    // Step 2: Generate keypairs
    console.log('\n[2] Generating encryption keys...');
    const userKeyPair = generateKeyPair();
    const ephemeralKeyPair = generateKeyPair();
    console.log('   ✅ Generated X25519 keypairs');
    
    // Step 3: Derive encryption key
    console.log('\n[3] Deriving shared secret...');
    const sharedSecret = deriveSharedSecret(ephemeralKeyPair.privateKey, enclavePubkey);
    const encryptionKey = deriveKey(sharedSecret);
    console.log('   ✅ Derived encryption key');

    // Step 4: Prepare request WITH escrow_z_address
    const requestPayload = {
      deposit_address: deposit.depositAddress,
      creator_address: deposit.creatorAddress,
      escrow_z_address: deposit.escrowZAddress,  // THIS IS THE KEY FIX!
      launch_pda: deposit.launchPda,
      user_pubkey: deposit.userPubkey,
      token_symbol: deposit.tokenSymbol,
      launch_id: deposit.launchId,
      price_per_token: deposit.pricePerToken,
      amount_to_sell: deposit.amountToSell,
      decimals: deposit.decimals,
      tokens_per_proof: deposit.tokensPerProof,
    };
    
    console.log('\n[4] Request payload:');
    console.log('   deposit_address:', requestPayload.deposit_address);
    console.log('   creator_address:', requestPayload.creator_address);
    console.log('   escrow_z_address:', requestPayload.escrow_z_address);
    console.log('   launch_id:', requestPayload.launch_id);

    // Step 5: Encrypt request
    console.log('\n[5] Encrypting request...');
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(JSON.stringify(requestPayload));
    const { ciphertext, nonce } = encryptChaCha(encryptionKey, plaintextBytes);
    console.log('   ✅ Encrypted request payload');

    // Step 6: Send to TEE (nonce and ciphertext as separate fields)
    console.log('\n[6] Sending encrypted request to TEE...');
    const response = await fetch(`${TEE_ENDPOINT}/generate-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ephemeral_pubkey: bytesToHex(ephemeralKeyPair.publicKey),
        nonce: bytesToHex(nonce),
        ciphertext: bytesToHex(ciphertext),
        user_pubkey: bytesToHex(userKeyPair.publicKey),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TEE request failed: ${response.status} - ${errorText}`);
    }

    const encryptedResponse = await response.json();
    console.log('   ✅ Got encrypted response from TEE');
    console.log('   Response keys:', Object.keys(encryptedResponse));

    // Step 7: Decrypt response
    console.log('\n[7] Decrypting response...');
    
    // Response has separate nonce and ciphertext fields
    const responseNonce = hexToBytes(encryptedResponse.nonce);
    const responseCiphertext = hexToBytes(encryptedResponse.ciphertext);
    
    // Derive response decryption key using ephemeral_pubkey from response
    const enclavePubkeyForResponse = hexToBytes(encryptedResponse.ephemeral_pubkey);
    const responseSharedSecret = deriveSharedSecret(userKeyPair.privateKey, enclavePubkeyForResponse);
    const responseKey = deriveKey(responseSharedSecret);
    
    const decryptedBytes = decryptChaCha(responseKey, responseCiphertext, responseNonce);
    const decoder = new TextDecoder();
    const result = JSON.parse(decoder.decode(decryptedBytes));
    
    console.log('\n[8] Decrypted response:');
    console.log('   Verification:', result.verification);
    console.log('   Metadata:', result.metadata);

    // Check verification.verified (not result.verified)
    if (result.verification?.verified) {
      console.log('\n✅ VERIFICATION SUCCESSFUL!');
      console.log(`   Claim amount: ${result.metadata?.claimAmount}`);
      console.log(`   Proof reference: ${result.metadata?.proofReference}`);
      console.log(`   Escrow Z-address: ${result.metadata?.escrowZAddress}`);
      console.log(`   Swap amount: ${result.metadata?.swapAmountIn} (${result.metadata?.swapAmountUsd} USD)`);
      
      // Save the full proof result as JSON
      const filename = `ticket_${deposit.depositAddress.slice(0, 8)}_${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(result, null, 2));
      console.log(`   ✅ Proof ticket saved to: ${filename}`);
      
      return { success: true, result };
    } else {
      console.log('\n❌ VERIFICATION FAILED');
      const errorInfo = result.verification?.error || 'Unknown error';
      console.log(`   Error: ${errorInfo}`);
      return { success: false, result, error: errorInfo };
    }

  } catch (error) {
    console.error('\n❌ Recovery failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('==========================================');
  console.log('DEPOSIT RECOVERY SCRIPT');
  console.log(`TEE Endpoint: ${TEE_ENDPOINT}`);
  console.log(`Deposits to recover: ${STUCK_DEPOSITS.length}`);
  console.log('==========================================');

  // First, test TEE connectivity
  console.log('\n[CONNECTIVITY TEST]');
  try {
    const healthResp = await fetch(`${TEE_ENDPOINT}/health`);
    if (healthResp.ok) {
      console.log('✅ TEE is accessible');
    } else {
      console.log('⚠️ TEE health check returned:', healthResp.status);
    }
  } catch (e) {
    console.log('❌ Cannot reach TEE:', e.message);
    return;
  }

  const results = [];
  for (const deposit of STUCK_DEPOSITS) {
    const result = await recoverDeposit(deposit);
    results.push({ deposit: deposit.depositAddress, ...result });
  }

  console.log('\n\n==========================================');
  console.log('RECOVERY SUMMARY');
  console.log('==========================================');
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.deposit}: ${result.success ? 'Recovered' : result.error || 'Failed'}`);
  }
}

main().catch(console.error);
