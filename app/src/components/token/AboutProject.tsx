'use client';

import { Button } from '@/components/ui/button';
import { Token } from '@/types/token';

interface AboutProjectProps {
  token: Token;
}

export function AboutProject({ token }: AboutProjectProps) {
  return (
    <div className="relative w-full backdrop-blur-[2px] bg-[rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.1)] p-[1px]">
      {/* Corner Borders */}
      <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-[#d08700] z-10"></div>
      <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-[#d08700] z-10"></div>
      <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-white z-10"></div>
      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-white z-10"></div>

      <div className="p-4 sm:p-5 md:p-6 flex flex-col gap-4 sm:gap-5 md:gap-6 relative overflow-hidden">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-[#d08700]"></div>
            <h3 className="font-rajdhani font-bold text-lg sm:text-xl md:text-2xl text-white">
              ABOUT PROJECT
            </h3>
          </div>
          <p className="font-rajdhani text-sm sm:text-base text-gray-400 leading-relaxed">
            {token.description}
          </p>
        </div>
      </div>
    </div>
  );
}
