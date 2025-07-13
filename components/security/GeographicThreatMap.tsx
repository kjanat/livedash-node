"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { COUNTRY_NAMES } from "../../lib/constants/countries";

interface GeographicThreatMapProps {
  geoDistribution: Record<string, number>;
  title?: string;
}

// Threat level configuration with colors
const THREAT_LEVELS = {
  high: { color: "destructive", bgColor: "bg-red-500" },
  medium: { color: "secondary", bgColor: "bg-yellow-500" },
  low: { color: "outline", bgColor: "bg-blue-500" },
  minimal: { color: "outline", bgColor: "bg-gray-400" },
} as const;

type ThreatLevel = keyof typeof THREAT_LEVELS;

export function GeographicThreatMap({
  geoDistribution,
  title = "Geographic Threat Distribution",
}: GeographicThreatMapProps) {
  // Calculate values once for efficiency
  const totalEvents = Object.values(geoDistribution).reduce(
    (sum, count) => sum + count,
    0
  );
  const maxEventCount = Math.max(...Object.values(geoDistribution));

  const sortedCountries = Object.entries(geoDistribution)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12);

  const getThreatLevel = (count: number, total: number): ThreatLevel => {
    const percentage = (count / total) * 100;
    if (percentage > 50) return "high";
    if (percentage > 20) return "medium";
    if (percentage > 5) return "low";
    return "minimal";
  };

  const getCountryName = (code: string) => {
    return COUNTRY_NAMES[code] || code;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Security events by country ({totalEvents} total events)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sortedCountries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No geographic data available</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedCountries.map(([countryCode, count]) => {
                const threatLevel = getThreatLevel(count, totalEvents);
                const percentage = ((count / totalEvents) * 100).toFixed(1);

                return (
                  <div
                    key={countryCode}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {getCountryName(countryCode)}
                        </span>
                        <Badge
                          variant={
                            THREAT_LEVELS[threatLevel].color as
                              | "default"
                              | "secondary"
                              | "destructive"
                              | "outline"
                          }
                          className="text-xs"
                        >
                          {threatLevel}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {count} events ({percentage}%)
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${THREAT_LEVELS[threatLevel].bgColor}`}
                          style={{
                            width: `${Math.min(100, (count / maxEventCount) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {Object.keys(geoDistribution).length > 12 && (
              <div className="text-center pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  And {Object.keys(geoDistribution).length - 12} more
                  countries...
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
