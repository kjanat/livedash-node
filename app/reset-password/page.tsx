"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

// Component that uses useSearchParams wrapped in Suspense
function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");
  const [password, setPassword] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    if (res.ok) {
      setMessage("Password reset! Redirecting to login...");
      setTimeout(() => router.push("/login"), 2000);
    } else setMessage("Invalid or expired link.");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input
        className="border px-3 py-2 rounded"
        type="password"
        placeholder="New Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button className="bg-blue-600 text-white rounded py-2" type="submit">
        Reset Password
      </button>
      <div className="mt-4 text-green-700">{message}</div>
    </form>
  );
}

// Loading fallback component
function LoadingForm() {
  return <div className="text-center py-4">Loading...</div>;
}

export default function ResetPasswordPage() {
  return (
    <div className="max-w-md mx-auto mt-24 bg-white rounded-xl p-8 shadow">
      <h1 className="text-2xl font-bold mb-6">Reset Password</h1>
      <Suspense fallback={<LoadingForm />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
