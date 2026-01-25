import { TradingState, TradingAction } from '@/types/trading';

export const tradingReducer = (state: TradingState, action: TradingAction): TradingState => {
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
