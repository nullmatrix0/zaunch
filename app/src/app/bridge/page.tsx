'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { 
  ChainId, 
  SUPPORTED_CHAINS, 
  getSupportedChains,
  formatBridgeAmount,
  parseBridgeAmount,
  estimateBridgeTime,
  isValidAddress,
  getWrappedTokenSymbol,
  type OrderInfo,
  type SupportedChainKey,
  OrderStatus,
} from '@/lib/bridge';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from '@/components/ui/table';
import { getChainIcon, getTokenIcon } from '@/lib/tokenIcons';
import { toast } from 'sonner';
import { 
  Loader2, 
  ExternalLink,
  FileX,
  ChevronDown,
  Search,
  Info
} from 'lucide-react';
import { getRpcSOLEndpoint, getAllTokens, type TokenInfo } from '@/lib/sol';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { useBridge } from '@/hooks/useBridge';
import type { TokenMetadata } from '@/lib/bridge';

/**
 * Maps chain keys to icon names used in tokenIcons.ts
 */
const getChainIconName = (chainKey: SupportedChainKey): string => {
  const iconMap: Record<SupportedChainKey, string> = {
    ethereum: 'Eth',
    base: 'Base',
    arbitrum: 'Arb',
    optimism: 'Op',
    avalanche: 'Avax',
    polygon: 'Pol',
    bsc: 'BSC',
    fantom: 'Fantom',
    linea: 'Linea',
    solana: 'Sol',
  };
  return iconMap[chainKey] || chainKey;
};

export default function BridgePage() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const { prices } = useCryptoPrices();
  const { bridge, bridging: isBridging, vaultStatus, checkVault } = useBridge();
  
  // Bridge form state - Source is always Solana
  const fromChain = 'solana'; // Fixed source chain
  const [toChain, setToChain] = useState<SupportedChainKey>('base');
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  
  // Token management
  const [solanaTokens, setSolanaTokens] = useState<TokenInfo[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [tokenSearchQuery, setTokenSearchQuery] = useState('');
  
  // Dropdown states
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showToChainDropdown, setShowToChainDropdown] = useState(false);
  
  // Transaction history state
  const [orders, setOrders] = useState<OrderInfo[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  
  // Bridge implementation is being migrated to LayerZero
  // Legacy bridge functionality has been removed

  // Fetch Solana tokens from user's wallet
  const fetchSolanaTokens = useCallback(async () => {
    if (!publicKey || !connected) {
      setSolanaTokens([]);
      return;
    }

    setLoadingTokens(true);
    
    try {
      const tokens = await getAllTokens(publicKey.toBase58());
      setSolanaTokens(tokens);
    } catch (error) {
      console.error('Error fetching Solana tokens:', error);
      toast.error('Failed to load your tokens');
    } finally {
      setLoadingTokens(false);
    }
  }, [publicKey, connected]);

  // Fetch transaction history
  // Legacy bridge order fetching removed - will be replaced with LayerZero implementation
  const fetchOrders = useCallback(async () => {
    if (!publicKey || !connected) {
      setOrders([]);
      return;
    }

    setLoadingOrders(true);
    setOrdersError(null);
    
    try {
      // Bridge implementation migrated to LayerZero
      // Order fetching will be implemented with new bridge system
      setOrders([]);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrdersError(error instanceof Error ? error.message : 'Failed to load transaction history');
      toast.error('Failed to load transaction history');
    } finally {
      setLoadingOrders(false);
    }
  }, [publicKey, connected]);

  // Fetch tokens and orders on mount and when wallet connects
  useEffect(() => {
    fetchSolanaTokens();
    fetchOrders();
  }, [fetchSolanaTokens, fetchOrders]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('button') && !target.closest('[data-modal]')) {
        setShowToChainDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Handle bridge execution using LayerZero
  const handleBridge = useCallback(async () => {
    if (!publicKey || !connected) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!selectedToken) {
      toast.error('Please select a token');
      return;
    }

    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      toast.error('Please enter an amount');
      return;
    }

    if (!destinationAddress) {
      toast.error('Please enter destination address');
      return;
    }

    const toChainId = SUPPORTED_CHAINS[toChain].id;
    if (!isValidAddress(destinationAddress, toChainId)) {
      toast.error('Invalid destination address');
      return;
    }

    try {
      const amountParsed = parseBridgeAmount(fromAmount, selectedToken.decimals);
      
      // Prepare token metadata
      const tokenMetadata: TokenMetadata = {
        name: selectedToken.name,
        symbol: selectedToken.symbol,
        uri: selectedToken.image || 'https://arweave.net/default',
        decimals: selectedToken.decimals,
      };
      
      const result = await bridge({
        tokenMint: selectedToken.mint,
        amount: amountParsed,
        destinationChainId: toChainId,
        recipientAddress: destinationAddress,
        userWallet: publicKey.toBase58(),
        tokenMetadata,
      });
      
      if (result) {
        const wrappedSymbol = getWrappedTokenSymbol(selectedToken.symbol);
        
        // Show success toast with transaction links
        toast.success(
          `Bridge successful! ${fromAmount} ${selectedToken.symbol} → ${wrappedSymbol}`,
          {
            description: `Lock: ${result.lockSignature.slice(0, 8)}... | Bridge: ${result.bridgeSignature.slice(0, 8)}...`,
            duration: 10000,
            action: {
              label: 'View on Explorer',
              onClick: () => window.open(result.explorerUrl, '_blank'),
            },
          }
        );
        
        // Show LayerZero scan link if available
        if (result.layerZeroScanUrl) {
          toast.info('Track on LayerZero Scan', {
            description: `GUID: ${result.guid?.slice(0, 10)}...`,
            duration: 8000,
            action: {
              label: 'Open',
              onClick: () => window.open(result.layerZeroScanUrl, '_blank'),
            },
          });
        }
        
        // Reset form
        setFromAmount('');
        
        // Refresh tokens
        await fetchSolanaTokens();
      }
    } catch (error) {
      console.error('Bridge error:', error);
      // Error toast already shown by useBridge hook
    }
  }, [publicKey, connected, fromAmount, selectedToken, toChain, destinationAddress, bridge, fetchSolanaTokens]);

  // Get all supported chains and filter to EVM only
  const supportedChains = getSupportedChains();
  const evmChains = supportedChains.filter(chain => chain.key !== 'solana');
  
  // Filtered tokens based on search query
  const filteredTokens = solanaTokens.filter(token => 
    token.name.toLowerCase().includes(tokenSearchQuery.toLowerCase()) ||
    token.symbol.toLowerCase().includes(tokenSearchQuery.toLowerCase()) ||
    token.mint.toLowerCase().includes(tokenSearchQuery.toLowerCase())
  );

  // Set max amount from selected token balance
  const handleMaxAmount = () => {
    if (selectedToken) {
      setFromAmount(selectedToken.balance.toString());
    }
  };

  // Set 50% amount
  const handleHalfAmount = () => {
    if (selectedToken) {
      const half = selectedToken.balance / 2;
      setFromAmount(half.toString());
    }
  };

  // Format date
  const formatDate = (timestamp: string | number) => {
    const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp) * 1000 : timestamp * 1000);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get status badge color
  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.FULFILLED:
      case OrderStatus.CLAIMED_UNLOCK:
        return 'text-green-400';
      case OrderStatus.CANCELLED:
      case OrderStatus.FAILED:
        return 'text-red-400';
      case OrderStatus.LOCKED:
      case OrderStatus.BRIDGING:
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  // Get explorer link
  const getExplorerLink = (txHash: string, chainId: number) => {
    if (chainId === ChainId.SOLANA) {
      return `https://solscan.io/tx/${txHash}`;
    }
    // Add other chain explorers as needed
    return `https://etherscan.io/tx/${txHash}`;
  };

  const estimatedTime = estimateBridgeTime(ChainId.SOLANA, SUPPORTED_CHAINS[toChain].id);
  const wrappedTokenSymbol = selectedToken ? getWrappedTokenSymbol(selectedToken.symbol) : '';

  // Calculate USD value
  const calculateUsdValue = () => {
    if (!fromAmount || !selectedToken || !prices.solana) return '--';
    const amountNum = parseFloat(fromAmount);
    if (isNaN(amountNum) || amountNum <= 0) return '--';
    
    // For SOL, use SOL price directly
    // For other tokens, we'd need their price - for now show SOL equivalent
    const usdValue = selectedToken.symbol === 'SOL' 
      ? amountNum * (prices.solana || 0)
      : amountNum * (prices.solana || 0) * 0.1; // Placeholder for other tokens
    
    return usdValue > 0 ? usdValue.toFixed(2) : '--';
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="font-rajdhani font-bold text-2xl sm:text-3xl md:text-4xl text-white mb-2">
            Bridge Tokens
          </h1>
          <p className="text-gray-400 text-sm sm:text-base">
            Transfer tokens across different blockchain networks
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Left Column - Transaction History */}
          <div className="bg-neutral-950 border border-gray-800 rounded-lg p-4 sm:p-6">
            <div className="mb-4">
              <h2 className="font-rajdhani font-bold text-lg sm:text-xl text-white mb-2">
                Transaction History
              </h2>
            </div>

            {loadingOrders ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#d08700]" />
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileX className="w-16 h-16 text-gray-600 mb-4" />
                <p className="text-gray-500 font-rajdhani text-sm">
                  No transaction found
                </p>
              </div>
            ) : (
              <div className="border border-gray-800 overflow-hidden rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-800 bg-black/30">
                      <TableHead className="text-[#79767d] font-rajdhani text-xs uppercase">DATE & TIME</TableHead>
                      <TableHead className="text-[#79767d] font-rajdhani text-xs uppercase">ACTION</TableHead>
                      <TableHead className="text-[#79767d] font-rajdhani text-xs uppercase">STATUS</TableHead>
                      <TableHead className="text-[#79767d] font-rajdhani text-xs uppercase">TOKEN</TableHead>
                      <TableHead className="text-[#79767d] font-rajdhani text-xs uppercase">AMOUNT</TableHead>
                      <TableHead className="text-[#79767d] font-rajdhani text-xs uppercase">HASH</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => {
                      const fromChainInfo = Object.values(SUPPORTED_CHAINS).find(
                        c => c.id === order.give.chainId
                      );
                      const toChainInfo = Object.values(SUPPORTED_CHAINS).find(
                        c => c.id === order.take.chainId
                      );
                      const decimals = order.give.chainId === ChainId.SOLANA ? 9 : 18;
                      const amount = formatBridgeAmount(order.give.amount, decimals);
                      
                      return (
                        <TableRow key={order.orderId} className="border-gray-800/50 hover:bg-gray-900/30">
                          <TableCell className="text-gray-300 font-rajdhani text-xs">
                            {formatDate(order.timestamp || Date.now() / 1000)}
                          </TableCell>
                          <TableCell className="text-gray-300 font-rajdhani text-xs">
                            Bridge
                          </TableCell>
                          <TableCell className={`font-rajdhani text-xs font-semibold ${getStatusColor(order.status)}`}>
                            {order.status}
                          </TableCell>
                          <TableCell className="font-rajdhani text-xs">
                            <div className="flex items-center gap-1.5">
                              <img
                                src={getTokenIcon(fromChainInfo?.nativeToken || 'SOL', fromChainInfo?.name)}
                                alt={fromChainInfo?.nativeToken || 'N/A'}
                                className="w-4 h-4 rounded-full object-cover"
                              />
                              <span className="text-white font-semibold">{fromChainInfo?.nativeToken || 'N/A'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-white font-rajdhani text-xs font-semibold">
                            {amount.toFixed(4)}
                          </TableCell>
                          <TableCell>
                            <a
                              href={getExplorerLink(order.txSignature || order.makerSrc, order.give.chainId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#d08700] hover:underline font-rajdhani text-xs flex items-center gap-1"
                            >
                              {(order.txSignature || order.makerSrc).slice(0, 6)}...{(order.txSignature || order.makerSrc).slice(-4)}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Right Column - Bridge Interface */}
          <div className="bg-neutral-950 border border-gray-800 rounded-lg p-4 sm:p-6">
            {/* Token Selection */}
            <div className="flex flex-col gap-3 mb-4">
              <div className="font-rajdhani font-medium text-xs sm:text-sm md:text-[15px] text-[rgba(255,255,255,0.65)] uppercase">
                Select Solana Token to Bridge
              </div>
              
              <button
                onClick={() => setShowTokenModal(true)}
                disabled={!connected}
                className={`w-full bg-[#131313] border border-[#393939] flex gap-2 items-center justify-between px-3 py-2 sm:py-2.5 rounded-lg transition-colors ${
                  connected ? 'hover:bg-[#1a1a1a] cursor-pointer' : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {selectedToken ? (
                    <>
                      {selectedToken.image ? (
                        <img
                          src={selectedToken.image}
                          alt={selectedToken.symbol}
                          className="w-4 h-4 sm:w-5 sm:h-5 rounded-full shrink-0 object-cover"
                        />
                      ) : (
                        <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full shrink-0 bg-gray-700 flex items-center justify-center">
                          <span className="text-[8px] sm:text-[10px] text-gray-400 font-rajdhani font-bold">
                            {selectedToken.symbol.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div className="flex flex-col items-start">
                        <span className="font-rajdhani font-semibold text-xs sm:text-sm md:text-[15px] text-white truncate">
                          {selectedToken.symbol}
                        </span>
                        <span className="font-rajdhani text-[10px] sm:text-xs text-gray-500">
                          Balance: {selectedToken.balance.toFixed(4)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="font-rajdhani font-semibold text-xs sm:text-sm md:text-[15px] text-gray-400">
                      {connected ? 'Select Token' : 'Connect Wallet to Select Token'}
                    </span>
                  )}
                </div>
                <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 shrink-0" />
              </button>
            </div>

            {/* Destination Chain Selector */}
            <div className="flex flex-col gap-3 mb-4">
              <div className="font-rajdhani font-medium text-xs sm:text-sm md:text-[15px] text-[rgba(255,255,255,0.65)] uppercase">
                Select Destination Chain
              </div>
              
              <div className="relative">
                <button
                  onClick={() => setShowToChainDropdown(!showToChainDropdown)}
                  className="w-full bg-[#131313] border border-[#393939] flex gap-2 items-center justify-between px-3 py-2 sm:py-2.5 rounded-lg hover:bg-[#1a1a1a] transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <img
                      src={getChainIcon(getChainIconName(toChain))}
                      alt={SUPPORTED_CHAINS[toChain].name}
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded-full shrink-0 object-cover"
                    />
                    <span className="font-rajdhani font-semibold text-xs sm:text-sm md:text-[15px] text-white truncate">
                      {SUPPORTED_CHAINS[toChain].name}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 shrink-0" />
                </button>

                {showToChainDropdown && (
                  <div className="absolute top-full mt-1 w-full bg-[#1a1a1a] border border-[#393939] rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                    {evmChains.map((chain) => (
                      <button
                        key={chain.key}
                        onClick={() => {
                          setToChain(chain.key);
                          setShowToChainDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-left font-rajdhani text-sm sm:text-[15px] text-white hover:bg-[#262626] transition-colors flex items-center gap-2"
                      >
                        <img
                          src={getChainIcon(getChainIconName(chain.key))}
                          alt={chain.name}
                          className="w-4 h-4 sm:w-5 sm:h-5 rounded-full shrink-0 object-cover"
                        />
                        <span>{chain.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Amount Input Section */}
            <div className="flex flex-col w-full mb-4">
              {/* From Solana Amount */}
              <div className="border border-white/12 h-[120px] sm:h-[135px] overflow-hidden relative rounded-t-xl bg-black/20">
                <div className="absolute inset-0 flex items-center justify-between px-3 sm:px-4 gap-2 sm:gap-4">
                  <div className="flex flex-col gap-1.5 sm:gap-2 flex-1 min-w-0">
                    <div className="font-rajdhani font-medium text-xs sm:text-sm md:text-[15px] text-[rgba(255,255,255,0.65)] uppercase">
                      From Solana
                    </div>
                    <input
                      type="text"
                      value={fromAmount}
                      onChange={(e) => setFromAmount(e.target.value)}
                      disabled={!selectedToken}
                      className="w-full text-2xl sm:text-3xl md:text-[36px] font-rajdhani font-medium bg-transparent border-none focus:ring-0 focus:outline-none text-white placeholder:text-[rgba(255,255,255,0.38)] h-auto p-0 disabled:opacity-50"
                      placeholder="0"
                      inputMode="decimal"
                    />
                    <div className="h-[16px] sm:h-[18px] bg-white/5 rounded-full px-2 flex items-center w-fit">
                      <span className="font-rajdhani font-medium text-[11px] sm:text-xs md:text-[13px] text-[rgba(255,255,255,0.65)]">
                        ${calculateUsdValue()}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 items-center shrink-0">
                    {selectedToken ? (
                      <>
                        <div className="bg-[#131313] border border-[#393939] flex gap-1.5 sm:gap-2 items-center justify-center pl-1.5 sm:pl-2 pr-2 sm:pr-3 py-1.5 sm:py-2 rounded-full shadow-[0px_0px_10px_0px_rgba(255,255,255,0.04)]">
                          <div className="bg-white rounded-full p-0.5 sm:p-1 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center overflow-hidden shrink-0">
                            {selectedToken.image ? (
                              <img
                                src={selectedToken.image}
                                alt={selectedToken.symbol}
                                className="w-full h-full object-cover rounded-full"
                              />
                            ) : (
                              <div className="w-full h-full rounded-full bg-gray-700 flex items-center justify-center">
                                <span className="text-[8px] sm:text-[10px] text-gray-300 font-rajdhani font-bold">
                                  {selectedToken.symbol.charAt(0)}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-rajdhani font-semibold text-xs sm:text-sm md:text-[15px] text-white whitespace-nowrap">
                              {selectedToken.symbol}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={handleHalfAmount}
                            className="px-2 py-1 text-[10px] sm:text-xs font-rajdhani font-medium text-gray-400 hover:text-white transition-colors"
                          >
                            50%
                          </button>
                          <button
                            onClick={handleMaxAmount}
                            className="px-2 py-1 text-[10px] sm:text-xs font-rajdhani font-medium text-gray-400 hover:text-white transition-colors"
                          >
                            Max
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="bg-[#131313] border border-[#393939] flex gap-1.5 sm:gap-2 items-center justify-center px-3 py-1.5 sm:py-2 rounded-full shadow-[0px_0px_10px_0px_rgba(255,255,255,0.04)]">
                        <span className="font-rajdhani font-semibold text-xs sm:text-sm md:text-[15px] text-gray-400 whitespace-nowrap">
                          Select Token
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* To Amount - Shows wrapped token */}
              <div className="border-l border-r border-b border-white/12 h-[115px] sm:h-[125px] relative rounded-b-xl bg-black/20">
                <div className="absolute inset-0 flex items-center justify-between px-3 sm:px-4 gap-2 sm:gap-4">
                  <div className="flex flex-col gap-1.5 sm:gap-2 flex-1 min-w-0">
                    <div className="font-rajdhani font-medium text-xs sm:text-sm md:text-[15px] text-[rgba(255,255,255,0.65)] uppercase">
                      To {SUPPORTED_CHAINS[toChain].name} (Wrapped)
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {fromAmount && parseFloat(fromAmount) > 0 ? (
                        <span className="text-2xl sm:text-3xl md:text-[36px] font-rajdhani font-medium text-white">
                          {fromAmount}
                        </span>
                      ) : (
                        <span className="text-2xl sm:text-3xl md:text-[36px] font-rajdhani font-medium text-[rgba(255,255,255,0.38)]">
                          0
                        </span>
                      )}
                      {selectedToken && (
                        <div className="bg-[#131313] border border-[#393939] flex gap-1.5 sm:gap-2 items-center justify-center pl-1.5 sm:pl-2 pr-2 sm:pr-3 py-1.5 sm:py-2 rounded-full shadow-[0px_0px_10px_0px_rgba(255,255,255,0.04)] shrink-0">
                          <div className="bg-white rounded-full p-0.5 sm:p-1 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center overflow-hidden shrink-0">
                            {selectedToken.image ? (
                              <img
                                src={selectedToken.image}
                                alt={wrappedTokenSymbol}
                                className="w-full h-full object-cover rounded-full"
                              />
                            ) : (
                              <div className="w-full h-full rounded-full bg-gray-700 flex items-center justify-center">
                                <span className="text-[8px] sm:text-[10px] text-gray-300 font-rajdhani font-bold">
                                  {selectedToken.symbol.charAt(0)}
                                </span>
                              </div>
                            )}
                          </div>
                          <span className="font-rajdhani font-semibold text-xs sm:text-sm md:text-[15px] text-white whitespace-nowrap">
                            {wrappedTokenSymbol}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Destination Address Input */}
            <div className="mb-4">
              <div className="font-rajdhani font-medium text-xs sm:text-sm md:text-[15px] text-[rgba(255,255,255,0.65)] uppercase mb-2">
                Destination Address
              </div>
              <input
                type="text"
                placeholder="0x..."
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
                className="w-full bg-[#131313] border border-[#393939] rounded-lg px-3 py-2 sm:py-2.5 text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-[#d08700] placeholder:text-gray-600"
              />
            </div>

            {/* Summary Section */}
            <div className="w-full flex flex-col gap-3">
              <div className="border-b border-gray-800 pb-2 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-rajdhani font-bold text-xs sm:text-sm text-[#79767d] uppercase">
                    You Will Receive
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedToken && fromAmount && parseFloat(fromAmount) > 0 ? (
                      <div className="font-rajdhani font-bold text-sm sm:text-base md:text-[18px] text-white leading-tight sm:leading-[28px] text-right break-words">
                        {fromAmount} {wrappedTokenSymbol}
                      </div>
                    ) : (
                      <div className="font-rajdhani font-bold text-sm sm:text-base md:text-[18px] text-[#79767d] leading-tight sm:leading-[28px]">
                        --
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between gap-2">
                <div className="font-rajdhani font-bold text-xs sm:text-sm text-[#79767d] uppercase">
                  Estimated Processing Time
                </div>
                <div className="font-rajdhani font-bold text-sm sm:text-base md:text-[18px] text-[#79767d] leading-tight sm:leading-[28px]">
                  ~{Math.floor(estimatedTime / 60)}m
                </div>
              </div>
            </div>

            {/* Bridge Button */}
            <button
              onClick={handleBridge}
              disabled={!connected || !selectedToken || !fromAmount || !destinationAddress || isBridging}
              className={`w-full mt-6 py-3 sm:py-3.5 px-4 font-rajdhani font-bold text-sm sm:text-base rounded-lg transition-all ${
                !connected || !selectedToken || !fromAmount || !destinationAddress || isBridging
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-[#d08700] hover:bg-[#b87600] text-black cursor-pointer'
              }`}
            >
              {isBridging ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Bridging...
                </div>
              ) : !connected ? (
                'Connect Wallet'
              ) : !selectedToken ? (
                'Select Token to Bridge'
              ) : (
                `Bridge to ${wrappedTokenSymbol || 'Wrapped Token'}`
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Token Selection Modal */}
      {showTokenModal && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowTokenModal(false)}
          data-modal
        >
          <div 
            className="bg-neutral-950 border border-gray-800 rounded-lg max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-rajdhani font-bold text-lg sm:text-xl text-white">
                  Select Token to Bridge
                </h3>
                <button
                  onClick={() => setShowTokenModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search by token name, symbol or address"
                  value={tokenSearchQuery}
                  onChange={(e) => setTokenSearchQuery(e.target.value)}
                  className="w-full bg-[#131313] border border-[#393939] rounded-lg pl-10 pr-3 py-2 sm:py-2.5 text-white font-rajdhani text-sm focus:outline-none focus:border-[#d08700] placeholder:text-gray-600"
                />
              </div>
            </div>

            {/* Token List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingTokens ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#d08700]" />
                </div>
              ) : filteredTokens.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileX className="w-16 h-16 text-gray-600 mb-4" />
                  <p className="text-gray-500 font-rajdhani text-sm">
                    {tokenSearchQuery ? 'No tokens match your search' : (connected ? 'No tokens found in your wallet' : 'No tokens available')}
                  </p>
                  {!tokenSearchQuery && !connected && (
                    <p className="text-gray-600 font-rajdhani text-xs mt-1">
                      Connect your wallet to see tokens
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {filteredTokens.map((token) => (
                    <button
                      key={token.mint}
                      onClick={() => {
                        setSelectedToken(token);
                        setShowTokenModal(false);
                        setFromAmount('');
                      }}
                      className="w-full px-3 py-3 rounded-lg hover:bg-[#1a1a1a] transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {token.image ? (
                          <img
                            src={token.image}
                            alt={token.symbol}
                            className="w-8 h-8 rounded-full shrink-0 object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full shrink-0 bg-gray-700 flex items-center justify-center">
                            <span className="text-xs text-gray-300 font-rajdhani font-bold">
                              {token.symbol.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-col items-start min-w-0">
                          <span className="font-rajdhani font-semibold text-sm text-white">
                            {token.symbol}
                          </span>
                          <span className="font-rajdhani text-xs text-gray-500 truncate max-w-full">
                            {token.name}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="font-rajdhani font-semibold text-sm text-white">
                          {token.balance.toFixed(4)}
                        </span>
                        <span className="font-rajdhani text-xs text-gray-500">
                          Balance
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}