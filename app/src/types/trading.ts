import { Token } from '@/types/token';
import { OneClickToken, StatusResponse } from '@/lib/oneclick';
import { TEEProofResult } from '@/lib/tee-client';

// Ticket data structure for ZK proof claims
export interface TicketData {
  proofReference: string;
  depositAddress: string;
  swapAmountIn: string;
  swapAmountOut: string;
  swapAmountUsd: string;
  claimAmount: string;
  claimAmountFormatted: string;
  createdAt: string;
  launchId: string;
  launchPda: string;
  tokenMint: string;
  tokenSymbol: string;
  pricePerToken: string;
  depositId?: string;
  downloadUrl?: string;
}

export interface TradingInterfaceProps {
  token: Token;
  address: string;
}

export interface TokenData {
  price: number;
  holders: number;
  marketCap: number;
  targetRaise: number;
  poolAddress: string;
  migrationProgress: number;
}

export interface UserBalances {
  sol: number;
  token: number;
}

export interface TradingState {
  tokenData: TokenData;
  userBalances: UserBalances;
  loading: boolean;
  loadingBalances: boolean;
  isBuying: boolean;
  amountPay: string;
  amountReceive: string;
  baseReserve: number;
  quoteReserve: number;
  payIsSol: boolean;
}

export type TradingAction =
  | { type: 'SET_TOKEN_DATA'; payload: TokenData }
  | { type: 'SET_USER_BALANCES'; payload: UserBalances }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOADING_BALANCES'; payload: boolean }
  | { type: 'SET_IS_BUYING'; payload: boolean }
  | { type: 'SET_AMOUNT_PAY'; payload: string }
  | { type: 'SET_AMOUNT_RECEIVE'; payload: string }
  | { type: 'SET_RESERVES'; payload: { base: number; quote: number } }
  | { type: 'SET_PAY_IS_SOL'; payload: boolean }
  | { type: 'RESET_AMOUNTS' }
  | { type: 'SWITCH_TOKEN'; payload: boolean };

export interface AvailabilityInfo {
  tokensAvailable: number;
  totalTokensReserved: number;
  amountToSell: number;
  maxUsdAvailable: string;
  isSoldOut: boolean;
  ticketsCreated: number;
}

export interface TicketPayment {
  ticketNumber: number;
  depositAddress: string;
  depositMemo: string | null;
  depositAmount: string;
  purchaseInfo: any | null;
  swapStatus: StatusResponse | null;
  ticketData: TicketData | null;
  teeResult: TEEProofResult | null;
  status:
    | 'pending'
    | 'waiting-payment'
    | 'confirming'
    | 'generating-proof'
    | 'completed'
    | 'failed';
  escrowZAddress?: string | null;
  depositId?: string;
}

export interface DepositState {
  depositAmount: string;
  depositAddress: string | null;
  depositMemo: string | null;
  purchaseInfo: any | null;
  swapStatus: StatusResponse | null;
  isGeneratingAddress: boolean;
  isSettling: boolean;
  isLoadingPurchaseInfo: boolean;
  isCheckingStatus: boolean;
  isGeneratingTicket: boolean;
  lastCheckedAt: number | null;
  ticketData: TicketData | null;
  nearTxHash: string | null;
  depositFlowState:
    | 'initial'
    | 'qr-code'
    | 'detecting'
    | 'generating-ticket'
    | 'success'
    | 'multi-ticket';
  availableTokens: OneClickToken[];
  selectedBlockchain: string;
  selectedToken: OneClickToken | null;
  loadingTokens: boolean;
  showBlockchainDropdown: boolean;
  availability: AvailabilityInfo | null;
  loadingAvailability: boolean;
  showTokenDropdown: boolean;
  zecToken: OneClickToken | null;
  ticketQuantity: number;
  ticketPayments: TicketPayment[];
  currentTicketIndex: number;
  completedTickets: TicketData[];
}
