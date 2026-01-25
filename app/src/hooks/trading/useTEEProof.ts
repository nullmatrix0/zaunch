import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  generateProofFromTEE,
  downloadProofFromTEE,
  TEEProofResult,
  getFormattedClaimAmount,
  checkLaunchAvailability,
} from '@/lib/tee-client';
import { saveTicket, TicketReference } from '@/lib/ticket-storage';
import { Token } from '@/types/token';
import { TicketData, DepositState } from '@/types/trading';
import { StatusResponse } from '@/lib/oneclick';

export const useTEEProof = (
  token: Token,
  address: string,
  publicKey: any,
  depositState: DepositState,
  setDepositState: React.Dispatch<React.SetStateAction<DepositState>>,
  fetchUserBalances: () => void,
) => {
  const [teeResult, setTeeResult] = useState<TEEProofResult | null>(null);

  const generateTicketFromTEE = useCallback(
    async (
      depositAddress: string,
      swapStatus: StatusResponse,
      ticketNumber?: number,
      escrowZAddress?: string | null,
      depositId?: string,
    ) => {
      setDepositState((prev) => ({
        ...prev,
        depositFlowState: prev.ticketQuantity > 1 ? 'multi-ticket' : 'generating-ticket',
        isGeneratingTicket: true,
      }));

      try {
        console.log('[TEE] Starting proof generation for deposit:', depositAddress);
        console.log('[TEE] Ticket number:', ticketNumber || 1);
        console.log('[TEE] Escrow Z-address:', escrowZAddress || 'NOT SET');
        console.log('[TEE] Deposit ID:', depositId || 'NOT SET');

        const tokensForThisTicket = BigInt(token.tokensPerProof);

        const result = await generateProofFromTEE({
          depositAddress: depositAddress,
          creatorAddress: token.creatorWallet || '',
          launchPda: address,
          userPubkey: publicKey?.toBase58() || '',
          launchId: token.name,
          tokenMint: token.tokenMint,
          tokenSymbol: token.tokenSymbol,
          pricePerToken: token.pricePerToken.toString(),
          amountToSell: token.amountToSell.toString(),
          decimals: token.decimals,
          tokensPerProof: tokensForThisTicket.toString(),
          escrowZAddress: escrowZAddress,
          depositId: depositId,
        });

        if (!result.verification?.verified) {
          const errorMsg = result.verification?.error || result.error || 'Verification failed';
          console.error('[TEE] Verification failed:', errorMsg);
          toast.error(`Verification failed: ${errorMsg}`);
          setDepositState((prev) => ({
            ...prev,
            depositFlowState: 'detecting',
            isGeneratingTicket: false,
          }));
          return;
        }

        setTeeResult(result);

        try {
          const ticketRef: TicketReference = {
            id: result.metadata.proofReference || `ticket_${Date.now()}`,
            launchAddress: address,
            launchName: token.name || result.metadata.launchId || 'Unknown',
            tokenSymbol: token.tokenSymbol || result.metadata.tokenSymbol || 'TOKEN',
            claimAmount: result.metadata.claimAmount || '0',
            depositAddress: result.metadata.depositAddress || depositAddress,
            depositId: result.metadata.depositId,
            createdAt: Date.now(),
            status: 'pending',
            tokenImageUri: token.tokenUri,
          };
          saveTicket(ticketRef);
          console.log('[Ticket Storage] Saved ticket reference:', ticketRef);
        } catch (storageError) {
          console.error('[Ticket Storage] Failed to save ticket:', storageError);
        }

        const swapAmountOut =
          swapStatus.receivedAmountFormatted ||
          swapStatus.swapDetails?.amountOutFormatted ||
          depositState.purchaseInfo?.expectedOut ||
          '0';

        const ticketData: TicketData = {
          proofReference: result.metadata.proofReference,
          depositAddress: result.metadata.depositAddress,
          swapAmountIn: result.metadata.swapAmountIn,
          swapAmountOut: swapAmountOut,
          swapAmountUsd: result.metadata.swapAmountUsd,
          claimAmount: result.metadata.claimAmount,
          claimAmountFormatted: getFormattedClaimAmount(result, token.decimals),
          createdAt: result.metadata.createdAt,
          launchId: result.metadata.launchId,
          launchPda: result.metadata.launchPda,
          tokenMint: result.metadata.tokenMint,
          tokenSymbol: result.metadata.tokenSymbol,
          pricePerToken: result.metadata.pricePerToken,
          depositId: result.metadata.depositId,
        };

        console.log('[TEE] Proof generated successfully:', {
          proofReference: ticketData.proofReference,
          claimAmount: ticketData.claimAmount,
          claimAmountFormatted: ticketData.claimAmountFormatted,
          ticketNumber: ticketNumber || 1,
        });

        setDepositState((prev) => {
          const updatedPayments = [...prev.ticketPayments];
          const ticketIndex = updatedPayments.findIndex((t) => t.depositAddress === depositAddress);

          if (ticketIndex !== -1 && updatedPayments[ticketIndex]) {
            updatedPayments[ticketIndex] = {
              ...updatedPayments[ticketIndex],
              ticketData,
              teeResult: result,
              status: 'completed',
            };
          }

          const completedTickets = [...prev.completedTickets, ticketData];
          const allCompleted = updatedPayments.every((t) => t.status === 'completed');

          if (allCompleted) {
            return {
              ...prev,
              ticketPayments: updatedPayments,
              completedTickets,
              depositFlowState: 'success',
              ticketData,
              isGeneratingTicket: false,
            };
          } else {
            return {
              ...prev,
              ticketPayments: updatedPayments,
              completedTickets,
              isGeneratingTicket: false,
            };
          }
        });

        try {
          const updatedAvailability = await checkLaunchAvailability({
            launchId: token.name,
            amountToSell: Number(token.amountToSell),
            pricePerToken: Number(token.pricePerToken),
          });
          setDepositState((prev) => ({
            ...prev,
            availability: {
              tokensAvailable: updatedAvailability.tokensAvailable,
              totalTokensReserved: updatedAvailability.totalTokensReserved,
              amountToSell: updatedAvailability.amountToSell,
              maxUsdAvailable: updatedAvailability.maxUsdAvailable,
              isSoldOut: updatedAvailability.isSoldOut,
              ticketsCreated: updatedAvailability.ticketsCreated,
            },
          }));
        } catch (e) {
          console.error('[Availability] Failed to refresh after ticket:', e);
        }

        const allTicketsCompleted = depositState.ticketPayments.every(
          (t) => t.status === 'completed',
        );

        if (allTicketsCompleted) {
          toast.success('All tickets generated successfully!');
          fetchUserBalances();
        } else {
          toast.success(
            `Ticket ${ticketNumber || 1} generated! You can continue with other tickets.`,
          );
          fetchUserBalances();
        }
      } catch (error) {
        console.error('[TEE] Error generating ticket:', error);
        toast.error(
          `Failed to generate ticket: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        setDepositState((prev) => ({
          ...prev,
          depositFlowState: depositState.ticketQuantity > 1 ? 'multi-ticket' : 'detecting',
          isGeneratingTicket: false,
        }));
      }
    },
    [
      token,
      address,
      publicKey,
      depositState.purchaseInfo,
      depositState.ticketPayments,
      depositState.ticketQuantity,
      fetchUserBalances,
      setDepositState,
    ],
  );

  const downloadTicketZip = useCallback(async () => {
    if (!teeResult) {
      toast.error('No proof data to download. Please generate a ticket first.');
      return;
    }

    try {
      await downloadProofFromTEE(teeResult);
      toast.success('Proof ticket downloaded!');
    } catch (error) {
      console.error('Error downloading ticket:', error);
      toast.error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [teeResult]);

  return {
    teeResult,
    generateTicketFromTEE,
    downloadTicketZip,
  };
};
