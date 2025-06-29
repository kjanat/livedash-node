"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type React from "react"; // No hooks needed since state is now managed by parent
import { useId } from "react";
import { SimpleThemeToggle } from "@/components/ui/theme-toggle";

// Icons for the sidebar
const DashboardIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <title>Dashboard</title>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
    />
  </svg>
);

const CompanyIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <title>Company</title>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
    />
  </svg>
);

const UsersIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <title>Users</title>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
    />
  </svg>
);

const SessionsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <title>Sessions</title>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
    />
  </svg>
);

const LogoutIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <title>Logout</title>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
);

const MinimalToggleIcon = ({ isExpanded }: { isExpanded: boolean }) => (
  <svg
    className="h-6 w-6 text-gray-600 group-hover:text-sky-700 transition-colors"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <title>{isExpanded ? "Collapse sidebar" : "Expand sidebar"}</title>
    {isExpanded ? (
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    ) : (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6h16M4 12h16M4 18h7"
      />
    )}
  </svg>
);

export interface SidebarProps {
  isExpanded: boolean;
  onToggle: () => void;
  isMobile?: boolean; // Add this property to indicate mobile viewport
  onNavigate?: () => void; // Function to call when navigating to a new page
}

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  isActive: boolean;
  onNavigate?: () => void; // Function to call when navigating to a new page
}

const NavItem: React.FC<NavItemProps> = ({
  href,
  label,
  icon,
  isExpanded,
  isActive,
  onNavigate,
}) => (
  <Link
    href={href}
    className={`relative flex items-center p-3 my-1 rounded-lg transition-all group ${
      isActive
        ? "bg-primary/10 text-primary font-medium border border-primary/20"
        : "hover:bg-muted text-muted-foreground hover:text-foreground"
    }`}
    onClick={() => {
      if (onNavigate) {
        onNavigate();
      }
    }}
  >
    <span className={`shrink-0 ${isExpanded ? "mr-3" : "mx-auto"}`}>
      {icon}
    </span>
    {isExpanded ? (
      <span className="truncate">{label}</span>
    ) : (
      <div
        className="fixed ml-6 w-auto p-2 min-w-max rounded-md shadow-md text-xs font-medium
        text-popover-foreground bg-popover border border-border z-50
        invisible opacity-0 -translate-x-3 transition-all
        group-hover:visible group-hover:opacity-100 group-hover:translate-x-0"
      >
        {label}
      </div>
    )}
  </Link>
);

export default function Sidebar({
  isExpanded,
  onToggle,
  isMobile = false,
  onNavigate,
}: SidebarProps) {
  const sidebarId = useId();
  const pathname = usePathname() || "";

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <>
      {/* Backdrop overlay when sidebar is expanded on mobile */}
      {isExpanded && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-10 transition-all duration-300"
          onClick={onToggle}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onToggle();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Close sidebar"
        />
      )}

      <div
        id={sidebarId}
        className={`fixed md:relative h-screen bg-card border-r border-border shadow-lg transition-all duration-300
        ${
          isExpanded ? (isMobile ? "w-full sm:w-80" : "w-56") : "w-16"
        } flex flex-col overflow-visible z-20`}
      >
        <div className="flex flex-col items-center pt-5 pb-3 border-b relative">
          {/* Toggle button when sidebar is collapsed - above logo */}
          {!isExpanded && (
            <div className="absolute top-1 left-1/2 transform -translate-x-1/2 z-30">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault(); // Prevent any navigation
                  onToggle();
                }}
                className="p-1.5 rounded-md hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary transition-colors group"
                aria-label="Expand sidebar"
                aria-expanded={isExpanded}
                aria-controls={sidebarId}
              >
                <MinimalToggleIcon isExpanded={isExpanded} />
              </button>
            </div>
          )}

          {/* Logo section with link to homepage */}
          <Link href="/" className="flex flex-col items-center">
            <div
              className={`relative ${isExpanded ? "w-16" : "w-10 mt-8"} aspect-square mb-1 transition-all duration-300`}
            >
              <Image
                src="/favicon.svg"
                alt="LiveDash Logo"
                fill
                className="transition-all duration-300"
                priority
                style={{
                  objectFit: "contain",
                  maxWidth: "100%",
                }}
              />
            </div>
            {isExpanded && (
              <span className="text-lg font-bold text-primary mt-1 transition-opacity duration-300">
                LiveDash
              </span>
            )}
          </Link>
        </div>
        {isExpanded && (
          <div className="absolute top-3 right-3 z-30">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault(); // Prevent any navigation
                onToggle();
              }}
              className="p-1.5 rounded-md hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary transition-colors group"
              aria-label="Collapse sidebar"
              aria-expanded={isExpanded}
              aria-controls="main-sidebar"
            >
              <MinimalToggleIcon isExpanded={isExpanded} />
            </button>
          </div>
        )}
        <nav
          aria-label="Main navigation"
          className={`flex-1 py-4 px-2 overflow-y-auto overflow-x-visible ${isExpanded ? "pt-12" : "pt-4"}`}
        >
          <NavItem
            href="/dashboard"
            label="Dashboard"
            icon={<DashboardIcon />}
            isExpanded={isExpanded}
            isActive={pathname === "/dashboard"}
            onNavigate={onNavigate}
          />
          <NavItem
            href="/dashboard/overview"
            label="Analytics"
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            }
            isExpanded={isExpanded}
            isActive={pathname === "/dashboard/overview"}
            onNavigate={onNavigate}
          />
          <NavItem
            href="/dashboard/sessions"
            label="Sessions"
            icon={<SessionsIcon />}
            isExpanded={isExpanded}
            isActive={pathname.startsWith("/dashboard/sessions")}
            onNavigate={onNavigate}
          />
          <NavItem
            href="/dashboard/company"
            label="Company Settings"
            icon={<CompanyIcon />}
            isExpanded={isExpanded}
            isActive={pathname === "/dashboard/company"}
            onNavigate={onNavigate}
          />
          <NavItem
            href="/dashboard/users"
            label="User Management"
            icon={<UsersIcon />}
            isExpanded={isExpanded}
            isActive={pathname === "/dashboard/users"}
            onNavigate={onNavigate}
          />
        </nav>
        <div className="p-4 border-t mt-auto space-y-2">
          {/* Theme Toggle */}
          <div
            className={`flex items-center ${isExpanded ? "justify-between" : "justify-center"}`}
          >
            {isExpanded && (
              <span className="text-sm font-medium text-muted-foreground">
                Theme
              </span>
            )}
            <SimpleThemeToggle />
          </div>

          {/* Logout Button */}
          <button
            type="button"
            onClick={handleLogout}
            className={`relative flex items-center p-3 w-full rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all group ${
              isExpanded ? "" : "justify-center"
            }`}
          >
            <span className={`shrink-0 ${isExpanded ? "mr-3" : ""}`}>
              <LogoutIcon />
            </span>
            {isExpanded ? (
              <span>Logout</span>
            ) : (
              <div
                className="fixed ml-6 w-auto p-2 min-w-max rounded-md shadow-md text-xs font-medium
                text-popover-foreground bg-popover border border-border z-50
                invisible opacity-0 -translate-x-3 transition-all
                group-hover:visible group-hover:opacity-100 group-hover:translate-x-0"
              >
                Logout
              </div>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
