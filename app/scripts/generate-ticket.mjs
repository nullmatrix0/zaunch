import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { x25519 } from '@noble/curves/ed25519.js';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/ciphers/utils.js';

// Configuration
const TEE_ENDPOINT = process.env.TEE_URL || 'http://localhost:3000';
const OUTPUT_FILE = process.env.OUTPUT_FILE || 'proof_ticket.zip';

// Params from User
const PARAMS = {
    "depositAddress": "A5D8dbrskLSQsZcQ2sbnQMCkPnnimcPHZniXPcXiSQz2",
    "creatorAddress": "t1Yf8KMstVBhiJATMqcqbbvMb8okxortfsN",
    "launchPda": "HTpzMZFSYvVBV2h1NJkHsLKNXCyKvUsYuKi2SK36a9Fx",
    "userPubkey": "E1YEzC6c5XSLzXZM5QLfz8mRTXhnQ7ecLXFjkZYEfknw",
    "launchId": "TestToken_TN566H",
    "tokenMint": "Dk1sknED8QxXioLHM8ejJhzTaXrCLpDoXNs61Hp1iC3k",
    "tokenSymbol": "TN566",
    "pricePerToken": "63",
    "amountToSell": "6011864000000000",
    "decimals": 9,
    "tokensPerProof": "120429000000000",
    "escrowZAddress": "t1YEUXBZUGM79xttDZBveLYMiURevzAsRgQ"
};

// ... Crypto Helpers ...
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

function deriveKey(sharedSecret) {
  const encoder = new TextEncoder();
  const suffix = encoder.encode('tee-proof-generator-key-v1');
  const combined = new Uint8Array(sharedSecret.length + suffix.length);
  combined.set(sharedSecret);
  combined.set(suffix, sharedSecret.length);
  return sha256(combined);
}

function generateKeyPair() {
  const privateKey = randomBytes(32);
  const publicKey = x25519.getPublicKey(privateKey);
  return { publicKey, privateKey };
}

function deriveSharedSecret(privateKey, publicKey) {
  return x25519.getSharedSecret(privateKey, publicKey);
}

function encryptChaCha(key, plaintext) {
  const nonce = randomBytes(12);
  const cipher = chacha20poly1305(key, nonce);
  const ciphertext = cipher.encrypt(plaintext);
  return { ciphertext, nonce };
}

function decryptChaCha(key, ciphertext, nonce) {
  const cipher = chacha20poly1305(key, nonce);
  return cipher.decrypt(ciphertext);
}

// ... Main Logic ...
async function main() {
  console.log('🚀 Generating Proof Ticket manually...');
  console.log(`📍 TEE Endpoint: ${TEE_ENDPOINT}`);
  console.log('📦 Params:', PARAMS);

  try {
    // 1. Get TEE Pubkey
    console.log('1️⃣ Fetching TEE Pubkey...');
    const pubkeyResp = await fetch(`${TEE_ENDPOINT}/pubkey`);
    if (!pubkeyResp.ok) throw new Error(`Failed to get pubkey: ${pubkeyResp.statusText}`);
    const { pubkey: enclavePubkeyHex } = await pubkeyResp.json();
    const enclavePubkey = hexToBytes(enclavePubkeyHex);
    console.log(`   ✅ Got pubkey: ${enclavePubkeyHex.substring(0, 16)}...`);

    // 2. Encrypt Request
    console.log('2️⃣ Encrypting Request...');
    const userKeyPair = generateKeyPair();
    const ephemeralKeyPair = generateKeyPair();
    const sharedSecret = deriveSharedSecret(ephemeralKeyPair.privateKey, enclavePubkey);
    const encryptionKey = deriveKey(sharedSecret);

    const requestPayload = JSON.stringify({
      deposit_address: PARAMS.depositAddress,
      creator_address: PARAMS.creatorAddress,
      launch_pda: PARAMS.launchPda,
      user_pubkey: PARAMS.userPubkey,
      token_symbol: PARAMS.tokenSymbol,
      launch_id: PARAMS.launchId,
      price_per_token: parseInt(PARAMS.pricePerToken) || 0,
      amount_to_sell: parseInt(PARAMS.amountToSell) || 0,
      decimals: PARAMS.decimals,
      tokens_per_proof: parseInt(PARAMS.tokensPerProof) || 0,
      escrow_z_address: PARAMS.escrowZAddress || ''
    });

    const encoder = new TextEncoder();
    const { ciphertext, nonce } = encryptChaCha(encryptionKey, encoder.encode(requestPayload));

    const encryptedRequest = {
      ephemeral_pubkey: bytesToHex(ephemeralKeyPair.publicKey),
      nonce: bytesToHex(nonce),
      ciphertext: bytesToHex(ciphertext),
      user_pubkey: bytesToHex(userKeyPair.publicKey),
    };

    // 3. Send Request
    console.log('3️⃣ Sending Request to /generate-proof...');
    const response = await fetch(`${TEE_ENDPOINT}/generate-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(encryptedRequest),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`TEE Request Failed (${response.status}): ${text}`);
    }

    const encryptedResponse = await response.json();
    console.log('   ✅ Received encrypted response');

    // 4. Decrypt Response
    console.log('4️⃣ Decrypting Response...');
    const resultPubkey = hexToBytes(encryptedResponse.ephemeral_pubkey);
    const resultShared = deriveSharedSecret(userKeyPair.privateKey, resultPubkey);
    const resultKey = deriveKey(resultShared);
    const resultCiphertext = hexToBytes(encryptedResponse.ciphertext);
    const resultNonce = hexToBytes(encryptedResponse.nonce);

    const decryptedBytes = decryptChaCha(resultKey, resultCiphertext, resultNonce);
    const decryptedJson = new TextDecoder().decode(decryptedBytes);
    const result = JSON.parse(decryptedJson);

    if (result.error) {
       throw new Error(`TEE returned error: ${result.error}`);
    }
    
    console.log('   ✅ Proof Generated!');
    // console.log(JSON.stringify(result, null, 2));

    // 5. Create ZIP
    console.log('5️⃣ Creating ZIP file...');
    const zip = new JSZip();
    
    // Convert arrays to Uint8Array for ZIP
    const proofBytes = new Uint8Array(result.proof);
    const inputsBytes = new Uint8Array(result.public_inputs);
    
    zip.file('proof.bin', proofBytes);
    zip.file('public_inputs.bin', inputsBytes);
    
    // Metadata 
    const metadata = {
       ...result.metadata,
       type: 'user_claim',
       // Adding proofReference if missing in metadata (sometimes it's top level in result?)
       // tee-client puts it in metadata.
    };
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));

    const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
    
    fs.writeFileSync(OUTPUT_FILE, zipContent);
    console.log(`\n🎉 Success! ZIP saved to: ${path.resolve(OUTPUT_FILE)}`);

  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    process.exit(1);
  }
}

main();
