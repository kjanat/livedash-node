/**
 * Dynamic Import Utilities for Bundle Optimization
 *
 * This module provides utilities for dynamic imports to improve
 * bundle splitting and reduce initial bundle size through:
 * - Lazy loading of heavy components
 * - Route-based code splitting
 * - Library-specific dynamic imports
 */

import dynamic from "next/dynamic";
import { type ComponentType, lazy, Suspense } from "react";

// Loading component for better UX during lazy loading
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-4">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const LoadingSkeleton = () => (
  <div className="animate-pulse space-y-4 p-4">
    <div className="h-4 bg-gray-200 rounded w-3/4" />
    <div className="h-4 bg-gray-200 rounded w-1/2" />
    <div className="h-4 bg-gray-200 rounded w-5/6" />
  </div>
);

// Generic dynamic import wrapper with error boundary
function createDynamicComponent<T = object>(
  importFunc: () => Promise<{ default: ComponentType<T> }>,
  options?: {
    loading?: ComponentType;
    ssr?: boolean;
    suspense?: boolean;
  }
) {
  const {
    loading: LoadingComponent = LoadingSpinner,
    ssr = true,
    suspense = false,
  } = options || {};

  return dynamic(importFunc, {
    loading: () => <LoadingComponent />,
    ssr,
    suspense,
  });
}

// Chart components (heavy libraries - perfect for dynamic loading)
export const DynamicLineChart = createDynamicComponent(
  () => import("recharts").then((mod) => ({ default: mod.LineChart })),
  { loading: LoadingSkeleton, ssr: false }
);

export const DynamicBarChart = createDynamicComponent(
  () => import("recharts").then((mod) => ({ default: mod.BarChart })),
  { loading: LoadingSkeleton, ssr: false }
);

export const DynamicPieChart = createDynamicComponent(
  () => import("recharts").then((mod) => ({ default: mod.PieChart })),
  { loading: LoadingSkeleton, ssr: false }
);

export const DynamicAreaChart = createDynamicComponent(
  () => import("recharts").then((mod) => ({ default: mod.AreaChart })),
  { loading: LoadingSkeleton, ssr: false }
);

// D3 components for data visualization (also heavy)
export const DynamicWordCloud = createDynamicComponent(
  () =>
    import("../components/charts/WordCloud").then((mod) => ({
      default: mod.WordCloud,
    })),
  { loading: LoadingSkeleton, ssr: false }
);

export const DynamicTreeMap = createDynamicComponent(
  () =>
    import("../components/charts/TreeMap").then((mod) => ({
      default: mod.TreeMap,
    })),
  { loading: LoadingSkeleton, ssr: false }
);

// Map components (Leaflet is heavy)
export const DynamicLeafletMap = createDynamicComponent(
  () =>
    import("../components/maps/LeafletMap").then((mod) => ({
      default: mod.LeafletMap,
    })),
  { loading: LoadingSkeleton, ssr: false }
);

// Admin panels (only loaded for admin users)
export const DynamicAuditLogsPanel = createDynamicComponent(
  () =>
    import("../app/dashboard/audit-logs/page").then((mod) => ({
      default: mod.default,
    })),
  { loading: LoadingSkeleton }
);

export const DynamicSecurityMonitoring = createDynamicComponent(
  () =>
    import("../components/admin/SecurityMonitoring").then((mod) => ({
      default: mod.SecurityMonitoring,
    })),
  { loading: LoadingSkeleton }
);

// CSV processing components (only loaded when needed)
export const DynamicCSVUploader = createDynamicComponent(
  () =>
    import("../components/csv/CSVUploader").then((mod) => ({
      default: mod.CSVUploader,
    })),
  { loading: LoadingSpinner }
);

export const DynamicCSVProcessor = createDynamicComponent(
  () =>
    import("../components/csv/CSVProcessor").then((mod) => ({
      default: mod.CSVProcessor,
    })),
  { loading: LoadingSpinner }
);

// Data table components (heavy when dealing with large datasets)
export const DynamicDataTable = createDynamicComponent(
  () =>
    import("../components/tables/DataTable").then((mod) => ({
      default: mod.DataTable,
    })),
  { loading: LoadingSkeleton }
);

// Modal components (can be heavy with complex forms)
export const DynamicUserInviteModal = createDynamicComponent(
  () =>
    import("../components/modals/UserInviteModal").then((mod) => ({
      default: mod.UserInviteModal,
    })),
  { loading: LoadingSpinner }
);

export const DynamicCompanySettingsModal = createDynamicComponent(
  () =>
    import("../components/modals/CompanySettingsModal").then((mod) => ({
      default: mod.CompanySettingsModal,
    })),
  { loading: LoadingSpinner }
);

// Text editor components (rich text editors are typically heavy)
export const DynamicRichTextEditor = createDynamicComponent(
  () =>
    import("../components/editor/RichTextEditor").then((mod) => ({
      default: mod.RichTextEditor,
    })),
  { loading: LoadingSpinner, ssr: false }
);

// PDF viewers and generators (heavy libraries)
export const DynamicPDFViewer = createDynamicComponent(
  () =>
    import("../components/pdf/PDFViewer").then((mod) => ({
      default: mod.PDFViewer,
    })),
  { loading: LoadingSpinner, ssr: false }
);

// Animation libraries (Framer Motion, Lottie, etc.)
export const DynamicAnimatedComponent = createDynamicComponent(
  () =>
    import("../components/animations/AnimatedComponent").then((mod) => ({
      default: mod.AnimatedComponent,
    })),
  { loading: LoadingSpinner, ssr: false }
);

// React wrapper for React.lazy with Suspense
export function createLazyComponent<T = object>(
  importFunc: () => Promise<{ default: ComponentType<T> }>,
  _fallback: ComponentType = LoadingSpinner
) {
  const LazyComponent = lazy(importFunc);

  return function WrappedComponent(props: T) {
    return (
      <Suspense fallback={<fallback />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Utility for dynamic library imports (for libraries not directly used in components)
export async function dynamicImport<T>(
  importFunc: () => Promise<T>
): Promise<T> {
  try {
    return await importFunc();
  } catch (error) {
    console.error("Dynamic import failed:", error);
    throw new Error("Failed to load module");
  }
}

// Dynamic import helpers for specific heavy libraries
export const DynamicLibraries = {
  // Date utilities
  dateFns: () => dynamicImport(() => import("date-fns")),
  dateFnsFormat: () =>
    dynamicImport(() =>
      import("date-fns").then((mod) => ({ format: mod.format }))
    ),

  // Validation libraries
  zod: () => dynamicImport(() => import("zod")),

  // Animation libraries
  framerMotion: () => dynamicImport(() => import("motion")),

  // CSV parsing
  csvParse: () => dynamicImport(() => import("csv-parse")),

  // Crypto utilities (when needed client-side)
  bcrypt: () => dynamicImport(() => import("bcryptjs")),
};

// Bundle analyzer helper
export const analyzeBundleSize = async () => {
  if (process.env.NODE_ENV === "development") {
    console.log("🔍 To analyze bundle size, run: pnpm build:analyze");
    console.log("📊 This will generate an interactive bundle analyzer report");
  }
};
