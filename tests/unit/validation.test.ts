import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  sessionFilterSchema,
  companySettingsSchema,
  userUpdateSchema,
  metricsQuerySchema,
  validateInput,
} from '../../lib/validation';

describe('Validation Schemas', () => {
  // Helper for password validation
  const validPassword = 'Password123!';
  const invalidPasswordShort = 'Pass1!';
  const invalidPasswordNoLower = 'PASSWORD123!';
  const invalidPasswordNoUpper = 'password123!';
  const invalidPasswordNoNumber = 'Password!!';
  const invalidPasswordNoSpecial = 'Password123';

  // Helper for email validation
  const validEmail = 'test@example.com';
  const invalidEmailFormat = 'test@example';
  const invalidEmailTooLong = 'a'.repeat(250) + '@example.com'; // 250 + 11 = 261 chars

  // Helper for company name validation
  const validCompanyName = 'My Company Inc.';
  const invalidCompanyNameEmpty = '';
  const invalidCompanyNameTooLong = 'A'.repeat(101);
  const invalidCompanyNameChars = 'My Company #$%';

  describe('registerSchema', () => {
    it('should validate a valid registration object', () => {
      const data = {
        email: validEmail,
        password: validPassword,
        company: validCompanyName,
      };
      expect(registerSchema.safeParse(data).success).toBe(true);
    });

    it('should invalidate an invalid email', () => {
      const data = {
        email: invalidEmailFormat,
        password: validPassword,
        company: validCompanyName,
      };
      expect(registerSchema.safeParse(data).success).toBe(false);
    });

    it('should invalidate an invalid password', () => {
      const data = {
        email: validEmail,
        password: invalidPasswordShort,
        company: validCompanyName,
      };
      expect(registerSchema.safeParse(data).success).toBe(false);
    });

    it('should invalidate an invalid company name', () => {
      const data = {
        email: validEmail,
        password: validPassword,
        company: invalidCompanyNameEmpty,
      };
      expect(registerSchema.safeParse(data).success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should validate a valid login object', () => {
      const data = {
        email: validEmail,
        password: validPassword,
      };
      expect(loginSchema.safeParse(data).success).toBe(true);
    });

    it('should invalidate an invalid email', () => {
      const data = {
        email: invalidEmailFormat,
        password: validPassword,
      };
      expect(loginSchema.safeParse(data).success).toBe(false);
    });

    it('should invalidate an empty password', () => {
      const data = {
        email: validEmail,
        password: '',
      };
      expect(loginSchema.safeParse(data).success).toBe(false);
    });
  });

  describe('forgotPasswordSchema', () => {
    it('should validate a valid email', () => {
      const data = { email: validEmail };
      expect(forgotPasswordSchema.safeParse(data).success).toBe(true);
    });

    it('should invalidate an invalid email', () => {
      const data = { email: invalidEmailFormat };
      expect(forgotPasswordSchema.safeParse(data).success).toBe(false);
    });
  });

  describe('resetPasswordSchema', () => {
    it('should validate a valid reset password object', () => {
      const data = {
        token: 'some-valid-token',
        password: validPassword,
      };
      expect(resetPasswordSchema.safeParse(data).success).toBe(true);
    });

    it('should invalidate an empty token', () => {
      const data = {
        token: '',
        password: validPassword,
      };
      expect(resetPasswordSchema.safeParse(data).success).toBe(false);
    });

    it('should invalidate an invalid password', () => {
      const data = {
        token: 'some-valid-token',
        password: invalidPasswordShort,
      };
      expect(resetPasswordSchema.safeParse(data).success).toBe(false);
    });
  });

  describe('sessionFilterSchema', () => {
    it('should validate a valid session filter object', () => {
      const data = {
        search: 'query',
        sentiment: 'POSITIVE',
        category: 'SCHEDULE_HOURS',
        startDate: '2023-01-01T00:00:00Z',
        endDate: '2023-01-31T23:59:59Z',
        page: 1,
        limit: 20,
      };
      expect(sessionFilterSchema.safeParse(data).success).toBe(true);
    });

    it('should validate with only optional fields', () => {
      const data = {};
      expect(sessionFilterSchema.safeParse(data).success).toBe(true);
    });

    it('should invalidate an invalid sentiment', () => {
      const data = { sentiment: 'INVALID' };
      expect(sessionFilterSchema.safeParse(data).success).toBe(false);
    });

    it('should invalidate an invalid category', () => {
      const data = { category: 'INVALID_CATEGORY' };
      expect(sessionFilterSchema.safeParse(data).success).toBe(false);
    });

    it('should invalidate an invalid date format', () => {
      const data = { startDate: '2023-01-01' }; // Missing time
      expect(sessionFilterSchema.safeParse(data).success).toBe(false);
    });

    it('should invalidate page less than 1', () => {
      const data = { page: 0 };
      expect(sessionFilterSchema.safeParse(data).success).toBe(false);
    });

    it('should invalidate limit greater than 100', () => {
      const data = { limit: 101 };
      expect(sessionFilterSchema.safeParse(data).success).toBe(false);
    });
  });

  describe('companySettingsSchema', () => {
    it('should validate a valid company settings object', () => {
      const data = {
        name: validCompanyName,
        csvUrl: 'http://example.com/data.csv',
        csvUsername: 'user',
        csvPassword: 'password',
        sentimentAlert: 0.5,
        dashboardOpts: { theme: 'dark' },
      };
      expect(companySettingsSchema.safeParse(data).success).toBe(true);
    });

    it('should invalidate an invalid CSV URL', () => {
      const data = {
        name: validCompanyName,
        csvUrl: 'invalid-url',
      };
      expect(companySettingsSchema.safeParse(data).success).toBe(false);
    });

    it('should invalidate an invalid company name', () => {
      const data = {
        name: invalidCompanyNameEmpty,
        csvUrl: 'http://example.com/data.csv',
      };
      expect(companySettingsSchema.safeParse(data).success).toBe(false);
    });

    it('should invalidate sentimentAlert out of range', () => {
      const data = {
        name: validCompanyName,
        csvUrl: 'http://example.com/data.csv',
        sentimentAlert: 1.1,
      };
      expect(companySettingsSchema.safeParse(data).success).toBe(false);
    });
  });

  describe('userUpdateSchema', () => {
    it('should validate a valid user update object with all fields', () => {
      const data = {
        email: validEmail,
        role: 'ADMIN',
        password: validPassword,
      };
      expect(userUpdateSchema.safeParse(data).success).toBe(true);
    });

    it('should validate a valid user update object with only email', () => {
      const data = { email: validEmail };
      expect(userUpdateSchema.safeParse(data).success).toBe(true);
    });

    it('should validate a valid user update object with only role', () => {
      const data = { role: 'USER' };
      expect(userUpdateSchema.safeParse(data).success).toBe(true);
    });

    it('should validate a valid user update object with only password', () => {
      const data = { password: validPassword };
      expect(userUpdateSchema.safeParse(data).success).toBe(true);
    });

    it('should invalidate an invalid email', () => {
      const data = { email: invalidEmailFormat };
      expect(userUpdateSchema.safeParse(data).success).toBe(false);
    });

    it('should invalidate an invalid role', () => {
      const data = { role: 'SUPERUSER' };
      expect(userUpdateSchema.safeParse(data).success).toBe(false);
    });

    it('should invalidate an invalid password', () => {
      const data = { password: invalidPasswordShort };
      expect(userUpdateSchema.safeParse(data).success).toBe(false);
    });
  });

  describe('metricsQuerySchema', () => {
    it('should validate a valid metrics query object', () => {
      const data = {
        startDate: '2023-01-01T00:00:00Z',
        endDate: '2023-01-31T23:59:59Z',
        companyId: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
      };
      expect(metricsQuerySchema.safeParse(data).success).toBe(true);
    });

    it('should validate with only optional fields', () => {
      const data = {};
      expect(metricsQuerySchema.safeParse(data).success).toBe(true);
    });

    it('should invalidate an invalid date format', () => {
      const data = { startDate: '2023-01-01' };
      expect(metricsQuerySchema.safeParse(data).success).toBe(false);
    });

    it('should invalidate an invalid companyId format', () => {
      const data = { companyId: 'invalid-uuid' };
      expect(metricsQuerySchema.safeParse(data).success).toBe(false);
    });
  });

  describe('validateInput', () => {
    const testSchema = registerSchema; // Using registerSchema for validateInput tests

    it('should return success true and data for valid input', () => {
      const data = {
        email: validEmail,
        password: validPassword,
        company: validCompanyName,
      };
      const result = validateInput(testSchema, data);
      expect(result.success).toBe(true);
      expect((result as any).data).toEqual(data);
    });

    it('should return success false and errors for invalid input', () => {
      const data = {
        email: invalidEmailFormat,
        password: invalidPasswordShort,
        company: invalidCompanyNameEmpty,
      };
      const result = validateInput(testSchema, data);
      expect(result.success).toBe(false);
      expect((result as any).errors).toEqual(expect.arrayContaining([
        'email: Invalid email format',
        'password: Password must be at least 12 characters long',
        'company: Company name is required',
      ]));
    });

    it('should handle non-ZodError errors gracefully', () => {
      const mockSchema = {
        parse: () => { throw new Error('Some unexpected error'); }
      } as any;
      const result = validateInput(mockSchema, {});
      expect(result.success).toBe(false);
      expect((result as any).errors).toEqual(['Invalid input']);
    });
  });
});
