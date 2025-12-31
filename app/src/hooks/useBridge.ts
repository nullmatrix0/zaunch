import { useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import {
  executeBridgeWithSendTransaction,
  checkVaultStatus,
  initializeVault,
  type BridgeParams,
  type BridgeResult,
  type VaultStatus,
} from '@/lib/bridge';
import IDL from '@/idl/zaunchpad.json';
import { toast } from 'sonner';

export interface UseBridgeReturn {
  bridging: boolean;
  initializingVault: boolean;
  checkingVault: boolean;
  vaultStatus: VaultStatus | null;
  bridge: (params: BridgeParams) => Promise<BridgeResult | null>;
  checkVault: (tokenMint: string) => Promise<VaultStatus>;
  initVault: (tokenMint: string) => Promise<string | null>;
}

export function useBridge(): UseBridgeReturn {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, signTransaction } = useWallet();

  const [bridging, setBridging] = useState(false);
  const [initializingVault, setInitializingVault] = useState(false);
  const [checkingVault, setCheckingVault] = useState(false);
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);

  const getProgram = useCallback((): Program | null => {
    if (!publicKey || !signTransaction) {
      return null;
    }

    try {
      const wallet = {
        publicKey,
        signTransaction,
        signAllTransactions: async (txs: any[]) => {
          return Promise.all(txs.map((tx) => signTransaction(tx)));
        },
      };

      const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });

      return new Program(IDL as any, provider);
    } catch (error) {
      console.error('Failed to create program:', error);
      return null;
    }
  }, [connection, publicKey, signTransaction]);

  const checkVault = useCallback(
    async (tokenMint: string): Promise<VaultStatus> => {
      setCheckingVault(true);

      try {
        const program = getProgram();
        const programId = program ? program.programId : undefined;

        const status = await checkVaultStatus(connection, tokenMint, programId);
        setVaultStatus(status);
        return status;
      } catch (error) {
        console.error('Error checking vault:', error);
        toast.error('Failed to check vault status');
        throw error;
      } finally {
        setCheckingVault(false);
      }
    },
    [connection, getProgram],
  );

  const initVault = useCallback(
    async (tokenMint: string): Promise<string | null> => {
      if (!publicKey || !sendTransaction) {
        toast.error('Please connect your wallet');
        return null;
      }

      setInitializingVault(true);

      try {
        const program = getProgram();
        if (!program) {
          throw new Error('Failed to initialize program');
        }

        toast.info('Initializing vault for token...');

        const signature = await initializeVault(
          connection,
          tokenMint,
          publicKey,
          program,
          sendTransaction,
        );

        toast.success('Vault initialized successfully!');

        await checkVault(tokenMint);

        return signature;
      } catch (error) {
        console.error('Error initializing vault:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to initialize vault');
        return null;
      } finally {
        setInitializingVault(false);
      }
    },
    [connection, publicKey, sendTransaction, getProgram, checkVault],
  );

  const bridge = useCallback(
    async (params: BridgeParams): Promise<BridgeResult | null> => {
      if (!publicKey || !sendTransaction) {
        toast.error('Please connect your wallet');
        return null;
      }

      setBridging(true);

      try {
        const program = getProgram();
        if (!program) {
          throw new Error('Failed to initialize program');
        }

        toast.info('Checking vault status...');
        const vault = await checkVaultStatus(connection, params.tokenMint);

        if (!vault.exists) {
          toast.info('Vault not found. Initializing vault...');
          await initVault(params.tokenMint);
        }

        toast.info('Preparing bridge transaction...');

        const result = await executeBridgeWithSendTransaction(
          connection,
          params,
          program,
          sendTransaction,
        );

        toast.success('Bridge transaction successful!');

        return result;
      } catch (error) {
        console.error('Bridge error:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to execute bridge');
        return null;
      } finally {
        setBridging(false);
      }
    },
    [connection, publicKey, sendTransaction, getProgram, initVault],
  );

  return {
    bridging,
    initializingVault,
    checkingVault,
    vaultStatus,
    bridge,
    checkVault,
    initVault,
  };
}
