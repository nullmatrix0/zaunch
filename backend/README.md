# 🚀 ZAUNCHPAD Backend

REST API server for the ZAUNCHPAD - Privacy-first cross-chain token launchpad.

## Tech Stack

- **Runtime**: Bun
- **Framework**: Hono
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod
- **Storage**: Filebase (IPFS)
- **Blockchain**: Solana Web3.js, Meteora SDK

## Project Structure

```
backend/
├── src/
│   ├── configs/       # Configuration files
│   ├── lib/           # Utility libraries
│   ├── routes/        # API route handlers
│   ├── services/      # Business logic
│   └── types/         # TypeScript types
├── db/                # Database schema and migrations
├── drizzle/           # Migration files
├── index.ts           # Server entry point
└── drizzle.config.ts  # Drizzle configuration
```

## Getting Started

### Prerequisites

- Bun 1.0+
- PostgreSQL 14+

### Installation

```bash
bun install
```

### Environment Setup

```bash
cp env.example .env
```

Required environment variables:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/zaunchpad

# STORACHA (IPFS)
STORACHA_EMAIL=
STORACHA_PRIVATE_KEY=
STORACHA_PROOF=
STORACHA_SPACE_DID=

# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Server
PORT=3001
```

### Database Setup

```bash
# Generate migrations
bun run db:generate

# Run migrations
bun run db:push
```

### Development

```bash
bun run dev
```

Server runs at http://localhost:3001

### Production

```bash
bun run start
```

## Scripts

| Command               | Description                           |
| --------------------- | ------------------------------------- |
| `bun run dev`         | Start with hot reload                 |
| `bun run start`       | Start production server               |
| `bun run test`        | Run tests                             |
| `bun run db:generate` | Generate migrations                   |
| `bun run db:push`     | Run migrations                        |
| `bun run lint`        | Check code quality (ESLint)           |
| `bun run lint:fix`    | Auto-fix linting issues               |
| `bun run format`      | Format code with Prettier             |
| `bun run format:check`| Check code formatting without changes |

## API Endpoints

### Health Check

| Method | Endpoint | Description   |
| ------ | -------- | ------------- |
| GET    | `/`      | Server status |

### Tokens

| Method | Endpoint                           | Description         |
| ------ | ---------------------------------- | ------------------- |
| POST   | `/api/tokens`                      | Create token        |
| GET    | `/api/tokens`                      | List tokens         |
| GET    | `/api/tokens/:id`                  | Get by ID           |
| GET    | `/api/tokens/mint/:address`        | Get by mint address |
| GET    | `/api/tokens/search`               | Search tokens       |
| GET    | `/api/tokens/address/:address`     | Get by owner        |
| GET    | `/api/tokens/popular`              | Popular tokens      |
| GET    | `/api/tokens/holders/:mintAddress` | Token holders       |
| DELETE | `/api/tokens/:id`                  | Delete token        |

### IPFS

| Method | Endpoint                    | Description     |
| ------ | --------------------------- | --------------- |
| POST   | `/api/ipfs/upload-image`    | Upload image    |
| POST   | `/api/ipfs/upload-metadata` | Upload metadata |
| GET    | `/api/ipfs/health`          | Service status  |

### Meteora

| Method | Endpoint                                 | Description       |
| ------ | ---------------------------------------- | ----------------- |
| POST   | `/api/meteora/dbc-config`                | Create DBC config |
| POST   | `/api/meteora/deploy-token`              | Deploy token      |
| GET    | `/api/meteora/pool/state/:mint`          | Pool state        |
| GET    | `/api/meteora/pool/config/:mint`         | Pool config       |
| GET    | `/api/meteora/pool/metadata/:mint`       | Pool metadata     |
| GET    | `/api/meteora/pool/curve-progress/:mint` | Curve progress    |

## Query Parameters

### Token Filtering

| Parameter | Type    | Description             |
| --------- | ------- | ----------------------- |
| `active`  | boolean | Filter by active status |
| `tag`     | string  | Filter by tag           |
| `owner`   | string  | Filter by owner address |
| `limit`   | number  | Result limit (1-100)    |

### Search

| Parameter | Type   | Description             |
| --------- | ------ | ----------------------- |
| `q`       | string | Search query (required) |

## Response Format

### Success

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

### Error

```json
{
  "success": false,
  "message": "Error description"
}
```

## Database Schema

### tokens

| Column      | Type      | Description         |
| ----------- | --------- | ------------------- |
| id          | uuid      | Primary key         |
| name        | string    | Token name          |
| symbol      | string    | Token symbol        |
| description | text      | Description         |
| totalSupply | string    | Total supply        |
| decimals    | integer   | Decimal places      |
| mintAddress | string    | Solana mint address |
| owner       | string    | Owner wallet        |
| tokenUri    | string    | Metadata URI        |
| createdAt   | timestamp | Creation time       |
| updatedAt   | timestamp | Last update         |

### token_allocations

| Column         | Type    | Description           |
| -------------- | ------- | --------------------- |
| id             | uuid    | Primary key           |
| tokenId        | uuid    | Foreign key to tokens |
| percentage     | decimal | Allocation percentage |
| walletAddress  | string  | Recipient wallet      |
| lockupPeriod   | integer | Lock duration         |
| vestingEnabled | boolean | Vesting enabled       |

## Key Dependencies

| Package                                 | Purpose            |
| --------------------------------------- | ------------------ |
| `hono`                                  | Web framework      |
| `drizzle-orm`                           | Database ORM       |
| `@solana/web3.js`                       | Solana interaction |
| `@meteora-ag/dynamic-bonding-curve-sdk` | Bonding curves     |
| `@filebase/sdk`                         | IPFS storage       |
| `zod`                                   | Schema validation  |

## License

MIT
