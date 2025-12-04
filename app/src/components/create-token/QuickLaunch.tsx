'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import TokenCreationModal from '@/components/ui/token-creation-modal';
import TokenSuccessModal from '@/components/ui/token-success-modal';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { useDeployToken } from '@/hooks/useDeployToken';
import { getTokenInfo } from '@/lib/sol';
import TokenInfoStep from './TokenInfoStep';
import SaleParametersStep from './SaleParametersStep';

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
  const [testMode, setTestMode] = useState(false);

  // Generate random test data
  const generateTestData = useCallback(() => {
    const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const randomSupply = Math.floor(Math.random() * 9000000 + 1000000).toString();
    const randomAmount = Math.floor(Number(randomSupply) * 0.7).toString();
    const randomMin = '0'; // Always 0 for test mode - no minimum raise requirement
    const randomPrice = (Math.random() * 0.0001 + 0.00001).toFixed(6);
    
    // Set start time to 5 mins from now, end time to 1 week later
    const now = new Date();
    const startTime = new Date(now.getTime() + 5 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const formatDateTime = (date: Date) => {
      return date.toISOString().slice(0, 16);
    };

    return {
      tokenName: `TestToken_${randomId}`,
      tokenSymbol: randomId.slice(0, 5),
      tokenSupply: randomSupply,
      decimal: '9',
      description: `This is a test token created for development purposes. FreeRomanStorm - A community-driven initiative supporting digital privacy and freedom. This token demonstrates the privacy-preserving features of Zaunchpad's ZK-proof based distribution system.`,
      twitterUrl: 'rstormsf',
      websiteUrl: 'freeromanstorm.com',
      telegramUrl: '',
      existingMintAddress: '',
      pricePerToken: randomPrice,
      minRaise: randomMin,
      amountToBeSold: randomAmount,
      saleStartTime: formatDateTime(startTime),
      saleEndTime: formatDateTime(endTime),
      claimType: 'immediate',
      claimOpeningTime: '',
      creatorWallet: 't1Yf8KMstVBhiJATMqcqbbvMb8okxortfsN', // Test ZEC address
    };
  }, []);

  const handleToggleTestMode = useCallback(() => {
    setTestMode(prev => {
      if (!prev) {
        // Enabling test mode - fill with random data
        const testData = generateTestData();
        setFormData(current => ({ ...current, ...testData }));
      }
      return !prev;
    });
  }, [generateTestData]);

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
    minRaise: '',
    amountToBeSold: '100000',
    saleStartTime: '',
    saleEndTime: '',
    claimType: 'immediate', // 'immediate' | 'scheduled'
    claimOpeningTime: '',
    creatorWallet: '', // ZEC wallet address to receive funds from NEAR intents
  });

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState<boolean>(false);


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

  const isWebsiteValid = useMemo(() => {
    if (!formData.websiteUrl || !formData.websiteUrl.trim()) return true;

    const trimmed = formData.websiteUrl.trim();
    const withoutProto = trimmed.replace(/^https?:\/\//, '');
    if (!withoutProto) return false;

    const domainRegex =
      /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+.*$/;
    return domainRegex.test(withoutProto);
  }, [formData.websiteUrl]);

  const websiteErrorMessage = useMemo(() => {
    if (!formData.websiteUrl || !formData.websiteUrl.trim()) return null;
    if (isWebsiteValid) return null;
    return 'Please enter a valid website URL (e.g., example.com)';
  }, [formData.websiteUrl, isWebsiteValid]);

  const isTwitterValid = useMemo(() => {
    if (!formData.twitterUrl || !formData.twitterUrl.trim()) return true;

    const trimmed = formData.twitterUrl.trim();
    const raw = trimmed.replace(/^https?:\/\//, '').replace(/^(x\.com|twitter\.com)\//, '');
    const username = raw.replace(/[^A-Za-z0-9_]/g, '');

    if (username.length === 0) return false;
    if (username.length > 15) return false;
    return /^[A-Za-z0-9_]+$/.test(username);
  }, [formData.twitterUrl]);

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

  const isTelegramValid = useMemo(() => {
    if (!formData.telegramUrl || !formData.telegramUrl.trim()) return true;

    const trimmed = formData.telegramUrl.trim();
    const raw = trimmed
      .replace(/^https?:\/\//, '')
      .replace(/^(t\.me|telegram\.me|telegram\.org)\//, '');
    const handle = raw.replace(/[^A-Za-z0-9_]/g, '');

    return handle.length >= 5 && handle.length <= 32;
  }, [formData.telegramUrl]);

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

  const isZecAddressValid = useMemo(() => {
    if (!formData.creatorWallet || !formData.creatorWallet.trim()) return false;

    const trimmed = formData.creatorWallet.trim();
    
    if (!trimmed.match(/^[tzu]/)) {
      return false;
    }

    if (trimmed.startsWith('u')) {
      const unifiedRegex = /^u[0-9a-zA-Z]+$/;
      if (!unifiedRegex.test(trimmed)) {
        return false;
      }
      return trimmed.length >= 78;
    }

    const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
    if (!base58Regex.test(trimmed)) {
      return false;
    }

    if (trimmed.startsWith('t')) {
      return trimmed.length >= 34 && trimmed.length <= 36;
    } else if (trimmed.startsWith('z')) {
      return trimmed.length >= 77 && trimmed.length <= 79;
    }

    return false;
  }, [formData.creatorWallet]);

  const zecAddressErrorMessage = useMemo(() => {
    const trimmed = formData.creatorWallet?.trim() || '';
    
    if (!trimmed) {
      return null;
    }
    
    if (isZecAddressValid) return null;
    
    if (!trimmed.match(/^[tzu]/)) {
      return 'ZEC address must start with t (transparent), z (shielded), or u (unified)';
    }
    
    if (trimmed.startsWith('u')) {
      const unifiedRegex = /^u[0-9a-zA-Z]+$/;
      if (!unifiedRegex.test(trimmed)) {
        return 'Unified (u) address contains invalid characters';
      }
      if (trimmed.length < 78) {
        return 'Unified (u) address must be at least 78 characters';
      }
    } else {
      const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
      if (!base58Regex.test(trimmed)) {
        return 'ZEC address contains invalid characters';
      }
      if (trimmed.startsWith('t') && (trimmed.length < 34 || trimmed.length > 36)) {
        return 'Transparent (t) address must be 34-36 characters';
      }
      if (trimmed.startsWith('z') && (trimmed.length < 77 || trimmed.length > 79)) {
        return 'Shielded (z) address must be 77-79 characters';
      }
    }
    
    return 'Invalid ZEC wallet address format';
  }, [formData.creatorWallet, isZecAddressValid]);

  const getMinDateTime = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }, []);

  const getMinEndDateTime = useCallback(() => {
    if (!formData.saleStartTime) return getMinDateTime();
    const startTime = new Date(formData.saleStartTime);
    // Temporarily disabled 1 hour minimum - just require 1 minute after start
    const minEndTime = new Date(startTime.getTime() + 60 * 1000);
    const year = minEndTime.getFullYear();
    const month = String(minEndTime.getMonth() + 1).padStart(2, '0');
    const day = String(minEndTime.getDate()).padStart(2, '0');
    const hours = String(minEndTime.getHours()).padStart(2, '0');
    const minutes = String(minEndTime.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }, [formData.saleStartTime, getMinDateTime]);

  const getMinClaimDateTime = useCallback(() => {
    if (!formData.saleEndTime) return getMinDateTime();
    const endTime = new Date(formData.saleEndTime);
    const minClaimTime = new Date(endTime.getTime() + 1000);
    const year = minClaimTime.getFullYear();
    const month = String(minClaimTime.getMonth() + 1).padStart(2, '0');
    const day = String(minClaimTime.getDate()).padStart(2, '0');
    const hours = String(minClaimTime.getHours()).padStart(2, '0');
    const minutes = String(minClaimTime.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }, [formData.saleEndTime, getMinDateTime]);

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
      }

      if (endTime <= startTime) {
        errors.saleEndTime = 'Sale end time must be after start time';
      }
      // Temporarily disabled 1 hour minimum validation
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
          setFormData((prev) => {
            const updates: Partial<typeof prev> = {};
            if (!prev.tokenName.trim()) {
              updates.tokenName = tokenInfo.name;
            }
            if (!prev.tokenSymbol.trim()) {
              updates.tokenSymbol = tokenInfo.symbol;
            }
            if (!prev.description.trim() && tokenInfo.description) {
              updates.description = tokenInfo.description;
            }
            updates.decimal = tokenInfo.decimals.toString();
            if (!prev.websiteUrl.trim() && tokenInfo.website) {
              updates.websiteUrl = tokenInfo.website;
            }
            if (!prev.twitterUrl.trim() && tokenInfo.twitter) {
              updates.twitterUrl = tokenInfo.twitter;
            }
            if (!prev.telegramUrl.trim() && tokenInfo.telegram) {
              updates.telegramUrl = tokenInfo.telegram;
            }
            return { ...prev, ...updates };
          });
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

    const timeoutId = setTimeout(() => {
      fetchTokenPreview();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.existingMintAddress, isMintAddressValid, isExistingToken]);

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
    // minRaise is optional - default to 0 if not provided
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

    // Temporarily disabled 1 hour minimum validation
    // const duration = endTime - startTime;
    // const oneHour = 60 * 60 * 1000;
    // if (duration < oneHour) {
    //   toast.error('Sale duration must be at least 1 hour');
    //   return;
    // }

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

    if (dateValidationErrors.saleEndTime) {
      toast.error(dateValidationErrors.saleEndTime);
      return;
    }
    if (dateValidationErrors.claimOpeningTime) {
      toast.error(dateValidationErrors.claimOpeningTime);
      return;
    }

    if (!formData.creatorWallet || !formData.creatorWallet.trim()) {
      toast.error('Creator wallet (ZEC) is required');
      return;
    }
    if (!isZecAddressValid) {
      toast.error(zecAddressErrorMessage || 'Invalid ZEC wallet address format');
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
      if (isNaN(decimals) || decimals < 0 || decimals > 18) {
        throw new Error('Invalid decimal value. Must be between 0 and 18.');
      }

      // Validate tokenSupply for new tokens
      if (!isExistingToken) {
        const tokenSupplyValue = Number(formData.tokenSupply);
        if (isNaN(tokenSupplyValue) || tokenSupplyValue <= 0) {
          throw new Error('Token supply must be a valid positive number');
        }
      }

      // Convert all token amounts to smallest unit (multiply by 10^decimals)
      const totalSupply = isExistingToken
        ? BigInt(0) // For existing token, we don't need total supply in the same way
        : BigInt(Math.floor(Number(formData.tokenSupply) * Math.pow(10, decimals)));
      // Handle minRaise - default to 0 if empty or invalid
      const minRaiseValue = formData.minRaise ? Number(formData.minRaise) : 0;
      const minAmountToSell = BigInt(
        Math.floor(minRaiseValue * Math.pow(10, decimals)),
      );
      
      // Validate amountToBeSold is a valid number
      const amountToBeSoldValue = Number(formData.amountToBeSold);
      if (isNaN(amountToBeSoldValue) || amountToBeSoldValue <= 0) {
        throw new Error('Amount to be sold must be a valid positive number');
      }
      const amountToSell = BigInt(
        Math.floor(amountToBeSoldValue * Math.pow(10, decimals)),
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

      // Validate: amount_to_sell cannot exceed total_supply
      const effectiveTotalSupply = isExistingToken ? amountToSell : totalSupply;
      if (amountToSell > effectiveTotalSupply) {
        throw new Error(`Amount to sell (${amountToSell}) cannot exceed total supply (${effectiveTotalSupply}). Please reduce the amount to sell or increase token supply.`);
      }


      const launchParams = {
        name: formData.tokenName,
        description: formData.description,
        creator_wallet: formData.creatorWallet.trim() || publicKey!.toBase58(),
        start_time: startTime,
        end_time: endTime,
        max_claims_per_user: BigInt(1000000),
        total_supply: effectiveTotalSupply,
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
        result = await deployWithExistingToken(
          launchParams,
          tokenDetails,
          formData.existingMintAddress,
          amountToSell,
        );
      } else {
        result = await deployToken(launchParams, tokenDetails);
      }

      if (!result) {
        throw new Error('Token deployment failed');
      }

      console.log('✅ Token deployed successfully!');
      console.log('Launch PDA:', result.launchPda);
      console.log('Token Mint:', result.tokenMint);
      console.log('Signature:', result.signature);

      setDeploymentStep(4);
      setDeploymentProgress(90);
      toast.loading('Confirming transaction...', {
        id: 'deployment-progress',
      });

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
    <div className="min-h-screen bg-[#050505] p-4 sm:p-6 font-sans">
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

      <div className="max-w-[1280px] mx-auto flex flex-col items-center gap-6 sm:gap-10 py-6 sm:py-10">
        <div className="w-full flex flex-col gap-3 sm:gap-5 items-center">
          <h1 className="text-[24px] sm:text-[30px] font-bold text-white text-center font-['Space_Grotesk'] leading-7 sm:leading-9 px-4">
            Deploy <span className="text-[#d08700]">New Launch</span>
          </h1>

          <div className="flex gap-1 sm:gap-2 justify-center items-center w-full flex-wrap px-4">
            <div
              className={`text-[10px] sm:text-[12px] font-consolas ${currentStep >= 1 ? 'text-yellow-500' : 'text-gray-500'}`}
            >
              01. INFO
            </div>
            <div className="text-[10px] sm:text-[12px] text-gray-500 font-consolas hidden sm:block">——</div>
            <div className="text-[10px] sm:text-[12px] text-gray-500 font-consolas sm:hidden">-</div>
            <div
              className={`text-[10px] sm:text-[12px] font-consolas ${currentStep >= 2 ? 'text-yellow-500' : 'text-gray-500'}`}
            >
              02. SALE PARAMETERS
            </div>
          </div>
        </div>

        <div className="max-w-[737px] w-full bg-neutral-950 border border-gray-800 p-4 sm:p-6 md:p-8 rounded-lg shadow-lg mx-4 sm:mx-0">
          <div className="flex flex-col gap-6 sm:gap-8 w-full">
            {currentStep === 1 && (
              <TokenInfoStep
                formData={{
                  tokenName: formData.tokenName,
                  tokenSymbol: formData.tokenSymbol,
                  tokenSupply: formData.tokenSupply,
                  decimal: formData.decimal,
                  description: formData.description,
                  twitterUrl: formData.twitterUrl,
                  websiteUrl: formData.websiteUrl,
                  telegramUrl: formData.telegramUrl,
                  existingMintAddress: formData.existingMintAddress,
                }}
                isExistingToken={isExistingToken}
                logoUrl={logoUrl}
                isUploadingLogo={isUploadingLogo}
                tokenPreview={tokenPreview}
                isLoadingPreview={isLoadingPreview}
                isMintAddressValid={isMintAddressValid}
                mintAddressErrorMessage={mintAddressErrorMessage}
                isTwitterValid={isTwitterValid}
                isTelegramValid={isTelegramValid}
                isWebsiteValid={isWebsiteValid}
                twitterErrorMessage={twitterErrorMessage}
                telegramErrorMessage={telegramErrorMessage}
                websiteErrorMessage={websiteErrorMessage}
                onInputChange={handleInputChange}
                onToggleExistingToken={() => setIsExistingToken(!isExistingToken)}
                onFileUpload={handleFileUpload}
                onImageDrop={handleImageDrop}
                onDragOver={handleDragOver}
                testMode={testMode}
                onToggleTestMode={handleToggleTestMode}
                onImageUpload={handleImageUpload}
              />
            )}

            {/* Step 2: Sale Parameters */}
            {currentStep === 2 && (
              <SaleParametersStep
                formData={{
                  pricePerToken: formData.pricePerToken,
                  minRaise: formData.minRaise,
                  amountToBeSold: formData.amountToBeSold,
                  saleStartTime: formData.saleStartTime,
                  saleEndTime: formData.saleEndTime,
                  claimType: formData.claimType as 'immediate' | 'scheduled',
                  claimOpeningTime: formData.claimOpeningTime,
                  creatorWallet: formData.creatorWallet,
                }}
                dateValidationErrors={dateValidationErrors}
                isZecAddressValid={isZecAddressValid}
                zecAddressErrorMessage={zecAddressErrorMessage}
                getMinDateTime={getMinDateTime}
                getMinEndDateTime={getMinEndDateTime}
                getMinClaimDateTime={getMinClaimDateTime}
                onInputChange={handleInputChange}
                onClaimTypeChange={(type: 'immediate' | 'scheduled') =>
                  setFormData((prev) => ({ ...prev, claimType: type }))
                }
              />
            )}


            <div className={`flex flex-col sm:flex-row ${currentStep > 1 ? 'justify-between' : 'justify-end'} gap-3 sm:gap-0 pt-4`}>
              {currentStep > 1 && (
                <button
                  onClick={handleBackStep}
                  disabled={isDeploying || isNavigating}
                  className="w-full sm:w-auto bg-white px-4 sm:px-6 py-2.5 sm:py-3 text-black font-bold font-['Space_Grotesk'] text-[14px] sm:text-[16px] leading-6 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer rounded"
                >
                  BACK
                </button>
              )}

              {currentStep < 2 ? (
                <button
                  onClick={handleNextStep}
                  disabled={isDeploying || isNavigating}
                  className="w-full sm:w-auto bg-white px-4 sm:px-6 py-2.5 sm:py-3 text-black font-bold font-['Space_Grotesk'] text-[14px] sm:text-[16px] leading-6 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer rounded"
                >
                  NEXT STEP -&gt;
                </button>
              ) : (
                <button
                  onClick={handleDeployToken}
                  disabled={isDeploying || isNavigating}
                  className="w-full sm:w-auto bg-[#d08700] px-4 sm:px-6 py-2.5 sm:py-3 text-black font-bold font-['Space_Grotesk'] text-[14px] sm:text-[16px] leading-6 hover:bg-[#b07200] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer rounded"
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
