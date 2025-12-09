'use client';

import { Lock, FlaskConical, Clipboard } from 'lucide-react';
import { getIpfsUrl } from '@/lib/utils';
import URLInput from '@/components/ui/url-input';
import { useEffect, useCallback } from 'react';

interface TokenInfoStepProps {
  formData: {
    tokenName: string;
    tokenSymbol: string;
    tokenSupply: string;
    decimal: string;
    description: string;
    twitterUrl: string;
    websiteUrl: string;
    telegramUrl: string;
    existingMintAddress: string;
  };
  isExistingToken: boolean;
  logoUrl: string | null;
  isUploadingLogo: boolean;
  tokenPreview: {
    name: string;
    symbol: string;
    image?: string;
    description?: string;
    website?: string;
    twitter?: string;
    telegram?: string;
    decimals: number;
  } | null;
  isLoadingPreview: boolean;
  isMintAddressValid: boolean;
  mintAddressErrorMessage: string | null;
  isTwitterValid: boolean;
  isTelegramValid: boolean;
  isWebsiteValid: boolean;
  twitterErrorMessage: string | null;
  telegramErrorMessage: string | null;
  websiteErrorMessage: string | null;
  onInputChange: (field: string, value: string) => void;
  onToggleExistingToken: () => void;
  onFileUpload: () => void;
  onImageDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  // Test mode props
  testMode?: boolean;
  onToggleTestMode?: () => void;
  onImageUpload?: (file: File) => void;
}

export default function TokenInfoStep({
  formData,
  isExistingToken,
  logoUrl,
  isUploadingLogo,
  tokenPreview,
  isLoadingPreview,
  isMintAddressValid,
  mintAddressErrorMessage,
  isTwitterValid,
  isTelegramValid,
  isWebsiteValid,
  twitterErrorMessage,
  telegramErrorMessage,
  websiteErrorMessage,
  onInputChange,
  onToggleExistingToken,
  onFileUpload,
  onImageDrop,
  onDragOver,
  testMode = false,
  onToggleTestMode,
  onImageUpload,
}: TokenInfoStepProps) {
  // Handle clipboard paste for images
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items || !onImageUpload) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          onImageUpload(file);
          break;
        }
      }
    }
  }, [onImageUpload]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full animate-in fade-in slide-in-from-right-4">
      {/* Test Mode Toggle */}
      {onToggleTestMode && (
        <div className="w-full border border-dashed border-[#d08700]/50 rounded p-2.5 sm:p-3 bg-[#d08700]/5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <FlaskConical className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#d08700] shrink-0" />
              <span className="text-[12px] sm:text-[14px] font-rajdhani font-bold text-[#d08700]">
                Test Mode
              </span>
              <span className="text-[10px] sm:text-[12px] font-rajdhani text-[#79767d] hidden xs:inline">
                (Auto-fill)
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleTestMode}
              className={`relative w-10 sm:w-12 h-5 sm:h-6 rounded-full transition-colors shrink-0 ${
                testMode ? 'bg-[#d08700]' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-0.5 sm:top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  testMode ? 'translate-x-5 sm:translate-x-7' : 'translate-x-0.5 sm:translate-x-1'
                }`}
              />
            </button>
          </div>
          {testMode && (
            <p className="mt-2 text-[11px] text-[#79767d] font-rajdhani">
              ⚠️ Test mode enabled - Using sample data for FreeRomanStorm
            </p>
          )}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 w-full">
        <div className="flex-1 flex flex-col gap-2">
          <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
            Token Name <span className="text-[#dd3345]">*</span>
          </label>
          <input
            type="text"
            placeholder="Loremipsum"
            value={formData.tokenName}
            onChange={(e) => onInputChange('tokenName', e.target.value)}
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
            onChange={(e) => onInputChange('tokenSymbol', e.target.value)}
            disabled={isExistingToken}
            maxLength={5}
            className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] px-3 py-2.5 text-[14px] text-white font-rajdhani uppercase focus:outline-none focus:border-[#d08700] transition-colors rounded disabled:opacity-50"
          />
        </div>
      </div>

      <div className="w-full border border-[rgba(255,255,255,0.1)] rounded p-3.5">
        <div className="flex items-center gap-2 cursor-pointer" onClick={onToggleExistingToken}>
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
          <span className="text-[16px] sm:text-[18px] font-semibold text-[#79767d] font-rajdhani">
            I have an existing Token
          </span>
        </div>
        <p className="mt-1 text-[12px] sm:text-[14px] text-[#656565] font-rajdhani">
          Select this if you have already minted your token and want to distribute it privately. If
          unchecked, we will mint a new token for you.
        </p>

        {isExistingToken && (
          <div className="mt-4 sm:mt-6 flex flex-col gap-4 sm:gap-6 animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 w-full">
              <div className="flex-1 flex flex-col gap-2">
                <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
                  Token Mint Address (SPL) <span className="text-[#dd3345]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter mint address"
                  value={formData.existingMintAddress}
                  onChange={(e) => onInputChange('existingMintAddress', e.target.value)}
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
            </div>

            {isLoadingPreview && (
              <div className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded p-4 flex items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#d08700]"></div>
                <p className="text-[14px] text-[#79767d] font-rajdhani">Loading token info...</p>
              </div>
            )}

            {!isLoadingPreview && tokenPreview && (
              <div className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded p-3 sm:p-4 flex flex-col gap-3 sm:gap-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                  {tokenPreview.image ? (
                    <img
                      src={getIpfsUrl(tokenPreview.image)}
                      alt={tokenPreview.name}
                      className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border border-[rgba(255,255,255,0.1)] shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[rgba(255,255,255,0.1)] flex items-center justify-center border border-[rgba(255,255,255,0.1)] shrink-0">
                      <span className="text-[18px] sm:text-[24px] font-rajdhani font-bold text-[#79767d]">
                        {tokenPreview.symbol.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 flex flex-col gap-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <h4 className="text-[14px] sm:text-[16px] font-rajdhani font-bold text-white wrap-break-word">
                        {tokenPreview.name}
                      </h4>
                      <span className="text-[12px] sm:text-[14px] font-rajdhani font-medium text-[#d08700]">
                        {tokenPreview.symbol}
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-[12px] font-rajdhani text-[#79767d]">
                      Decimals: {tokenPreview.decimals}
                    </p>
                    <p className="text-[10px] sm:text-[12px] font-rajdhani text-[#79767d] font-mono break-all">
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

            <div className="bg-[rgba(208,135,0,0.05)] border border-[#d08700] p-3 sm:p-4 flex gap-2 sm:gap-3 rounded">
              <div className="shrink-0 text-[#d08700]">
                <Lock className="w-3 h-3 sm:w-4 sm:h-4" />
              </div>
              <div className="flex flex-col gap-1 text-[#79767d]">
                <p className="font-rajdhani font-bold text-[14px] sm:text-[16px] leading-[1.3]">
                  How Anonymity Works Here
                </p>
                <div className="text-[12px] sm:text-[14px] font-rajdhani leading-5 sm:leading-6">
                  <p className="mb-1 sm:mb-2">
                    For existing tokens, you (the Creator) will transfer the sale allocation into
                    the Zaunchpad Shielded Vault.
                  </p>
                  <p>
                    Buyers purchase tickets anonymously. When they claim, the Vault releases your
                    tokens to their fresh wallets. The blockchain sees Vault - Buyer. The link to
                    the buyer's payment is mathematically broken.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {!isExistingToken && (
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 w-full">
          <div className="flex-1 flex flex-col gap-2">
            <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
              Token Supply <span className="text-[#dd3345]">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="1000000"
              value={formData.tokenSupply}
              onChange={(e) => onInputChange('tokenSupply', e.target.value)}
              className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] px-3 py-2.5 text-[14px] text-white font-rajdhani focus:outline-none focus:border-[#d08700] transition-colors rounded"
            />
          </div>
          <div className="w-full sm:w-[197px] flex flex-col gap-2">
            <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
              Decimal <span className="text-[#dd3345]">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="6"
              value={formData.decimal}
              onChange={(e) => onInputChange('decimal', e.target.value)}
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
          onChange={(e) => onInputChange('description', e.target.value)}
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
          className={`w-full h-[120px] sm:h-[163px] border border-dashed ${isUploadingLogo ? 'border-[#d08700]' : 'border-[rgba(255,255,255,0.1)]'} rounded flex flex-col items-center justify-center cursor-pointer hover:border-[rgba(255,255,255,0.2)] transition-colors p-4`}
          onClick={onFileUpload}
          onDrop={onImageDrop}
          onDragOver={onDragOver}
        >
          {logoUrl ? (
            <div className="flex flex-col items-center gap-2 sm:gap-3">
              <img
                src={getIpfsUrl(logoUrl)}
                alt="Token Logo"
                className="w-20 h-20 sm:w-32 sm:h-32 object-cover rounded border border-[rgba(255,255,255,0.1)]"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 sm:gap-3">
              <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center">
                {isUploadingLogo ? (
                  <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-[#d08700]"></div>
                ) : (
                  <img
                    src="/icons/add-image.svg"
                    alt="Upload"
                    className="opacity-50 w-full h-full"
                  />
                )}
              </div>
              <p className="text-[12px] sm:text-[14px] font-rajdhani font-bold text-[#79767d] text-center px-2">
                Drag & drop or click to upload icon
              </p>
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-[#656565] font-rajdhani">
                <Clipboard className="w-3 h-3" />
                <span>or paste from clipboard (Ctrl+V)</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Socials */}
      <div className="flex flex-col gap-4">
        <h3 className="text-[16px] font-bold text-white font-rajdhani uppercase mb-2">Socials</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="block text-[14px] font-rajdhani font-bold text-[#79767d]">
              X/Twitter
            </label>
            <URLInput
              prefix="x.com/"
              value={formData.twitterUrl}
              onChange={(value) => onInputChange('twitterUrl', value)}
              placeholder="username"
              className="w-full bg-transparent text-white font-rajdhani rounded"
              isInvalid={!isTwitterValid}
            />
            {twitterErrorMessage && (
              <p className="text-[12px] text-[#dd3345] font-rajdhani">{twitterErrorMessage}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="block text-[14px] font-rajdhani font-bold text-[#79767d]">
              Telegram
            </label>
            <URLInput
              prefix="t.me/"
              value={formData.telegramUrl}
              onChange={(value) => onInputChange('telegramUrl', value)}
              placeholder="channel"
              className="w-full bg-transparent text-white font-rajdhani rounded"
              isInvalid={!isTelegramValid}
            />
            {telegramErrorMessage && (
              <p className="text-[12px] text-[#dd3345] font-rajdhani">{telegramErrorMessage}</p>
            )}
          </div>
          <div className="sm:col-span-2 flex flex-col gap-2">
            <label className="block text-[14px] font-rajdhani font-bold text-[#79767d]">
              Website
            </label>
            <URLInput
              prefix="https://"
              value={formData.websiteUrl}
              onChange={(value) => onInputChange('websiteUrl', value)}
              placeholder="website.com"
              className="w-full bg-transparent text-white font-rajdhani rounded"
              isInvalid={!isWebsiteValid}
            />
            {websiteErrorMessage && (
              <p className="text-[12px] text-[#dd3345] font-rajdhani">{websiteErrorMessage}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

