"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  SessionsLineChart,
  CategoriesBarChart,
  LanguagePieChart,
  TokenUsageChart,
} from "../../../components/Charts";
import { Company, MetricsResult, WordCloudWord } from "../../../lib/types";
import MetricCard from "../../../components/MetricCard";
import DonutChart from "../../../components/DonutChart";
import WordCloud from "../../../components/WordCloud";
import GeographicMap from "../../../components/GeographicMap";
import ResponseTimeDistribution from "../../../components/ResponseTimeDistribution";
import WelcomeBanner from "../../../components/WelcomeBanner";

interface MetricsApiResponse {
    metrics: MetricsResult;
    company: Company;
}

// Safely wrapped component with useSession
function DashboardContent() {
  const { data: session, status } = useSession(); // Add status from useSession
  const router = useRouter(); // Initialize useRouter
  const [metrics, setMetrics] = useState<MetricsResult | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const isAuditor = session?.user?.role === "auditor";

  useEffect(() => {
    // Redirect if not authenticated
    if (status === "unauthenticated") {
      router.push("/login");
      return; // Stop further execution in this effect
    }

    // Fetch metrics and company on mount if authenticated
    if (status === "authenticated") {
      const fetchData = async () => {
        setLoading(true);
        const res = await fetch("/api/dashboard/metrics");
          const data = (await res.json()) as MetricsApiResponse;
        console.log("Metrics from API:", {
          avgSessionLength: data.metrics.avgSessionLength,
          avgSessionTimeTrend: data.metrics.avgSessionTimeTrend,
          totalSessionDuration: data.metrics.totalSessionDuration,
          validSessionsForDuration: data.metrics.validSessionsForDuration,
        });
        setMetrics(data.metrics);
        setCompany(data.company);
        setLoading(false);
      };
      fetchData();
    }
  }, [status, router]); // Add status and router to dependency array

  async function handleRefresh() {
    if (isAuditor) return; // Prevent auditors from refreshing
    try {
      setRefreshing(true);

      // Make sure we have a company ID to send
      if (!company?.id) {
        setRefreshing(false);
        alert("Cannot refresh: Company ID is missing");
        return;
      }

      const res = await fetch("/api/admin/refresh-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id }),
      });

      if (res.ok) {
        // Refetch metrics
        const metricsRes = await fetch("/api/dashboard/metrics");
          const data = (await metricsRes.json()) as MetricsApiResponse;
        setMetrics(data.metrics);
      } else {
          const errorData = (await res.json()) as { error: string; };
        alert(`Failed to refresh sessions: ${errorData.error}`);
      }
    } finally {
      setRefreshing(false);
    }
  }

  // Calculate sentiment distribution
  const getSentimentData = () => {
    if (!metrics) return { positive: 0, neutral: 0, negative: 0 };

    if (
      metrics.sentimentPositiveCount !== undefined &&
      metrics.sentimentNeutralCount !== undefined &&
      metrics.sentimentNegativeCount !== undefined
    ) {
      return {
        positive: metrics.sentimentPositiveCount,
        neutral: metrics.sentimentNeutralCount,
        negative: metrics.sentimentNegativeCount,
      };
    }

    const total = metrics.totalSessions || 1;
    return {
      positive: Math.round(total * 0.6),
      neutral: Math.round(total * 0.3),
      negative: Math.round(total * 0.1),
    };
  };

  // Prepare token usage data
  const getTokenData = () => {
    if (!metrics || !metrics.tokensByDay) {
      return { labels: [], values: [], costs: [] };
    }

    const days = Object.keys(metrics.tokensByDay).sort();
    const labels = days.slice(-7);
    const values = labels.map((day) => metrics.tokensByDay?.[day] || 0);
    const costs = labels.map((day) => metrics.tokensCostByDay?.[day] || 0);

    return { labels, values, costs };
  };

  // Show loading state while session status is being determined
  if (status === "loading") {
    return <div className="text-center py-10">Loading session...</div>;
  }

  // If unauthenticated and not redirected yet (should be handled by useEffect, but as a fallback)
  if (status === "unauthenticated") {
    return <div className="text-center py-10">Redirecting to login...</div>;
  }

  if (!metrics || !company) {
    return <div className="text-center py-10">Loading dashboard...</div>;
  }

  // Function to prepare word cloud data from metrics.wordCloudData
  const getWordCloudData = (): WordCloudWord[] => {
    if (!metrics || !metrics.wordCloudData) return [];
    return metrics.wordCloudData;
  };

  // Function to prepare country data for the map using actual metrics
  const getCountryData = () => {
    if (!metrics || !metrics.countries) return {};

    // Convert the countries object from metrics to the format expected by GeographicMap
    const result = Object.entries(metrics.countries).reduce(
      (acc, [code, count]) => {
        if (code && count) {
          acc[code] = count;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    return result;
  };

  // Function to prepare response time distribution data
  const getResponseTimeData = () => {
    const avgTime = metrics.avgResponseTime || 1.5;
    const simulatedData: number[] = [];

    for (let i = 0; i < 50; i++) {
      const randomFactor = 0.5 + Math.random();
      simulatedData.push(avgTime * randomFactor);
    }

    return simulatedData;
  };

  return (
    <div className="space-y-8">
      <WelcomeBanner companyName={company.name} />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-lg ring-1 ring-slate-200/50">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">{company.name}</h1>
          <p className="text-slate-500 mt-1">
            Dashboard updated{" "}
            <span className="font-medium text-slate-600">
              {new Date(metrics.lastUpdated || Date.now()).toLocaleString()}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <button
            className="bg-sky-600 text-white py-2 px-5 rounded-lg shadow hover:bg-sky-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center text-sm font-medium"
            onClick={handleRefresh}
            disabled={refreshing || isAuditor}
          >
            {refreshing ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Refreshing...
              </>
            ) : (
              "Refresh Data"
            )}
          </button>
          <button
            className="bg-slate-100 text-slate-700 py-2 px-5 rounded-lg shadow hover:bg-slate-200 transition-colors flex items-center text-sm font-medium"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sign out
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Sessions"
          value={metrics.totalSessions}
          icon={
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
              />
            </svg>
          }
          trend={{
            value: metrics.sessionTrend ?? 0,
            isPositive: (metrics.sessionTrend ?? 0) >= 0,
          }}
        />
        <MetricCard
          title="Unique Users"
          value={metrics.uniqueUsers}
          icon={
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          }
          trend={{
            value: metrics.usersTrend ?? 0,
            isPositive: (metrics.usersTrend ?? 0) >= 0,
          }}
        />
        <MetricCard
          title="Avg. Session Time"
          value={`${Math.round(metrics.avgSessionLength || 0)}s`}
          icon={
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          trend={{
            value: metrics.avgSessionTimeTrend ?? 0,
            isPositive: (metrics.avgSessionTimeTrend ?? 0) >= 0,
          }}
        />
        <MetricCard
          title="Avg. Response Time"
          value={`${metrics.avgResponseTime?.toFixed(1) || 0}s`}
          icon={
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          }
          trend={{
            value: metrics.avgResponseTimeTrend ?? 0,
            isPositive: (metrics.avgResponseTimeTrend ?? 0) <= 0, // Lower response time is better
          }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow lg:col-span-2">
          <h3 className="font-bold text-lg text-gray-800 mb-4">
            Sessions Over Time
          </h3>
          <SessionsLineChart sessionsPerDay={metrics.days} />
        </div>
        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="font-bold text-lg text-gray-800 mb-4">
            Conversation Sentiment
          </h3>
          <DonutChart
            data={{
              labels: ["Positive", "Neutral", "Negative"],
              values: [
                getSentimentData().positive,
                getSentimentData().neutral,
                getSentimentData().negative,
              ],
              colors: ["#1cad7c", "#a1a1a1", "#dc2626"],
            }}
            centerText={{
              title: "Total",
              value: metrics.totalSessions,
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="font-bold text-lg text-gray-800 mb-4">
            Sessions by Category
          </h3>
          <CategoriesBarChart categories={metrics.categories || {}} />
        </div>
        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="font-bold text-lg text-gray-800 mb-4">
            Languages Used
          </h3>
          <LanguagePieChart languages={metrics.languages || {}} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="font-bold text-lg text-gray-800 mb-4">
            Geographic Distribution
          </h3>
          <GeographicMap countries={getCountryData()} />
        </div>

        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="font-bold text-lg text-gray-800 mb-4">
            Common Topics
          </h3>
          <div className="h-[300px]">
            <WordCloud words={getWordCloudData()} width={500} height={400} />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow">
        <h3 className="font-bold text-lg text-gray-800 mb-4">
          Response Time Distribution
        </h3>
        <ResponseTimeDistribution
          data={getResponseTimeData()}
          average={metrics.avgResponseTime || 0}
        />
      </div>
      <div className="bg-white p-6 rounded-xl shadow">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h3 className="font-bold text-lg text-gray-800">
            Token Usage & Costs
          </h3>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
            <div className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full flex items-center">
              <span className="font-semibold mr-1">Total Tokens:</span>
              {metrics.totalTokens?.toLocaleString() || 0}
            </div>
            <div className="text-sm bg-green-50 text-green-700 px-3 py-1 rounded-full flex items-center">
              <span className="font-semibold mr-1">Total Cost:</span>€
              {metrics.totalTokensEur?.toFixed(4) || 0}
            </div>
          </div>
        </div>
        <TokenUsageChart tokenData={getTokenData()} />
      </div>
    </div>
  );
}

// Our exported component
export default function DashboardPage() {
  return <DashboardContent />;
}
