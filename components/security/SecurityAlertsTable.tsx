"use client";

import { AlertTriangle, CheckCircle, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

interface SecurityAlertsTableProps {
  alerts: SecurityAlert[];
  onAcknowledge: (alertId: string) => void;
}

export function SecurityAlertsTable({
  alerts,
  onAcknowledge,
}: SecurityAlertsTableProps) {
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(
    null
  );

  const getSeverityColor = (severity: string) => {
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
  };

  const filteredAlerts = alerts.filter(
    (alert) => showAcknowledged || !alert.acknowledged
  );

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatAlertType = (type: string) => {
    return type
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Security Alerts</h3>
          <p className="text-sm text-muted-foreground">
            {filteredAlerts.length} alerts{" "}
            {showAcknowledged ? "total" : "active"}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAcknowledged(!showAcknowledged)}
        >
          {showAcknowledged ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          {showAcknowledged ? "Hide Acknowledged" : "Show All"}
        </Button>
      </div>

      {filteredAlerts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Alerts</h3>
            <p className="text-muted-foreground text-center">
              All security alerts have been addressed. System is operating
              normally.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlerts.map((alert) => (
                  <TableRow
                    key={alert.id}
                    className={alert.acknowledged ? "opacity-60" : ""}
                  >
                    <TableCell>
                      <Badge variant={getSeverityColor(alert.severity)}>
                        {alert.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span className="font-medium">
                          {formatAlertType(alert.type)}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {alert.eventType}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span className="font-medium">{alert.title}</span>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {alert.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {formatTimestamp(alert.timestamp)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {alert.acknowledged ? (
                        <Badge variant="outline">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Acknowledged
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedAlert(alert)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        {!alert.acknowledged && (
                          <Button
                            size="sm"
                            onClick={() => onAcknowledge(alert.id)}
                          >
                            Acknowledge
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Alert Details Modal */}
      {selectedAlert && (
        <Card className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <CardTitle>{selectedAlert.title}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={getSeverityColor(selectedAlert.severity)}>
                      {selectedAlert.severity}
                    </Badge>
                    <Badge variant="outline">
                      {formatAlertType(selectedAlert.type)}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAlert(null)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedAlert.description}
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-2">Context</h4>
                <div className="bg-muted p-3 rounded-md">
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(selectedAlert.context, null, 2)}
                  </pre>
                </div>
              </div>

              {selectedAlert.metadata &&
                Object.keys(selectedAlert.metadata).length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Metadata</h4>
                    <div className="bg-muted p-3 rounded-md">
                      <pre className="text-xs overflow-auto">
                        {JSON.stringify(selectedAlert.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

              <div className="flex items-center justify-between pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  {formatTimestamp(selectedAlert.timestamp)}
                </span>
                {!selectedAlert.acknowledged && (
                  <Button
                    onClick={() => {
                      onAcknowledge(selectedAlert.id);
                      setSelectedAlert(null);
                    }}
                  >
                    Acknowledge Alert
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </Card>
      )}
    </div>
  );
}
