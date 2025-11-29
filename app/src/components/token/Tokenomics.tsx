import { LockKeyhole } from 'lucide-react';

export function Tokenomics() {
  return (
    <div className="relative w-full backdrop-blur-[2px] bg-[rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.1)] mt-6">
      {/* Corner Borders */}
      <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-[#d08700] z-10"></div>
      <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-[#d08700] z-10"></div>
      <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-white z-10"></div>
      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-white z-10"></div>

      <div className="p-6 flex flex-col gap-6">
        {/* Supply & Valuation */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-[#d08700]"></div>
            <h3 className="font-rajdhani font-bold text-2xl text-white">SUPPLY & VALUATION</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <span className="font-rajdhani font-medium text-sm text-gray-300">IMPLIED FDV</span>
                        {/* Info Icon */}
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="font-rajdhani font-bold text-2xl text-[#d08700]">$12,500,000</span>
                        <span className="font-rajdhani text-sm text-gray-300">(Fully Diluted)</span>
                    </div>
                    <span className="font-rajdhani font-medium text-sm text-gray-300">Based on current ZEC Price</span>
                </div>
            </div>

             <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <span className="font-rajdhani font-medium text-sm text-gray-300">INITIAL MARKET CAP</span>
                    <div className="flex items-baseline gap-2">
                        <span className="font-rajdhani font-bold text-2xl text-[#d08700]">$1,875,000</span>
                        <span className="font-rajdhani text-sm text-gray-300">(Cypher sale only)</span>
                    </div>
                    <span className="font-rajdhani font-medium text-sm text-gray-300">Starting market cap at launch</span>
                </div>
            </div>
          </div>
        </div>

        {/* Tokenomics Distribution */}
        <div className="flex flex-col gap-4 mt-4">
             <div className="flex items-center gap-3">
                {/* Pie Chart Icon */}
                <h3 className="font-rajdhani font-bold text-xl text-white">TOKENOMICS DISTRIBUTION</h3>
            </div>

            {/* Progress Bar */}
            <div className="relative h-[42px] bg-slate-700 w-full overflow-hidden flex text-white font-rajdhani font-bold text-xs md:text-sm">
                {/* Sale (15%) */}
                <div className="h-full bg-[#d08700] w-[15%] flex items-center justify-center relative">
                    <div className="flex items-center gap-1 z-10 px-2">
                         {/* Token Icon */}
                         <span>SALE</span>
                    </div>
                </div>
                {/* Liquidity (45%) */}
                <div className="h-full bg-blue-600 w-[45%] flex items-center justify-center relative">
                    <div className="flex items-center gap-2 z-10">
                        <span>LIQUIDITY</span>
                        <LockKeyhole className="w-3 h-3 md:w-4 md:h-4" />
                    </div>
                </div>
                 {/* Team (20%) */}
                <div className="h-full bg-purple-600 w-[20%] flex items-center justify-center relative">
                    <div className="flex items-center gap-2 z-10">
                         {/* Lock Icon */}
                         <LockKeyhole className="w-3 h-3 md:w-4 md:h-4" />
                    </div>
                </div>
                 {/* Treasury (20%) */}
                <div className="h-full bg-slate-700 w-[20%] flex items-center justify-center relative">
                    <div className="flex items-center gap-2 z-10">
                         {/* Lock Icon */}
                         <LockKeyhole className="w-3 h-3 md:w-4 md:h-4" />
                    </div>
                </div>
            </div>

            {/* Legend / Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                {/* Sale Card */}
                <div className="bg-[rgba(208,135,0,0.06)] border border-[#b66e00] p-3 flex flex-col gap-3">
                     <div className="flex items-center gap-2">
                         <div className="w-4 h-4 bg-[#d08700]"></div>
                         <span className="font-rajdhani font-bold text-sm text-[#d08700]">CYPHER SALE</span>
                     </div>
                     <div className="font-rajdhani font-bold text-2xl text-white">15%</div>
                     <div className="font-rajdhani font-medium text-sm text-gray-300">15,000,000 DARK</div>
                </div>
                 {/* Liquidity Card */}
                <div className="bg-[rgba(37,99,235,0.06)] border border-blue-600 p-3 flex flex-col gap-3">
                     <div className="flex items-center gap-2">
                         <div className="w-4 h-4 bg-blue-600"></div>
                         <span className="font-rajdhani font-bold text-sm text-blue-600">LIQUIDITY</span>
                     </div>
                     <div className="font-rajdhani font-bold text-2xl text-white">45%</div>
                     <div className="font-rajdhani font-medium text-sm text-gray-300">Meteora pools</div>
                </div>
                 {/* Team Card */}
                <div className="bg-[rgba(147,51,234,0.06)] border border-purple-600 p-3 flex flex-col gap-3">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                             <div className="w-4 h-4 bg-purple-600"></div>
                             <span className="font-rajdhani font-bold text-sm text-purple-600">TEAM</span>
                         </div>
                         <LockKeyhole className="w-4 h-4 text-purple-600" />
                     </div>
                     <div className="font-rajdhani font-bold text-2xl text-white">20%</div>
                     <div className="font-rajdhani font-medium text-sm text-gray-300">12M Vesting</div>
                </div>
                 {/* Treasury Card */}
                <div className="bg-[rgba(51,65,85,0.06)] border border-slate-700 p-3 flex flex-col gap-3">
                     <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                             <div className="w-4 h-4 bg-slate-700"></div>
                             <span className="font-rajdhani font-bold text-sm text-slate-700">TREASURY</span>
                         </div>
                         <LockKeyhole className="w-4 h-4 text-slate-700" />
                     </div>
                     <div className="font-rajdhani font-bold text-2xl text-white">20%</div>
                     <div className="font-rajdhani font-medium text-sm text-gray-300">Future Growth</div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

