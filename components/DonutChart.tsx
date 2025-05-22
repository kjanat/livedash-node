"use client";

import { useRef, useEffect } from "react";
import Chart from "chart.js/auto";

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
              label: function (context) {
                const label = context.label || "";
                const value = context.formattedValue;
                const total = context.chart.data.datasets[0].data.reduce(
                  (a: number, b: any) => a + (typeof b === "number" ? b : 0),
                  0
                );
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
              beforeDraw: function (chart: any) {
                const width = chart.width;
                const height = chart.height;
                const ctx = chart.ctx;
                ctx.restore();

                // Title text
                if (centerText.title) {
                  ctx.font = "14px Arial";
                  ctx.fillStyle = "#6B7280"; // text-gray-500
                  ctx.textBaseline = "middle";
                  ctx.textAlign = "center";
                  ctx.fillText(centerText.title, width / 2, height / 2 - 10);
                }

                // Value text
                if (centerText.value !== undefined) {
                  ctx.font = "bold 20px Arial";
                  ctx.fillStyle = "#111827"; // text-gray-900
                  ctx.textBaseline = "middle";
                  ctx.textAlign = "center";
                  ctx.fillText(
                    String(centerText.value),
                    width / 2,
                    height / 2 + 10
                  );
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
