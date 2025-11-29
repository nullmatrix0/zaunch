import { Info } from 'lucide-react';

export function SaleInformation() {
  return (
    <div className="relative w-full backdrop-blur-[2px] bg-[rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.1)] p-[1px] mt-6">
       {/* Corner Borders */}
       <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-[#d08700] z-10"></div>
       <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-[#d08700] z-10"></div>
       <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-white z-10"></div>
       <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-white z-10"></div>

      <div className="p-6 flex flex-col gap-6 relative overflow-hidden">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-[#d08700]"></div>
            <h3 className="font-rajdhani font-bold text-2xl text-white">SALE INFORMATION</h3>
          </div>
          
          {/* Total Raise Goal */}
           <div className="flex flex-col gap-1">
               <span className="font-rajdhani font-medium text-sm text-gray-300">TOTAL RAISE GOAL</span>
               <div className="flex items-baseline gap-2">
                   <span className="font-rajdhani font-bold text-2xl text-white">12,000</span>
                   <span className="font-rajdhani font-bold text-sm text-[#d08700]">ZEC</span>
               </div>
               <span className="font-rajdhani font-medium text-sm text-gray-400">≈ $375,000 USDC</span>
           </div>

           {/* Raise Progress */}
           <div className="flex flex-col gap-2">
               <div className="flex justify-between text-gray-400 font-rajdhani font-medium text-sm">
                   <span>RAISE PROGRESS</span>
                   <span>6%</span>
               </div>
               <div className="h-3 bg-gray-800 w-full relative">
                   <div className="absolute h-full left-0 bg-gradient-to-r from-[#d08700] to-[#eab308] w-[6%]"></div>
               </div>
               <div className="flex justify-between text-gray-600 font-rajdhani text-sm">
                   <span>120 ZEC</span>
                   <span className="text-center">800 ZEC MIN.</span>
                   <span className="text-right">120,000 ZEC</span>
               </div>
           </div>

           {/* Pool Stats */}
           <div className="flex gap-6">
                <div className="flex-1 bg-[#1d1b20] p-3 flex flex-col justify-center">
                    <span className="font-rajdhani text-sm text-gray-600">TOKENS IN POOL</span>
                    <div className="flex items-baseline gap-1">
                        <span className="font-rajdhani font-bold text-2xl text-white">120,000</span>
                        <span className="font-rajdhani font-bold text-sm text-[#d08700]">ZEC</span>
                    </div>
                </div>
                <div className="flex-1 bg-[#1d1b20] p-3 flex flex-col justify-center">
                    <div className="flex items-center gap-1">
                        <span className="font-rajdhani text-sm text-gray-600">Minimum Raise</span>
                        <Info className="w-3 h-3 text-gray-600" />
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="font-rajdhani font-bold text-2xl text-white">800</span>
                        <span className="font-rajdhani font-bold text-sm text-[#d08700]">ZEC</span>
                    </div>
                </div>
           </div>

            {/* Token Info List */}
            <div className="flex flex-col gap-2">
                <div className="flex justify-between border-b border-white/10 pb-1">
                    <span className="font-rajdhani text-sm text-white">Token Name</span>
                    <span className="font-rajdhani font-semibold text-sm text-white">DarkFi DEX</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-1">
                    <span className="font-rajdhani text-sm text-white">Sale Start</span>
                    <span className="font-rajdhani font-semibold text-sm text-white">05/11/2025</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-1">
                    <span className="font-rajdhani text-sm text-white">Sale End</span>
                    <span className="font-rajdhani font-semibold text-sm text-white">05/11/2025</span>
                </div>
                 <div className="flex justify-between border-b border-white/10 pb-1">
                    <span className="font-rajdhani text-sm text-white">Claim Period</span>
                    <span className="font-rajdhani font-semibold text-sm text-white">Opens immediately after sales</span>
                </div>
                 <div className="flex justify-between border-b border-white/10 pb-1">
                    <div className="flex items-center gap-1">
                         <span className="font-rajdhani text-sm text-white">Refund Policy</span>
                         <Info className="w-3 h-3 text-white" />
                    </div>
                    <span className="font-rajdhani font-semibold text-sm text-white">N/A</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

