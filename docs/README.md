# ZAUNCHPAD Documentation

Documentation site for Zaunchpad - Privacy-first cross-chain token launchpad enabling anonymous participation in crypto token launches using Zcash shielded pools.

<<<<<<< HEAD
## Features

- **Nextra Documentation**: Full-featured documentation site with search
- **Mantine UI**: Beautiful, accessible components with dark mode support
- **TypeScript**: Fully typed for better developer experience
- **MDX Support**: Write documentation in Markdown with React components
- **Search**: Full-text search powered by Pagefind
- **Responsive**: Works perfectly on all devices

=======
>>>>>>> origin/main
## Documentation Sections

- **About Zaunchpad**: Overview and introduction
- **Architecture**: System architecture and components
- **User Guides**: How to create tokens, buy tokens, claim tokens, and use dashboard
- **Working with NEAR Intents**: Understanding NEAR Intents integration
- **Claiming with OFT**: Cross-chain token claiming (coming soon)
- **How Zcash Pools Work**: Understanding shielded pools and privacy
- **Understanding Anonymity Set**: Privacy guarantees explained
- **Debugging**: Troubleshooting guide
- **FAQ**: Frequently asked questions

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- Yarn >= 4.12.0 (or npm/pnpm)

### Installation

```bash
yarn install
```

### Development

```bash
yarn dev
```

The documentation site will be available at `http://localhost:3000`

### Build

```bash
yarn build
```

### Production

```bash
yarn start
```

## Folder Structure

```
docs/
├── app/              # Next.js app router pages
│   ├── layout.tsx    # Root layout with Mantine provider
│   └── global.css    # Global styles
├── components/       # Custom React components
│   ├── Logo/         # Zaunchpad logo component
│   ├── MantineNavBar/ # Navigation bar
│   └── MantineFooter/ # Footer component
├── content/          # Documentation content (MDX files)
│   ├── index.mdx     # Home page
│   ├── architecture.mdx
│   ├── user-guides.mdx
│   └── ...
├── config/           # Configuration files
│   └── index.ts      # Nextra and metadata config
├── public/           # Static assets
│   ├── logo.png
│   ├── og-image.png
│   └── favicon.ico
└── theme.ts          # Mantine theme configuration
```

## Scripts

### Development

- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn start` - Start production server

### Code Quality

- `yarn lint` - Run ESLint and Stylelint
- `yarn typecheck` - Check TypeScript types
- `yarn prettier:check` - Check code formatting
- `yarn prettier:write` - Format code

### Testing

- `yarn jest` - Run tests
- `yarn jest:watch` - Run tests in watch mode
- `yarn test` - Run all checks (typecheck, lint, prettier, jest)

### Other

- `yarn analyze` - Analyze bundle size
- `yarn build:pagefind` - Build search index
- `yarn storybook` - Start Storybook
- `yarn storybook:build` - Build Storybook

## Resources

- **Main Application**: [app.zaunchpad.com](https://app.zaunchpad.com)
- **Documentation**: [docs.zaunchpad.com](https://docs.zaunchpad.com)
- **GitHub Repository**: [github.com/zaunchpad/zaunchpad](https://github.com/zaunchpad/zaunchpad)
- **Issues**: [github.com/zaunchpad/zaunchpad/issues](https://github.com/zaunchpad/zaunchpad/issues)

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

---

Built with ❤️ by [Zaunchpad](https://www.zaunchpad.com)
