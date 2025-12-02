import * as anchor from '@coral-xyz/anchor';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';

export default function useAnchorProvider() {
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();

  // Return null if wallet or connection is not available
  if (!connection || !anchorWallet) {
    return null;
  }

  const providerProgram = new anchor.AnchorProvider(connection, anchorWallet as any, {
    preflightCommitment: 'confirmed',
  });

  return {
    connection,
    anchorWallet,
    providerProgram,
  };
}
