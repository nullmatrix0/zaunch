import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TokenHeaderProps {
    token: any;
    address: string;
}

export function TokenHeader({ token, address }: TokenHeaderProps) {
  // Using dummy data from props or falling back to defaults
  const name = token?.name || "DarkFi DEX";
  const symbol = token?.symbol ? `$${token.symbol}` : "$DARK";
  const status = "Active Sale";
  const timeLeft = "04d 12h 33m";

  return (
    <div className="flex justify-between items-start w-full mb-6">
      <div className="flex items-center gap-4">
        {/* Token Logo Box */}
        <div className="w-16 h-16 bg-[#301342] border border-[rgba(20,184,166,0.5)] rounded-lg flex items-center justify-center p-3">
             {/* Placeholder for logo */}
             <div className="w-full h-full bg-purple-900/50 rounded flex items-center justify-center text-white font-bold text-xl">D</div>
        </div>
        
        <div className="flex flex-col gap-0.5">
             <h1 className="font-rajdhani font-bold text-4xl text-white leading-tight">{name}</h1>
             <div className="flex gap-1.5">
                 <div className="border border-gray-600 px-2 py-0.5 flex items-center justify-center">
                     <span className="font-rajdhani font-bold text-lg text-gray-600">{symbol}</span>
                 </div>
                 <div className="border border-[#34c759] px-2 py-0.5 flex items-center justify-center">
                     <span className="font-rajdhani font-bold text-lg text-[#34c759]">{status}</span>
                 </div>
             </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
          <span className="font-rajdhani text-xs text-gray-500">SALE ENDS IN</span>
          <span className="font-rajdhani font-bold text-4xl text-white">{timeLeft}</span>
      </div>
    </div>
  );
}
