'use client';

import { ArrowDown, ChevronDown, Info, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// Minimal props to satisfy interface
interface TradingInterfaceProps {
  token: any;
  address: string;
}

export function TradingInterface({ token, address }: TradingInterfaceProps) {
  return (
    <div className="w-full flex flex-col gap-4">
      {/* Trading Box Container */}
      <div className="bg-neutral-950 border border-gray-800 p-6 flex flex-col gap-4">
           {/* Alert / Info */}
           <div className="bg-[rgba(208,135,0,0.05)] border border-[#d08700] p-4 flex gap-3 items-start">
                <AlertTriangle className="w-4 h-4 text-[#d08700] shrink-0 mt-1" />
                <div className="flex flex-col gap-1">
                    <p className="font-rajdhani font-bold text-[#d08700] text-base leading-[1.3]">
                        Claim Period Opens 12/11/20235
                    </p>
                    <p className="font-rajdhani text-[#ded8e1] text-base leading-relaxed">
                        You are generating a Private Ticket. Tokens will be redeemable after the sale ends using your downloaded proof.
                    </p>
          </div>
        </div>

           {/* Swap Interface */}
           <div className="flex flex-col gap-3">
                {/* Pay With */}
               <div className="border border-[rgba(255,255,255,0.12)] rounded-xl p-4 relative h-[135px]">
                   <div className="flex justify-between items-start mb-2">
                       <span className="font-rajdhani font-medium text-sm text-white/65">PAY WITH</span>
                       <div className="flex flex-col items-end">
                           <div className="bg-[#131313] border border-[#393939] rounded-full px-2 py-1.5 flex items-center gap-2 w-fit">
                               {/* NEAR Icon Placeholder */}
                               <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center p-1">
                                   <img src="/chains/near.svg" alt="NEAR" className="w-full h-full object-contain invert" />
            </div>
                               <span className="font-rajdhani font-semibold text-sm text-white">NEAR</span>
                               <ChevronDown className="w-4 h-4 text-white/50" />
          </div>
        </div>
      </div>

                   <div className="flex flex-col gap-2 mt-1">
                  <input
                    type="text"
                           defaultValue="22"
                           className="bg-transparent border-none text-4xl font-rajdhani font-medium text-white/40 focus:outline-none w-full p-0"
                       />
                        <div className="bg-white/10 rounded-full px-2 py-0.5 w-fit">
                            <span className="text-xs font-rajdhani font-medium text-white/65">$250</span>
                        </div>
                  </div>
              </div>

               {/* Receive */}
               <div className="border border-[rgba(255,255,255,0.12)] rounded-xl p-4 relative h-[110px]">
                   <div className="flex justify-between items-start mb-2">
                       <span className="font-rajdhani font-medium text-sm text-white/65">RECIEVE</span>
                        <div className="bg-[#131313] border border-[#393939] rounded-full px-2 py-1.5 flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#301342] rounded-full flex items-center justify-center border border-[rgba(20,184,166,0.5)]">
                                {/* Token Icon Placeholder */}
                                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    </div>
                           <span className="font-rajdhani font-semibold text-sm text-white">$DARK</span>
                  </div>
                </div>
                   <div className="text-4xl font-rajdhani font-medium text-white/40 mt-1">1</div>
               </div>
              </div>

           {/* Ticket Info */}
           <div className="flex flex-col gap-3">
               <div className="border-b border-gray-800 pb-2 flex flex-col gap-2">
                   <div className="flex justify-between items-center text-sm">
                       <span className="font-rajdhani text-[#79767d]">Ticket Size</span>
                       <span className="font-rajdhani font-semibold text-[#d08700]">SINGLE UNIT (1.0)</span>
            </div>
                   <div className="flex justify-between items-center">
                       <span className="font-rajdhani font-bold text-[#79767d] text-sm">PAYABLE AMOUNT</span>
                       <span className="font-rajdhani font-bold text-[#79767d] text-xl">22 NEAR</span>
                  </div>
              </div>

               <div className="flex justify-between items-center">
                   <span className="font-rajdhani font-bold text-[#79767d] text-sm">TICKETS GENERATED</span>
                   <span className="font-rajdhani font-bold text-[#79767d] text-xl">1 TICKET</span>
                      </div>
                    </div>

           {/* Action Button */}
           <Button className="w-full py-6 bg-[#d08700] hover:bg-[#b66e00] text-black font-rajdhani font-bold text-base border border-transparent">
               Pay with NEAR
                  </Button>

           <p className="text-center font-rajdhani text-sm text-[#79767d]">
               Powered by NEAR Intents & Zcash Shielded Pools
           </p>
      </div>
    </div>
  );
}
