'use client';

import { motion } from 'framer-motion';

interface TechStack {
  name: string;
  description: string;
  logo: string;
  width: number;
  height?: number;
  url?: string;
}

const techStack: TechStack[] = [
  {
    name: 'ZCASH',
    description: 'Settles into shielded pools and price in Zcash.',
    logo: '/logos/zcash.png',
    width: 44,
    url: 'https://z.cash',
  },
  {
    name: 'NEAR Intents',
    description:
      'Cross-chain swaps to deposits in any chains and from Zcash shielded pools to Solana',
    logo: '/logos/near-intents.svg',
    width: 141,
    url: 'https://near-intents.org',
  },
  {
    name: 'Solana',
    description: 'Liquidity layer, tokens originally minted using launchpads like Meteora',
    logo: '/logos/solana-text.svg',
    width: 141,
    height: 25,
    url: 'https://solana.com',
  },
  {
    name: 'Phala Network',
    description:
      'TEE for verifying NEAR Intents ZCash cross-chain transactions and generating zkSNARK proofs',
    logo: '/logos/phala.png',
    width: 117,
    url: 'https://phala.network',
  },
  {
    name: 'Circom',
    description:
      'For generating zkSnark proofs for verifying NEAR Intents based ZCash cross chain transactions',
    logo: '/logos/circom.png',
    width: 117,
    url: 'https://docs.circom.io',
  },
  // {
  //   name: 'Meteora',
  //   description: 'Liquidity deployment for SPL tokens',
  //   logo: '/logos/meteora.png',
  //   width: 43,
  //   url: 'https://meteora.ag',
  // },
  // {
  //   name: 'TukTuk by Helium',
  //   description:
  //     'Solana automation framework for taking Solana liquidity and putting into Meteora contracts',
  //   logo: '/logos/tuktuk.png',
  //   width: 48,
  //   url: 'https://www.tuktuk.fun'
  // },
  {
    name: 'deBridge',
    description:
      'Cross-chain infrastructure protocol enabling secure and decentralized transfers of assets and data',
    logo: '/logos/debridge-dark.svg',
    width: 190,
    url: 'https://debridge.com'
  },
];

export default function LandingTechStack() {
  return (
    <section className="bg-black py-12 sm:py-16 md:py-24 relative overflow-hidden">
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
              Technology Stack
            </h2>
          </div>
          <p className="font-rajdhani font-medium text-xl sm:text-2xl md:text-3xl lg:text-4xl text-[#979798] max-w-3xl leading-tight">
            Built on unstoppable private cross-chain infrastructure.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {techStack.map((tech: TechStack, index: number) => {
            const CardContent = (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05, duration: 0.4 }}
                className={`group relative min-h-[160px] sm:min-h-[180px] border border-white/10 bg-black/50 backdrop-blur-sm p-4 md:p-6 flex flex-col items-center justify-center text-center gap-3 md:gap-4 ${
                  tech.url ? 'cursor-pointer hover:border-[#d08700]/50 transition-colors' : ''
                }`}
              >
                {/* Corner Accents */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[#eab308] opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[#eab308] opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-white opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-white opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="h-8 md:h-10 flex items-center justify-center">
                  <img
                    src={tech.logo}
                    alt={tech.name}
                    style={{ width: tech.width * 0.9, height: tech.height && tech.height * 0.9 }}
                    className="h-full object-contain filter brightness-100 grayscale-0 max-w-full"
                  />
                </div>

                <div>
                  <h3 className="font-rajdhani font-bold text-lg md:text-xl text-[#feeae6] mb-1.5">
                    {tech.name}
                  </h3>
                  <p className="font-rajdhani font-normal text-xs md:text-sm text-[#feeae6]/80 leading-relaxed">
                    {tech.description}
                  </p>
                </div>
              </motion.div>
            );

            if (tech.url) {
              return (
                <a
                  key={tech.name}
                  href={tech.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  {CardContent}
                </a>
              );
            }

            return <div key={tech.name}>{CardContent}</div>;
          })}
        </div>
      </div>
    </section>
  );
}
