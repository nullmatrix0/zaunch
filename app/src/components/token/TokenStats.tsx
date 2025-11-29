import { Card } from '@/components/ui/card';

export function TokenStats() {
  const stats = [
    { label: 'USED AMOUNT (ZEC)', value: '3,840', borderClass: 'border-l-2 border-purple-500' },
    { label: 'TARGET', value: '5,000 ZEC', borderClass: 'border-l-2 border-pink-600' },
    { label: 'TICKET PRICE', value: '12 ZEC', borderClass: 'border-l-2 border-green-500' },
    { label: 'PARTICIPANTS', value: '720', borderClass: 'border-l-2 border-blue-500/20' },
  ];

  return (
    <div className="flex gap-4 w-full overflow-x-auto pb-2">
      {stats.map((stat, index) => (
        <div key={index} className={`relative shrink-0 w-[185px] ${stat.borderClass} bg-[#050505] border-y border-r border-gray-800`}>
          <div className="p-4 flex flex-col gap-1">
            <div className="font-rajdhani text-sm text-gray-500">{stat.label}</div>
            <div className="font-rajdhani font-bold text-xl text-gray-300">{stat.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

