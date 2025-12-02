'use client';

import { LockKeyhole, Terminal, Key } from 'lucide-react';
import { formatNumberToCurrency } from '@/utils';
import { motion } from 'framer-motion';

interface TicketReference {
  filename: string;
  amount: string;
  symbol: string;
}

interface ProofTicket {
  id: string;
  tokenName: string;
  tokenSymbol: string;
  tokenImage?: string;
  ticketCount: number;
  totalAllocation: number;
  allocationSymbol: string;
  status: 'CLAIM LIVE' | 'SALES LIVE' | 'LOCKED';
  references: TicketReference[];
}

// Mock data - replace with actual data from your backend/localStorage
const mockTickets: ProofTicket[] = [
  {
    id: '1',
    tokenName: 'Ghost Protocol',
    tokenSymbol: 'GHST',
    ticketCount: 2,
    totalAllocation: 20000,
    allocationSymbol: 'GHST',
    status: 'CLAIM LIVE',
    references: [
      { filename: 'zk_proof_acq9spwvqr38.zip', amount: '1,000', symbol: 'GHST' },
      { filename: 'zk_proof_acq9spwvqr38.zip', amount: '1,000', symbol: 'GHST' },
    ],
  },
  {
    id: '2',
    tokenName: 'DarkFi',
    tokenSymbol: 'GHST',
    ticketCount: 1,
    totalAllocation: 20000,
    allocationSymbol: 'GHST',
    status: 'SALES LIVE',
    references: [],
  },
];

export function TicketVaultContent() {
  // In production, fetch tickets from localStorage or backend
  const tickets = mockTickets;

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start w-full">
      {/* Main Content - Generated Proofs */}
      <div className="flex-1 w-full">
        <div className="backdrop-blur-[2px] bg-[#000000] border border-[rgba(255,255,255,0.1)] relative w-full">
          {/* Corner decorations */}
          <div className="absolute border-[#d08700] border-b-0 border-l-2 border-r-0 border-solid border-t-2 left-[0.67px] w-[14px] h-[14px] top-[0.67px]" />
          <div className="absolute border-[#d08700] border-b-0 border-l-0 border-r-2 border-solid border-t-2 right-[0.67px] w-[14px] h-[14px] top-[0.67px]" />
          <div className="absolute border-[rgba(245,245,245,0.3)] border-b-2 border-l-2 border-r-0 border-solid border-t-0 bottom-[0.67px] left-[0.67px] w-[14px] h-[14px]" />
          <div className="absolute border-[rgba(245,245,245,0.3)] border-b-2 border-l-0 border-r-2 border-solid border-t-0 bottom-[0.67px] right-[0.67px] w-[14px] h-[14px]" />

          <div className="p-4 md:p-6 flex flex-col gap-6 md:gap-8">
            {/* Header */}
            <div className="flex items-center gap-1.5">
              {/* Key Square Icon */}
              <div className="w-5 h-5 md:w-6 md:h-6 text-[#d08700] relative">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-full"
                >
                  <rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="2"
                    stroke="#d08700"
                    strokeWidth="1.5"
                    fill="none"
                  />
                  <path
                    d="M8 12h8M12 8v8"
                    stroke="#d08700"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h2 className="font-rajdhani font-bold text-lg md:text-xl text-white">
                GENERATED PROOFS
              </h2>
            </div>

            {/* Ticket Cards */}
            <div className="flex flex-col gap-4 md:gap-6">
              {tickets.map((ticket) => (
                <ProofTicketCard key={ticket.id} ticket={ticket} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar - Alerts */}
      <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0">
        {/* Self-Custody Warning */}
        <div className="bg-[rgba(208,135,0,0.1)] border border-[#d08700] p-3 md:p-4 flex gap-2.5">
          <Terminal className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#d08700] shrink-0 mt-0.5" />
          <div className="flex flex-col gap-2 flex-1">
            <h3 className="font-medium text-sm md:text-base text-[#d08700] leading-tight">
              Self-Custody Warning
            </h3>
            <p className="text-xs md:text-sm text-[#d08700] leading-relaxed">
              These tickets are stored in your browser's local storage. Always ensure you have
              downloaded the .ZIP backup. Clearing browser cache will remove these references.
            </p>
          </div>
        </div>

        {/* How Claims Work */}
        <div className="bg-[rgba(37,99,235,0.1)] border border-[#60a5fa] p-3 md:p-4 flex gap-2.5">
          <Terminal className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#60a5fa] shrink-0 mt-0.5" />
          <div className="flex flex-col gap-2 flex-1">
            <h3 className="font-medium text-sm md:text-base text-[#60a5fa] leading-tight">
              How Claims Work
            </h3>
            <p className="text-xs md:text-sm text-[#60a5fa] leading-relaxed">
              When a sale concludes, you will upload the ticket file. The protocol uses a
              Zero-Knowledge Proof to verify your ownership without revealing your purchase
              transaction.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProofTicketCard({ ticket }: { ticket: ProofTicket }) {
  const isLocked = ticket.status === 'LOCKED';
  const isClaimLive = ticket.status === 'CLAIM LIVE';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-neutral-950 border border-[rgba(255,255,255,0.1)] flex flex-col"
    >
      {/* Main Card Content */}
      <div className="border-b border-[rgba(72,72,72,0.6)] p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
            {/* Token Image */}
            <div className="bg-[#301342] border border-[rgba(20,184,166,0.5)] rounded-lg w-12 h-12 md:w-14 md:h-14 flex items-center justify-center shrink-0">
              {ticket.tokenImage ? (
                <img
                  src={ticket.tokenImage}
                  alt={ticket.tokenName}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <span className="text-white font-bold text-xl font-rajdhani">
                  {ticket.tokenName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Token Info */}
            <div className="flex flex-col gap-1.5 md:gap-2 flex-1 min-w-0">
              <div className="flex flex-col">
                <h3 className="font-rajdhani font-bold text-lg md:text-xl text-white leading-tight truncate">
                  {ticket.tokenName}
                </h3>
                <span className="font-rajdhani font-medium text-sm md:text-base text-gray-400 leading-tight">
                  ${ticket.tokenSymbol}
                </span>
              </div>
              <div className="bg-[rgba(208,135,0,0.15)] border border-[rgba(208,135,0,0.15)] rounded px-2 py-1 w-fit">
                <span className="font-rajdhani font-medium text-xs md:text-sm text-[#d08700]">
                  {ticket.ticketCount} TICKET{ticket.ticketCount > 1 ? 'S' : ''}
                </span>
              </div>
            </div>

            {/* Allocation Info */}
            <div className="flex flex-col gap-1.5 md:gap-2">
              <div className="font-rajdhani font-medium text-xs md:text-sm text-[#d08700]">
                TOTAL ALLOCATION
              </div>
              <div className="flex items-end gap-2 md:gap-3">
                <div className="font-rajdhani font-bold text-xl md:text-2xl text-[#d08700] leading-tight">
                  {formatNumberToCurrency(ticket.totalAllocation)}
                </div>
                <div className="font-rajdhani font-medium text-xs md:text-sm text-[#d08700] leading-tight pb-0.5">
                  {ticket.allocationSymbol}
                </div>
              </div>
            </div>
          </div>

          {/* Status and Actions */}
          <div className="flex flex-row md:flex-col gap-2 md:gap-2.5 items-start md:items-end">
            {/* Status Badge */}
            <div
              className={`border rounded px-2 py-1 flex items-center gap-1.5 ${
                isClaimLive
                  ? 'border-[#16a34a] bg-transparent'
                  : ticket.status === 'SALES LIVE'
                    ? 'border-[#16a34a] bg-transparent'
                    : 'border-gray-400 bg-transparent'
              }`}
            >
              {(isClaimLive || ticket.status === 'SALES LIVE') && (
                <div className="w-1.5 h-1.5 bg-[#16a34a] rounded-full"></div>
              )}
              <span
                className={`font-rajdhani font-medium text-xs md:text-sm ${
                  isClaimLive || ticket.status === 'SALES LIVE' ? 'text-[#16a34a]' : 'text-gray-400'
                }`}
              >
                {ticket.status}
              </span>
            </div>

            {/* Action Button */}
            <button
              className={`border rounded flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 h-9 md:h-10 ${
                isLocked
                  ? 'border-[rgba(229,229,229,0.3)] bg-transparent'
                  : 'border-[rgba(208,135,0,0.15)] bg-[rgba(208,135,0,0.15)]'
              }`}
              disabled={isLocked}
            >
              <LockKeyhole
                className={`w-3.5 h-3.5 md:w-4 md:h-4 ${
                  isLocked ? 'text-[rgba(229,229,229,0.7)]' : 'text-[#d08700]'
                }`}
              />
              <span
                className={`font-rajdhani font-bold text-xs md:text-sm ${
                  isLocked ? 'text-[rgba(229,229,229,0.7)]' : 'text-[#d08700]'
                }`}
              >
                {isLocked ? 'LOCKED' : 'CLAIM NOW'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Ticket References Section */}
      {ticket.references && ticket.references.length > 0 && (
        <div className="p-4 md:p-6 relative">
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'rgba(127,127,127,0.2)',
              mixBlendMode: 'luminosity',
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'rgba(61,61,61,0.5)',
              mixBlendMode: 'overlay',
            }}
          />
          <div className="relative flex flex-col gap-3">
            <h4 className="font-rajdhani font-semibold text-sm md:text-base text-white">
              TICKET REFERENCES
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ticket.references.map((ref, index) => (
                <div
                  key={index}
                  className="bg-[rgba(10,10,10,0.29)] border border-[rgba(255,255,255,0.1)] p-3 md:p-4 flex items-center gap-2.5 md:gap-3"
                >
                  {/* Key Square Icon */}
                  <div className="w-10 h-10 md:w-12 md:h-12 text-[#d08700] shrink-0 flex items-center justify-center">
                    <svg
                      width="52"
                      height="52"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-full h-full"
                    >
                      <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="2"
                        stroke="#d08700"
                        strokeWidth="1.5"
                        fill="none"
                      />
                      <path
                        d="M8 12h8M12 8v8"
                        stroke="#d08700"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div className="flex flex-col gap-1.5 md:gap-2 flex-1 min-w-0">
                    <div className="font-rajdhani font-medium text-sm md:text-base text-white leading-tight truncate">
                      {ref.filename}
                    </div>
                    <div className="font-rajdhani font-bold text-lg md:text-xl text-[rgba(255,255,255,0.39)]">
                      {ref.amount} {ref.symbol}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
