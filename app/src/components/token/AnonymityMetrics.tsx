'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { TEE_ENDPOINT } from '@/configs/env.config';

interface LaunchStats {
  launch_id: string;
  tickets_created: number;
  shielded_value_usd: string;
  total_tokens_sold: number;
}

interface AnonymityData {
  totalShieldedValue: string;
  activeTickets: number;
  loading: boolean;
}

interface AnonymityMetricsProps {
  launchName: string;
  verifiedProofsCount?: number;
}

async function fetchLaunchStats(launchName: string): Promise<LaunchStats | null> {
  try {
    const res = await fetch(`${TEE_ENDPOINT}/launches/${encodeURIComponent(launchName)}/stats`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function AnonymityMetrics({ launchName, verifiedProofsCount = 0 }: AnonymityMetricsProps) {
  const [data, setData] = useState<AnonymityData>({
    totalShieldedValue: '0.00',
    activeTickets: 0,
    loading: true,
  });

  useEffect(() => {
    async function fetchData() {
      const launchStats = await fetchLaunchStats(launchName);

      const ticketsCreated = launchStats?.tickets_created || 0;
      const activeTickets = Math.max(0, ticketsCreated - verifiedProofsCount);
      const totalShieldedValue = launchStats?.shielded_value_usd || '0.00';

      setData({
        totalShieldedValue,
        activeTickets,
        loading: false,
      });
    }

    if (launchName) {
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [launchName, verifiedProofsCount]);

  const formatNumber = (num: number) => num.toLocaleString();
  const formatUsd = (value: string) => {
    const num = parseFloat(value);
    return isNaN(num) ? '0.00' : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="flex flex-col gap-2 sm:gap-3 w-full">
      <div className="bg-neutral-950 border border-gray-800 p-3 sm:p-4 md:p-5 w-full">
        <h3 className="font-rajdhani font-bold text-base sm:text-lg md:text-xl text-white mb-2 sm:mb-3">
          Anonymity Set Metrics
        </h3>
        <div className="border border-gray-800 flex w-full">
          <div className="flex-1 border-r border-gray-800 p-2 sm:p-2.5 md:p-3 flex flex-col items-center justify-center gap-1">
            <span className="font-rajdhani text-[10px] sm:text-xs md:text-sm text-[#79767d] text-center">
              Total Shielded Value
            </span>
            <span className="font-rajdhani font-bold text-sm sm:text-base md:text-lg text-white break-words text-center">
              {data.loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                `$${formatUsd(data.totalShieldedValue)}`
              )}
            </span>
          </div>
          <div className="flex-1 p-2 sm:p-2.5 md:p-3 flex flex-col items-center justify-center gap-1">
            <span className="font-rajdhani text-[10px] sm:text-xs md:text-sm text-[#79767d] text-center">
              Active Tickets
            </span>
            <span className="font-rajdhani font-bold text-sm sm:text-base md:text-lg text-white break-words text-center">
              {data.loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                formatNumber(data.activeTickets)
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-[rgba(208,135,0,0.05)] border border-[#d08700] p-3 sm:p-4 flex gap-2 sm:gap-3 items-start">
        <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#d08700] shrink-0 mt-0.5 sm:mt-1" />
        <p className="font-rajdhani font-medium text-[#79767d] text-[11px] sm:text-xs md:text-sm leading-relaxed">
          <span className="font-bold text-[#d08700]">How it works: </span>
          <span>
            your deposit is added to this pool of uniform notes. When you claim, the smart contract
            validates your Zero-Knowledge proof without revealing which specific deposit was yours.
            The larger the set, the stronger the privacy.
          </span>
        </p>
      </div>
    </div>
  );
}
