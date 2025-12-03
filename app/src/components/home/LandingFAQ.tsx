'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Info } from 'lucide-react';
import Link from 'next/link';
import { ReactNode } from 'react';
import { useState } from 'react';

const faqs: Array<{ question: string; answer: ReactNode }> = [
  {
    question: 'What is Zaunchpad?',
    answer: (
      <>
        Zaunchpad is a privacy-first cross-chain token launchpad that enables anonymous participation in crypto token launches using{' '}
        <a
          href="https://z.cash"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#d08700] hover:text-[#f0a020] underline transition-colors"
        >
          Zcash
        </a>{' '}
        shielded pools. It allows users to deposit funds from various chains, settle in Zcash for privacy, and claim tokens on Solana or other chains via{' '}
        <a
          href="https://layerzero.network"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#d08700] hover:text-[#f0a020] underline transition-colors"
        >
          LayerZero
        </a>
        .
      </>
    ),
  },
  {
    question: 'How does privacy work on Zaunchpad?',
    answer: (
      <>
        Zaunchpad leverages{' '}
        <a
          href="https://z.cash"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#d08700] hover:text-[#f0a020] underline transition-colors"
        >
          Zcash&apos;s Unified Shielded Pool
        </a>
        . When you participate, your funds are swapped to ZEC and moved into a shielded pool, breaking the on-chain link between your funding wallet and your destination wallet. You then receive a Zero-Knowledge proof ticket to claim your tokens.
      </>
    ),
  },
  {
    question: 'What chains can I deposit from?',
    answer: (
      <>
        You can deposit using assets from Ethereum, Solana, NEAR, and Base. Our integration with{' '}
        <a
          href="https://near.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#d08700] hover:text-[#f0a020] underline transition-colors"
        >
          NEAR Intents
        </a>{' '}
        and cross-chain bridges handles the conversion to ZEC automatically.
      </>
    ),
  },
  {
    question: 'Where can I claim my tokens?',
    answer: (
      <>
        Tokens are primarily claimed on Solana. However, through our{' '}
        <a
          href="https://layerzero.network"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#d08700] hover:text-[#f0a020] underline transition-colors"
        >
          LayerZero
        </a>{' '}
        integration, you can also bridge and claim Omni Fungible Tokens (OFT) on other supported chains. View available launches on the{' '}
        <Link
          href="/token"
          className="text-[#d08700] hover:text-[#f0a020] underline transition-colors"
        >
          Launches
        </Link>{' '}
        page.
      </>
    ),
  },
  {
    question: 'What is the ZK proof ticket system?',
    answer:
      'The ZK proof ticket is a cryptographic proof that verifies your contribution without revealing your identity or the source of funds. It acts as a bearer instrument allowing you to claim your allocated tokens.',
  },
  {
    question: 'How do I create a token launch?',
    answer: (
      <>
        You can create a token launch by navigating to the{' '}
        <Link
          href="/create"
          className="text-[#d08700] hover:text-[#f0a020] underline transition-colors"
        >
          Create
        </Link>{' '}
        section, configuring your token parameters (supply, vesting, pricing), and deploying the contracts. The platform handles the cross-chain and privacy infrastructure setup.
      </>
    ),
  },
  {
    question: 'What are the benefits compared to traditional launchpads?',
    answer:
      'Traditional launchpads expose your early investment strategies and wallet connections ("alpha leaks"). Zaunchpad protects your privacy, preventing copy-trading and wallet tracking, while offering access to liquidity across multiple chains.',
  },
  {
    question: 'Is Zaunchpad decentralized?',
    answer: (
      <>
        Yes, Zaunchpad is built on decentralized protocols including{' '}
        <a
          href="https://z.cash"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#d08700] hover:text-[#f0a020] underline transition-colors"
        >
          Zcash
        </a>
        ,{' '}
        <a
          href="https://solana.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#d08700] hover:text-[#f0a020] underline transition-colors"
        >
          Solana
        </a>
        , and{' '}
        <a
          href="https://near.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#d08700] hover:text-[#f0a020] underline transition-colors"
        >
          NEAR
        </a>
        . The code is open-source and the platform operates without a central authority controlling your funds.
      </>
    ),
  },
];

export default function LandingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="bg-black py-12 sm:py-16 md:py-24 relative border-t border-white/10">
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8 lg:gap-12">
          {/* Left Column: Title */}
          <div className="md:w-1/3 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center border border-white/10 bg-white/5 rounded-lg">
                <div className="w-4 h-4 md:w-5 md:h-5 flex items-center justify-center">
                  <Info className="text-[#d08700] w-3 h-3 md:w-5 md:h-5" />
                </div>
              </div>
              <h2 className="font-rajdhani font-medium text-xl sm:text-2xl md:text-3xl text-[#d08700] uppercase tracking-wide">
                FAQ
              </h2>
            </div>
            <p className="font-rajdhani font-medium text-xl sm:text-2xl md:text-3xl lg:text-4xl text-[#979798] leading-tight">
              Everything you need to know about Zaunchpad
            </p>
          </div>

          {/* Right Column: Accordion */}
          <div className="md:w-2/3 flex flex-col gap-3">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="border border-white/10 bg-white/5 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full flex items-center justify-between p-3 sm:p-4 text-left hover:bg-white/5 transition-colors cursor-pointer gap-4"
                >
                  <span className="font-rajdhani text-sm sm:text-base md:text-lg text-white font-medium flex-1">
                    {faq.question}
                  </span>
                  <motion.div
                    animate={{ rotate: openIndex === index ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex-shrink-0"
                  >
                    <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-[#d08700]" />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {openIndex === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="p-3 sm:p-4 pt-0 text-[#9e9e9e] font-rajdhani text-xs sm:text-sm md:text-base leading-relaxed border-t border-white/5">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
