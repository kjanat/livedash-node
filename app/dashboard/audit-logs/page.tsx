"use client";

import { formatDistanceToNow } from "date-fns";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useId, useState } from "react";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";

interface AuditLog {
  id: string;
  eventType: string;
  action: string;
  outcome: string;
  severity: string;
  userId?: string;
  platformUserId?: string;
  ipAddress?: string;
  userAgent?: string;
  country?: string;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
  sessionId?: string;
  requestId?: string;
  timestamp: string;
  user?: {
    id: string;
    email: string;
    name?: string;
    role: string;
  };
  platformUser?: {
    id: string;
    email: string;
    name?: string;
    role: string;
  };
}

interface AuditLogsResponse {
  success: boolean;
  data?: {
    auditLogs: AuditLog[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
  error?: string;
}

const eventTypeLabels: Record<string, string> = {
  AUTHENTICATION: "Authentication",
  AUTHORIZATION: "Authorization",
  USER_MANAGEMENT: "User Management",
  COMPANY_MANAGEMENT: "Company Management",
  RATE_LIMITING: "Rate Limiting",
  CSRF_PROTECTION: "CSRF Protection",
  SECURITY_HEADERS: "Security Headers",
  PASSWORD_RESET: "Password Reset",
  PLATFORM_ADMIN: "Platform Admin",
  DATA_PRIVACY: "Data Privacy",
  SYSTEM_CONFIG: "System Config",
  API_SECURITY: "API Security",
};

const outcomeColors: Record<string, string> = {
  SUCCESS: "bg-green-100 text-green-800",
  FAILURE: "bg-red-100 text-red-800",
  BLOCKED: "bg-orange-100 text-orange-800",
  RATE_LIMITED: "bg-yellow-100 text-yellow-800",
  SUSPICIOUS: "bg-purple-100 text-purple-800",
};

const severityColors: Record<string, string> = {
  INFO: "bg-blue-100 text-blue-800",
  LOW: "bg-gray-100 text-gray-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

export default function AuditLogsPage() {
  const { data: session } = useSession();
  const eventTypeId = useId();
  const outcomeId = useId();
  const severityId = useId();
  const startDateId = useId();
  const endDateId = useId();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    totalCount: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });

  // Filter states
  const [filters, setFilters] = useState({
    eventType: "",
    outcome: "",
    severity: "",
    userId: "",
    startDate: "",
    endDate: "",
  });

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchAuditLogs = useCallback(async () => {
    if (hasFetched) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...filters,
      });

      Object.keys(filters).forEach((key) => {
        if (!filters[key as keyof typeof filters]) {
          params.delete(key);
        }
      });

      const response = await fetch(
        `/api/admin/audit-logs?${params.toString()}`
      );
      const data: AuditLogsResponse = await response.json();

      if (data.success && data.data) {
        setAuditLogs(data.data.auditLogs);
        setPagination(data.data.pagination);
        setError(null);
        setHasFetched(true);
      } else {
        setError(data.error || "Failed to fetch audit logs");
      }
    } catch (err) {
      setError("An error occurred while fetching audit logs");
      console.error("Audit logs fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters, hasFetched]);

  useEffect(() => {
    if (session?.user?.role === "ADMIN" && !hasFetched) {
      fetchAuditLogs();
    }
  }, [session?.user?.role, hasFetched, fetchAuditLogs]);

  // Function to refresh audit logs (for filter changes)
  const refreshAuditLogs = useCallback(() => {
    setHasFetched(false);
  }, []);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page
    refreshAuditLogs(); // Trigger fresh fetch with new filters
  };

  const clearFilters = () => {
    setFilters({
      eventType: "",
      outcome: "",
      severity: "",
      userId: "",
      startDate: "",
      endDate: "",
    });
    refreshAuditLogs(); // Trigger fresh fetch with cleared filters
  };

  if (session?.user?.role !== "ADMIN") {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <AlertDescription>
            You don&apos;t have permission to view audit logs. Only
            administrators can access this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Security Audit Logs</h1>
        <Button onClick={fetchAuditLogs} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor={eventTypeId} className="text-sm font-medium">
                Event Type
              </label>
              <Select
                value={filters.eventType}
                onValueChange={(value) =>
                  handleFilterChange("eventType", value)
                }
              >
                <SelectTrigger id={eventTypeId}>
                  <SelectValue placeholder="All event types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All event types</SelectItem>
                  {Object.entries(eventTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor={outcomeId} className="text-sm font-medium">
                Outcome
              </label>
              <Select
                value={filters.outcome}
                onValueChange={(value) => handleFilterChange("outcome", value)}
              >
                <SelectTrigger id={outcomeId}>
                  <SelectValue placeholder="All outcomes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All outcomes</SelectItem>
                  <SelectItem value="SUCCESS">Success</SelectItem>
                  <SelectItem value="FAILURE">Failure</SelectItem>
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                  <SelectItem value="RATE_LIMITED">Rate Limited</SelectItem>
                  <SelectItem value="SUSPICIOUS">Suspicious</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor={severityId} className="text-sm font-medium">
                Severity
              </label>
              <Select
                value={filters.severity}
                onValueChange={(value) => handleFilterChange("severity", value)}
              >
                <SelectTrigger id={severityId}>
                  <SelectValue placeholder="All severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All severities</SelectItem>
                  <SelectItem value="INFO">Info</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor={startDateId} className="text-sm font-medium">
                Start Date
              </label>
              <Input
                id={startDateId}
                type="datetime-local"
                value={filters.startDate}
                onChange={(e) =>
                  handleFilterChange("startDate", e.target.value)
                }
              />
            </div>

            <div>
              <label htmlFor={endDateId} className="text-sm font-medium">
                End Date
              </label>
              <Input
                id={endDateId}
                type="datetime-local"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Logs ({pagination.totalCount} total)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-gray-50 focus:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                    onClick={() => setSelectedLog(log)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedLog(log);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`View details for ${eventTypeLabels[log.eventType] || log.eventType} event`}
                  >
                    <TableCell className="font-mono text-sm">
                      {formatDistanceToNow(new Date(log.timestamp), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {eventTypeLabels[log.eventType] || log.eventType}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-48 truncate">
                      {log.action}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          outcomeColors[log.outcome] ||
                          "bg-gray-100 text-gray-800"
                        }
                      >
                        {log.outcome}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          severityColors[log.severity] ||
                          "bg-gray-100 text-gray-800"
                        }
                      >
                        {log.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.user?.email || log.platformUser?.email || "System"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.ipAddress || "N/A"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-600">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
              {Math.min(
                pagination.page * pagination.limit,
                pagination.totalCount
              )}{" "}
              of {pagination.totalCount} results
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasPrev}
                onClick={() => {
                  setPagination((prev) => ({ ...prev, page: prev.page - 1 }));
                  refreshAuditLogs();
                }}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasNext}
                onClick={() => {
                  setPagination((prev) => ({ ...prev, page: prev.page + 1 }));
                  refreshAuditLogs();
                }}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Audit Log Details</h2>
                <Button variant="ghost" onClick={() => setSelectedLog(null)}>
                  ×
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="font-medium">Timestamp:</span>
                  <p className="font-mono text-sm">
                    {new Date(selectedLog.timestamp).toLocaleString()}
                  </p>
                </div>

                <div>
                  <span className="font-medium">Event Type:</span>
                  <p>
                    {eventTypeLabels[selectedLog.eventType] ||
                      selectedLog.eventType}
                  </p>
                </div>

                <div>
                  <span className="font-medium">Action:</span>
                  <p>{selectedLog.action}</p>
                </div>

                <div>
                  <span className="font-medium">Outcome:</span>
                  <Badge className={outcomeColors[selectedLog.outcome]}>
                    {selectedLog.outcome}
                  </Badge>
                </div>

                <div>
                  <span className="font-medium">Severity:</span>
                  <Badge className={severityColors[selectedLog.severity]}>
                    {selectedLog.severity}
                  </Badge>
                </div>

                <div>
                  <span className="font-medium">IP Address:</span>
                  <p className="font-mono text-sm">
                    {selectedLog.ipAddress || "N/A"}
                  </p>
                </div>

                {selectedLog.user && (
                  <div>
                    <span className="font-medium">User:</span>
                    <p>
                      {selectedLog.user.email} ({selectedLog.user.role})
                    </p>
                  </div>
                )}

                {selectedLog.platformUser && (
                  <div>
                    <span className="font-medium">Platform User:</span>
                    <p>
                      {selectedLog.platformUser.email} (
                      {selectedLog.platformUser.role})
                    </p>
                  </div>
                )}

                {selectedLog.country && (
                  <div>
                    <span className="font-medium">Country:</span>
                    <p>{selectedLog.country}</p>
                  </div>
                )}

                {selectedLog.sessionId && (
                  <div>
                    <span className="font-medium">Session ID:</span>
                    <p className="font-mono text-sm">{selectedLog.sessionId}</p>
                  </div>
                )}

                {selectedLog.requestId && (
                  <div>
                    <span className="font-medium">Request ID:</span>
                    <p className="font-mono text-sm">{selectedLog.requestId}</p>
                  </div>
                )}
              </div>

              {selectedLog.errorMessage && (
                <div className="mt-4">
                  <span className="font-medium">Error Message:</span>
                  <p className="text-red-600 bg-red-50 p-2 rounded text-sm">
                    {selectedLog.errorMessage}
                  </p>
                </div>
              )}

              {selectedLog.userAgent && (
                <div className="mt-4">
                  <span className="font-medium">User Agent:</span>
                  <p className="text-sm break-all">{selectedLog.userAgent}</p>
                </div>
              )}

              {selectedLog.metadata && (
                <div className="mt-4">
                  <span className="font-medium">Metadata:</span>
                  <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
