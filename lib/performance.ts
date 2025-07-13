/**
 * Performance Monitoring and Optimization Utilities
 *
 * This module provides client-side performance monitoring tools to:
 * - Track Core Web Vitals (LCP, FID, CLS)
 * - Monitor bundle loading performance
 * - Provide runtime performance insights
 * - Help identify optimization opportunities
 */

// Core Web Vitals types
interface PerformanceMetrics {
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {};
  private observers: PerformanceObserver[] = [];
  private isMonitoring = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.initializeMonitoring();
    }
  }

  private initializeMonitoring() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // Monitor LCP (Largest Contentful Paint)
    this.observeMetric("largest-contentful-paint", (entries) => {
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
        renderTime: number;
        loadTime: number;
      };
      this.metrics.lcp = lastEntry.renderTime || lastEntry.loadTime;
      this.reportMetric("LCP", this.metrics.lcp);
    });

    // Monitor FID (First Input Delay)
    this.observeMetric("first-input", (entries) => {
      const firstEntry = entries[0] as PerformanceEntry & {
        processingStart: number;
        startTime: number;
      };
      this.metrics.fid = firstEntry.processingStart - firstEntry.startTime;
      this.reportMetric("FID", this.metrics.fid);
    });

    // Monitor CLS (Cumulative Layout Shift)
    this.observeMetric("layout-shift", (list) => {
      let clsValue = 0;
      for (const entry of list) {
        const entryWithValue = entry as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        };
        if (!entryWithValue.hadRecentInput) {
          clsValue += entryWithValue.value;
        }
      }
      this.metrics.cls = clsValue;
      this.reportMetric("CLS", this.metrics.cls);
    });

    // Monitor FCP (First Contentful Paint)
    this.observeMetric("paint", (entries) => {
      const fcpEntry = entries.find(
        (entry) => entry.name === "first-contentful-paint"
      );
      if (fcpEntry) {
        this.metrics.fcp = fcpEntry.startTime;
        this.reportMetric("FCP", this.metrics.fcp);
      }
    });

    // Monitor TTFB (Time to First Byte)
    this.observeMetric("navigation", (entries) => {
      const navEntry = entries[0] as PerformanceNavigationTiming;
      this.metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
      this.reportMetric("TTFB", this.metrics.ttfb);
    });

    // Monitor resource loading
    this.observeResourceLoading();
  }

  private observeMetric(
    entryType: string,
    callback: (entries: PerformanceEntry[]) => void
  ) {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });

      observer.observe({ entryTypes: [entryType] });
      this.observers.push(observer);
    } catch (error) {
      console.warn(`Failed to observe ${entryType}:`, error);
    }
  }

  private observeResourceLoading() {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.name.includes(".js") || entry.name.includes(".css")) {
            this.analyzeResourceTiming(entry as PerformanceResourceTiming);
          }
        }
      });

      observer.observe({ entryTypes: ["resource"] });
      this.observers.push(observer);
    } catch (error) {
      console.warn("Failed to observe resource loading:", error);
    }
  }

  private analyzeResourceTiming(entry: PerformanceResourceTiming) {
    const isSlowResource = entry.duration > 1000; // Resources taking > 1s
    const isLargeResource = entry.transferSize > 500000; // Resources > 500KB

    if (isSlowResource || isLargeResource) {
      console.warn("Performance Issue Detected:", {
        resource: entry.name,
        duration: `${entry.duration.toFixed(2)}ms`,
        size: `${(entry.transferSize / 1024).toFixed(2)}KB`,
        type: entry.initiatorType,
        suggestion: isLargeResource
          ? "Consider code splitting or dynamic imports"
          : "Resource loading is slow - check network or CDN",
      });
    }
  }

  private reportMetric(name: string, value: number) {
    if (process.env.NODE_ENV === "development") {
      const rating = this.getRating(name, value);
      console.log(`📊 ${name}: ${value.toFixed(2)}ms (${rating})`);

      if (rating === "poor") {
        console.warn(`⚠️ ${name} performance is poor. Consider optimization.`);
      }
    }

    // In production, you might want to send this to an analytics service
    if (process.env.NODE_ENV === "production") {
      this.sendToAnalytics(name, value);
    }
  }

  private getRating(
    metricName: string,
    value: number
  ): "good" | "needs-improvement" | "poor" {
    const thresholds = {
      LCP: { good: 2500, poor: 4000 },
      FID: { good: 100, poor: 300 },
      CLS: { good: 0.1, poor: 0.25 },
      FCP: { good: 1800, poor: 3000 },
      TTFB: { good: 600, poor: 1500 },
    };

    const threshold = thresholds[metricName as keyof typeof thresholds];
    if (!threshold) return "good";

    if (value <= threshold.good) return "good";
    if (value <= threshold.poor) return "needs-improvement";
    return "poor";
  }

  private sendToAnalytics(metricName: string, value: number) {
    // Placeholder for analytics integration
    // You could send this to Google Analytics, Vercel Analytics, etc.
    if (typeof window !== "undefined" && "gtag" in window) {
      const gtag = (window as { gtag?: (...args: unknown[]) => void }).gtag;
      gtag?.("event", "core_web_vital", {
        name: metricName,
        value: Math.round(value),
        metric_rating: this.getRating(metricName, value),
      });
    }
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public generatePerformanceReport(): string {
    const report = Object.entries(this.metrics)
      .map(([key, value]) => {
        const rating = this.getRating(key.toUpperCase(), value);
        return `${key.toUpperCase()}: ${value.toFixed(2)}ms (${rating})`;
      })
      .join("\n");

    return `Performance Report:\n${report}`;
  }

  public getBundleAnalysis() {
    if (typeof window === "undefined") return null;

    const scripts = Array.from(document.querySelectorAll("script[src]"));
    const styles = Array.from(
      document.querySelectorAll('link[rel="stylesheet"]')
    );

    const bundleInfo = {
      scripts: scripts.length,
      styles: styles.length,
      totalResources: scripts.length + styles.length,
      suggestions: [] as string[],
    };

    // Analyze bundle composition
    const jsFiles = scripts.map((script) => (script as HTMLScriptElement).src);
    const hasLargeVendorBundle = jsFiles.some(
      (src) => src.includes("vendor") || src.includes("node_modules")
    );

    if (bundleInfo.scripts > 10) {
      bundleInfo.suggestions.push("Consider consolidating scripts");
    }

    if (hasLargeVendorBundle) {
      bundleInfo.suggestions.push(
        "Consider code splitting for vendor libraries"
      );
    }

    return bundleInfo;
  }

  public cleanup() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
    this.isMonitoring = false;
  }
}

// Bundle size analysis utilities
export const BundleAnalyzer = {
  // Estimate the size of imported modules
  estimateModuleSize: (moduleName: string): Promise<number> => {
    return import(moduleName).then((module) => {
      // This is a rough estimation - in practice you'd use webpack-bundle-analyzer
      return JSON.stringify(module).length;
    });
  },

  // Check if a module should be dynamically imported based on size
  shouldDynamicImport: (estimatedSize: number, threshold = 50000): boolean => {
    return estimatedSize > threshold; // 50KB threshold
  },

  // Provide bundle optimization suggestions
  getOptimizationSuggestions: (): string[] => {
    const suggestions: string[] = [];

    // Check if running in development with potential optimizations
    if (process.env.NODE_ENV === "development") {
      suggestions.push("Run `pnpm build:analyze` to analyze bundle size");
      suggestions.push("Consider using dynamic imports for heavy components");
      suggestions.push("Check if all imported dependencies are actually used");
    }

    return suggestions;
  },
};

// Web Vitals integration
export const webVitalsMonitor = new PerformanceMonitor();

// Performance hooks for React components
export const usePerformanceMonitor = () => {
  return {
    getMetrics: () => webVitalsMonitor.getMetrics(),
    generateReport: () => webVitalsMonitor.generatePerformanceReport(),
    getBundleAnalysis: () => webVitalsMonitor.getBundleAnalysis(),
  };
};

// Utility to measure component render time
export const measureRenderTime = (componentName: string) => {
  const startTime = performance.now();

  return () => {
    const endTime = performance.now();
    const renderTime = endTime - startTime;

    if (renderTime > 50) {
      // Flag components taking >50ms to render
      console.warn(
        `🐌 Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`
      );
    }

    return renderTime;
  };
};

// Resource loading utilities
export const ResourceOptimizer = {
  // Preload critical resources
  preloadResource: (
    url: string,
    type: "script" | "style" | "image" = "script"
  ) => {
    if (typeof document === "undefined") return;

    const link = document.createElement("link");
    link.rel = "preload";
    link.href = url;
    link.as = type;
    document.head.appendChild(link);
  },

  // Prefetch resources for next navigation
  prefetchResource: (url: string) => {
    if (typeof document === "undefined") return;

    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = url;
    document.head.appendChild(link);
  },

  // Check if resource is already loaded
  isResourceLoaded: (url: string): boolean => {
    if (typeof document === "undefined") return false;

    const scripts = Array.from(document.querySelectorAll("script[src]"));
    const styles = Array.from(document.querySelectorAll("link[href]"));

    return [...scripts, ...styles].some((element) => {
      if (element.tagName === "SCRIPT") {
        return (element as HTMLScriptElement).src === url;
      }
      if (element.tagName === "LINK") {
        return (element as HTMLLinkElement).href === url;
      }
      return false;
    });
  },
};

export default webVitalsMonitor;
