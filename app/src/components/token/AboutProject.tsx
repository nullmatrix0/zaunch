import { Button } from '@/components/ui/button';

export function AboutProject() {
  return (
    <div className="relative w-full backdrop-blur-[2px] bg-[rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.1)] p-[1px]">
       {/* Corner Borders */}
       <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-[#d08700] z-10"></div>
       <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-[#d08700] z-10"></div>
       <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-white z-10"></div>
       <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-white z-10"></div>

      <div className="p-6 flex flex-col gap-6 relative overflow-hidden">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-[#d08700]"></div>
            <h3 className="font-rajdhani font-bold text-2xl text-white">ABOUT PROJECT</h3>
          </div>
          <p className="font-rajdhani text-base text-gray-400 leading-relaxed">
            DarkFi DEX utilizes Multi-Party Computation (MPC) to enable swaps without revealing trade size or direction until execution. The protocol creates a dark pool effect for all assets. DARK token holders capture protocol fees. This launch aims to bootstrap the initial liquidity pools.
          </p>
        </div>

        <div className="border-t border-[rgba(255,255,255,0.05)] pt-4 flex justify-between items-center">
             <div className="flex gap-2 items-center">
                 {/* Raise Progress Icon Placeholder */}
                 <div className="w-4 h-4 rounded-full bg-gray-700"></div>
                 <span className="font-rajdhani text-sm text-gray-400">12 ZEC</span>
             </div>
             <div className="flex gap-2 items-center">
                 {/* Participants Icon Placeholder */}
                 <div className="w-5 h-5 rounded-full bg-gray-700"></div>
                 <span className="font-rajdhani text-sm text-gray-400">420</span>
             </div>
        </div>
        
        <div className="flex justify-center mt-2">
            <Button variant="outline" className="border-2 border-[#d08700] text-[#d08700] hover:bg-[#d08700] hover:text-white font-share-tech-mono uppercase tracking-wider px-10 py-2 h-auto bg-transparent">
                VIEW Pool
            </Button>
        </div>
      </div>
    </div>
  );
}

