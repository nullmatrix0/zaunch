import { MigrationProgress, PHASE_INFO } from './trading-constants';

export const formatBalance = (balance: number, decimals: number = 4): string => {
  return balance.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
};

export const getPhaseInfo = (migrationProgress: number) => {
  return (
    PHASE_INFO[migrationProgress as MigrationProgress] ?? {
      label: 'UNKNOWN',
      color: 'gray',
      description: 'Status unknown',
    }
  );
};

export const parseTime = (time: any): number => {
  if (typeof time === 'bigint') {
    return Number(time) * 1000;
  } else if (typeof time === 'string') {
    const parsed = Number(time);
    if (!isNaN(parsed)) {
      return parsed * 1000;
    } else {
      return new Date(time).getTime();
    }
  } else {
    return Number(time) * 1000;
  }
};
