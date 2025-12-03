'use client';

import { SOL_NETWORK } from '@/configs/env.config';

export const Warning = () => {
  if (SOL_NETWORK !== 'devnet') {
    return null;
  }

  return (
    <div className="w-full bg-red-600 border-y border-black/20 absolute top-[72px] left-0 right-0 z-40">
      <div className="flex items-center justify-center gap-2 py-1.5 px-4 md:px-8">
        {/* Warning Icon */}
        <div className="shrink-0 w-4 h-4 flex items-center justify-center">
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
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
        
        {/* Warning Text */}
        <span className="font-rajdhani font-bold text-xs md:text-sm leading-5 text-white uppercase whitespace-nowrap">
          WARNING: YOU ARE ON DEVNET BUT PAYING WITH{' '}
          <span className="underline">REAL FUNDS.</span> NEAR INTENTS DO NOT SUPPORT DEVNET.
        </span>
      </div>
    </div>
  );
};

