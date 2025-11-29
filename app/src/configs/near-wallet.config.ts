import { setupBitteWallet } from '@near-wallet-selector/bitte-wallet';
import { setupIntearWallet } from '@near-wallet-selector/intear-wallet';
import { setupLedger } from '@near-wallet-selector/ledger';
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet';
import { setupNightly } from '@near-wallet-selector/nightly';
import type { SetupParams } from '@near-wallet-selector/react-hook';
import { NEAR_NETWORK } from './env.config';

export const nearWalletConfig: SetupParams = {
  network: NEAR_NETWORK as any,
  modules: [
    setupMeteorWallet(),
    setupBitteWallet() as any,
    setupLedger(),
    setupNightly(),
    setupIntearWallet(),
  ],
  languageCode: 'en',
  debug: true,
  createAccessKeyFor: {
    contractId: 'v1.social08.testnet',
    methodNames: [],
  },
};
