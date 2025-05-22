"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

// Icons for the sidebar
const DashboardIcon = () => (
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
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
);

const ToggleIcon = ({ isExpanded }: { isExpanded: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={`h-5 w-5 transform transition-transform ${isExpanded ? "rotate-180" : ""}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5l7 7-7 7"
    />
  </svg>
);

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  isActive: boolean;
}

const NavItem: React.FC<NavItemProps> = ({
  href,
  label,
  icon,
  isExpanded,
  isActive,
}) => (
  <Link
    href={href}
    className={`relative flex items-center p-3 my-1 rounded-lg transition-all group ${
      isActive
        ? "bg-sky-100 text-sky-800 font-medium"
        : "hover:bg-gray-100 text-gray-700 hover:text-gray-900"
    }`}
  >
    <span className={`flex-shrink-0 ${isExpanded ? "mr-3" : "mx-auto"}`}>
      {icon}
    </span>
    {isExpanded ? (
      <span className="truncate">{label}</span>
    ) : (
      <div
        className="fixed ml-6 w-auto p-2 min-w-max rounded-md shadow-md text-xs font-medium
        text-white bg-gray-800 z-50
        invisible opacity-0 -translate-x-3 transition-all
        group-hover:visible group-hover:opacity-100 group-hover:translate-x-0"
      >
        {label}
      </div>
    )}
  </Link>
);

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(true);
  const pathname = usePathname() || "";

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <div
      className={`relative h-screen bg-white shadow-md transition-all duration-300 ${
        isExpanded ? "w-56" : "w-16"
      } flex flex-col overflow-visible`}
    >
      {/* Logo section - now above toggle button */}
      <div className="flex flex-col items-center pt-5 pb-3">
        <div
          className={`relative ${isExpanded ? "w-16" : "w-10"} aspect-square mb-1`}
        >
          <Image
            src="/favicon.svg"
            alt="LiveDash Logo"
            fill
            className="transition-all duration-300"
            // Added priority prop for LCP optimization
            priority
            style={{
              objectFit: "contain",
              maxWidth: "100%",
              // height: "auto"
            }}
          />
        </div>
        {isExpanded && (
          <span className="text-lg font-bold text-sky-700 mt-1">LiveDash</span>
        )}
      </div>
      {/* Toggle button */}
      <div className="flex justify-center border-b border-t py-2">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors relative group"
          title={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          <ToggleIcon isExpanded={isExpanded} />
          {!isExpanded && (
            <div
              className="fixed ml-6 w-auto p-2 min-w-max rounded-md shadow-md text-xs font-medium
              text-white bg-gray-800 z-50
              invisible opacity-0 -translate-x-3 transition-all
              group-hover:visible group-hover:opacity-100 group-hover:translate-x-0"
            >
              {isExpanded ? "Collapse sidebar" : "Expand sidebar"}
            </div>
          )}
        </button>
      </div>
      {/* Navigation items */}
      <nav className="flex-1 py-4 px-2 overflow-y-auto overflow-x-visible">
        <NavItem
          href="/dashboard"
          label="Dashboard"
          icon={<DashboardIcon />}
          isExpanded={isExpanded}
          isActive={pathname === "/dashboard"}
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
        />
        <NavItem
          href="/dashboard/sessions"
          label="Sessions"
          icon={<SessionsIcon />}
          isExpanded={isExpanded}
          isActive={pathname.startsWith("/dashboard/sessions")}
        />
        <NavItem
          href="/dashboard/company"
          label="Company Settings"
          icon={<CompanyIcon />}
          isExpanded={isExpanded}
          isActive={pathname === "/dashboard/company"}
        />
        <NavItem
          href="/dashboard/users"
          label="User Management"
          icon={<UsersIcon />}
          isExpanded={isExpanded}
          isActive={pathname === "/dashboard/users"}
        />
      </nav>
      {/* Logout at the bottom */}
      <div className="p-4 border-t mt-auto">
        <button
          onClick={handleLogout}
          className={`relative flex items-center p-3 w-full rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-all group ${
            isExpanded ? "" : "justify-center"
          }`}
        >
          <span className={`flex-shrink-0 ${isExpanded ? "mr-3" : ""}`}>
            <LogoutIcon />
          </span>
          {isExpanded ? (
            <span>Logout</span>
          ) : (
            <div
              className="fixed ml-6 w-auto p-2 min-w-max rounded-md shadow-md text-xs font-medium
              text-white bg-gray-800 z-50
              invisible opacity-0 -translate-x-3 transition-all
              group-hover:visible group-hover:opacity-100 group-hover:translate-x-0"
            >
              Logout
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
