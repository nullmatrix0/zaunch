import { useCallback, useEffect, useReducer, useTransition, Dispatch } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { getSolPrice, getSolBalance, getTokenBalanceOnSOL, getRpcSOLEndpoint } from '@/lib/sol';
import { Token } from '@/types/token';
import { TradingState, TradingAction } from '@/types/trading';
import { tradingReducer } from '@/lib/trading-reducer';
import { LAMPORTS_PER_SOL } from '@/lib/trading-constants';

const initialState: TradingState = {
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
};

export const useTradingData = (token: Token, address: string) => {
  const { publicKey } = useWallet();
  const [state, dispatch] = useReducer(tradingReducer, initialState);
  const [isPending, startTransition] = useTransition();

  const getTokenDecimals = useCallback(() => {
    if ('decimals' in token && typeof token.decimals === 'number') return token.decimals;
    return 9;
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

      let virtualPoolState: any;
      let poolConfigState: any;

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
        console.warn('Error fetching pool data:', error);
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

  return {
    state,
    dispatch: dispatch as Dispatch<TradingAction>,
    isPending,
    fetchUserBalances,
    fetchTokenData,
    getTokenDecimals,
  };
};
