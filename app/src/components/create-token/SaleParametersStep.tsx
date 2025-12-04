'use client';

import { InfoTooltip } from '@/components/ui/info-tooltip';
import { AlertTriangle, ExternalLink } from 'lucide-react';

const MAX_PRICE_TESTNET = 0.10; // $0.10 max on testnet

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

      {/* Testnet Disclaimer */}
      <div className="bg-[rgba(221,51,69,0.1)] border border-[#dd3345] p-3 sm:p-4 rounded flex gap-2 sm:gap-3 items-start">
        <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-[#dd3345] shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <p className="text-[13px] sm:text-[14px] font-rajdhani font-bold text-[#dd3345]">
            Testnet Notice - Real Funds on Intents
          </p>
          <p className="text-[11px] sm:text-[12px] font-rajdhani text-[#79767d]">
            Since this is testnet and funds are real on NEAR Intents, we cap the maximum price per token to <span className="text-white font-bold">${MAX_PRICE_TESTNET.toFixed(2)}</span> to streamline realistic testing while minimizing risk.
          </p>
        </div>
      </div>

      {/* Price per Token */}
      <div className="flex gap-4 sm:gap-8 w-full">
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex gap-1 items-center flex-wrap">
            <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
              Price per Token (USD) <span className="text-[#dd3345]">*</span>
            </label>
            <span className="text-[11px] font-rajdhani text-[#dd3345]">
              (Max: ${MAX_PRICE_TESTNET.toFixed(2)} on testnet)
            </span>
          </div>
          <div className="relative w-full">
            <input
              type="text"
              placeholder="0.00001"
              value={formData.pricePerToken}
              onChange={(e) => {
                const value = e.target.value;
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue > MAX_PRICE_TESTNET) {
                  onInputChange('pricePerToken', MAX_PRICE_TESTNET.toString());
                } else {
                  onInputChange('pricePerToken', value);
                }
              }}
              max={MAX_PRICE_TESTNET}
              className={`w-full bg-transparent border px-3 py-2.5 pr-24 sm:pr-28 text-[14px] text-white font-rajdhani font-bold focus:outline-none transition-colors rounded ${
                parseFloat(formData.pricePerToken) > MAX_PRICE_TESTNET
                  ? 'border-[#dd3345] focus:border-[#dd3345]'
                  : 'border-[rgba(255,255,255,0.1)] focus:border-[#d08700]'
              }`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-end gap-0.5">
              <span className="text-[#d08700] text-[12px] sm:text-[14px] font-rajdhani font-bold whitespace-nowrap">
                USD / Token
              </span>
            </div>
          </div>
          {parseFloat(formData.pricePerToken) > MAX_PRICE_TESTNET && (
            <p className="text-[12px] text-[#dd3345] font-rajdhani">
              Price exceeds testnet maximum of ${MAX_PRICE_TESTNET.toFixed(2)}
            </p>
          )}
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
            disabled
            className="flex-1 py-1.5 px-2 sm:px-3 text-[12px] sm:text-[14px] font-rajdhani font-medium rounded bg-transparent text-[#64748b]/50 cursor-not-allowed"
          >
            Schedule Date <span className="text-[10px] ml-1">(Coming Soon)</span>
          </button>
        </div>
      </div>

      {/* Creator Wallet (ZEC) */}
      <div className="flex gap-4 sm:gap-8 w-full">
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex gap-1 items-center flex-wrap">
            <label className="text-[14px] font-rajdhani font-bold text-[#79767d]">
              Creator Wallet (ZEC) <span className="text-[#dd3345]">*</span>
            </label>
            <InfoTooltip 
              title="ZEC Wallet Address"
              content="Your Zcash wallet address to receive funds. Supports transparent (t1...), shielded (zs...), or unified (u1...) addresses."
            />
          </div>
          <input
            type="text"
            placeholder="t1... or zs... or u1..."
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
          
          {/* ZEC Address Guide */}
          <div className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded p-2.5 sm:p-3 mt-1">
            <p className="text-[12px] sm:text-[14px] font-rajdhani font-bold text-[#79767d] mb-2">
              How to get a ZEC address:
            </p>
            <ul className="text-[11px] sm:text-[13px] font-rajdhani text-[#656565] space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-[#d08700] shrink-0">1.</span>
                <span className="break-words">Download a Zcash wallet: 
                  <a href="https://zecwallet.co/" target="_blank" rel="noopener noreferrer" className="text-[#d08700] hover:underline ml-1 inline-flex items-center gap-0.5">
                    ZecWallet Lite <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  </a> or 
                  <a href="https://ywallet.app/" target="_blank" rel="noopener noreferrer" className="text-[#d08700] hover:underline ml-1 inline-flex items-center gap-0.5">
                    YWallet <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#d08700] shrink-0">2.</span>
                <span>Create a new wallet and securely save your seed phrase</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#d08700] shrink-0">3.</span>
                <span>Copy your receiving address (starts with t1, zs, or u1)</span>
              </li>
            </ul>
            <p className="text-[10px] sm:text-[11px] font-rajdhani text-[#656565] mt-2 pt-2 border-t border-[rgba(255,255,255,0.1)]">
              💡 For privacy, use a shielded (zs) or unified (u1) address
            </p>
          </div>
        </div>
      </div>

      {/* Alert Info */}
      <div className="bg-[rgba(255,255,255,0.09)] p-3 sm:p-4 rounded">
        <p className="text-[13px] sm:text-[14px] font-rajdhani font-bold text-white mb-2">
          How it works:
        </p>
        <ul className="list-disc pl-4 sm:pl-5 space-y-1.5 text-[11px] sm:text-[13px] text-[#b0b0b0] font-rajdhani">
          <li>
            Sale end time must be after start time
          </li>
          <li>
            After sale ends, creators can claim any unsold tokens via ZK proof verification
          </li>
          <li>
            Claim period starts immediately after sale ends
          </li>
          <li>
            Buyers purchase tickets anonymously using ZEC via NEAR Intents
          </li>
        </ul>
        
        {/* Coming Soon Features */}
        <div className="mt-3 sm:mt-4 pt-3 border-t border-[rgba(255,255,255,0.1)]">
          <p className="text-[12px] sm:text-[13px] font-rajdhani font-bold text-[#d08700] mb-2">
            🚀 Coming Soon:
          </p>
          <ul className="list-disc pl-4 sm:pl-5 space-y-1 text-[11px] sm:text-[13px] text-[#656565] font-rajdhani">
            <li>
              <span className="text-[#79767d] font-medium">Scheduled Claim</span>
              <span className="hidden sm:inline"> - Set a custom date for when buyers can claim their tokens</span>
            </li>
            <li>
              <span className="text-[#79767d] font-medium">Minimum Raise</span>
              <span className="hidden sm:inline"> - Set a funding goal; if not met, buyers get automatic refunds</span>
            </li>
            <li>
              <span className="text-[#79767d] font-medium">Buyer Refunds</span>
              <span className="hidden sm:inline"> - If target not hit, tickets can be used to reclaim funds</span>
            </li>
            <li>
              <span className="text-[#79767d] font-medium">Vesting Schedules</span>
              <span className="hidden sm:inline"> - Release tokens gradually over time</span>
            </li>
            <li>
              <span className="text-[#79767d] font-medium">Whitelist/Allowlist</span>
              <span className="hidden sm:inline"> - Restrict who can participate in the sale</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

