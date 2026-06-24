import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";

export function AnomalySparkline({ data }: { data: { t: string; a: number }[] }) {
  if (data.length === 0) return null;
  
  return (
    <div className="h-24 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--warn)" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="var(--warn)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <YAxis domain={[0, 14]} hide />
          <Area type="monotone" dataKey="a" stroke="var(--warn)" fillOpacity={1} fill="url(#colorA)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
