# ZAUNCHPAD Frontend

Frontend application for ZAUNCHPAD - Privacy-first cross-chain token launchpad built with Next.js 15.

## Overview

This is the main frontend application for Zaunchpad, a decentralized token launchpad that enables privacy-first token launches on Solana with cross-chain payment support via NEAR Intents.

## Tech Stack

### Core Framework
- **Next.js 15** with Turbopack for fast development
- **React 19** for UI components
- **TypeScript 5** for type safety

### UI & Styling
- **Tailwind CSS 4** for styling
- **Shadcn UI** (Radix UI primitives) for component library
- **Framer Motion** & **GSAP** for animations
- **Lucide React** for icons

### State Management
- **TanStack Query** (React Query) for server state
- **SWR** for data fetching and caching
- **React Context** for wallet state

### Blockchain Integration

#### Solana
- `@solana/web3.js` - Core Solana client
- `@solana/spl-token` - Token operations
- `@solana/wallet-adapter-*` - Wallet integration
- `@coral-xyz/anchor` - Solana program interaction
- `@metaplex-foundation/mpl-token-metadata` - Token metadata

#### NEAR Protocol
- `@near-js/*` - NEAR core libraries
- `@near-wallet-selector/*` - Multi-wallet support

#### Cross-Chain & DeFi
- `@meteora-ag/dynamic-bonding-curve-sdk` - Meteora DBC integration
- `omni-bridge-sdk` - Cross-chain token resolution
- `@defuse-protocol/one-click-sdk-typescript` - NEAR Intents (1Click)

### Storage & Infrastructure
- `@storacha/client` - IPFS storage via Storacha
- Phala Network TEE - Secure proof generation

### Code Quality
- **Biome** - Fast linter and formatter
- **Prettier** - Code formatting
- **TypeScript** - Type checking

## Project Structure

```
app/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # Home page
│   │   ├── create/            # Token creation
│   │   ├── token/             # Token pages
│   │   │   ├── page.tsx       # Token list/search
│   │   │   ├── [address]/     # Token detail
│   │   │   └── me/            # User's tokens
│   │   └── api/               # API routes
│   │       └── ipfs/          # IPFS upload endpoints
│   ├── components/
│   │   ├── create-token/      # Token creation UI
│   │   │   ├── QuickLaunch.tsx
│   │   │   ├── TokenInfoStep.tsx
│   │   │   └── SaleParametersStep.tsx
│   │   ├── token/             # Token display & interaction
│   │   │   ├── TokenHeader.tsx
│   │   │   ├── TradingInterface.tsx
│   │   │   ├── UserClaimButton.tsx
│   │   │   ├── ClaimProof.tsx
│   │   │   └── ...
│   │   ├── wallet/            # Wallet UI
│   │   │   ├── WalletButton.tsx
│   │   │   └── WalletSidebar.tsx
│   │   ├── home/              # Landing page sections
│   │   ├── layout/            # Layout components
│   │   └── ui/                # Shadcn UI components
│   ├── hooks/                 # Custom React hooks
│   │   ├── useDeployToken.ts  # Token deployment
│   │   ├── useNearIntents.ts  # NEAR Intents integration
│   │   ├── useOnChainTokens.ts # Token data fetching
│   │   └── useAnchorProvider.ts # Solana provider
│   ├── lib/                   # Core libraries
│   │   ├── sol.ts             # Solana utilities
│   │   ├── near.ts            # NEAR utilities
│   │   ├── meteora.ts         # Meteora DBC
│   │   ├── omni-bridge.ts     # Cross-chain tokens
│   │   ├── intents.ts         # NEAR Intents client
│   │   ├── ipfsService.ts     # IPFS storage
│   │   ├── tee-client.ts      # Phala TEE client
│   │   ├── solana-claim.ts    # Claim transactions
│   │   └── ticket-storage.ts  # Proof storage
│   ├── contexts/              # React contexts
│   │   └── WalletProviderContext.tsx
│   ├── types/                 # TypeScript types
│   ├── utils/                 # Utilities
│   └── configs/               # Configuration
│       └── env.config.ts
├── public/                    # Static assets
├── package.json
├── tsconfig.json
└── next.config.ts
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Installation

```bash
pnpm install
```

### Environment Setup

Create `.env.local` file:

```env
# Solana
NEXT_PUBLIC_SOL_NETWORK=devnet
NEXT_PUBLIC_HELIUS_API_KEY=your_key
NEXT_PUBLIC_PROGRAM_ID=your_program_id

# NEAR
NEXT_PUBLIC_NEAR_NETWORK=testnet
NEXT_PUBLIC_TATUM_API_KEY_TESTNET=your_key

# NEAR Intents
NEXT_PUBLIC_ONECLICK_JWT=your_jwt
NEXT_PUBLIC_ONECLICK_API_BASE_URL=https://1click.chaindefuser.com

# IPFS (Storacha)
NEXT_PUBLIC_STORACHA_EMAIL=your_email
NEXT_PUBLIC_STORACHA_PRIVATE_KEY=your_key
NEXT_PUBLIC_STORACHA_PROOF=your_proof
NEXT_PUBLIC_STORACHA_SPACE_DID=your_space_did

# TEE
NEXT_PUBLIC_TEE_ENDPOINT=your_tee_endpoint
```

### Development

```bash
pnpm dev
```

Server runs at http://localhost:3000

### Build

```bash
pnpm build
```

### Production

```bash
pnpm start
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with Turbopack |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run Biome linter |
| `pnpm lint:fix` | Auto-fix linting issues |
| `pnpm format` | Format code with Biome |
| `pnpm format:prettier` | Format code with Prettier |
| `pnpm format:check` | Check formatting |
| `pnpm format:all` | Format with both tools |

## Code Quality

This project uses **Biome** and **Prettier** together:

- **Biome**: Primary tool for linting and formatting (fast, batteries-included)
- **Prettier**: Secondary formatter for consistency

### Configuration
- **Biome**: `biome.json` - Single quotes, 2-space indent, 100 line width
- **Prettier**: `.prettierrc` - Matches Biome settings

## Key Features

### Token Creation
- Create SPL tokens on Solana
- Configure launch parameters (timing, pricing, supply)
- Upload metadata to IPFS
- Deploy with existing tokens or create new ones

### Token Participation
- Browse and search launched tokens
- View real-time statistics and charts
- Make cross-chain payments via NEAR Intents
- Support for multiple payment tokens (NEAR, ETH, USDC, etc.)

### Token Claiming
- Generate zk-proofs via Phala TEE
- Download proof ZIP files
- Claim tokens after sale ends
- Proof replay protection

### Wallet Integration
- Solana: Phantom, Solflare, and other Wallet Adapter wallets
- NEAR: Multiple wallet options via Wallet Selector

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@solana/web3.js` | Solana blockchain interaction |
| `@meteora-ag/dynamic-bonding-curve-sdk` | Bonding curve operations |
| `@near-wallet-selector/*` | NEAR wallet integration |
| `omni-bridge-sdk` | Cross-chain token resolution |
| `@defuse-protocol/one-click-sdk-typescript` | NEAR Intents payments |
| `@storacha/client` | IPFS storage |
| `@tanstack/react-query` | Server state management |
| `framer-motion` | Animations |
| `recharts` | Charts and graphs |

## Architecture Highlights

### Token Launch Flow
1. User creates token with metadata
2. Metadata uploaded to IPFS (Storacha)
3. Solana program creates launch account
4. Token minted and locked in vault
5. Launch becomes active

### Payment Flow
1. User selects payment token and amount
2. NEAR Intents generates deposit address
3. User sends payment from any supported chain
4. 1Click swaps to Zcash (if needed)
5. TEE verifies payment and generates proof
6. User downloads proof ZIP

### Claim Flow
1. Sale ends
2. User uploads proof ZIP
3. Proof validated
4. Claim transaction created
5. Tokens transferred to user

## License

MIT
