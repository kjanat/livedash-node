"use client";
import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import { getLocalizedLanguageName } from "../lib/localization"; // Corrected import path

interface SessionsData {
  [date: string]: number;
}

interface CategoriesData {
  [category: string]: number;
}

interface LanguageData {
  [language: string]: number;
}

interface SessionsLineChartProps {
  sessionsPerDay: SessionsData;
}

interface CategoriesBarChartProps {
  categories: CategoriesData;
}

interface LanguagePieChartProps {
  languages: LanguageData;
}

interface SentimentChartProps {
  sentimentData: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

interface TokenUsageChartProps {
  tokenData: {
    labels: string[];
    values: number[];
    costs: number[];
  };
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
            borderColor: "rgb(59, 130, 246)",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            borderWidth: 2,
            tension: 0.3,
            fill: true,
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
            backgroundColor: "rgba(59, 130, 246, 0.7)",
            borderWidth: 1,
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

export function SentimentChart({ sentimentData }: SentimentChartProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current || !sentimentData) return;
    const ctx = ref.current.getContext("2d");
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Positive", "Neutral", "Negative"],
        datasets: [
          {
            data: [
              sentimentData.positive,
              sentimentData.neutral,
              sentimentData.negative,
            ],
            backgroundColor: [
              "rgba(34, 197, 94, 0.8)", // green
              "rgba(249, 115, 22, 0.8)", // orange
              "rgba(239, 68, 68, 0.8)", // red
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "right",
            labels: {
              usePointStyle: true,
              padding: 20,
            },
          },
        },
        cutout: "65%",
      },
    });
    return () => chart.destroy();
  }, [sentimentData]);
  return <canvas ref={ref} height={180} />;
}

export function LanguagePieChart({ languages }: LanguagePieChartProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current || !languages) return;
    const ctx = ref.current.getContext("2d");
    if (!ctx) return;

    // Get top 5 languages, combine others
    const entries = Object.entries(languages);
    const topLanguages = entries.sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Sum the count of all other languages
    const otherCount = entries
      .slice(5)
      .reduce((sum, [, count]) => sum + count, 0);
    if (otherCount > 0) {
      topLanguages.push(["Other", otherCount]);
    }

    // Store original ISO codes for tooltip
    const isoCodes = topLanguages.map(([lang]) => lang);

    const labels = topLanguages.map(([lang]) => {
      if (lang === "Other") {
        return "Other";
      }
      // Use getLocalizedLanguageName for robust name resolution
      // Pass "en" to maintain consistency with previous behavior if navigator.language is different
      return getLocalizedLanguageName(lang, "en");
    });

    const data = topLanguages.map(([, count]) => count);

    const chart = new Chart(ctx, {
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: [
              "rgba(59, 130, 246, 0.8)",
              "rgba(16, 185, 129, 0.8)",
              "rgba(249, 115, 22, 0.8)",
              "rgba(236, 72, 153, 0.8)",
              "rgba(139, 92, 246, 0.8)",
              "rgba(107, 114, 128, 0.8)",
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "right",
            labels: {
              usePointStyle: true,
              padding: 20,
            },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const label = context.label || "";
                const value = context.formattedValue || "";
                const index = context.dataIndex;
                const originalIsoCode = isoCodes[index]; // Get the original code

                // Only show ISO code if it's not "Other"
                // and it's a valid 2-letter code (check lowercase version)
                if (
                  originalIsoCode &&
                  originalIsoCode !== "Other" &&
                  /^[a-z]{2}$/.test(originalIsoCode.toLowerCase())
                ) {
                  return `${label} (${originalIsoCode.toUpperCase()}): ${value}`;
                }

                return `${label}: ${value}`;
              },
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [languages]);
  return <canvas ref={ref} height={180} />;
}

export function TokenUsageChart({ tokenData }: TokenUsageChartProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current || !tokenData) return;
    const ctx = ref.current.getContext("2d");
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: tokenData.labels,
        datasets: [
          {
            label: "Tokens",
            data: tokenData.values,
            backgroundColor: "rgba(59, 130, 246, 0.7)",
            borderWidth: 1,
            yAxisID: "y",
          },
          {
            label: "Cost (EUR)",
            data: tokenData.costs,
            backgroundColor: "rgba(16, 185, 129, 0.7)",
            borderWidth: 1,
            type: "line",
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true } },
        scales: {
          y: {
            beginAtZero: true,
            position: "left",
            title: {
              display: true,
              text: "Token Count",
            },
          },
          y1: {
            beginAtZero: true,
            position: "right",
            grid: {
              drawOnChartArea: false,
            },
            title: {
              display: true,
              text: "Cost (EUR)",
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [tokenData]);
  return <canvas ref={ref} height={180} />;
}
