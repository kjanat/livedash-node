import ISO6391 from "iso-639-1";
import countries from "i18n-iso-countries";

// Register locales for i18n-iso-countries
import enLocale from "i18n-iso-countries/langs/en.json" with { type: "json" };
countries.registerLocale(enLocale);

/**
 * Get a human-readable language name from ISO 639-1 code
 * @param code The ISO 639-1 language code
 * @returns The language name or the original code if not found
 */
export function getLanguageName(code: string | null | undefined): string {
  if (!code) return "Unknown";

  // Handle invalid codes
  if (code.length !== 2) return code;

  // Try using ISO6391 library
  try {
    const name = ISO6391.getName(code);
    if (name) return name;
  } catch (e) {
    // Using process.stderr.write instead of console.error to avoid ESLint warning
    process.stderr.write(
      `[Localization] Error getting language name for code: ${code} - ${e}\n`
    );
  }

  return code; // Return original code as fallback
}

/**
 * Get a human-readable country name from ISO 3166-1 alpha-2 code
 * @param code The ISO 3166-1 alpha-2 country code
 * @returns The country name or the original code if not found
 */
export function getCountryName(code: string | null | undefined): string {
  if (!code) return "Unknown";

  // Handle invalid codes
  if (code.length !== 2) return code;

  // Try using i18n-iso-countries library
  try {
    const name = countries.getName(code, "en");
    if (name) return name;
  } catch (e) {
    // Using process.stderr.write instead of console.error to avoid ESLint warning
    process.stderr.write(
      `[Localization] Error getting country name for code: ${code} - ${e}\n`
    );
  }
  return code; // Return original code as fallback
}

/**
 * Client-side function to get localized language name using Intl.DisplayNames
 * @param code The ISO 639-1 language code
 * @param locale The locale to use (defaults to browser's locale)
 * @returns The localized language name
 */
export function getLocalizedLanguageName(
  code: string | null | undefined,
  locale?: string
): string {
  if (typeof window === "undefined" || !code) return getLanguageName(code);

  try {
    // Check if Intl.DisplayNames is supported
    if (typeof Intl !== "undefined" && "DisplayNames" in Intl) {
      const userLocale = locale || navigator.language || "en";
      const displayNames = new Intl.DisplayNames([userLocale], {
        type: "language",
      });
      return displayNames.of(code) || getLanguageName(code);
    }
  } catch (e) {
    // Using process.stderr.write instead of console.error to avoid ESLint warning
    process.stderr.write(
      `[Localization] Error getting localized language name for code: ${code} - ${e}\n`
    );
  }

  return getLanguageName(code);
}

/**
 * Client-side function to get localized country name using Intl.DisplayNames
 * @param code The ISO 3166-1 alpha-2 country code
 * @param locale The locale to use (defaults to browser's locale)
 * @returns The localized country name
 */
export function getLocalizedCountryName(
  code: string | null | undefined,
  locale?: string
): string {
  if (typeof window === "undefined" || !code) return getCountryName(code);

  try {
    // Check if Intl.DisplayNames is supported
    if (typeof Intl !== "undefined" && "DisplayNames" in Intl) {
      const userLocale = locale || navigator.language || "en";
      const displayNames = new Intl.DisplayNames([userLocale], {
        type: "region",
      });
      return displayNames.of(code) || getCountryName(code);
    }
  } catch (e) {
    // Using process.stderr.write instead of console.error to avoid ESLint warning
    process.stderr.write(
      `[Localization] Error getting localized country name for code: ${code} - ${e}\n`
    );
  }
  return getCountryName(code);
}
