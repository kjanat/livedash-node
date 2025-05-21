"use client";
import { useState } from "react";
import { Company } from "../../lib/types";
import { Session } from "next-auth";

interface DashboardSettingsProps {
  company: Company;
  session: Session;
}

export default function DashboardSettings({
  company,
  session,
}: DashboardSettingsProps) {
  const [csvUrl, setCsvUrl] = useState<string>(company.csvUrl);
  const [csvUsername, setCsvUsername] = useState<string>(
    company.csvUsername || "",
  );
  const [csvPassword, setCsvPassword] = useState<string>("");
  const [sentimentThreshold, setSentimentThreshold] = useState<string>(
    company.sentimentAlert?.toString() || "",
  );
  const [message, setMessage] = useState<string>("");

  async function handleSave() {
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
    if (res.ok) setMessage("Settings saved!");
    else setMessage("Failed.");
  }

  if (session.user.role !== "admin") return null;

  return (
    <div className="bg-white p-6 rounded-xl shadow mb-6">
      <h2 className="font-bold text-lg mb-4">Company Config</h2>
      <div className="grid gap-4">
        <input
          className="border px-3 py-2 rounded"
          placeholder="CSV URL"
          value={csvUrl}
          onChange={(e) => setCsvUrl(e.target.value)}
        />
        <input
          className="border px-3 py-2 rounded"
          placeholder="CSV Username"
          value={csvUsername}
          onChange={(e) => setCsvUsername(e.target.value)}
        />
        <input
          className="border px-3 py-2 rounded"
          type="password"
          placeholder="CSV Password"
          value={csvPassword}
          onChange={(e) => setCsvPassword(e.target.value)}
        />
        <input
          className="border px-3 py-2 rounded"
          placeholder="Sentiment Alert Threshold"
          type="number"
          value={sentimentThreshold}
          onChange={(e) => setSentimentThreshold(e.target.value)}
        />
        <button
          className="bg-blue-600 text-white rounded py-2"
          onClick={handleSave}
        >
          Save Settings
        </button>
        <div>{message}</div>
      </div>
    </div>
  );
}
