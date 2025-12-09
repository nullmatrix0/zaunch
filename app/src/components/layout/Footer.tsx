import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-[#050505] border-t-[0.667px] border-gray-900 pt-16 pb-16 w-full">
      <div className="container mx-auto px-6 flex flex-col gap-16">
        <div className="flex flex-col md:flex-row items-start justify-between gap-16 w-full">
          {/* Logo and Tagline */}
          <div className="flex flex-col gap-6 min-w-[320px]">
            <div className="flex items-center gap-3">
              <div className="relative w-8 h-8 rounded-full overflow-hidden">
                <img
                  src="/logo.png"
                  alt="Zaunchpad"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="font-space-grotesk font-bold text-xl text-gray-200 tracking-[-0.8px]">
                ZAUNCHPAD
              </span>
            </div>
            <div className="font-rajdhani font-medium text-base text-gray-600 leading-tight">
              <p>Decentralized. Private. Unstoppable. Built on</p>
              <p>Zcash, Solana, and NEAR.</p>
            </div>
          </div>

          {/* Links */}
          <div className="flex gap-16">
            <div className="flex flex-col gap-6">
              <h4 className="font-consolas font-bold text-base text-gray-300">PLATFORM</h4>
              <div className="flex flex-col gap-3">
                <Link
                  href="/token"
                  className="font-rajdhani font-medium text-base text-gray-600 hover:text-gray-300 transition-colors"
                >
                  Launches
                </Link>
                <Link
                  href="/create"
                  className="font-rajdhani font-medium text-base text-gray-600 hover:text-gray-300 transition-colors"
                >
                  Create
                </Link>
                <Link
                  href="/token"
                  className="font-rajdhani font-medium text-base text-gray-600 hover:text-gray-300 transition-colors"
                >
                  Dashboard
                </Link>
              </div>
            </div>

            {/* TODO: Hide resources */}
            <div className="flex flex-col gap-6">
              <h4 className="font-consolas font-bold text-base text-gray-300">RESOURCES</h4>
              <div className="flex flex-col gap-3">
                <a
                  href="https://docs.zaunchpad.com"
                  target="_blank"
                  rel="noreferrer"
                  className="font-rajdhani font-medium text-base text-gray-600 hover:text-gray-300 transition-colors"
                >
                  Docs
                </a>
                <a
                  href="https://github.com/zaunchpad"
                  target="_blank"
                  rel="noreferrer"
                  className="font-rajdhani font-medium text-base text-gray-600 hover:text-gray-300 transition-colors"
                >
                  Github
                </a>
                <a
                  href="https://x.com/zaunchpad"
                  target="_blank"
                  rel="noreferrer"
                  className="font-rajdhani font-medium text-base text-gray-600 hover:text-gray-300 transition-colors"
                >
                  Twitter
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t-[0.667px] border-gray-900 pt-10 flex items-center justify-center">
          <div className="flex items-center gap-2 text-lg text-[#999999] font-rajdhani">
            <span>Built with ❤️ by</span>
            <span>cypherpunks</span>
            <Link href={'https://github.com/zaunchpad'} target="_blank" rel="noreferrer">
              <img src="/assets/github.svg" alt="Github" />
            </Link>
            <Link href={'https://discord.gg/Pbn8Hs2D'} target="_blank" rel="noreferrer">
              <img width={20} src="/icons/discord.svg" alt="Discord" />
            </Link>
            <Link href={'https://x.com/zaunchpad'} target="_blank" rel="noreferrer">
              <img width={20} src="/icons/twitter.svg" alt="Twitter" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
