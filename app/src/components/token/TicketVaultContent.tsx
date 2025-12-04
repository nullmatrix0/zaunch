'use client';

import { Eye, Trash2 } from 'lucide-react';
import { formatNumberToCurrency } from '@/utils';
import { motion } from 'framer-motion';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  getStoredTickets, 
  removeTicket,
  TicketReference 
} from '@/lib/ticket-storage';

interface GroupedTickets {
  launchAddress: string;
  launchName: string;
  tokenSymbol: string;
  tokenImageUri?: string;
  tickets: TicketReference[];
  totalAllocation: number;
  hasClaimableTickets: boolean;
}

export function TicketVaultContent() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketReference[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load tickets from localStorage
  const loadTickets = useCallback(() => {
    const stored = getStoredTickets();
    setTickets(stored);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadTickets();
    // Listen for storage changes from other tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'zaunchpad_tickets') {
        loadTickets();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [loadTickets]);

  // Group tickets by launch using the tickets state directly
  const groupedTickets = useMemo((): GroupedTickets[] => {
    const grouped = new Map<string, TicketReference[]>();
    
    // Group from state, not from localStorage directly
    for (const ticket of tickets) {
      const existing = grouped.get(ticket.launchAddress) || [];
      existing.push(ticket);
      grouped.set(ticket.launchAddress, existing);
    }
    
    const result: GroupedTickets[] = [];
    
    grouped.forEach((launchTickets, launchAddress) => {
      if (launchTickets.length === 0) return;
      
      const firstTicket = launchTickets[0];
      const totalAllocation = launchTickets.reduce((sum, t) => {
        const amount = parseFloat(t.claimAmount) || 0;
        return sum + amount;
      }, 0);
      
      result.push({
        launchAddress,
        launchName: firstTicket.launchName,
        tokenSymbol: firstTicket.tokenSymbol,
        tokenImageUri: firstTicket.tokenImageUri,
        tickets: launchTickets,
        totalAllocation,
        hasClaimableTickets: launchTickets.some(t => t.status === 'pending'),
      });
    });
    
    // Sort by most recent first
    return result.sort((a, b) => {
      const aLatest = Math.max(...a.tickets.map(t => t.createdAt));
      const bLatest = Math.max(...b.tickets.map(t => t.createdAt));
      return bLatest - aLatest;
    });
  }, [tickets]);

  const handleRemoveTicket = useCallback((ticketId: string) => {
    if (confirm('Are you sure you want to remove this ticket reference? Make sure you have downloaded the ZIP file backup.')) {
      removeTicket(ticketId);
      loadTickets();
    }
  }, [loadTickets]);

  const handleViewLaunch = useCallback((launchAddress: string) => {
    router.push(`/token/${launchAddress}`);
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d08700]"></div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="backdrop-blur-[2px] bg-[#000000] border border-[rgba(255,255,255,0.1)] relative w-full">
        {/* Corner decorations */}
        <div className="absolute border-[#d08700] border-b-0 border-l-2 border-r-0 border-solid border-t-2 left-[0.67px] w-[14px] h-[14px] top-[0.67px]" />
        <div className="absolute border-[#d08700] border-b-0 border-l-0 border-r-2 border-solid border-t-2 right-[0.67px] w-[14px] h-[14px] top-[0.67px]" />
        <div className="absolute border-[rgba(245,245,245,0.3)] border-b-2 border-l-2 border-r-0 border-solid border-t-0 bottom-[0.67px] left-[0.67px] w-[14px] h-[14px]" />
        <div className="absolute border-[rgba(245,245,245,0.3)] border-b-2 border-l-0 border-r-2 border-solid border-t-0 bottom-[0.67px] right-[0.67px] w-[14px] h-[14px]" />

        <div className="p-4 md:p-6 flex flex-col gap-6 md:gap-8">
          {/* Header */}
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 md:w-6 md:h-6 text-[#d08700] relative">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="#d08700" strokeWidth="1.5" fill="none" />
                <path d="M8 12h8M12 8v8" stroke="#d08700" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="font-rajdhani font-bold text-lg md:text-xl text-white">
              MY TICKETS ({tickets.length})
            </h2>
          </div>

          {/* Ticket Cards */}
          {groupedTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 mb-4 text-gray-600">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="font-rajdhani font-bold text-lg text-gray-400 mb-2">No Tickets Yet</h3>
              <p className="font-rajdhani text-sm text-gray-500 max-w-md">
                When you purchase tokens from a launch, your ZK proof tickets will appear here.
                Browse active launches to get started.
              </p>
              <button
                onClick={() => router.push('/token')}
                className="mt-6 border border-[#d08700] bg-transparent text-[#d08700] px-6 py-2 font-rajdhani font-bold text-sm hover:bg-[rgba(208,135,0,0.1)] transition-colors"
              >
                EXPLORE LAUNCHES
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 md:gap-6">
              {groupedTickets.map((group) => (
                <ProofTicketCard 
                  key={group.launchAddress} 
                  group={group}
                  onRemoveTicket={handleRemoveTicket}
                  onViewLaunch={handleViewLaunch}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProofTicketCard({ 
  group, 
  onRemoveTicket,
  onViewLaunch,
}: { 
  group: GroupedTickets;
  onRemoveTicket: (id: string) => void;
  onViewLaunch: (address: string) => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const pendingCount = group.tickets.filter(t => t.status === 'pending').length;
  const claimedCount = group.tickets.filter(t => t.status === 'claimed').length;

  useEffect(() => {
    if (group.tokenImageUri) {
      fetch(group.tokenImageUri)
        .then(res => res.json())
        .then(data => setImageUrl(data.image))
        .catch(() => setImageUrl(null));
    }
  }, [group.tokenImageUri]);

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
            <div className="bg-[#301342] border border-[rgba(20,184,166,0.5)] rounded-lg w-12 h-12 md:w-14 md:h-14 flex items-center justify-center shrink-0 overflow-hidden">
              {imageUrl ? (
                <img src={imageUrl} alt={group.launchName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-xl font-rajdhani">
                  {group.launchName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Token Info */}
            <div className="flex flex-col gap-1.5 md:gap-2 flex-1 min-w-0">
              <div className="flex flex-col">
                <h3 className="font-rajdhani font-bold text-lg md:text-xl text-white leading-tight truncate">
                  {group.launchName}
                </h3>
                <span className="font-rajdhani font-medium text-sm md:text-base text-gray-400 leading-tight">
                  ${group.tokenSymbol}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <div className="bg-[rgba(208,135,0,0.15)] border border-[rgba(208,135,0,0.15)] rounded px-2 py-1">
                  <span className="font-rajdhani font-medium text-xs md:text-sm text-[#d08700]">
                    {group.tickets.length} TICKET{group.tickets.length > 1 ? 'S' : ''}
                  </span>
                </div>
                {pendingCount > 0 && (
                  <div className="bg-[rgba(34,197,94,0.15)] border border-[rgba(34,197,94,0.3)] rounded px-2 py-1">
                    <span className="font-rajdhani font-medium text-xs md:text-sm text-green-500">
                      {pendingCount} PENDING
                    </span>
                  </div>
                )}
                {claimedCount > 0 && (
                  <div className="bg-[rgba(156,163,175,0.15)] border border-[rgba(156,163,175,0.3)] rounded px-2 py-1">
                    <span className="font-rajdhani font-medium text-xs md:text-sm text-gray-400">
                      {claimedCount} CLAIMED
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Allocation Info */}
            <div className="flex flex-col gap-1.5 md:gap-2 text-right">
              <div className="font-rajdhani font-medium text-xs md:text-sm text-[#d08700]">
                TOTAL ALLOCATION
              </div>
              <div className="flex items-end gap-2 md:gap-3 justify-end">
                <div className="font-rajdhani font-bold text-xl md:text-2xl text-[#d08700] leading-tight">
                  {formatNumberToCurrency(group.totalAllocation)}
                </div>
                <div className="font-rajdhani font-medium text-xs md:text-sm text-[#d08700] leading-tight pb-0.5">
                  {group.tokenSymbol}
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex flex-row md:flex-col gap-2 md:gap-2.5 items-start md:items-end">
            <button
              onClick={() => onViewLaunch(group.launchAddress)}
              className="border border-[rgba(208,135,0,0.5)] bg-[rgba(208,135,0,0.15)] rounded flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 h-9 md:h-10 hover:bg-[rgba(208,135,0,0.25)] transition-colors"
            >
              <Eye className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#d08700]" />
              <span className="font-rajdhani font-bold text-xs md:text-sm text-[#d08700]">
                VIEW & CLAIM
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Ticket References Section */}
      <div className="p-4 md:p-6 relative">
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(127,127,127,0.2)', mixBlendMode: 'luminosity' }} />
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(61,61,61,0.5)', mixBlendMode: 'overlay' }} />
        <div className="relative flex flex-col gap-3">
          <h4 className="font-rajdhani font-semibold text-sm md:text-base text-white">
            TICKET REFERENCES
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {group.tickets.map((ticket) => (
              <TicketReferenceItem 
                key={ticket.id} 
                ticket={ticket}
                tokenSymbol={group.tokenSymbol}
                onRemove={() => onRemoveTicket(ticket.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TicketReferenceItem({ 
  ticket, 
  tokenSymbol,
  onRemove 
}: { 
  ticket: TicketReference;
  tokenSymbol: string;
  onRemove: () => void;
}) {
  const claimAmount = parseFloat(ticket.claimAmount) || 0;
  const isPending = ticket.status === 'pending';

  return (
    <div className={`bg-[rgba(10,10,10,0.29)] border p-3 md:p-4 flex items-center gap-2.5 md:gap-3 ${
      isPending ? 'border-[rgba(34,197,94,0.3)]' : 'border-[rgba(255,255,255,0.1)]'
    }`}>
      {/* Key Square Icon */}
      <div className={`w-10 h-10 md:w-12 md:h-12 shrink-0 flex items-center justify-center ${
        isPending ? 'text-green-500' : 'text-gray-500'
      }`}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className="flex flex-col gap-1.5 md:gap-2 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-rajdhani font-medium text-sm md:text-base text-white leading-tight truncate flex-1">
            {ticket.id}
          </span>
          {isPending && (
            <span className="text-xs text-green-500 font-rajdhani">●</span>
          )}
        </div>
        <div className={`font-rajdhani font-bold text-lg md:text-xl ${isPending ? 'text-white' : 'text-[rgba(255,255,255,0.39)]'}`}>
          {formatNumberToCurrency(claimAmount)} {tokenSymbol}
        </div>
        <div className="font-rajdhani text-xs text-gray-500">
          {new Date(ticket.createdAt).toLocaleDateString()}
        </div>
      </div>
      <button
        onClick={onRemove}
        className="p-1.5 text-gray-500 hover:text-red-500 transition-colors"
        title="Remove reference"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
