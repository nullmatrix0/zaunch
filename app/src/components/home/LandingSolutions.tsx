'use client';

import { motion } from 'framer-motion';

const solutions = [
  {
    id: '01',
    title: 'Pay in any token',
    description:
      'Flexible payment options across multiple blockchains and assets. Contribute using ETH, USDC, NEAR, or other supported tokens from any chain.',
    icon: 'https://www.figma.com/api/mcp/asset/0e017655-60f4-4272-b8e2-ba83120c6e70',
  },
  {
    id: '02',
    title: 'The Shielded Settlement',
    description:
      "All transactions protected by Zcash's privacy-preserving technology. Your contributions are completely shielded from public blockchain surveillance.",
    icon: 'https://www.figma.com/api/mcp/asset/35ac0030-f49f-4243-ad24-0d8eca7b018d',
  },
  {
    id: '03',
    title: 'Claim via ZK Proof Tickets',
    description:
      'Claim tokens on Solana using zero-knowledge proof tickets. No on-chain link between your funding source and claim destination.',
    icon: 'https://www.figma.com/api/mcp/asset/f4d15114-5a6b-444a-aed1-673ec77bc17e',
  },
];

export default function LandingSolutions() {
  return (
    <section className="bg-[#D0870026] py-12 sm:py-16 md:py-24 relative overflow-hidden">
      {/* Background Texture/Image */}
      <div className="hidden md:block absolute top-20 right-20 w-[200px] h-[200px] opacity-10 pointer-events-none">
        <img
          src="/assets/a6d0284c-72a6-4ee0-9fbb-1b2eadc1bda8.svg"
          alt="Rocket"
          className="w-full h-full object-contain object-top-right"
        />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="flex flex-col items-start gap-4 mb-8 md:mb-12">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center border border-white/10 bg-white/5 rounded-lg">
              <div className="w-4 h-4 md:w-5 md:h-5 grid grid-cols-2 gap-0.5">
                <div className="bg-[#d08700] rounded-sm"></div>
                <div className="bg-[#d08700]/50 rounded-sm"></div>
                <div className="bg-[#d08700]/50 rounded-sm"></div>
                <div className="bg-[#d08700] rounded-sm"></div>
              </div>
            </div>
            <h2 className="font-rajdhani font-medium text-xl sm:text-2xl md:text-3xl text-[#d08700] uppercase tracking-wide">
              What YOU GET
            </h2>
          </div>
          <p className="font-rajdhani font-medium text-xl sm:text-2xl md:text-3xl lg:text-4xl text-[#979798] max-w-3xl leading-tight">
            Zaunchpad uses the Zcash Unified Shielded Pool to mathematically sever the link between
            capital origin and token destination.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {solutions.map((solution, index) => (
            <motion.div
              key={solution.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="group relative min-h-[200px] md:h-[240px] border border-white/10 bg-black/50 backdrop-blur-sm p-4 md:p-6 flex flex-col justify-between"
            >
              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[#eab308] opacity-50 group-hover:opacity-100 transition-opacity" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[#eab308] opacity-50 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-[#eab308] opacity-50 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-[#eab308] opacity-50 group-hover:opacity-100 transition-opacity" />

              <div className="flex justify-between items-start w-full">
                <span className="font-rajdhani font-medium text-base md:text-lg text-[#d08700]">
                  {solution.id}
                </span>
                <div className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0">
                  <img src={solution.icon} alt="" className="w-full h-full" />
                </div>
              </div>

              <div>
                <h3 className="font-rajdhani font-bold text-lg md:text-xl text-[#feeae6] mb-2">
                  {solution.title}
                </h3>
                <p className="font-rajdhani font-normal text-xs md:text-sm text-[#feeae6] leading-relaxed">
                  {solution.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
