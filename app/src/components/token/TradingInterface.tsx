'use client';

import { Button } from '@/components/ui/button';
import { Token } from '@/types/token';

import { ChevronDown, Loader2, CheckCircle2, AlertTriangle, Download } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState,
  useReducer,
  useTransition,
  useDeferredValue,
  memo,
  useRef,
} from 'react';
import { getRpcSOLEndpoint, getSolPrice, getSolBalance, getTokenBalanceOnSOL } from '@/lib/sol';
import { calculateDbcSwapQuote, approximateSwapQuote } from '@/lib/meteora';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { Connection, PublicKey } from '@solana/web3.js';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { getIpfsUrl } from '@/lib/utils';
import { useNearIntents } from '@/hooks/useNearIntents';
import { useWalletSelector } from '@near-wallet-selector/react-hook';
import { QRCodeSVG } from 'qrcode.react';
import { generateProofFromTEE, downloadProofFromTEE, TEEProofResult, getFormattedClaimAmount, checkLaunchAvailability } from '@/lib/tee-client';
import { saveTicket, TicketReference } from '@/lib/ticket-storage';
import {
  fetchAvailableTokens,
  getUniqueBlockchains,
  getTokensByBlockchain,
  convertToUnit,
  calculateBasisPoints,
  getRefundAddress,
  createSwapQuote,
  checkSwapStatus,
  getZecToken,
  type OneClickToken,
  type QuoteResponse,
  type StatusResponse,
} from '@/lib/oneclick';
import { getChainIcon, getTokenIcon, getOneClickTokenIcon, capitalizeAll } from '@/lib/tokenIcons';

const parseNearAmount = (amount: string): string => {
  if (!amount || parseFloat(amount) <= 0) return '0';
  const amountNum = parseFloat(amount);
  return (amountNum * Math.pow(10, 24)).toFixed(0);
};

// Ticket data structure for ZK proof claims
interface TicketData {
  proofReference: string;
  depositAddress: string;
  swapAmountIn: string;
  swapAmountOut: string;
  swapAmountUsd: string;
  claimAmount: string;           // Raw token amount (with decimals)
  claimAmountFormatted: string;  // Human readable amount
  createdAt: string;
  launchId: string;
  launchPda: string;
  tokenMint: string;
  tokenSymbol: string;
  pricePerToken: string;
  downloadUrl?: string;
}

interface TradingInterfaceProps {
  token: Token;
  address: string;
}

interface TokenData {
  price: number;
  holders: number;
  marketCap: number;
  targetRaise: number;
  poolAddress: string;
  migrationProgress: number;
}

interface UserBalances {
  sol: number;
  token: number;
}

interface TradingState {
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

type TradingAction =
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

const tradingReducer = (state: TradingState, action: TradingAction): TradingState => {
  switch (action.type) {
    case 'SET_TOKEN_DATA':
      return { ...state, tokenData: action.payload, loading: false };
    case 'SET_USER_BALANCES':
      return { ...state, userBalances: action.payload, loadingBalances: false };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_LOADING_BALANCES':
      return { ...state, loadingBalances: action.payload };
    case 'SET_IS_BUYING':
      return { ...state, isBuying: action.payload };
    case 'SET_AMOUNT_PAY':
      return { ...state, amountPay: action.payload };
    case 'SET_AMOUNT_RECEIVE':
      return { ...state, amountReceive: action.payload };
    case 'SET_RESERVES':
      return { ...state, baseReserve: action.payload.base, quoteReserve: action.payload.quote };
    case 'SET_PAY_IS_SOL':
      return { ...state, payIsSol: action.payload };
    case 'RESET_AMOUNTS':
      return { ...state, amountPay: '', amountReceive: '' };
    case 'SWITCH_TOKEN':
      return { ...state, payIsSol: action.payload, amountPay: '', amountReceive: '' };
    default:
      return state;
  }
};

const GAS_RESERVE = 0.001; // Reserve SOL for gas fees
const SLIPPAGE_BPS = 50;
const COMPUTE_UNIT_PRICE = 100000;
const MAX_FRACTION_DIGITS = 6;
const LAMPORTS_PER_SOL = 1_000_000_000;
const TOTAL_FEE_PERCENT = 0.003; // 0.3% total fee (protocol + partner + creator)

// Migration Progress Enum
enum MigrationProgress {
  PreBondingCurve = 0,
  PostBondingCurve = 1,
  LockedVesting = 2,
  CreatedPool = 3,
}

// Get user-friendly phase information
const getPhaseInfo = (migrationProgress: number) => {
  switch (migrationProgress) {
    case MigrationProgress.PreBondingCurve:
      return {
        label: 'BONDING CURVE',
        color: 'orange',
        description: 'Initial fundraising phase',
      };
    case MigrationProgress.PostBondingCurve:
      return {
        label: 'FUNDRAISING COMPLETE',
        color: 'green',
        description: 'Preparing for migration',
      };
    case MigrationProgress.LockedVesting:
      return {
        label: 'VESTING PERIOD',
        color: 'purple',
        description: 'Locked vesting in progress',
      };
    case MigrationProgress.CreatedPool:
      return {
        label: 'LIVE TRADING',
        color: 'emerald',
        description: 'Pool created and migrated',
      };
    default:
      return {
        label: 'UNKNOWN',
        color: 'gray',
        description: 'Status unknown',
      };
  }
};

const formatBalance = (balance: number, decimals: number = 4): string => {
  return balance.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
};

// Availability info from TEE
interface AvailabilityInfo {
  tokensAvailable: number;
  totalTokensReserved: number;
  amountToSell: number;
  maxUsdAvailable: string;
  isSoldOut: boolean;
  ticketsCreated: number;
}

// Deposit workflow state interface
interface DepositState {
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
  depositFlowState: 'initial' | 'qr-code' | 'detecting' | 'generating-ticket' | 'success';
  // Token selection
  availableTokens: OneClickToken[];
  selectedBlockchain: string;
  selectedToken: OneClickToken | null;
  loadingTokens: boolean;
  showBlockchainDropdown: boolean;
  // Availability tracking
  availability: AvailabilityInfo | null;
  loadingAvailability: boolean;
  showTokenDropdown: boolean;
  zecToken: OneClickToken | null;
}

function TradingInterfaceComponent({ token, address }: TradingInterfaceProps) {
  const { publicKey, sendTransaction } = useWallet();
  const nearIntents = useNearIntents();

  const [state, dispatch] = useReducer(tradingReducer, {
    tokenData: {
      price: 0,
      holders: 0,
      marketCap: 0,
      targetRaise: 0,
      poolAddress: '',
      migrationProgress: 0,
    },
    userBalances: {
      sol: 0,
      token: 0,
    },
    loading: true,
    loadingBalances: false,
    isBuying: false,
    amountPay: '',
    amountReceive: '',
    baseReserve: 0,
    quoteReserve: 0,
    payIsSol: true,
  });

  // Deposit workflow state
  const [depositState, setDepositState] = useState<DepositState>({
    depositAmount: '',
    depositAddress: null,
    depositMemo: null,
    purchaseInfo: null,
    swapStatus: null,
    isGeneratingAddress: false,
    isSettling: false,
    isLoadingPurchaseInfo: false,
    isCheckingStatus: false,
    isGeneratingTicket: false,
    lastCheckedAt: null,
    ticketData: null,
    nearTxHash: null,
    depositFlowState: 'initial',
    // Token selection
    availableTokens: [],
    selectedBlockchain: 'Chain',
    selectedToken: null,
    loadingTokens: true,
    showBlockchainDropdown: false,
    // Availability tracking
    availability: null,
    loadingAvailability: false,
    showTokenDropdown: false,
    zecToken: null,
  });

  const [isPending, startTransition] = useTransition();
  const statusPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const quoteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const fetchTokenUri = useCallback(async () => {
    try {
      const re = await fetch(token.tokenUri);
      const data = await re.json();
      setImageUrl(data.image);
    } catch (e) {
      return null;
    }
  }, [token.tokenUri]);

  useEffect(() => {
    fetchTokenUri();
  }, [fetchTokenUri]);

  // Fetch available tokens from 1Click API
  useEffect(() => {
    const loadTokens = async () => {
      try {
        setDepositState((prev) => ({ ...prev, loadingTokens: true }));
        const [tokens, zec] = await Promise.all([fetchAvailableTokens(), getZecToken()]);
        setDepositState((prev) => ({
          ...prev,
          availableTokens: tokens,
          zecToken: zec,
          loadingTokens: false,
        }));
      } catch (error) {
        console.error('Error loading tokens:', error);
        toast.error('Failed to load available tokens');
        setDepositState((prev) => ({ ...prev, loadingTokens: false }));
      }
    };
    loadTokens();
  }, []);

  // Fetch availability info from TEE
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!token.name || !token.amountToSell) return;
      
      try {
        setDepositState((prev) => ({ ...prev, loadingAvailability: true }));
        const availability = await checkLaunchAvailability({
          launchId: token.name,
          amountToSell: Number(token.amountToSell),
          pricePerToken: Number(token.pricePerToken),
        });
        setDepositState((prev) => ({
          ...prev,
          availability: {
            tokensAvailable: availability.tokensAvailable,
            totalTokensReserved: availability.totalTokensReserved,
            amountToSell: availability.amountToSell,
            maxUsdAvailable: availability.maxUsdAvailable,
            isSoldOut: availability.isSoldOut,
            ticketsCreated: availability.ticketsCreated,
          },
          loadingAvailability: false,
        }));
        console.log('[Availability] Launch availability:', availability);
      } catch (error) {
        console.error('[Availability] Error fetching:', error);
        setDepositState((prev) => ({ ...prev, loadingAvailability: false }));
      }
    };
    fetchAvailability();
  }, [token.name, token.amountToSell, token.pricePerToken]);

  const getTokenSymbol = useCallback(() => {
    if ('tokenSymbol' in token && token.tokenSymbol) return token.tokenSymbol;
    if ('symbol' in token && token.symbol) return token.symbol;
    return '';
  }, [token]);


  const getTokenDecimals = useCallback(() => {
    if ('decimals' in token && typeof token.decimals === 'number') return token.decimals;
    return 9; // default
  }, [token]);

  const fetchUserBalances = useCallback(async () => {
    if (!publicKey) {
      dispatch({ type: 'SET_USER_BALANCES', payload: { sol: 0, token: 0 } });
      return;
    }

    try {
      dispatch({ type: 'SET_LOADING_BALANCES', payload: true });

      const [solBalance, tokenBalance] = await Promise.all([
        getSolBalance(publicKey.toString()),
        getTokenBalanceOnSOL(address, publicKey.toString()),
      ]);

      startTransition(() => {
        dispatch({
          type: 'SET_USER_BALANCES',
          payload: { sol: solBalance, token: tokenBalance },
        });
      });
    } catch (error) {
      console.error('Error fetching user balances:', error);
      dispatch({ type: 'SET_USER_BALANCES', payload: { sol: 0, token: 0 } });
    }
  }, [publicKey, address]);

  const fetchTokenData = useCallback(async () => {
    const solPrice = await getSolPrice();
    if (!solPrice) return;

    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      const connection = new Connection(getRpcSOLEndpoint());
      const client = new DynamicBondingCurveClient(connection, 'confirmed');

      let poolAddress: PublicKey;
      try {
        poolAddress = new PublicKey(address);
      } catch {
        console.warn('Invalid pool address:', address);
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      let virtualPoolState;
      let poolConfigState;

      try {
        virtualPoolState = await client.state.getPool(poolAddress);
        if (!virtualPoolState) {
          console.warn('Pool not found:', address);
          dispatch({ type: 'SET_LOADING', payload: false });
          return;
        }

        poolConfigState = await client.state.getPoolConfig(virtualPoolState.config);
        if (!poolConfigState) {
          console.warn('Pool config not found');
          dispatch({ type: 'SET_LOADING', payload: false });
          return;
        }
      } catch (error) {
        console.warn('Error fetching pool data (token may not be a valid Meteora pool):', error);
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      const quoteReserve = virtualPoolState.quoteReserve?.toNumber() || 0;
      const baseReserve = virtualPoolState.baseReserve?.toNumber() || 0;

      const quote = quoteReserve / LAMPORTS_PER_SOL;
      const tokenDecimals = getTokenDecimals();
      const base = baseReserve / Math.pow(10, tokenDecimals);

      const preMigrationTokenSupply = poolConfigState.preMigrationTokenSupply?.toNumber() || 0;
      const preMigrationSupply = preMigrationTokenSupply / Math.pow(10, getTokenDecimals());

      const price = base > 0 ? quote / base : 0;

      const totalSupply = preMigrationSupply + base;
      const circulating = totalSupply - base;
      const marketCap = price * circulating;

      const migrationQuoteThreshold = poolConfigState.migrationQuoteThreshold?.toNumber() || 0;
      const targetRaise = (migrationQuoteThreshold / LAMPORTS_PER_SOL) * solPrice;

      const holders: string[] = [];

      dispatch({ type: 'SET_RESERVES', payload: { base, quote } });

      startTransition(() => {
        dispatch({
          type: 'SET_TOKEN_DATA',
          payload: {
            price: price * solPrice,
            holders: holders.length,
            marketCap: marketCap * solPrice,
            targetRaise,
            poolAddress: poolAddress.toString(),
            migrationProgress: virtualPoolState.migrationProgress || 0,
          },
        });
      });
    } catch (error) {
      console.error('Error fetching token data:', error);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [address, getTokenDecimals]);

  useEffect(() => {
    fetchTokenData();
  }, [fetchTokenData]);

  useEffect(() => {
    fetchUserBalances();
  }, [fetchUserBalances]);

  useEffect(() => {
    return () => {
      if (quoteTimeoutRef.current) {
        clearTimeout(quoteTimeoutRef.current);
      }
    };
  }, []);

  const fetchPurchaseInfo = useCallback(
    async (amount: string) => {
      if (!amount || parseFloat(amount) <= 0) {
        setDepositState((prev) => ({ ...prev, purchaseInfo: null }));
        return;
      }

      if (!depositState.selectedToken || !depositState.zecToken) {
        setDepositState((prev) => ({ ...prev, purchaseInfo: null, isLoadingPurchaseInfo: false }));
        return;
      }

      try {
        setDepositState((prev) => ({ ...prev, isLoadingPurchaseInfo: true }));

        // Get creator wallet from token metadata
        const creatorWallet = token.creatorWallet;

        if (!creatorWallet || creatorWallet.trim() === '') {
          console.warn('Creator wallet not found in token metadata');
          setDepositState((prev) => ({
            ...prev,
            purchaseInfo: null,
            isLoadingPurchaseInfo: false,
          }));
          return;
        }

        // Convert amount to smallest unit
        const amountInSmallestUnit = convertToUnit(amount, depositState.selectedToken.decimals);

        // Get refund address for the selected blockchain
        const refundAddress = getRefundAddress(depositState.selectedBlockchain);
        if (!refundAddress) {
          toast.error('Refund address not configured for selected blockchain');
          setDepositState((prev) => ({
            ...prev,
            purchaseInfo: null,
            isLoadingPurchaseInfo: false,
          }));
          return;
        }

        // Calculate fee (0.5% privacy fee)
        const feeAmount = parseFloat(amount) * 0.005;
        const feeBasisPoints = calculateBasisPoints(feeAmount, parseFloat(amount));

        // Create quote to get estimates
        const quote = await createSwapQuote({
          originAsset: depositState.selectedToken.assetId,
          destinationAsset: depositState.zecToken.assetId,
          amount: amountInSmallestUnit,
          recipient: creatorWallet, // Send to creator's wallet
          refundTo: refundAddress,
          appFees: [
            {
              recipient: creatorWallet,
              fee: feeBasisPoints,
            },
          ],
        });

        // Calculate how many tokens they'll receive based on price
        // pricePerToken is in micro-USD (USD * 10^6)
        // Example: $0.01 = 10,000 micro-USD, $0.0001 = 100 micro-USD
        const amountInUsd = parseFloat(amount) * depositState.selectedToken.price;
        const pricePerTokenMicroUsd = Number(token.pricePerToken); // Already in micro-USD
        const pricePerTokenInUsd = pricePerTokenMicroUsd / 1_000_000; // Convert micro-USD to USD
        
        // Calculate tokens (human-readable, NOT in smallest units)
        // Formula: tokens = amountInUsd / pricePerTokenInUsd
        const tokensToReceive = pricePerTokenInUsd > 0 
          ? (amountInUsd / pricePerTokenInUsd)
          : 0;
          
        console.log('=== Token Calculation Debug ===');
        console.log('Input amount:', amount, depositState.selectedToken?.symbol);
        console.log('Token price (selected):', depositState.selectedToken?.price, 'USD');
        console.log('Amount in USD:', amountInUsd);
        console.log('pricePerToken (from contract, micro-USD):', pricePerTokenMicroUsd);
        console.log('pricePerToken (USD):', pricePerTokenInUsd);
        console.log('Tokens to receive (display):', tokensToReceive);
        console.log('Token decimals:', token.decimals);
        console.log('===============================');

        const purchaseInfo = {
          expectedOut: quote.quote.amountOutFormatted,
          minAmountOut: quote.quote.minAmountOut,
          timeEstimate: quote.quote.timeEstimate || 60,
          amountInUsd: quote.quote.amountInUsd,
          estimatedValueUsd: quote.quote.amountOutUsd || quote.quote.amountInUsd,
          tokensToReceive: tokensToReceive.toString(),
        };

        console.log('Quote response:', quote);
        console.log('Purchase info:', purchaseInfo);

        setDepositState((prev) => ({ ...prev, purchaseInfo, isLoadingPurchaseInfo: false }));
      } catch (error) {
        console.error('Error fetching purchase info:', error);
        toast.error('Failed to fetch swap quote. Please try again.');
        setDepositState((prev) => ({ ...prev, purchaseInfo: null, isLoadingPurchaseInfo: false }));
      }
    },
    [token, depositState.selectedToken, depositState.zecToken, depositState.selectedBlockchain],
  );

  // State to store TEE result for download
  const [teeResult, setTeeResult] = useState<TEEProofResult | null>(null);

  // Generate ticket from TEE - calls real TEE endpoint with encryption
  const generateTicketFromTEE = useCallback(async (depositAddress: string, swapStatus: StatusResponse) => {
    setDepositState((prev) => ({ ...prev, depositFlowState: 'generating-ticket', isGeneratingTicket: true }));
    
    try {
      console.log('[TEE] Starting proof generation for deposit:', depositAddress);
      
      // Call TEE with encrypted request
      const result = await generateProofFromTEE({
        depositAddress: depositAddress,
        creatorAddress: token.creatorWallet || '', // ZEC address from token
        launchPda: address,
        userPubkey: publicKey?.toBase58() || '',
        launchId: token.name,
        tokenMint: token.tokenMint,
        tokenSymbol: token.tokenSymbol,
        pricePerToken: token.pricePerToken.toString(),
        amountToSell: token.amountToSell.toString(),
        decimals: token.decimals,
        tokensPerProof: token.tokensPerProof.toString(),
      });
      
      // Check if verification passed
      if (!result.verification?.verified) {
        const errorMsg = result.verification?.error || result.error || 'Verification failed';
        console.error('[TEE] Verification failed:', errorMsg);
        toast.error(`Verification failed: ${errorMsg}`);
        setDepositState((prev) => ({ 
          ...prev, 
          depositFlowState: 'detecting',
          isGeneratingTicket: false,
        }));
        return;
      }
      
      // Store TEE result for download
      setTeeResult(result);
      
      // Save ticket reference to localStorage (metadata only, not the actual proof)
      try {
        const ticketRef: TicketReference = {
          id: result.metadata.proofReference || `ticket_${Date.now()}`,
          launchAddress: address,
          launchName: token.name || result.metadata.launchId || 'Unknown',
          tokenSymbol: token.tokenSymbol || result.metadata.tokenSymbol || 'TOKEN',
          claimAmount: result.metadata.claimAmount || '0',
          depositAddress: result.metadata.depositAddress || depositAddress,
          createdAt: Date.now(),
          status: 'pending',
          tokenImageUri: token.tokenUri,
        };
        saveTicket(ticketRef);
        console.log('[Ticket Storage] Saved ticket reference:', ticketRef);
      } catch (storageError) {
        console.error('[Ticket Storage] Failed to save ticket:', storageError);
      }
      
      // Get swap details from status response for display
      const swapAmountOut = swapStatus.receivedAmountFormatted || 
                           swapStatus.swapDetails?.amountOutFormatted || 
                           depositState.purchaseInfo?.expectedOut || '0';
      
      // Create ticket data from TEE metadata
      const ticketData: TicketData = {
        proofReference: result.metadata.proofReference,
        depositAddress: result.metadata.depositAddress,
        swapAmountIn: result.metadata.swapAmountIn,
        swapAmountOut: swapAmountOut,
        swapAmountUsd: result.metadata.swapAmountUsd,
        claimAmount: result.metadata.claimAmount,                    // FROM TEE - accurate
        claimAmountFormatted: getFormattedClaimAmount(result, token.decimals),  // FROM TEE - accurate
        createdAt: result.metadata.createdAt,
        launchId: result.metadata.launchId,
        launchPda: result.metadata.launchPda,
        tokenMint: result.metadata.tokenMint,
        tokenSymbol: result.metadata.tokenSymbol,
        pricePerToken: result.metadata.pricePerToken,
      };
      
      console.log('[TEE] Proof generated successfully:', {
        proofReference: ticketData.proofReference,
        claimAmount: ticketData.claimAmount,
        claimAmountFormatted: ticketData.claimAmountFormatted,
      });
      
      setDepositState((prev) => ({ 
        ...prev, 
        depositFlowState: 'success',
        ticketData,
        isGeneratingTicket: false,
      }));
      
      toast.success('Ticket generated successfully!');
      fetchUserBalances();
      
      // Refresh availability after ticket creation
      try {
        const updatedAvailability = await checkLaunchAvailability({
          launchId: token.name,
          amountToSell: Number(token.amountToSell),
          pricePerToken: Number(token.pricePerToken),
        });
        setDepositState((prev) => ({
          ...prev,
          availability: {
            tokensAvailable: updatedAvailability.tokensAvailable,
            totalTokensReserved: updatedAvailability.totalTokensReserved,
            amountToSell: updatedAvailability.amountToSell,
            maxUsdAvailable: updatedAvailability.maxUsdAvailable,
            isSoldOut: updatedAvailability.isSoldOut,
            ticketsCreated: updatedAvailability.ticketsCreated,
          },
        }));
      } catch (e) {
        console.error('[Availability] Failed to refresh after ticket:', e);
      }
      
    } catch (error) {
      console.error('[TEE] Error generating ticket:', error);
      toast.error(`Failed to generate ticket: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setDepositState((prev) => ({ 
        ...prev, 
        depositFlowState: 'detecting',
        isGeneratingTicket: false,
      }));
    }
  }, [token, address, publicKey, depositState.purchaseInfo, fetchUserBalances]);

  // Download ticket as ZIP file with proof data from TEE
  const downloadTicketZip = useCallback(async () => {
    if (!teeResult) {
      toast.error('No proof data to download. Please generate a ticket first.');
      return;
    }

    try {
      // Use the proper TEE download function with full proof data
      await downloadProofFromTEE(teeResult);
      toast.success('Proof ticket downloaded!');
    } catch (error) {
      console.error('Error downloading ticket:', error);
      toast.error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [teeResult]);

  // Legacy download function (fallback if TEE result not available)
  const downloadTicketZipLegacy = useCallback(async () => {
    if (!depositState.ticketData) {
      toast.error('No ticket data to download');
      return;
    }

    try {
      const { default: JSZip } = await import('jszip');
      const ticketData = depositState.ticketData;
      const zip = new JSZip();

      // Create metadata file with all claim-related info
      const metadata = {
        version: '1.0.0',
        generatedAt: ticketData.createdAt,
        proofReference: ticketData.proofReference,
        
        // Launch info
        launch: {
          id: ticketData.launchId,
          pda: ticketData.launchPda,
          tokenMint: ticketData.tokenMint,
          tokenSymbol: ticketData.tokenSymbol,
        },
        
        // Swap info
        swap: {
          depositAddress: ticketData.depositAddress,
          amountIn: ticketData.swapAmountIn,
          amountOut: ticketData.swapAmountOut,
          amountInUsd: ticketData.swapAmountUsd,
        },
        
        // Claim info - CRITICAL for claim function
        claim: {
          amount: ticketData.claimAmount,
          amountFormatted: ticketData.claimAmountFormatted,
          pricePerTokenMicroUsd: ticketData.pricePerToken,
        },

        // Note: In production, this would include actual proof data from TEE
        // proof: {
        //   proof_a: [...],
        //   proof_b: [...],
        //   proof_c: [...],
        //   public_inputs: [...],
        // }
      };

      // Add metadata JSON
      zip.file('metadata.json', JSON.stringify(metadata, null, 2));

      // Add a README for the user
      const readme = `# ZK Proof Ticket
      
## Ticket Information
- Reference: ${ticketData.proofReference}
- Created: ${ticketData.createdAt}
- Token: ${ticketData.tokenSymbol}

## Claim Details
- Tokens to Claim: ${ticketData.claimAmountFormatted} ${ticketData.tokenSymbol}
- Raw Amount: ${ticketData.claimAmount}

## Swap Details
- Deposit Address: ${ticketData.depositAddress}
- Amount Deposited: ${ticketData.swapAmountIn}
- ZEC Received: ${ticketData.swapAmountOut}
- USD Value: $${ticketData.swapAmountUsd}

## How to Claim
1. Wait for the sale to end
2. Go to the token page and click "Claim Tokens"
3. Upload this ZIP file
4. Confirm the transaction

## Important
- Keep this file safe! You need it to claim your tokens.
- Do not share this file with anyone.
- This proof can only be used once.
`;

      zip.file('README.txt', readme);

      // Generate and download the ZIP
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ticketData.proofReference}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Ticket downloaded successfully!');
    } catch (error) {
      console.error('Error downloading ticket:', error);
      toast.error('Failed to download ticket');
    }
  }, [depositState.ticketData]);

  const startStatusPolling = useCallback(
    (depositAddress: string) => {
      if (statusPollIntervalRef.current) {
        clearInterval(statusPollIntervalRef.current);
      }

      // Update state to detecting (but keep showing QR code)
      setDepositState((prev) => ({ ...prev, depositFlowState: 'detecting' }));

      statusPollIntervalRef.current = setInterval(async () => {
        try {
          const status = await checkSwapStatus(depositAddress);

          setDepositState((prev) => ({ ...prev, swapStatus: status, lastCheckedAt: Date.now() }));

          console.log(`[Swap Status] ${status.status}`, status);

          if (status.isComplete) {
            if (statusPollIntervalRef.current) {
              clearInterval(statusPollIntervalRef.current);
              statusPollIntervalRef.current = null;
            }

            if (status.isSuccess) {
              // Generate ticket from TEE
              generateTicketFromTEE(depositAddress, status);
            } else if (status.isFailed) {
              toast.error(`Swap failed with status: ${status.status}`);
              setDepositState((prev) => ({ ...prev, depositFlowState: 'detecting' }));
            } else if (status.status === 'REFUNDED') {
              toast.info('Payment was refunded to your wallet.');
              setDepositState((prev) => ({ ...prev, depositFlowState: 'detecting' }));
            } else if (status.status === 'INCOMPLETE_DEPOSIT') {
              toast.error('Incomplete deposit. Please send the exact amount.');
              setDepositState((prev) => ({ ...prev, depositFlowState: 'detecting' }));
            }
          }
        } catch (error) {
          console.error('Error polling swap status:', error);
        }
      }, 10000); // Poll every 10 seconds instead of 5 for less aggressive polling
    },
    [generateTicketFromTEE],
  );

  const handleGenerateDepositAddress = useCallback(async () => {
    if (!depositState.selectedToken) {
      toast.error('Please select a payment token');
      return;
    }
    
    if (!depositState.depositAmount || parseFloat(depositState.depositAmount) <= 0) {
      toast.error('Ticket price not calculated. Please reselect token.');
      return;
    }

    if (!depositState.zecToken) {
      toast.error('ZEC token not available. Please try again later.');
      return;
    }

    // Check availability - prevent purchase if sold out
    if (depositState.availability?.isSoldOut) {
      toast.error('This launch is sold out. No more tickets available.');
      return;
    }

    // Check if purchase exceeds available tokens (based on estimated USD value)
    if (depositState.availability && depositState.purchaseInfo?.estimatedValueUsd) {
      const maxUsdAvailable = parseFloat(depositState.availability.maxUsdAvailable || '0');
      const purchaseUsd = parseFloat(depositState.purchaseInfo.estimatedValueUsd);
      
      if (purchaseUsd > maxUsdAvailable && maxUsdAvailable > 0) {
        toast.error(`Purchase exceeds available tokens. Max: ~$${maxUsdAvailable.toFixed(2)} USD`);
        return;
      }
    }

    try {
      setDepositState((prev) => ({ ...prev, isGeneratingAddress: true }));

      // Get creator wallet from token metadata
      const creatorWallet = token.creatorWallet;

      if (!creatorWallet || creatorWallet.trim() === '') {
        toast.error('Creator wallet not found. Cannot generate deposit address.');
        setDepositState((prev) => ({ ...prev, isGeneratingAddress: false }));
        return;
      }

      // Convert amount to smallest unit
      const amountInSmallestUnit = convertToUnit(
        depositState.depositAmount,
        depositState.selectedToken.decimals,
      );

      // Get refund address for the selected blockchain
      const refundAddress = getRefundAddress(depositState.selectedBlockchain);
      if (!refundAddress) {
        toast.error('Refund address not configured for selected blockchain');
        setDepositState((prev) => ({ ...prev, isGeneratingAddress: false }));
        return;
      }

      // Calculate fee (0.5% privacy fee)
      const feeAmount = parseFloat(depositState.depositAmount) * 0.005;
      const feeBasisPoints = calculateBasisPoints(feeAmount, parseFloat(depositState.depositAmount));

      // Create swap quote
      const quote = await createSwapQuote({
        originAsset: depositState.selectedToken.assetId,
        destinationAsset: depositState.zecToken.assetId,
        amount: amountInSmallestUnit,
        recipient: creatorWallet, // Send ZEC to creator's wallet
        refundTo: refundAddress,
        appFees: [
          {
            recipient: creatorWallet,
            fee: feeBasisPoints,
          },
        ],
      });

      const purchaseInfo = {
        expectedOut: quote.quote.amountOutFormatted,
        minAmountOut: quote.quote.minAmountOut,
        timeEstimate: quote.quote.timeEstimate || 60,
        amountInUsd: quote.quote.amountInUsd,
        estimatedValueUsd: quote.quote.amountOutUsd || quote.quote.amountInUsd,
      };

      setDepositState((prev) => ({
        ...prev,
        depositAddress: quote.quote.depositAddress,
        depositMemo: quote.quote.depositMemo || null,
        purchaseInfo,
        isGeneratingAddress: false,
        depositFlowState: 'qr-code',
      }));

      startStatusPolling(quote.quote.depositAddress);

      toast.success(
        `Deposit address generated! Send ${depositState.selectedToken.symbol} to this address.`,
      );
    } catch (error) {
      console.error('Error generating deposit address:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate deposit address');
      setDepositState((prev) => ({ ...prev, isGeneratingAddress: false }));
    }
  }, [
    depositState.depositAmount,
    depositState.selectedToken,
    depositState.zecToken,
    depositState.selectedBlockchain,
    depositState.availability,
    depositState.purchaseInfo,
    token,
    startStatusPolling,
  ]);

  useEffect(() => {
    return () => {
      if (statusPollIntervalRef.current) {
        clearInterval(statusPollIntervalRef.current);
      }
    };
  }, []);

  const handleDepositAmountChange = useCallback(
    (value: string) => {
      const raw = value.replace(/,/g, '');
      if (/^\d*\.?\d*$/.test(raw)) {
        setDepositState((prev) => ({ ...prev, depositAmount: raw }));
        if (raw && parseFloat(raw) > 0) {
          fetchPurchaseInfo(raw);
        } else {
          setDepositState((prev) => ({ ...prev, purchaseInfo: null }));
        }
      }
    },
    [fetchPurchaseInfo],
  );

  const handleCopyDepositAddress = useCallback(() => {
    if (depositState.depositAddress) {
      navigator.clipboard.writeText(depositState.depositAddress);
      toast.success('Deposit address copied to clipboard');
    }
  }, [depositState.depositAddress]);

  const formatAddress = useCallback((address: string | null) => {
    if (!address) return '';
    if (address.length <= 20) return address;
    return `${address.slice(0, 10)}...${address.slice(-10)}`;
  }, []);

  // Manual status check function
  const handleManualStatusCheck = useCallback(async () => {
    if (!depositState.depositAddress) return;
    
    setDepositState((prev) => ({ ...prev, isCheckingStatus: true }));
    
    try {
      const status = await checkSwapStatus(depositState.depositAddress);
      setDepositState((prev) => ({ ...prev, swapStatus: status, lastCheckedAt: Date.now() }));
      
      if (status.isComplete && status.isSuccess) {
        // Stop polling
        if (statusPollIntervalRef.current) {
          clearInterval(statusPollIntervalRef.current);
          statusPollIntervalRef.current = null;
        }
        
        toast.success('Deposit confirmed! Generating your ticket...');
        // Generate ticket from TEE
        await generateTicketFromTEE(depositState.depositAddress, status);
      } else if (status.isComplete && status.isFailed) {
        toast.error(`Swap failed: ${status.status}`);
      } else {
        toast.info(`Status: ${status.status}. Please wait or try again in a minute.`);
      }
    } catch (error) {
      console.error('Error checking status:', error);
      toast.error('Failed to check status. Please try again.');
    } finally {
      setDepositState((prev) => ({ ...prev, isCheckingStatus: false }));
    }
  }, [depositState.depositAddress, generateTicketFromTEE]);

  // Render deposit flow states
  const renderDepositFlow = () => {
    // Show QR code with detecting indicator overlay
    if (depositState.depositFlowState === 'detecting' && depositState.depositAddress) {
      return (
        <div className="bg-neutral-950 border border-gray-800 flex flex-col gap-4 sm:gap-5 items-center px-4 sm:px-5 md:px-6 py-4 sm:py-5 w-full">
          {/* Status indicator */}
          <div className="w-full bg-[rgba(208,135,0,0.1)] border border-[#d08700] rounded p-3 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-[#d08700] animate-spin shrink-0" />
            <div className="flex-1">
              <div className="font-rajdhani font-semibold text-sm text-[#d08700]">
                DETECTING DEPOSIT...
              </div>
              <div className="font-rajdhani text-xs text-gray-400">
                {depositState.swapStatus?.status || 'Waiting for your deposit'}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center w-full">
            <div className="font-rajdhani font-semibold text-lg sm:text-xl text-white text-center w-full mb-1">
              Send Your Deposit
            </div>
            <div className="font-rajdhani font-normal text-sm text-gray-400 text-center w-full">
              Send exactly {depositState.depositAmount} {depositState.selectedToken?.symbol || ''} to the address below
            </div>
          </div>

          {/* QR Code */}
          <div className="relative w-full flex justify-center">
            <div className="border border-white/10 p-1 rounded-lg bg-white">
              <QRCodeSVG 
                value={depositState.depositAddress} 
                size={150} 
                level="M" 
                className="w-[150px] h-[150px] sm:w-[175px] sm:h-[175px]" 
              />
            </div>
          </div>

          {/* Exact Amount to Deposit */}
          <div className="w-full space-y-3">
            <div className="border-2 border-[#d08700] bg-[#d08700]/10 flex flex-col gap-2 px-3 py-3 rounded">
              <div className="font-rajdhani font-medium text-xs text-[#d08700] uppercase">
                ⚠️ Exact Amount to Deposit
              </div>
              <div className="flex items-center gap-2">
                <div className="font-rajdhani font-bold text-2xl text-white flex-1">
                  {depositState.depositAmount} {depositState.selectedToken?.symbol}
                </div>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(depositState.depositAmount);
                    toast.success('Amount copied!');
                  }}
                  className="bg-[#d08700] hover:bg-[#d08700]/80 text-black px-3 py-1.5 h-auto text-xs font-rajdhani font-bold shrink-0"
                >
                  Copy
                </Button>
              </div>
              <div className="font-rajdhani text-xs text-red-400">
                You MUST send this exact amount. Less or more may result in failed swap or refund.
              </div>
            </div>

            {/* Deposit Address - Copyable */}
            <div className="border border-white/20 bg-black/50 flex flex-col gap-2 px-3 py-3 rounded">
              <div className="font-rajdhani font-medium text-xs text-gray-500 uppercase">
                Deposit Address ({depositState.selectedToken?.symbol})
              </div>
              <div className="flex items-center gap-2">
                <div className="font-mono text-sm text-[#d08700] break-all flex-1">
                  {depositState.depositAddress}
                </div>
                <Button
                  onClick={handleCopyDepositAddress}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 h-auto text-xs font-rajdhani font-bold shrink-0"
                >
                  Copy
                </Button>
              </div>
            </div>

            {/* Purchase Info */}
            {depositState.selectedToken && (
              <div className="bg-[rgba(208,135,0,0.05)] border border-[#d08700]/30 flex flex-col gap-2 p-3 rounded text-sm">
                <div className="flex items-center justify-between text-gray-400">
                  <span>Amount</span>
                  <span className="text-white font-bold">{depositState.depositAmount} {depositState.selectedToken.symbol}</span>
                </div>
                <div className="flex items-center justify-between text-gray-400">
                  <span>You'll receive</span>
                  <span className="text-white font-bold">
                    {depositState.purchaseInfo?.expectedOut 
                      ? `~${depositState.purchaseInfo.expectedOut} ZEC`
                      : depositState.isLoadingPurchaseInfo 
                        ? 'Calculating...'
                        : '--- ZEC'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-gray-400">
                  <span>Est. USD Value</span>
                  <span className="text-white font-bold">
                    {depositState.purchaseInfo?.estimatedValueUsd 
                      ? `$${depositState.purchaseInfo.estimatedValueUsd}`
                      : depositState.isLoadingPurchaseInfo 
                        ? 'Calculating...'
                        : '---'}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={handleManualStatusCheck}
                disabled={depositState.isCheckingStatus}
                className="w-full bg-[#d08700] hover:bg-[#d08700]/90 text-black font-rajdhani font-bold py-3"
              >
                {depositState.isCheckingStatus ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  "I've Sent the Deposit - Check Status"
                )}
              </Button>
              
              <div className="font-rajdhani text-xs font-bold text-gray-500 text-center">
                Swap may take 1-10 minutes to confirm. Click above to check status.
              </div>
            </div>

            {/* Warning */}
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded">
              <p className="font-rajdhani font-semibold text-sm text-red-400">⚠️ CRITICAL - Read Before Sending</p>
              <ul className="list-disc list-inside space-y-1.5 font-rajdhani text-xs text-red-300/70 mt-2">
                <li><span className="text-white font-bold">EXACT AMOUNT:</span> You must send exactly <span className="text-[#d08700] font-bold">{depositState.depositAmount} {depositState.selectedToken?.symbol}</span></li>
                <li><span className="text-white font-bold">WRONG AMOUNT = FAILED:</span> Sending more or less will cause the swap to fail or trigger a refund</li>
                <li><span className="text-white font-bold">YOUR WALLET ONLY:</span> Only send from a wallet you control (needed for refunds)</li>
                <li><span className="text-white font-bold">STAY ON PAGE:</span> Do not close this page until your ticket is generated</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    if (depositState.depositFlowState === 'detecting') {
      // Fallback if no deposit address yet
      return (
        <div className="bg-neutral-950 border border-gray-800 flex flex-col gap-[10px] items-center justify-center px-4 sm:px-6 py-4 sm:py-5">
          <Loader2 className="w-16 h-16 sm:w-20 sm:h-20 md:w-[84px] md:h-[84px] text-[#d08700] animate-spin" />
          <div className="flex flex-col gap-2 items-center">
            <div className="font-rajdhani font-semibold text-lg sm:text-xl md:text-2xl text-[rgba(255,255,255,0.38)] uppercase text-center px-2">
              GENERATING ADDRESS...
            </div>
          </div>
        </div>
      );
    }

    if (depositState.depositFlowState === 'generating-ticket') {
      return (
        <div className="bg-neutral-950 border border-gray-800 flex flex-col gap-[10px] items-center justify-center px-4 sm:px-6 py-6 sm:py-8">
          <Loader2 className="w-16 h-16 sm:w-20 sm:h-20 md:w-[84px] md:h-[84px] text-[#d08700] animate-spin" />
          <div className="flex flex-col gap-2 items-center">
            <div className="font-rajdhani font-semibold text-lg sm:text-xl md:text-2xl text-white uppercase text-center px-2">
              GENERATING YOUR TICKET
            </div>
            <div className="font-rajdhani font-medium text-xs sm:text-sm text-gray-400 uppercase text-center px-2">
              Creating Zero-Knowledge Proof via TEE...
            </div>
            <div className="font-rajdhani text-xs text-gray-500 text-center mt-2">
              This may take a few seconds
            </div>
          </div>
        </div>
      );
    }

    if (depositState.depositFlowState === 'success') {
      const ticketInfo = depositState.ticketData;
      
      return (
        <div className="bg-neutral-950 border border-gray-800 flex flex-col gap-4 items-center justify-center px-4 sm:px-6 py-6 sm:py-8 w-full">
          <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-full h-full text-green-500" />
          </div>
          
          <div className="flex flex-col gap-2 items-center w-full max-w-[320px]">
            <div className="font-rajdhani font-semibold text-xl sm:text-2xl text-white uppercase text-center">
              TICKET GENERATED!
            </div>
            <div className="font-rajdhani font-medium text-sm text-gray-400 text-center">
              Your ZK proof ticket has been created successfully.
            </div>
          </div>

          {/* Ticket Info */}
          {ticketInfo && (
            <div className="w-full max-w-[320px] bg-[rgba(208,135,0,0.05)] border border-[#d08700]/30 rounded p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Deposit</span>
                <span className="text-white font-bold">{depositState.depositAmount} {depositState.selectedToken?.symbol}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">ZEC Received</span>
                <span className="text-white font-bold">{ticketInfo.swapAmountOut || depositState.purchaseInfo?.expectedOut || '---'} ZEC</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Tokens to Claim</span>
                <span className="text-[#d08700] font-bold">
                  {ticketInfo.claimAmountFormatted || (ticketInfo.claimAmount && ticketInfo.claimAmount !== '0' 
                    ? Number(ticketInfo.claimAmount).toLocaleString() 
                    : '---')} {token.tokenSymbol}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Proof Reference</span>
                <span className="text-white font-mono text-xs">{ticketInfo.proofReference || '---'}</span>
              </div>
            </div>
          )}

          {/* Proof File */}
          <div className="border border-dashed border-[#d08700] bg-[#d08700]/5 flex gap-2 items-center justify-center px-4 py-3 w-full max-w-[320px] rounded">
            <svg className="w-5 h-5 text-[#d08700]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="font-mono text-sm text-[#d08700] truncate">
              {ticketInfo?.proofReference || 'zk_proof'}.zip
            </div>
          </div>

          <Button
            onClick={downloadTicketZip}
            className="w-full max-w-[320px] bg-[#d08700] hover:bg-[#d08700]/90 text-black font-rajdhani font-bold py-3 text-base flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download Proof Ticket
          </Button>

          <div className="text-center max-w-[320px]">
            <p className="font-rajdhani text-xs text-gray-500">
              ⚠️ Keep your proof file safe! You'll need it to claim tokens when the sale ends.
            </p>
          </div>

          <Button
            onClick={() => {
              setDepositState((prev) => ({
                ...prev,
                depositFlowState: 'initial',
                depositAmount: '',
                depositAddress: null,
                ticketData: null,
                swapStatus: null,
              }));
            }}
            variant="outline"
            className="w-full max-w-[320px] border-gray-600 hover:bg-gray-800 h-auto py-3 font-rajdhani font-medium text-sm text-black"
          >
            Buy More Tickets
          </Button>
        </div>
      );
    }

    if (depositState.depositFlowState === 'qr-code' && depositState.depositAddress) {
      return (
        <div className="bg-neutral-950 border border-gray-800 flex flex-col gap-4 sm:gap-5 items-center px-4 sm:px-5 md:px-6 py-4 sm:py-5 w-full">
          <div className="flex flex-col items-start w-full">
            <div className="font-rajdhani font-semibold text-lg sm:text-xl text-white text-center w-full mb-1">
              Complete Your Deposit
            </div>
          </div>

          {/* Exact Amount - Most Important */}
          <div className="w-full border-2 border-[#d08700] bg-[#d08700]/10 flex flex-col gap-2 px-4 py-3 rounded">
            <div className="font-rajdhani font-medium text-xs text-[#d08700] uppercase text-center">
              ⚠️ Send This EXACT Amount
            </div>
            <div className="flex items-center justify-center gap-3">
              <div className="font-rajdhani font-bold text-2xl sm:text-3xl text-white">
                {depositState.depositAmount} {depositState.selectedToken?.symbol}
              </div>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(depositState.depositAmount);
                  toast.success('Amount copied!');
                }}
                className="bg-[#d08700] hover:bg-[#d08700]/80 text-black px-3 py-1.5 h-auto text-xs font-rajdhani font-bold shrink-0"
              >
                Copy
              </Button>
            </div>
            <div className="font-rajdhani text-xs text-red-400 text-center">
              Sending more or less will cause the swap to FAIL
            </div>
          </div>

          {/* QR Code */}
          <div className="relative w-full flex justify-center">
            <div className="border border-white/10 p-1 rounded-lg bg-white">
              <QRCodeSVG 
                value={depositState.depositAddress} 
                size={150} 
                level="M" 
                className="w-[150px] h-[150px] sm:w-[175px] sm:h-[175px]" 
              />
            </div>
          </div>

          <div className="w-full space-y-3">
            {/* Deposit Address */}
            <div className="border border-white/20 bg-black/30 flex flex-col gap-2 px-3 py-3 rounded">
              <div className="font-rajdhani font-medium text-xs text-gray-500 uppercase">
                Deposit Address ({depositState.selectedToken?.symbol || ''})
              </div>
              <div className="flex items-center gap-2">
                <div className="font-mono text-xs sm:text-sm text-[#d08700] break-all flex-1">
                  {depositState.depositAddress}
                </div>
                <Button
                  onClick={handleCopyDepositAddress}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 h-auto text-xs font-rajdhani shrink-0"
                >
                  Copy
                </Button>
              </div>
            </div>

            {depositState.selectedToken && (
              <div className="bg-black/30 border border-white/10 flex flex-col gap-2 p-3 rounded text-sm">
                <div className="flex items-center justify-between text-gray-400">
                  <span>Ticket Cost</span>
                  <span className="text-white font-bold">{depositState.depositAmount} {depositState.selectedToken.symbol}</span>
                </div>
                <div className="flex items-center justify-between text-gray-400">
                  <span>Privacy Fee (0.5%)</span>
                  <span className="text-red-400 font-bold">
                    {(parseFloat(depositState.depositAmount || '0') * 0.005).toFixed(4)} {depositState.selectedToken.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between text-gray-400">
                  <span>You'll Receive</span>
                  <span className="text-white font-bold">
                    {depositState.purchaseInfo?.expectedOut 
                      ? `~${depositState.purchaseInfo.expectedOut} ZEC`
                      : '--- ZEC'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-gray-400">
                  <span>Est. USD Value</span>
                  <span className="text-white font-bold">
                    {depositState.purchaseInfo?.estimatedValueUsd 
                      ? `$${depositState.purchaseInfo.estimatedValueUsd}`
                      : '---'}
                  </span>
                </div>
              </div>
            )}

            {/* Critical Warning */}
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded">
              <p className="font-rajdhani font-semibold text-sm text-red-400">⚠️ CRITICAL - Before You Send</p>
              <ul className="list-disc list-inside space-y-1 font-rajdhani text-xs text-red-300/70 mt-2">
                <li><span className="text-white font-bold">EXACT AMOUNT:</span> Send exactly <span className="text-[#d08700] font-bold">{depositState.depositAmount} {depositState.selectedToken?.symbol}</span></li>
                <li><span className="text-white font-bold">WRONG AMOUNT = FAILED:</span> More or less will fail the swap</li>
                <li><span className="text-white font-bold">YOUR WALLET:</span> Only send from a wallet you control</li>
                <li><span className="text-white font-bold">ONE-TIME ADDRESS:</span> This address expires after use</li>
              </ul>
            </div>

            <div className="font-rajdhani font-normal text-xs text-gray-500 text-center">
              Est. swap time: ~{depositState.purchaseInfo?.timeEstimate || 60} seconds
            </div>
          </div>
        </div>
      );
    }

    // Format claim period start date
  const formatClaimPeriodDate = (endTime: bigint) => {
    const date = new Date(Number(endTime) * 1000);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const isSaleActive = () => {
    if (!token.startTime || !token.endTime) return false;
    
    const now = Date.now();
    const startTime = Number(token.startTime) * 1000;
    const endTime = Number(token.endTime) * 1000;
    
    return now >= startTime && now <= endTime;
  };

  const isSaleEnded = () => {
    if (!token.endTime) return false;
    const now = Date.now();
    const endTime = Number(token.endTime) * 1000;
    return now > endTime;
  };

  const shouldShowNotification = isSaleActive();
  const saleHasEnded = isSaleEnded();

  // Get unique blockchains for dropdown
  const uniqueBlockchains = getUniqueBlockchains(depositState.availableTokens);

  // Get filtered tokens for selected blockchain
  const filteredTokens = getTokensByBlockchain(
    depositState.availableTokens,
    depositState.selectedBlockchain,
  );

  return (
      <div className="w-full flex flex-col gap-5">
        {shouldShowNotification && (
          <div className="bg-[rgba(208,135,0,0.05)] border border-[#d08700] flex gap-2 sm:gap-3 items-start p-3 sm:p-4 w-full">
            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#d08700] shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="font-rajdhani font-bold text-sm sm:text-base text-[#d08700] leading-[1.3]">
                Claim Period Opens {formatClaimPeriodDate(token.endTime)}
              </div>
              <p className="font-rajdhani font-normal text-xs sm:text-sm md:text-base text-[#ded8e1] leading-5 sm:leading-6">
                You are generating a Private Ticket. Tokens will be redeemable after the sale ends
                using your downloaded proof.
              </p>
            </div>
          </div>
        )}

        {/* Token Selection Dropdown - Only show if sale not ended */}
        {!saleHasEnded && (
        <>
      
        {/* {depositState.availability && (
          <div className={`border rounded-lg p-3 ${
            depositState.availability.isSoldOut 
              ? 'bg-red-500/10 border-red-500/50' 
              : 'bg-[rgba(208,135,0,0.05)] border-[#d08700]/30'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {depositState.availability.isSoldOut ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="font-rajdhani font-bold text-sm text-red-500">SOLD OUT</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-rajdhani font-medium text-sm text-green-400">TICKETS AVAILABLE</span>
                  </>
                )}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs">
                <div className="font-rajdhani text-gray-400">
                  <span className="text-white font-bold">
                    {((depositState.availability.tokensAvailable || 0) / Math.pow(10, token.decimals || 9)).toLocaleString()}
                  </span>
                  {' / '}
                  {((depositState.availability.amountToSell || 0) / Math.pow(10, token.decimals || 9)).toLocaleString()}
                  {' tokens remaining'}
                </div>
                <div className="font-rajdhani text-gray-400">
                  <span className="text-[#d08700] font-bold">{depositState.availability.ticketsCreated}</span>
                  {' tickets created'}
                </div>
              </div>
            </div>
            {!depositState.availability.isSoldOut && depositState.availability.maxUsdAvailable && (
              <div className="mt-2 font-rajdhani text-xs text-gray-500">
                Max purchase: ~${parseFloat(depositState.availability.maxUsdAvailable).toFixed(2)} USD
              </div>
            )}
          </div>
        )}
        {depositState.loadingAvailability && (
          <div className="bg-[rgba(208,135,0,0.05)] border border-[#d08700]/30 rounded-lg p-3 flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-[#d08700] animate-spin" />
            <span className="font-rajdhani text-sm text-gray-400">Checking availability...</span>
          </div>
        )} */}

        <div className="flex flex-col w-full gap-3">
          <div className="font-rajdhani font-medium text-xs sm:text-sm md:text-[15px] text-[rgba(255,255,255,0.65)] uppercase">
            Select Payment Token
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            {/* Blockchain Selector */}
            <div className="relative flex-1">
              <button
                onClick={() =>
                  setDepositState((prev) => ({
                    ...prev,
                    showBlockchainDropdown: !prev.showBlockchainDropdown,
                    showTokenDropdown: false,
                  }))
                }
                className="w-full bg-[#131313] border border-[#393939] flex gap-2 items-center justify-between px-3 py-2 sm:py-2.5 rounded-lg hover:bg-[#1a1a1a] transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {depositState.selectedBlockchain !== 'Chain' && (
                    <img
                      src={getChainIcon(depositState.selectedBlockchain)}
                      alt={depositState.selectedBlockchain}
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded-full shrink-0 object-cover"
                    />
                  )}
                  <span className="font-rajdhani font-semibold text-xs sm:text-sm md:text-[15px] text-white truncate">
                    {depositState.selectedBlockchain === 'Chain'
                      ? 'Select Chain'
                      : capitalizeAll(depositState.selectedBlockchain)}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 shrink-0" />
              </button>

              {depositState.showBlockchainDropdown && (
                <div className="absolute top-full mt-1 w-full bg-[#1a1a1a] border border-[#393939] rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                  {depositState.loadingTokens ? (
                    <div className="p-3 sm:p-4 text-center text-xs sm:text-sm text-gray-400">Loading...</div>
                  ) : (
                    uniqueBlockchains.map((blockchain) => (
                      <button
                        key={blockchain}
                        onClick={() => {
                          setDepositState((prev) => ({
                            ...prev,
                            selectedBlockchain: blockchain,
                            selectedToken: null,
                            showBlockchainDropdown: false,
                            depositAmount: '',
                            purchaseInfo: null,
                          }));
                        }}
                        className="w-full px-3 py-2 text-left font-rajdhani text-sm sm:text-[15px] text-white hover:bg-[#262626] transition-colors flex items-center gap-2"
                      >
                        <img
                          src={getChainIcon(blockchain)}
                          alt={blockchain}
                          className="w-4 h-4 sm:w-5 sm:h-5 rounded-full shrink-0 object-cover"
                        />
                        <span>{capitalizeAll(blockchain)}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Token Selector */}
            <div className="relative flex-1">
              <button
                onClick={() =>
                  setDepositState((prev) => ({
                    ...prev,
                    showTokenDropdown: !prev.showTokenDropdown,
                    showBlockchainDropdown: false,
                  }))
                }
                disabled={depositState.selectedBlockchain === 'Chain'}
                className={`w-full bg-[#131313] border border-[#393939] flex gap-2 items-center justify-between px-3 py-2 sm:py-2.5 rounded-lg transition-colors ${
                  depositState.selectedBlockchain === 'Chain'
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-[#1a1a1a] cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {depositState.selectedToken && (
                    <img
                      src={getOneClickTokenIcon(depositState.selectedToken)}
                      alt={depositState.selectedToken.symbol}
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded-full shrink-0 object-cover"
                    />
                  )}
                  <span className="font-rajdhani font-semibold text-xs sm:text-sm md:text-[15px] text-white truncate">
                    {depositState.selectedToken
                      ? depositState.selectedToken.symbol
                      : 'Select Token'}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 shrink-0" />
              </button>

              {depositState.showTokenDropdown && (
                <div className="absolute top-full mt-1 w-full bg-[#1a1a1a] border border-[#393939] rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                  {filteredTokens.length === 0 ? (
                    <div className="p-3 sm:p-4 text-center text-xs sm:text-sm text-gray-400">No tokens available</div>
                  ) : (
                    filteredTokens.map((tkn) => (
                      <button
                        key={tkn.assetId}
                        onClick={() => {
                          // Calculate ticket price in selected token
                          const ticketPriceUsd = Number(token.pricePerTicket) / 1_000_000;
                          const ticketPriceInToken = ticketPriceUsd / tkn.price;
                          const formattedAmount = ticketPriceInToken.toFixed(8);
                          
                          setDepositState((prev) => ({
                            ...prev,
                            selectedToken: tkn,
                            showTokenDropdown: false,
                            depositAmount: formattedAmount,
                            purchaseInfo: null,
                          }));
                          
                          // Trigger quote calculation
                          handleDepositAmountChange(formattedAmount);
                        }}
                        className="w-full px-3 py-2 text-left font-rajdhani text-sm sm:text-[15px] text-white hover:bg-[#262626] transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <img
                              src={getOneClickTokenIcon(tkn)}
                              alt={tkn.symbol}
                              className="w-4 h-4 sm:w-5 sm:h-5 rounded-full shrink-0 object-cover"
                            />
                            <span className="truncate">{tkn.symbol}</span>
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">
                            ${tkn.price.toFixed(2)}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col w-full">
          <div className="border border-white/12 h-[120px] sm:h-[135px] overflow-hidden relative rounded-t-xl bg-black/20">
            <div className="absolute inset-0 flex items-center justify-between px-3 sm:px-4 gap-2 sm:gap-4">
              <div className="flex flex-col gap-1.5 sm:gap-2 flex-1 min-w-0">
                <div className="font-rajdhani font-medium text-xs sm:text-sm md:text-[15px] text-[rgba(255,255,255,0.65)] uppercase">
                  TICKET PRICE
                </div>
                <input
                  type="text"
                  value={depositState.depositAmount}
                  readOnly
                  className="w-full text-2xl sm:text-3xl md:text-[36px] font-rajdhani font-medium bg-transparent border-none focus:ring-0 focus:outline-none text-white placeholder:text-[rgba(255,255,255,0.38)] h-auto p-0 cursor-default"
                  placeholder={depositState.selectedToken ? '0' : 'Select token above'}
                />
                <div className="h-[16px] sm:h-[18px] bg-[#d08700]/10 rounded-full px-2 flex items-center w-fit">
                  <span className="font-rajdhani font-medium text-[11px] sm:text-xs md:text-[13px] text-[#d08700]">
                    1 Ticket = ${(Number(token.pricePerTicket) / 1_000_000).toFixed(2)} USD
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-3 items-center shrink-0">
                <div className="bg-[#131313] border border-[#393939] flex gap-1.5 sm:gap-2 items-center justify-center pl-1.5 sm:pl-2 pr-2 sm:pr-3 py-1.5 sm:py-2 rounded-full shadow-[0px_0px_10px_0px_rgba(255,255,255,0.04)]">
                  {depositState.selectedToken && (
                    <>
                      <div className="bg-white rounded-full p-0.5 sm:p-1 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center overflow-hidden shrink-0">
                        <img
                          src={getOneClickTokenIcon(depositState.selectedToken)}
                          alt={depositState.selectedToken.symbol}
                          className="w-full h-full object-cover rounded-full"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-rajdhani font-semibold text-xs sm:text-sm md:text-[15px] text-white whitespace-nowrap">
                          {depositState.selectedToken.symbol}
                        </span>
                      </div>
                    </>
                  )}
                  {!depositState.selectedToken && (
                    <span className="font-rajdhani font-semibold text-xs sm:text-sm md:text-[15px] text-gray-400 whitespace-nowrap">
                      Select Token
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="border-l border-r border-b border-white/12 h-[115px] sm:h-[125px] relative rounded-b-xl bg-black/20">
            <div className="absolute inset-0 flex items-center justify-between px-3 sm:px-4 gap-2 sm:gap-4">
              <div className="flex flex-col gap-1.5 sm:gap-2 flex-1 min-w-0">
                <div className="font-rajdhani font-medium text-xs sm:text-sm md:text-[15px] text-[rgba(255,255,255,0.65)] uppercase">
                  YOU'LL RECEIVE
                </div>
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={formatBalance(Number(token.tokensPerProof) / Math.pow(10, token.decimals), 4)}
                    className="w-full text-2xl sm:text-3xl md:text-[36px] font-rajdhani font-medium bg-transparent border-none focus:ring-0 focus:outline-none text-white placeholder:text-[rgba(255,255,255,0.38)] h-auto p-0 cursor-default"
                    placeholder="0"
                    readOnly
                  />
                  <div className="bg-[#131313] border border-[#393939] flex gap-1.5 sm:gap-2 items-center justify-center pl-1.5 sm:pl-2 pr-2 sm:pr-3 py-1.5 sm:py-2 rounded-full shadow-[0px_0px_10px_0px_rgba(255,255,255,0.04)] shrink-0">
                    <div className="bg-[#301342] rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center overflow-hidden shrink-0">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={getTokenSymbol() as string}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-white font-bold">
                          {(getTokenSymbol() as string)?.charAt(0) || '?'}
                        </span>
                      )}
                    </div>
                    <span className="font-rajdhani font-semibold text-xs sm:text-sm md:text-[15px] text-white whitespace-nowrap">
                      {getTokenSymbol() as string}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full flex flex-col gap-3">
          <div className="border-b border-gray-800 pb-2 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs sm:text-sm text-[#79767d]">
              <div className="font-rajdhani font-normal">Tokens Per Ticket</div>
              <div className="font-rajdhani font-semibold text-xs sm:text-sm text-[#d08700]">
                {formatBalance(Number(token.tokensPerProof) / Math.pow(10, token.decimals), 4)} {getTokenSymbol() as string}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="font-rajdhani font-normal text-xs sm:text-sm text-[#79767d]">
                Ticket Price
              </div>
              <div className="font-rajdhani font-semibold text-xs sm:text-sm text-white">
                {depositState.selectedToken
                  ? `${depositState.depositAmount} ${depositState.selectedToken.symbol}`
                  : `$${(Number(token.pricePerTicket) / 1_000_000).toFixed(2)} USD`}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="font-rajdhani font-bold text-xs sm:text-sm text-[#79767d] uppercase">
              TOTAL TICKETS
            </div>
            <div className="font-rajdhani font-bold text-sm sm:text-base md:text-[18px] text-[#d08700] leading-tight sm:leading-[28px]">
              {Number(token.totalTickets).toLocaleString()}
            </div>
          </div>
          {depositState.availability && (
            <div className="flex items-center justify-between gap-2 border-t border-gray-800 pt-2 mt-1">
              <div className="font-rajdhani font-bold text-xs sm:text-sm text-[#79767d] uppercase">
                TICKETS LEFT
              </div>
              <div className={`font-rajdhani font-bold text-sm sm:text-base md:text-[18px] leading-tight sm:leading-[28px] ${
                depositState.availability.isSoldOut ? 'text-red-500' : 'text-green-500'
              }`}>
                {depositState.availability.isSoldOut 
                  ? 'SOLD OUT' 
                  : Math.max(0, Number(token.totalTickets) - (depositState.availability.ticketsCreated || 0)).toLocaleString()
                }
              </div>
            </div>
          )}
        </div>

        <Button
          onClick={handleGenerateDepositAddress}
          disabled={
            !depositState.depositAmount ||
            parseFloat(depositState.depositAmount) <= 0 ||
            depositState.isGeneratingAddress ||
            !depositState.selectedToken ||
            !depositState.zecToken ||
            depositState.availability?.isSoldOut
          }
          className={`w-full ${
            depositState.availability?.isSoldOut
              ? 'bg-red-500/20 hover:bg-red-500/20 text-red-400 cursor-not-allowed'
              : depositState.depositAmount &&
                parseFloat(depositState.depositAmount) > 0 &&
                depositState.selectedToken &&
                depositState.zecToken &&
                !depositState.isGeneratingAddress
                ? 'bg-[#d08700] hover:bg-[#d08700]/90 cursor-pointer'
                : 'bg-[rgba(208,135,0,0.15)] hover:bg-[rgba(208,135,0,0.15)] text-[#fdead7] cursor-not-allowed'
          } text-black font-rajdhani font-bold text-sm sm:text-base md:text-[16px] py-3 sm:py-[13px] h-auto rounded-none`}
        >
          {depositState.availability?.isSoldOut ? (
            <span className="text-xs sm:text-sm md:text-base">SOLD OUT</span>
          ) : depositState.isGeneratingAddress ? (
            <>
              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 animate-spin inline" />
              <span className="text-xs sm:text-sm md:text-base">Generating Address...</span>
            </>
          ) : !depositState.selectedToken ? (
            <span className="text-xs sm:text-sm md:text-base">Select Payment Token</span>
          ) : (
            <span className="text-xs sm:text-sm md:text-base">GET TICKET</span>
          )}
        </Button>

        <div className="font-rajdhani font-normal text-xs sm:text-sm md:text-[14px] text-[#79767d] text-center w-full px-2">
          Powered by 1Click Bridge & Zcash Shielded Pools
        </div>
        </>
        )}
      </div>
    );
  };

  return (
    <div className="bg-neutral-950 border border-gray-800 flex flex-col gap-4 sm:gap-5 items-center justify-center px-4 sm:px-5 md:px-6 py-4 sm:py-5 relative shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] w-full">
      {renderDepositFlow()}
    </div>
  );
}

export const TradingInterface = memo(TradingInterfaceComponent);
