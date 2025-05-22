"use client";

import { useEffect, useState } from "react";
import { getLocalizedLanguageName } from "../lib/localization";

interface LanguageDisplayProps {
  languageCode: string | null | undefined;
  className?: string;
}

/**
 * Component to display a language name from its ISO 639-1 code
 * Uses Intl.DisplayNames API when available, falls back to the code
 */
export default function LanguageDisplay({
  languageCode,
  className,
}: LanguageDisplayProps) {
  const [languageName, setLanguageName] = useState<string>(
    languageCode || "Unknown"
  );

  useEffect(() => {
    // Only run in the browser and if we have a valid code
    if (typeof window !== "undefined" && languageCode) {
      setLanguageName(getLocalizedLanguageName(languageCode));
    }
  }, [languageCode]);

  return <span className={className}>{languageName}</span>;
}
