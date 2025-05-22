"use client";

import { ReactNode } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect if not authenticated
  if (status === "unauthenticated") {
    router.push("/login");
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">Redirecting to login...</div>
      </div>
    );
  }

  // Show loading state while session status is being determined
  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">Loading session...</div>
      </div>
    );
  }

  // Defined for potential future use, like adding a logout button in the layout
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar with logout handler passed as prop */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </div>
    </div>
  );
}
