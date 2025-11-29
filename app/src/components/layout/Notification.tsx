'use client';

import { useEffect, useState } from 'react';

const notifications = [
  { text: 'CLAIM PROCESSED: 5,000 TOKENS BRIDGED TO SOLANA', color: 'text-white' },
  { text: 'WHALE ALERT: 1,000 ZEC SHIELDED', color: 'text-[#d08700]' },
  { text: 'SALE OPENED: DARKFI DEX ($DARK)', color: 'text-white' },
];

const SeparatorIcon = () => (
  <div className="w-4 h-5 shrink-0 flex items-center justify-center gap-1">
    <div className="w-[2px] h-3 bg-white -rotate-30 origin-center"></div>
    <div className="w-[2px] h-3 bg-white -rotate-30 origin-center"></div>
  </div>
);

export const Notification = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Duplicate notifications for seamless loop
  const duplicatedNotifications = [...notifications, ...notifications];

  return (
    <div className="bg-[rgba(208,135,0,0.09)] border-b border-[#d08700] w-full overflow-hidden relative mt-[64px] z-40">
      <div className="flex gap-6 items-center py-3 px-4 md:px-8 animate-marquee whitespace-nowrap">
        {duplicatedNotifications.map((notification, index) => (
          <div key={index} className="flex items-center gap-6 shrink-0">
            <span
              className={`font-rajdhani font-bold text-base leading-6 ${notification.color} whitespace-nowrap`}
            >
              {notification.text}
            </span>
            {index < duplicatedNotifications.length - 1 && <SeparatorIcon />}
          </div>
        ))}
      </div>
    </div>
  );
};
