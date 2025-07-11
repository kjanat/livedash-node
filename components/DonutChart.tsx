"use client";

import Chart, { type BubbleDataPoint, type Point } from "chart.js/auto";
import { useEffect, useRef } from "react";

interface DonutChartProps {
  data: {
    labels: string[];
    values: number[];
    colors?: string[];
  };
  centerText?: {
    title?: string;
    value?: string | number;
  };
}

export default function DonutChart({ data, centerText }: DonutChartProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!ref.current || !data.values.length) return;

    const ctx = ref.current.getContext("2d");
    if (!ctx) return;

    // Default colors if not provided
    const defaultColors: string[] = [
      "rgba(59, 130, 246, 0.8)", // blue
      "rgba(16, 185, 129, 0.8)", // green
      "rgba(249, 115, 22, 0.8)", // orange
      "rgba(236, 72, 153, 0.8)", // pink
      "rgba(139, 92, 246, 0.8)", // purple
      "rgba(107, 114, 128, 0.8)", // gray
    ];

    const colors: string[] = data.colors || defaultColors;

    // Helper to create an array of colors based on the data length
    const getColors = () => {
      const result: string[] = [];
      for (let i = 0; i < data.values.length; i++) {
        result.push(colors[i % colors.length]);
      }
      return result;
    };

    const chart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: data.labels,
        datasets: [
          {
            data: data.values,
            backgroundColor: getColors(),
            borderWidth: 1,
            hoverOffset: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: "70%",
        plugins: {
          legend: {
            position: "right",
            labels: {
              boxWidth: 12,
              padding: 20,
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || "";
                const value = context.formattedValue;
                const total = context.chart.data.datasets[0].data.reduce(
                  (
                    a: number,
                    b:
                      | number
                      | Point
                      | [number, number]
                      | BubbleDataPoint
                      | null
                  ) => {
                    if (typeof b === "number") {
                      return a + b;
                    }
                    // Handle other types like Point, [number, number], BubbleDataPoint if necessary
                    // For now, we'll assume they don't contribute to the sum or are handled elsewhere
                    return a;
                  },
                  0
                ) as number;
                const percentage = Math.round((context.parsed * 100) / total);
                return `${label}: ${value} (${percentage}%)`;
              },
            },
          },
        },
      },
      plugins: centerText
        ? [
            {
              id: "centerText",
              beforeDraw: (chart: Chart<"doughnut">) => {
                const height = chart.height;
                const ctx = chart.ctx;
                ctx.restore();

                // Calculate the actual chart area width (excluding legend)
                // Legend is positioned on the right, so we adjust the center X coordinate
                const chartArea = chart.chartArea;
                const chartWidth = chartArea.right - chartArea.left;

                // Get the center of just the chart area (not including the legend)
                const centerX = chartArea.left + chartWidth / 2;
                const centerY = height / 2;

                // Title text
                if (centerText.title) {
                  ctx.font = "1rem sans-serif"; // Consistent font
                  ctx.fillStyle = "#6B7280"; // Tailwind gray-500
                  ctx.textAlign = "center";
                  ctx.textBaseline = "middle"; // Align vertically
                  ctx.fillText(centerText.title, centerX, centerY - 10); // Adjust Y offset
                }

                // Value text
                if (centerText.value !== undefined) {
                  ctx.font = "bold 1.5rem sans-serif"; // Consistent font, larger
                  ctx.fillStyle = "#1F2937"; // Tailwind gray-800
                  ctx.textAlign = "center";
                  ctx.textBaseline = "middle"; // Align vertically
                  ctx.fillText(
                    centerText.value.toString(),
                    centerX,
                    centerY + 15
                  ); // Adjust Y offset
                }
                ctx.save();
              },
            },
          ]
        : [],
    });

    return () => chart.destroy();
  }, [data, centerText]);

  return <canvas ref={ref} height={300} />;
}
