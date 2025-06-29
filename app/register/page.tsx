"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const [email, setEmail] = useState<string>("");
  const [company, setCompany] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [csvUrl, setCsvUrl] = useState<string>("");
  const [role, setRole] = useState<string>("ADMIN"); // Default to ADMIN for company registration
  const [error, setError] = useState<string>("");
  const router = useRouter();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, company, csvUrl, role }),
    });
    if (res.ok) router.push("/login");
    else setError("Registration failed.");
  }

  return (
    <div className="max-w-md mx-auto mt-24 bg-white rounded-xl p-8 shadow">
      <h1 className="text-2xl font-bold mb-6">Register Company</h1>
      {error && <div className="text-red-600 mb-3">{error}</div>}
      <form onSubmit={handleRegister} className="flex flex-col gap-4">
        <input
          className="border px-3 py-2 rounded"
          type="text"
          placeholder="Company Name"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          required
        />
        <input
          className="border px-3 py-2 rounded"
          type="email"
          placeholder="Admin Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="border px-3 py-2 rounded"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          className="border px-3 py-2 rounded"
          type="text"
          placeholder="CSV URL"
          value={csvUrl}
          onChange={(e) => setCsvUrl(e.target.value)}
        />
        <select
          className="border px-3 py-2 rounded"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          required
        >
          <option value="admin">Admin</option>
          <option value="user">User</option>
          <option value="AUDITOR">Auditor</option>
        </select>
        <button className="bg-blue-600 text-white rounded py-2" type="submit">
          Register & Continue
        </button>
      </form>
    </div>
  );
}
