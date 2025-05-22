"use client";

import { useRef, useEffect } from "react";
import Chart from "chart.js/auto";
import annotationPlugin from "chartjs-plugin-annotation";

Chart.register(annotationPlugin);

interface ResponseTimeDistributionProps {
  responseTimes: number[];
  targetResponseTime?: number;
}

export default function ResponseTimeDistribution({
  responseTimes,
  targetResponseTime,
}: ResponseTimeDistributionProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!ref.current || !responseTimes.length) return;

    const ctx = ref.current.getContext("2d");
    if (!ctx) return;

    // Create bins for the histogram (0-1s, 1-2s, 2-3s, etc.)
    const maxTime = Math.ceil(Math.max(...responseTimes));
    const bins = Array(Math.min(maxTime + 1, 10)).fill(0);

    // Count responses in each bin
    responseTimes.forEach((time) => {
      const binIndex = Math.min(Math.floor(time), bins.length - 1);
      bins[binIndex]++;
    });

    // Create labels for each bin
    const labels = bins.map((_, i) => {
      if (i === bins.length - 1 && bins.length < maxTime + 1) {
        return `${i}+ seconds`;
      }
      return `${i}-${i + 1} seconds`;
    });

    const chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Responses",
            data: bins,
            backgroundColor: bins.map((_, i) => {
              // Green for fast, yellow for medium, red for slow
              if (i <= 2) return "rgba(34, 197, 94, 0.7)"; // Green
              if (i <= 5) return "rgba(250, 204, 21, 0.7)"; // Yellow
              return "rgba(239, 68, 68, 0.7)"; // Red
            }),
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          annotation: targetResponseTime
            ? {
                annotations: {
                  targetLine: {
                    type: "line",
                    yMin: 0,
                    yMax: Math.max(...bins),
                    xMin: targetResponseTime,
                    xMax: targetResponseTime,
                    borderColor: "rgba(75, 192, 192, 1)",
                    borderWidth: 2,
                    label: {
                      display: true,
                      content: "Target",
                      position: "start",
                    },
                  },
                },
              }
            : undefined,
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: "Number of Responses",
            },
          },
          x: {
            title: {
              display: true,
              text: "Response Time",
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [responseTimes, targetResponseTime]);

  return <canvas ref={ref} height={180} />;
}
