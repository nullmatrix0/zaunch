'use client';

import { motion } from 'framer-motion';

interface TechStack {
  name: string;
  description: string;
  logo: string;
  width: number;
  height?: number;
}

const techStack: TechStack[] = [
  {
    name: 'ZCASH',
    description: 'Settles into shielded pools and price in Zcash.',
    logo: '/logos/zcash.png',
    width: 44
  },
  {
    name: 'NEAR Intents',
    description: 'Cross-chain swaps to deposits in any chains and from Zcash shielded pools to Solana',
    logo: '/logos/near-intents.svg',
    width: 141
  },
  {
    name: 'Solana',
    description: 'Liquidity layer, tokens originally minted using launchpads like Meteora',
    logo: '/logos/solana-text.svg',
    width: 141,
    height: 25
  },
  {
    name: 'LayerZero',
    description: 'Enable to claim Omni Fungible tokens in respective chain for Solana minted tokens',
    logo: '/logos/layer-zero.svg',
    width: 125
  },
  {
    name: 'Meteora',
    description: 'Launchpad infrastructure on Solana',
    logo: '/logos/meteora.png',
    width: 43
  },
  {
    name: 'TukTuk by Helium',
    description: 'Solana automation framework for taking Solana liquidity and putting into Meteora contracts',
    logo: '/logos/tuktuk.png',
    width: 48
  }
];

export default function LandingTechStack() {
  return (
    <section className="bg-black py-16 md:py-24 relative overflow-hidden">
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="flex flex-col items-start gap-4 mb-12">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 flex items-center justify-center border border-white/10 bg-white/5 rounded-lg">
                <div className="w-5 h-5 grid grid-cols-2 gap-0.5">
                    <div className="bg-[#d08700] rounded-sm"></div>
                    <div className="bg-[#d08700]/50 rounded-sm"></div>
                    <div className="bg-[#d08700]/50 rounded-sm"></div>
                    <div className="bg-[#d08700] rounded-sm"></div>
                </div>
            </div>
            <h2 className="font-rajdhani font-medium text-2xl md:text-3xl text-[#d08700] uppercase tracking-wide">
              Technology Stack
            </h2>
          </div>
          <p className="font-rajdhani font-medium text-2xl md:text-4xl text-[#979798] max-w-3xl leading-tight">
            Built on unstoppable private cross-chain infrastructure.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {techStack.map((tech: TechStack, index: number) => (
            <motion.div
              key={tech.name}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05, duration: 0.4 }}
              className="group relative min-h-[180px] border border-white/10 bg-black/50 backdrop-blur-sm p-6 flex flex-col items-center justify-center text-center gap-4"
            >
              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[#eab308] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[#eab308] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-white opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-white opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="h-10 flex items-center justify-center">
                  <img 
                    src={tech.logo} 
                    alt={tech.name} 
                    style={{ width: tech.width * 0.9 , height: tech.height && tech.height * 0.9 }}
                    className="h-full object-contain filter brightness-100 grayscale-0"
                   />
              </div>

              <div>
                <h3 className="font-rajdhani font-bold text-xl text-[#feeae6] mb-1.5">
                    {tech.name}
                </h3>
                <p className="font-rajdhani font-normal text-sm text-[#feeae6]/80 leading-relaxed">
                    {tech.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

