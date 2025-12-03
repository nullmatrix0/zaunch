'use client';

import { Button } from '@/components/ui/button';
import { Token } from '@/types/token';

import { ChevronDown, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
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
  nearTxHash: string | null;
  depositFlowState: 'initial' | 'qr-code' | 'detecting' | 'batching' | 'success';
  // Token selection
  availableTokens: OneClickToken[];
  selectedBlockchain: string;
  selectedToken: OneClickToken | null;
  loadingTokens: boolean;
  showBlockchainDropdown: boolean;
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
    nearTxHash: null,
    depositFlowState: 'initial',
    // Token selection
    availableTokens: [],
    selectedBlockchain: 'Chain',
    selectedToken: null,
    loadingTokens: true,
    showBlockchainDropdown: false,
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
        const amountInUsd = parseFloat(amount) * depositState.selectedToken.price;
        const pricePerTokenInSol = Number(token.pricePerToken) / 1_000_000_000; // Convert from lamports
        const solPrice = await getSolPrice();
        const pricePerTokenInUsd = pricePerTokenInSol * (solPrice || 0);
        const tokensToReceive = pricePerTokenInUsd > 0 ? amountInUsd / pricePerTokenInUsd : 0;

        const purchaseInfo = {
          expectedOut: quote.quote.expectedReceiveAmount,
          minAmountOut: quote.quote.minReceiveAmount,
          timeEstimate: quote.quote.estimatedTimeSeconds,
          slippageBps: quote.quote.slippageBps,
          estimatedValueUsd: quote.quote.estimatedValueUsd,
          tokensToReceive: tokensToReceive.toString(),
        };

        setDepositState((prev) => ({ ...prev, purchaseInfo, isLoadingPurchaseInfo: false }));
      } catch (error) {
        console.error('Error fetching purchase info:', error);
        toast.error('Failed to fetch swap quote. Please try again.');
        setDepositState((prev) => ({ ...prev, purchaseInfo: null, isLoadingPurchaseInfo: false }));
      }
    },
    [token, depositState.selectedToken, depositState.zecToken, depositState.selectedBlockchain],
  );

  const startStatusPolling = useCallback(
    (depositAddress: string) => {
      if (statusPollIntervalRef.current) {
        clearInterval(statusPollIntervalRef.current);
      }

      // Update state to detecting
      setDepositState((prev) => ({ ...prev, depositFlowState: 'detecting' }));

      statusPollIntervalRef.current = setInterval(async () => {
        try {
          const status = await checkSwapStatus(depositAddress);

          setDepositState((prev) => ({ ...prev, swapStatus: status }));

          console.log(`[Swap Status] ${status.status}`, status);

          if (status.isComplete) {
            if (statusPollIntervalRef.current) {
              clearInterval(statusPollIntervalRef.current);
              statusPollIntervalRef.current = null;
            }

            if (status.isSuccess) {
              // Update to batching state, then success
              setDepositState((prev) => ({ ...prev, depositFlowState: 'batching' }));

              // Simulate batching delay, then show success
              setTimeout(() => {
                setDepositState((prev) => ({ ...prev, depositFlowState: 'success' }));
                toast.success(
                  `Successfully swapped to ZEC! ${status.receivedAmountFormatted || ''} ZEC sent to creator.`,
                );
                fetchUserBalances();
              }, 2000);
            } else if (status.isFailed) {
              toast.error(`Swap failed with status: ${status.status}`);
              setDepositState((prev) => ({ ...prev, depositFlowState: 'qr-code' }));
            } else if (status.status === 'REFUNDED') {
              toast.info('Payment was refunded to your wallet.');
              setDepositState((prev) => ({ ...prev, depositFlowState: 'qr-code' }));
            } else if (status.status === 'INCOMPLETE_DEPOSIT') {
              toast.error('Incomplete deposit. Please send the exact amount.');
              setDepositState((prev) => ({ ...prev, depositFlowState: 'qr-code' }));
            }
          }
        } catch (error) {
          console.error('Error polling swap status:', error);
        }
      }, 5000);
    },
    [fetchUserBalances],
  );

  const handleGenerateDepositAddress = useCallback(async () => {
    if (!depositState.depositAmount || parseFloat(depositState.depositAmount) <= 0) {
      toast.error('Please enter an amount to deposit');
      return;
    }

    if (!depositState.selectedToken) {
      toast.error('Please select a token to swap from');
      return;
    }

    if (!depositState.zecToken) {
      toast.error('ZEC token not available. Please try again later.');
      return;
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
        expectedOut: quote.quote.expectedReceiveAmount,
        minAmountOut: quote.quote.minReceiveAmount,
        timeEstimate: quote.quote.estimatedTimeSeconds,
        slippageBps: quote.quote.slippageBps,
        estimatedValueUsd: quote.quote.estimatedValueUsd,
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

  // Render deposit flow states
  const renderDepositFlow = () => {
    if (depositState.depositFlowState === 'detecting') {
      return (
        <div className="bg-neutral-950 border border-gray-800 flex flex-col gap-[10px] items-center justify-center px-4 sm:px-6 py-4 sm:py-5">
          <Loader2 className="w-16 h-16 sm:w-20 sm:h-20 md:w-[84px] md:h-[84px] text-[#d08700] animate-spin" />
          <div className="flex flex-col gap-2 items-center">
            <div className="font-rajdhani font-semibold text-lg sm:text-xl md:text-2xl text-[rgba(255,255,255,0.38)] uppercase text-center px-2">
              DETECTING DEPOSIT....
            </div>
            <div className="font-rajdhani font-medium text-xs sm:text-sm text-[rgba(255,255,255,0.65)] uppercase text-center px-2">
              Waiting for block confirmation
            </div>
          </div>
        </div>
      );
    }

    if (depositState.depositFlowState === 'batching') {
      return (
        <div className="bg-neutral-950 border border-gray-800 flex flex-col gap-[10px] items-center justify-center px-4 sm:px-6 py-4 sm:py-5">
          <Loader2 className="w-16 h-16 sm:w-20 sm:h-20 md:w-[84px] md:h-[84px] text-[#d08700] animate-spin" />
          <div className="flex flex-col gap-2 items-center">
            <div className="font-rajdhani font-semibold text-lg sm:text-xl md:text-2xl text-[rgba(255,255,255,0.38)] uppercase text-center px-2">
              batching & shielding
            </div>
            <div className="font-rajdhani font-medium text-xs sm:text-sm text-[rgba(255,255,255,0.65)] uppercase text-center px-2">
              Generating Zero-Knowledge PROOF
            </div>
          </div>
        </div>
      );
    }

    if (depositState.depositFlowState === 'success') {
      return (
        <div className="bg-neutral-950 border border-gray-800 flex flex-col gap-[14px] items-center justify-center px-4 sm:px-6 py-6 sm:py-8 md:py-[50px] w-full">
          <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-[84px] md:h-[84px] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-full h-full text-[#d08700]" />
          </div>
          <div className="flex flex-col gap-2 items-start w-full max-w-[295px] px-2">
            <div className="font-rajdhani font-semibold text-lg sm:text-xl md:text-2xl text-[rgba(255,255,255,0.95)] uppercase text-center w-full">
              PURCHASE SUCCESSFUL
            </div>
            <div className="font-rajdhani font-medium text-xs sm:text-sm text-[rgba(255,255,255,0.65)] text-center w-full">
              Your deposit has been batched. You hold{' '}
              <span className="font-bold text-sm sm:text-base text-white">123,000 anonymous Tickets.</span>
            </div>
            <div className="font-rajdhani font-medium text-xs sm:text-sm text-[rgba(255,255,255,0.39)] text-center w-full">
              Keep your proof file safe. You will need it to claim token when the sale ends.
            </div>
          </div>
          <div className="border border-dashed border-white flex gap-[10px] items-center justify-center px-4 sm:px-6 md:px-[54px] py-3 sm:py-4 md:py-[15px] w-full max-w-[295px]">
            <div className="font-rajdhani font-medium text-sm sm:text-base text-center text-white truncate">
              zk_proof_acq9spwvqr38.zip
            </div>
          </div>
          <Button
            onClick={() => {
              // Download proof functionality
              toast.info('Proof download functionality coming soon');
            }}
            className="w-full max-w-[295px] bg-[#d08700] hover:bg-[#d08700]/90 text-black font-rajdhani font-bold py-3 sm:py-[13px] text-sm sm:text-base"
          >
            Download Proof Key
          </Button>
          <Button
            onClick={() => {
              setDepositState((prev) => ({
                ...prev,
                depositFlowState: 'initial',
                depositAmount: '',
                depositAddress: null,
              }));
            }}
            variant="outline"
            className="w-full max-w-[295px] border-[#79767d] h-auto py-3 sm:py-4 md:h-[55px] font-rajdhani font-medium text-xs sm:text-sm text-[rgba(255,255,255,0.65)]"
          >
            Buy more Tickets
          </Button>
        </div>
      );
    }

    if (depositState.depositFlowState === 'qr-code' && depositState.depositAddress) {
      return (
        <div className="bg-neutral-950 border border-gray-800 flex flex-col gap-4 sm:gap-5 items-center px-4 sm:px-5 md:px-6 py-4 sm:py-5 w-full">
          <div className="flex flex-col items-start w-full">
            <div className="font-rajdhani font-semibold text-lg sm:text-xl text-white text-center w-full mb-1">
              Scan QR Code to Deposit
            </div>
            <div className="font-rajdhani font-normal text-sm sm:text-base text-white text-center w-full">
              Send {depositState.depositAmount} {depositState.selectedToken?.symbol || ''} to the address
              below
            </div>
          </div>

          <div className="relative w-full flex justify-center">
            <div className="border border-white/10 p-1 rounded-lg bg-white">
              <QRCodeSVG 
                value={depositState.depositAddress} 
                size={150} 
                level="M" 
                className="w-[150px] h-[150px] sm:w-[175px] sm:h-[175px]" 
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white rounded-full p-1.5 sm:p-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full" />
              </div>
            </div>
          </div>

          <div className="w-full space-y-3">
            <div className="border border-white/12 flex flex-col gap-[10px] px-3 py-2">
              <div className="font-rajdhani font-medium text-[15px] text-[rgba(255,255,255,0.65)]">
                DEPOSIT ADDRESS ({depositState.selectedToken?.symbol || ''})
              </div>
              <div className="flex items-center justify-between">
                <div className="font-rajdhani font-semibold text-xl text-[#d08700]">
                  {formatAddress(depositState.depositAddress)}
                </div>
                <Button
                  onClick={handleCopyDepositAddress}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-2 py-1 h-auto text-xs font-rajdhani"
                >
                  Copy
                </Button>
              </div>
            </div>

            {depositState.purchaseInfo && depositState.selectedToken && (
              <div className="bg-[rgba(208,135,0,0.01)] border border-[#d08700] flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between text-sm text-[#79767d]">
                  <div className="font-rajdhani font-normal">TICKET COST</div>
                  <div className="font-rajdhani font-bold">
                    {depositState.depositAmount} {depositState.selectedToken.symbol}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-[#79767d]">
                  <div className="font-rajdhani font-normal">PRIVACY FEE (0.5%)</div>
                  <div className="font-rajdhani font-bold text-[#b3261e]">
                    {(parseFloat(depositState.depositAmount) * 0.005).toFixed(4)}{' '}
                    {depositState.selectedToken.symbol}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-[#79767d]">
                  <div className="font-rajdhani font-normal">YOU WILL RECEIVE</div>
                  <div className="font-rajdhani font-bold">
                    ~{depositState.purchaseInfo.expectedOut} ZEC
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-[#79767d]">
                  <div className="font-rajdhani font-normal">EST. VALUE</div>
                  <div className="font-rajdhani font-bold">
                    ${depositState.purchaseInfo.estimatedValueUsd}
                  </div>
                </div>
                <div className="border-t border-[rgba(208,135,0,0.15)] pt-1 flex items-center justify-between">
                  <div className="font-rajdhani font-bold text-base text-[#d08700]">
                    TOTAL PAYABLE
                  </div>
                  <div className="font-rajdhani font-bold text-base text-white">
                    {depositState.depositAmount} {depositState.selectedToken.symbol}
                  </div>
                </div>
              </div>
            )}

            {depositState.nearTxHash && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5">
                    <div className="w-5 h-5 rounded-full bg-[#d08700] animate-pulse" />
                  </div>
                  <div className="font-rajdhani font-semibold text-base text-[#d08700]">
                    LISTENING FOR DEPOSIT..........(5S)
                  </div>
                </div>
              </div>
            )}

            {depositState.nearTxHash && (
              <div className="bg-stone-900 h-4 w-full overflow-hidden">
                <div className="bg-[#d08700] h-full w-[40%] transition-all duration-500" />
              </div>
            )}

            <div className="font-rajdhani font-normal text-sm text-[#79767d] text-center">
              Do not close this window. Ticket generates automatically upon detection
            </div>

            <div className="bg-[rgba(208,135,0,0.05)] border border-[#d08700] flex flex-col gap-3 p-4">
              <p className="font-rajdhani font-semibold text-base text-[#d08700]">Heads up!</p>
              <ul className="list-disc list-inside space-y-1 font-rajdhani font-normal text-sm text-[#79767d]">
                <li>
                  Send exactly {depositState.depositAmount} {depositState.selectedToken?.symbol || ''}{' '}
                  to the address above.
                </li>
                <li>
                  The amount will be automatically swapped to ZEC and sent to the creator's wallet.
                </li>
                <li>Only send from a wallet you control.</li>
                <li>This address is only valid for this specific transaction.</li>
                <li>Estimated swap time: ~{depositState.purchaseInfo?.timeEstimate || 0} seconds</li>
              </ul>
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

  const shouldShowNotification = isSaleActive();

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

        {/* Token Selection Dropdown */}
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
                    filteredTokens.map((token) => (
                      <button
                        key={token.assetId}
                        onClick={() => {
                          setDepositState((prev) => ({
                            ...prev,
                            selectedToken: token,
                            showTokenDropdown: false,
                            depositAmount: '',
                            purchaseInfo: null,
                          }));
                        }}
                        className="w-full px-3 py-2 text-left font-rajdhani text-sm sm:text-[15px] text-white hover:bg-[#262626] transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <img
                              src={getOneClickTokenIcon(token)}
                              alt={token.symbol}
                              className="w-4 h-4 sm:w-5 sm:h-5 rounded-full shrink-0 object-cover"
                            />
                            <span className="truncate">{token.symbol}</span>
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">
                            ${token.price.toFixed(2)}
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
                  PAY WITH
                </div>
                <input
                  type="text"
                  value={depositState.depositAmount}
                  onChange={(e) => handleDepositAmountChange(e.target.value)}
                  onBlur={() => {
                    if (depositState.depositAmount) {
                      const formatted = parseFloat(depositState.depositAmount).toLocaleString(
                        'en-US',
                        {
                          maximumFractionDigits: MAX_FRACTION_DIGITS,
                        },
                      );
                      setDepositState((prev) => ({ ...prev, depositAmount: formatted }));
                    }
                  }}
                  className="w-full text-2xl sm:text-3xl md:text-[36px] font-rajdhani font-medium bg-transparent border-none focus:ring-0 focus:outline-none text-white placeholder:text-[rgba(255,255,255,0.38)] h-auto p-0"
                  placeholder="0"
                  inputMode="decimal"
                />
                <div className="h-[16px] sm:h-[18px] bg-white/5 rounded-full px-2 flex items-center w-fit">
                  <span className="font-rajdhani font-medium text-[11px] sm:text-xs md:text-[13px] text-[rgba(255,255,255,0.65)]">
                    {depositState.depositAmount && parseFloat(depositState.depositAmount) > 0 && depositState.selectedToken
                      ? `$${(parseFloat(depositState.depositAmount) * depositState.selectedToken.price).toFixed(2)}`
                      : '$0'}
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
                  RECEIVE
                </div>
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={
                      depositState.purchaseInfo && depositState.purchaseInfo.tokensToReceive
                        ? formatBalance(parseFloat(depositState.purchaseInfo.tokensToReceive || '0'), 4)
                        : '0'
                    }
                    className="w-full text-2xl sm:text-3xl md:text-[36px] font-rajdhani font-medium bg-transparent border-none focus:ring-0 focus:outline-none text-white placeholder:text-[rgba(255,255,255,0.38)] h-auto p-0"
                    placeholder="0"
                    disabled
                  />
                  <div className="bg-[#131313] border border-[#393939] flex gap-1.5 sm:gap-2 items-center justify-center pl-1.5 sm:pl-2 pr-2 sm:pr-3 py-1.5 sm:py-2 rounded-full shadow-[0px_0px_10px_0px_rgba(255,255,255,0.04)] shrink-0">
                    <div className="bg-[#301342] rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center overflow-hidden shrink-0">
                      <img
                        src={imageUrl || ''}
                        alt={getTokenSymbol() as string}
                        className="w-full h-full object-cover"
                      />
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
              <div className="font-rajdhani font-normal">Ticket Size</div>
              <div className="font-rajdhani font-semibold text-xs sm:text-sm text-[#d08700]">SINGLE UNIT (1.0)</div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="font-rajdhani font-bold text-xs sm:text-sm text-[#79767d] uppercase">
                PAYABLE AMOUNT
              </div>
              <div className="font-rajdhani font-bold text-sm sm:text-base md:text-[18px] text-[#79767d] leading-tight sm:leading-[28px] text-right break-words">
                {depositState.depositAmount && depositState.selectedToken
                  ? `${depositState.depositAmount} ${depositState.selectedToken.symbol}`
                  : '0'}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="font-rajdhani font-bold text-xs sm:text-sm text-[#79767d] uppercase">
              TICKETS GENERATED
            </div>
            <div className="font-rajdhani font-bold text-sm sm:text-base md:text-[18px] text-[#79767d] leading-tight sm:leading-[28px]">
              1 TICKET
            </div>
          </div>
        </div>

        <Button
          onClick={handleGenerateDepositAddress}
          disabled={
            !depositState.depositAmount ||
            parseFloat(depositState.depositAmount) <= 0 ||
            depositState.isGeneratingAddress ||
            !depositState.selectedToken ||
            !depositState.zecToken
          }
          className={`w-full ${
            depositState.depositAmount &&
            parseFloat(depositState.depositAmount) > 0 &&
            depositState.selectedToken &&
            depositState.zecToken &&
            !depositState.isGeneratingAddress
              ? 'bg-[#d08700] hover:bg-[#d08700]/90 cursor-pointer'
              : 'bg-[rgba(208,135,0,0.15)] hover:bg-[rgba(208,135,0,0.15)] text-[#fdead7] cursor-not-allowed'
          } text-black font-rajdhani font-bold text-sm sm:text-base md:text-[16px] py-3 sm:py-[13px] h-auto rounded-none`}
        >
          {depositState.isGeneratingAddress ? (
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
