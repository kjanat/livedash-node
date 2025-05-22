"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
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

// Get country coordinates from the @rapideditor/country-coder package
const getCountryCoordinates = (): Record<string, [number, number]> => {
  // Initialize with some fallback coordinates for common countries
  const coordinates: Record<string, [number, number]> = {
    US: [37.0902, -95.7129],
    GB: [55.3781, -3.436],
    BA: [43.9159, 17.6791],
  };
  // This function now primarily returns fallbacks.
  // The actual fetching using @rapideditor/country-coder will be in the component's useEffect.
  return coordinates;
};

// Load coordinates once when module is imported
const DEFAULT_COORDINATES = getCountryCoordinates();

// Dynamically import the Map component to avoid SSR issues
// This ensures the component only loads on the client side
const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-gray-100 flex items-center justify-center">
      Loading map...
    </div>
  ),
});

export default function GeographicMap({
  countries,
  countryCoordinates = DEFAULT_COORDINATES,
  height = 400,
}: GeographicMapProps) {
  const [countryData, setCountryData] = useState<CountryData[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Set client-side flag on component mount
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Process country data when client is ready and dependencies change
  useEffect(() => {
    if (!isClient || !countries) return;

    try {
      // Generate CountryData array for the Map component
      const data: CountryData[] = Object.entries(countries || {})
        .map(([code, count]) => {
          let countryCoords: [number, number] | undefined =
            countryCoordinates[code] || DEFAULT_COORDINATES[code];

          if (!countryCoords) {
            const feature = countryCoder.feature(code);
            if (feature && feature.geometry) {
              if (feature.geometry.type === "Point") {
                const [lon, lat] = feature.geometry.coordinates;
                countryCoords = [lat, lon]; // Leaflet expects [lat, lon]
              } else if (
                feature.geometry.type === "Polygon" &&
                feature.geometry.coordinates &&
                feature.geometry.coordinates[0] &&
                feature.geometry.coordinates[0][0]
              ) {
                // For Polygons, use the first coordinate of the first ring as a fallback representative point
                const [lon, lat] = feature.geometry.coordinates[0][0];
                countryCoords = [lat, lon]; // Leaflet expects [lat, lon]
              } else if (
                feature.geometry.type === "MultiPolygon" &&
                feature.geometry.coordinates &&
                feature.geometry.coordinates[0] &&
                feature.geometry.coordinates[0][0] &&
                feature.geometry.coordinates[0][0][0]
              ) {
                // For MultiPolygons, use the first coordinate of the first ring of the first polygon
                const [lon, lat] = feature.geometry.coordinates[0][0][0];
                countryCoords = [lat, lon]; // Leaflet expects [lat, lon]
              }
            }
          }

          if (countryCoords) {
            return {
              code,
              count,
              coordinates: countryCoords,
            };
          }
          return null; // Skip if no coordinates found
        })
        .filter((item): item is CountryData => item !== null);

      console.log(
        `Found ${data.length} countries with coordinates out of ${Object.keys(countries).length} total countries`
      );

      setCountryData(data);
    } catch (error) {
      console.error("Error processing geographic data:", error);
      setCountryData([]);
    }
  }, [countries, countryCoordinates, isClient]);

  // Find the max count for scaling circles - handle empty or null countries object
  const countryValues = countries ? Object.values(countries) : [];
  const maxCount = countryValues.length > 0 ? Math.max(...countryValues, 1) : 1;

  // Show loading state during SSR or until client-side rendering takes over
  if (!isClient) {
    return (
      <div className="h-full w-full bg-gray-100 flex items-center justify-center">
        Loading map...
      </div>
    );
  }

  return (
    <div style={{ height: `${height}px`, width: "100%" }} className="relative">
      {countryData.length > 0 ? (
        <Map countryData={countryData} maxCount={maxCount} />
      ) : (
        <div className="h-full w-full bg-gray-100 flex items-center justify-center text-gray-500">
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
