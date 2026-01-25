import { useCallback } from 'react';
import { toast } from 'sonner';
import {
  convertToUnit,
  calculateBasisPoints,
  getRefundAddress,
  createSwapQuote,
  checkSwapStatus,
} from '@/lib/oneclick';
import { createEscrowQuote } from '@/lib/tee-client';
import { Token } from '@/types/token';
import { DepositState, TicketPayment } from '@/types/trading';
import { PRIVACY_FEE_PERCENT, SWAP_STATUS_POLL_INTERVAL, TICKET_ADDRESS_GENERATION_DELAY } from '@/lib/trading-constants';

export const useTicketGeneration = (
  token: Token,
  publicKey: any,
  depositState: DepositState,
  setDepositState: React.Dispatch<React.SetStateAction<DepositState>>,
  statusPollIntervalsRef: React.MutableRefObject<Map<number, NodeJS.Timeout>>,
  generateTicketFromTEE: (
    depositAddress: string,
    swapStatus: any,
    ticketNumber?: number,
    escrowZAddress?: string | null,
    depositId?: string,
  ) => Promise<void>,
) => {
  const generateSingleTicketAddress = useCallback(
    async (ticketNumber: number, singleTicketAmount: string) => {
      if (!depositState.selectedToken || !depositState.zecToken) {
        return null;
      }

      const creatorWallet = token.creatorWallet;
      if (!creatorWallet || creatorWallet.trim() === '') {
        throw new Error('Creator wallet not found');
      }

      const amountInSmallestUnit = convertToUnit(
        singleTicketAmount,
        depositState.selectedToken.decimals,
      );

      const refundAddress = getRefundAddress(depositState.selectedBlockchain);
      if (!refundAddress) {
        throw new Error('Refund address not configured');
      }

      const feeAmount = parseFloat(singleTicketAmount) * PRIVACY_FEE_PERCENT;
      const feeBasisPoints = calculateBasisPoints(feeAmount, parseFloat(singleTicketAmount));

      const useEscrow =
        token.escrowEnabled &&
        token.minAmountToSell &&
        BigInt(token.minAmountToSell) > BigInt(0) &&
        publicKey;

      if (useEscrow) {
        try {
          console.log('[Escrow] Calling TEE /escrow/create-quote...');
          const escrowQuote = await createEscrowQuote({
            launchId: token.name,
            userSolanaWallet: publicKey.toBase58(),
            originAsset: depositState.selectedToken.assetId,
            amount: amountInSmallestUnit,
            refundTo: refundAddress,
            slippageTolerance: 100,
            appFees: [{ recipient: creatorWallet, fee: feeBasisPoints }],
          });

          console.log('[Escrow] ✅ TEE quote created successfully!');
          console.log('[Escrow] Escrow Z-address:', escrowQuote.escrowZAddress);
          console.log('[Escrow] Deposit address:', escrowQuote.depositAddress);
          console.log('[Escrow] Deposit ID:', escrowQuote.depositId);

          const purchaseInfo = {
            expectedOut: escrowQuote.amountOutFormatted || 'Unknown',
            minAmountOut: escrowQuote.amountOut || '0',
            timeEstimate: escrowQuote.timeEstimate || 60,
            amountInUsd: escrowQuote.amountInUsd || singleTicketAmount,
            estimatedValueUsd: escrowQuote.amountInUsd || singleTicketAmount,
          };

          return {
            ticketNumber,
            depositAddress: escrowQuote.depositAddress || '',
            depositMemo: escrowQuote.depositMemo || null,
            depositAmount: singleTicketAmount,
            purchaseInfo,
            swapStatus: null,
            ticketData: null,
            teeResult: null,
            status: 'waiting-payment' as const,
            escrowZAddress: escrowQuote.escrowZAddress,
            depositId: escrowQuote.depositId,
          };
        } catch (error) {
          console.error('[Escrow] ❌ TEE escrow quote failed:', error);
          console.error('[Escrow] ⚠️ FALLING BACK TO DIRECT CREATOR FLOW');
        }
      }

      console.log('[Escrow] Using direct flow - creator wallet as recipient');

      const quote = await createSwapQuote({
        originAsset: depositState.selectedToken.assetId,
        destinationAsset: depositState.zecToken.assetId,
        amount: amountInSmallestUnit,
        recipient: creatorWallet,
        refundTo: refundAddress,
        appFees: [
          {
            recipient: creatorWallet,
            fee: feeBasisPoints,
          },
        ],
      });

      const purchaseInfo = {
        expectedOut: quote.quote.amountOutFormatted,
        minAmountOut: quote.quote.minAmountOut,
        timeEstimate: quote.quote.timeEstimate || 60,
        amountInUsd: quote.quote.amountInUsd,
        estimatedValueUsd: quote.quote.amountOutUsd || quote.quote.amountInUsd,
      };

      return {
        ticketNumber,
        depositAddress: quote.quote.depositAddress,
        depositMemo: quote.quote.depositMemo || null,
        depositAmount: singleTicketAmount,
        purchaseInfo,
        swapStatus: null,
        ticketData: null,
        teeResult: null,
        status: 'waiting-payment' as const,
        escrowZAddress: null,
      };
    },
    [
      depositState.selectedToken,
      depositState.zecToken,
      depositState.selectedBlockchain,
      token.creatorWallet,
      token.escrowEnabled,
      token.minAmountToSell,
      token.name,
      publicKey,
    ],
  );

  const startStatusPolling = useCallback(
    (
      depositAddress: string,
      ticketIndex: number,
      escrowZAddress?: string | null,
      depositId?: string,
    ) => {
      const existingInterval = statusPollIntervalsRef.current.get(ticketIndex);
      if (existingInterval) {
        clearInterval(existingInterval);
      }

      setDepositState((prev) => ({
        ...prev,
        depositFlowState: prev.ticketQuantity > 1 ? 'multi-ticket' : 'detecting',
      }));

      setDepositState((prev) => {
        const updatedPayments = [...prev.ticketPayments];
        if (updatedPayments[ticketIndex]) {
          updatedPayments[ticketIndex] = {
            ...updatedPayments[ticketIndex],
            status: 'confirming',
          };
        }
        return { ...prev, ticketPayments: updatedPayments };
      });

      const interval = setInterval(async () => {
        try {
          const status = await checkSwapStatus(depositAddress);

          setDepositState((prev) => {
            const updatedPayments = [...prev.ticketPayments];
            if (updatedPayments[ticketIndex]) {
              updatedPayments[ticketIndex] = {
                ...updatedPayments[ticketIndex],
                swapStatus: status,
              };
            }
            return { ...prev, ticketPayments: updatedPayments, lastCheckedAt: Date.now() };
          });

          console.log(`[Swap Status] Ticket ${ticketIndex + 1}: ${status.status}`, status);

          if (status.isComplete) {
            const intervalToClear = statusPollIntervalsRef.current.get(ticketIndex);
            if (intervalToClear) {
              clearInterval(intervalToClear);
              statusPollIntervalsRef.current.delete(ticketIndex);
            }

            if (status.isSuccess) {
              setDepositState((prev) => {
                const updatedPayments = [...prev.ticketPayments];
                if (updatedPayments[ticketIndex]) {
                  updatedPayments[ticketIndex] = {
                    ...updatedPayments[ticketIndex],
                    status: 'generating-proof',
                  };
                }
                return { ...prev, ticketPayments: updatedPayments };
              });

              const ticketNumber = ticketIndex + 1;
              generateTicketFromTEE(
                depositAddress,
                status,
                ticketNumber,
                escrowZAddress,
                depositId,
              );
            } else if (status.isFailed) {
              toast.error(`Ticket ${ticketIndex + 1} swap failed with status: ${status.status}`);
              setDepositState((prev) => {
                const updatedPayments = [...prev.ticketPayments];
                if (updatedPayments[ticketIndex]) {
                  updatedPayments[ticketIndex] = {
                    ...updatedPayments[ticketIndex],
                    status: 'waiting-payment',
                  };
                }
                return { ...prev, ticketPayments: updatedPayments };
              });
            } else if (status.status === 'REFUNDED') {
              toast.info(`Ticket ${ticketIndex + 1} payment was refunded to your wallet.`);
              setDepositState((prev) => {
                const updatedPayments = [...prev.ticketPayments];
                if (updatedPayments[ticketIndex]) {
                  updatedPayments[ticketIndex] = {
                    ...updatedPayments[ticketIndex],
                    status: 'waiting-payment',
                  };
                }
                return { ...prev, ticketPayments: updatedPayments };
              });
            } else if (status.status === 'INCOMPLETE_DEPOSIT') {
              toast.error(
                `Ticket ${ticketIndex + 1}: Incomplete deposit. Please send the exact amount.`,
              );
              setDepositState((prev) => {
                const updatedPayments = [...prev.ticketPayments];
                if (updatedPayments[ticketIndex]) {
                  updatedPayments[ticketIndex] = {
                    ...updatedPayments[ticketIndex],
                    status: 'waiting-payment',
                  };
                }
                return { ...prev, ticketPayments: updatedPayments };
              });
            }
          }
        } catch (error) {
          console.error(`Error polling swap status for ticket ${ticketIndex + 1}:`, error);
        }
      }, SWAP_STATUS_POLL_INTERVAL);

      statusPollIntervalsRef.current.set(ticketIndex, interval);
    },
    [generateTicketFromTEE, setDepositState, statusPollIntervalsRef],
  );

  const handleGenerateDepositAddress = useCallback(async () => {
    if (!depositState.selectedToken) {
      toast.error('Please select a payment token');
      return;
    }

    if (!depositState.depositAmount || parseFloat(depositState.depositAmount) <= 0) {
      toast.error('Ticket price not calculated. Please reselect token.');
      return;
    }

    if (!depositState.zecToken) {
      toast.error('ZEC token not available. Please try again later.');
      return;
    }

    if (depositState.availability?.isSoldOut) {
      toast.error('This launch is sold out. No more tickets available.');
      return;
    }

    if (depositState.availability) {
      const ticketsLeft =
        Number(token.totalTickets) - (depositState.availability.ticketsCreated || 0);
      if (depositState.ticketQuantity > ticketsLeft) {
        toast.error(`Only ${ticketsLeft} ticket(s) available. Please reduce quantity.`);
        return;
      }
    }

    try {
      setDepositState((prev) => ({ ...prev, isGeneratingAddress: true }));

      const ticketPriceUsd = Number(token.pricePerTicket) / 1_000_000;
      const singleTicketPriceInToken = ticketPriceUsd / depositState.selectedToken.price;
      const singleTicketAmount = singleTicketPriceInToken.toFixed(8);

      console.log(
        `[Multi-Ticket] Generating addresses for all ${depositState.ticketQuantity} tickets (sequentially)`,
      );

      const validTickets: TicketPayment[] = [];
      for (let i = 0; i < depositState.ticketQuantity; i++) {
        const ticketNumber = i + 1;
        console.log(
          `[Multi-Ticket] Generating address for ticket ${ticketNumber}/${depositState.ticketQuantity}...`,
        );

        const ticket = await generateSingleTicketAddress(ticketNumber, singleTicketAmount);
        if (ticket !== null) {
          validTickets.push(ticket);
        }

        if (i < depositState.ticketQuantity - 1) {
          await new Promise((resolve) => setTimeout(resolve, TICKET_ADDRESS_GENERATION_DELAY));
        }
      }

      if (validTickets.length !== depositState.ticketQuantity) {
        throw new Error(
          `Failed to generate all ticket addresses. Generated ${validTickets.length}/${depositState.ticketQuantity}`,
        );
      }

      const firstTicket = validTickets[0];
      if (!firstTicket) {
        throw new Error('Failed to generate first ticket');
      }

      setDepositState((prev) => ({
        ...prev,
        ticketPayments: validTickets,
        currentTicketIndex: 0,
        depositAddress: firstTicket.depositAddress,
        depositMemo: firstTicket.depositMemo,
        purchaseInfo: firstTicket.purchaseInfo,
        isGeneratingAddress: false,
        depositFlowState: depositState.ticketQuantity > 1 ? 'multi-ticket' : 'qr-code',
      }));

      validTickets.forEach((ticket, index) => {
        startStatusPolling(ticket.depositAddress, index, ticket.escrowZAddress, ticket.depositId);
      });

      toast.success(
        depositState.ticketQuantity > 1
          ? `All ${depositState.ticketQuantity} tickets ready! Choose which one to pay for first.`
          : `Deposit address generated! Send ${singleTicketAmount} ${depositState.selectedToken.symbol}`,
      );
    } catch (error) {
      console.error('Error generating deposit addresses:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate deposit addresses');
      setDepositState((prev) => ({ ...prev, isGeneratingAddress: false }));
    }
  }, [
    depositState.depositAmount,
    depositState.selectedToken,
    depositState.zecToken,
    depositState.availability,
    depositState.ticketQuantity,
    token,
    generateSingleTicketAddress,
    startStatusPolling,
    setDepositState,
  ]);

  return {
    generateSingleTicketAddress,
    startStatusPolling,
    handleGenerateDepositAddress,
  };
};
