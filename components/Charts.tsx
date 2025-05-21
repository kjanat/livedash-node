"use client";
import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

interface SessionsData {
  [date: string]: number;
}

interface CategoriesData {
  [category: string]: number;
}

interface SessionsLineChartProps {
  sessionsPerDay: SessionsData;
}

interface CategoriesBarChartProps {
  categories: CategoriesData;
}

// Basic line and bar chart for metrics. Extend as needed.
export function SessionsLineChart({ sessionsPerDay }: SessionsLineChartProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current || !sessionsPerDay) return;
    const ctx = ref.current.getContext("2d");
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: Object.keys(sessionsPerDay),
        datasets: [
          {
            label: "Sessions",
            data: Object.values(sessionsPerDay),
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });
    return () => chart.destroy();
  }, [sessionsPerDay]);
  return <canvas ref={ref} height={180} />;
}

export function CategoriesBarChart({ categories }: CategoriesBarChartProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current || !categories) return;
    const ctx = ref.current.getContext("2d");
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(categories),
        datasets: [
          {
            label: "Categories",
            data: Object.values(categories),
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });
    return () => chart.destroy();
  }, [categories]);
  return <canvas ref={ref} height={180} />;
}
