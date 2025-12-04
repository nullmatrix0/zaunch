'use client';
import { useWallet } from '@solana/wallet-adapter-react';
import { useState } from 'react';
import { useWalletContext } from '@/contexts/WalletProviderContext';
import WalletSidebar from './WalletSidebar';

export const WalletButton: React.FC = () => {
  const { connected: solanaConnected, publicKey } = useWallet();
  const { connectSolana } = useWalletContext();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const getButtonText = () => {
    if (solanaConnected && publicKey) {
      const address = publicKey.toString();
      return address.length > 10
        ? `${address.slice(0, 6)}...${address.slice(-4)}`
        : address;
    }
    return 'Connect Wallet';
  };

  const handleWalletButtonClick = () => {
    if (solanaConnected) {
      setIsSidebarOpen(true);
    } else {
      // Connect trực tiếp Solana wallet
      connectSolana();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleWalletButtonClick}
        className="bg-[#d08700] border border-black px-3 sm:px-[16.667px] py-2 sm:py-[8.667px] font-rajdhani font-semibold text-xs sm:text-sm text-black uppercase leading-[14px] sm:leading-[16px] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {getButtonText()}
      </button>

      <WalletSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
    </div>
  );
};
