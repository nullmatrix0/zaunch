import { AlertTriangle } from 'lucide-react';

export function AnonymityMetrics() {
  return (
    <div className="flex flex-col gap-2 sm:gap-3 w-full">
      <div className="bg-neutral-950 border border-gray-800 p-3 sm:p-4 md:p-5 w-full">
        <h3 className="font-rajdhani font-bold text-base sm:text-lg md:text-xl text-white mb-2 sm:mb-3">
          Anonymity Set Metrics
        </h3>
        <div className="border border-gray-800 flex w-full">
          <div className="flex-1 border-r border-gray-800 p-2 sm:p-2.5 md:p-3 flex flex-col items-center justify-center gap-1">
            <span className="font-rajdhani text-[10px] sm:text-xs md:text-sm text-[#79767d] text-center">
              Total Shielded Value
            </span>
            <span className="font-rajdhani font-bold text-sm sm:text-base md:text-lg text-white break-words text-center">
              42,109 ZEC
            </span>
          </div>
          <div className="flex-1 p-2 sm:p-2.5 md:p-3 flex flex-col items-center justify-center gap-1">
            <span className="font-rajdhani text-[10px] sm:text-xs md:text-sm text-[#79767d] text-center">
              Active Tickets
            </span>
            <span className="font-rajdhani font-bold text-sm sm:text-base md:text-lg text-white break-words text-center">
              1,892
            </span>
          </div>
        </div>
      </div>

      <div className="bg-[rgba(208,135,0,0.05)] border border-[#d08700] p-3 sm:p-4 flex gap-2 sm:gap-3 items-start">
        <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#d08700] shrink-0 mt-0.5 sm:mt-1" />
        <p className="font-rajdhani font-medium text-[#79767d] text-[11px] sm:text-xs md:text-sm leading-relaxed">
          <span className="font-bold text-[#d08700]">How it works: </span>
          <span>
            your deposit is added to this pool of uniform notes. When you claim, the smart contract
            validates your Zero-Knowledge proof without revealing which specific deposit was yours.
            The larger the set, the stronger the privacy.
          </span>
        </p>
      </div>
    </div>
  );
}
