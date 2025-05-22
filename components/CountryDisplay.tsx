"use client";

import { useEffect, useState } from "react";
import { getLocalizedCountryName } from "../lib/localization";

interface CountryDisplayProps {
  countryCode: string | null | undefined;
  className?: string;
}

/**
 * Component to display a country name from its ISO 3166-1 alpha-2 code
 * Uses Intl.DisplayNames API when available, falls back to the code
 */
export default function CountryDisplay({
  countryCode,
  className,
}: CountryDisplayProps) {
  const [countryName, setCountryName] = useState<string>(
    countryCode || "Unknown"
  );

  useEffect(() => {
    // Only run in the browser and if we have a valid code
    if (typeof window !== "undefined" && countryCode) {
      setCountryName(getLocalizedCountryName(countryCode));
    }
  }, [countryCode]);

  return <span className={className}>{countryName}</span>;
}
