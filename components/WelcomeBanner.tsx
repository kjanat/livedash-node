"use client";

import { useSession } from "next-auth/react";

interface WelcomeBannerProps {
  companyName?: string;
}

export default function WelcomeBanner({ companyName }: WelcomeBannerProps) {
  const { data: session } = useSession();
  const userName = session?.user?.name || "User";
  const currentTime = new Date();
  const hour = currentTime.getHours();

  let greeting = "Welcome";
  if (hour < 12) {
    greeting = "Good morning";
  } else if (hour < 18) {
    greeting = "Good afternoon";
  } else {
    greeting = "Good evening";
  }

  return (
    <div className="bg-linear-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-xl shadow-lg mb-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">
            {greeting}, {userName}!
          </h1>
          <p className="mt-2 opacity-90">
            Welcome to the {companyName || "LiveDash"} analytics dashboard.
            Here&apos;s an overview of your metrics and performance data.
          </p>
        </div>
        <div className="hidden md:block">
          <div className="text-5xl">📊</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-white/20 backdrop-blur-sm p-4 rounded-lg">
          <div className="text-sm opacity-75">Last Update</div>
          <div className="text-xl font-semibold">
            {currentTime.toLocaleString()}
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm p-4 rounded-lg">
          <div className="text-sm opacity-75">Current Status</div>
          <div className="text-xl font-semibold flex items-center">
            <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2"></span>
            All Systems Operational
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm p-4 rounded-lg">
          <div className="text-sm opacity-75">Today&apos;s Insights</div>
          <div className="text-xl font-semibold">Ready to Explore</div>
        </div>
      </div>
    </div>
  );
}
