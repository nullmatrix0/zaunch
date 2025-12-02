'use client';

import { useCallback, useEffect, useState } from 'react';

interface TokenHeaderProps {
  token: any;
  address: string;
}

export function TokenHeader({ token, address }: TokenHeaderProps) {
  // Using dummy data from props or falling back to defaults
  const name = token?.name || 'DarkFi DEX';
  const symbol = token?.symbol ? `$${token.symbol}` : '$DARK';
  const status = 'Active Sale';
  const timeLeft = '04d 12h 33m';

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fetchTokenUri = useCallback(async () => {
    try {
      const re = await fetch(token.tokenUri);
      const data = await re.json();
      setImageUrl(data.image);
    } catch (e) {
      return null;
    }
  }, [token]);

  useEffect(() => {
    fetchTokenUri();
  }, [fetchTokenUri]);

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
