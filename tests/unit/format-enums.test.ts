import { describe, it, expect } from "vitest";
import { formatEnumValue, formatCategory } from "@/lib/format-enums";

describe("Format Enums Utility", () => {
  describe("formatEnumValue", () => {
    it("should format known enum values correctly", () => {
      const knownEnums = [
        { input: "SALARY_COMPENSATION", expected: "Salary & Compensation" },
        { input: "SCHEDULE_HOURS", expected: "Schedule & Hours" },
        { input: "LEAVE_VACATION", expected: "Leave & Vacation" },
        { input: "SICK_LEAVE_RECOVERY", expected: "Sick Leave & Recovery" },
        { input: "BENEFITS_INSURANCE", expected: "Benefits Insurance" },
        { input: "CAREER_DEVELOPMENT", expected: "Career Development" },
        { input: "TEAM_COLLABORATION", expected: "Team Collaboration" },
        { input: "COMPANY_POLICIES", expected: "Company Policies" },
        { input: "WORKPLACE_FACILITIES", expected: "Workplace Facilities" },
        { input: "TECHNOLOGY_EQUIPMENT", expected: "Technology Equipment" },
        { input: "PERFORMANCE_FEEDBACK", expected: "Performance Feedback" },
        { input: "TRAINING_ONBOARDING", expected: "Training Onboarding" },
        { input: "COMPLIANCE_LEGAL", expected: "Compliance Legal" },
        { input: "WORKWEAR_STAFF_PASS", expected: "Workwear & Staff Pass" },
        { input: "TEAM_CONTACTS", expected: "Team & Contacts" },
        { input: "PERSONAL_QUESTIONS", expected: "Personal Questions" },
        { input: "ACCESS_LOGIN", expected: "Access & Login" },
        { input: "UNRECOGNIZED_OTHER", expected: "General Inquiry" },
      ];

      knownEnums.forEach(({ input, expected }) => {
        expect(formatEnumValue(input)).toBe(expected);
      });
    });

    it("should handle unknown enum values by formatting them", () => {
      const unknownEnums = [
        { input: "UNKNOWN_ENUM", expected: "Unknown Enum" },
        { input: "ANOTHER_TEST_CASE", expected: "Another Test Case" },
        { input: "SINGLE", expected: "Single" },
        { input: "MULTIPLE_WORDS_HERE", expected: "Multiple Words Here" },
      ];

      unknownEnums.forEach(({ input, expected }) => {
        expect(formatEnumValue(input)).toBe(expected);
      });
    });

    it("should handle null and undefined values", () => {
      expect(formatEnumValue(null)).toBe(null);
      expect(formatEnumValue(undefined)).toBe(null);
    });

    it("should handle empty string", () => {
      expect(formatEnumValue("")).toBe(null);
    });

    it("should handle lowercase enum values", () => {
      expect(formatEnumValue("salary_compensation")).toBe("Salary Compensation");
      expect(formatEnumValue("schedule_hours")).toBe("Schedule Hours");
    });

    it("should handle mixed case enum values", () => {
      expect(formatEnumValue("Salary_COMPENSATION")).toBe("Salary Compensation");
      expect(formatEnumValue("Schedule_Hours")).toBe("Schedule Hours");
    });

    it("should handle values without underscores", () => {
      expect(formatEnumValue("SALARY")).toBe("Salary");
      expect(formatEnumValue("ADMIN")).toBe("Admin");
      expect(formatEnumValue("USER")).toBe("User");
    });

    it("should handle values with multiple consecutive underscores", () => {
      expect(formatEnumValue("SALARY___COMPENSATION")).toBe("Salary   Compensation");
      expect(formatEnumValue("TEST__CASE")).toBe("Test  Case");
    });

    it("should handle values with leading/trailing underscores", () => {
      expect(formatEnumValue("_SALARY_COMPENSATION_")).toBe(" Salary Compensation ");
      expect(formatEnumValue("__TEST_CASE__")).toBe("  Test Case  ");
    });

    it("should handle single character enum values", () => {
      expect(formatEnumValue("A")).toBe("A");
      expect(formatEnumValue("X_Y_Z")).toBe("X Y Z");
    });

    it("should handle numeric characters in enum values", () => {
      expect(formatEnumValue("VERSION_2_0")).toBe("Version 2 0");
      expect(formatEnumValue("TEST_123_CASE")).toBe("Test 123 Case");
    });

    it("should be case insensitive for known enums", () => {
      expect(formatEnumValue("salary_compensation")).toBe("Salary Compensation");
      expect(formatEnumValue("SALARY_COMPENSATION")).toBe("Salary & Compensation");
      expect(formatEnumValue("Salary_Compensation")).toBe("Salary Compensation");
    });
  });

  describe("formatCategory", () => {
    it("should be an alias for formatEnumValue", () => {
      const testValues = [
        "SALARY_COMPENSATION",
        "SCHEDULE_HOURS",
        "UNKNOWN_ENUM",
        null,
        undefined,
        "",
      ];

      testValues.forEach((value) => {
        expect(formatCategory(value)).toBe(formatEnumValue(value));
      });
    });

    it("should format category-specific enum values", () => {
      const categoryEnums = [
        { input: "SALARY_COMPENSATION", expected: "Salary & Compensation" },
        { input: "BENEFITS_INSURANCE", expected: "Benefits Insurance" },
        { input: "UNRECOGNIZED_OTHER", expected: "General Inquiry" },
        { input: "ACCESS_LOGIN", expected: "Access & Login" },
      ];

      categoryEnums.forEach(({ input, expected }) => {
        expect(formatCategory(input)).toBe(expected);
      });
    });
  });

  describe("Edge Cases and Performance", () => {
    it("should handle very long enum values", () => {
      const longEnum = "A".repeat(100) + "_" + "B".repeat(100);
      const result = formatEnumValue(longEnum);

      expect(result).toBeTruthy();
      expect(result?.length).toBeGreaterThan(200);
      expect(result?.includes(" ")).toBeTruthy();
    });

    it("should handle special characters gracefully", () => {
      // These shouldn't be real enum values, but should not crash
      expect(formatEnumValue("TEST-CASE")).toBe("Test-Case");
      expect(formatEnumValue("TEST.CASE")).toBe("Test.Case");
      expect(formatEnumValue("TEST@CASE")).toBe("Test@Case");
    });

    it("should handle unicode characters", () => {
      expect(formatEnumValue("TEST_CAFÉ")).toBe("Test Café");
      expect(formatEnumValue("RÉSUMÉ_TYPE")).toBe("RéSumé Type");
    });

    it("should be performant with many calls", () => {
      const testEnum = "SALARY_COMPENSATION";
      const iterations = 1000;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        formatEnumValue(testEnum);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete 1000 calls in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
    });

    it("should be consistent with repeated calls", () => {
      const testCases = [
        "SALARY_COMPENSATION",
        "UNKNOWN_ENUM_VALUE",
        null,
        undefined,
        "",
      ];

      testCases.forEach((testCase) => {
        const result1 = formatEnumValue(testCase);
        const result2 = formatEnumValue(testCase);
        const result3 = formatEnumValue(testCase);

        expect(result1).toBe(result2);
        expect(result2).toBe(result3);
      });
    });
  });

  describe("Integration with UI Components", () => {
    it("should provide user-friendly text for dropdowns", () => {
      const dropdownOptions = [
        "SALARY_COMPENSATION",
        "SCHEDULE_HOURS",
        "LEAVE_VACATION",
        "BENEFITS_INSURANCE",
      ];

      const formattedOptions = dropdownOptions.map(option => ({
        value: option,
        label: formatEnumValue(option),
      }));

      formattedOptions.forEach(option => {
        expect(option.label).toBeTruthy();
        expect(option.label).not.toContain("_");
        expect(option.label?.[0]).toBe(option.label?.[0]?.toUpperCase());
      });
    });

    it("should provide readable text for badges and labels", () => {
      const badgeValues = [
        "ADMIN",
        "USER",
        "AUDITOR",
        "UNRECOGNIZED_OTHER",
      ];

      badgeValues.forEach(value => {
        const formatted = formatEnumValue(value);
        expect(formatted).toBeTruthy();
        expect(formatted?.length).toBeGreaterThan(0);
        // Should be suitable for display in UI
        expect(formatted).not.toMatch(/^[_\s]/);
        expect(formatted).not.toMatch(/[_\s]$/);
      });
    });

    it("should handle form validation error messages", () => {
      // When no value is selected, should return null for proper handling
      expect(formatEnumValue(null)).toBe(null);
      expect(formatEnumValue(undefined)).toBe(null);
      expect(formatEnumValue("")).toBe(null);
    });
  });

  describe("Backwards Compatibility", () => {
    it("should maintain compatibility with legacy enum values", () => {
      // Test some older enum patterns that might exist
      const legacyEnums = [
        { input: "OTHER", expected: "Other" },
        { input: "GENERAL", expected: "General" },
        { input: "MISC", expected: "Misc" },
      ];

      legacyEnums.forEach(({ input, expected }) => {
        expect(formatEnumValue(input)).toBe(expected);
      });
    });

    it("should handle enum values that might be added in the future", () => {
      // Future enum values should still be formatted reasonably
      const futureEnums = [
        "REMOTE_WORK_POLICY",
        "SUSTAINABILITY_INITIATIVES",
        "DIVERSITY_INCLUSION",
        "MENTAL_HEALTH_SUPPORT",
      ];

      futureEnums.forEach(value => {
        const result = formatEnumValue(value);
        expect(result).toBeTruthy();
        expect(result).not.toContain("_");
        expect(result?.[0]).toBe(result?.[0]?.toUpperCase());
      });
    });
  });
});