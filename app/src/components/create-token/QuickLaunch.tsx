'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import TokenCreationModal from '@/components/ui/token-creation-modal';
import TokenSuccessModal from '@/components/ui/token-success-modal';
import URLInput from '@/components/ui/url-input';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { useDeployToken } from '@/hooks/useDeployToken';
import { getTokenInfo } from '@/lib/sol';
import { getIpfsUrl } from '@/lib/utils';

interface QuickLaunchProps {
  onCancel?: () => void;
}

export default function QuickLaunch({ onCancel }: QuickLaunchProps) {
  const walletSol = useWallet();
  const router = useRouter();
  const { publicKey } = walletSol;
  const { deployToken, deployWithExistingToken } = useDeployToken();
  const { prices } = useCryptoPrices();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isExistingToken, setIsExistingToken] = useState(false);

  const [formData, setFormData] = useState({
    // Step 1
    tokenName: '',
    tokenSymbol: '',
    tokenSupply: '1000000',
    decimal: '6',
    description: '',
    twitterUrl: '',
    websiteUrl: '',
    telegramUrl: '',
    existingMintAddress: '',
    // Step 2
    pricePerToken: '0.00001',
    minRaise: '50000',
    amountToBeSold: '100000',
    saleStartTime: '',
    saleEndTime: '',
    claimType: 'immediate', // 'immediate' | 'scheduled'
    claimOpeningTime: '',
    creatorWallet: '', // ZEC wallet address to receive funds from NEAR intents
  });

  // State for image uploads
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState<boolean>(false);

  // State for token preview
  const [tokenPreview, setTokenPreview] = useState<{
    name: string;
    symbol: string;
    image?: string;
    description?: string;
    website?: string;
    twitter?: string;
    telegram?: string;
    decimals: number;
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);

  // Validation function for website URL
  const isWebsiteValid = useMemo(() => {
    if (!formData.websiteUrl || !formData.websiteUrl.trim()) return true;

    const trimmed = formData.websiteUrl.trim();
    const withoutProto = trimmed.replace(/^https?:\/\//, '');
    if (!withoutProto) return false;

    const domainRegex =
      /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+.*$/;
    return domainRegex.test(withoutProto);
  }, [formData.websiteUrl]);

  // Get website validation error message
  const websiteErrorMessage = useMemo(() => {
    if (!formData.websiteUrl || !formData.websiteUrl.trim()) return null;
    if (isWebsiteValid) return null;
    return 'Please enter a valid website URL (e.g., example.com)';
  }, [formData.websiteUrl, isWebsiteValid]);

  // Validation function for Twitter URL
  const isTwitterValid = useMemo(() => {
    if (!formData.twitterUrl || !formData.twitterUrl.trim()) return true;

    const trimmed = formData.twitterUrl.trim();
    const raw = trimmed.replace(/^https?:\/\//, '').replace(/^(x\.com|twitter\.com)\//, '');
    const username = raw.replace(/[^A-Za-z0-9_]/g, '');

    if (username.length === 0) return false;
    if (username.length > 15) return false;
    return /^[A-Za-z0-9_]+$/.test(username);
  }, [formData.twitterUrl]);

  // Get Twitter validation error message
  const twitterErrorMessage = useMemo(() => {
    if (!formData.twitterUrl || !formData.twitterUrl.trim()) return null;
    if (isTwitterValid) return null;
    const trimmed = formData.twitterUrl.trim();
    const raw = trimmed.replace(/^https?:\/\//, '').replace(/^(x\.com|twitter\.com)\//, '');
    const username = raw.replace(/[^A-Za-z0-9_]/g, '');
    if (username.length === 0) return 'Please enter a valid Twitter username';
    if (username.length > 15) return 'Twitter username must be 15 characters or less';
    return 'Invalid Twitter username format';
  }, [formData.twitterUrl, isTwitterValid]);

  // Validation function for Telegram URL
  const isTelegramValid = useMemo(() => {
    if (!formData.telegramUrl || !formData.telegramUrl.trim()) return true;

    const trimmed = formData.telegramUrl.trim();
    const raw = trimmed
      .replace(/^https?:\/\//, '')
      .replace(/^(t\.me|telegram\.me|telegram\.org)\//, '');
    const handle = raw.replace(/[^A-Za-z0-9_]/g, '');

    return handle.length >= 5 && handle.length <= 32;
  }, [formData.telegramUrl]);

  // Get Telegram validation error message
  const telegramErrorMessage = useMemo(() => {
    if (!formData.telegramUrl || !formData.telegramUrl.trim()) return null;
    if (isTelegramValid) return null;
    const trimmed = formData.telegramUrl.trim();
    const raw = trimmed
      .replace(/^https?:\/\//, '')
      .replace(/^(t\.me|telegram\.me|telegram\.org)\//, '');
    const handle = raw.replace(/[^A-Za-z0-9_]/g, '');
    if (handle.length < 5) return 'Telegram handle must be at least 5 characters';
    if (handle.length > 32) return 'Telegram handle must be 32 characters or less';
    return 'Invalid Telegram handle format';
  }, [formData.telegramUrl, isTelegramValid]);

  // Validation function for Token Mint Address
  const isMintAddressValid = useMemo(() => {
    if (!isExistingToken) return true;
    if (!formData.existingMintAddress || !formData.existingMintAddress.trim()) return true;

    const trimmed = formData.existingMintAddress.trim();
    
    // Basic length check
    if (trimmed.length < 32 || trimmed.length > 44) {
      return false;
    }

    // Validate using Solana PublicKey
    try {
      const publicKey = new PublicKey(trimmed);
      // Check if it's a valid on-curve point
      return PublicKey.isOnCurve(publicKey);
    } catch {
      return false;
    }
  }, [formData.existingMintAddress, isExistingToken]);

  // Get mint address validation error message
  const mintAddressErrorMessage = useMemo(() => {
    if (!isExistingToken) return null;
    if (!formData.existingMintAddress || !formData.existingMintAddress.trim()) return null;
    if (isMintAddressValid) return null;
    const trimmed = formData.existingMintAddress.trim();
    if (trimmed.length < 32 || trimmed.length > 44) {
      return 'Token mint address must be between 32 and 44 characters';
    }
    return 'Invalid Solana mint address format';
  }, [formData.existingMintAddress, isMintAddressValid, isExistingToken]);

  // Get minimum datetime (now) for date inputs
  const getMinDateTime = useCallback(() => {
    const now = new Date();
    // Convert to local datetime string format (YYYY-MM-DDTHH:mm)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }, []);

  // Get minimum datetime for end time (start time + 1 hour)
  const getMinEndDateTime = useCallback(() => {
    if (!formData.saleStartTime) return getMinDateTime();
    const startTime = new Date(formData.saleStartTime);
    const minEndTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Add 1 hour
    // Convert to local datetime string format
    const year = minEndTime.getFullYear();
    const month = String(minEndTime.getMonth() + 1).padStart(2, '0');
    const day = String(minEndTime.getDate()).padStart(2, '0');
    const hours = String(minEndTime.getHours()).padStart(2, '0');
    const minutes = String(minEndTime.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }, [formData.saleStartTime, getMinDateTime]);

  // Get minimum datetime for claim opening time (end time + 1 second)
  const getMinClaimDateTime = useCallback(() => {
    if (!formData.saleEndTime) return getMinDateTime();
    const endTime = new Date(formData.saleEndTime);
    const minClaimTime = new Date(endTime.getTime() + 1000); // Just after end time
    // Convert to local datetime string format
    const year = minClaimTime.getFullYear();
    const month = String(minClaimTime.getMonth() + 1).padStart(2, '0');
    const day = String(minClaimTime.getDate()).padStart(2, '0');
    const hours = String(minClaimTime.getHours()).padStart(2, '0');
    const minutes = String(minClaimTime.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }, [formData.saleEndTime, getMinDateTime]);

  // Validate date ranges
  const dateValidationErrors = useMemo(() => {
    const errors: {
      saleEndTime?: string;
      claimOpeningTime?: string;
    } = {};

    if (formData.saleStartTime && formData.saleEndTime) {
      const startTime = new Date(formData.saleStartTime).getTime();
      const endTime = new Date(formData.saleEndTime).getTime();
      const now = Date.now();

      if (startTime < now) {
        // This will be handled by min attribute, but we can show a message
      }

      if (endTime <= startTime) {
        errors.saleEndTime = 'Sale end time must be after start time';
      } else {
        const duration = endTime - startTime;
        const oneHour = 60 * 60 * 1000;
        if (duration < oneHour) {
          errors.saleEndTime = 'Sale duration must be at least 1 hour';
        }
      }
    }

    if (formData.claimType === 'scheduled' && formData.saleEndTime && formData.claimOpeningTime) {
      const endTime = new Date(formData.saleEndTime).getTime();
      const claimTime = new Date(formData.claimOpeningTime).getTime();

      if (claimTime <= endTime) {
        errors.claimOpeningTime = 'Claim opening time must be after sale end time';
      }
    }

    return errors;
  }, [formData.saleStartTime, formData.saleEndTime, formData.claimOpeningTime, formData.claimType]);

  // Calculate SOL equivalent for price per token (when input is USD)
  const pricePerTokenSOL = useMemo(() => {
    if (!formData.pricePerToken || !prices.solana) return null;
    const priceUSD = parseFloat(formData.pricePerToken);
    if (isNaN(priceUSD)) return null;
    // Convert USD to SOL
    return priceUSD / prices.solana;
  }, [formData.pricePerToken, prices.solana]);

  // Fetch token preview when mint address is valid
  useEffect(() => {
    const fetchTokenPreview = async () => {
      if (!isExistingToken || !isMintAddressValid || !formData.existingMintAddress.trim()) {
        setTokenPreview(null);
        setIsLoadingPreview(false);
        return;
      }

      const trimmed = formData.existingMintAddress.trim();
      setIsLoadingPreview(true);
      setTokenPreview(null);

      try {
        const tokenInfo = await getTokenInfo(trimmed);
        if (tokenInfo) {
          setTokenPreview(tokenInfo);
          // Auto-fill form fields with token info
          setFormData((prev) => {
            const updates: Partial<typeof prev> = {};
            // Auto-fill name if empty
            if (!prev.tokenName.trim()) {
              updates.tokenName = tokenInfo.name;
            }
            // Auto-fill symbol if empty
            if (!prev.tokenSymbol.trim()) {
              updates.tokenSymbol = tokenInfo.symbol;
            }
            // Auto-fill description if empty and available
            if (!prev.description.trim() && tokenInfo.description) {
              updates.description = tokenInfo.description;
            }
            // Auto-fill decimals if not already set or is default
            if (!prev.decimal || prev.decimal === '6') {
              updates.decimal = tokenInfo.decimals.toString();
            }
            // Auto-fill website if empty and available
            if (!prev.websiteUrl.trim() && tokenInfo.website) {
              updates.websiteUrl = tokenInfo.website;
            }
            // Auto-fill twitter if empty and available
            if (!prev.twitterUrl.trim() && tokenInfo.twitter) {
              updates.twitterUrl = tokenInfo.twitter;
            }
            // Auto-fill telegram if empty and available
            if (!prev.telegramUrl.trim() && tokenInfo.telegram) {
              updates.telegramUrl = tokenInfo.telegram;
            }
            return { ...prev, ...updates };
          });
          // Auto-fill logo if available and not already set
          if (tokenInfo.image && !logoUrl) {
            setLogoUrl(tokenInfo.image);
          }
        } else {
          setTokenPreview(null);
        }
      } catch (error) {
        console.error('Error fetching token preview:', error);
        setTokenPreview(null);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    // Debounce the fetch
    const timeoutId = setTimeout(() => {
      fetchTokenPreview();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.existingMintAddress, isMintAddressValid, isExistingToken]);

  // Clear preview when existing token toggle is turned off
  useEffect(() => {
    if (!isExistingToken) {
      setTokenPreview(null);
      setIsLoadingPreview(false);
    }
  }, [isExistingToken]);

  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [deploymentStep, setDeploymentStep] = useState<number>(1);
  const [deploymentProgress, setDeploymentProgress] = useState<number>(0);
  const [deploymentStartTime, setDeploymentStartTime] = useState<number | undefined>(undefined);
  const [createdTokenData, setCreatedTokenData] = useState<{
    name: string;
    symbol: string;
    launchPda: string;
    logoUrl?: string;
  } | null>(null);

  // File input refs
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = useCallback((field: string, value: string) => {
    let next = value;

    if (field === 'tokenSymbol') {
      next = value.slice(0, 5);
    }

    if (
      field === 'tokenSupply' ||
      field === 'amountToBeSold' ||
      field === 'minRaise' ||
      field === 'pricePerToken'
    ) {
      next = value.replace(/[^\d.]/g, '');
    }

    if (field === 'decimal') {
      next = value.replace(/[^\d]/g, '').slice(0, 2);
    }

    setFormData((prev) => ({ ...prev, [field]: next }));
  }, []);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file) {
      console.error('No file provided for upload');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    try {
      setIsUploadingLogo(true);

      const formData = new FormData();
      formData.append('image', file);
      formData.append('fileName', `logo-${Date.now()}-${file.name}`);

      const response = await fetch('/api/ipfs/upload-image', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success && result.data?.imageUri) {
        const imageUrl = result.data.imageUri;
        setLogoUrl(imageUrl);
        toast.success('Logo uploaded successfully!');
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo. Please try again.');
    } finally {
      setIsUploadingLogo(false);
    }
  }, []);

  const handleFileUpload = useCallback(() => {
    logoInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files;
      if (file) {
        handleImageUpload(file[0]);
      }
    },
    [handleImageUpload],
  );

  const handleImageDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        handleImageUpload(file);
      }
    },
    [handleImageUpload],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const getStepMessage = useCallback((step: number): string => {
    const messages = [
      'Preparing Token',
      'Uploading Metadata',
      'Deploying Token',
      'Confirming Transaction',
    ];
    return messages[step - 1] || 'Processing...';
  }, []);

  const getStepSubMessage = useCallback((step: number): string => {
    const subMessages = [
      'Setting up token parameters',
      'Uploading metadata to IPFS',
      'Creating your token on blockchain',
      'Waiting for confirmation',
    ];
    return subMessages[step - 1] || 'Please wait...';
  }, []);

  const sanitizeUrl = useCallback((value: string, type: 'twitter' | 'telegram' | 'website') => {
    if (!value) return undefined;
    const trimmed = value.trim();

    if (type === 'twitter') {
      const raw = trimmed.replace(/^https?:\/\//, '').replace(/^(x\.com|twitter\.com)\//, '');
      const username = raw.replace(/[^A-Za-z0-9_]/g, '').slice(0, 15);
      return username ? `https://x.com/${username}` : undefined;
    }

    if (type === 'telegram') {
      const raw = trimmed
        .replace(/^https?:\/\//, '')
        .replace(/^(t\.me|telegram\.me|telegram\.org)\//, '');
      const handle = raw.replace(/[^A-Za-z0-9_]/g, '').slice(0, 32);
      return handle.length >= 5 ? `https://t.me/${handle}` : undefined;
    }

    if (type === 'website') {
      if (!trimmed) return undefined;
      const withoutProto = trimmed.replace(/^https?:\/\//, '');
      if (!withoutProto) return undefined;

      const domainRegex =
        /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+.*$/;
      if (!domainRegex.test(withoutProto)) {
        return undefined;
      }

      try {
        const url = new URL(`https://${withoutProto}`);
        return url.toString();
      } catch {
        return undefined;
      }
    }

    return trimmed;
  }, []);

  const extractErrorMessage = useCallback((error: unknown): string => {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message || 'Unknown error';
    if (
      typeof error === 'object' &&
      'message' in error &&
      typeof (error as any).message === 'string'
    ) {
      return (error as any).message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error';
    }
  }, []);

  const getFriendlyDeploymentError = useCallback(
    (error: unknown) => {
      const rawMessage = extractErrorMessage(error);
      const normalized = rawMessage.toLowerCase();

      if (!rawMessage || normalized === 'unknown error') {
        return {
          title: 'Deployment failed',
          description: 'Something went wrong during deployment. Please try again.',
        };
      }

      if (
        normalized.includes('user rejected') ||
        normalized.includes('user denied') ||
        normalized.includes('transaction cancelled')
      ) {
        return {
          title: 'Transaction rejected',
          description:
            'You rejected the transaction in your wallet. Please approve it to continue.',
        };
      }

      if (
        normalized.includes('insufficient funds') ||
        normalized.includes('insufficient sol') ||
        normalized.includes('lamports')
      ) {
        return {
          title: 'Insufficient SOL balance',
          description:
            'Your wallet does not have enough SOL to cover fees. Please top up and try again.',
        };
      }

      return {
        title: 'Deployment failed',
        description: rawMessage,
      };
    },
    [extractErrorMessage],
  );

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!formData.tokenName.trim()) {
        toast.error('Token name is required');
        return;
      }
      if (!formData.tokenSymbol.trim()) {
        toast.error('Token symbol is required');
        return;
      }

      if (!logoUrl) {
        toast.error('Token logo is required');
        return;
      }

      // Validate social URLs
      if (formData.twitterUrl && !isTwitterValid) {
        toast.error('Please fix the Twitter URL format');
        return;
      }
      if (formData.telegramUrl && !isTelegramValid) {
        toast.error('Please fix the Telegram URL format');
        return;
      }
      if (formData.websiteUrl && !isWebsiteValid) {
        toast.error('Please fix the Website URL format');
        return;
      }

      if (isExistingToken) {
        // Validate existing token fields
        if (!formData.existingMintAddress.trim()) {
          toast.error('Token mint address is required');
          return;
        }

        // Validate Solana public key format
        const trimmed = formData.existingMintAddress.trim();
        
        // Basic length check
        if (trimmed.length < 32 || trimmed.length > 44) {
          toast.error('Token mint address must be between 32 and 44 characters');
          return;
        }

        // Validate using Solana PublicKey
        try {
          const publicKey = new PublicKey(trimmed);
          if (!PublicKey.isOnCurve(publicKey)) {
            toast.error('Invalid token mint address: not a valid Solana public key');
            return;
          }
        } catch (error) {
          toast.error(
            error instanceof Error
              ? `Invalid token mint address: ${error.message}`
              : 'Invalid token mint address format',
          );
          return;
        }

        const decimals = Number(formData.decimal);
        if (!Number.isInteger(decimals) || decimals < 0 || decimals > 99) {
          toast.error('Token decimals must be an integer between 0 and 99');
          return;
        }
      } else {
        const totalSupply = Number(formData.tokenSupply);
        if (!Number.isFinite(totalSupply) || totalSupply <= 0 || !Number.isInteger(totalSupply)) {
          toast.error('Token supply must be a positive integer');
          return;
        }

        const decimals = Number(formData.decimal);
        if (!Number.isInteger(decimals) || decimals < 0 || decimals > 99) {
          toast.error('Token decimals must be an integer between 0 and 99');
          return;
        }
      }

      setCurrentStep(2);
    }
  };

  const handleBackStep = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  const handleDeployToken = async () => {
    if (!publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    // Validate Step 2 fields
    if (!formData.pricePerToken) {
      toast.error('Price per token is required');
      return;
    }
    const pricePerTokenValue = parseFloat(formData.pricePerToken);
    if (isNaN(pricePerTokenValue) || pricePerTokenValue <= 0) {
      toast.error('Price per token must be a positive number');
      return;
    }
    if (!prices.solana || prices.solana <= 0) {
      toast.error('Unable to get SOL price. Please try again later.');
      return;
    }
    if (!formData.minRaise) {
      toast.error('Minimum raise is required');
      return;
    }
    if (!formData.amountToBeSold) {
      toast.error('Amount to be sold is required');
      return;
    }
    if (!formData.saleStartTime) {
      toast.error('Sale start time is required');
      return;
    }
    if (!formData.saleEndTime) {
      toast.error('Sale end time is required');
      return;
    }
    if (formData.claimType === 'scheduled' && !formData.claimOpeningTime) {
      toast.error('Claim opening time is required');
      return;
    }

    // Check timestamps
    const startTime = new Date(formData.saleStartTime).getTime();
    const endTime = new Date(formData.saleEndTime).getTime();
    const now = Date.now();

    if (startTime < now) {
      toast.error('Sale start time must be in the future');
      return;
    }

    if (endTime <= startTime) {
      toast.error('Sale end time must be after start time');
      return;
    }

    // Check minimum duration of 1 hour
    const duration = endTime - startTime;
    const oneHour = 60 * 60 * 1000;
    if (duration < oneHour) {
      toast.error('Sale duration must be at least 1 hour');
      return;
    }

    if (formData.claimType === 'scheduled') {
      if (!formData.claimOpeningTime) {
        toast.error('Claim opening time is required');
        return;
      }
      const claimTime = new Date(formData.claimOpeningTime).getTime();
      if (claimTime <= endTime) {
        toast.error('Claim opening time must be after sale end time');
        return;
      }
    }

    // Check for date validation errors
    if (dateValidationErrors.saleEndTime) {
      toast.error(dateValidationErrors.saleEndTime);
      return;
    }
    if (dateValidationErrors.claimOpeningTime) {
      toast.error(dateValidationErrors.claimOpeningTime);
      return;
    }

    executeDeployment();
  };

  const executeDeployment = async () => {
    if (!publicKey) {
      toast.error('Please connect wallet solana');
      return;
    }

    setIsDeploying(true);
    setDeploymentStep(1);
    setDeploymentProgress(0);
    setDeploymentStartTime(Date.now());

    try {
      console.log('🚀 Starting token deployment...');
      console.log('Wallet public key:', publicKey.toString());

      // Step 1: Preparing Token
      setDeploymentStep(1);
      setDeploymentProgress(10);
      toast.loading('Preparing token...', {
        id: 'deployment-progress',
      });

      const sanitizedWebsite = sanitizeUrl(formData.websiteUrl, 'website');
      const sanitizedTwitter = sanitizeUrl(formData.twitterUrl, 'twitter');
      const sanitizedTelegram = sanitizeUrl(formData.telegramUrl, 'telegram');

      // Step 2: Uploading Metadata
      setDeploymentStep(2);
      setDeploymentProgress(30);
      toast.loading('Uploading metadata to IPFS...', {
        id: 'deployment-progress',
      });

      const metadataResponse = await fetch('/api/ipfs/upload-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.tokenName,
          symbol: formData.tokenSymbol.toUpperCase(),
          imageUri: logoUrl || '',
          description: formData.description,
          website: sanitizedWebsite || '',
          twitter: sanitizedTwitter || '',
          telegram: sanitizedTelegram || '',
        }),
      });

      const metadataResult = await metadataResponse.json();

      if (!metadataResult.success) {
        throw new Error(metadataResult.message || 'Failed to upload metadata');
      }

      const tokenUri = metadataResult.data.imageUri;

      // Step 3: Deploying Token
      setDeploymentStep(3);
      setDeploymentProgress(60);
      toast.loading('Deploying token on blockchain...', {
        id: 'deployment-progress',
      });

      const decimals = Number(formData.decimal);

      // Convert all token amounts to smallest unit (multiply by 10^decimals)
      const totalSupply = isExistingToken
        ? BigInt(0) // For existing token, we don't need total supply in the same way
        : BigInt(Math.floor(Number(formData.tokenSupply) * Math.pow(10, decimals)));
      const minAmountToSell = BigInt(
        Math.floor(Number(formData.minRaise) * Math.pow(10, decimals)),
      );
      const amountToSell = BigInt(
        Math.floor(Number(formData.amountToBeSold) * Math.pow(10, decimals)),
      );

      const startTime = BigInt(Math.floor(new Date(formData.saleStartTime).getTime() / 1000));
      const endTime = BigInt(Math.floor(new Date(formData.saleEndTime).getTime() / 1000));

      // Price per token: convert USD to SOL, then to lamports (SOL has 9 decimals)
      const pricePerTokenUSD = parseFloat(formData.pricePerToken);
      const solanaPrice = prices.solana;
      if (!solanaPrice || solanaPrice <= 0) {
        throw new Error('Unable to get SOL price. Please try again later.');
      }
      const pricePerTokenSOL = pricePerTokenUSD / solanaPrice;
      if (pricePerTokenSOL <= 0 || !isFinite(pricePerTokenSOL)) {
        throw new Error('Invalid price calculation. Please check your input.');
      }
      const pricePerToken = BigInt(Math.floor(pricePerTokenSOL * Math.pow(10, 9)));

      const launchParams = {
        name: formData.tokenName,
        description: formData.description,
        creator_wallet: formData.creatorWallet.trim() || publicKey!.toBase58(),
        start_time: startTime,
        end_time: endTime,
        max_claims_per_user: BigInt(1000000),
        total_supply: isExistingToken ? amountToSell : totalSupply,
        tokens_per_proof: BigInt(1),
        price_per_token: pricePerToken,
        min_amount_to_sell: minAmountToSell,
        amount_to_sell: amountToSell,
      };

      const tokenDetails = {
        token_name: formData.tokenName,
        token_symbol: formData.tokenSymbol.toUpperCase(),
        token_uri: tokenUri,
        decimals: decimals,
      };

      let result;
      if (isExistingToken) {
        // Use the existing token deployment function
        result = await deployWithExistingToken(
          launchParams,
          tokenDetails,
          formData.existingMintAddress,
          amountToSell,
        );
      } else {
        // Use the regular deployment function
        result = await deployToken(launchParams, tokenDetails);
      }

      if (!result) {
        throw new Error('Token deployment failed');
      }

      console.log('✅ Token deployed successfully!');
      console.log('Launch PDA:', result.launchPda);
      console.log('Token Mint:', result.tokenMint);
      console.log('Signature:', result.signature);

      // Step 4: Confirming Transaction
      setDeploymentStep(4);
      setDeploymentProgress(90);
      toast.loading('Confirming transaction...', {
        id: 'deployment-progress',
      });

      // Complete deployment
      setDeploymentProgress(100);
      toast.dismiss('deployment-progress');
      toast.success('Token deployed successfully!');

      // Store token data for success modal
      setCreatedTokenData({
        name: formData.tokenName,
        symbol: formData.tokenSymbol.toUpperCase(),
        launchPda: result.launchPda,
        logoUrl: logoUrl || undefined,
      });

      // Show success modal
      setShowSuccessModal(true);
    } catch (error) {
      console.error('❌ Error during token deployment:', error);

      toast.dismiss('deployment-progress');
      const friendlyError = getFriendlyDeploymentError(error);
      toast.error(friendlyError.title, {
        description: friendlyError.description,
      });
    } finally {
      setIsDeploying(false);
      setIsNavigating(false);
      setDeploymentStep(1);
      setDeploymentProgress(0);
      setDeploymentStartTime(undefined);
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    setCreatedTokenData(null);
    onCancel?.();
  };

  const handleViewToken = () => {
    if (createdTokenData?.launchPda) {
      setShowSuccessModal(false);
      router.push(`/token/${createdTokenData.launchPda}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] p-6 font-sans">
      <TokenCreationModal
        isVisible={isDeploying}
        stepMessage={getStepMessage(deploymentStep)}
        subMessage={getStepSubMessage(deploymentStep)}
        progress={deploymentProgress}
        tokenLogo={logoUrl || undefined}
        startTime={deploymentStartTime}
      />
      <TokenSuccessModal
        isVisible={showSuccessModal}
        tokenName={createdTokenData?.name || ''}
        tokenSymbol={createdTokenData?.symbol || ''}
        tokenLogo={createdTokenData?.logoUrl}
        mintAddress={createdTokenData?.launchPda}
        onClose={handleSuccessModalClose}
        onViewToken={handleViewToken}
      />

      <div className="max-w-[1280px] mx-auto flex flex-col items-center gap-10 py-10">
        <div className="w-full flex flex-col gap-5 items-center">
          <h1 className="text-[30px] font-bold text-white text-center font-['Space_Grotesk'] leading-9">
            Deploy <span className="text-[#d08700]">New Launch</span>
          </h1>

          <div className="flex gap-2 justify-center items-center w-full">
            <div
              className={`text-[12px] font-consolas ${currentStep >= 1 ? 'text-yellow-500' : 'text-gray-500'}`}
            >
              01. INFO
            </div>
            <div className="text-[12px] text-gray-500 font-consolas">——</div>
            <div
              className={`text-[12px] font-consolas ${currentStep >= 2 ? 'text-yellow-500' : 'text-gray-500'}`}
            >
              02. SALE PARAMETERS
            </div>
          </div>
        </div>

        <div className="max-w-[737px] w-full bg-neutral-950 border border-gray-800 p-8 rounded-lg shadow-lg">
          <div className="flex flex-col gap-8 w-full">
            {currentStep === 1 && (
              <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-right-4">
                <div className="flex gap-8 w-full">
                  <div className="flex-1 flex flex-col gap-2">
                    <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
                      Token Name <span className="text-[#dd3345]">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Loremipsum"
                      value={formData.tokenName}
                      onChange={(e) => handleInputChange('tokenName', e.target.value)}
                      disabled={isExistingToken}
                      className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] px-3 py-2.5 text-[14px] text-white font-rajdhani focus:outline-none focus:border-[#d08700] transition-colors rounded disabled:opacity-50"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
                      Token Symbol <span className="text-[#dd3345]">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter name"
                      value={formData.tokenSymbol.toUpperCase()}
                      onChange={(e) => handleInputChange('tokenSymbol', e.target.value)}
                      disabled={isExistingToken}
                      maxLength={5}
                      className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] px-3 py-2.5 text-[14px] text-white font-rajdhani uppercase focus:outline-none focus:border-[#d08700] transition-colors rounded disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="w-full border border-[rgba(255,255,255,0.1)] rounded p-3.5">
                  <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => setIsExistingToken(!isExistingToken)}
                  >
                    <div
                      className={`w-[19px] h-[19px] border-2 flex items-center justify-center transition-all rounded ${
                        isExistingToken
                          ? 'bg-[#d08700] border-[#d08700]'
                          : 'bg-transparent border-[rgba(255,255,255,0.2)]'
                      }`}
                    >
                      {isExistingToken && (
                        <svg
                          className="w-3 h-3 text-black"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="3"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-[18px] font-semibold text-[#79767d] font-rajdhani">
                      I have an existing Token
                    </span>
                  </div>
                  <p className="mt-1 text-[14px] text-[#656565] font-rajdhani">
                    Select this if you have already minted your token and want to distribute it
                    privately. If unchecked, we will mint a new token for you.
                  </p>

                  {isExistingToken && (
                    <div className="mt-6 flex flex-col gap-6 animate-in fade-in slide-in-from-top-2">
                      <div className="flex gap-8 w-full">
                        <div className="flex-1 flex flex-col gap-2">
                          <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
                            Token Mint Address (SPL) <span className="text-[#dd3345]">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Enter mint address"
                            value={formData.existingMintAddress}
                            onChange={(e) =>
                              handleInputChange('existingMintAddress', e.target.value)
                            }
                            className={`w-full bg-transparent border px-3 py-2.5 text-[14px] text-white font-rajdhani focus:outline-none transition-colors rounded ${
                              formData.existingMintAddress && !isMintAddressValid
                                ? 'border-[#dd3345] focus:border-[#dd3345]'
                                : 'border-[rgba(255,255,255,0.1)] focus:border-[#d08700]'
                            }`}
                          />
                          {mintAddressErrorMessage && (
                            <p className="text-[12px] text-[#dd3345] font-rajdhani mt-1">
                              {mintAddressErrorMessage}
                            </p>
                          )}
                        </div>
                        <div className="w-[197px] flex flex-col gap-2">
                          <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
                            Decimals
                          </label>
                          <input
                            type="text"
                            placeholder="9"
                            value={formData.decimal}
                            onChange={(e) => handleInputChange('decimal', e.target.value)}
                            className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] px-3 py-2.5 text-[14px] text-white font-rajdhani focus:outline-none focus:border-[#d08700] transition-colors rounded"
                          />
                        </div>
                      </div>

                      {isLoadingPreview && (
                        <div className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded p-4 flex items-center justify-center gap-3">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#d08700]"></div>
                          <p className="text-[14px] text-[#79767d] font-rajdhani">Loading token info...</p>
                        </div>
                      )}

                      {!isLoadingPreview && tokenPreview && (
                        <div className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
                          <div className="flex items-center gap-4">
                            {tokenPreview.image ? (
                              <img
                                src={getIpfsUrl(tokenPreview.image)}
                                alt={tokenPreview.name}
                                className="w-16 h-16 rounded-full object-cover border border-[rgba(255,255,255,0.1)]"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-full bg-[rgba(255,255,255,0.1)] flex items-center justify-center border border-[rgba(255,255,255,0.1)]">
                                <span className="text-[24px] font-rajdhani font-bold text-[#79767d]">
                                  {tokenPreview.symbol.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div className="flex-1 flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-[16px] font-rajdhani font-bold text-white">
                                  {tokenPreview.name}
                                </h4>
                                <span className="text-[14px] font-rajdhani font-medium text-[#d08700]">
                                  {tokenPreview.symbol}
                                </span>
                              </div>
                              <p className="text-[12px] font-rajdhani text-[#79767d]">
                                Decimals: {tokenPreview.decimals}
                              </p>
                              <p className="text-[12px] font-rajdhani text-[#79767d] font-mono break-all">
                                {formData.existingMintAddress}
                              </p>
                            </div>
                          </div>
                          {tokenPreview.description && (
                            <div className="pt-2 border-t border-[rgba(255,255,255,0.1)]">
                              <p className="text-[13px] font-rajdhani text-[#79767d] leading-relaxed">
                                {tokenPreview.description}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="bg-[rgba(208,135,0,0.05)] border border-[#d08700] p-4 flex gap-3 rounded">
                        <div className="shrink-0 text-[#d08700]">
                          <Lock className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col gap-1 text-[#79767d]">
                          <p className="font-rajdhani font-bold text-[16px] leading-[1.3]">
                            How Anonymity Works Here
                          </p>
                          <div className="text-[14px] font-rajdhani leading-6">
                            <p className="mb-2">
                              For existing tokens, you (the Creator) will transfer the sale
                              allocation into the Zaunchpad Shielded Vault.
                            </p>
                            <p>
                              Buyers purchase tickets anonymously. When they claim, the Vault
                              releases your tokens to their fresh wallets. The blockchain sees Vault
                              - Buyer. The link to the buyer's payment is mathematically broken.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {!isExistingToken && (
                  <div className="flex gap-8 w-full">
                    <div className="flex-1 flex flex-col gap-2">
                      <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
                        Token Supply <span className="text-[#dd3345]">*</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="1000000"
                        value={formData.tokenSupply}
                        onChange={(e) => handleInputChange('tokenSupply', e.target.value)}
                        className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] px-3 py-2.5 text-[14px] text-white font-rajdhani focus:outline-none focus:border-[#d08700] transition-colors rounded"
                      />
                    </div>
                    <div className="w-[197px] flex flex-col gap-2">
                      <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
                        Decimal <span className="text-[#dd3345]">*</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="6"
                        value={formData.decimal}
                        onChange={(e) => handleInputChange('decimal', e.target.value)}
                        maxLength={2}
                        className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] px-3 py-2.5 text-[14px] text-white font-rajdhani focus:outline-none focus:border-[#d08700] transition-colors rounded"
                      />
                    </div>
                  </div>
                )}

                {/* Description */}
                <div className="w-full flex flex-col gap-2">
                  <div className="flex gap-1 items-baseline text-[14px] text-[#79767d]">
                    <span className="font-rajdhani font-medium">Describe your Token</span>
                    <span className="font-rajdhani text-[#79767d]">(optional)</span>
                  </div>
                  <textarea
                    placeholder="Type description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                    className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] px-3 py-2.5 text-[14px] text-white font-rajdhani focus:outline-none focus:border-[#d08700] transition-colors rounded resize-none"
                  />
                </div>

                {/* Token Branding - Logo */}
                <div className="w-full flex flex-col gap-2">
                  <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
                    Token Icon <span className="text-[#dd3345]">*</span>
                  </label>
                  <div
                    className="w-full h-[163px] border border-dashed border-[rgba(255,255,255,0.1)] rounded flex flex-col items-center justify-center cursor-pointer hover:border-[rgba(255,255,255,0.2)] transition-colors"
                    onClick={() => handleFileUpload()}
                    onDrop={(e) => handleImageDrop(e)}
                    onDragOver={handleDragOver}
                  >
                    {logoUrl ? (
                      <div className="flex flex-col items-center gap-3">
                        <img
                          src={getIpfsUrl(logoUrl)}
                          alt="Token Logo"
                          className="w-32 h-32 object-cover rounded border border-[rgba(255,255,255,0.1)]"
                        />
                        {isUploadingLogo && (
                          <p className="text-xs text-[#d08700] font-rajdhani">Uploading...</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 flex items-center justify-center">
                          {isUploadingLogo ? (
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#d08700]"></div>
                          ) : (
                            <img src="/icons/add-image.svg" alt="Upload" className="opacity-50" />
                          )}
                        </div>
                        <p className="text-[14px] font-rajdhani font-bold text-[#79767d] text-center">
                          Drag & drop or click to upload icon
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Socials */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-[16px] font-bold text-white font-rajdhani uppercase mb-2">
                    Socials
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="block text-[14px] font-rajdhani font-bold text-[#79767d]">
                        X/Twitter
                      </label>
                      <URLInput
                        prefix="x.com/"
                        value={formData.twitterUrl}
                        onChange={(value) => handleInputChange('twitterUrl', value)}
                        placeholder="username"
                        className="w-full bg-transparent text-white font-rajdhani rounded"
                        isInvalid={!isTwitterValid}
                      />
                      {twitterErrorMessage && (
                        <p className="text-[12px] text-[#dd3345] font-rajdhani">
                          {twitterErrorMessage}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="block text-[14px] font-rajdhani font-bold text-[#79767d]">
                        Telegram
                      </label>
                      <URLInput
                        prefix="t.me/"
                        value={formData.telegramUrl}
                        onChange={(value) => handleInputChange('telegramUrl', value)}
                        placeholder="channel"
                        className="w-full bg-transparent text-white font-rajdhani rounded"
                        isInvalid={!isTelegramValid}
                      />
                      {telegramErrorMessage && (
                        <p className="text-[12px] text-[#dd3345] font-rajdhani">
                          {telegramErrorMessage}
                        </p>
                      )}
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-2">
                      <label className="block text-[14px] font-rajdhani font-bold text-[#79767d]">
                        Website
                      </label>
                      <URLInput
                        prefix="https://"
                        value={formData.websiteUrl}
                        onChange={(value) => handleInputChange('websiteUrl', value)}
                        placeholder="website.com"
                        className="w-full bg-transparent text-white font-rajdhani rounded"
                        isInvalid={!isWebsiteValid}
                      />
                      {websiteErrorMessage && (
                        <p className="text-[12px] text-[#dd3345] font-rajdhani">
                          {websiteErrorMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Sale Parameters */}
            {currentStep === 2 && (
              <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-right-4">
                <h3 className="text-[24px] font-rajdhani font-semibold text-[#d08700] mb-2">
                  Sale Parameters
                </h3>

                {/* Price per Token */}
                <div className="flex gap-8 w-full">
                  <div className="flex-1 flex flex-col gap-2">
                    <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
                      Price per Token (USD) <span className="text-[#dd3345]">*</span>
                    </label>
                    <div className="relative w-full">
                      <input
                        type="text"
                        placeholder="0.00001"
                        value={formData.pricePerToken}
                        onChange={(e) => handleInputChange('pricePerToken', e.target.value)}
                        className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] px-3 py-2.5 text-[14px] text-white font-rajdhani font-bold focus:outline-none focus:border-[#d08700] transition-colors rounded"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-end gap-0.5">
                        <span className="text-[#d08700] text-[14px] font-rajdhani font-bold">
                          USD / Token
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Min Raise & Amount to be Sold */}
                <div className="flex gap-8 w-full">
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex gap-1 items-center">
                      <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
                        Minimum Raise (Tokens)
                      </label>
                      <InfoTooltip content="Minimum amount of tokens required for the launch to be successful." />
                    </div>
                    <input
                      type="text"
                      placeholder="50000"
                      value={formData.minRaise}
                      onChange={(e) => handleInputChange('minRaise', e.target.value)}
                      className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] px-3 py-2.5 text-[14px] text-white font-rajdhani focus:outline-none focus:border-[#d08700] transition-colors rounded"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
                      Amount to be sold (Tokens) <span className="text-[#dd3345]">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="100000"
                      value={formData.amountToBeSold}
                      onChange={(e) => handleInputChange('amountToBeSold', e.target.value)}
                      className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] px-3 py-2.5 text-[14px] text-white font-rajdhani focus:outline-none focus:border-[#d08700] transition-colors rounded"
                    />
                  </div>
                </div>

                {/* Start & End Time */}
                <div className="flex gap-8 w-full">
                  <div className="flex-1 flex flex-col gap-2">
                    <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
                      Sale Start Time <span className="text-[#dd3345]">*</span>
                    </label>
                    <div className="relative w-full">
                      <input
                        type="datetime-local"
                        min={getMinDateTime()}
                        value={formData.saleStartTime}
                        onChange={(e) => handleInputChange('saleStartTime', e.target.value)}
                        className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] px-3 py-2.5 text-[14px] text-white font-rajdhani focus:outline-none focus:border-[#d08700] transition-colors rounded [&::-webkit-calendar-picker-indicator]:invert"
                      />
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
                      Sale End Time <span className="text-[#dd3345]">*</span>
                    </label>
                    <div className="relative w-full">
                      <input
                        type="datetime-local"
                        min={getMinEndDateTime()}
                        value={formData.saleEndTime}
                        onChange={(e) => handleInputChange('saleEndTime', e.target.value)}
                        className={`w-full bg-transparent border px-3 py-2.5 text-[14px] text-white font-rajdhani focus:outline-none transition-colors rounded [&::-webkit-calendar-picker-indicator]:invert ${
                          dateValidationErrors.saleEndTime
                            ? 'border-[#dd3345] focus:border-[#dd3345]'
                            : 'border-[rgba(255,255,255,0.1)] focus:border-[#d08700]'
                        }`}
                      />
                    </div>
                    {dateValidationErrors.saleEndTime && (
                      <p className="text-[12px] text-[#dd3345] font-rajdhani">
                        {dateValidationErrors.saleEndTime}
                      </p>
                    )}
                  </div>
                </div>

                {/* Claim Schedule */}
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
                    Claim Schedule
                  </label>
                  <div className="flex border border-[rgba(255,255,255,0.1)] rounded p-1 gap-1">
                    <button
                      onClick={() => setFormData((prev) => ({ ...prev, claimType: 'immediate' }))}
                      className={`flex-1 py-1.5 px-3 text-[14px] font-rajdhani font-medium rounded transition-colors ${
                        formData.claimType === 'immediate'
                          ? 'bg-[#d08700] text-black shadow-sm'
                          : 'bg-transparent text-[#64748b] hover:text-white'
                      }`}
                    >
                      Immediate Claim (After Sale)
                    </button>
                    <button
                      onClick={() => setFormData((prev) => ({ ...prev, claimType: 'scheduled' }))}
                      className={`flex-1 py-1.5 px-3 text-[14px] font-rajdhani font-medium rounded transition-colors ${
                        formData.claimType === 'scheduled'
                          ? 'bg-[#d08700] text-black shadow-sm'
                          : 'bg-transparent text-[#64748b] hover:text-white'
                      }`}
                    >
                      Schedule Date
                    </button>
                  </div>
                </div>

                {/* Claim Opening Time (Conditional) */}
                {formData.claimType === 'scheduled' && (
                  <div className="flex gap-8 w-full animate-in fade-in slide-in-from-top-2">
                    <div className="flex-1 flex flex-col gap-2">
                      <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
                        Claim Opening Time <span className="text-[#dd3345]">*</span>
                      </label>
                      <div className="relative w-full">
                        <input
                          type="datetime-local"
                          min={getMinClaimDateTime()}
                          value={formData.claimOpeningTime}
                          onChange={(e) => handleInputChange('claimOpeningTime', e.target.value)}
                          className={`w-full bg-transparent border px-3 py-2.5 text-[14px] text-white font-rajdhani focus:outline-none transition-colors rounded [&::-webkit-calendar-picker-indicator]:invert ${
                            dateValidationErrors.claimOpeningTime
                              ? 'border-[#dd3345] focus:border-[#dd3345]'
                              : 'border-[rgba(255,255,255,0.1)] focus:border-[#d08700]'
                          }`}
                        />
                      </div>
                      {dateValidationErrors.claimOpeningTime && (
                        <p className="text-[12px] text-[#dd3345] font-rajdhani">
                          {dateValidationErrors.claimOpeningTime}
                        </p>
                      )}
                    </div>
                    <div className="flex-1" />
                  </div>
                )}

                {/* Creator Wallet (ZEC) */}
                <div className="flex gap-8 w-full">
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex gap-1 items-center">
                      <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
                        Creator Wallet (ZEC)
                      </label>
                      <InfoTooltip content="ZEC wallet address to receive funds from NEAR intents" />
                    </div>
                    <input
                      type="text"
                      placeholder="Enter ZEC wallet address"
                      value={formData.creatorWallet}
                      onChange={(e) => handleInputChange('creatorWallet', e.target.value)}
                      className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] px-3 py-2.5 text-[14px] text-white font-rajdhani focus:outline-none focus:border-[#d08700] transition-colors rounded"
                    />
                  </div>
                </div>

                {/* Alert Info */}
                <div className="bg-[rgba(255,255,255,0.09)] p-4 rounded flex items-start gap-3">
                  <div className="text-[14px] text-white font-rajdhani">
                    <ul className="list-disc pl-5 space-y-1">
                      <li>
                        If the Minimum Raise is met but the Amount to be Sold is not fully filled,
                        any remaining unsold tokens will be returned to the creator wallet.
                      </li>
                      <li>Claim period start immediately after sale, or set delayed claim</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className={`flex ${currentStep > 1 ? 'justify-between' : 'justify-end'} pt-4`}>
              {currentStep > 1 && (
                <button
                  onClick={handleBackStep}
                  disabled={isDeploying || isNavigating}
                  className="bg-white px-6 py-3 text-black font-bold font-['Space_Grotesk'] text-[16px] leading-6 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  BACK
                </button>
              )}

              {currentStep < 2 ? (
                <button
                  onClick={handleNextStep}
                  disabled={isDeploying || isNavigating}
                  className="bg-white px-6 py-3 text-black font-bold font-['Space_Grotesk'] text-[16px] leading-6 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  NEXT STEP -&gt;
                </button>
              ) : (
                <button
                  onClick={handleDeployToken}
                  disabled={isDeploying || isNavigating}
                  className="bg-[#d08700] px-6 py-3 text-black font-bold font-['Space_Grotesk'] text-[16px] leading-6 hover:bg-[#b07200] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isDeploying ? 'DEPLOYING...' : 'DEPLOY TOKEN'}
                </button>
              )}
            </div>

            {/* Hidden file inputs */}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange(e)}
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
