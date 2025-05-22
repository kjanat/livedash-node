"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Company } from "../../../lib/types";

export default function CompanySettingsPage() {
  const { data: session, status } = useSession();
  // We store the full company object for future use and updates after save operations
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  const [company, setCompany] = useState<Company | null>(null);
  const [csvUrl, setCsvUrl] = useState<string>("");
  const [csvUsername, setCsvUsername] = useState<string>("");
  const [csvPassword, setCsvPassword] = useState<string>("");
  const [sentimentThreshold, setSentimentThreshold] = useState<string>("");
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
          setSentimentThreshold(data.company.sentimentAlert?.toString() || "");
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
          sentimentThreshold,
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
    return <div className="text-center py-10">Loading settings...</div>;
  }

  // Check for admin access
  if (session?.user?.role !== "admin") {
    return (
      <div className="text-center py-10 bg-white rounded-xl shadow p-6">
        <h2 className="font-bold text-xl text-red-600 mb-2">Access Denied</h2>
        <p>You don&apos;t have permission to view company settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          Company Settings
        </h1>

        {message && (
          <div
            className={`p-4 rounded mb-6 ${message.includes("Failed") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
          >
            {message}
          </div>
        )}

        <form
          className="grid gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          autoComplete="off"
        >
          <div className="grid gap-2">
            <label className="font-medium text-gray-700">
              CSV Data Source URL
            </label>
            <input
              type="text"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={csvUrl}
              onChange={(e) => setCsvUrl(e.target.value)}
              placeholder="https://example.com/data.csv"
              autoComplete="off"
            />
          </div>

          <div className="grid gap-2">
            <label className="font-medium text-gray-700">CSV Username</label>
            <input
              type="text"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={csvUsername}
              onChange={(e) => setCsvUsername(e.target.value)}
              placeholder="Username for CSV access (if needed)"
              autoComplete="off"
            />
          </div>

          <div className="grid gap-2">
            <label className="font-medium text-gray-700">CSV Password</label>
            <input
              type="password"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={csvPassword}
              onChange={(e) => setCsvPassword(e.target.value)}
              placeholder="Password will be updated only if provided"
              autoComplete="new-password"
            />
            <p className="text-sm text-gray-500">
              Leave blank to keep current password
            </p>
          </div>

          <div className="grid gap-2">
            <label className="font-medium text-gray-700">
              Sentiment Alert Threshold
            </label>
            <input
              type="number"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={sentimentThreshold}
              onChange={(e) => setSentimentThreshold(e.target.value)}
              placeholder="Threshold value (0-100)"
              min="0"
              max="100"
              autoComplete="off"
            />
            <p className="text-sm text-gray-500">
              Percentage of negative sentiment sessions to trigger alert (0-100)
            </p>
          </div>

          <button
            type="submit"
            className="bg-sky-600 hover:bg-sky-700 text-white py-2 px-4 rounded-lg shadow transition-colors w-full sm:w-auto"
          >
            Save Settings
          </button>
        </form>
      </div>
    </div>
  );
}
