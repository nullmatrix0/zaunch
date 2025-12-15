#!/usr/bin/env node
/**
 * ZEC Private Key Export Script
 * 
 * This script derives the private keys for escrow addresses so you can
 * manually recover ZEC using a Zcash wallet.
 * 
 * Usage: node export-keys.js
 */

import crypto from 'crypto';

// TEE's master seed derivation (matches escrow.rs)
const ESCROW_SEED = "zaunchpad_escrow_v1";

// Your TEE's enclave secret - you need to get this from the TEE deployment
// This is the secret used to initialize the EscrowManager
const ENCLAVE_SECRET = "your_enclave_secret_here"; // Replace with actual

// Escrow addresses to recover
const ESCROW_DEPOSITS = [
  {
    launchId: "TestToken_3209NZ",
    depositAddress: "FKYZ7RzVR6rLTtYwAhH5tbkGRetxFBYxUBTAL15zjFYX",
    escrowZAddress: "t1gfohgBxBm7HX1nJ43tmPTDwix2oatwDSE",
    amountUsd: 0.7,
  },
  {
    launchId: "TestToken_3209NZ",
    depositAddress: "8oChctSaESgLkWZC63zB8G4N4DqFNerTWV26Y4acvkRa",
    escrowZAddress: "t1X3inNQW26KfAot1M1BrqT5YCRmExhYj5j",
    amountUsd: 0.7,
  },
  // Add 3rd one if you have it
];

// Derive master seed (matches EscrowManager::new in Rust)
function deriveMasterSeed(enclaveSecret) {
  const hash = crypto.createHash('sha256');
  hash.update(ESCROW_SEED);
  hash.update(enclaveSecret);
  return hash.digest();
}

// Derive transparent keypair (matches derive_transparent_keypair in Rust)
function deriveTransparentKeypair(masterSeed, seedInput) {
  // Step 1: Combine master seed with input
  const hash = crypto.createHash('sha256');
  hash.update(masterSeed);
  hash.update(seedInput);
  const privateKeyBytes = hash.digest();
  
  // This is the secp256k1 private key (32 bytes)
  return {
    privateKeyHex: privateKeyBytes.toString('hex'),
    privateKeyWif: toWIF(privateKeyBytes, 0x80), // 0x80 = mainnet, 0xEF = testnet
  };
}

// Convert private key to WIF format (for import into wallets)
function toWIF(privateKeyBytes, versionByte) {
  // WIF = Base58Check(version + privkey + [0x01 if compressed])
  const payload = Buffer.alloc(34);
  payload[0] = versionByte;
  privateKeyBytes.copy(payload, 1);
  payload[33] = 0x01; // Compressed public key flag
  
  // Double SHA256 checksum
  const hash1 = crypto.createHash('sha256').update(payload).digest();
  const hash2 = crypto.createHash('sha256').update(hash1).digest();
  const checksum = hash2.slice(0, 4);
  
  // Final = payload + checksum
  const final = Buffer.concat([payload, checksum]);
  
  // Base58 encode
  return base58Encode(final);
}

// Base58 encoding (used by Bitcoin/Zcash)
function base58Encode(buffer) {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  
  let num = BigInt('0x' + buffer.toString('hex'));
  let result = '';
  
  while (num > 0n) {
    const remainder = num % 58n;
    num = num / 58n;
    result = ALPHABET[Number(remainder)] + result;
  }
  
  // Add leading '1's for leading zero bytes
  for (const byte of buffer) {
    if (byte === 0) {
      result = '1' + result;
    } else {
      break;
    }
  }
  
  return result;
}

// Derive the seed for a specific purchase escrow address
function getEscrowSeed(launchId, depositAddress) {
  const hash = crypto.createHash('sha256');
  hash.update("purchase_escrow_v1");
  // Note: This needs the master seed concatenated, then launch_id, then deposit_address
  // We'll compute the full seed in the main function
  return { launchId, depositAddress };
}

function main() {
  console.log('==========================================');
  console.log('ZEC PRIVATE KEY EXPORT');
  console.log('==========================================');
  console.log('');
  
  if (ENCLAVE_SECRET === "your_enclave_secret_here") {
    console.log('⚠️  WARNING: You need to set the ENCLAVE_SECRET');
    console.log('   This is the secret used when initializing EscrowManager in the TEE.');
    console.log('   Without it, the derived keys won\'t match the actual escrow addresses.');
    console.log('');
    console.log('   You can find this in your TEE deployment configuration.');
    console.log('');
  }
  
  const masterSeed = deriveMasterSeed(ENCLAVE_SECRET);
  console.log('Master seed derived.');
  console.log('');
  
  for (const deposit of ESCROW_DEPOSITS) {
    console.log('-------------------------------------------');
    console.log(`Escrow Address: ${deposit.escrowZAddress}`);
    console.log(`Amount: ~$${deposit.amountUsd} USD in ZEC`);
    console.log(`Deposit: ${deposit.depositAddress}`);
    console.log('');
    
    // Derive the seed for this specific purchase
    // Matches derive_purchase_escrow_address in Rust:
    // hash.update("purchase_escrow_v1".as_bytes());
    // hash.update(&self.master_seed);
    // hash.update(launch_id.as_bytes());
    // hash.update(deposit_address.as_bytes());
    
    const seedHash = crypto.createHash('sha256');
    seedHash.update("purchase_escrow_v1");
    seedHash.update(masterSeed);
    seedHash.update(deposit.launchId);
    seedHash.update(deposit.depositAddress);
    const purchaseSeed = seedHash.digest();
    
    const keypair = deriveTransparentKeypair(masterSeed, purchaseSeed);
    
    console.log('Private Key (hex):', keypair.privateKeyHex);
    console.log('Private Key (WIF):', keypair.privateKeyWif);
    console.log('');
    console.log('To recover: Import the WIF key into a Zcash wallet (like Zecwallet Lite)');
    console.log('Then send the ZEC to a 1Click deposit address to swap to SOL.');
    console.log('');
  }
  
  console.log('==========================================');
  console.log('IMPORTANT: Keep these keys secure!');
  console.log('==========================================');
}

main();
