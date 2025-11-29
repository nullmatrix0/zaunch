import { useWalletSelector } from '@near-wallet-selector/react-hook';
import type React from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useWalletContext } from '@/contexts/WalletProviderContext';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ConnectedWallet {
  type: 'solana' | 'near';
  address: string;
  displayName: string;
}

const SignInModal: React.FC<SignInModalProps> = ({ isOpen, onClose }) => {
  const { signIn, signOut, signedAccountId } = useWalletSelector();
  const { connectSolana, disconnectSolana, isSolanaConnected, solanaPublicKey } =
    useWalletContext();
  const [isConnectingNEAR, setIsConnectingNEAR] = useState(false);

  useEffect(() => {
    const wallets: ConnectedWallet[] = [];

    if (isSolanaConnected && solanaPublicKey) {
      wallets.push({
        type: 'solana',
        address: solanaPublicKey,
        displayName: 'Solana Wallet',
      });
    }

    if (signedAccountId) {
      wallets.push({
        type: 'near',
        address: signedAccountId,
        displayName: 'NEAR Wallet',
      });
    }
  }, [isSolanaConnected, solanaPublicKey, signedAccountId]);

  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;

      // Store scroll position in a ref-like way
      const scrollData = { scrollY, scrollX };

      const originalBodyOverflow = document.body.style.overflow;
      const originalBodyPosition = document.body.style.position;
      const originalBodyTop = document.body.style.top;
      const originalBodyWidth = document.body.style.width;
      const originalBodyPaddingRight = document.body.style.paddingRight;
      const originalHtmlOverflow = document.documentElement.style.overflow;

      // Apply our scroll lock immediately
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.paddingRight = '0px';
      document.documentElement.style.overflow = 'hidden';

      // Restore when modal closes
      return () => {
        // Use requestAnimationFrame to ensure DOM updates are complete
        requestAnimationFrame(() => {
          setTimeout(() => {
            document.body.style.overflow = originalBodyOverflow;
            document.body.style.position = originalBodyPosition;
            document.body.style.top = originalBodyTop;
            document.body.style.width = originalBodyWidth;
            document.body.style.paddingRight = originalBodyPaddingRight;
            document.documentElement.style.overflow = originalHtmlOverflow;

            // Restore scroll position after styles are restored
            requestAnimationFrame(() => {
              window.scrollTo(scrollData.scrollX, scrollData.scrollY);
            });
          }, 150);
        });
      };
    }
  }, [isOpen]);

  const handleConnectSolana = async () => {
    try {
      onClose();
      setTimeout(() => {
        connectSolana();
      }, 150);
    } catch (error) {
      console.error('Failed to connect Solana wallet:', error);
    }
  };

  const handleConnectNEAR = async () => {
    try {
      setIsConnectingNEAR(true);

      signIn();
      onClose();
    } catch (error) {
      toast.error(
        `Failed to connect NEAR wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setIsConnectingNEAR(false);
    }
  };

  const handleDisconnectWallet = (walletType: 'solana' | 'near') => {
    switch (walletType) {
      case 'solana':
        disconnectSolana();
        break;
      case 'near':
        if (signedAccountId) {
          signOut();
        }
        break;
    }
  };

  const getWalletStatus = (type: 'solana' | 'near') => {
    switch (type) {
      case 'solana':
        return isSolanaConnected;
      case 'near':
        return !!signedAccountId;
      default:
        return false;
    }
  };

  const getWalletAddress = (type: 'solana' | 'near') => {
    switch (type) {
      case 'solana':
        return solanaPublicKey
          ? `${solanaPublicKey.slice(0, 6)}...${solanaPublicKey.slice(-4)}`
          : '';
      case 'near':
        return signedAccountId && signedAccountId.length > 60
          ? `${signedAccountId.slice(0, 6)}...${signedAccountId.slice(-4)}`
          : signedAccountId || '';
      default:
        return '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal={true}>
      <DialogContent className="sm:max-w-md border border-gray-800 bg-[#000000] text-white">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-center flex-1 text-white">
              How do you want to sign in?
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Popular options</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <img src="/chains/solana.svg" alt="Solana" className="w-6 h-6" />
                  <span className="text-sm font-medium text-white">Solana Wallet</span>
                </div>
                {getWalletStatus('solana') ? (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400 font-mono">
                      {getWalletAddress('solana')}
                    </span>
                    <button
                      onClick={() => handleDisconnectWallet('solana')}
                      className="px-3 py-1 hover:bg-red-900/30 hover:border-red-700 border border-red-700 rounded-md cursor-pointer text-xs text-red-500 hover:text-red-400"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleConnectSolana}
                    className="px-3 text-sm border border-gray-700 hover:bg-gray-800 hover:border-gray-600 rounded-md py-1 cursor-pointer text-white"
                  >
                    Connect
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <img src="/chains/near.png" alt="NEAR" className="w-5 h-5" />
                  <span className="text-sm font-medium text-white">NEAR Wallet</span>
                </div>
                {getWalletStatus('near') ? (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400 font-mono">
                      {getWalletAddress('near')}
                    </span>
                    <button
                      onClick={() => handleDisconnectWallet('near')}
                      className="px-3 py-1 hover:bg-red-900/30 hover:border-red-700 border border-red-700 rounded-md cursor-pointer text-xs text-red-500 hover:text-red-400"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleConnectNEAR}
                    disabled={isConnectingNEAR}
                    className="px-3 text-sm border border-gray-700 hover:bg-gray-800 hover:border-gray-600 rounded-md py-1 cursor-pointer text-white disabled:opacity-50"
                  >
                    {isConnectingNEAR ? 'Connecting...' : 'Connect'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SignInModal;
