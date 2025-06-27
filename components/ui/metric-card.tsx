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
        return "border border-blue-100 bg-white shadow-sm hover:shadow-md";
      case "success":
        return "border border-green-100 bg-white shadow-sm hover:shadow-md";
      case "warning":
        return "border border-pink-100 bg-white shadow-sm hover:shadow-md";
      case "danger":
        return "border border-red-100 bg-white shadow-sm hover:shadow-md";
      default:
        return "border border-gray-100 bg-white shadow-sm hover:shadow-md";
    }
  };

  const getIconClasses = () => {
    return "bg-gray-50 text-gray-900 border-gray-100";
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
    return trend.isPositive !== false ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
  };

  return (
    <Card 
      className={cn(
        "relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5",
        getVariantClasses(),
        className
      )}
    >
      
      <CardHeader className="pb-3 relative">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-900 leading-none">
              {title}
            </p>
            {description && (
              <p className="text-xs text-muted-foreground/80">
                {description}
              </p>
            )}
          </div>

          {icon && (
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors",
                getIconClasses()
              )}
            >
              <span className="text-lg">{icon}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative">
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <p className="text-2xl font-bold tracking-tight text-gray-900">
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
