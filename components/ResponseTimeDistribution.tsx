"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface ResponseTimeDistributionProps {
  data: number[];
  average: number;
  targetResponseTime?: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-md">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">
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
    let label;
    if (i === bins.length - 1 && bins.length < maxTime + 1) {
      label = `${i}+ sec`;
    } else {
      label = `${i}-${i + 1} sec`;
    }

    // Determine color based on response time using cohesive palette
    let color;
    if (i <= 2) color = "rgb(37, 99, 235)"; // Blue for fast (primary color)
    else if (i <= 5) color = "rgb(107, 114, 128)"; // Gray for medium
    else color = "rgb(236, 72, 153)"; // Pink for slow

    return {
      name: label,
      value: count,
      color,
    };
  });

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="rgb(229, 231, 235)" 
            strokeOpacity={0.5}
          />
          <XAxis
            dataKey="name"
            stroke="rgb(100, 116, 139)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="rgb(100, 116, 139)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            label={{ 
              value: 'Number of Responses', 
              angle: -90, 
              position: 'insideLeft',
              style: { textAnchor: 'middle', fill: 'rgb(100, 116, 139)' }
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          
          <Bar 
            dataKey="value" 
            radius={[4, 4, 0, 0]}
            fill="hsl(var(--chart-1))"
          >
            {chartData.map((entry, index) => (
              <Bar key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>

          {/* Average line */}
          <ReferenceLine 
            x={Math.floor(average)} 
            stroke="rgb(0, 123, 255)" 
            strokeWidth={2}
            strokeDasharray="5 5"
            label={{ 
              value: `Avg: ${average.toFixed(1)}s`, 
              position: "top" as const,
              style: { 
                fill: "rgb(0, 123, 255)",
                fontSize: "12px",
                fontWeight: "500"
              }
            }}
          />

          {/* Target line (if provided) */}
          {targetResponseTime && (
            <ReferenceLine 
              x={Math.floor(targetResponseTime)} 
              stroke="rgb(255, 20, 147)" 
              strokeWidth={2}
              strokeDasharray="3 3"
              label={{ 
                value: `Target: ${targetResponseTime}s`, 
                position: "top" as const,
                style: { 
                  fill: "rgb(255, 20, 147)",
                  fontSize: "12px",
                  fontWeight: "500"
                }
              }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
