export const GAS_RESERVE = 0.001;
export const SLIPPAGE_BPS = 50;
export const COMPUTE_UNIT_PRICE = 100000;
export const MAX_FRACTION_DIGITS = 6;
export const LAMPORTS_PER_SOL = 1_000_000_000;
export const TOTAL_FEE_PERCENT = 0.003;
export const PRIVACY_FEE_PERCENT = 0.005;
export const SWAP_STATUS_POLL_INTERVAL = 10000;
export const TICKET_ADDRESS_GENERATION_DELAY = 1000;

export enum MigrationProgress {
  PreBondingCurve = 0,
  PostBondingCurve = 1,
  LockedVesting = 2,
  CreatedPool = 3,
}

export const PHASE_INFO = {
  [MigrationProgress.PreBondingCurve]: {
    label: 'BONDING CURVE',
    color: 'orange',
    description: 'Initial fundraising phase',
  },
  [MigrationProgress.PostBondingCurve]: {
    label: 'FUNDRAISING COMPLETE',
    color: 'green',
    description: 'Preparing for migration',
  },
  [MigrationProgress.LockedVesting]: {
    label: 'VESTING PERIOD',
    color: 'purple',
    description: 'Locked vesting in progress',
  },
  [MigrationProgress.CreatedPool]: {
    label: 'LIVE TRADING',
    color: 'emerald',
    description: 'Pool created and migrated',
  },
} as const;
