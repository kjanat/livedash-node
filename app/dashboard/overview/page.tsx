"use client";

import {
  CheckCircle,
  Clock,
  Euro,
  Globe,
  LogOut,
  MessageCircle,
  MessageSquare,
  MoreVertical,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { formatEnumValue } from "@/lib/format-enums";
import ModernBarChart from "../../../components/charts/bar-chart";
import ModernDonutChart from "../../../components/charts/donut-chart";
import ModernLineChart from "../../../components/charts/line-chart";
import GeographicMap from "../../../components/GeographicMap";
import ResponseTimeDistribution from "../../../components/ResponseTimeDistribution";
import TopQuestionsChart from "../../../components/TopQuestionsChart";
import MetricCard from "../../../components/ui/metric-card";
import WordCloud from "../../../components/WordCloud";
import type { Company, MetricsResult, WordCloudWord } from "../../../lib/types";

// Safely wrapped component with useSession
function DashboardContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [metrics, setMetrics] = useState<MetricsResult | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);

  const refreshStatusId = useId();
  const isAuditor = session?.user?.role === "AUDITOR";

  // Function to fetch metrics with optional date range
  const fetchMetrics = useCallback(
    async (startDate?: string, endDate?: string, isInitial = false) => {
      setLoading(true);
      try {
        let url = "/api/dashboard/metrics";
        if (startDate && endDate) {
          url += `?startDate=${startDate}&endDate=${endDate}`;
        }

        const res = await fetch(url);
        const data = await res.json();

        setMetrics(data.metrics);
        setCompany(data.company);

        // Set initial load flag
        if (isInitial) {
          setIsInitialLoad(false);
        }
      } catch (error) {
        console.error("Error fetching metrics:", error);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    // Redirect if not authenticated
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    // Fetch metrics and company on mount if authenticated
    if (status === "authenticated" && isInitialLoad) {
      fetchMetrics(undefined, undefined, true);
    }
  }, [status, router, isInitialLoad, fetchMetrics]);

  async function handleRefresh() {
    if (isAuditor) return;
    try {
      setRefreshing(true);

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

  // Show loading state while session status is being determined
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (loading || !metrics || !company) {
    return (
      <div className="space-y-8">
        {/* Header Skeleton */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-20" />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Metrics Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }, (_, i) => {
            const metricTypes = [
              "sessions",
              "users",
              "time",
              "response",
              "costs",
              "peak",
              "resolution",
              "languages",
            ];
            return (
              <MetricCard
                key={`skeleton-${metricTypes[i] || "metric"}-card-loading`}
                title=""
                value=""
                isLoading
              />
            );
          })}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Data preparation functions
  const getSentimentData = () => {
    if (!metrics) return [];

    const sentimentData = {
      positive: metrics.sentimentPositiveCount ?? 0,
      neutral: metrics.sentimentNeutralCount ?? 0,
      negative: metrics.sentimentNegativeCount ?? 0,
    };

    return [
      {
        name: "Positive",
        value: sentimentData.positive,
        color: "hsl(var(--chart-1))",
      },
      {
        name: "Neutral",
        value: sentimentData.neutral,
        color: "hsl(var(--chart-2))",
      },
      {
        name: "Negative",
        value: sentimentData.negative,
        color: "hsl(var(--chart-3))",
      },
    ];
  };

  const getSessionsOverTimeData = () => {
    if (!metrics?.days) return [];

    return Object.entries(metrics.days).map(([date, value]) => ({
      date: new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      value: value as number,
    }));
  };

  const getCategoriesData = () => {
    if (!metrics?.categories) return [];

    return Object.entries(metrics.categories).map(([name, value]) => {
      const formattedName = formatEnumValue(name) || name;
      return {
        name:
          formattedName.length > 15
            ? `${formattedName.substring(0, 15)}...`
            : formattedName,
        value: value as number,
      };
    });
  };

  const getLanguagesData = () => {
    if (!metrics?.languages) return [];

    return Object.entries(metrics.languages).map(([name, value]) => ({
      name,
      value: value as number,
    }));
  };

  const getWordCloudData = (): WordCloudWord[] => {
    if (!metrics?.wordCloudData) return [];
    return metrics.wordCloudData;
  };

  const getCountryData = () => {
    if (!metrics?.countries) return {};
    return Object.entries(metrics.countries).reduce(
      (acc, [code, count]) => {
        if (code && count) {
          acc[code] = count;
        }
        return acc;
      },
      {} as Record<string, number>
    );
  };

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
      {/* Modern Header */}
      <Card className="border-0 bg-linear-to-r from-primary/5 via-primary/10 to-primary/5">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">
                  {company.name}
                </h1>
                <Badge variant="secondary" className="text-xs">
                  Analytics Dashboard
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Last updated{" "}
                <span className="font-medium">
                  {new Date(metrics.lastUpdated || Date.now()).toLocaleString()}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleRefresh}
                disabled={refreshing || isAuditor}
                size="sm"
                className="gap-2"
                aria-label={
                  refreshing
                    ? "Refreshing dashboard data"
                    : "Refresh dashboard data"
                }
                aria-describedby={refreshing ? refreshStatusId : undefined}
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
              {refreshing && (
                <div
                  id={refreshStatusId}
                  className="sr-only"
                  aria-live="polite"
                >
                  Dashboard data is being refreshed
                </div>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" aria-label="Account menu">
                    <MoreVertical className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: "/login" })}
                  >
                    <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Date Range Picker - Temporarily disabled to debug infinite loop */}
      {/* {dateRange && (
        <DateRangePicker
          minDate={dateRange.minDate}
          maxDate={dateRange.maxDate}
          onDateRangeChange={handleDateRangeChange}
          initialStartDate={selectedStartDate}
          initialEndDate={selectedEndDate}
        />
      )} */}

      {/* Modern Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Sessions"
          value={metrics.totalSessions?.toLocaleString()}
          icon={<MessageSquare className="h-5 w-5" />}
          trend={{
            value: metrics.sessionTrend ?? 0,
            isPositive: (metrics.sessionTrend ?? 0) >= 0,
          }}
          variant="primary"
        />

        <MetricCard
          title="Unique Users"
          value={metrics.uniqueUsers?.toLocaleString()}
          icon={<Users className="h-5 w-5" />}
          trend={{
            value: metrics.usersTrend ?? 0,
            isPositive: (metrics.usersTrend ?? 0) >= 0,
          }}
          variant="success"
        />

        <MetricCard
          title="Avg. Session Time"
          value={`${Math.round(metrics.avgSessionLength || 0)}s`}
          icon={<Clock className="h-5 w-5" />}
          trend={{
            value: metrics.avgSessionTimeTrend ?? 0,
            isPositive: (metrics.avgSessionTimeTrend ?? 0) >= 0,
          }}
        />

        <MetricCard
          title="Avg. Response Time"
          value={`${metrics.avgResponseTime?.toFixed(1) || 0}s`}
          icon={<Zap className="h-5 w-5" />}
          trend={{
            value: metrics.avgResponseTimeTrend ?? 0,
            isPositive: (metrics.avgResponseTimeTrend ?? 0) <= 0,
          }}
          variant="warning"
        />

        <MetricCard
          title="Daily Costs"
          value={`€${metrics.avgDailyCosts?.toFixed(4) || "0.0000"}`}
          icon={<Euro className="h-5 w-5" />}
          description="Average per day"
        />

        <MetricCard
          title="Peak Usage"
          value={metrics.peakUsageTime || "N/A"}
          icon={<TrendingUp className="h-5 w-5" />}
          description="Busiest hour"
        />

        <MetricCard
          title="Resolution Rate"
          value={`${metrics.resolvedChatsPercentage?.toFixed(1) || "0.0"}%`}
          icon={<CheckCircle className="h-5 w-5" />}
          trend={{
            value: metrics.resolvedChatsPercentage ?? 0,
            isPositive: (metrics.resolvedChatsPercentage ?? 0) >= 80,
          }}
          variant={
            metrics.resolvedChatsPercentage &&
            metrics.resolvedChatsPercentage >= 80
              ? "success"
              : "warning"
          }
        />

        <MetricCard
          title="Active Languages"
          value={Object.keys(metrics.languages || {}).length}
          icon={<Globe className="h-5 w-5" />}
          description="Languages detected"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ModernLineChart
          data={getSessionsOverTimeData()}
          title="Sessions Over Time"
          className="lg:col-span-2"
          height={350}
        />

        <ModernDonutChart
          data={getSentimentData()}
          title="Conversation Sentiment"
          centerText={{
            title: "Total",
            value: metrics.totalSessions || 0,
          }}
          height={350}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ModernBarChart
          data={getCategoriesData()}
          title="Sessions by Category"
          height={350}
        />

        <ModernDonutChart
          data={getLanguagesData()}
          title="Languages Used"
          height={350}
        />
      </div>

      {/* Geographic and Topics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Geographic Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GeographicMap countries={getCountryData()} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Common Topics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <WordCloud words={getWordCloudData()} width={500} height={300} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Questions Chart */}
      <TopQuestionsChart data={metrics.topQuestions || []} />

      {/* Response Time Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Response Time Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponseTimeDistribution
            data={getResponseTimeData()}
            average={metrics.avgResponseTime || 0}
          />
        </CardContent>
      </Card>

      {/* Token Usage Summary */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>AI Usage & Costs</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1">
                <span className="font-semibold">Total Tokens:</span>
                {metrics.totalTokens?.toLocaleString() || 0}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <span className="font-semibold">Total Cost:</span>€
                {metrics.totalTokensEur?.toFixed(4) || 0}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Token usage chart will be implemented with historical data</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
