"use client";

import {
  Activity,
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle,
  Download,
  Settings,
  Shield,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SecurityConfigModal } from "@/components/security/SecurityConfigModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SecurityMetrics {
  totalEvents: number;
  criticalEvents: number;
  activeAlerts: number;
  resolvedAlerts: number;
  securityScore: number;
  threatLevel: string;
  eventsByType: Record<string, number>;
  alertsByType: Record<string, number>;
  topThreats: Array<{ type: string; count: number }>;
  geoDistribution: Record<string, number>;
  timeDistribution: Array<{ hour: number; count: number }>;
  userRiskScores: Array<{ userId: string; email: string; riskScore: number }>;
}

interface SecurityAlert {
  id: string;
  timestamp: string;
  severity: string;
  type: string;
  title: string;
  description: string;
  eventType: string;
  context: Record<string, unknown>;
  metadata: Record<string, unknown>;
  acknowledged: boolean;
}

/**
 * Custom hook for security monitoring state
 */
function useSecurityMonitoringState() {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState("24h");
  const [showConfig, setShowConfig] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  return {
    metrics,
    setMetrics,
    alerts,
    setAlerts,
    loading,
    setLoading,
    selectedTimeRange,
    setSelectedTimeRange,
    showConfig,
    setShowConfig,
    autoRefresh,
    setAutoRefresh,
  };
}

/**
 * Custom hook for security data fetching
 */
function useSecurityData(selectedTimeRange: string, autoRefresh: boolean) {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSecurityData = useCallback(async () => {
    try {
      const startDate = getStartDateForRange(selectedTimeRange);
      const endDate = new Date().toISOString();

      const response = await fetch(
        `/api/admin/security-monitoring?startDate=${startDate}&endDate=${endDate}`
      );

      if (!response.ok) throw new Error("Failed to load security data");

      const data = await response.json();
      setMetrics(data.metrics);
      setAlerts(data.alerts);
    } catch (error) {
      console.error("Error loading security data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedTimeRange]);

  useEffect(() => {
    loadSecurityData();

    if (autoRefresh) {
      const interval = setInterval(loadSecurityData, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, loadSecurityData]);

  return { metrics, alerts, loading, loadSecurityData, setAlerts };
}

/**
 * Helper function to get date range for filtering
 */
function getStartDateForRange(range: string): string {
  const now = new Date();
  switch (range) {
    case "1h":
      return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  }
}

/**
 * Helper function to get threat level color
 */
function getThreatLevelColor(level: string) {
  switch (level?.toLowerCase()) {
    case "critical":
      return "bg-red-500";
    case "high":
      return "bg-orange-500";
    case "moderate":
      return "bg-yellow-500";
    case "low":
      return "bg-green-500";
    default:
      return "bg-gray-500";
  }
}

/**
 * Helper function to get severity color
 */
function getSeverityColor(severity: string) {
  switch (severity?.toLowerCase()) {
    case "critical":
      return "destructive";
    case "high":
      return "destructive";
    case "medium":
      return "secondary";
    case "low":
      return "outline";
    default:
      return "outline";
  }
}

/**
 * Helper function to render dashboard header
 */
function renderDashboardHeader(
  autoRefresh: boolean,
  setAutoRefresh: (refresh: boolean) => void,
  setShowConfig: (show: boolean) => void,
  exportData: (format: "json" | "csv", type: "alerts" | "metrics") => void
) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Security Monitoring
        </h1>
        <p className="text-muted-foreground">
          Real-time security monitoring and threat detection
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          {autoRefresh ? (
            <Bell className="h-4 w-4" />
          ) : (
            <BellOff className="h-4 w-4" />
          )}
          Auto Refresh
        </Button>

        <Button variant="outline" size="sm" onClick={() => setShowConfig(true)}>
          <Settings className="h-4 w-4" />
          Configure
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => exportData("json", "alerts")}
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>
    </div>
  );
}

/**
 * Helper function to render time range selector
 */
function renderTimeRangeSelector(
  selectedTimeRange: string,
  setSelectedTimeRange: (range: string) => void
) {
  return (
    <div className="flex gap-2">
      {["1h", "24h", "7d", "30d"].map((range) => (
        <Button
          key={range}
          variant={selectedTimeRange === range ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedTimeRange(range)}
        >
          {range}
        </Button>
      ))}
    </div>
  );
}

/**
 * Helper function to render security overview cards
 */
function renderSecurityOverview(metrics: SecurityMetrics | null) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Security Score</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {metrics?.securityScore || 0}/100
          </div>
          <div
            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getThreatLevelColor(metrics?.threatLevel || "")}`}
          >
            {metrics?.threatLevel || "Unknown"} Threat Level
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics?.activeAlerts || 0}</div>
          <p className="text-xs text-muted-foreground">
            {metrics?.resolvedAlerts || 0} resolved
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Security Events</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics?.totalEvents || 0}</div>
          <p className="text-xs text-muted-foreground">
            {metrics?.criticalEvents || 0} critical
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Threat</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-sm font-bold">
            {metrics?.topThreats?.[0]?.type?.replace(/_/g, " ") || "None"}
          </div>
          <p className="text-xs text-muted-foreground">
            {metrics?.topThreats?.[0]?.count || 0} instances
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SecurityMonitoringPage() {
  const {
    selectedTimeRange,
    setSelectedTimeRange,
    showConfig,
    setShowConfig,
    autoRefresh,
    setAutoRefresh,
  } = useSecurityMonitoringState();

  const { metrics, alerts, loading, setAlerts, loadSecurityData } =
    useSecurityData(selectedTimeRange, autoRefresh);

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch("/api/admin/security-monitoring/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId, action: "acknowledge" }),
      });

      if (response.ok) {
        setAlerts(
          alerts.map((alert) =>
            alert.id === alertId ? { ...alert, acknowledged: true } : alert
          )
        );
      }
    } catch (error) {
      console.error("Error acknowledging alert:", error);
    }
  };

  const exportData = async (
    format: "json" | "csv",
    type: "alerts" | "metrics"
  ) => {
    try {
      const startDate = getStartDateForRange(selectedTimeRange);
      const endDate = new Date().toISOString();

      const response = await fetch(
        `/api/admin/security-monitoring/export?format=${format}&type=${type}&startDate=${startDate}&endDate=${endDate}`
      );

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `security-${type}-${new Date().toISOString().split("T")[0]}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting data:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {renderDashboardHeader(
        autoRefresh,
        setAutoRefresh,
        setShowConfig,
        exportData
      )}
      {renderTimeRangeSelector(selectedTimeRange, setSelectedTimeRange)}
      {renderSecurityOverview(metrics)}

      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">Active Alerts</TabsTrigger>
          <TabsTrigger value="metrics">Security Metrics</TabsTrigger>
          <TabsTrigger value="threats">Threat Analysis</TabsTrigger>
          <TabsTrigger value="geography">Geographic View</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Security Alerts</CardTitle>
              <CardDescription>
                Real-time security alerts requiring attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4" />
                  <p>No active alerts - system is secure</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={getSeverityColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                          <span className="font-medium">{alert.title}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {alert.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(alert.timestamp).toLocaleString()}
                        </p>
                      </div>

                      {!alert.acknowledged && (
                        <Button
                          size="sm"
                          onClick={() => acknowledgeAlert(alert.id)}
                        >
                          Acknowledge
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Event Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics?.eventsByType && (
                  <div className="space-y-2">
                    {Object.entries(metrics.eventsByType).map(
                      ([type, count]) => (
                        <div key={type} className="flex justify-between">
                          <span className="text-sm">
                            {type.replace(/_/g, " ")}
                          </span>
                          <span className="font-medium">{count}</span>
                        </div>
                      )
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>High-Risk Users</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics?.userRiskScores?.length ? (
                  <div className="space-y-2">
                    {metrics.userRiskScores.slice(0, 5).map((user) => (
                      <div key={user.userId} className="flex justify-between">
                        <span className="text-sm truncate">{user.email}</span>
                        <Badge
                          variant={
                            user.riskScore > 70
                              ? "destructive"
                              : user.riskScore > 40
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {user.riskScore}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No high-risk users detected
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="threats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Threat Analysis</CardTitle>
              <CardDescription>
                Analysis of current security threats and recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metrics?.topThreats?.length ? (
                <div className="space-y-4">
                  {metrics.topThreats.map((threat, index) => (
                    <div
                      key={threat.type}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div>
                        <span className="font-medium">
                          {threat.type.replace(/_/g, " ")}
                        </span>
                        <p className="text-sm text-muted-foreground">
                          {threat.count} occurrences
                        </p>
                      </div>
                      <Badge
                        variant={index === 0 ? "destructive" : "secondary"}
                      >
                        {index === 0 ? "Highest Priority" : "Monitor"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  No significant threats detected
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geography" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Geographic Distribution</CardTitle>
              <CardDescription>
                Security events by geographic location
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metrics?.geoDistribution &&
              Object.keys(metrics.geoDistribution).length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {Object.entries(metrics.geoDistribution)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 12)
                    .map(([country, count]) => (
                      <div
                        key={country}
                        className="text-center p-3 border rounded"
                      >
                        <div className="text-2xl font-bold">{count}</div>
                        <div className="text-sm text-muted-foreground">
                          {country}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  No geographic data available
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showConfig && (
        <SecurityConfigModal
          onClose={() => setShowConfig(false)}
          onSave={() => {
            setShowConfig(false);
            loadSecurityData();
          }}
        />
      )}
    </div>
  );
}
