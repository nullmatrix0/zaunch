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
  swapStatus: any | null;
  isGeneratingAddress: boolean;
  isSettling: boolean;
  isLoadingPurchaseInfo: boolean;
  nearTxHash: string | null;
  depositFlowState: 'initial' | 'qr-code' | 'detecting' | 'batching' | 'success';
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
      if (!amount || parseFloat(amount) <= 0 || !publicKey) {
        setDepositState((prev) => ({ ...prev, purchaseInfo: null }));
        return;
      }

      if (!nearIntents) {
        setDepositState((prev) => ({ ...prev, purchaseInfo: null, isLoadingPurchaseInfo: false }));
        return;
      }

      try {
        setDepositState((prev) => ({ ...prev, isLoadingPurchaseInfo: true }));

        const tokenSymbol = getTokenSymbol();

        const tokenSupport = await nearIntents.checkNearIntentSupport(tokenSymbol as string);
        if (!tokenSupport.supported) {
          console.warn(
            `Token ${tokenSymbol} is not supported for NEAR payments. Only SOL payments are available.`,
          );
          setDepositState((prev) => ({
            ...prev,
            purchaseInfo: null,
            isLoadingPurchaseInfo: false,
          }));
          return;
        }

        const amountInYoctoNEAR = parseNearAmount(amount) || '0';

        const estimate = await nearIntents.estimatePayment({
          amount: amountInYoctoNEAR,
          paymentToken: 'wNEAR',
          receiveToken: tokenSymbol as string,
          recipientAddress: publicKey.toString(),
          refundAddress: publicKey.toString(), // Use Solana address for refund
          slippage: 1.0,
        });

        const purchaseInfo = {
          expectedOut: estimate.expectedReceiveAmount,
          minAmountOut: estimate.expectedReceiveAmount,
          timeEstimate: estimate.estimatedTimeSeconds,
          slippageBps: 100,
          estimatedValueUsd: estimate.estimatedValueUsd,
        };

        setDepositState((prev) => ({ ...prev, purchaseInfo, isLoadingPurchaseInfo: false }));
      } catch (error) {
        console.error('Error fetching purchase info:', error);
        if (error instanceof Error && !error.message.includes('not supported')) {
          toast.error('Failed to fetch purchase info. Please try again.');
        }
        setDepositState((prev) => ({ ...prev, purchaseInfo: null, isLoadingPurchaseInfo: false }));
      }
    },
    [publicKey, getTokenSymbol, nearIntents],
  );

  const startStatusPolling = useCallback(
    (depositAddress: string) => {
      if (statusPollIntervalRef.current) {
        clearInterval(statusPollIntervalRef.current);
      }

      if (!nearIntents) {
        console.warn('Cannot poll payment status: NEAR Intents not configured');
        return;
      }

      // Update state to detecting
      setDepositState((prev) => ({ ...prev, depositFlowState: 'detecting' }));

      statusPollIntervalRef.current = setInterval(async () => {
        try {
          if (!nearIntents) {
            if (statusPollIntervalRef.current) {
              clearInterval(statusPollIntervalRef.current);
              statusPollIntervalRef.current = null;
            }
            return;
          }
          const status = await nearIntents.getPaymentStatus(depositAddress);

          setDepositState((prev) => ({ ...prev, swapStatus: status }));

          console.log(`[Deposit Status] ${status.status}`, status);

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
                  `Successfully received ${status.receivedAmountFormatted} ${getTokenSymbol()}!`,
                );
                fetchUserBalances();
              }, 2000);
            } else if (status.isFailed) {
              toast.error(`Swap failed with status: ${status.status}`);
              setDepositState((prev) => ({ ...prev, depositFlowState: 'qr-code' }));
            } else if (status.status === 'REFUNDED') {
              toast.info('Payment was refunded to your NEAR wallet.');
              setDepositState((prev) => ({ ...prev, depositFlowState: 'qr-code' }));
            }
          }
        } catch (error) {
          console.error('Error polling swap status:', error);
        }
      }, 5000);
    },
    [nearIntents, getTokenSymbol, fetchUserBalances],
  );

  const handleGenerateDepositAddress = useCallback(async () => {
    if (!depositState.depositAmount || parseFloat(depositState.depositAmount) <= 0) {
      toast.error('Please enter an amount to deposit');
      return;
    }

    if (!publicKey) {
      toast.error('Please connect your Solana wallet');
      return;
    }

    if (!nearIntents) {
      toast.error(
        'NEAR Intents is not configured. Please set NEXT_PUBLIC_ONECLICK_JWT in your environment variables.',
      );
      return;
    }

    try {
      setDepositState((prev) => ({ ...prev, isGeneratingAddress: true }));

      const tokenSymbol = getTokenSymbol();

      const tokenSupport = await nearIntents.checkNearIntentSupport(tokenSymbol as string);
      if (!tokenSupport.supported) {
        toast.error(
          `Token ${tokenSymbol} is not supported for NEAR payments. Please use SOL to purchase this token.`,
        );
        setDepositState((prev) => ({ ...prev, isGeneratingAddress: false }));
        return;
      }

      const amountInYoctoNEAR = parseNearAmount(depositState.depositAmount) || '0';

      const quote = await nearIntents.getPaymentQuote({
        amount: amountInYoctoNEAR,
        paymentToken: 'wNEAR',
        receiveToken: tokenSymbol as string,
        recipientAddress: publicKey.toString(),
        refundAddress: publicKey.toString(), // Use Solana address for refund
        slippage: 1.0,
      });

      const purchaseInfo = {
        expectedOut: quote.expectedReceiveAmount,
        minAmountOut: quote.minReceiveAmount,
        timeEstimate: quote.estimatedTimeSeconds,
        slippageBps: quote.slippageBps,
        estimatedValueUsd: quote.estimatedValueUsd,
      };

      setDepositState((prev) => ({
        ...prev,
        depositAddress: quote.depositAddress,
        depositMemo: quote.depositMemo || null,
        purchaseInfo,
        isGeneratingAddress: false,
        depositFlowState: 'qr-code',
      }));

      startStatusPolling(quote.depositAddress);

      toast.success('Deposit address generated! You can now send NEAR to this address.');
    } catch (error) {
      console.error('Error generating deposit address:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate deposit address');
      setDepositState((prev) => ({ ...prev, isGeneratingAddress: false }));
    }
  }, [depositState.depositAmount, publicKey, getTokenSymbol, nearIntents, startStatusPolling]);

  const handleCheckStatus = useCallback(async () => {
    if (!depositState.depositAddress) {
      toast.error('No deposit address found');
      return;
    }

    if (!nearIntents) {
      toast.error(
        'NEAR Intents is not configured. Please set NEXT_PUBLIC_ONECLICK_JWT in your environment variables.',
      );
      return;
    }

    try {
      setDepositState((prev) => ({ ...prev, isSettling: true }));

      const status = await nearIntents.getPaymentStatus(depositState.depositAddress);

      setDepositState((prev) => ({
        ...prev,
        swapStatus: status,
        isSettling: false,
      }));

      if (status.isSuccess) {
        toast.success(
          `Swap completed! Received ${status.receivedAmountFormatted} ${getTokenSymbol()}`,
        );
        await fetchUserBalances();
      } else if (status.isFailed) {
        toast.error(`Swap failed: ${status.status}`);
      } else if (status.status === 'REFUNDED') {
        toast.info('Payment was refunded');
      } else {
        toast.info(`Current status: ${status.status}`);
      }
    } catch (error) {
      console.error('Error checking status:', error);
      toast.error('Failed to check status');
      setDepositState((prev) => ({ ...prev, isSettling: false }));
    }
  }, [depositState.depositAddress, getTokenSymbol, nearIntents, fetchUserBalances]);

  // Note: Users will send NEAR manually from their NEAR wallet to the deposit address
  // No need for handleSendNearTransaction as we only require Solana wallet connection

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

  const phaseInfo = getPhaseInfo(state.tokenData.migrationProgress);

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, { dot: string; text: string }> = {
      orange: { dot: 'bg-orange-600', text: 'text-orange-600' },
      blue: { dot: 'bg-blue-700', text: 'text-blue-700' },
      green: { dot: 'bg-green-600', text: 'text-green-600' },
      purple: { dot: 'bg-purple-600', text: 'text-purple-600' },
      emerald: { dot: 'bg-emerald-600', text: 'text-emerald-600' },
      gray: { dot: 'bg-gray-600', text: 'text-gray-600' },
    };
    return colorMap[color] || colorMap.gray;
  };

  const colorClasses = getColorClasses(phaseInfo.color);

  // Render deposit flow states
  const renderDepositFlow = () => {
    if (depositState.depositFlowState === 'detecting') {
      return (
        <div className="bg-neutral-950 border border-gray-800 flex flex-col gap-[10px] items-center justify-center px-6 py-4">
          <Loader2 className="w-[84px] h-[84px] text-[#d08700] animate-spin" />
          <div className="flex flex-col gap-2 items-center">
            <div className="font-rajdhani font-semibold text-2xl text-[rgba(255,255,255,0.38)] uppercase">
              DETECTING DEPOSIT....
            </div>
            <div className="font-rajdhani font-medium text-sm text-[rgba(255,255,255,0.65)] uppercase">
              Waiting for block confirmation
            </div>
          </div>
        </div>
      );
    }

    if (depositState.depositFlowState === 'batching') {
      return (
        <div className="bg-neutral-950 border border-gray-800 flex flex-col gap-[10px] items-center justify-center px-6 py-4">
          <Loader2 className="w-[84px] h-[84px] text-[#d08700] animate-spin" />
          <div className="flex flex-col gap-2 items-center">
            <div className="font-rajdhani font-semibold text-2xl text-[rgba(255,255,255,0.38)] uppercase">
              batching & shielding
            </div>
            <div className="font-rajdhani font-medium text-sm text-[rgba(255,255,255,0.65)] uppercase">
              Generating Zero-Knowledge PROOF
            </div>
          </div>
        </div>
      );
    }

    if (depositState.depositFlowState === 'success') {
      return (
        <div className="bg-neutral-950 border border-gray-800 flex flex-col gap-[14px] items-center justify-center px-6 py-[50px]">
          <div className="w-[84px] h-[84px] flex items-center justify-center">
            <CheckCircle2 className="w-full h-full text-[#d08700]" />
          </div>
          <div className="flex flex-col gap-2 items-start w-full max-w-[295px]">
            <div className="font-rajdhani font-semibold text-2xl text-[rgba(255,255,255,0.95)] uppercase text-center w-full">
              PURCHASE SUCCESSFUL
            </div>
            <div className="font-rajdhani font-medium text-sm text-[rgba(255,255,255,0.65)] text-center w-full">
              Your deposit has been batched. You hold{' '}
              <span className="font-bold text-base text-white">123,000 anonymous Tickets.</span>
            </div>
            <div className="font-rajdhani font-medium text-sm text-[rgba(255,255,255,0.39)] text-center w-full">
              Keep your proof file safe. You will need it to claim token when the sale ends.
            </div>
          </div>
          <div className="border border-dashed border-white flex gap-[10px] items-center justify-center px-[54px] py-[15px]">
            <div className="font-rajdhani font-medium text-base text-center text-white">
              zk_proof_acq9spwvqr38.zip
            </div>
          </div>
          <Button
            onClick={() => {
              // Download proof functionality
              toast.info('Proof download functionality coming soon');
            }}
            className="w-full max-w-[295px] bg-[#d08700] hover:bg-[#d08700]/90 text-black font-rajdhani font-bold py-[13px]"
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
            className="w-full max-w-[295px] border-[#79767d] h-[55px] font-rajdhani font-medium text-[rgba(255,255,255,0.65)]"
          >
            Buy more Tickets
          </Button>
        </div>
      );
    }

    if (depositState.depositFlowState === 'qr-code' && depositState.depositAddress) {
      return (
        <div className="bg-neutral-950 border border-gray-800 flex flex-col gap-5 items-center px-6 py-4">
          <div className="flex flex-col items-start w-full">
            <div className="font-rajdhani font-semibold text-xl text-white text-center w-full mb-1">
              Scan QR Code to Deposit
            </div>
            <div className="font-rajdhani font-normal text-base text-white text-center w-full">
              Send {depositState.depositAmount} NEAR to the address below
            </div>
          </div>

          <div className="relative">
            <div className="border border-white/10 p-1 rounded-lg bg-white">
              <QRCodeSVG value={depositState.depositAddress} size={175} level="M" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white rounded-full p-2">
                <img src="/logos/near.svg" alt="NEAR" className="w-11 h-11" />
              </div>
            </div>
          </div>

          <div className="w-full space-y-3">
            <div className="border border-white/12 flex flex-col gap-[10px] px-3 py-2">
              <div className="font-rajdhani font-medium text-[15px] text-[rgba(255,255,255,0.65)]">
                DEPOSIT ADDRESS (NEAR)
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

            {depositState.purchaseInfo && (
              <div className="bg-[rgba(208,135,0,0.01)] border border-[#d08700] flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between text-sm text-[#79767d]">
                  <div className="font-rajdhani font-normal">TICKET COST</div>
                  <div className="font-rajdhani font-bold">{depositState.depositAmount} NEAR</div>
                </div>
                <div className="flex items-center justify-between text-sm text-[#79767d]">
                  <div className="font-rajdhani font-normal">PRIVACY FEE (0.5%)</div>
                  <div className="font-rajdhani font-bold text-[#b3261e]">0.0010 ZEC</div>
                </div>
                <div className="flex items-center justify-between text-sm text-[#79767d]">
                  <div className="font-rajdhani font-normal">SWAP RATE</div>
                  <div className="font-rajdhani font-bold">1 NEAR ~ 0.15 ZEC</div>
                </div>
                <div className="border-t border-[rgba(208,135,0,0.15)] pt-1 flex items-center justify-between">
                  <div className="font-rajdhani font-bold text-base text-[#d08700]">
                    TOTAL PAYABLE
                  </div>
                  <div className="font-rajdhani font-bold text-base text-white">
                    {depositState.depositAmount} NEAR
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
                  You can send any amount equal to or greater than {depositState.depositAmount} NEAR
                  (excluding network fees that will be deducted from your wallet).
                </li>
                <li>Amounts below the minimum will be refunded.</li>
                <li>Only send from a wallet you control.</li>
                <li>This address is only valid for this specific donation.</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    // Initial state
    return (
      <div className="w-full flex flex-col gap-5">
        <div className="bg-[rgba(208,135,0,0.05)] border border-[#d08700] flex gap-3 items-start p-4 w-full">
          <AlertTriangle className="w-4 h-4 text-[#d08700] shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <div className="font-rajdhani font-bold text-base text-[#d08700] leading-[1.3]">
              Claim Period Opens 12/11/2025
            </div>
            <p className="font-rajdhani font-normal text-base text-[#ded8e1] leading-6">
              You are generating a Private Ticket. Tokens will be redeemable after the sale ends
              using your downloaded proof.
            </p>
          </div>
        </div>

        <div className="flex flex-col w-full">
          <div className="border border-white/12 h-[135px] overflow-hidden relative rounded-t-xl bg-black/20">
            <div className="absolute inset-0 flex items-center justify-between px-4">
              <div className="flex flex-col gap-2 w-[200px]">
                <div className="font-rajdhani font-medium text-[15px] text-[rgba(255,255,255,0.65)] uppercase">
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
                  className="w-full text-[36px] font-rajdhani font-medium bg-transparent border-none focus:ring-0 focus:outline-none text-white placeholder:text-[rgba(255,255,255,0.38)] h-[44px] p-0"
                  placeholder="0"
                  inputMode="decimal"
                />
                <div className="h-[18px] bg-white/5 rounded-full px-2 flex items-center w-fit">
                  <span className="font-rajdhani font-medium text-[13px] text-[rgba(255,255,255,0.65)]">
                    {depositState.depositAmount && parseFloat(depositState.depositAmount) > 0
                      ? `$${(parseFloat(depositState.depositAmount) * (state.tokenData.price || 0)).toFixed(2)}`
                      : '$0'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-3 items-center">
                <div className="bg-[#131313] border border-[#393939] flex gap-2 items-center justify-center pl-2 pr-3 py-2 rounded-full shadow-[0px_0px_10px_0px_rgba(255,255,255,0.04)] cursor-pointer hover:bg-[#1a1a1a] transition-colors">
                  <div className="bg-white rounded-full p-1 w-6 h-6 flex items-center justify-center overflow-hidden">
                    <img src="/logos/near.svg" alt="NEAR" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-rajdhani font-semibold text-[15px] text-white">NEAR</span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-l border-r border-b border-white/12 h-[125px] relative rounded-b-xl bg-black/20">
            <div className="absolute inset-0 flex items-center justify-between px-4">
              <div className="flex flex-col gap-2 flex-1">
                <div className="font-rajdhani font-medium text-[15px] text-[rgba(255,255,255,0.65)] uppercase">
                  RECEIVE
                </div>
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={
                      depositState.purchaseInfo
                        ? formatBalance(parseFloat(depositState.purchaseInfo.expectedOut || '0'), 4)
                        : '0'
                    }
                    className="w-full text-[36px] font-rajdhani font-medium bg-transparent border-none focus:ring-0 focus:outline-none text-white placeholder:text-[rgba(255,255,255,0.38)] h-[44px] p-0"
                    placeholder="0"
                    disabled
                  />
                  <div className="bg-[#131313] border border-[#393939] flex gap-2 items-center justify-center pl-2 pr-3 py-2 rounded-full shadow-[0px_0px_10px_0px_rgba(255,255,255,0.04)]">
                    <div className="bg-[#301342] rounded-full w-6 h-6 flex items-center justify-center overflow-hidden">
                      <img
                        src={imageUrl || ''}
                        alt={getTokenSymbol() as string}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="font-rajdhani font-semibold text-[15px] text-white">
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
            <div className="flex items-center justify-between text-sm text-[#79767d]">
              <div className="font-rajdhani font-normal">Ticket Size</div>
              <div className="font-rajdhani font-semibold text-[#d08700]">SINGLE UNIT (1.0)</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="font-rajdhani font-bold text-sm text-[#79767d] uppercase">
                PAYABLE AMOUNT
              </div>
              <div className="font-rajdhani font-bold text-[22px] text-[#79767d] leading-[28px]">
                {depositState.depositAmount ? `${depositState.depositAmount} NEAR` : '0 NEAR'}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="font-rajdhani font-bold text-sm text-[#79767d] uppercase">
              TICKETS GENERATED
            </div>
            <div className="font-rajdhani font-bold text-[22px] text-[#79767d] leading-[28px]">
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
            !publicKey
          }
          className={`w-full ${
            depositState.depositAmount &&
            parseFloat(depositState.depositAmount) > 0 &&
            publicKey &&
            !depositState.isGeneratingAddress
              ? 'bg-[#d08700] hover:bg-[#d08700]/90 cursor-pointer'
              : 'bg-[rgba(208,135,0,0.15)] hover:bg-[rgba(208,135,0,0.15)] text-[#fdead7] cursor-not-allowed'
          } text-black font-rajdhani font-bold text-[16px] py-[13px] h-auto rounded-none`}
        >
          {depositState.isGeneratingAddress ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
              Generating Address...
            </>
          ) : !publicKey ? (
            'Connect Solana Wallet'
          ) : (
            'Pay with NEAR'
          )}
        </Button>

        <div className="font-rajdhani font-normal text-[14px] text-[#79767d] text-center w-full">
          Powered by NEAR Intents & Zcash Shielded Pools
        </div>
      </div>
    );
  };

  return (
    <div className="bg-neutral-950 border border-gray-800 flex flex-col gap-4 items-center justify-center px-6 py-4 relative shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] w-full">
      {renderDepositFlow()}
    </div>
  );
}

export const TradingInterface = memo(TradingInterfaceComponent);
