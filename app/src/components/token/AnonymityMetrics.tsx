import { AlertTriangle } from 'lucide-react';

export function AnonymityMetrics() {
  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="bg-neutral-950 border border-gray-800 p-4 w-full">
         <h3 className="font-rajdhani font-bold text-xl text-white mb-2">Anonymity Set Metrics</h3>
         <div className="border border-gray-800 flex w-full">
             <div className="flex-1 border-r border-gray-800 p-3 flex flex-col items-center justify-center gap-1">
                 <span className="font-rajdhani text-sm text-[#79767d]">Total Shielded Value</span>
                 <span className="font-rajdhani font-bold text-lg text-white">42,109 ZEC</span>
             </div>
             <div className="flex-1 p-3 flex flex-col items-center justify-center gap-1">
                 <span className="font-rajdhani text-sm text-[#79767d]">Active Tickets</span>
                 <span className="font-rajdhani font-bold text-lg text-white">1,892</span>
             </div>
         </div>
      </div>

      <div className="bg-[rgba(208,135,0,0.05)] border border-[#d08700] p-4 flex gap-3 items-start">
         <AlertTriangle className="w-4 h-4 text-[#d08700] shrink-0 mt-1" />
         <p className="font-rajdhani font-medium text-[#79767d] text-sm leading-relaxed">
             <span className="font-bold text-[#d08700]">How it works: </span>
             <span className="text-[#d08700]"> </span>
             <span>your deposit is added to this pool of uniform notes. When you claim, the smart contract validates your Zero-Knowledge proof without revealing which specific deposit was yours. The larger the set, the stronger the privacy.</span>
         </p>
      </div>
    </div>
  );
}

