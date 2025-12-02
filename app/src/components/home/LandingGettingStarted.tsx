'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';

const buyingSteps = [
  {
    id: '1',
    title: 'Deposit with any asset',
    description:
      'Using NEAR Intents, the system automatically swaps your deposit to Zcash based on ticket amount. Support for ETH, USDC, NEAR, and more.',
    icon: '/assets/cb1421c4-3bf2-44a8-8363-ceee76d28079.svg',
  },
  {
    id: '2',
    title: 'ZK-SNARK proof generation',
    description:
      'Generates a zero-knowledge proof that acts as an IOU of predetermined amount at the mint price. This proof is your claim ticket.',
    icon: '/assets/6fabe7f7-c928-4884-a5b8-a60532de12e4.svg',
  },
  {
    id: '3',
    title: 'Capital allocation',
    description:
      'Allocated capital is deposited into the Meteora pool, providing liquidity for the token launch while maintaining your privacy.',
    icon: '/assets/ef04d249-60f9-420b-a338-4bb3b55ba25b.svg',
  },
  {
    id: '4',
    title: 'Flexible claiming',
    description:
      'With the claim system via proofs, you can either claim on Solana or bridge via omni token to claim on your desired Layer Zero OFT supported chain.',
    icon: '/assets/9c102275-e5c0-4dad-9062-dfa08b62d524.svg',
  },
];

const createSteps = [
  {
    id: '1',
    title: 'Set pricing',
    description:
      'Outline price and number of tokens per Zcash. Define your token economics and allocation strategy.',
    icon: '/assets/c56d449b-85dc-4a6e-b752-986216abe427.svg',
  },
  {
    id: '2',
    title: 'Multi-chain configuration',
    description:
      'Choose whether to enable Layer Zero for multichain claims and select which supported chains your token can be claimed on.',
    icon: '/assets/28895815-5e2e-4b0f-a704-fc1d60f7e926.svg',
  },
  {
    id: '3',
    title: 'Timeline setup',
    description:
      'Define how long the token sale runs, when it starts, and when the claim period begins. Set specific dates and durations.',
    icon: '/assets/65fabe36-7e6d-4c49-b857-4430fb9e11d1.svg',
  },
  {
    id: '4',
    title: 'Minimum requirements',
    description:
      'Set minimum thresholds for successful token launch and claim eligibility. Protect both you and your investors.',
    icon: '/assets/7a776285-77a7-406f-bb59-a43762d041ba.svg',
  },
];

export default function LandingGettingStarted() {
  return (
    <section className="bg-black py-16 md:py-24 relative border-t border-white/10">
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
              Getting Started
            </h2>
          </div>
          <p className="font-rajdhani font-medium text-2xl md:text-4xl text-[#979798] max-w-3xl leading-tight">
            Two powerful workflows: buying tokens privately and creating your own launch
          </p>
        </div>

        <Tabs defaultValue="buying" className="w-full">
          <div className="flex mb-8">
            <TabsList className="bg-[#1b1f26]/70 border border-white/10 p-1 h-auto rounded-lg">
              <TabsTrigger
                value="create"
                className="font-rajdhani text-lg md:text-xl px-5 py-2.5 data-[state=active]:bg-[#d08700] data-[state=active]:text-black text-[#64748b] rounded-md transition-all"
              >
                Create Token Launch
              </TabsTrigger>
              <TabsTrigger
                value="buying"
                className="font-rajdhani text-lg md:text-xl px-5 py-2.5 data-[state=active]:bg-[#d08700] data-[state=active]:text-black text-[#64748b] rounded-md transition-all"
              >
                Buying Tokens
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="buying" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {buyingSteps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  className="relative flex flex-col gap-4"
                >
                  {/* Connector Line */}
                  {index < buyingSteps.length - 1 && (
                    <div className="hidden lg:block absolute top-[28px] right-[-50%] w-full h-[2px] bg-linear-to-r from-[#d08700]/50 to-transparent z-0 pointer-events-none" />
                  )}

                  <div className="relative z-10 w-14 h-14 rounded-xl border-2 border-[#d08700] bg-[#d08700]/10 flex items-center justify-center p-1">
                    <img src={step.icon} alt="" className="w-7 h-7" />
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black border-2 border-[#d08700] flex items-center justify-center">
                      <span className="font-bold text-white text-xs">{step.id}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <h3 className="font-rajdhani font-bold text-lg text-white">{step.title}</h3>
                    <p className="font-rajdhani text-[#9e9e9e] text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="create" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {createSteps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  className="relative flex flex-col gap-4"
                >
                  {/* Connector Line */}
                  {index < createSteps.length - 1 && (
                    <div className="hidden lg:block absolute top-[28px] right-[-50%] w-full h-[2px] bg-linear-to-r from-[#7c79ff]/50 to-transparent z-0 pointer-events-none" />
                  )}

                  <div className="relative z-10 w-14 h-14 rounded-xl border-2 border-[#7c79ff] bg-[#7c79ff]/10 flex items-center justify-center p-1">
                    <img src={step.icon} alt="" className="w-7 h-7" />
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black border-2 border-[#7c79ff] flex items-center justify-center">
                      <span className="font-bold text-white text-xs">{step.id}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <h3 className="font-rajdhani font-bold text-lg text-white">{step.title}</h3>
                    <p className="font-rajdhani text-[#9e9e9e] text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
