const tokenAvatars = [
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar.svg', name: 'Sol' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar%20(1).svg', name: 'NEAR' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar%20(2).svg', name: 'USDC' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar%20(3).svg', name: 'Stellar' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar%20(4).svg', name: 'Base' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar%20(5).svg', name: 'Pol' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar%20(6).svg', name: 'Sui' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar%20(7).svg', name: 'Doge' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar%20(8).svg', name: 'Arb' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar%20(9).svg', name: 'Eth' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar%20(10).svg', name: 'Zec' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar%20(11).svg', name: 'BSC' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar%20(12).svg', name: 'XRP' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar%20(13).svg', name: 'Tron' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar%20(14).svg', name: 'USDT' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar%20(15).svg', name: 'Aurora' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar%20(16).svg', name: 'Aptos' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar17.png', name: 'Avax' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar18.png', name: 'Op' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar19.png', name: 'Btc' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar20.png', name: 'ton' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar21.png', name: 'gnosis' },
  { src: 'https://ik.imagekit.io/zjvk6l5gp/Avatar23.jpeg', name: 'Bera' },
];

// Default fallback avatar
const DEFAULT_AVATAR = 'https://ik.imagekit.io/zjvk6l5gp/assets/Avatar22.jpeg';

function normalizeName(name: string): string {
  if (!name) return '';

  const upper = name.toUpperCase();

  // Special case: GNOSIS should match GNO
  if (upper === 'GNOSIS') {
    return 'GNO';
  }

  return upper;
}

/**
 * Finds an avatar by name (case-insensitive)
 */
function findAvatarByName(name: string): string | undefined {
  if (!name) return undefined;

  const normalized = normalizeName(name);

  return tokenAvatars.find((avatar) => normalizeName(avatar.name) === normalized)?.src;
}

export function getTokenIcon(
  tokenSymbol: string | null | undefined,
  blockchain?: string | null | undefined,
): string {
  // Try token symbol first
  if (tokenSymbol) {
    const tokenIcon = findAvatarByName(tokenSymbol);
    if (tokenIcon) {
      return tokenIcon;
    }
  }
  return DEFAULT_AVATAR;
}

/**
 * Gets the icon URL for a blockchain
 * Falls back to default avatar
 *
 * @param blockchain - The blockchain name (e.g., "sol", "near", "eth")
 * @returns The icon URL string
 */
export function getChainIcon(blockchain: string | null | undefined): string {
  if (!blockchain) {
    return DEFAULT_AVATAR;
  }

  const chainIcon = findAvatarByName(blockchain);
  return chainIcon || DEFAULT_AVATAR;
}

export function getIcon(options: {
  tokenSymbol?: string | null;
  blockchain?: string | null;
  tokenName?: string | null;
}): string {
  const { tokenSymbol, blockchain, tokenName } = options;

  // Try token symbol first
  if (tokenSymbol) {
    const tokenIcon = findAvatarByName(tokenSymbol);
    if (tokenIcon) {
      return tokenIcon;
    }
  }

  // Try token name as fallback (before blockchain)
  if (tokenName) {
    const tokenNameIcon = findAvatarByName(tokenName);
    if (tokenNameIcon) {
      return tokenNameIcon;
    }
  }

  // Fallback to blockchain name
  if (blockchain) {
    const blockchainIcon = findAvatarByName(blockchain);
    if (blockchainIcon) {
      return blockchainIcon;
    }
  }

  // Final fallback to default
  return DEFAULT_AVATAR;
}

export function getOneClickTokenIcon(token: {
  symbol?: string | null;
  blockchain?: string | null;
}): string {
  return getTokenIcon(token.symbol, token.blockchain);
}

export function capitalizeAll(str: string | null | undefined): string {
  if (!str) return '';

  const upper = str.toUpperCase();

  // Special case: GNOSIS should display as GNO
  if (upper === 'GNOSIS') {
    return 'GNO';
  }

  return upper;
}
