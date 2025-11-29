'use client';

import Link from 'next/link';
import React from 'react';
import { getIpfsUrl } from '@/lib/utils';

interface TokenSuccessModalProps {
  isVisible: boolean;
  tokenName: string;
  tokenSymbol: string;
  tokenLogo?: string;
  mintAddress?: string;
  onClose: () => void;
  onViewToken: () => void;
}

export default function TokenSuccessModal({
  isVisible,
  tokenName,
  tokenSymbol,
  tokenLogo,
  mintAddress,
  onClose,
  onViewToken,
}: TokenSuccessModalProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black border border-[rgba(255,255,255,0.1)] rounded-lg p-6 max-w-md w-full shadow-2xl">
        <div className="text-center">
          {/* Token Logo */}
          {tokenLogo && (
            <div className="flex justify-center mb-4">
              <img
                src={getIpfsUrl(tokenLogo)}
                alt="Token Logo"
                className="h-16 w-16 rounded-full object-cover border-2 border-[#d08700]"
                onError={(e) => {
                  // Fallback to default icon if image fails to load
                  const target = e.currentTarget as HTMLImageElement;
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (target && fallback) {
                    target.style.display = 'none';
                    fallback.style.display = 'flex';
                  }
                }}
              />
              <div
                className="h-16 w-16 bg-[rgba(255,255,255,0.1)] rounded-full flex items-center justify-center text-[#d08700] text-2xl font-bold border border-[#d08700] font-share-tech-mono"
                style={{ display: 'none' }}
              >
                {tokenSymbol.charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          {/* Success Message */}
          <h3 className="text-xl font-bold text-white mb-2 font-share-tech-mono uppercase">
            Token Created Successfully! 🎉
          </h3>
          <p className="text-sm text-gray-400 mb-4 font-share-tech-mono">
            Your token <strong className="text-white">"{tokenName}"</strong> (
            <span className="text-[#d08700]">{tokenSymbol.toUpperCase()}</span>) has been deployed
            to Solana blockchain.
          </p>

          {/* Token Details */}
          {mintAddress && (
            <div className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg p-3 mb-6">
              <p className="text-xs text-gray-500 mb-1 font-share-tech-mono uppercase">
                Token Address
              </p>
              <Link href={`https://solscan.io/token/${mintAddress}?cluster=devnet`} target="_blank">
                <p className="text-xs font-mono text-[#d08700] break-all underline hover:text-[#e89600] transition-colors font-share-tech-mono">
                  {mintAddress}
                </p>
              </Link>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-[rgba(255,255,255,0.1)] text-gray-400 rounded-none hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.2)] transition-colors cursor-pointer font-share-tech-mono uppercase"
            >
              Close
            </button>
            <button
              onClick={onViewToken}
              className="flex-1 px-4 py-2 bg-[#d08700] text-black rounded-none hover:bg-[#e89600] transition-colors flex items-center justify-center cursor-pointer font-share-tech-mono uppercase font-bold"
            >
              View Token
              <svg className="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
