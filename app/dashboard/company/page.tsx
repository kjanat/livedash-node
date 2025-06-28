"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Company } from "../../../lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldX, Settings, Save, Database } from "lucide-react";

export default function CompanySettingsPage() {
  const { data: session, status } = useSession();
  // We store the full company object for future use and updates after save operations
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  const [company, setCompany] = useState<Company | null>(null);
  const [csvUrl, setCsvUrl] = useState<string>("");
  const [csvUsername, setCsvUsername] = useState<string>("");
  const [csvPassword, setCsvPassword] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      const fetchCompany = async () => {
        setLoading(true);
        try {
          const res = await fetch("/api/dashboard/config");
          const data = await res.json();
          setCompany(data.company);
          setCsvUrl(data.company.csvUrl || "");
          setCsvUsername(data.company.csvUsername || "");
          if (data.company.csvPassword) {
            setCsvPassword(data.company.csvPassword);
          }
        } catch (error) {
          console.error("Failed to fetch company settings:", error);
          setMessage("Failed to load company settings.");
        } finally {
          setLoading(false);
        }
      };
      fetchCompany();
    }
  }, [status]);

  async function handleSave() {
    setMessage("");
    try {
      const res = await fetch("/api/dashboard/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvUrl,
          csvUsername,
          csvPassword,
        }),
      });

      if (res.ok) {
        setMessage("Settings saved successfully!");
        // Update local state if needed
        const data = await res.json();
        setCompany(data.company);
      } else {
        const error = await res.json();
        setMessage(
          `Failed to save settings: ${error.message || "Unknown error"}`
        );
      }
    } catch (error) {
      setMessage("Failed to save settings. Please try again.");
      console.error("Error saving settings:", error);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Settings className="h-6 w-6" />
              <CardTitle>Company Settings</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              Loading settings...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check for ADMIN access
  if (session?.user?.role !== "ADMIN") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldX className="h-6 w-6 text-destructive" />
              <CardTitle className="text-destructive">Access Denied</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                You don&apos;t have permission to view company settings.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6" />
            <CardTitle>Company Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {message && (
            <Alert variant={message.includes("Failed") ? "destructive" : "default"}>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            autoComplete="off"
          >
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  <CardTitle className="text-lg">Data Source Configuration</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="csvUrl">CSV Data Source URL</Label>
                  <Input
                    id="csvUrl"
                    type="text"
                    value={csvUrl}
                    onChange={(e) => setCsvUrl(e.target.value)}
                    placeholder="https://example.com/data.csv"
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="csvUsername">CSV Username</Label>
                  <Input
                    id="csvUsername"
                    type="text"
                    value={csvUsername}
                    onChange={(e) => setCsvUsername(e.target.value)}
                    placeholder="Username for CSV access (if needed)"
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="csvPassword">CSV Password</Label>
                  <Input
                    id="csvPassword"
                    type="password"
                    value={csvPassword}
                    onChange={(e) => setCsvPassword(e.target.value)}
                    placeholder="Password will be updated only if provided"
                    autoComplete="new-password"
                  />
                  <p className="text-sm text-muted-foreground">
                    Leave blank to keep current password
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" className="gap-2">
                <Save className="h-4 w-4" />
                Save Settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
