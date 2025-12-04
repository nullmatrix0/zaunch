'use client';

import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function LandingHero() {
  return (
    <section className="relative w-full min-h-screen bg-black overflow-hidden pt-5">
      <div className="relative z-10 container mx-auto px-4 md:px-6 h-full flex flex-col lg:flex-row justify-between items-center pt-5 pb-8 lg:pb-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl w-full lg:w-auto mb-8 lg:mb-0"
        >
          <h1 className="font-rajdhani font-bold text-5xl md:text-7xl lg:text-8xl text-white leading-none tracking-tighter mb-4">
            CYPHER CAPITAL <br />
            <span className="text-white">MARKETS</span>
          </h1>

          <p className="font-rajdhani font-medium text-base sm:text-lg md:text-xl text-[#999999] max-w-2xl mb-6 md:mb-8 leading-relaxed">
            The first privacy-first launchpad. Pay with any token, settle in Zcash Shielded Pools,
            and claim anonymously on Solana.
          </p>

          <div className="flex flex-row gap-4">
              <Link href="/token" className="group">
                <div className="bg-transparent border border-[#fdead7] px-6 py-2.5 w-full sm:w-auto flex items-center justify-center gap-2 hover:bg-[#fdead7] hover:text-black transition-all duration-300">
                  <span className="font-share-tech-mono uppercase tracking-wider text-[#fdead7] group-hover:text-black text-xs md:text-sm">
                    Explore Launches
                  </span>
                </div>
              </Link>

              <Link href="https://docs.zaunchpad.com" target="_blank" className="group">
                <div className="bg-transparent border border-[#eab308] px-6 py-2.5 w-full sm:w-auto flex items-center justify-center gap-2 hover:bg-[#eab308] hover:text-black transition-all duration-300">
                  <span className="font-share-tech-mono uppercase tracking-wider text-[#eab308] group-hover:text-black text-xs md:text-sm">
                    LEARN MORE
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#eab308] group-hover:text-black" />
                </div>
              </Link>
            </div>
        </motion.div>
        <div className="block h-[300px] md:h-[460px] opacity-60 md:opacity-100 pointer-events-none flex-shrink-0">
          <img
            src="/hero.png"
            alt="Cypher Capital Markets"
            className="w-full h-full object-cover object-left mask-image-linear-gradient"
          />
        </div>
      </div>
    </section>
  );
}
