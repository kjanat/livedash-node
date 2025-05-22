"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import countryLookup from "country-code-lookup";

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

// Get country coordinates from the country-code-lookup package
const getCountryCoordinates = (): Record<string, [number, number]> => {
  // Initialize with some fallback coordinates for common countries that might be missing
  const coordinates: Record<string, [number, number]> = {
    // These are just in case the lookup fails for common countries
    US: [37.0902, -95.7129],
    GB: [55.3781, -3.436],
    BA: [43.9159, 17.6791],
  };

  try {
    // Get all countries from the package
    const allCountries = countryLookup.countries;

    // Map through all countries and extract coordinates
    allCountries.forEach((country) => {
      if (country.iso2 && country.latitude && country.longitude) {
        coordinates[country.iso2] = [
          parseFloat(country.latitude),
          parseFloat(country.longitude),
        ];
      }
    });

    return coordinates;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error loading country coordinates:", error);
    return coordinates;
  }
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
        // Only include countries with known coordinates
        .filter(([code]) => {
          // If no coordinates found, log to help with debugging
          if (!countryCoordinates[code] && !DEFAULT_COORDINATES[code]) {
            // eslint-disable-next-line no-console
            console.warn(`Missing coordinates for country code: ${code}`);
            return false;
          }
          return true;
        })
        .map(([code, count]) => ({
          code,
          count,
          coordinates: countryCoordinates[code] ||
            DEFAULT_COORDINATES[code] || [0, 0],
        }));

      // Log for debugging
      // eslint-disable-next-line no-console
      console.log(
        `Found ${data.length} countries with coordinates out of ${Object.keys(countries).length} total countries`
      );

      setCountryData(data);
    } catch (error) {
      // eslint-disable-next-line no-console
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
