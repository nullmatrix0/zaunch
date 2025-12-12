'use client';

import { useState, useEffect } from 'react';
import { Shield, Target, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { getEscrowStatus, EscrowStatus } from '@/lib/tee-client';

interface EscrowStatusCardProps {
  launchId: string;
  saleEndTime: number;
  className?: string;
}

export default function EscrowStatusCard({
  launchId,
  saleEndTime,
  className = '',
}: EscrowStatusCardProps) {
  const [escrowStatus, setEscrowStatus] = useState<EscrowStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasEnded = Date.now() > saleEndTime * 1000;

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setIsLoading(true);
        const status = await getEscrowStatus(launchId);
        setEscrowStatus(status);
        setError(null);
      } catch (err) {
        // Escrow not enabled for this sale
        setEscrowStatus(null);
        setError(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
    
    // Poll for updates every 30 seconds while sale is active
    if (!hasEnded) {
      const interval = setInterval(fetchStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [launchId, hasEnded]);

  // No escrow enabled
  if (!escrowStatus && !isLoading) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={`bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] p-4 rounded animate-pulse ${className}`}>
        <div className="h-4 w-32 bg-[rgba(255,255,255,0.1)] rounded" />
      </div>
    );
  }

  if (!escrowStatus) return null;

  // Calculate status
  const getStatusInfo = () => {
    if (!hasEnded) {
      return {
        icon: Clock,
        color: '#d08700',
        bgColor: 'rgba(208,135,0,0.1)',
        borderColor: 'rgba(208,135,0,0.3)',
        status: 'Sale Active',
        description: 'Funds held in escrow until sale ends',
      };
    }

    if (!escrowStatus.finalized) {
      return {
        icon: RefreshCw,
        color: '#79767d',
        bgColor: 'rgba(255,255,255,0.05)',
        borderColor: 'rgba(255,255,255,0.1)',
        status: 'Awaiting Finalization',
        description: 'Sale ended, processing results...',
      };
    }

    if (escrowStatus.goal_reached) {
      return {
        icon: CheckCircle,
        color: '#22c55e',
        bgColor: 'rgba(34,197,94,0.1)',
        borderColor: 'rgba(34,197,94,0.3)',
        status: 'Goal Reached ✓',
        description: 'Funds released to creator',
      };
    }

    return {
      icon: XCircle,
      color: '#dd3345',
      bgColor: 'rgba(221,51,69,0.1)',
      borderColor: 'rgba(221,51,69,0.3)',
      status: 'Goal Not Reached',
      description: 'Refunds available for buyers',
    };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div 
      className={`p-4 rounded ${className}`}
      style={{ 
        backgroundColor: statusInfo.bgColor, 
        borderWidth: '1px',
        borderColor: statusInfo.borderColor,
        borderStyle: 'solid'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: statusInfo.color }} />
          <span className="text-[14px] font-rajdhani font-bold" style={{ color: statusInfo.color }}>
            Platform Escrow
          </span>
        </div>
        <div className="flex items-center gap-1">
          <StatusIcon className="w-3 h-3" style={{ color: statusInfo.color }} />
          <span className="text-[12px] font-rajdhani font-bold" style={{ color: statusInfo.color }}>
            {statusInfo.status}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[11px] font-rajdhani mb-1">
          <span className="text-[#656565]">
            <Target className="w-3 h-3 inline mr-1" />
            Funding Progress
          </span>
          <span style={{ color: statusInfo.color }} className="font-bold">
            {escrowStatus.goal_progress_percent.toFixed(1)}%
          </span>
        </div>
        <div className="w-full h-2 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
          <div 
            className="h-full transition-all duration-500"
            style={{ 
              width: `${Math.min(100, escrowStatus.goal_progress_percent)}%`,
              backgroundColor: escrowStatus.goal_progress_percent >= 100 ? '#22c55e' : statusInfo.color 
            }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-[12px] font-rajdhani">
        <div className="bg-[rgba(0,0,0,0.2)] p-2 rounded">
          <span className="text-[#656565] block text-[10px]">Raised</span>
          <span className="text-white font-bold">${escrowStatus.total_usd.toFixed(2)}</span>
        </div>
        <div className="bg-[rgba(0,0,0,0.2)] p-2 rounded">
          <span className="text-[#656565] block text-[10px]">Goal</span>
          <span className="text-white font-bold">${escrowStatus.min_goal_usd.toFixed(2)}</span>
        </div>
      </div>

      {/* Description */}
      <p className="text-[11px] text-[#656565] font-rajdhani mt-2">
        {statusInfo.description}
      </p>
    </div>
  );
}
