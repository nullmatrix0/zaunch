'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OneClickToken } from '@/lib/oneclick';
import { getChainIcon, getOneClickTokenIcon, capitalizeAll } from '@/lib/tokenIcons';
import Image from 'next/image';

interface TokenSelectorProps {
  availableTokens: OneClickToken[];
  selectedBlockchain: string;
  selectedToken: OneClickToken | null;
  onBlockchainSelect: (blockchain: string) => void;
  onTokenSelect: (token: OneClickToken) => void;
  disabled?: boolean;
}

export function TokenSelector({
  availableTokens,
  selectedBlockchain,
  selectedToken,
  onBlockchainSelect,
  onTokenSelect,
  disabled,
}: TokenSelectorProps) {
  const [showBlockchainDropdown, setShowBlockchainDropdown] = useState(false);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);

  const blockchains = Array.from(new Set(availableTokens.map((t) => t.blockchain)));
  const tokensForBlockchain = availableTokens.filter((t) => t.blockchain === selectedBlockchain);

  const handleBlockchainSelect = (blockchain: string) => {
    onBlockchainSelect(blockchain);
    setShowBlockchainDropdown(false);
    setShowTokenDropdown(false);
  };

  const handleTokenSelect = (token: OneClickToken) => {
    onTokenSelect(token);
    setShowTokenDropdown(false);
  };

  return (
    <div className="space-y-3">
      {/* Blockchain Selector */}
      <div className="relative">
        <Button
          type="button"
          onClick={() => setShowBlockchainDropdown(!showBlockchainDropdown)}
          disabled={disabled}
          className="w-full justify-between bg-black/30 border border-gray-700 hover:border-gray-600"
        >
          <div className="flex items-center gap-2">
            {selectedBlockchain !== 'Chain' && (
              <Image
                src={getChainIcon(selectedBlockchain)}
                alt={selectedBlockchain}
                width={20}
                height={20}
                className="rounded-full"
              />
            )}
            <span>{capitalizeAll(selectedBlockchain)}</span>
          </div>
          <ChevronDown className="w-4 h-4" />
        </Button>

        {showBlockchainDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-900 border border-gray-700 rounded max-h-60 overflow-y-auto z-50">
            {blockchains.map((blockchain) => (
              <button
                key={blockchain}
                type="button"
                onClick={() => handleBlockchainSelect(blockchain)}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-800 text-left"
              >
                <Image
                  src={getChainIcon(blockchain)}
                  alt={blockchain}
                  width={20}
                  height={20}
                  className="rounded-full"
                />
                <span className="text-white">{capitalizeAll(blockchain)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Token Selector */}
      {selectedBlockchain !== 'Chain' && (
        <div className="relative">
          <Button
            type="button"
            onClick={() => setShowTokenDropdown(!showTokenDropdown)}
            disabled={disabled || tokensForBlockchain.length === 0}
            className="w-full justify-between bg-black/30 border border-gray-700 hover:border-gray-600"
          >
            <div className="flex items-center gap-2">
              {selectedToken && (
                <Image
                  src={getOneClickTokenIcon(selectedToken.symbol)}
                  alt={selectedToken.symbol}
                  width={20}
                  height={20}
                  className="rounded-full"
                />
              )}
              <span>{selectedToken ? selectedToken.symbol : 'Select Token'}</span>
            </div>
            <ChevronDown className="w-4 h-4" />
          </Button>

          {showTokenDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-900 border border-gray-700 rounded max-h-60 overflow-y-auto z-50">
              {tokensForBlockchain.map((token) => (
                <button
                  key={token.assetId}
                  type="button"
                  onClick={() => handleTokenSelect(token)}
                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-800 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Image
                      src={getOneClickTokenIcon(token.symbol)}
                      alt={token.symbol}
                      width={20}
                      height={20}
                      className="rounded-full"
                    />
                    <span className="text-white">{token.symbol}</span>
                  </div>
                  <span className="text-xs text-gray-400">${token.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
