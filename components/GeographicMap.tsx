"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";
import * as countryCoder from "@rapideditor/country-coder";

// Define types for country data
interface CountryData {
  code: string;
  count: number;
  coordinates: [number, number]; // Latitude and longitude
}

interface GeographicMapProps {
  countries: Record<string, number>; // Country code to count mapping
  countryCoordinates?: Record<string, [number, number]>; // Optional custom coordinates
  height?: number; // Optional height for the container
}

/**
 * Get coordinates for a country using the country-coder library
 * This automatically extracts coordinates from the country geometry
 */
function getCoordinatesFromCountryCoder(
  countryCode: string
): [number, number] | undefined {
  try {
    const feature = countryCoder.feature(countryCode);
    if (!feature?.geometry) {
      return undefined;
    }

    // Extract center coordinates from the geometry
    if (feature.geometry.type === "Point") {
      const [lon, lat] = feature.geometry.coordinates;
      return [lat, lon]; // Leaflet expects [lat, lon]
    }

    if (
      feature.geometry.type === "Polygon" &&
      feature.geometry.coordinates?.[0]?.[0]
    ) {
      // For polygons, calculate centroid from the first ring
      const coordinates = feature.geometry.coordinates[0];
      let lat = 0;
      let lon = 0;
      for (const [lng, ltd] of coordinates) {
        lon += lng;
        lat += ltd;
      }
      return [lat / coordinates.length, lon / coordinates.length];
    }

    if (
      feature.geometry.type === "MultiPolygon" &&
      feature.geometry.coordinates?.[0]?.[0]?.[0]
    ) {
      // For multipolygons, use the first polygon's first ring for centroid
      const coordinates = feature.geometry.coordinates[0][0];
      let lat = 0;
      let lon = 0;
      for (const [lng, ltd] of coordinates) {
        lon += lng;
        lat += ltd;
      }
      return [lat / coordinates.length, lon / coordinates.length];
    }

    return undefined;
  } catch (error) {
    console.warn(
      `Failed to get coordinates for country ${countryCode}:`,
      error
    );
    return undefined;
  }
}

// Dynamically import the Map component to avoid SSR issues
// This ensures the component only loads on the client side
const CountryMapComponent = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-muted flex items-center justify-center text-muted-foreground">
      Loading map...
    </div>
  ),
});

export default function GeographicMap({
  countries,
  countryCoordinates = {},
  height = 400,
}: GeographicMapProps) {
  const [countryData, setCountryData] = useState<CountryData[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Set client-side flag on component mount
  useEffect(() => {
    setIsClient(true);
  }, []);

  /**
   * Get coordinates for a country code
   */
  const getCountryCoordinates = useCallback(
    (
      code: string,
      countryCoordinates: Record<string, [number, number]>
    ): [number, number] | undefined => {
      // Try custom coordinates first (allows overrides)
      let coords: [number, number] | undefined = countryCoordinates[code];

      if (!coords) {
        // Automatically get coordinates from country-coder library
        coords = getCoordinatesFromCountryCoder(code);
      }

      return coords;
    },
    []
  );

  /**
   * Process a single country entry into CountryData
   */
  const processCountryEntry = useCallback(
    (
      code: string,
      count: number,
      countryCoordinates: Record<string, [number, number]>
    ): CountryData | null => {
      const coordinates = getCountryCoordinates(code, countryCoordinates);

      if (coordinates) {
        return { code, count, coordinates };
      }

      return null; // Skip if no coordinates found
    },
    [getCountryCoordinates]
  );

  /**
   * Process all countries data into CountryData array
   */
  const processCountriesData = useCallback(
    (
      countries: Record<string, number>,
      countryCoordinates: Record<string, [number, number]>
    ): CountryData[] => {
      const data = Object.entries(countries || {})
        .map(([code, count]) =>
          processCountryEntry(code, count, countryCoordinates)
        )
        .filter((item): item is CountryData => item !== null);

      console.log(
        `Found ${data.length} countries with coordinates out of ${Object.keys(countries).length} total countries`
      );

      return data;
    },
    [processCountryEntry]
  );

  // Process country data when client is ready and dependencies change
  useEffect(() => {
    if (!isClient || !countries) return;

    try {
      const data = processCountriesData(countries, countryCoordinates);
      setCountryData(data);
    } catch (error) {
      console.error("Error processing geographic data:", error);
      setCountryData([]);
    }
  }, [countries, countryCoordinates, isClient, processCountriesData]);

  // Find the max count for scaling circles - handle empty or null countries object
  const countryValues = countries ? Object.values(countries) : [];
  const maxCount = countryValues.length > 0 ? Math.max(...countryValues, 1) : 1;

  // Show loading state during SSR or until client-side rendering takes over
  if (!isClient) {
    return (
      <div className="h-full w-full bg-muted flex items-center justify-center text-muted-foreground">
        Loading map...
      </div>
    );
  }

  return (
    <div style={{ height: `${height}px`, width: "100%" }} className="relative">
      {countryData.length > 0 ? (
        <CountryMapComponent countryData={countryData} maxCount={maxCount} />
      ) : (
        <div className="h-full w-full bg-muted flex items-center justify-center text-muted-foreground">
          No geographic data available
        </div>
      )}
      <style jsx global>{`
        .leaflet-control-attribution {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
