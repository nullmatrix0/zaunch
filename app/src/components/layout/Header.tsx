'use client';

import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { WalletButton } from '../wallet/WalletButton';

export default function Header() {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const { prices } = useCryptoPrices();

  return (
    <header className="absolute top-0 left-0 right-0 z-50 backdrop-blur-[6px] bg-[rgba(0,0,0,0.8)] border-b-[0.667px] border-gray-800">
      <div className="w-full px-6 md:px-[76px] h-[72px] flex items-center justify-center">
        <div className="max-w-[1280px] w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="relative w-8 h-8 rounded-full overflow-hidden">
                 <img src="https://www.figma.com/api/mcp/asset/d49b160e-ee57-43e4-b824-9fc293d3a6eb" alt="Zaunchpad" className="w-full h-full object-cover" />
              </div>
              <span className="text-[20px] font-bold font-space-grotesk text-white tracking-[-1px] leading-[28px]">
                ZAUNCHPAD
              </span>
            </Link>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/token"
              className="font-rajdhani font-medium text-sm text-gray-400 hover:text-white transition-colors leading-[20px] uppercase"
            >
              EXPLORE LAUNCHES
            </Link>
            <Link
              href="/create"
              className="font-rajdhani font-medium text-sm text-gray-400 hover:text-white transition-colors leading-[20px] uppercase"
            >
              CREATE
            </Link>
            <Link
              href="/token/me"
              className="font-rajdhani font-medium text-sm text-gray-400 hover:text-white transition-colors leading-[20px] uppercase"
            >
              MY TICKETS
            </Link>
          </nav>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-start border-l border-[rgba(208,135,0,0.15)] pl-3">
                <span className="font-rajdhani font-semibold text-[#b3b3b3] text-sm leading-none mb-1">ZEC</span>
                <div className="flex items-center gap-1.5 leading-none">
                    <span className="font-rajdhani font-medium text-[#d08700] text-sm">
                        ${prices.zcash?.toFixed(2) ?? '---'}
                    </span>
                    {prices.zcash_change && (
                        <span className={`font-rajdhani text-xs ${prices.zcash_change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {prices.zcash_change >= 0 ? '+' : ''}{prices.zcash_change.toFixed(2)}%
                        </span>
                    )}
                </div>
            </div>

            <div className="hidden md:flex items-center">
              <WalletButton />
            </div>

            <div className="flex flex-row items-center gap-4 md:hidden">
              <button
                className="flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 text-white"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <svg
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-6 h-6"
                >
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black opacity-80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          ></div>
          <div className="relative bg-[#050505] w-64 h-full shadow-lg flex flex-col p-6 border-r border-gray-800">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              <svg
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-6 h-6"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="flex items-center gap-2 mb-8">
               <div className="relative w-8 h-8 rounded-full overflow-hidden">
                 <img src="https://www.figma.com/api/mcp/asset/d49b160e-ee57-43e4-b824-9fc293d3a6eb" alt="Zaunchpad" className="w-full h-full object-cover" />
              </div>
              <span className="text-xl font-bold font-space-grotesk text-white tracking-[-1px]">
                ZAUNCHPAD
              </span>
            </div>
            <nav className="flex flex-col space-y-6 mb-8">
              <Link
                href="/token"
                className="font-rajdhani font-medium text-lg text-gray-400 hover:text-white transition-colors"
                onClick={() => setSidebarOpen(false)}
              >
                EXPLORE LAUNCHES
              </Link>
              <Link
                href="/create"
                className="font-rajdhani font-medium text-lg text-gray-400 hover:text-white transition-colors"
                onClick={() => setSidebarOpen(false)}
              >
                CREATE
              </Link>
              <Link
                href="/token/me"
                className="font-rajdhani font-medium text-lg text-gray-400 hover:text-white transition-colors"
                onClick={() => setSidebarOpen(false)}
              >
                MY TICKETS
              </Link>
              <a
                href="https://www.zaunchpad.com/docs"
                target="_blank"
                className="font-rajdhani font-medium text-lg text-gray-400 hover:text-white transition-colors"
                onClick={() => setSidebarOpen(false)}
                rel="noopener"
              >
                DOCS
              </a>
            </nav>
            <div className="mt-auto flex flex-col gap-4">
               <div className="flex items-center justify-between border-b border-[rgba(208,135,0,0.15)] pb-4">
                    <span className="font-rajdhani font-semibold text-[#b3b3b3] text-sm">ZEC Price</span>
                    <div className="flex items-center gap-1.5 leading-none">
                        <span className="font-rajdhani font-medium text-[#d08700] text-sm">
                            ${prices.zcash?.toFixed(2) ?? '---'}
                        </span>
                    </div>
                </div>
              <WalletButton />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
