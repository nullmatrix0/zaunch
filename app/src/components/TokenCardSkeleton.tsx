import { Skeleton } from './ui/skeleton';

export const TokenCardSkeleton = () => {
  return (
    <div className="backdrop-blur-[2px] bg-[#000000] border border-[rgba(255,255,255,0.1)] h-[384px] relative w-full max-w-[408px]">
      <div className="h-full overflow-hidden relative">
        {/* Corner decorations */}
        <div className="absolute border-[#d08700] border-b-0 border-l-2 border-r-0 border-solid border-t-2 left-[0.67px] w-[14px] h-[14px] top-[0.67px]" />
        <div className="absolute border-[#d08700] border-b-0 border-l-0 border-r-2 border-solid border-t-2 right-[0.67px] w-[14px] h-[14px] top-[0.67px]" />
        <div className="absolute border-[#d08700] border-b-2 border-l-2 border-r-0 border-solid border-t-0 bottom-[0.67px] left-[0.67px] w-[14px] h-[14px]" />
        <div className="absolute border-[#d08700] border-b-2 border-l-0 border-r-2 border-solid border-t-0 bottom-[0.67px] right-[0.67px] w-[14px] h-[14px]" />

        <div className="absolute left-[21.67px] right-[21.66px] top-[21.67px] flex items-start justify-between">
          <Skeleton className="w-14 h-14 rounded-[7px] border border-[rgba(255,255,255,0.1)]" />
          <Skeleton className="h-6 w-20 border border-[rgba(255,255,255,0.1)]" />
        </div>

        <div className="absolute left-[21.67px] right-[21.66px] top-[98.67px]">
          <Skeleton className="h-7 w-40 bg-gray-800" />
        </div>

        <div className="absolute left-[21.67px] right-[21.66px] top-[130.17px]">
          <Skeleton className="h-4 w-20 bg-gray-800" />
        </div>

        <div className="absolute left-[21.67px] right-[21.66px] top-[161.67px] h-[35px]">
          <Skeleton className="h-4 w-full mb-2 bg-gray-800" />
          <Skeleton className="h-4 w-3/4 bg-gray-800" />
        </div>

        <div className="absolute left-[21.67px] right-[21.66px] top-[217.67px] flex flex-col gap-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24 bg-gray-800" />
            <Skeleton className="h-4 w-24 bg-gray-800" />
          </div>
          <Skeleton className="h-[7px] w-full bg-gray-800" />
        </div>

        <div className="absolute left-[21.67px] right-[21.66px] top-[266.67px] border-t border-[rgba(255,255,255,0.05)] pt-[14.667px] flex items-center justify-between">
          <Skeleton className="h-4 w-16 bg-gray-800" />
          <Skeleton className="h-4 w-12 bg-gray-800" />
        </div>

        <div className="absolute left-[21.67px] right-[21.66px] top-[316.33px]">
          <Skeleton className="h-10 w-full border-2 border-[rgba(255,255,255,0.1)]" />
        </div>
      </div>
    </div>
  );
};
