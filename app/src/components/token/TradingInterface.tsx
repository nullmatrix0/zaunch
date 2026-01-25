'use client';

import { useCallback, useState, memo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Types
import { TradingInterfaceProps } from '@/types/trading';

// Hooks
import {
  useTradingData,
  useDepositWorkflow,
  useTEEProof,
  useTicketGeneration,
} from '@/hooks/trading';

// Components
import { DepositQRCode } from './DepositQRCode';
import { TicketStatusCard } from './TicketStatusCard';
import { TokenSelector } from './TokenSelector';

// Utils
import { parseTime } from '@/lib/trading-utils';
import { downloadProofFromTEE } from '@/lib/tee-client';

function TradingInterfaceComponent({ token, address }: TradingInterfaceProps) {
  const { publicKey } = useWallet();

  // Local UI state - MUST be declared before any conditional returns
  const [expandedTicketIndex, setExpandedTicketIndex] = useState<number | null>(null);
  // Trading data hook
  const { state, fetchUserBalances } = useTradingData(token, address);

  // Deposit workflow hook
  const {
    depositState,
    setDepositState,
    handleDepositAmountChange,
    handleQuantityChange,
    handleTicketSelection,
    statusPollIntervalsRef,
  } = useDepositWorkflow(token, publicKey);

  // TEE proof hook
  const { generateTicketFromTEE, downloadTicketZip } = useTEEProof(
    token,
    address,
    publicKey,
    depositState,
    setDepositState,
    fetchUserBalances,
  );

  // Ticket generation hook
  const { handleGenerateDepositAddress } = useTicketGeneration(
    token,
    publicKey,
    depositState,
    setDepositState,
    statusPollIntervalsRef,
    generateTicketFromTEE,
  );

  // Time calculations
  const now = Date.now();
  const start = parseTime(token.startTime);
  const end = parseTime(token.endTime);
  const isSaleActive = now >= start && now < end;
  const isSaleEnded = now >= end;

  // Blockchain selection handler
  const handleBlockchainSelect = useCallback(
    (blockchain: string) => {
      setDepositState((prev) => ({
        ...prev,
        selectedBlockchain: blockchain,
        selectedToken: null,
        depositAmount: '',
        purchaseInfo: null,
      }));
    },
    [setDepositState],
  );

  // Token selection handler
  const handleTokenSelect = useCallback(
    (selectedToken: any) => {
      if (!token.pricePerTicket) {
        toast.error('Token price not available');
        return;
      }

      const ticketPriceUsd = Number(token.pricePerTicket) / 1_000_000;
      const tokenAmount = (ticketPriceUsd / selectedToken.price).toFixed(8);

      setDepositState((prev) => ({
        ...prev,
        selectedToken,
        depositAmount: tokenAmount,
      }));
    },
    [token.pricePerTicket, setDepositState],
  );

  // Download individual ticket
  const handleDownloadTicket = useCallback(
    async (ticketIndex: number) => {
      const ticket = depositState.ticketPayments[ticketIndex];
      if (!ticket?.teeResult) {
        toast.error('No proof data available for this ticket');
        return;
      }

      try {
        await downloadProofFromTEE(ticket.teeResult);
        toast.success(`Ticket #${ticket.ticketNumber} downloaded!`);
      } catch (error) {
        console.error('Error downloading ticket:', error);
        toast.error('Failed to download ticket');
      }
    },
    [depositState.ticketPayments],
  );

  // Reset deposit flow
  const resetDepositFlow = useCallback(() => {
    setDepositState((prev) => ({
      ...prev,
      depositFlowState: 'initial',
      depositAddress: null,
      depositMemo: null,
      ticketPayments: [],
      currentTicketIndex: 0,
      completedTickets: [],
    }));
  }, [setDepositState]);

  // Render availability badge
  const renderAvailabilityBadge = () => {
    if (!depositState.availability) return null;

    const { isSoldOut, ticketsCreated } = depositState.availability;
    const totalTickets = Number(token.totalTickets);
    const remaining = totalTickets - ticketsCreated;

    if (isSoldOut) {
      return (
        <div className="bg-red-950/30 border border-red-700 rounded p-3 text-center">
          <div className="font-rajdhani font-bold text-red-500">SOLD OUT</div>
          <div className="text-xs text-gray-400 mt-1">All tickets have been claimed</div>
        </div>
      );
    }

    return (
      <div className="bg-blue-950/30 border border-blue-700 rounded p-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">Tickets Available</span>
          <span className="font-rajdhani font-bold text-blue-400">
            {remaining}/{totalTickets}
          </span>
        </div>
      </div>
    );
  };

  // Render deposit form
  const renderDepositForm = () => {
    if (depositState.depositFlowState !== 'initial') return null;

    return (
      <div className="bg-neutral-950 border border-gray-800 flex flex-col gap-4 px-6 py-5 w-full">
        <div className="font-rajdhani font-bold text-sm text-white uppercase tracking-wide">
          Purchase with Privacy
        </div>

        {renderAvailabilityBadge()}

        {/* Token Selector */}
        <TokenSelector
          availableTokens={depositState.availableTokens}
          selectedBlockchain={depositState.selectedBlockchain}
          selectedToken={depositState.selectedToken}
          onBlockchainSelect={handleBlockchainSelect}
          onTokenSelect={handleTokenSelect}
          disabled={depositState.loadingTokens || depositState.availability?.isSoldOut}
        />

        {/* Quantity Selector */}
        {depositState.selectedToken && (
          <div className="space-y-2">
            <div className="text-xs text-gray-400">Number of Tickets</div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleQuantityChange(depositState.ticketQuantity - 1)}
                disabled={depositState.ticketQuantity <= 1}
              >
                -
              </Button>
              <input
                type="number"
                value={depositState.ticketQuantity}
                onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                className="flex-1 bg-black/30 border border-gray-700 rounded px-3 py-2 text-center text-white"
                min={1}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleQuantityChange(depositState.ticketQuantity + 1)}
              >
                +
              </Button>
            </div>
          </div>
        )}

        {/* Purchase Info */}
        {depositState.purchaseInfo && (
          <div className="bg-black/30 border border-gray-700 rounded p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Amount to Pay:</span>
              <span className="text-white font-bold">
                {depositState.depositAmount} {depositState.selectedToken?.symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">USD Value:</span>
              <span className="text-white">${depositState.purchaseInfo.amountInUsd}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Tokens to Receive:</span>
              <span className="text-white font-bold">
                {parseFloat(depositState.purchaseInfo.tokensToReceive).toFixed(2)}{' '}
                {token.tokenSymbol}
              </span>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <Button
          type="button"
          onClick={handleGenerateDepositAddress}
          disabled={
            !depositState.selectedToken ||
            depositState.isGeneratingAddress ||
            depositState.availability?.isSoldOut
          }
          className="w-full"
        >
          {depositState.isGeneratingAddress ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            `Generate Deposit Address (${depositState.ticketQuantity} ticket${depositState.ticketQuantity > 1 ? 's' : ''})`
          )}
        </Button>
      </div>
    );
  };

  // Render QR code view
  const renderQRCodeView = () => {
    if (
      depositState.depositFlowState !== 'qr-code' &&
      depositState.depositFlowState !== 'detecting'
    ) {
      return null;
    }

    if (!depositState.depositAddress || !depositState.selectedToken) return null;

    return (
      <>
        <DepositQRCode
          depositAddress={depositState.depositAddress}
          depositMemo={depositState.depositMemo}
          depositAmount={depositState.depositAmount}
          tokenSymbol={depositState.selectedToken.symbol}
          blockchain={depositState.selectedBlockchain}
        />

        <Button type="button" onClick={resetDepositFlow} variant="outline" className="w-full">
          Cancel & Start Over
        </Button>
      </>
    );
  };

  // Render multi-ticket view
  const renderMultiTicketView = () => {
    if (depositState.depositFlowState !== 'multi-ticket') return null;

    const completedCount = depositState.completedTickets.length;
    const progress = (completedCount / depositState.ticketQuantity) * 100;

    return (
      <div className="bg-neutral-950 border border-gray-800 flex flex-col gap-4 px-6 py-5 w-full">
        {/* Progress Header */}
        <div className="bg-orange-950/30 border border-orange-700 rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-rajdhani font-bold text-sm text-orange-500">
              MULTI-TICKET PURCHASE
            </div>
            <div className="font-rajdhani font-bold text-xs text-orange-500">
              {completedCount}/{depositState.ticketQuantity} COMPLETED
            </div>
          </div>
          <div className="w-full bg-black/30 rounded-full h-2 overflow-hidden">
            <div
              className="bg-orange-500 h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Ticket List */}
        <div className="space-y-2">
          {depositState.ticketPayments.map((ticket) => (
            <TicketStatusCard
              key={ticket.depositAddress}
              ticket={ticket}
              ticketIndex={ticket.ticketNumber - 1}
              onDownload={handleDownloadTicket}
              isExpanded={expandedTicketIndex === ticket.ticketNumber - 1}
              onToggleExpand={() =>
                setExpandedTicketIndex(
                  expandedTicketIndex === ticket.ticketNumber - 1 ? null : ticket.ticketNumber - 1,
                )
              }
            />
          ))}
        </div>

        {/* Actions */}
        {completedCount === depositState.ticketQuantity && (
          <Button type="button" onClick={resetDepositFlow} className="w-full">
            Purchase More Tickets
          </Button>
        )}
      </div>
    );
  };

  // Render success view
  const renderSuccessView = () => {
    if (depositState.depositFlowState !== 'success') return null;

    return (
      <div className="bg-neutral-950 border border-gray-800 flex flex-col gap-4 px-6 py-5 w-full">
        <div className="bg-green-950/30 border border-green-700 rounded p-4 text-center">
          <div className="font-rajdhani font-bold text-green-500 text-lg mb-2">
            ✓ Ticket Generated Successfully!
          </div>
          <div className="text-xs text-gray-400">Your ticket has been generated and saved.</div>
        </div>

        {depositState.ticketData && (
          <div className="bg-black/30 border border-gray-700 rounded p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Claim Amount:</span>
              <span className="text-white font-bold">
                {depositState.ticketData.claimAmountFormatted}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Proof Reference:</span>
              <code className="text-gray-300">{depositState.ticketData.proofReference}</code>
            </div>
          </div>
        )}

        <Button type="button" onClick={downloadTicketZip} className="w-full">
          Download Ticket
        </Button>

        <Button type="button" onClick={resetDepositFlow} variant="outline" className="w-full">
          Purchase Another Ticket
        </Button>
      </div>
    );
  };

  // Sale status check
  if (!isSaleActive && !isSaleEnded) {
    return (
      <div className="bg-neutral-950 border border-gray-800 flex flex-col gap-4 px-6 py-5 w-full">
        <div className="text-center text-gray-400">Sale has not started yet</div>
      </div>
    );
  }

  if (isSaleEnded) {
    return (
      <div className="bg-neutral-950 border border-gray-800 flex flex-col gap-4 px-6 py-5 w-full">
        <div className="text-center text-gray-400">Sale has ended</div>
      </div>
    );
  }

  // Main render
  return (
    <div className="space-y-4">
      {renderDepositForm()}
      {renderQRCodeView()}
      {renderMultiTicketView()}
      {renderSuccessView()}
    </div>
  );
}

export const TradingInterface = memo(TradingInterfaceComponent);
