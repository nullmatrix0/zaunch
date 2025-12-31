import { Connection, PublicKey } from '@solana/web3.js';
import { SendHelper } from '@layerzerolabs/lz-solana-sdk-v2';
import { EndpointId } from '@layerzerolabs/lz-definitions';

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const sendHelper = new SendHelper();

  const storePDA = new PublicKey('HEhJAzW3HZUBc4a1vF7SJAFd1z8411c8Yx6RWLzYNBYu');
  const walletPk = new PublicKey('6CtD2EKR1cZt1vSKSjfy3Yz7puoJtRT8hBNM4YJAPd8D');
  const DST_EID = EndpointId.SEPOLIA_V2_TESTNET; // 40161

  // Peer address from PeerConfig
  const peerAddress = '0x00000000000000000000000042f8ff3550cab12662e92ed6e75c0bf1e877216b';

  console.log('🔍 Fetching accounts from SDK...');
  console.log('  Wallet:', walletPk.toBase58());
  console.log('  Store:', storePDA.toBase58());
  console.log('  DST EID:', DST_EID);
  console.log('  Peer:', peerAddress);

  const remainingAccounts = await sendHelper.getSendAccounts(
    connection,
    walletPk,
    storePDA,
    DST_EID,
    peerAddress,
    'confirmed',
  );

  console.log('\n📋 SDK Account List:');
  console.log(`  Total: ${remainingAccounts.length} accounts`);
  remainingAccounts.forEach((acc, i) => {
    console.log(
      `  [${i}] ${acc.pubkey.toBase58()} - signer:${acc.isSigner} writable:${acc.isWritable}`,
    );
  });
}

main().catch(console.error);
