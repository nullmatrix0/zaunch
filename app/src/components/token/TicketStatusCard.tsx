'use client';

import { CheckCircle2, Loader2, AlertTriangle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TicketPayment } from '@/types/trading';

interface TicketStatusCardProps {
  ticket: TicketPayment;
  ticketIndex: number;
  onDownload: (ticketIndex: number) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function TicketStatusCard({
  ticket,
  ticketIndex,
  onDownload,
  isExpanded,
  onToggleExpand,
}: TicketStatusCardProps) {
  const getStatusIcon = () => {
    switch (ticket.status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'waiting-payment':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'confirming':
      case 'generating-proof':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Loader2 className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusLabel = () => {
    switch (ticket.status) {
      case 'completed':
        return 'Completed';
      case 'waiting-payment':
        return 'Waiting for Payment';
      case 'confirming':
        return 'Confirming Transaction';
      case 'generating-proof':
        return 'Generating Proof';
      case 'failed':
        return 'Failed';
      default:
        return 'Pending';
    }
  };

  const getStatusColor = () => {
    switch (ticket.status) {
      case 'completed':
        return 'border-green-700 bg-green-950/30';
      case 'waiting-payment':
        return 'border-orange-700 bg-orange-950/30';
      case 'confirming':
      case 'generating-proof':
        return 'border-blue-700 bg-blue-950/30';
      case 'failed':
        return 'border-red-700 bg-red-950/30';
      default:
        return 'border-gray-700 bg-gray-950/30';
    }
  };

  return (
    <div className={`border rounded p-4 ${getStatusColor()}`}>
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <div className="font-rajdhani font-bold text-sm text-white">
              Ticket #{ticket.ticketNumber}
            </div>
            <div className="text-xs text-gray-400">{getStatusLabel()}</div>
          </div>
        </div>
        {ticket.status === 'completed' && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onDownload(ticketIndex);
            }}
            className="shrink-0"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        )}
      </button>

      {isExpanded && ticket.ticketData && (
        <div className="mt-4 pt-4 border-t border-gray-700 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Claim Amount:</span>
            <span className="text-white font-bold">{ticket.ticketData.claimAmountFormatted}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Deposit Address:</span>
            <code className="text-gray-300 text-xs">{ticket.depositAddress.slice(0, 12)}...</code>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Created:</span>
            <span className="text-gray-300">
              {new Date(ticket.ticketData.createdAt).toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
