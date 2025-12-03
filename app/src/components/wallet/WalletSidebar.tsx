'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { ChevronDown, ChevronRight, Copy, Info, Power, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SOL_NETWORK } from '@/configs/env.config';
import {
  getAllTokens as getAllSolTokens,
  getSolBalance,
  getSolPrice,
  type TokenInfo as SolTokenInfo,
} from '@/lib/sol';
import { formatNumberToCurrency } from '@/utils';

interface WalletSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectAnother?: () => void;
}

interface TokenAsset {
  name: string;
  symbol: string;
  balance: string;
  logo?: string;
  usdValue?: number;
}

interface ConnectedWallet {
  type: 'solana';
  address: string;
  displayName: string;
  balance?: string;
  nativeBalance?: string;
  tokens?: TokenAsset[];
  network?: string;
}

const WalletSidebar: React.FC<WalletSidebarProps> = ({ isOpen, onClose, onConnectAnother }) => {
  const { publicKey, connected: solanaConnected, disconnect: disconnectSolana } = useWallet();

  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [expandedWallets, setExpandedWallets] = useState<Set<string>>(new Set());
  const [walletTokens, setWalletTokens] = useState<TokenAsset[]>([]);

  const getConnectedWallets = (): ConnectedWallet[] => {
    const wallets: ConnectedWallet[] = [];

    if (solanaConnected && publicKey) {
      const nativeBalance = walletTokens.find((t) => t.symbol === 'SOL')?.balance || '0';
      wallets.push({
        type: 'solana',
        address: publicKey.toString(),
        displayName: 'Solana Wallet',
        balance: walletBalance.toFixed(2),
        nativeBalance,
        tokens: walletTokens,
        network: SOL_NETWORK || '',
      });
    }

    return wallets;
  };

  const fetchBalances = async () => {
    setIsLoadingBalances(true);
    try {
      let newBalance = 0;
      const newTokens: TokenAsset[] = [];

      // Fetch Solana balance and tokens
      if (solanaConnected && publicKey) {
        try {
          const [solBalance, solPrice, solTokens] = await Promise.all([
            getSolBalance(publicKey.toString()),
            getSolPrice(),
            getAllSolTokens(publicKey.toString()).catch(() => [] as SolTokenInfo[]),
          ]);

          // Add native SOL as first token
          newTokens.push({
            name: 'Solana',
            symbol: 'SOL',
            balance: solBalance.toFixed(4),
            usdValue: solBalance * (solPrice || 0),
          });

          // Add other tokens
          solTokens.forEach((token) => {
            newTokens.push({
              name: token.name,
              symbol: token.symbol,
              balance: token.balance.toFixed(4),
              logo: token.image,
              usdValue: 0, // Price data would need to be fetched separately
            });
          });

          newBalance = solBalance * (solPrice || 0);
        } catch (error) {
          console.error('Error fetching Solana balance:', error);
        }
      }

      setWalletBalance(newBalance);
      setWalletTokens(newTokens);
    } catch (error) {
      console.error('Error fetching balances:', error);
    } finally {
      setIsLoadingBalances(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBalances();
    }
  }, [isOpen, solanaConnected, publicKey]);

  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;

      const originalBodyOverflow = document.body.style.overflow;
      const originalBodyPosition = document.body.style.position;
      const originalBodyTop = document.body.style.top;
      const originalBodyWidth = document.body.style.width;
      const originalHtmlOverflow = document.documentElement.style.overflow;

      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.documentElement.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.body.style.position = originalBodyPosition;
        document.body.style.top = originalBodyTop;
        document.body.style.width = originalBodyWidth;
        document.documentElement.style.overflow = originalHtmlOverflow;

        window.scrollTo(scrollX, scrollY);
      };
    }
  }, [isOpen]);

  const getTotalBalance = (): number => {
    return walletBalance;
  };

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success('Address copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy address');
    }
  };

  const handleDisconnectWallet = () => {
    disconnectSolana();
  };

  const getWalletIcon = () => {
    return '/chains/solana_light.svg';
  };

  const getWalletDisplayName = (wallet: ConnectedWallet) => {
    return `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
  };

  const getNetworkBadgeColor = (network: string) => {
    const testnetKeywords = ['testnet', 'devnet', 'sepolia', 'holesky'];
    const isTestnet = testnetKeywords.some((keyword) => network.toLowerCase().includes(keyword));
    return isTestnet
      ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30'
      : 'bg-green-500/20 text-green-500 border border-green-500/30';
  };

  const getNetworkDisplayName = (network: string) => {
    if (!network) return 'Unknown';
    return network.charAt(0).toUpperCase() + network.slice(1);
  };

  const toggleWalletExpanded = (walletAddress: string) => {
    setExpandedWallets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(walletAddress)) {
        newSet.delete(walletAddress);
      } else {
        newSet.add(walletAddress);
      }
      return newSet;
    });
  };

  const connectedWallets = getConnectedWallets();
  const totalBalance = getTotalBalance();

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-60 h-screen" onClick={onClose} />

      <div
        className={`fixed right-0 top-0 h-screen w-full sm:w-96 md:w-80 bg-black border-l border-gray-800 shadow-lg z-70 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-800">
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-800 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
            <button
              className="text-xs sm:text-sm border border-gray-700 bg-transparent text-gray-400 hover:bg-gray-800 hover:text-white px-2 sm:px-3 py-1.5 rounded cursor-pointer transition-colors whitespace-nowrap"
              onClick={() => {
                onClose();
                onConnectAnother?.();
              }}
            >
              <span className="hidden sm:inline">Connect another wallet</span>
              <span className="sm:hidden">Connect</span>
            </button>
          </div>

          <div className="flex-1 p-3 sm:p-4 space-y-3 overflow-y-auto">
            {connectedWallets.map((wallet, index) => {
              const isExpanded = expandedWallets.has(wallet.address);
              const hasTokens = wallet.tokens && wallet.tokens.length > 0;

              return (
                <Collapsible
                  key={index}
                  open={isExpanded}
                  onOpenChange={() => toggleWalletExpanded(wallet.address)}
                >
                  <div className="border border-gray-800 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-2 sm:p-3 bg-[#000000]">
                      <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0">
                          <img
                            src={getWalletIcon()}
                            alt={wallet.displayName}
                            className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
                          />
                        </div>
                        <div className="flex flex-col space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs sm:text-sm font-medium text-white cursor-help truncate">
                                  {getWalletDisplayName(wallet)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="border border-gray-800 bg-[#000000] text-white">
                                <p className="text-xs">{wallet.address}</p>
                              </TooltipContent>
                            </Tooltip>
                            {wallet.network && (
                              <span
                                className={`text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full font-medium ${getNetworkBadgeColor(wallet.network)}`}
                              >
                                {getNetworkDisplayName(wallet.network)}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] sm:text-xs text-gray-400">${wallet.balance}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        {hasTokens && (
                          <CollapsibleTrigger asChild>
                            <button className="p-1 hover:bg-gray-800 rounded transition-colors cursor-pointer">
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                              )}
                            </button>
                          </CollapsibleTrigger>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleCopyAddress(wallet.address)}
                              className="p-1 hover:bg-gray-800 rounded transition-colors cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="border border-gray-800 bg-[#000000] text-white">
                            <p>Copy address</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={handleDisconnectWallet}
                              className="p-1 hover:bg-red-900/30 rounded transition-colors cursor-pointer"
                            >
                              <Power className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="border border-gray-800 bg-[#000000] text-white">
                            <p>Disconnect wallet</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    {hasTokens && (
                      <CollapsibleContent>
                        <div className="border-t border-gray-800 bg-gray-900 px-2 sm:px-3 py-2">
                          <div className="space-y-2">
                            <p className="text-[10px] sm:text-xs font-medium text-gray-400 mb-2">
                              Assets ({wallet?.tokens?.length})
                            </p>
                            {wallet?.tokens?.map((token, tokenIndex) => (
                              <div
                                key={tokenIndex}
                                className="flex items-center justify-between py-1.5 px-2 bg-[#000000] rounded border border-gray-800"
                              >
                                <div className="flex items-center space-x-2">
                                  {token.logo && (
                                    <img
                                      src={token.logo}
                                      alt={token.symbol}
                                      className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  )}
                                  <div className="flex flex-col">
                                    <span className="text-[10px] sm:text-xs font-medium text-white">
                                      {token.symbol}
                                    </span>
                                    <span className="text-[9px] sm:text-[10px] text-gray-400">{token.name}</span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] sm:text-xs font-medium text-white">
                                    {formatNumberToCurrency(Number(token.balance))}
                                  </span>
                                  {token.usdValue !== undefined && token.usdValue > 0 && (
                                    <span className="text-[9px] sm:text-[10px] text-gray-400">
                                      ${token.usdValue.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    )}
                  </div>
                </Collapsible>
              );
            })}
            <div className="pt-4 sm:pt-6">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-sm sm:text-base font-medium text-gray-300">Total balance</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs border border-gray-800 bg-[#000000] text-white">
                    <div className="space-y-2">
                      <p className="text-xs text-gray-300">
                        Total Balance shows the USD value of your Solana wallet
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
                {isLoadingBalances ? (
                  <Skeleton className="h-7 sm:h-8 md:h-9 w-24 sm:w-28 md:w-32 bg-gray-800" />
                ) : (
                  `$${totalBalance.toFixed(2)}`
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default WalletSidebar;
