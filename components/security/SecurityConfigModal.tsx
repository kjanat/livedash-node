"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SecurityConfig {
  thresholds: {
    failedLoginsPerMinute: number;
    failedLoginsPerHour: number;
    rateLimitViolationsPerMinute: number;
    cspViolationsPerMinute: number;
    adminActionsPerHour: number;
    massDataAccessThreshold: number;
    suspiciousIPThreshold: number;
  };
  alerting: {
    enabled: boolean;
    channels: string[];
    suppressDuplicateMinutes: number;
    escalationTimeoutMinutes: number;
  };
  retention: {
    alertRetentionDays: number;
    metricsRetentionDays: number;
  };
}

interface SecurityConfigModalProps {
  onClose: () => void;
  onSave: () => void;
}

export function SecurityConfigModal({
  onClose,
  onSave,
}: SecurityConfigModalProps) {
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Generate unique IDs for form elements
  const failedLoginsPerMinuteId = useId();
  const failedLoginsPerHourId = useId();
  const rateLimitViolationsPerMinuteId = useId();
  const cspViolationsPerMinuteId = useId();
  const adminActionsPerHourId = useId();
  const suspiciousIPThresholdId = useId();
  const alertingEnabledId = useId();
  const suppressDuplicateMinutesId = useId();
  const escalationTimeoutMinutesId = useId();
  const alertRetentionDaysId = useId();
  const metricsRetentionDaysId = useId();

  const loadConfig = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/security-monitoring");
      if (!response.ok) throw new Error("Failed to load config");

      const data = await response.json();
      setConfig(data.config);
    } catch (error) {
      console.error("Error loading config:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const saveConfig = async () => {
    if (!config) return;

    setSaving(true);
    try {
      const response = await fetch("/api/admin/security-monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error("Failed to save config");

      onSave();
    } catch (error) {
      console.error("Error saving config:", error);
    } finally {
      setSaving(false);
    }
  };

  const updateThreshold = (
    key: keyof SecurityConfig["thresholds"],
    value: number
  ) => {
    if (!config) return;
    setConfig({
      ...config,
      thresholds: {
        ...config.thresholds,
        [key]: value,
      },
    });
  };

  const updateAlerting = (
    key: keyof SecurityConfig["alerting"],
    value: unknown
  ) => {
    if (!config) return;
    setConfig({
      ...config,
      alerting: {
        ...config.alerting,
        [key]: value,
      },
    });
  };

  const updateRetention = (
    key: keyof SecurityConfig["retention"],
    value: number
  ) => {
    if (!config) return;
    setConfig({
      ...config,
      retention: {
        ...config.retention,
        [key]: value,
      },
    });
  };

  const toggleAlertChannel = (channel: string) => {
    if (!config) return;
    const channels = config.alerting.channels.includes(channel)
      ? config.alerting.channels.filter((c) => c !== channel)
      : [...config.alerting.channels, channel];

    updateAlerting("channels", channels);
  };

  if (loading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!config) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
            <DialogDescription>
              Failed to load security configuration
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Security Monitoring Configuration</DialogTitle>
          <DialogDescription>
            Configure security monitoring thresholds, alerting, and data
            retention
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="thresholds" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
            <TabsTrigger value="alerting">Alerting</TabsTrigger>
            <TabsTrigger value="retention">Data Retention</TabsTrigger>
          </TabsList>

          <TabsContent value="thresholds" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Detection Thresholds</CardTitle>
                <CardDescription>
                  Configure when security alerts should be triggered
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={failedLoginsPerMinuteId}>
                      Failed Logins per Minute
                    </Label>
                    <Input
                      id={failedLoginsPerMinuteId}
                      type="number"
                      min="1"
                      max="100"
                      value={config.thresholds.failedLoginsPerMinute}
                      onChange={(e) =>
                        updateThreshold(
                          "failedLoginsPerMinute",
                          Number.parseInt(e.target.value)
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={failedLoginsPerHourId}>
                      Failed Logins per Hour
                    </Label>
                    <Input
                      id={failedLoginsPerHourId}
                      type="number"
                      min="1"
                      max="1000"
                      value={config.thresholds.failedLoginsPerHour}
                      onChange={(e) =>
                        updateThreshold(
                          "failedLoginsPerHour",
                          Number.parseInt(e.target.value)
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={rateLimitViolationsPerMinuteId}>
                      Rate Limit Violations per Minute
                    </Label>
                    <Input
                      id={rateLimitViolationsPerMinuteId}
                      type="number"
                      min="1"
                      max="100"
                      value={config.thresholds.rateLimitViolationsPerMinute}
                      onChange={(e) =>
                        updateThreshold(
                          "rateLimitViolationsPerMinute",
                          Number.parseInt(e.target.value)
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={cspViolationsPerMinuteId}>
                      CSP Violations per Minute
                    </Label>
                    <Input
                      id={cspViolationsPerMinuteId}
                      type="number"
                      min="1"
                      max="100"
                      value={config.thresholds.cspViolationsPerMinute}
                      onChange={(e) =>
                        updateThreshold(
                          "cspViolationsPerMinute",
                          Number.parseInt(e.target.value)
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={adminActionsPerHourId}>
                      Admin Actions per Hour
                    </Label>
                    <Input
                      id={adminActionsPerHourId}
                      type="number"
                      min="1"
                      max="100"
                      value={config.thresholds.adminActionsPerHour}
                      onChange={(e) =>
                        updateThreshold(
                          "adminActionsPerHour",
                          Number.parseInt(e.target.value)
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={suspiciousIPThresholdId}>
                      Suspicious IP Threshold
                    </Label>
                    <Input
                      id={suspiciousIPThresholdId}
                      type="number"
                      min="1"
                      max="100"
                      value={config.thresholds.suspiciousIPThreshold}
                      onChange={(e) =>
                        updateThreshold(
                          "suspiciousIPThreshold",
                          Number.parseInt(e.target.value)
                        )
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerting" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Alert Configuration</CardTitle>
                <CardDescription>
                  Configure how and when alerts are sent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id={alertingEnabledId}
                    checked={config.alerting.enabled}
                    onCheckedChange={(checked) =>
                      updateAlerting("enabled", checked)
                    }
                  />
                  <Label htmlFor={alertingEnabledId}>
                    Enable Security Alerting
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label>Alert Channels</Label>
                  <div className="flex flex-wrap gap-2">
                    {["EMAIL", "WEBHOOK", "SLACK", "DISCORD", "PAGERDUTY"].map(
                      (channel) => (
                        <Badge
                          key={channel}
                          variant={
                            config.alerting.channels.includes(channel)
                              ? "default"
                              : "outline"
                          }
                          className="cursor-pointer"
                          onClick={() => toggleAlertChannel(channel)}
                        >
                          {channel}
                        </Badge>
                      )
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={suppressDuplicateMinutesId}>
                      Suppress Duplicates (minutes)
                    </Label>
                    <Input
                      id={suppressDuplicateMinutesId}
                      type="number"
                      min="1"
                      max="1440"
                      value={config.alerting.suppressDuplicateMinutes}
                      onChange={(e) =>
                        updateAlerting(
                          "suppressDuplicateMinutes",
                          Number.parseInt(e.target.value)
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={escalationTimeoutMinutesId}>
                      Escalation Timeout (minutes)
                    </Label>
                    <Input
                      id={escalationTimeoutMinutesId}
                      type="number"
                      min="5"
                      max="1440"
                      value={config.alerting.escalationTimeoutMinutes}
                      onChange={(e) =>
                        updateAlerting(
                          "escalationTimeoutMinutes",
                          Number.parseInt(e.target.value)
                        )
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="retention" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Data Retention</CardTitle>
                <CardDescription>
                  Configure how long security data is stored
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={alertRetentionDaysId}>
                      Alert Retention (days)
                    </Label>
                    <Input
                      id={alertRetentionDaysId}
                      type="number"
                      min="1"
                      max="3650"
                      value={config.retention.alertRetentionDays}
                      onChange={(e) =>
                        updateRetention(
                          "alertRetentionDays",
                          Number.parseInt(e.target.value)
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={metricsRetentionDaysId}>
                      Metrics Retention (days)
                    </Label>
                    <Input
                      id={metricsRetentionDaysId}
                      type="number"
                      min="1"
                      max="3650"
                      value={config.retention.metricsRetentionDays}
                      onChange={(e) =>
                        updateRetention(
                          "metricsRetentionDays",
                          Number.parseInt(e.target.value)
                        )
                      }
                    />
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>
                    • Alert data includes security alerts and acknowledgments
                  </p>
                  <p>• Metrics data includes aggregated security statistics</p>
                  <p>
                    • Audit logs are retained separately according to audit
                    policy
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={saveConfig} disabled={saving}>
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
