"use client";

import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface SecurityMetricsChartProps {
  data: Array<{ hour: number; count: number }>;
  type?: "line" | "bar";
  title?: string;
}

export function SecurityMetricsChart({
  data,
  type = "line",
  title,
}: SecurityMetricsChartProps) {
  const chartData = data.map((item) => ({
    hour: `${item.hour}:00`,
    count: item.count,
  }));

  const ChartComponent = type === "line" ? LineChart : BarChart;
  const DataComponent =
    type === "line" ? (
      <Line
        type="monotone"
        dataKey="count"
        stroke="#8884d8"
        strokeWidth={2}
        dot={{ fill: "#8884d8", strokeWidth: 2 }}
      />
    ) : (
      <Bar dataKey="count" fill="#8884d8" />
    );

  return (
    <div className="space-y-2">
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      <ResponsiveContainer width="100%" height={300}>
        <ChartComponent data={chartData}>
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: "#e5e7eb" }}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
            }}
          />
          {DataComponent}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}
