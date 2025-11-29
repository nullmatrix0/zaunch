'use client';

import React, { useEffect, useState } from 'react';
import { getIpfsUrl } from '@/lib/utils';

interface TokenCreationModalProps {
  isVisible: boolean;
  stepMessage: string;
  subMessage?: string;
  progress: number;
  tokenLogo?: string;
  startTime?: number;
}

export default function TokenCreationModal({
  isVisible,
  stepMessage,
  subMessage,
  progress,
  tokenLogo,
  startTime,
}: TokenCreationModalProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!isVisible || !startTime) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, startTime]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black border border-[rgba(255,255,255,0.1)] rounded-lg p-6 max-w-[360px] w-full shadow-2xl">
        <div className="text-center">
          {/* Token Logo */}
          {tokenLogo && (
            <div className="flex justify-center mb-4">
              <img
                src={getIpfsUrl(tokenLogo)}
                alt="Token Logo"
                className="h-16 w-16 rounded-full object-cover border-2 border-[#d08700] animate-pulse"
                onError={(e) => {
                  // Fallback to default icon if image fails to load
                  const target = e.currentTarget as HTMLImageElement;
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (target && fallback) {
                    target.style.display = 'none';
                    fallback.style.display = 'flex';
                  }
                }}
              />
              <div
                className="h-16 w-16 bg-[rgba(255,255,255,0.1)] rounded-full flex items-center justify-center text-[#d08700] text-xl font-bold border border-[#d08700] font-share-tech-mono"
                style={{ display: 'none' }}
              >
                T
              </div>
            </div>
          )}

          {/* Current Step Message */}
          <h3 className="text-lg font-semibold text-white mb-2 font-share-tech-mono uppercase">
            {stepMessage}
          </h3>
          <p className="text-sm text-gray-400 mb-6 font-share-tech-mono">{subMessage}</p>

          {/* Horizontal Progress Bar */}
          <div className="w-full bg-[rgba(255,255,255,0.1)] rounded-full h-2 mb-2">
            <div
              className="bg-[#d08700] h-2 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(208,135,0,0.5)]"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-400 font-share-tech-mono">
              {Math.round(progress)}% complete
            </p>
            {/* Elapsed Time */}
            {startTime && elapsedTime > 0 && (
              <p className="text-sm text-[#d08700] font-medium font-share-tech-mono">
                {formatTime(elapsedTime)}
              </p>
            )}
          </div>

          {/* Warning Message */}
          <p className="text-xs text-gray-500 font-share-tech-mono border-t border-[rgba(255,255,255,0.1)] pt-3">
            Please don't close this window during deployment.
          </p>
        </div>
      </div>
    </div>
  );
}
