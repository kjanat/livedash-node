"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { SessionsLineChart, CategoriesBarChart } from "../../components/Charts";
import DashboardSettings from "./settings";
import UserManagement from "./users";
import { Company, MetricsResult } from "../../lib/types";

interface MetricsCardProps {
  label: string;
  value: string | number | null | undefined;
}

function MetricsCard({ label, value }: MetricsCardProps) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-md flex flex-col items-center">
      <span className="text-2xl font-bold">{value ?? "-"}</span>
      <span className="text-gray-500">{label}</span>
    </div>
  );
}

// Safely wrapped component with useSession
function DashboardContent() {
  const { data: session } = useSession();
  const [metrics, setMetrics] = useState<MetricsResult | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [, setLoading] = useState<boolean>(false);
  const [csvUrl, setCsvUrl] = useState<string>("");
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const isAdmin = session?.user?.role === "admin";
  const isAuditor = session?.user?.role === "auditor";

  useEffect(() => {
    // Fetch metrics, company, and CSV URL on mount
    const fetchData = async () => {
      setLoading(true);
      const res = await fetch("/api/dashboard/metrics");
      const data = await res.json();
      setMetrics(data.metrics);
      setCompany(data.company);
      setCsvUrl(data.csvUrl);
      setLoading(false);
    };
    fetchData();
  }, []);

  async function handleRefresh() {
    if (isAuditor) return; // Prevent auditors from refreshing
    try {
      setRefreshing(true);
      const res = await fetch("/api/admin/refresh-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        // Refetch metrics
        const metricsRes = await fetch("/api/dashboard/metrics");
        const data = await metricsRes.json();
        setMetrics(data.metrics);
      }
    } finally {
      setRefreshing(false);
    }
  }

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

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricsCard label="Total Sessions" value={metrics.totalSessions} />
        <MetricsCard
          label="Avg Sessions/Day"
          value={metrics.avgSessionsPerDay?.toFixed(1)}
        />
        <MetricsCard
          label="Avg Session Time"
          value={
            metrics.avgSessionLength
              ? `${metrics.avgSessionLength.toFixed(1)} min`
              : null
          }
        />
        <MetricsCard
          label="Avg Sentiment"
          value={
            metrics.avgSentiment
              ? metrics.avgSentiment.toFixed(2) + "/10"
              : null
          }
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-xl shadow">
          <h3 className="font-bold text-lg mb-3">Sessions by Day</h3>
          <SessionsLineChart data={metrics.days || {}} />
        </div>
        <div className="bg-white p-4 rounded-xl shadow">
          <h3 className="font-bold text-lg mb-3">Categories</h3>
          <CategoriesBarChart data={metrics.categories || {}} />
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
