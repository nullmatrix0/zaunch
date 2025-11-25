# ZAUNCHPAD 🚀

> Privacy-first cross-chain token launchpad enabling anonymous participation in crypto token launches using Zcash shielded pools, with deep integration for Solana and Near ecosystems.

Zaunchpad is a next-generation decentralized launchpad that bridges the gap between privacy and transparency. It allows users to launch and participate in token sales across multiple chains (Solana, Near) while leveraging privacy features and advanced bonding curve mechanisms via Meteora.

## ✨ Features

- **Multi-Chain Support**: Seamlessly operate across **Solana** and **Near** blockchains.
- **Token Launch Mechanism**: create and launch tokens with customizable parameters.
- **Dynamic Bonding Curves**: Integration with **Meteora DLMM** and dynamic bonding curves for efficient price discovery and liquidity.
- **Cross-Chain Bridging**: Built-in bridge functionality using **Omni Bridge** and LayerZero technology.
- **Privacy First**: Designed with anonymous participation in mind using Zcash shielded pool concepts.
- **Decentralized Storage**: IPFS integration for immutable token metadata storage.
- **Modern UI/UX**: A responsive and animated interface built with the latest web technologies.

## 🛠 Tech Stack

### Frontend (`/app`)
- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/), [Shadcn UI](https://ui.shadcn.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/), [GSAP](https://greensock.com/gsap/)
- **State Management**: React Query, SWR

### Backend (`/backend`)
- **Runtime**: [Bun](https://bun.sh/)
- **Framework**: [Hono](https://hono.dev/)
- **Database**: PostgreSQL
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Validation**: Zod
- **Storage**: IPFS (Storacha)

## 📂 Project Structure

```bash
.
├── app/                # Next.js Frontend
│   ├── src/            # Source code
│   │   ├── components/ # UI Components (Shadcn, Custom)
│   │   ├── hooks/      # Custom React Hooks
│   │   ├── lib/        # Utility libraries (Solana, Near, Meteora)
│   │   └── ...
│   └── ...
├── backend/            # Hono Backend API
│   ├── db/             # Database schema and migrations
│   ├── src/            # API Source
│   │   ├── routes/     # API Endpoints
│   │   ├── services/   # Business Logic
│   │   └── ...
│   └── ...
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Bun** (for backend)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/zaunchpad/zaunchpad.git
   cd zaunchpad
   ```

2. Install dependencies for both frontend and backend:

   **Frontend:**
   ```bash
   cd app
   pnpm install
   ```

   **Backend:**
   ```bash
   cd backend
   bun install
   ```

### Running the Project

#### Frontend (Next.js)

```bash
cd app
pnpm dev
# Runs on http://localhost:3000
```

#### Backend (Hono)

```bash
cd backend
bun run dev
# Runs on http://localhost:3001
```

## 🔐 Environment Variables

You will need to configure environment variables for both applications. Create `.env` files in `app/` and `backend/`.

**Common Variables (Example):**

```env
# Backend
DATABASE_URL=postgresql://...
PORT=3001
SOLANA_RPC_URL=...
NEAR_NETWORK_ID=...

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SOLANA_RPC=...
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

Built with ❤️ by [Zaunchpad](https://www.zaunchpad.com)
