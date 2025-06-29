"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ResponseTimeDistributionProps {
  data: number[];
  average: number;
  targetResponseTime?: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { label: string; count: number } }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {payload[0].value}
          </span>{" "}
          responses
        </p>
      </div>
    );
  }
  return null;
};

export default function ResponseTimeDistribution({
  data,
  average,
  targetResponseTime,
}: ResponseTimeDistributionProps) {
  if (!data || !data.length) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No response time data available
      </div>
    );
  }

  // Create bins for the histogram (0-1s, 1-2s, 2-3s, etc.)
  const maxTime = Math.ceil(Math.max(...data));
  const bins = Array(Math.min(maxTime + 1, 10)).fill(0);

  // Count responses in each bin
  data.forEach((time) => {
    const binIndex = Math.min(Math.floor(time), bins.length - 1);
    bins[binIndex]++;
  });

  // Create chart data
  const chartData = bins.map((count, i) => {
    let label: string;
    if (i === bins.length - 1 && bins.length < maxTime + 1) {
      label = `${i}+ sec`;
    } else {
      label = `${i}-${i + 1} sec`;
    }

    // Determine color based on response time
    let color: string;
    if (i <= 2)
      color = "hsl(var(--chart-1))"; // Green for fast
    else if (i <= 5)
      color = "hsl(var(--chart-4))"; // Yellow for medium
    else color = "hsl(var(--chart-3))"; // Red for slow

    return {
      name: label,
      value: count,
      color,
    };
  });

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            strokeOpacity={0.3}
          />
          <XAxis
            dataKey="name"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            label={{
              value: "Number of Responses",
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle" },
            }}
          />
          <Tooltip content={<CustomTooltip />} />

          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            fill="hsl(var(--chart-1))"
            maxBarSize={60}
          >
            {chartData.map((entry, index) => (
              <Bar key={`cell-${entry.name}-${index}`} fill={entry.color} />
            ))}
          </Bar>

          {/* Average line */}
          <ReferenceLine
            x={Math.floor(average)}
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            strokeDasharray="5 5"
            label={{
              value: `Avg: ${average.toFixed(1)}s`,
              position: "top" as const,
              style: {
                fill: "hsl(var(--primary))",
                fontSize: "12px",
                fontWeight: "500",
              },
            }}
          />

          {/* Target line (if provided) */}
          {targetResponseTime && (
            <ReferenceLine
              x={Math.floor(targetResponseTime)}
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              strokeDasharray="3 3"
              label={{
                value: `Target: ${targetResponseTime}s`,
                position: "top" as const,
                style: {
                  fill: "hsl(var(--chart-2))",
                  fontSize: "12px",
                  fontWeight: "500",
                },
              }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
