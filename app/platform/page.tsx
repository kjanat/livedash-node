"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PlatformIndexPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to platform dashboard
    router.replace("/platform/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground">
          Redirecting to platform dashboard...
        </p>
      </div>
    </div>
  );
}
