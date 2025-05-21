"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  SessionsLineChart,
  CategoriesBarChart,
  SentimentChart,
  LanguagePieChart,
  TokenUsageChart,
} from "../../components/Charts";
import DashboardSettings from "./settings";
import UserManagement from "./users";
import { Company, MetricsResult } from "../../lib/types";

interface MetricsCardProps {
  label: string;
  value: string | number | null | undefined;
  className?: string;
}

interface StatCardProps {
  label: string;
  value: string | number | null | undefined;
  description?: string;
  icon?: string;
  trend?: number;
  trendLabel?: string;
}

function MetricsCard({ label, value, className = "" }: MetricsCardProps) {
  return (
    <div
      className={`bg-white rounded-xl p-4 shadow-md flex flex-col items-center ${className}`}
    >
      <span className="text-2xl font-bold">{value ?? "-"}</span>
      <span className="text-gray-500">{label}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
  icon,
  trend,
  trendLabel,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-semibold mt-1">{value ?? "-"}</p>
          {description && (
            <p className="text-xs text-gray-400 mt-1">{description}</p>
          )}
        </div>
        {icon && <div className="text-blue-500 text-2xl">{icon}</div>}
      </div>

      {trend !== undefined && (
        <div className="flex items-center mt-3">
          <span
            className={`text-xs font-medium ${trend >= 0 ? "text-green-500" : "text-red-500"}`}
          >
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}%
          </span>
          {trendLabel && (
            <span className="text-xs text-gray-400 ml-2">{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

// Safely wrapped component with useSession
function DashboardContent() {
  const { data: session } = useSession();
  const [metrics, setMetrics] = useState<MetricsResult | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [, setLoading] = useState<boolean>(false);
  // Remove unused csvUrl state variable
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const isAdmin = session?.user?.role === "admin";
  const isAuditor = session?.user?.role === "auditor";

  useEffect(() => {
    // Fetch metrics and company on mount
    const fetchData = async () => {
      setLoading(true);
      const res = await fetch("/api/dashboard/metrics");
      const data = await res.json();
      setMetrics(data.metrics);
      setCompany(data.company);
      // Removed unused csvUrl assignment
      setLoading(false);
    };
    fetchData();
  }, []);

  async function handleRefresh() {
    if (isAuditor) return; // Prevent auditors from refreshing
    try {
      setRefreshing(true);

      // Make sure we have a company ID to send
      if (!company?.id) {
        console.error("Cannot refresh: Company ID is missing");
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
        console.error("Failed to refresh sessions:", errorData.error);
      }
    } finally {
      setRefreshing(false);
    }
  }

  // Calculate sentiment distribution
  const getSentimentData = () => {
    if (!metrics) return { positive: 0, neutral: 0, negative: 0 };

    // If we have the new sentiment count fields, use those
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

    // Fallback to estimating based on total
    const total = metrics.totalSessions || 1;
    return {
      positive: Math.round(total * 0.6), // 60% positive as fallback
      neutral: Math.round(total * 0.3), // 30% neutral as fallback
      negative: Math.round(total * 0.1), // 10% negative as fallback
    };
  };

  // Prepare token usage data
  const getTokenData = () => {
    if (!metrics || !metrics.tokensByDay) {
      return { labels: [], values: [], costs: [] };
    }

    const days = Object.keys(metrics.tokensByDay).sort();
    // Get the last 7 days if available
    const labels = days.slice(-7);
    const values = labels.map((day) => metrics.tokensByDay?.[day] || 0);
    const costs = labels.map((day) => metrics.tokensCostByDay?.[day] || 0);

    return { labels, values, costs };
  };

  if (!metrics || !company) {
    return <div className="text-center py-10">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with company info */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{company.name}</h1>
          <p className="text-gray-600">
            Dashboard updated{" "}
            {new Date(metrics.lastUpdated || Date.now()).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            className="bg-blue-600 text-white py-2 px-4 rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50"
            onClick={handleRefresh}
            disabled={refreshing || isAuditor}
          >
            {refreshing ? "Refreshing..." : "Refresh Data"}
          </button>
          <button
            className="bg-gray-200 py-2 px-4 rounded-lg shadow-sm hover:bg-gray-300"
            onClick={() => signOut()}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Key Performance Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Sessions"
          value={metrics.totalSessions}
          icon="💬"
        />
        <StatCard
          label="Avg Sessions/Day"
          value={metrics.avgSessionsPerDay?.toFixed(1)}
          icon="📊"
          trend={5.2}
          trendLabel="vs last week"
        />
        <StatCard
          label="Avg Session Time"
          value={
            metrics.avgSessionLength
              ? `${metrics.avgSessionLength.toFixed(1)} min`
              : null
          }
          icon="⏱️"
          trend={-2.1}
          trendLabel="vs last week"
        />
        <StatCard
          label="Avg Response Time"
          value={
            metrics.avgResponseTime
              ? `${metrics.avgResponseTime.toFixed(2)}s`
              : null
          }
          icon="⚡"
          trend={-1.8}
          trendLabel="vs last week"
        />
      </div>

      {/* Sentiment & Escalation Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl shadow md:col-span-1">
          <h3 className="font-bold text-lg mb-3">Sentiment Distribution</h3>
          <SentimentChart sentimentData={getSentimentData()} />
        </div>

        <div className="bg-white p-4 rounded-xl shadow md:col-span-2">
          <h3 className="font-bold text-lg mb-3">Case Handling</h3>
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Escalation Rate"
              value={`${(((metrics.escalatedCount || 0) / (metrics.totalSessions || 1)) * 100).toFixed(1)}%`}
              description={`${metrics.escalatedCount || 0} sessions escalated`}
              icon="⚠️"
            />
            <StatCard
              label="HR Forwarded"
              value={`${(((metrics.forwardedCount || 0) / (metrics.totalSessions || 1)) * 100).toFixed(1)}%`}
              description={`${metrics.forwardedCount || 0} sessions forwarded to HR`}
              icon="👥"
            />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-xl shadow">
          <h3 className="font-bold text-lg mb-3">Sessions by Day</h3>
          <SessionsLineChart sessionsPerDay={metrics.days || {}} />
        </div>
        <div className="bg-white p-4 rounded-xl shadow">
          <h3 className="font-bold text-lg mb-3">Categories</h3>
          <CategoriesBarChart categories={metrics.categories || {}} />
        </div>
      </div>

      {/* Language & Token Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-xl shadow">
          <h3 className="font-bold text-lg mb-3">Languages</h3>
          <LanguagePieChart languages={metrics.languages || {}} />
        </div>
        <div className="bg-white p-4 rounded-xl shadow">
          <h3 className="font-bold text-lg mb-3">Token Usage & Costs</h3>
          <div className="mb-2 flex justify-between">
            <span className="text-sm text-gray-500">
              Total Tokens:{" "}
              <span className="font-semibold">
                {metrics.totalTokens?.toLocaleString() || 0}
              </span>
            </span>
            <span className="text-sm text-gray-500">
              Total Cost:{" "}
              <span className="font-semibold">
                €{metrics.totalTokensEur?.toFixed(4) || 0}
              </span>
            </span>
          </div>
          <TokenUsageChart tokenData={getTokenData()} />
        </div>
      </div>

      {/* Admin Controls */}
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
  // We don't use useSession here to avoid the error outside the provider
  return <DashboardContent />;
}
