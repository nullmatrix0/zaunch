'use client';

// Ticket reference storage - stores metadata only, NOT the actual proof
// Users must download and securely store the ZIP file themselves

export interface TicketReference {
  id: string;                    // Unique ID (from TEE reference_id)
  launchAddress: string;         // Launch PDA address
  launchName: string;            // Token/launch name
  tokenSymbol: string;           // Token symbol
  claimAmount: string;           // Amount of tokens to claim
  depositAddress: string;        // Deposit address used
  createdAt: number;             // Timestamp when ticket was generated
  status: 'pending' | 'claimed'; // Whether user has claimed
  tokenImageUri?: string;        // Token image URI for display
}

const STORAGE_KEY = 'zaunchpad_tickets';

export function getStoredTickets(): TicketReference[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error reading tickets from localStorage:', error);
    return [];
  }
}

export function saveTicket(ticket: TicketReference): void {
  if (typeof window === 'undefined') return;
  
  try {
    const tickets = getStoredTickets();
    
    // Check if ticket already exists (by id)
    const existingIndex = tickets.findIndex(t => t.id === ticket.id);
    if (existingIndex >= 0) {
      tickets[existingIndex] = ticket;
    } else {
      tickets.push(ticket);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  } catch (error) {
    console.error('Error saving ticket to localStorage:', error);
  }
}

export function updateTicketStatus(ticketId: string, status: 'pending' | 'claimed'): void {
  if (typeof window === 'undefined') return;
  
  try {
    const tickets = getStoredTickets();
    const ticketIndex = tickets.findIndex(t => t.id === ticketId);
    
    if (ticketIndex >= 0) {
      tickets[ticketIndex].status = status;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
    }
  } catch (error) {
    console.error('Error updating ticket status:', error);
  }
}

export function removeTicket(ticketId: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const tickets = getStoredTickets();
    const filtered = tickets.filter(t => t.id !== ticketId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing ticket:', error);
  }
}

export function getTicketsByLaunch(launchAddress: string): TicketReference[] {
  return getStoredTickets().filter(t => t.launchAddress === launchAddress);
}

export function getTicketsByStatus(status: 'pending' | 'claimed'): TicketReference[] {
  return getStoredTickets().filter(t => t.status === status);
}

// Group tickets by launch for display
export function getTicketsGroupedByLaunch(): Map<string, TicketReference[]> {
  const tickets = getStoredTickets();
  const grouped = new Map<string, TicketReference[]>();
  
  for (const ticket of tickets) {
    const existing = grouped.get(ticket.launchAddress) || [];
    existing.push(ticket);
    grouped.set(ticket.launchAddress, existing);
  }
  
  return grouped;
}

