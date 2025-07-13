"use client";

import { AlertCircle, AlertTriangle, Shield, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ThreatLevelIndicatorProps {
  level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  score?: number;
  size?: "sm" | "md" | "lg";
}

export function ThreatLevelIndicator({
  level,
  score,
  size = "md",
}: ThreatLevelIndicatorProps) {
  const getConfig = (threatLevel: string) => {
    switch (threatLevel) {
      case "CRITICAL":
        return {
          color: "destructive",
          bgColor: "bg-red-500",
          icon: Zap,
          text: "Critical Threat",
          description: "Immediate action required",
        };
      case "HIGH":
        return {
          color: "destructive",
          bgColor: "bg-orange-500",
          icon: AlertCircle,
          text: "High Threat",
          description: "Urgent attention needed",
        };
      case "MODERATE":
        return {
          color: "secondary",
          bgColor: "bg-yellow-500",
          icon: AlertTriangle,
          text: "Moderate Threat",
          description: "Monitor closely",
        };
      default:
        return {
          color: "outline",
          bgColor: "bg-green-500",
          icon: Shield,
          text: "Low Threat",
          description: "System is secure",
        };
    }
  };

  const config = getConfig(level);
  const Icon = config.icon;

  const sizeClasses = {
    sm: { icon: "h-4 w-4", text: "text-sm", badge: "text-xs" },
    md: { icon: "h-5 w-5", text: "text-base", badge: "text-sm" },
    lg: { icon: "h-6 w-6", text: "text-lg", badge: "text-base" },
  };

  const classes = sizeClasses[size];

  return (
    <div className="flex items-center gap-2">
      <div className={`p-2 rounded-full ${config.bgColor}`}>
        <Icon className={`${classes.icon} text-white`} />
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge
            variant={
              config.color as
                | "default"
                | "secondary"
                | "destructive"
                | "outline"
            }
            className={classes.badge}
          >
            {config.text}
          </Badge>
          {score !== undefined && (
            <span className={`font-medium ${classes.text}`}>{score}/100</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{config.description}</p>
      </div>
    </div>
  );
}
