'use client';

import { useEffect, useState, useMemo } from 'react';
import { useOnChainTokens } from '@/hooks/useOnChainTokens';
import type { Token } from '@/types/token';
import { SOL_NETWORK } from '@/configs/env.config';

const SeparatorIcon = () => (
  <div className="w-4 h-5 shrink-0 flex items-center justify-center gap-1">
    <div className="w-[2px] h-3 bg-white -rotate-30 origin-center"></div>
    <div className="w-[2px] h-3 bg-white -rotate-30 origin-center"></div>
  </div>
);

interface NotificationItem {
  text: string;
  color: string;
}

function generateNotifications(tokens: Token[]): NotificationItem[] {
  const notifications: NotificationItem[] = [];
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  // Helper to format token amounts
  const formatAmount = (amount: bigint, decimals: number): string => {
    const num = Number(amount) / Math.pow(10, decimals);
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toFixed(0);
  };

  // Find recently opened sales (started within last hour)
  const recentlyOpened = tokens
    .filter((token) => {
      const startTime = Number(token.startTime) * 1000;
      const endTime = Number(token.endTime) * 1000;
      // Sale opened within last hour and is still active
      return startTime >= oneHourAgo && startTime <= now && now <= endTime;
    })
    .sort((a, b) => Number(b.startTime) - Number(a.startTime))
    .slice(0, 3);

  recentlyOpened.forEach((token) => {
    notifications.push({
      text: `SALE OPENED: ${token.name.toUpperCase()} ($${token.tokenSymbol.toUpperCase()})`,
      color: 'text-white',
    });
  });

  // Find tokens with recent claims (whale alerts - large amounts claimed)
  const whaleTokens = tokens
    .filter((token) => {
      const totalClaimed = Number(token.totalClaimed) / Math.pow(10, token.decimals);
      const amountToSell = Number(token.amountToSell) / Math.pow(10, token.decimals);
      // Consider it a whale alert if claimed > 100 ZEC or > 10% of total
      return totalClaimed > 100 || (amountToSell > 0 && totalClaimed / amountToSell > 0.1);
    })
    .sort((a, b) => {
      const aClaimed = Number(a.totalClaimed) / Math.pow(10, a.decimals);
      const bClaimed = Number(b.totalClaimed) / Math.pow(10, b.decimals);
      return bClaimed - aClaimed;
    })
    .slice(0, 3);

  whaleTokens.forEach((token) => {
    notifications.push({
      text: `WHALE ALERT: ${formatAmount(token.totalClaimed, token.decimals)} ZEC SHIELDED`,
      color: 'text-[#d08700]',
    });
  });

  // Find tokens with claims processed (recently claimed tokens)
  const claimedTokens = tokens
    .filter((token) => {
      const totalClaimed = Number(token.totalClaimed);
      // Has claims and token exists
      return totalClaimed > 0 && token.tokenMint;
    })
    .sort((a, b) => {
      // Sort by most recently started (as proxy for recent activity)
      return Number(b.startTime) - Number(a.startTime);
    })
    .slice(0, 3);

  claimedTokens.forEach((token) => {
    const claimed = formatAmount(token.totalClaimed, token.decimals);
    notifications.push({
      text: `CLAIM PROCESSED: ${claimed} TOKENS BRIDGED TO SOLANA`,
      color: 'text-white',
    });
  });

  // If no notifications, return default placeholder
  if (notifications.length === 0) {
    return [
      { text: 'NO ACTIVE SALES', color: 'text-white' },
    ];
  }

  return notifications;
}

export const Notification = () => {
  if (SOL_NETWORK !== 'mainnet') {
    return null;
  }

  const [mounted, setMounted] = useState(false);
  const { tokens, isLoading } = useOnChainTokens();

  useEffect(() => {
    setMounted(true);
  }, []);

  const notifications = useMemo(() => {
    if (!mounted || isLoading || tokens.length === 0) {
      return [];
    }
    return generateNotifications(tokens);
  }, [tokens, isLoading, mounted]);

  // Duplicate notifications for seamless loop
  const duplicatedNotifications = notifications.length > 0 
    ? [...notifications, ...notifications] 
    : [];

  const hasNotifications = duplicatedNotifications.length > 0;
  
  // Top position: 72px (header height) - Warning only shows on devnet, so this is always just header
  const topPosition = 'top-[72px]';

  return (
    <div className={`w-full overflow-hidden absolute left-0 right-0 ${topPosition} z-40 min-h-[48px] ${hasNotifications ? 'bg-[rgba(208,135,0,0.09)] border-b border-[#d08700]' : ''}`}>
      <div className={`flex gap-6 items-center py-3 px-4 md:px-8 whitespace-nowrap min-h-[48px] ${hasNotifications ? 'animate-marquee' : ''}`}>
        {hasNotifications && (
          duplicatedNotifications.map((notification, index) => (
            <div key={index} className="flex items-center gap-6 shrink-0">
              <span
                className={`font-rajdhani font-bold text-base leading-6 ${notification.color} whitespace-nowrap`}
              >
                {notification.text}
              </span>
              {index < duplicatedNotifications.length - 1 && <SeparatorIcon />}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
