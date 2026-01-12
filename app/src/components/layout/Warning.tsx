'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { X, ExternalLink } from 'lucide-react';
import { SOL_NETWORK } from '@/configs/env.config';

export const Warning = () => {
  const [showModal, setShowModal] = useState(false);
  const pathname = usePathname();

  if (SOL_NETWORK !== 'devnet') {
    return null;
  }

  const isBridgePage = pathname?.includes('/bridge');

  return (
    <>
      <div className="w-full bg-red-600 border-y border-black/20 absolute top-[72px] left-0 right-0 z-40">
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-1.5 px-3 sm:px-4 md:px-8">
          {/* Warning Icon */}
          <div className="shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center">
            <svg
              width="14"
              height="14"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full"
            >
              <path
                d="M10 2L2 18H18L10 2Z"
                fill="white"
              />
              <path
                d="M10 6.5V10.5M10 13.5C10.2761 13.5 10.5 13.7239 10.5 14C10.5 14.2761 10.2761 14.5 10 14.5C9.72386 14.5 9.5 14.2761 9.5 14C9.5 13.7239 9.72386 13.5 10 13.5Z"
                fill="#DC2626"
              />
            </svg>
          </div>
          
          {/* Warning Text - Mobile */}
          <span className="sm:hidden font-rajdhani font-bold text-[10px] leading-tight text-white uppercase text-center">
            {pathname?.includes('/bridge') ? (
              '⚠️ DEVNET - BRIDGING WITH REAL FUNDS'
            ) : (
              <>
                ⚠️ DEVNET - PAYING WITH{' '}
                <button 
                  onClick={() => setShowModal(true)}
                  className="underline cursor-pointer hover:text-yellow-200 transition-colors"
                >
                  REAL FUNDS
                </button>
              </>
            )}
          </span>
          
          {/* Warning Text - Desktop */}
          <span className="hidden sm:inline font-rajdhani font-bold text-xs md:text-sm leading-5 text-white uppercase">
            {pathname?.includes('/bridge') ? (
              'WARNING: YOU ARE BRIDGING ON DEVNET WITH REAL FUNDS. USE CAUTION.'
            ) : (
              <>
                WARNING: YOU ARE ON DEVNET BUT PAYING WITH{' '}
                <button 
                  onClick={() => setShowModal(true)}
                  className="underline cursor-pointer hover:text-yellow-200 transition-colors"
                >
                  REAL FUNDS.
                </button>
                {' '}NEAR INTENTS DO NOT SUPPORT DEVNET.
              </>
            )}
          </span>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-neutral-900 border border-gray-700 rounded-lg max-w-md w-full p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-600/20 flex items-center justify-center">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10 2L2 18H18L10 2Z" fill="#DC2626" />
                    <path
                      d="M10 6.5V10.5M10 13.5C10.2761 13.5 10.5 13.7239 10.5 14C10.5 14.2761 10.2761 14.5 10 14.5C9.72386 14.5 9.5 14.2761 9.5 14C9.5 13.7239 9.72386 13.5 10 13.5Z"
                      fill="white"
                    />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-rajdhani font-bold text-white">
                  Why Real Funds on Testnet?
                </h3>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4 text-sm sm:text-base font-rajdhani text-gray-300">
              <p>
                Our test environment consists of paying <span className="text-white font-semibold">real tokens via NEAR Intents</span> for minimal amounts (capped in test mode), but claiming tokens on <span className="text-white font-semibold">Solana testnet</span> and bridged test assets.
              </p>
              
              <div className="bg-[rgba(208,135,0,0.1)] border border-[#d08700]/30 rounded p-3">
                <p className="text-[#d08700] font-medium text-sm">
                  💡 This is because NEAR Intents only operates on mainnet and does not support testnet environments.
                </p>
              </div>

              <p className="text-gray-400 text-sm">
                To minimize risk, we cap the maximum price per token to <span className="text-white">$0.10</span> during testing.
              </p>
            </div>

            {/* Links */}
            <div className="mt-5 pt-4 border-t border-gray-700">
              <p className="text-xs text-gray-500 font-rajdhani mb-3">Learn more:</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href="https://solana.com/docs/core/clusters"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-[#9945FF]/10 border border-[#9945FF]/30 rounded text-[#9945FF] hover:bg-[#9945FF]/20 transition-colors text-sm font-rajdhani"
                >
                  <img src="/chains/solana.svg" alt="Solana" className="w-4 h-4" />
                  Solana Testnet Docs
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href="https://docs.near.org/concepts/abstraction/chain-signatures"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-[#00EC97]/10 border border-[#00EC97]/30 rounded text-[#00EC97] hover:bg-[#00EC97]/20 transition-colors text-sm font-rajdhani"
                >
                  <img src="/chains/near.svg" alt="NEAR" className="w-4 h-4" />
                  NEAR Intents Docs
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowModal(false)}
              className="w-full mt-4 py-2.5 bg-white text-black font-rajdhani font-bold rounded hover:bg-gray-200 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

