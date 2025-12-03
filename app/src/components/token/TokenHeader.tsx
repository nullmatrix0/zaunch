'use client';

import { Token } from '@/types/token';
import { useCallback, useEffect, useState } from 'react';

interface TokenHeaderProps {
  token: Token;
}

export function TokenHeader({ token }: TokenHeaderProps) {
  const name = token.tokenName || 'Zaunchpad';
  const symbol = token.tokenSymbol ? `$${token.tokenSymbol}` : '$ZAUNCHPAD';

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('00d 00h 00m');
  const [status, setStatus] = useState<{ label: string; color: string; description: string }>({ 
    label: 'LIVE', 
    color: '#34c759',
    description: 'Active Sale'
  });

  const fetchTokenUri = useCallback(async () => {
    try {
      const re = await fetch(token.tokenUri);
      const data = await re.json();
      setImageUrl(data.image);
    } catch (e) {
      return null;
    }
  }, [token]);

  const getStatus = useCallback(() => {
    if (!token?.startTime || !token?.endTime) {
      return { label: 'LIVE', color: '#34c759', description: 'Active Sale' };
    }

    const now = Date.now();
    const start = Number(token.startTime) * 1000;
    const end = Number(token.endTime) * 1000;

    if (now < start) {
      return { label: 'UPCOMING', color: '#3b82f6', description: 'Sale Starting Soon' };
    } else if (now >= start && now <= end) {
      return { label: 'LIVE', color: '#34c759', description: 'Active Sale' };
    } else {
      return { label: 'ENDED', color: '#ef4444', description: 'Sale Ended' };
    }
  }, [token?.startTime, token?.endTime]);

  const calculateTimeLeft = useCallback(() => {
    if (!token?.endTime) {
      setTimeLeft('00d 00h 00m');
      return;
    }

    const endTime = Number(token.endTime) * 1000;
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
    setStatus(getStatus());
    calculateTimeLeft();
    const interval = setInterval(() => {
      setStatus(getStatus());
      calculateTimeLeft();
    }, 60000);
    return () => clearInterval(interval);
  }, [getStatus, calculateTimeLeft]);

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-4 sm:gap-6">
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0 w-full sm:w-auto">
        <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 shrink-0 rounded-lg overflow-hidden">
          {imageUrl && (
            <img src={imageUrl} alt={name} className="w-full h-full object-cover rounded-lg" />
          )}
        </div>

        <div className="flex flex-col gap-1 sm:gap-1.5 md:gap-2 min-w-0 flex-1">
          <h1 className="font-rajdhani font-bold text-xl sm:text-2xl md:text-3xl lg:text-4xl text-white leading-tight break-words">
            {name}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <div className="border border-gray-600 px-1.5 sm:px-2 py-0.5 flex items-center justify-center shrink-0">
              <span className="font-rajdhani font-bold text-xs sm:text-sm text-gray-600 whitespace-nowrap">{symbol}</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="border px-1.5 sm:px-2 py-0.5 flex items-center justify-center shrink-0" style={{ borderColor: status.color }}>
                <span className="font-rajdhani font-bold text-xs sm:text-sm whitespace-nowrap" style={{ color: status.color }}>
                  {status.description}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-start sm:items-end gap-1 shrink-0 w-full sm:w-auto">
        <span className="font-rajdhani text-xs sm:text-sm text-gray-500 whitespace-nowrap">SALE ENDS IN</span>
        <span className="font-rajdhani font-bold text-xl sm:text-2xl md:text-3xl text-white break-words sm:break-normal">{timeLeft}</span>
      </div>
    </div>
  );
}
