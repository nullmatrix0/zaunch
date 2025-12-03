'use client';

import { InfoTooltip } from '@/components/ui/info-tooltip';

interface SaleParametersStepProps {
  formData: {
    pricePerToken: string;
    minRaise: string;
    amountToBeSold: string;
    saleStartTime: string;
    saleEndTime: string;
    claimType: 'immediate' | 'scheduled';
    claimOpeningTime: string;
    creatorWallet: string;
  };
  dateValidationErrors: {
    saleEndTime?: string;
    claimOpeningTime?: string;
  };
  isZecAddressValid: boolean;
  zecAddressErrorMessage: string | null;
  getMinDateTime: () => string;
  getMinEndDateTime: () => string;
  getMinClaimDateTime: () => string;
  onInputChange: (field: string, value: string) => void;
  onClaimTypeChange: (type: 'immediate' | 'scheduled') => void;
}

export default function SaleParametersStep({
  formData,
  dateValidationErrors,
  isZecAddressValid,
  zecAddressErrorMessage,
  getMinDateTime,
  getMinEndDateTime,
  getMinClaimDateTime,
  onInputChange,
  onClaimTypeChange,
}: SaleParametersStepProps) {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full animate-in fade-in slide-in-from-right-4">
      <h3 className="text-[20px] sm:text-[24px] font-rajdhani font-semibold text-[#d08700] mb-2">
        Sale Parameters
      </h3>

      {/* Price per Token */}
      <div className="flex gap-4 sm:gap-8 w-full">
        <div className="flex-1 flex flex-col gap-2">
          <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
            Price per Token (USD) <span className="text-[#dd3345]">*</span>
          </label>
          <div className="relative w-full">
            <input
              type="text"
              placeholder="0.00001"
              value={formData.pricePerToken}
              onChange={(e) => onInputChange('pricePerToken', e.target.value)}
              className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] px-3 py-2.5 pr-24 sm:pr-28 text-[14px] text-white font-rajdhani font-bold focus:outline-none focus:border-[#d08700] transition-colors rounded"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-end gap-0.5">
              <span className="text-[#d08700] text-[12px] sm:text-[14px] font-rajdhani font-bold whitespace-nowrap">
                USD / Token
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Min Raise & Amount to be Sold */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 w-full">
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex gap-1 items-center flex-wrap">
            <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
              Minimum Raise (Tokens)
            </label>
            <InfoTooltip content="Minimum amount of tokens required for the launch to be successful." />
          </div>
          <input
            type="text"
            placeholder="Coming soon"
            value={formData.minRaise}
            onChange={(e) => onInputChange('minRaise', e.target.value)}
            disabled
            className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] px-3 py-2.5 text-[14px] text-white font-rajdhani focus:outline-none transition-colors rounded opacity-50 cursor-not-allowed"
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
            onChange={(e) => onInputChange('amountToBeSold', e.target.value)}
            className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] px-3 py-2.5 text-[14px] text-white font-rajdhani focus:outline-none focus:border-[#d08700] transition-colors rounded"
          />
        </div>
      </div>

      {/* Start & End Time */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 w-full">
        <div className="flex-1 flex flex-col gap-2">
          <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
            Sale Start Time <span className="text-[#dd3345]">*</span>
          </label>
          <div className="relative w-full">
            <input
              type="datetime-local"
              min={getMinDateTime()}
              value={formData.saleStartTime}
              onChange={(e) => onInputChange('saleStartTime', e.target.value)}
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
              onChange={(e) => onInputChange('saleEndTime', e.target.value)}
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
        <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">Claim Schedule</label>
        <div className="flex flex-col sm:flex-row border border-[rgba(255,255,255,0.1)] rounded p-1 gap-1">
          <button
            onClick={() => onClaimTypeChange('immediate')}
            className={`flex-1 py-1.5 px-2 sm:px-3 text-[12px] sm:text-[14px] font-rajdhani font-medium rounded transition-colors ${
              formData.claimType === 'immediate'
                ? 'bg-[#d08700] text-black shadow-sm'
                : 'bg-transparent text-[#64748b] hover:text-white'
            }`}
          >
            Immediate Claim (After Sale)
          </button>
          <button
            onClick={() => onClaimTypeChange('scheduled')}
            className={`flex-1 py-1.5 px-2 sm:px-3 text-[12px] sm:text-[14px] font-rajdhani font-medium rounded transition-colors ${
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
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 w-full animate-in fade-in slide-in-from-top-2">
          <div className="flex-1 flex flex-col gap-2">
            <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
              Claim Opening Time <span className="text-[#dd3345]">*</span>
            </label>
            <div className="relative w-full">
              <input
                type="datetime-local"
                min={getMinClaimDateTime()}
                value={formData.claimOpeningTime}
                onChange={(e) => onInputChange('claimOpeningTime', e.target.value)}
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
          <div className="flex-1 hidden sm:block" />
        </div>
      )}

      {/* Creator Wallet (ZEC) */}
      <div className="flex gap-4 sm:gap-8 w-full">
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex gap-1 items-center flex-wrap">
            <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
              Creator Wallet (ZEC) <span className="text-[#dd3345]">*</span>
            </label>
            <InfoTooltip content="ZEC wallet address to receive funds from NEAR intents" />
          </div>
          <input
            type="text"
            placeholder="Enter ZEC wallet address"
            value={formData.creatorWallet}
            onChange={(e) => onInputChange('creatorWallet', e.target.value)}
            className={`w-full bg-transparent border px-3 py-2.5 text-[14px] text-white font-rajdhani focus:outline-none transition-colors rounded ${
              formData.creatorWallet && !isZecAddressValid
                ? 'border-[#dd3345] focus:border-[#dd3345]'
                : 'border-[rgba(255,255,255,0.1)] focus:border-[#d08700]'
            }`}
          />
          {zecAddressErrorMessage && (
            <p className="text-[12px] text-[#dd3345] font-rajdhani">{zecAddressErrorMessage}</p>
          )}
        </div>
      </div>

      {/* Alert Info */}
      <div className="bg-[rgba(255,255,255,0.09)] p-3 sm:p-4 rounded flex items-start gap-3">
        <div className="text-[12px] sm:text-[14px] text-white font-rajdhani">
          <ul className="list-disc pl-4 sm:pl-5 space-y-1">
            <li>
              If the Minimum Raise is met but the Amount to be Sold is not fully filled, any
              remaining unsold tokens will be returned to the creator wallet.
            </li>
            <li>Claim period start immediately after sale, or set delayed claim</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

