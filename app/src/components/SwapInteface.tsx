'use client';

import { useState, useEffect, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowDownUp, Settings, Loader2 } from 'lucide-react';
import { Token } from '@/types/token';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAmountOut, getPoolAddress, swap } from '@/lib/dammv2';
import { getSolBalance, getTokenBalanceOnSOL } from '@/lib/sol';

import { toast } from 'sonner';

export default function SwapInterface({ token }: { token: Token }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [sellAmount, setSellAmount] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  const [poolAddress, setPoolAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isBuy, setIsBuy] = useState(false); // false = Sell Base Token, true = Buy Base Token (Sell SOL)
  const [balances, setBalances] = useState<{ sol: number; token: number }>({ sol: 0, token: 0 });
  const [isEstimating, setIsEstimating] = useState(false);

  useEffect(() => {
    const fetchTokenUri = async () => {
      try {
        if (!token.tokenUri) return;
        const re = await fetch(token.tokenUri);
        const data = await re.json();
        setImageUrl(data.image);
      } catch (e) {
        console.error('Error fetching token metadata:', e);
      }
    };
    fetchTokenUri();
  }, [token.tokenUri]);

  // Fetch pool address to check if pool exists
  useEffect(() => {
    const fetchAddress = async () => {
      if (!token.tokenMint || !connection) return;
      try {
        setIsLoading(true);
        const address = await getPoolAddress(
          connection,
          new PublicKey(token.tokenMint),
          new PublicKey('So11111111111111111111111111111111111111112'), // WSOL Mint
        );
        if (address) {
          console.log('Found pool address for swap:', address.toString());
          setPoolAddress(address.toString());
        } else {
          setPoolAddress(null);
        }
      } catch (error) {
        console.error('Failed to fetch pool address:', error);
        setPoolAddress(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAddress();
  }, [token.tokenMint, connection]);

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!publicKey || !poolAddress) {
        setBalances({ sol: 0, token: 0 });
        return;
      }

      try {
        const [solBal, tokenBal] = await Promise.all([
          getSolBalance(publicKey.toString()),
          getTokenBalanceOnSOL(token.tokenMint, publicKey.toString()),
        ]);
        setBalances({ sol: solBal, token: tokenBal });
      } catch (error) {
        console.error('Error fetching balances:', error);
      }
    };

    fetchBalances();
    // Set up an interval to refresh balances
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [publicKey, poolAddress, token.tokenMint]);

  // Calculate estimated output when input amount changes
  useEffect(() => {
    const calculateOutput = async () => {
      if (!poolAddress || !connection || !token.tokenMint) return;

      // Always calculate based on Sell Amount (Input)
      const amountStr = sellAmount;
      const amount = parseFloat(amountStr.replace(/,/g, ''));

      if (!amount || amount <= 0) {
        setBuyAmount('');
        return;
      }

      try {
        setIsEstimating(true);
        let inputMint: PublicKey;
        let outputMint: PublicKey;
        let inputDecimals: number;
        let outputDecimals: number;

        if (isBuy) {
          // Buy: Input = WSOL, Output = Token
          inputMint = new PublicKey('So11111111111111111111111111111111111111112');
          outputMint = new PublicKey(token.tokenMint!);
          inputDecimals = 9;
          outputDecimals = token.decimals ?? 6;
        } else {
          // Sell: Input = Token, Output = WSOL
          inputMint = new PublicKey(token.tokenMint!);
          outputMint = new PublicKey('So11111111111111111111111111111111111111112');
          inputDecimals = token.decimals ?? 6;
          outputDecimals = 9;
        }

        const res = await getAmountOut(
          connection,
          new PublicKey(poolAddress),
          amount,
          inputMint,
          outputMint,
          inputDecimals,
          outputDecimals,
        );

        if (res) {
          // Format with commas and appropriate decimals
          setBuyAmount(res.amountOut);
        }
      } catch (error) {
        console.error('Error estimating output:', error);
      } finally {
        setIsEstimating(false);
      }
    };

    const timeoutId = setTimeout(calculateOutput, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [sellAmount, isBuy, poolAddress, connection, token]);

  // NOW it's safe to have conditional returns - ALL hooks have been called
  // Hide if no pool exists and not loading
  if (!isLoading && !poolAddress) {
    return null;
  }

  const handleSwapDirection = () => {
    setIsBuy(!isBuy);
    // Swap amounts as well for better UX
    setSellAmount(buyAmount);
    setBuyAmount(sellAmount);
  };

  const handleSwap = async () => {
    if (!publicKey || !poolAddress || !connection || !token.tokenMint) return;

    try {
      setIsLoading(true);

      const sellValue = parseFloat(sellAmount.replace(/,/g, '')) || 0;
      const buyValue = parseFloat(buyAmount.replace(/,/g, '')) || 0;

      if (sellValue === 0 && buyValue === 0) {
        toast.error('Please enter an amount');
        return;
      }

      let inputMint = new PublicKey(token.tokenMint!);
      let outputMint = new PublicKey('So11111111111111111111111111111111111111112'); // WSOL
      let inputDecimals = token.decimals ?? 6;
      let outputDecimals = 9;
      let amountIn = 0;
      let minAmountOut = 0; // For now 0 slippage

      if (isBuy) {
        // Buy: Input = WSOL, Output = Token
        inputMint = new PublicKey('So11111111111111111111111111111111111111112');
        outputMint = new PublicKey(token.tokenMint!);
        inputDecimals = 9;
        outputDecimals = token.decimals ?? 6;
        amountIn = buyValue; // User inputs buy amount (SOL)
        minAmountOut = 0;
      } else {
        // Sell: Input = Token, Output = WSOL
        inputMint = new PublicKey(token.tokenMint!);
        outputMint = new PublicKey('So11111111111111111111111111111111111111112');
        inputDecimals = token.decimals ?? 6;
        outputDecimals = 9;
        amountIn = sellValue;
        minAmountOut = 0;
      }

      console.log('Swapping...', {
        inputMint: inputMint.toString(),
        outputMint: outputMint.toString(),
        amountIn,
        poolAddress,
      });

      const res = await swap(
        connection,
        new PublicKey(poolAddress),
        publicKey,
        inputMint,
        outputMint,
        amountIn,
        minAmountOut,
        inputDecimals,
        outputDecimals,
      );

      if (res) {
        const signature = await sendTransaction(res, connection);
        console.log('Swap submitted, signature:', signature);
        await connection.confirmTransaction(signature, 'confirmed');
        toast.success('Swap successful!');
        setSellAmount('');
        setBuyAmount('');
      } else {
        throw new Error('Failed to prepare swap transaction');
      }
    } catch (error) {
      console.error('Swap failed:', error);
      toast.error('Swap failed. See console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (value: string) => {
    const rawValue = value.replace(/,/g, '');
    if (!rawValue) return '';
    if (rawValue.endsWith('.')) return value;

    if (isNaN(Number(rawValue))) return value;

    const parts = rawValue.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return parts.join('.');
  };

  const handleAmountChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setAmount: (val: string) => void,
  ) => {
    const val = e.target.value;
    if (/^[\d,]*\.?[\d]*$/.test(val)) {
      setAmount(formatNumber(val));
    }
  };

  const renderTokenInput = (type: 'sell' | 'buy') => {
    // Determine which token is shown based on isBuy state and input type
    // If isBuy (Sell SOL -> Buy Token):
    //   type === 'sell' -> Show SOL
    //   type === 'buy'  -> Show Token
    // If !isBuy (Sell Token -> Buy SOL):
    //   type === 'sell' -> Show Token
    //   type === 'buy'  -> Show SOL

    const isBaseToken = isBuy ? type === 'buy' : type === 'sell';

    const tokenSymbol = isBaseToken ? token.tokenSymbol || 'TOKEN' : 'SOL';
    const amount = type === 'sell' ? sellAmount : buyAmount;
    const setAmount = type === 'sell' ? setSellAmount : setBuyAmount;
    const balance = isBaseToken ? balances.token : balances.sol;

    const currentAmount = parseFloat(amount.replace(/,/g, '')) || 0;
    const isInsufficientBalance = type === 'sell' && currentAmount > balance;

    return (
      <div
        className={`p-4 border ${isInsufficientBalance ? 'border-red-500' : 'border-gray-800/50 hover:border-gray-700'} transition-colors ${type === 'sell' ? 'bg-black/40 mb-2' : 'bg-black/40 mt-2'}`}
      >
        <div className="flex justify-between mb-2">
          <span className="text-gray-400 text-sm font-medium capitalize">{type}</span>
          <span className="text-gray-400 text-sm">
            Balance:{' '}
            {balance.toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 4,
            })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="bg-neutral-900 px-3 py-2 flex items-center gap-2 hover:bg-neutral-800 transition-colors border border-gray-800 shrink-0">
            <div className="w-6 h-6 overflow-hidden shrink-0">
              {isBaseToken ? (
                imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={tokenSymbol}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <div className="w-full h-full bg-linear-to-br from-orange-400 to-orange-600 rounded-full" />
                )
              ) : (
                <div className="w-6 h-6 overflow-hidden shrink-0">
                  <img src="/chains/solana-dark.svg" alt="Solana" />
                </div>
              )}
            </div>
            <span className="text-white font-bold font-rajdhani text-lg uppercase">
              {tokenSymbol}
            </span>
          </div>
          <input
            type="text"
            value={amount}
            onChange={(e) => handleAmountChange(e, setAmount)}
            placeholder={isEstimating && type === 'buy' ? 'Loading...' : '0.00'}
            className="bg-transparent text-right text-3xl text-white outline-none w-full font-medium placeholder-gray-600 font-rajdhani"
            readOnly={type === 'buy'} // Make buy input read-only for now as we only support ExactIn
          />
        </div>
        <div
          className={`flex ${type === 'sell' ? 'justify-between' : 'justify-end'} items-center mt-2`}
        >
          {type === 'sell' && (
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setAmount(formatNumber(balance.toString()))}
                className="bg-neutral-800 hover:bg-neutral-700 text-gray-400 hover:text-white px-2 py-1 transition-colors border border-gray-700 cursor-pointer"
              >
                MAX
              </button>
              <button
                type="button"
                onClick={() => setAmount(formatNumber((balance * 0.5).toString()))}
                className="bg-neutral-800 hover:bg-neutral-700 text-gray-400 hover:text-white px-2 py-1 transition-colors border border-gray-700 cursor-pointer"
              >
                50%
              </button>
            </div>
          )}
          {isInsufficientBalance ? (
            <span className="text-red-500 text-sm font-medium">Insufficient balance</span>
          ) : (
            <span className="text-gray-500 text-sm">$0.00</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-neutral-950 border border-gray-800 p-4 shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 px-2">
          <h2 className="text-white font-medium text-lg">Swap</h2>
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white rounded-none"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        {/* Sell Section */}
        {renderTokenInput('sell')}

        {/* Swap Direction Button */}
        <div className="relative h-4 flex items-center justify-center -my-3 z-10">
          <button
            type="button"
            onClick={handleSwapDirection}
            className="bg-neutral-950 p-1.5 border border-gray-800 cursor-pointer hover:border-gray-700 hover:bg-neutral-900 transition-all group"
            aria-label="Swap direction"
          >
            <ArrowDownUp className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
          </button>
        </div>

        {/* Buy Section */}
        {renderTokenInput('buy')}

        {/* Action Button */}
        <Button
          onClick={handleSwap}
          disabled={
            isLoading ||
            !publicKey ||
            !poolAddress ||
            parseFloat(sellAmount.replace(/,/g, '')) > (isBuy ? balances.sol : balances.token)
          }
          className="w-full mt-4 bg-[#d08700] hover:bg-[#b07200] text-black font-bold h-12 text-lg transition-all shadow-[0_0_20px_rgba(208,135,0,0.3)] hover:shadow-[0_0_30px_rgba(208,135,0,0.5)] rounded-none cursor-pointer disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-gray-500 disabled:shadow-none"
        >
          {isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : !poolAddress ? (
            'Pool Not Initialized'
          ) : !publicKey ? (
            'Connect Wallet'
          ) : parseFloat(sellAmount.replace(/,/g, '')) > (isBuy ? balances.sol : balances.token) ? (
            'Insufficient Balance'
          ) : (
            'Swap'
          )}
        </Button>
      </div>
    </div>
  );
}
