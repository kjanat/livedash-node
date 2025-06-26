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
    NL: [52.1326, 5.2913],
    DE: [51.1657, 10.4515],
    FR: [46.6034, 1.8883],
    IT: [41.8719, 12.5674],
    ES: [40.4637, -3.7492],
    CA: [56.1304, -106.3468],
    PL: [51.9194, 19.1451],
    SE: [60.1282, 18.6435],
    NO: [60.472, 8.4689],
    FI: [61.9241, 25.7482],
    CH: [46.8182, 8.2275],
    AT: [47.5162, 14.5501],
    BE: [50.8503, 4.3517],
    DK: [56.2639, 9.5018],
    CZ: [49.8175, 15.473],
    HU: [47.1625, 19.5033],
    PT: [39.3999, -8.2245],
    GR: [39.0742, 21.8243],
    RO: [45.9432, 24.9668],
    IE: [53.4129, -8.2439],
    BG: [42.7339, 25.4858],
    HR: [45.1, 15.2],
    SK: [48.669, 19.699],
    SI: [46.1512, 14.9955],
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
