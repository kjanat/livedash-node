"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FC } from "react";

const DashboardPage: FC = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Once session is loaded, redirect appropriately
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      setLoading(false);
    }
  }, [status, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-500 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-sky-50 to-sky-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-lg font-semibold text-sky-700">Analytics</h2>
            <p className="text-gray-600 mt-2 mb-4">
              View your chat session metrics and analytics
            </p>
            <button
              onClick={() => router.push("/dashboard/overview")}
              className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              View Analytics
            </button>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-lg font-semibold text-emerald-700">Sessions</h2>
            <p className="text-gray-600 mt-2 mb-4">
              Browse and analyze conversation sessions
            </p>
            <button
              onClick={() => router.push("/dashboard/sessions")}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              View Sessions
            </button>
          </div>

          {session?.user?.role === "admin" && (
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-lg font-semibold text-purple-700">
                Company Settings
              </h2>
              <p className="text-gray-600 mt-2 mb-4">
                Configure company settings and integrations
              </p>
              <button
                onClick={() => router.push("/dashboard/company")}
                className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Manage Settings
              </button>
            </div>
          )}

          {session?.user?.role === "admin" && (
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-lg font-semibold text-amber-700">
                User Management
              </h2>
              <p className="text-gray-600 mt-2 mb-4">
                Invite and manage user accounts
              </p>
              <button
                onClick={() => router.push("/dashboard/users")}
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Manage Users
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
