"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface GeographicThreatMapProps {
  geoDistribution: Record<string, number>;
  title?: string;
}

// Simple country code to name mapping for common countries
const countryNames: Record<string, string> = {
  USA: "United States",
  GBR: "United Kingdom",
  DEU: "Germany",
  FRA: "France",
  JPN: "Japan",
  CHN: "China",
  IND: "India",
  BRA: "Brazil",
  CAN: "Canada",
  AUS: "Australia",
  RUS: "Russia",
  ESP: "Spain",
  ITA: "Italy",
  NLD: "Netherlands",
  KOR: "South Korea",
  MEX: "Mexico",
  CHE: "Switzerland",
  SWE: "Sweden",
  NOR: "Norway",
  DNK: "Denmark",
  FIN: "Finland",
  POL: "Poland",
  BEL: "Belgium",
  AUT: "Austria",
  NZL: "New Zealand",
  SGP: "Singapore",
  THA: "Thailand",
  IDN: "Indonesia",
  MYS: "Malaysia",
  PHL: "Philippines",
  VNM: "Vietnam",
  ARE: "UAE",
  SAU: "Saudi Arabia",
  ISR: "Israel",
  ZAF: "South Africa",
  EGY: "Egypt",
  TUR: "Turkey",
  GRC: "Greece",
  PRT: "Portugal",
  CZE: "Czech Republic",
  HUN: "Hungary",
  ROU: "Romania",
  BGR: "Bulgaria",
  HRV: "Croatia",
  SVN: "Slovenia",
  SVK: "Slovakia",
  EST: "Estonia",
  LVA: "Latvia",
  LTU: "Lithuania",
  LUX: "Luxembourg",
  MLT: "Malta",
  CYP: "Cyprus",
  ISL: "Iceland",
  IRL: "Ireland",
  ARG: "Argentina",
  CHL: "Chile",
  COL: "Colombia",
  PER: "Peru",
  URY: "Uruguay",
  ECU: "Ecuador",
  BOL: "Bolivia",
  PRY: "Paraguay",
  VEN: "Venezuela",
  UKR: "Ukraine",
  BLR: "Belarus",
  MDA: "Moldova",
  GEO: "Georgia",
  ARM: "Armenia",
  AZE: "Azerbaijan",
  KAZ: "Kazakhstan",
  UZB: "Uzbekistan",
  KGZ: "Kyrgyzstan",
  TJK: "Tajikistan",
  TKM: "Turkmenistan",
  MNG: "Mongolia",
};

export function GeographicThreatMap({
  geoDistribution,
  title = "Geographic Threat Distribution",
}: GeographicThreatMapProps) {
  const sortedCountries = Object.entries(geoDistribution)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12);

  const totalEvents = Object.values(geoDistribution).reduce(
    (sum, count) => sum + count,
    0
  );

  const getThreatLevel = (count: number, total: number) => {
    const percentage = (count / total) * 100;
    if (percentage > 50) return { level: "high", color: "destructive" };
    if (percentage > 20) return { level: "medium", color: "secondary" };
    if (percentage > 5) return { level: "low", color: "outline" };
    return { level: "minimal", color: "outline" };
  };

  const getCountryName = (code: string) => {
    return countryNames[code] || code;
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
                const threat = getThreatLevel(count, totalEvents);
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
                          variant={threat.color as "default" | "secondary" | "destructive" | "outline"}
                          className="text-xs"
                        >
                          {threat.level}
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
                          className={`h-2 rounded-full ${
                            threat.level === "high"
                              ? "bg-red-500"
                              : threat.level === "medium"
                                ? "bg-yellow-500"
                                : threat.level === "low"
                                  ? "bg-blue-500"
                                  : "bg-gray-400"
                          }`}
                          style={{
                            width: `${Math.min(100, (count / Math.max(...Object.values(geoDistribution))) * 100)}%`,
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
