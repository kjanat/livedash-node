// Main dashboard page: metrics, refresh, config
'use client';

import { useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { SessionsLineChart, CategoriesBarChart } from '../../components/Charts';
import DashboardSettings from './settings';
import UserManagement from './users';

interface MetricsCardProps {
  label: string;
  value: string | number | null | undefined;
}

function MetricsCard({ label, value }: MetricsCardProps) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-md flex flex-col items-center">
      <span className="text-2xl font-bold">{value ?? '-'}</span>
      <span className="text-gray-500">{label}</span>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [company, setCompany] = useState<Record<string, unknown> | null>(null);
  // Loading state used in the fetchData function
  const [, setLoading] = useState<boolean>(false);
  const [csvUrl, setCsvUrl] = useState<string>('');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const isAdmin = session?.user?.role === 'admin';
  const isAuditor = session?.user?.role === 'auditor';

  useEffect(() => {
    // Fetch metrics, company, and CSV URL on mount
    const fetchData = async () => {
      setLoading(true);
      const res = await fetch('/api/dashboard/metrics');
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

    setRefreshing(true);
    await fetch('/api/admin/refresh-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: company?.id }),
    });
    setRefreshing(false);
    window.location.reload();
  }

  async function handleSaveConfig() {
    if (isAuditor) return; // Prevent auditors from changing config

    await fetch('/api/dashboard/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvUrl }),
    });
    window.location.reload();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <button className="text-sm underline" onClick={() => signOut()}>
          Log out
        </button>
      </div>

      {/* Admin-only settings and user management */}
      {company && isAdmin && (
        <>
          <DashboardSettings company={company} session={session} />
          <UserManagement session={session} />
        </>
      )}

      <div className="bg-white p-4 rounded-xl shadow mb-6 flex items-center gap-4">
        <input
          className="flex-1 px-3 py-2 rounded border"
          value={csvUrl}
          onChange={(e) => setCsvUrl(e.target.value)}
          placeholder="CSV feed URL (with basic auth if set in backend)"
          readOnly={isAuditor}
        />
        {!isAuditor && (
          <>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded"
              onClick={handleSaveConfig}
            >
              Save Config
            </button>
            <button
              className="px-4 py-2 bg-green-600 text-white rounded"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Manual Refresh'}
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
        <MetricsCard label="Total Sessions" value={metrics?.totalSessions} />
        <MetricsCard label="Escalated" value={metrics?.escalatedCount} />
        <MetricsCard
          label="Avg. Sentiment"
          value={metrics?.avgSentiment?.toFixed(2)}
        />
        <MetricsCard
          label="Total Tokens (€)"
          value={metrics?.totalTokensEur?.toFixed(2)}
        />
        <MetricsCard
          label="Below Sentiment Threshold"
          value={metrics?.belowSentimentThreshold}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="font-bold mb-2">Sessions Per Day</h2>
          {(
            metrics?.sessionsPerDay &&
            Object.keys(metrics.sessionsPerDay).length > 0
          ) ?
            <SessionsLineChart sessionsPerDay={metrics.sessionsPerDay} />
          : <span>No data</span>}
        </div>
        <div>
          <h2 className="font-bold mb-2">Top Categories</h2>
          {metrics?.categories && Object.keys(metrics.categories).length > 0 ?
            <CategoriesBarChart categories={metrics.categories} />
          : <span>No data</span>}
        </div>
        <div>
          <h2 className="font-bold mb-2">Languages</h2>
          {metrics?.languages ?
            Object.entries(metrics.languages).map(([lang, n]) => (
              <div key={lang} className="flex justify-between">
                <span>{lang}</span>
                <span>{String(n)}</span>
              </div>
            ))
          : <span>No data</span>}
        </div>
      </div>
    </div>
  );
}
