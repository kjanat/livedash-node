/**
 * Utility functions for formatting database enums into user-friendly text
 */

// Custom mappings for specific enum values that need special formatting
const ENUM_MAPPINGS: Record<string, string> = {
  // HR/Employment related
  'SALARY_COMPENSATION': 'Salary & Compensation',
  'CONTRACT_HOURS': 'Contract & Hours',
  'SCHEDULE_HOURS': 'Schedule & Hours',
  'LEAVE_VACATION': 'Leave & Vacation',
  'SICK_LEAVE_RECOVERY': 'Sick Leave & Recovery',
  'WORKWEAR_STAFF_PASS': 'Workwear & Staff Pass',
  'TEAM_CONTACTS': 'Team & Contacts',
  'PERSONAL_QUESTIONS': 'Personal Questions',
  'PERSONALQUESTIONS': 'Personal Questions',
  
  // Process related
  'ONBOARDING': 'Onboarding',
  'OFFBOARDING': 'Offboarding',
  
  // Access related
  'ACCESS_LOGIN': 'Access & Login',
  
  // Technical/Other
  'UNRECOGNIZED_OTHER': 'General Inquiry',
  
  // Add more mappings as needed
};

/**
 * Formats a database enum value into user-friendly text
 * @param enumValue - The raw enum value from the database
 * @returns Formatted string or null if input is empty
 */
export function formatEnumValue(enumValue: string | null | undefined): string | null {
  if (!enumValue) return null;
  
  // Check for custom mapping first
  if (ENUM_MAPPINGS[enumValue]) {
    return ENUM_MAPPINGS[enumValue];
  }
  
  // Fallback: convert snake_case to Title Case
  return enumValue
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Formats a category enum specifically for display
 * @param category - The category enum value
 * @returns Formatted category name or null if empty
 */
export function formatCategory(category: string | null | undefined): string | null {
  return formatEnumValue(category);
}

/**
 * Formats an array of enum values into user-friendly text
 * @param enumValues - Array of enum values
 * @returns Array of formatted values (filters out null/undefined)
 */
export function formatEnumArray(enumValues: (string | null | undefined)[]): string[] {
  return enumValues
    .map(value => formatEnumValue(value))
    .filter((value): value is string => Boolean(value));
}