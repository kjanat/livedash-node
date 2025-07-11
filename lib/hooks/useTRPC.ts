/**
 * Custom hooks for tRPC usage
 *
 * This file provides convenient hooks for common tRPC operations
 * with proper error handling and loading states.
 */

import { trpc } from "@/lib/trpc-client";

/**
 * Hook for dashboard session management
 */
export function useDashboardSessions(filters?: {
  search?: string;
  sentiment?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  return trpc.dashboard.getSessions.useQuery(
    {
      search: filters?.search,
      sentiment: filters?.sentiment as
        | "POSITIVE"
        | "NEUTRAL"
        | "NEGATIVE"
        | undefined,
      category: filters?.category as
        | "SCHEDULE_HOURS"
        | "LEAVE_VACATION"
        | "SICK_LEAVE_RECOVERY"
        | "SALARY_COMPENSATION"
        | "CONTRACT_HOURS"
        | "ONBOARDING"
        | "OFFBOARDING"
        | "WORKWEAR_STAFF_PASS"
        | "TEAM_CONTACTS"
        | "PERSONAL_QUESTIONS"
        | "ACCESS_LOGIN"
        | "SOCIAL_QUESTIONS"
        | "UNRECOGNIZED_OTHER"
        | undefined,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
      page: filters?.page || 1,
      limit: filters?.limit || 20,
    },
    {
      // Cache for 30 seconds
      staleTime: 30 * 1000,
      // Keep in background for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Refetch when component mounts if data is stale
      refetchOnMount: true,
      // Don't refetch on window focus to avoid excessive API calls
      refetchOnWindowFocus: false,
    }
  );
}

/**
 * Hook for dashboard overview statistics
 */
export function useDashboardOverview(dateRange?: {
  startDate?: string;
  endDate?: string;
}) {
  return trpc.dashboard.getOverview.useQuery(
    {
      startDate: dateRange?.startDate,
      endDate: dateRange?.endDate,
    },
    {
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );
}

/**
 * Hook for top questions
 */
export function useTopQuestions(options?: {
  limit?: number;
  startDate?: string;
  endDate?: string;
}) {
  return trpc.dashboard.getTopQuestions.useQuery(
    {
      limit: options?.limit || 10,
      startDate: options?.startDate,
      endDate: options?.endDate,
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );
}

/**
 * Hook for geographic distribution
 */
export function useGeographicDistribution(dateRange?: {
  startDate?: string;
  endDate?: string;
}) {
  return trpc.dashboard.getGeographicDistribution.useQuery(
    {
      startDate: dateRange?.startDate,
      endDate: dateRange?.endDate,
    },
    {
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );
}

/**
 * Hook for AI processing metrics
 */
export function useAIMetrics(dateRange?: {
  startDate?: string;
  endDate?: string;
}) {
  return trpc.dashboard.getAIMetrics.useQuery(
    {
      startDate: dateRange?.startDate,
      endDate: dateRange?.endDate,
    },
    {
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );
}

/**
 * Hook for user authentication profile
 */
export function useUserProfile() {
  return trpc.auth.getProfile.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    // Only fetch if user is likely authenticated
    retry: 1,
  });
}

/**
 * Hook for admin user management
 */
export function useAdminUsers(options?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  return trpc.admin.getUsers.useQuery(
    {
      page: options?.page || 1,
      limit: options?.limit || 20,
      search: options?.search,
    },
    {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );
}

/**
 * Hook for company settings
 */
export function useCompanySettings() {
  return trpc.admin.getCompanySettings.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for system statistics
 */
export function useSystemStats() {
  return trpc.admin.getSystemStats.useQuery(undefined, {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}
