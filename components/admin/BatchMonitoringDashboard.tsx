"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  RefreshCw,
  Shield,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

interface BatchMetrics {
  operationStartTime: number;
  requestCount: number;
  successCount: number;
  failureCount: number;
  retryCount: number;
  totalCost: number;
  averageLatency: number;
  circuitBreakerTrips: number;
  performanceStats: {
    p50: number;
    p95: number;
    p99: number;
  };
}

interface CircuitBreakerStatus {
  isOpen: boolean;
  failures: number;
  lastFailureTime: number;
}

interface SchedulerConfig {
  enabled: boolean;
  intervals: {
    batchCreation: number;
    statusCheck: number;
    resultProcessing: number;
    retryFailures: number;
  };
  thresholds: {
    maxRetries: number;
    circuitBreakerThreshold: number;
    batchSize: number;
  };
}

interface SchedulerStatus {
  isRunning: boolean;
  createBatchesRunning: boolean;
  checkStatusRunning: boolean;
  processResultsRunning: boolean;
  retryFailedRunning: boolean;
  isPaused: boolean;
  consecutiveErrors: number;
  lastErrorTime: Date | null;
  circuitBreakers: Record<string, CircuitBreakerStatus>;
  config: SchedulerConfig;
}

interface MonitoringData {
  timestamp: string;
  metrics: Record<string, BatchMetrics> | BatchMetrics;
  schedulerStatus: SchedulerStatus;
  circuitBreakerStatus: Record<string, CircuitBreakerStatus>;
  systemHealth: {
    schedulerRunning: boolean;
    circuitBreakersOpen: boolean;
    pausedDueToErrors: boolean;
    consecutiveErrors: number;
  };
}

function HealthStatusIcon({ status }: { status: string }) {
  if (status === "healthy")
    return <CheckCircle className="h-5 w-5 text-green-500" />;
  if (status === "warning")
    return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  if (status === "critical")
    return <XCircle className="h-5 w-5 text-red-500" />;
  return null;
}

function SystemHealthCard({
  health,
  schedulerStatus,
}: {
  health: { status: string; message: string };
  schedulerStatus: {
    csvImport?: boolean;
    processing?: boolean;
    batch?: boolean;
  };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <HealthStatusIcon status={health.status} />
          <span className="font-medium text-sm">{health.message}</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>CSV Import Scheduler:</span>
            <Badge
              variant={schedulerStatus?.csvImport ? "default" : "secondary"}
            >
              {schedulerStatus?.csvImport ? "Running" : "Stopped"}
            </Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span>Processing Scheduler:</span>
            <Badge
              variant={schedulerStatus?.processing ? "default" : "secondary"}
            >
              {schedulerStatus?.processing ? "Running" : "Stopped"}
            </Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span>Batch Scheduler:</span>
            <Badge variant={schedulerStatus?.batch ? "default" : "secondary"}>
              {schedulerStatus?.batch ? "Running" : "Stopped"}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CircuitBreakerCard({
  circuitBreakerStatus,
}: {
  circuitBreakerStatus: Record<string, string> | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Circuit Breakers
        </CardTitle>
      </CardHeader>
      <CardContent>
        {circuitBreakerStatus &&
        Object.keys(circuitBreakerStatus).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(circuitBreakerStatus).map(([key, status]) => (
              <div key={key} className="flex justify-between text-sm">
                <span>{key}:</span>
                <Badge
                  variant={status === "CLOSED" ? "default" : "destructive"}
                >
                  {status as string}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No circuit breakers configured
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function BatchMonitoringDashboard() {
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { toast } = useToast();

  const fetchMonitoringData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCompany !== "all") {
        params.set("companyId", selectedCompany);
      }

      const response = await fetch(`/api/admin/batch-monitoring?${params}`);
      if (response.ok) {
        const data = await response.json();
        setMonitoringData(data);
      } else {
        throw new Error("Failed to fetch monitoring data");
      }
    } catch (error) {
      console.error("Failed to fetch batch monitoring data:", error);
      toast({
        title: "Error",
        description: "Failed to load batch monitoring data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedCompany, toast]);

  useEffect(() => {
    fetchMonitoringData();
  }, [fetchMonitoringData]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchMonitoringData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, fetchMonitoringData]);

  const exportLogs = async (format: "json" | "csv") => {
    try {
      const response = await fetch("/api/admin/batch-monitoring/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
          endDate: new Date().toISOString(),
          format,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `batch-logs-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: "Success",
          description: `Batch logs exported as ${format.toUpperCase()}`,
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to export logs",
        variant: "destructive",
      });
    }
  };

  const getHealthStatus = () => {
    if (!monitoringData)
      return {
        status: "unknown",
        color: "gray",
        message: "No monitoring data",
      };

    const { systemHealth } = monitoringData;

    if (!systemHealth.schedulerRunning) {
      return {
        status: "critical",
        color: "red",
        message: "Scheduler not running",
      };
    }

    if (systemHealth.pausedDueToErrors) {
      return {
        status: "warning",
        color: "yellow",
        message: "Paused due to errors",
      };
    }

    if (systemHealth.circuitBreakersOpen) {
      return {
        status: "warning",
        color: "yellow",
        message: "Circuit breakers open",
      };
    }

    if (systemHealth.consecutiveErrors > 0) {
      return {
        status: "warning",
        color: "yellow",
        message: `${systemHealth.consecutiveErrors} consecutive errors`,
      };
    }

    return {
      status: "healthy",
      color: "green",
      message: "All systems operational",
    };
  };

  const renderMetricsCards = () => {
    if (!monitoringData) return null;

    const metrics = Array.isArray(monitoringData.metrics)
      ? monitoringData.metrics[0]
      : typeof monitoringData.metrics === "object" &&
          "operationStartTime" in monitoringData.metrics
        ? monitoringData.metrics
        : Object.values(monitoringData.metrics)[0];

    if (!metrics) return null;

    const successRate =
      metrics.requestCount > 0
        ? ((metrics.successCount / metrics.requestCount) * 100).toFixed(1)
        : "0";

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Requests
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.requestCount}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.successCount} successful, {metrics.failureCount} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics.retryCount} retries performed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Average Latency
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.averageLatency.toFixed(0)}ms
            </div>
            <p className="text-xs text-muted-foreground">
              P95: {metrics.performanceStats.p95}ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              €{metrics.totalCost.toFixed(4)}
            </div>
            <p className="text-xs text-muted-foreground">
              Circuit breaker trips: {metrics.circuitBreakerTrips}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderSystemStatus = () => {
    if (!monitoringData) return null;

    const health = getHealthStatus();
    const { schedulerStatus, circuitBreakerStatus } = monitoringData;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <SystemHealthCard
          health={health}
          schedulerStatus={schedulerStatus as any}
        />
        <CircuitBreakerCard
          circuitBreakerStatus={circuitBreakerStatus as any}
        />
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading batch monitoring data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Batch Processing Monitor</h2>
          <p className="text-sm text-muted-foreground">
            Real-time monitoring of OpenAI Batch API operations
          </p>
        </div>

        <div className="flex gap-2">
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {/* Add company options here */}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${autoRefresh ? "animate-spin" : ""}`}
            />
            {autoRefresh ? "Auto" : "Manual"}
          </Button>

          <Button variant="outline" size="sm" onClick={fetchMonitoringData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {renderSystemStatus()}
      {renderMetricsCards()}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Batch Processing Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground mb-4">
                Last updated:{" "}
                {monitoringData?.timestamp
                  ? new Date(monitoringData.timestamp).toLocaleString()
                  : "Never"}
              </div>

              {monitoringData && (
                <pre className="bg-muted p-4 rounded text-xs overflow-auto">
                  {JSON.stringify(monitoringData, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Batch Processing Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Real-time batch processing logs will be displayed here. For
                detailed log analysis, use the export feature.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Export Batch Processing Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Export batch processing logs and metrics for detailed analysis.
              </p>

              <div className="flex gap-2">
                <Button onClick={() => exportLogs("json")}>
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </Button>
                <Button variant="outline" onClick={() => exportLogs("csv")}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
