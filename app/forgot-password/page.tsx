"use client";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) setMessage("If that email exists, a reset link has been sent.");
    else setMessage("Failed. Try again.");
  }

  return (
    <div className="max-w-md mx-auto mt-24 bg-white rounded-xl p-8 shadow">
      <h1 className="text-2xl font-bold mb-6">Forgot Password</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          className="border px-3 py-2 rounded"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button className="bg-blue-600 text-white rounded py-2" type="submit">
          Send Reset Link
        </button>
      </form>
      <div className="mt-4 text-green-700">{message}</div>
    </div>
  );
}
