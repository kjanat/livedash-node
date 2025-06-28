"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number | null | undefined;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label?: string;
    isPositive?: boolean;
  };
  variant?: "default" | "primary" | "success" | "warning" | "danger";
  isLoading?: boolean;
  className?: string;
}

export default function MetricCard({
  title,
  value,
  description,
  icon,
  trend,
  variant = "default",
  isLoading = false,
  className,
}: MetricCardProps) {
  if (isLoading) {
    return (
      <Card className={cn("relative overflow-hidden", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    );
  }

  const getVariantClasses = () => {
    switch (variant) {
      case "primary":
        return "border-primary/20 bg-linear-to-br from-primary/5 to-primary/10";
      case "success":
        return "border-green-200 bg-linear-to-br from-green-50 to-green-100 dark:border-green-800 dark:from-green-950 dark:to-green-900";
      case "warning":
        return "border-amber-200 bg-linear-to-br from-amber-50 to-amber-100 dark:border-amber-800 dark:from-amber-950 dark:to-amber-900";
      case "danger":
        return "border-red-200 bg-linear-to-br from-red-50 to-red-100 dark:border-red-800 dark:from-red-950 dark:to-red-900";
      default:
        return "border-border bg-linear-to-br from-card to-muted/20";
    }
  };

  const getIconClasses = () => {
    switch (variant) {
      case "primary":
        return "bg-primary/10 text-primary border-primary/20";
      case "success":
        return "bg-green-100 text-green-600 border-green-200 dark:bg-green-900 dark:text-green-400 dark:border-green-800";
      case "warning":
        return "bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900 dark:text-amber-400 dark:border-amber-800";
      case "danger":
        return "bg-red-100 text-red-600 border-red-200 dark:bg-red-900 dark:text-red-400 dark:border-red-800";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getTrendIcon = () => {
    if (!trend) return null;

    if (trend.value === 0) {
      return <Minus className="h-3 w-3" />;
    }

    return trend.isPositive !== false ? (
      <TrendingUp className="h-3 w-3" />
    ) : (
      <TrendingDown className="h-3 w-3" />
    );
  };

  const getTrendColor = () => {
    if (!trend || trend.value === 0) return "text-muted-foreground";
    return trend.isPositive !== false
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400";
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group",
        getVariantClasses(),
        className
      )}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-linear-to-br from-white/50 to-transparent dark:from-white/5 pointer-events-none" />

      <CardHeader className="pb-3 relative">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground leading-none">
              {title}
            </p>
            {description && (
              <p className="text-xs text-muted-foreground/80">{description}</p>
            )}
          </div>

          {icon && (
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all duration-300 group-hover:scale-110",
                getIconClasses()
              )}
            >
              <span className="text-lg transition-transform duration-300 group-hover:scale-110">
                {icon}
              </span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative">
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <p className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-foreground to-foreground/80">
              {value ?? "—"}
            </p>

            {trend && (
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs font-medium px-2 py-0.5 gap-1",
                  getTrendColor(),
                  "bg-background/50 border-current/20"
                )}
              >
                {getTrendIcon()}
                {Math.abs(trend.value).toFixed(1)}%
                {trend.label && ` ${trend.label}`}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
