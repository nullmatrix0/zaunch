'use client';

import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { WalletButton } from '../wallet/WalletButton';

export default function Header() {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const { prices } = useCryptoPrices();

  useEffect(() => {
    if (sidebarOpen) {
      const scrollY = window.scrollY;

      document.body.classList.add('sidebar-open');
      document.documentElement.classList.add('sidebar-open');

      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      document.body.style.touchAction = 'none';
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.touchAction = 'none';
    } else {
      const scrollY = document.body.style.top;

      document.body.classList.remove('sidebar-open');
      document.documentElement.classList.remove('sidebar-open');

      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.touchAction = '';

      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    return () => {
      document.body.classList.remove('sidebar-open');
      document.documentElement.classList.remove('sidebar-open');
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.touchAction = '';
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [sidebarOpen]);

  return (
    <header className="absolute top-0 left-0 right-0 z-50 backdrop-blur-[6px] bg-[rgba(0,0,0,0.8)] border-b-[0.667px] border-gray-800">
      <div className="w-full px-3 md:px-[76px] h-[72px] flex items-center justify-center">
        <div className="container w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="relative w-8 h-8 rounded-full overflow-hidden">
                <img src="/logo.png" alt="Zaunchpad" className="w-full h-full object-cover" />
              </div>
              <span className="text-lg sm:text-[20px] font-bold font-space-grotesk text-white tracking-[-1px] leading-[28px]">
                ZAUNCHPAD
              </span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/token"
              className={`font-rajdhani font-medium text-sm text-gray-400 hover:text-white transition-colors leading-[20px] uppercase pb-0.5 ${
                pathname === '/token' ||
                (pathname.startsWith('/token/') && pathname !== '/token/me')
                  ? 'border-b border-[#d08700] text-white'
                  : ''
              }`}
            >
              EXPLORE LAUNCHES
            </Link>
            <Link
              href="/create"
              className={`font-rajdhani font-medium text-sm text-gray-400 hover:text-white transition-colors leading-[20px] uppercase pb-0.5 ${
                pathname === '/create' ? 'border-b border-[#d08700] text-white' : ''
              }`}
            >
              CREATE
            </Link>
            <Link
              href="/bridge"
              className={`font-rajdhani font-medium text-sm text-gray-400 hover:text-white transition-colors leading-[20px] uppercase pb-0.5 ${
                pathname === '/bridge' ? 'border-b border-[#d08700] text-white' : ''
              }`}
            >
              BRIDGE
            </Link>
            <Link
              href="/token/me"
              className={`font-rajdhani font-medium text-sm text-gray-400 hover:text-white transition-colors leading-[20px] uppercase pb-0.5 ${
                pathname === '/token/me' ? 'border-b border-[#d08700] text-white' : ''
              }`}
            >
              MY TICKETS
            </Link>
          </nav>

          <div className="flex items-center gap-4 md:gap-6">
            <div className="hidden md:flex flex-col items-start border-l border-[rgba(208,135,0,0.15)] pl-3">
              <span className="font-rajdhani font-semibold text-[#b3b3b3] text-sm leading-none mb-1">
                ZEC
              </span>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-rajdhani font-medium text-[#d08700] text-sm">
                  ${prices.zcash?.toFixed(2) ?? '---'}
                </span>
                {prices.zcash_change && (
                  <span
                    className={`font-rajdhani text-xs ${prices.zcash_change >= 0 ? 'text-green-500' : 'text-red-500'}`}
                  >
                    {prices.zcash_change >= 0 ? '+' : ''}
                    {prices.zcash_change.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>

            <div className="hidden md:flex items-center">
              <WalletButton />
            </div>

            <button
              className="flex md:hidden items-center justify-center w-10 h-10 text-white transition-colors"
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

      {sidebarOpen && (
        <>
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-[60] sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
            onTouchMove={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            aria-hidden="true"
          />

          {/* Sidebar */}
          <div
            className="fixed left-0 top-0 h-screen w-full sm:w-80 bg-black shadow-lg flex flex-col p-4 sm:p-6 border-r border-gray-800 z-[70] overflow-y-auto sidebar-content"
            onTouchMove={(e) => {
              e.stopPropagation();
            }}
          >
            <button
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white transition-colors touch-manipulation"
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
            <div className="flex items-center gap-2 mb-8 mt-2">
              <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                <img src="/logo.png" alt="Zaunchpad" className="w-full h-full object-cover" />
              </div>
              <span className="text-xl font-bold font-space-grotesk text-white tracking-[-1px]">
                ZAUNCHPAD
              </span>
            </div>
            <nav className="flex flex-col space-y-4 sm:space-y-6 mb-8">
              <Link
                href="/token"
                className={`font-rajdhani font-medium text-base sm:text-lg text-gray-400 hover:text-white transition-colors uppercase pb-2 min-h-[44px] flex items-center ${
                  pathname === '/token' ||
                  (pathname.startsWith('/token/') && pathname !== '/token/me')
                    ? 'border-b-2 border-[#d08700] text-white'
                    : ''
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                EXPLORE LAUNCHES
              </Link>
              <Link
                href="/create"
                className={`font-rajdhani font-medium text-base sm:text-lg text-gray-400 hover:text-white transition-colors uppercase pb-2 min-h-[44px] flex items-center ${
                  pathname === '/create' ? 'border-b-2 border-[#d08700] text-white' : ''
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                CREATE
              </Link>
              <Link
                href="/token/me"
                className={`font-rajdhani font-medium text-base sm:text-lg text-gray-400 hover:text-white transition-colors uppercase pb-2 min-h-[44px] flex items-center ${
                  pathname === '/token/me' ? 'border-b-2 border-[#d08700] text-white' : ''
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                MY TICKETS
              </Link>
            </nav>
            <div className="flex flex-col gap-4 border-t border-[rgba(208,135,0,0.42)] pt-4 mt-auto">
              <div className="flex items-center justify-between border-b border-[rgba(208,135,0,0.15)] pb-3 pt-2">
                <span className="font-rajdhani font-semibold text-[#b3b3b3] text-sm">
                  ZEC Price
                </span>
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-rajdhani font-medium text-[#d08700] text-sm">
                    ${prices.zcash?.toFixed(2) ?? '---'}
                  </span>
                  {prices.zcash_change && (
                    <span
                      className={`font-rajdhani text-xs ${prices.zcash_change >= 0 ? 'text-green-500' : 'text-red-500'}`}
                    >
                      {prices.zcash_change >= 0 ? '+' : ''}
                      {prices.zcash_change.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
              <WalletButton />
            </div>
          </div>
        </>
      )}
    </header>
  );
}
