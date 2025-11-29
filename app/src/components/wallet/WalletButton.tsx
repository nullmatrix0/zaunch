'use client';
import { useWalletSelector } from '@near-wallet-selector/react-hook';
import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import SignInModal from './SignInModal';
import WalletSidebar from './WalletSidebar';

export const WalletButton: React.FC = () => {
  const { connected: solanaConnected } = useWallet();

  const { signedAccountId } = useWalletSelector();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState<string | null>(null);

  const isAnyWalletConnected = () => {
    return solanaConnected || !!signedAccountId;
  };

  const getConnectedWalletsCount = () => {
    let count = 0;
    if (solanaConnected) count++;
    if (signedAccountId) count++;
    return count;
  };

  const getButtonText = () => {
    if (isAnyWalletConnected()) {
      const count = getConnectedWalletsCount();
      if (count === 1) {
        if (solanaConnected) {
          return 'Solana Wallet';
        }
        if (signedAccountId) {
          return signedAccountId.length > 60
            ? `${signedAccountId.slice(0, 6)}...${signedAccountId.slice(-4)}`
            : signedAccountId;
        }
      } else {
        return `${count} Wallets Connected`;
      }
    }

    return 'Connect Wallet';
  };

  const handleWalletButtonClick = () => {
    if (isAnyWalletConnected()) {
      setIsSidebarOpen(true);
    } else {
      setIsSignInModalOpen(true);
    }
  };

  useEffect(() => {
    if (showCopySuccess) {
      const timer = setTimeout(() => {
        setShowCopySuccess(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showCopySuccess]);

  if (isAnyWalletConnected()) {
    return (
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="bg-[#d08700] border border-black px-[16.667px] py-[8.667px] font-rajdhani font-semibold text-sm text-black uppercase leading-[16px] hover:opacity-90 transition-opacity cursor-pointer"
        >
          {getButtonText()}
        </button>

        <SignInModal isOpen={isSignInModalOpen} onClose={() => setIsSignInModalOpen(false)} />

        <WalletSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onConnectAnother={() => {
            setIsSidebarOpen(false);
            setIsSignInModalOpen(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleWalletButtonClick}
        className="bg-[#d08700] border border-black px-[16.667px] py-[8.667px] font-rajdhani font-semibold text-sm text-black uppercase leading-[16px] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {getButtonText()}
      </button>

      <SignInModal isOpen={isSignInModalOpen} onClose={() => setIsSignInModalOpen(false)} />

      <WalletSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onConnectAnother={() => {
          setIsSidebarOpen(false);
          setIsSignInModalOpen(true);
        }}
      />
    </div>
  );
};
