import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  fetchAvailableTokens,
  getZecToken,
  convertToUnit,
  calculateBasisPoints,
  getRefundAddress,
  createSwapQuote,
  checkSwapStatus,
  type OneClickToken,
} from '@/lib/oneclick';
import { checkLaunchAvailability, createEscrowQuote } from '@/lib/tee-client';
import { Token } from '@/types/token';
import { DepositState, TicketPayment } from '@/types/trading';
import { PRIVACY_FEE_PERCENT, SWAP_STATUS_POLL_INTERVAL } from '@/lib/trading-constants';

const initialDepositState: DepositState = {
  depositAmount: '',
  depositAddress: null,
  depositMemo: null,
  purchaseInfo: null,
  swapStatus: null,
  isGeneratingAddress: false,
  isSettling: false,
  isLoadingPurchaseInfo: false,
  isCheckingStatus: false,
  isGeneratingTicket: false,
  lastCheckedAt: null,
  ticketData: null,
  nearTxHash: null,
  depositFlowState: 'initial',
  availableTokens: [],
  selectedBlockchain: 'Chain',
  selectedToken: null,
  loadingTokens: true,
  showBlockchainDropdown: false,
  availability: null,
  loadingAvailability: false,
  showTokenDropdown: false,
  zecToken: null,
  ticketQuantity: 1,
  ticketPayments: [],
  currentTicketIndex: 0,
  completedTickets: [],
};

export const useDepositWorkflow = (token: Token, publicKey: any) => {
  const [depositState, setDepositState] = useState<DepositState>(initialDepositState);
  const statusPollIntervalsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    const loadTokens = async () => {
      try {
        setDepositState((prev) => ({ ...prev, loadingTokens: true }));
        const [tokens, zec] = await Promise.all([fetchAvailableTokens(), getZecToken()]);
        setDepositState((prev) => ({
          ...prev,
          availableTokens: tokens,
          zecToken: zec,
          loadingTokens: false,
        }));
      } catch (error) {
        console.error('Error loading tokens:', error);
        toast.error('Failed to load available tokens');
        setDepositState((prev) => ({ ...prev, loadingTokens: false }));
      }
    };
    loadTokens();
  }, []);

  useEffect(() => {
    const fetchAvailability = async () => {
      if (!token.name || !token.amountToSell) return;

      try {
        setDepositState((prev) => ({ ...prev, loadingAvailability: true }));
        const availability = await checkLaunchAvailability({
          launchId: token.name,
          amountToSell: Number(token.amountToSell),
          pricePerToken: Number(token.pricePerToken),
        });
        setDepositState((prev) => ({
          ...prev,
          availability: {
            tokensAvailable: availability.tokensAvailable,
            totalTokensReserved: availability.totalTokensReserved,
            amountToSell: availability.amountToSell,
            maxUsdAvailable: availability.maxUsdAvailable,
            isSoldOut: availability.isSoldOut,
            ticketsCreated: availability.ticketsCreated,
          },
          loadingAvailability: false,
        }));
      } catch (error) {
        console.error('[Availability] Error fetching:', error);
        setDepositState((prev) => ({ ...prev, loadingAvailability: false }));
      }
    };
    fetchAvailability();
  }, [token.name, token.amountToSell, token.pricePerToken]);

  const fetchPurchaseInfo = useCallback(
    async (amount: string) => {
      if (!amount || parseFloat(amount) <= 0) {
        setDepositState((prev) => ({ ...prev, purchaseInfo: null }));
        return;
      }

      if (!depositState.selectedToken || !depositState.zecToken) {
        setDepositState((prev) => ({ ...prev, purchaseInfo: null, isLoadingPurchaseInfo: false }));
        return;
      }

      try {
        setDepositState((prev) => ({ ...prev, isLoadingPurchaseInfo: true }));

        const creatorWallet = token.creatorWallet;

        if (!creatorWallet || creatorWallet.trim() === '') {
          console.warn('Creator wallet not found in token metadata');
          setDepositState((prev) => ({
            ...prev,
            purchaseInfo: null,
            isLoadingPurchaseInfo: false,
          }));
          return;
        }

        const amountInSmallestUnit = convertToUnit(amount, depositState.selectedToken.decimals);
        const refundAddress = getRefundAddress(depositState.selectedBlockchain);
        if (!refundAddress) {
          toast.error('Refund address not configured for selected blockchain');
          setDepositState((prev) => ({
            ...prev,
            purchaseInfo: null,
            isLoadingPurchaseInfo: false,
          }));
          return;
        }

        const feeAmount = parseFloat(amount) * PRIVACY_FEE_PERCENT;
        const feeBasisPoints = calculateBasisPoints(feeAmount, parseFloat(amount));

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

        const amountInUsd = parseFloat(amount) * depositState.selectedToken.price;
        const pricePerTokenMicroUsd = Number(token.pricePerToken);
        const pricePerTokenInUsd = pricePerTokenMicroUsd / 1_000_000;
        const tokensToReceive = pricePerTokenInUsd > 0 ? amountInUsd / pricePerTokenInUsd : 0;

        const purchaseInfo = {
          expectedOut: quote.quote.amountOutFormatted,
          minAmountOut: quote.quote.minAmountOut,
          timeEstimate: quote.quote.timeEstimate || 60,
          amountInUsd: quote.quote.amountInUsd,
          estimatedValueUsd: quote.quote.amountOutUsd || quote.quote.amountInUsd,
          tokensToReceive: tokensToReceive.toString(),
        };

        setDepositState((prev) => ({ ...prev, purchaseInfo, isLoadingPurchaseInfo: false }));
      } catch (error) {
        console.error('Error fetching purchase info:', error);
        toast.error('Failed to fetch swap quote. Please try again.');
        setDepositState((prev) => ({ ...prev, purchaseInfo: null, isLoadingPurchaseInfo: false }));
      }
    },
    [token, depositState.selectedToken, depositState.zecToken, depositState.selectedBlockchain],
  );

  const handleDepositAmountChange = useCallback(
    (value: string) => {
      const raw = value.replace(/,/g, '');
      if (/^\d*\.?\d*$/.test(raw)) {
        setDepositState((prev) => ({ ...prev, depositAmount: raw }));
        if (raw && parseFloat(raw) > 0) {
          fetchPurchaseInfo(raw);
        } else {
          setDepositState((prev) => ({ ...prev, purchaseInfo: null }));
        }
      }
    },
    [fetchPurchaseInfo],
  );

  const handleQuantityChange = useCallback(
    (newQuantity: number) => {
      if (newQuantity < 1) return;

      if (depositState.availability) {
        const ticketsLeft =
          Number(token.totalTickets) - (depositState.availability.ticketsCreated || 0);
        if (newQuantity > ticketsLeft) {
          toast.error(`Only ${ticketsLeft} ticket(s) available`);
          return;
        }
      }

      setDepositState((prev) => ({ ...prev, ticketQuantity: newQuantity }));
    },
    [depositState.availability, token.totalTickets],
  );

  const handleTicketSelection = useCallback(
    (ticketIndex: number) => {
      const ticket = depositState.ticketPayments[ticketIndex];
      if (!ticket || ticket.status === 'completed') {
        return;
      }

      setDepositState((prev) => ({
        ...prev,
        currentTicketIndex: ticketIndex,
        depositAddress: ticket.depositAddress,
        depositMemo: ticket.depositMemo,
        purchaseInfo: ticket.purchaseInfo,
      }));
    },
    [depositState.ticketPayments],
  );

  useEffect(() => {
    return () => {
      statusPollIntervalsRef.current.forEach((interval) => {
        clearInterval(interval);
      });
      statusPollIntervalsRef.current.clear();
    };
  }, []);

  return {
    depositState,
    setDepositState,
    fetchPurchaseInfo,
    handleDepositAmountChange,
    handleQuantityChange,
    handleTicketSelection,
    statusPollIntervalsRef,
  };
};
