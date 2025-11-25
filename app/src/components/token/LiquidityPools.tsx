"use client"

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ExternalLink, Minus, Plus, Info } from "lucide-react";
import { getPoolConfigByMint, getPoolStateByMint } from "@/lib/api";
import { Token } from "@/types/api";
import { getSolPrice } from "@/lib/sol";
import { formatTinyPrice, hexToNumber } from "@/utils";
import { SOL_NETWORK } from "@/configs/env.config";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getIpfsUrl } from "@/lib/utils";

// Migration status enums
enum IsMigrated {
    NotMigrated = 0,
    Migrated = 1
}

enum MigrationProgress {
    PreBondingCurve = 0,
    PostBondingCurve = 1,
    LockedVesting = 2,
    CreatedPool = 3
}

// Get pool status info
const getPoolStatus = (isMigrated: number, migrationProgress: number) => {
    if (isMigrated === IsMigrated.Migrated) {
        return {
            label: 'MIGRATED',
            color: 'emerald',
            description: 'Pool is fully migrated and active',
            showLiquidityActions: true
        };
    }

    switch (migrationProgress) {
        case MigrationProgress.PreBondingCurve:
            return {
                label: 'BONDING CURVE',
                color: 'orange',
                description: 'Initial fundraising phase',
                showLiquidityActions: false
            };
        case MigrationProgress.PostBondingCurve:
            return {
                label: 'FUNDRAISING COMPLETE',
                color: 'green',
                description: 'Preparing for migration',
                showLiquidityActions: false
            };
        case MigrationProgress.LockedVesting:
            return {
                label: 'VESTING PERIOD',
                color: 'purple',
                description: 'Locked vesting in progress',
                showLiquidityActions: false
            };
        case MigrationProgress.CreatedPool:
            return {
                label: 'POOL CREATED',
                color: 'blue',
                description: 'Pool created, ready for migration',
                showLiquidityActions: false
            };
        default:
            return {
                label: 'UNKNOWN',
                color: 'gray',
                description: 'Status unknown',
                showLiquidityActions: false
            };
    }
};

interface LiquidityPoolsProps {
    onAddLiquidity: (isOpen: boolean) => void;
    token: Token;
}

interface PoolCard {
    id: string;
    name: string;
    poolAddress: string;
    token1Icon: string;
    token2Icon: string;
    platforms: {
        platform: string;
        platformIcon: string;
    }[];
    metrics: any[];
    isExpanded?: boolean;
    isMigrated: boolean;
    migrationProgress: number;
    position?: {
        value: string;
        apr: string;
        poolShare: string;
    };
}

interface BlockchainSection {
    id: string;
    name: string;
    icon: string;
    poolCount: number;
    activeCount: number;
    pools: PoolCard[];
    isExpanded?: boolean;
    tags?: Array<{
        name: string;
        icon: string;
        variant?: "default" | "secondary" | "outline";
    }>;
}


const ChevronIcon = ({ isExpanded }: { isExpanded: boolean }) => (
    isExpanded ? <ChevronUp className="w-4 h-4 cursor-pointer" /> : <ChevronDown className="w-4 h-4 cursor-pointer" />
);

const PoolCard = ({ pool, onToggle, poolAddress }: { pool: PoolCard; onToggle: () => void; poolAddress: string }) => {
    const poolStatus = getPoolStatus(pool.isMigrated ? 1 : 0, pool.migrationProgress);

    const getStatusColorClasses = (color: string) => {
        const colorMap: Record<string, { bg: string; text: string; border: string }> = {
            orange: { bg: 'bg-orange-950/30', text: 'text-orange-400', border: 'border-orange-500/30' },
            green: { bg: 'bg-green-950/30', text: 'text-green-400', border: 'border-green-500/30' },
            purple: { bg: 'bg-purple-950/30', text: 'text-purple-400', border: 'border-purple-500/30' },
            blue: { bg: 'bg-blue-950/30', text: 'text-blue-400', border: 'border-blue-500/30' },
            emerald: { bg: 'bg-emerald-950/30', text: 'text-emerald-400', border: 'border-emerald-500/30' },
            gray: { bg: 'bg-gray-800', text: 'text-gray-400', border: 'border-gray-700' }
        };
        return colorMap[color] || colorMap.gray;
    };

    const statusColors = getStatusColorClasses(poolStatus.color);

    const viewOnPlatForm = () =>{
        window.open(`https://devnet.meteora.ag/dlmm/${poolAddress}`, '_blank');
    }

    return (
        <Card className="p-3 md:p-4 mb-3 border border-white/10 shadow-none rounded-md bg-[#111] text-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <div className="flex -space-x-2 items-center shrink-0">
                        <img
                            src={pool.token1Icon}
                            alt="Token 1"
                            className="w-8 h-8 md:w-9 md:h-9 rounded-full border-2 border-[#111]"
                        />
                        <img
                            src={pool.token2Icon}
                            alt="Token 2"
                            className="w-8 h-8 md:w-9 md:h-9 rounded-full border-2 border-[#111]"
                        />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-sm truncate text-white">{pool.name}</h3>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                                {poolStatus.label}
                            </span>
                            {pool.isMigrated ? (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-emerald-950/30 text-emerald-400 border-emerald-500/30">
                                    ✓ MIGRATED
                                </span>
                            ) : (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-gray-800 text-gray-400 border-gray-700">
                                    NOT MIGRATED
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {pool.platforms.map((platform, index) => (
                                <div key={index} className="flex items-center gap-1 border border-white/10 p-1 px-2 justify-center bg-[#1A1A1A] rounded-full">
                                    <img src={platform.platformIcon} alt={platform.platform} className="w-3 h-3 md:w-4 md:h-4" />
                                    <span className="text-[10px] md:text-[11px] text-gray-400">{platform.platform}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 justify-end md:justify-start">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div>
                                    <Button
                                        onClick={SOL_NETWORK === 'mainnet' ? viewOnPlatForm : undefined}
                                        size="sm"
                                        disabled={SOL_NETWORK !== 'mainnet'}
                                        className={`text-[10px] md:text-xs bg-[#1A1A1A] border border-white/10 shadow-none h-8 md:h-9 px-2 md:px-3 text-white ${
                                            SOL_NETWORK === 'mainnet'
                                                ? 'hover:bg-[#2A2A2A] hover:border-white/20 cursor-pointer'
                                                : 'opacity-50 cursor-not-allowed'
                                        }`}
                                    >
                                        <span className="hidden sm:inline">View on Meteora</span>
                                        <span className="sm:hidden">Meteora</span>
                                        <ExternalLink className="w-3 h-3"/>
                                    </Button>
                                </div>
                            </TooltipTrigger>
                            {SOL_NETWORK !== 'mainnet' && (
                                <TooltipContent className="border border-white/10 bg-[#1A1A1A] text-white">
                                    <p>Doesn't work on {SOL_NETWORK}. Only available on mainnet.</p>
                                </TooltipContent>
                            )}
                        </Tooltip>
                    </TooltipProvider>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggle}
                        className="w-8 h-8 md:w-6 md:h-6 cursor-pointer shrink-0 text-white hover:bg-white/10 hover:text-white"
                    >
                        <ChevronIcon isExpanded={pool.isExpanded || false} />
                    </Button>
                </div>
            </div>

        {pool.isExpanded && (
            <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-4">
                    {pool.metrics.map((metric, index) => (
                        <div key={index} className="text-left md:text-center flex flex-col p-2 md:p-0">
                            <span className="text-[10px] md:text-xs text-gray-400 mb-1">{metric.label}</span>
                            <span
                                className={`text-xs md:text-sm font-medium truncate ${
                                    metric.isHighlighted ? "text-green-400" : "text-white"
                                }`}
                            >
                                {metric.showPrefix === true ? '$' : ''}{metric.value}
                            </span>
                        </div>
                    ))}
                </div>

                {!poolStatus.showLiquidityActions && (
                    <div className={`border rounded-lg p-3 md:p-4 ${statusColors.bg} ${statusColors.border}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <h4 className={`font-medium text-sm ${statusColors.text}`}>
                                {poolStatus.label}
                            </h4>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs bg-[#1A1A1A] border-white/10 text-white">
                                    <p>DBC is a virtual pool. You cannot add or remove liquidity until migration is complete and the pool becomes a real DEX pool.</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <p className="text-xs text-gray-400">
                            {poolStatus.description}. Liquidity management will be available after migration.
                        </p>
                    </div>
                )}

                {poolStatus.showLiquidityActions && (
                    <div className="border border-emerald-500/30 rounded-lg p-3 md:p-4 bg-emerald-950/20">
                        <div className="flex items-center gap-2 mb-3">
                            <h4 className="font-medium text-sm text-emerald-400">
                                Manage your Position
                            </h4>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-emerald-500 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs bg-[#1A1A1A] border-white/10 text-white">
                                    <p>Pool has been migrated! You can now add/remove liquidity and trade on Meteora and other DEX exchanges.</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <div className="flex flex-col md:flex-row md:justify-between gap-3 md:gap-4">
                            <div className="grid grid-cols-3 gap-3 md:gap-4 flex-1">
                                <div>
                                    <div className="text-[10px] md:text-xs text-gray-400 mb-1">My Position</div>
                                    <div className="text-xs md:text-sm font-medium text-white">0</div>
                                </div>
                                <div>
                                    <div className="text-[10px] md:text-xs text-gray-400 mb-1">APR</div>
                                    <div className="text-xs md:text-sm font-medium text-white">0</div>
                                </div>
                                <div>
                                    <div className="text-[10px] md:text-xs text-gray-400 mb-1">Pool Share</div>
                                    <div className="text-xs md:text-sm font-medium text-white">0</div>
                                </div>
                            </div>
                            <div className="flex gap-2 md:gap-2 w-full md:w-auto">
                                <Button className="flex-1 md:flex-initial shadow-none bg-[#1A1A1A] border border-white/10 hover:bg-[#2A2A2A] hover:border-white/20 h-9 md:h-auto text-white">
                                    <Plus className="w-3 h-3"/>
                                    <span className="text-xs">Add</span>
                                </Button>
                                <Button className="flex-1 md:flex-initial shadow-none bg-[#1A1A1A] border border-white/10 hover:bg-[#2A2A2A] hover:border-white/20 h-9 md:h-auto text-white">
                                    <Minus className="w-3 h-3"/>
                                    <span className="text-xs">Remove</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        )}
        </Card>
    );
};


const BlockchainSection = ({
    section,
    onToggleSection,
    onTogglePool,
}: {
    section: BlockchainSection;
    onToggleSection: () => void;
    onTogglePool: (poolId: string) => void;
}) => {
    return (
        <Card className="mb-4 border border-white/10 shadow-none p-0 bg-[#111] text-white">
            <div
                className="p-4 cursor-pointer hover:bg-[#1A1A1A] bg-[#111] rounded-xl transition-colors border-b border-white/5"
                onClick={onToggleSection}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src={section.icon} alt={section.name} className="w-10 h-10 rounded-full border border-white/10" />
                        <div>
                            <h3 className="font-medium text-white">{section.name}</h3>
                            <p className="text-sm text-gray-400">
                                {section.poolCount} pools • {section.activeCount} active
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 cursor-pointer text-gray-400">
                        <ChevronIcon isExpanded={section.isExpanded || false} />
                    </div>
                </div>
            </div>

            {section.isExpanded && section.pools.length > 0 && (
                <div className="px-4 pb-4 mt-3">
                    {section.pools.map((pool) => (
                        <PoolCard
                            key={pool.id}
                            pool={pool}
                            onToggle={() => onTogglePool(pool.id)}
                            poolAddress={pool.poolAddress}
                        />
                    ))}
                </div>
            )}
        </Card>
    );
};


export function LiquidityPools({ token, onAddLiquidity }: LiquidityPoolsProps) {
    const [data, setData] = useState<BlockchainSection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadPools = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const [solPrice, poolConfig, poolState] = await Promise.all([
                    getSolPrice(),
                    token?.mintAddress ? getPoolConfigByMint(token.mintAddress) : null,
                    token?.mintAddress ? getPoolStateByMint(token.mintAddress) : null
                ]);

                if(solPrice && poolConfig && poolState){
                    if (!poolState) {
                        setData([]);
                        return;
                    }

                    // According to Meteora DBC docs: liquidity = poolState.quoteReserve * quoteTokenPrice
                    const totalLiquidityUSD = (hexToNumber(poolState.account.quoteReserve) / Math.pow(10, 9)) * solPrice;
                    const volume24hUSD = 0;
                    const feeRate = (poolConfig.poolFees?.protocolFeePercent || 0) / 10000;
                    const fee24hUSD = volume24hUSD * feeRate;
                    const feeToTvl = totalLiquidityUSD > 0 ? fee24hUSD / totalLiquidityUSD : 0;

                    const feeEarnedUSD = volume24hUSD * feeRate;
                    const yourLPUSD = 0;

                    const isMigrated = poolState.account.isMigrated === 1;
                    const migrationProgress = poolState.account.migrationProgress || 0;

                    // Calculate bonding curve specific metrics
                    const quoteReserveSOL = hexToNumber(poolState.account.quoteReserve) / Math.pow(10, 9);
                    const totalRaisedUSD = quoteReserveSOL * solPrice;

                    // Migration threshold from pool config
                    const migrationThresholdSOL = hexToNumber(poolConfig.migrationQuoteThreshold) / Math.pow(10, 9);
                    const migrationThresholdUSD = migrationThresholdSOL * solPrice;
                    const progressPercentage = migrationThresholdSOL > 0
                        ? ((quoteReserveSOL / migrationThresholdSOL) * 100).toFixed(2)
                        : "0";

                    // Total fees collected
                    const totalTradingFeesSOL = hexToNumber(poolState.account.metrics.totalTradingQuoteFee) / Math.pow(10, 9);
                    const totalTradingFeesUSD = totalTradingFeesSOL * solPrice;

                    // Show different metrics based on migration status
                    const metrics = isMigrated
                        ? [
                            { label: "Total Liquidity", value: formatTinyPrice(totalLiquidityUSD), isHighlighted: false, showPrefix: true },
                            { label: "24h Volume", value: volume24hUSD.toString(), isHighlighted: false, showPrefix: true },
                            { label: "24h Fees/TVL", value: feeToTvl.toString(), isHighlighted: false, showPrefix: true },
                            { label: "Fee Earned", value: feeEarnedUSD.toString(), isHighlighted: false, showPrefix: true },
                            { label: "Your LP Position", value: yourLPUSD.toString(), isHighlighted: false, showPrefix: true }
                          ]
                        : [
                            { label: "SOL Raised", value: `${quoteReserveSOL.toFixed(4)} SOL`, isHighlighted: false, showPrefix: false },
                            { label: "USD Raised", value: formatTinyPrice(totalRaisedUSD), isHighlighted: true, showPrefix: true },
                            { label: "Target Goal", value: formatTinyPrice(migrationThresholdUSD), isHighlighted: false, showPrefix: true },
                            { label: "Progress", value: `${progressPercentage}%`, isHighlighted: false, showPrefix: false },
                            { label: "Total Fees", value: formatTinyPrice(totalTradingFeesUSD), isHighlighted: false, showPrefix: true },
                          ];

                    const dataPool = {
                        id: poolState.publicKey,
                        poolAddress: poolState.publicKey,
                        name: `${token.name}-SOL`,
                        token1Icon: getIpfsUrl(token.metadata.tokenUri),
                        token2Icon: "/chains/solana-dark.svg",
                        platforms: [
                            {
                                platform: "Meteora",
                                platformIcon: "/logos/meteora.png"
                            }
                        ],
                        metrics,
                        isExpanded: false,
                        isMigrated,
                        migrationProgress,
                        position: {
                            value: "0",
                            apr: "0%",
                            poolShare: "0%"
                        }
                    };
                    
                    const blockchainSection: BlockchainSection = {
                        id: "solana",
                        name: "Solana",
                        icon: "/chains/solana-dark.svg",
                        poolCount: 1,
                        activeCount: 1,
                        pools: [dataPool],
                        isExpanded: false
                    };
                    
                    setData([blockchainSection]);
                }
            } catch (err) {
                console.error('Error loading pools:', err);
                setError('Failed to load pool data');
                setData([]);
            } finally {
                setLoading(false);
            }
        };
        
        loadPools();
    }, [token.mintAddress]);

    const toggleSection = (sectionId: string) => {
        setData((prev) =>
        prev.map((section) =>
            section.id === sectionId
            ? { ...section, isExpanded: !section.isExpanded }
            : section
        )
        );
    };

    const togglePool = (poolId: string) => {
        setData((prev) =>
        prev.map((section) => ({
            ...section,
            pools: section.pools.map((pool) =>
            pool.id === poolId
                ? { ...pool, isExpanded: !pool.isExpanded }
                : pool
            ),
        }))
        );
    };

    if (loading) {
        return (
            <Card className="p-4 md:p-6 mb-6 shadow-none border border-white/10 flex flex-col gap-1 bg-[#111] text-white">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-medium mb-4 text-white">Liquidity Pools</h2>
                </div>
                <div className="space-y-4 mt-4">
                    <div className="animate-pulse">
                        <div className="h-16 bg-[#1A1A1A] rounded-xl mb-4"></div>
                        <div className="h-16 bg-[#1A1A1A] rounded-xl mb-4"></div>
                        <div className="h-16 bg-[#1A1A1A] rounded-xl"></div>
                    </div>
                </div>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="p-4 md:p-6 mb-6 shadow-none border border-white/10 flex flex-col gap-1 bg-[#111] text-white">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-medium mb-4 text-white">Liquidity Pools</h2>
                </div>
                <div className="text-center py-8">
                    <p className="text-red-500 mb-4">{error}</p>
                    <Button 
                        onClick={() => window.location.reload()}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        Retry
                    </Button>
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-4 md:p-6 mb-6 shadow-none border border-white/10 flex flex-col gap-1 bg-[#111] text-white">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-medium mb-4 text-white">Liquidity Pools</h2>
            </div>

            <div className="space-y-4 mt-4">
                {data.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-gray-500 mb-4">No liquidity pools found</p>
                    </div>
                ) : (
                    data.map((section) => (
                        <BlockchainSection
                            key={section.id}
                            section={section}
                            onToggleSection={() => toggleSection(section.id)}
                            onTogglePool={togglePool}
                        />
                    ))
                )}
            </div>
        </Card>
    );
}
