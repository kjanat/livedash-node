"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { type ReactNode, useCallback, useEffect, useId, useState } from "react";
import Sidebar from "../../components/Sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const mainContentId = useId();
  const { status } = useSession();
  const router = useRouter();

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const updateStatesBasedOnScreen = () => {
      const screenIsMobile = window.innerWidth < 640; // sm breakpoint for mobile
      const screenIsSmallDesktop = window.innerWidth < 768 && !screenIsMobile; // between sm and md

      setIsMobile(screenIsMobile);
      setIsSidebarExpanded(!screenIsSmallDesktop && !screenIsMobile);
    };

    updateStatesBasedOnScreen();
    window.addEventListener("resize", updateStatesBasedOnScreen);
    return () =>
      window.removeEventListener("resize", updateStatesBasedOnScreen);
  }, []);

  // Toggle sidebar handler - used for clicking the toggle button
  const toggleSidebarHandler = useCallback(() => {
    setIsSidebarExpanded((prev) => !prev);
  }, []);

  // Collapse sidebar handler - used when clicking navigation links on mobile
  const collapseSidebar = useCallback(() => {
    if (isMobile) {
      setIsSidebarExpanded(false);
    }
  }, [isMobile]);

  if (status === "unauthenticated") {
    router.push("/login");
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">Redirecting to login...</div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">Loading session...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        isExpanded={isSidebarExpanded}
        isMobile={isMobile}
        onToggle={toggleSidebarHandler}
        onNavigate={collapseSidebar}
      />

      <main
        id={mainContentId}
        className={`flex-1 overflow-auto transition-all duration-300 py-4 pr-4
          ${
            isSidebarExpanded
              ? "pl-4 sm:pl-6 md:pl-10"
              : "pl-20 sm:pl-20 md:pl-6"
          }
          sm:pr-6 md:py-6 md:pr-10`}
      >
        {/* <div className="w-full mx-auto">{children}</div> */}
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
