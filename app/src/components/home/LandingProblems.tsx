'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

const problems = [
  {
    id: '01',
    title: 'Alpha Leaks',
    description:
      'Early investors get exposed. Blockchain transparency reveals early investment positions to competitors and copycats.',
    image: '/assets/7f53f6be-5dab-4101-b300-81a496c27bcd.png',
  },
  {
    id: '02',
    title: 'The Whale Watchers',
    description:
      "Privacy concerns for big players. Major investors don't want their early alpha strategies and positions publicly visible.",
    image: '/assets/9c6f73bd-555d-418c-9073-4e28e90b6ab4.png',
  },
  {
    id: '03',
    title: 'Liquidity Silos',
    description:
      "Cross-chain liquidity barriers. Traditional token launchpads can't pool liquidity from multiple blockchain networks.",
    image: '/assets/a8609bdc-676a-45ff-8bab-99ed24ca1288.png',
  },
  {
    id: '04',
    title: 'The Bridge Trap',
    description:
      'Limited claim flexibility. Token launches force you to claim on their native chain, restricting your options.',
    image: '/assets/54ecf3ad-2cc9-456c-9e6e-62951552ad13.png',
  },
];

function ProblemCard({ problem, index }: { problem: (typeof problems)[0]; index: number }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className="group relative h-[320px] bg-black border border-white/10 overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Top Left Corner */}
      <div
        className={`absolute -top-px -left-px w-[12px] h-[12px] border-l border-t transition-colors duration-300 ${isHovered ? 'border-[#eab308]' : 'border-[#eab308]'}`}
      />

      {/* Top Right Corner */}
      <div
        className={`absolute -top-px -right-px w-[12px] h-[12px] border-r border-t transition-colors duration-300 ${isHovered ? 'border-[#eab308]' : 'border-[#eab308]'}`}
      />

      {/* Bottom Left Corner */}
      <div
        className={`absolute -bottom-px -left-px w-[12px] h-[12px] border-l border-b transition-colors duration-300 ${isHovered ? 'border-[#eab308]' : 'border-[#eab308]'}`}
      />

      {/* Bottom Right Corner */}
      <div
        className={`absolute -bottom-px -right-px w-[12px] h-[12px] border-r border-b transition-colors duration-300 ${isHovered ? 'border-[#eab308]' : 'border-[#eab308]'}`}
      />

      {/* Hover Borders */}
      <div
        className={`absolute top-0 left-0 w-px h-full bg-[#eab308] transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        className={`absolute top-0 right-0 w-px h-full bg-[#eab308] transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        className={`absolute top-0 left-0 h-px w-full bg-[#eab308] transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        className={`absolute bottom-0 left-0 h-px w-full bg-[#eab308] transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 z-20">
        <div className="relative w-[180px] h-[140px] mb-4">
          <img src={problem.image} alt={problem.title} className="w-full h-full object-cover" />
        </div>

        <h3 className="font-rajdhani font-semibold text-2xl text-white mb-2">
          {problem.id}. {problem.title}
        </h3>

        <p className="font-rajdhani font-medium text-[#999999] text-sm md:text-base leading-relaxed max-w-[450px]">
          {problem.description}
        </p>
      </div>
    </motion.div>
  );
}

export default function LandingProblems() {
  return (
    <section className="bg-black pb-20 relative overflow-hidden">
      {/* Background grid effect */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        ></div>
      </div>

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
              What Zaunchpad Fixes
            </h2>
          </div>
          <p className="font-rajdhani font-medium text-2xl md:text-4xl text-[#979798] max-w-3xl leading-tight">
            Problems with traditional token launches that put your privacy and strategy at risk
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {problems.map((problem, index) => (
            <ProblemCard key={problem.id} problem={problem} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
