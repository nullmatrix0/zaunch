interface NoTokensFoundProps {
  searchQuery?: string;
  className?: string;
  width?: string;
  height?: string;
  titleSize?: string;
  subTitleSize?: string;
}

export function NoTokensFound({
  searchQuery,
  className,
  width,
  height,
  titleSize,
  subTitleSize,
}: NoTokensFoundProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2.5 max-w-[741px]">
          <h1
            className={`${titleSize ? titleSize : 'text-5xl'} font-rajdhani font-semibold text-white text-center leading-[1.69] tracking-[-6.14%]`}
          >
            {searchQuery ? 'No Tokens Found' : 'Oops! No Tokens Here'}
          </h1>
          <p
            className={`${subTitleSize ? subTitleSize : 'text-xl'} font-rajdhani text-gray-400 text-center leading-[2] max-w-[741px]`}
          >
            {searchQuery
              ? `We couldn't find any tokens matching ${searchQuery.toUpperCase()}. Try searching with different keywords or browse our available tokens.`
              : "The tokens you're looking for seem to have wandered off into the blockchain. Let's get you back to discovering amazing tokens!"}
          </p>
        </div>
      </div>
    </div>
  );
}
