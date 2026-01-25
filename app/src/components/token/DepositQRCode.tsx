'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface DepositQRCodeProps {
  depositAddress: string;
  depositMemo?: string | null;
  depositAmount: string;
  tokenSymbol: string;
  blockchain: string;
}

export function DepositQRCode({
  depositAddress,
  depositMemo,
  depositAmount,
  tokenSymbol,
  blockchain,
}: DepositQRCodeProps) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const getExplorerUrl = () => {
    if (blockchain === 'Bitcoin') return `https://blockchair.com/bitcoin/address/${depositAddress}`;
    if (blockchain === 'Ethereum') return `https://etherscan.io/address/${depositAddress}`;
    return null;
  };

  const explorerUrl = getExplorerUrl();

  return (
    <div className="bg-neutral-950 border border-gray-800 flex flex-col gap-4 items-center px-6 py-5 w-full">
      <div className="font-rajdhani font-bold text-sm text-white uppercase tracking-wide">
        Scan QR Code or Copy Address
      </div>

      <div className="bg-white p-4 rounded">
        <QRCodeSVG value={depositAddress} size={200} level="H" />
      </div>

      <div className="w-full space-y-3">
        <div className="bg-black/30 border border-gray-700 rounded p-3">
          <div className="text-xs text-gray-400 mb-1">Deposit Address</div>
          <div className="flex items-center justify-between gap-2">
            <code className="text-xs text-white break-all">{depositAddress}</code>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => copyToClipboard(depositAddress, 'Address')}
              className="shrink-0"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {depositMemo && (
          <div className="bg-black/30 border border-gray-700 rounded p-3">
            <div className="text-xs text-gray-400 mb-1">Memo/Tag (Required)</div>
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs text-orange-400 font-bold">{depositMemo}</code>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(depositMemo, 'Memo')}
                className="shrink-0"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="bg-black/30 border border-gray-700 rounded p-3">
          <div className="text-xs text-gray-400 mb-1">Amount to Send</div>
          <div className="text-sm text-white font-bold">
            {depositAmount} {tokenSymbol}
          </div>
        </div>
      </div>

      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300"
        >
          View on Block Explorer
          <ExternalLink className="w-3 h-3" />
        </a>
      )}

      <div className="text-xs text-gray-500 text-center">
        Send exactly {depositAmount} {tokenSymbol} to this address
        {depositMemo && ' with the memo/tag above'}. Your ticket will be generated automatically once
        the transaction is confirmed.
      </div>
    </div>
  );
}
