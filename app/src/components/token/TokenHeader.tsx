'use client';

import { Token } from '@/types/token';
import { useCallback, useEffect, useState } from 'react';

interface TokenHeaderProps {
  token: Token;
}

export function TokenHeader({ token }: TokenHeaderProps) {
  const name = token.tokenName || 'Zaunchpad';
  const symbol = token.tokenSymbol ? `$${token.tokenSymbol}` : '$ZAUNCHPAD';
  const status = 'Active Sale';

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('00d 00h 00m');

  const fetchTokenUri = useCallback(async () => {
    try {
      const re = await fetch(token.tokenUri);
      const data = await re.json();
      setImageUrl(data.image);
    } catch (e) {
      return null;
    }
  }, [token]);

  const calculateTimeLeft = useCallback(() => {
    if (!token?.endTime) {
      setTimeLeft('00d 00h 00m');
      return;
    }

    const endTime = Number(token.endTime) * 1000; // Convert to milliseconds
    const now = Date.now();
    const difference = endTime - now;

    if (difference <= 0) {
      setTimeLeft('00d 00h 00m');
      return;
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

    setTimeLeft(`${String(days).padStart(2, '0')}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`);
  }, [token?.endTime]);

  useEffect(() => {
    fetchTokenUri();
  }, [fetchTokenUri]);

  useEffect(() => {
    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000);
    return () => clearInterval(interval);
  }, [calculateTimeLeft]);

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full mb-4 sm:mb-6 gap-4 sm:gap-6">
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
        <div className="w-20 h-20 rounded-lg">
          {imageUrl && (
            <img src={imageUrl} alt={name} className="w-full h-full object-cover rounded-lg" />
          )}
        </div>

        <div className="flex flex-col md:gap-2 gap-1 min-w-0 flex-1">
          <h1 className="font-rajdhani font-bold text-2xl sm:text-3xl md:text-4xl text-white leading-tight truncate">
            {name}
          </h1>
          <div className="flex flex-wrap gap-1.5">
            <div className="border border-gray-600 px-1.5 sm:px-2 py-0.5 flex items-center justify-center">
              <span className="font-rajdhani font-bold text-sm text-gray-600">{symbol}</span>
            </div>
            <div className="border border-[#34c759] px-1.5 sm:px-2 py-0.5 flex items-center justify-center">
              <span className="font-rajdhani font-bold text-sm text-[#34c759]">{status}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
        <span className="font-rajdhani text-sm text-gray-500">SALE ENDS IN</span>
        <span className="font-rajdhani font-bold text-2xl sm:text-3xl text-white">{timeLeft}</span>
      </div>
    </div>
  );
}
