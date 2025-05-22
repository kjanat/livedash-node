"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

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

// Default coordinates for commonly used countries (latitude, longitude)
const DEFAULT_COORDINATES: Record<string, [number, number]> = {
  US: [37.0902, -95.7129],
  GB: [55.3781, -3.436],
  DE: [51.1657, 10.4515],
  FR: [46.2276, 2.2137],
  CA: [56.1304, -106.3468],
  AU: [-25.2744, 133.7751],
  JP: [36.2048, 138.2529],
  BR: [-14.235, -51.9253],
  IN: [20.5937, 78.9629],
  ZA: [-30.5595, 22.9375],
  ES: [40.4637, -3.7492],
  NL: [52.1326, 5.2913],
  IT: [41.8719, 12.5674],
  SE: [60.1282, 18.6435],
  // Add more country coordinates as needed
};

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
    if (!isClient) return;

    try {
      // Generate CountryData array for the Map component
      const data: CountryData[] = Object.entries(countries)
        // Only include countries with known coordinates
        .filter(
          ([code]) => countryCoordinates[code] || DEFAULT_COORDINATES[code]
        )
        .map(([code, count]) => ({
          code,
          count,
          coordinates: countryCoordinates[code] ||
            DEFAULT_COORDINATES[code] || [0, 0],
        }));

      setCountryData(data);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error processing geographic data:", error);
      setCountryData([]);
    }
  }, [countries, countryCoordinates, isClient]);

  // Find the max count for scaling circles
  const maxCount = Math.max(...Object.values(countries), 1);

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
      <Map countryData={countryData} maxCount={maxCount} />
      <style jsx global>{`
        .leaflet-control-attribution {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
