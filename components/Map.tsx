"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { getLocalizedCountryName } from "../lib/localization";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface CountryData {
  code: string;
  count: number;
  coordinates: [number, number];
}

interface MapProps {
  countryData: CountryData[];
  maxCount: number;
}

const Map = ({ countryData, maxCount }: MapProps) => {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return <div className="h-full w-full bg-muted animate-pulse rounded-lg" />;
  }

  const isDark = theme === "dark";

  // Use different tile layers based on theme
  const tileLayerUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  const tileLayerAttribution = isDark
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  return (
    <MapContainer
      center={[30, 0]}
      zoom={2}
      zoomControl={true}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%", borderRadius: "0.5rem" }}
    >
      <TileLayer attribution={tileLayerAttribution} url={tileLayerUrl} />
      {countryData.map((country) => (
        <CircleMarker
          key={country.code}
          center={country.coordinates}
          radius={5 + (country.count / maxCount) * 20}
          pathOptions={{
            fillColor: "hsl(var(--primary))",
            color: "hsl(var(--primary))",
            weight: 2,
            opacity: 0.9,
            fillOpacity: 0.6,
          }}
        >
          <Tooltip>
            <div className="p-2 bg-background border border-border rounded-md shadow-md">
              <div className="font-medium text-foreground">
                {getLocalizedCountryName(country.code)}
              </div>
              <div className="text-sm text-muted-foreground">
                Sessions: {country.count}
              </div>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
};

export default Map;
