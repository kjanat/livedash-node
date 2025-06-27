// Unit tests for environment management
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Environment Management', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.resetModules();
  });

  describe('env object', () => {
    it('should have default values when environment variables are not set', async () => {
      // Clear relevant env vars
      delete process.env.NEXTAUTH_URL;
      delete process.env.SCHEDULER_ENABLED;
      delete process.env.PORT;

      // Re-import to get fresh env object
      vi.resetModules();
      const { env: freshEnv } = await import('../../lib/env');

      expect(freshEnv.NEXTAUTH_URL).toBe('http://localhost:3000');
      expect(freshEnv.SCHEDULER_ENABLED).toBe(false);
      expect(freshEnv.PORT).toBe(3000);
    });

    it('should use environment variables when set', async () => {
      process.env.NEXTAUTH_URL = 'https://example.com';
      process.env.SCHEDULER_ENABLED = 'true';
      process.env.PORT = '8080';

      vi.resetModules();
      const { env: freshEnv } = await import('../../lib/env');

      expect(freshEnv.NEXTAUTH_URL).toBe('https://example.com');
      expect(freshEnv.SCHEDULER_ENABLED).toBe(true);
      expect(freshEnv.PORT).toBe(8080);
    });

    it('should parse numeric environment variables correctly', async () => {
      process.env.IMPORT_PROCESSING_BATCH_SIZE = '100';
      process.env.SESSION_PROCESSING_CONCURRENCY = '10';

      vi.resetModules();
      const { env: freshEnv } = await import('../../lib/env');

      expect(freshEnv.IMPORT_PROCESSING_BATCH_SIZE).toBe(100);
      expect(freshEnv.SESSION_PROCESSING_CONCURRENCY).toBe(10);
    });

    it('should handle invalid numeric values gracefully', async () => {
      process.env.IMPORT_PROCESSING_BATCH_SIZE = 'invalid';
      process.env.SESSION_PROCESSING_CONCURRENCY = '';

      vi.resetModules();
      const { env: freshEnv } = await import('../../lib/env');

      expect(freshEnv.IMPORT_PROCESSING_BATCH_SIZE).toBe(50); // default
      expect(freshEnv.SESSION_PROCESSING_CONCURRENCY).toBe(5); // default
    });
  });

  describe('validateEnv', () => {
    it('should return valid when all required variables are set', async () => {
      vi.stubEnv('NEXTAUTH_SECRET', 'test-secret');
      vi.stubEnv('OPENAI_API_KEY', 'test-key');
      vi.stubEnv('NODE_ENV', 'production');

      vi.resetModules();
      const { validateEnv: freshValidateEnv } = await import('../../lib/env');

      const result = freshValidateEnv();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid when NEXTAUTH_SECRET is missing', async () => {
      vi.stubEnv('NEXTAUTH_SECRET', '');

      vi.resetModules();
      const { validateEnv: freshValidateEnv } = await import('../../lib/env');

      const result = freshValidateEnv();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('NEXTAUTH_SECRET is required');
    });

    it('should require OPENAI_API_KEY in production', async () => {
      vi.stubEnv('NEXTAUTH_SECRET', 'test-secret');
      vi.stubEnv('OPENAI_API_KEY', '');
      vi.stubEnv('NODE_ENV', 'production');

      vi.resetModules();
      const { validateEnv: freshValidateEnv } = await import('../../lib/env');

      const result = freshValidateEnv();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('OPENAI_API_KEY is required in production');
    });

    it('should not require OPENAI_API_KEY in development', async () => {
      vi.stubEnv('NEXTAUTH_SECRET', 'test-secret');
      vi.stubEnv('OPENAI_API_KEY', '');
      vi.stubEnv('NODE_ENV', 'development');

      vi.resetModules();
      const { validateEnv: freshValidateEnv } = await import('../../lib/env');

      const result = freshValidateEnv();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getSchedulerConfig', () => {
    it('should return correct scheduler configuration', async () => {
      process.env.SCHEDULER_ENABLED = 'true';
      process.env.CSV_IMPORT_INTERVAL = '*/10 * * * *';
      process.env.IMPORT_PROCESSING_INTERVAL = '*/3 * * * *';
      process.env.IMPORT_PROCESSING_BATCH_SIZE = '25';
      process.env.SESSION_PROCESSING_INTERVAL = '0 2 * * *';
      process.env.SESSION_PROCESSING_BATCH_SIZE = '100';
      process.env.SESSION_PROCESSING_CONCURRENCY = '8';

      vi.resetModules();
      const { getSchedulerConfig: freshGetSchedulerConfig } = await import('../../lib/env');

      const config = freshGetSchedulerConfig();

      expect(config.enabled).toBe(true);
      expect(config.csvImport.interval).toBe('*/10 * * * *');
      expect(config.importProcessing.interval).toBe('*/3 * * * *');
      expect(config.importProcessing.batchSize).toBe(25);
      expect(config.sessionProcessing.interval).toBe('0 2 * * *');
      expect(config.sessionProcessing.batchSize).toBe(100);
      expect(config.sessionProcessing.concurrency).toBe(8);
    });

    it('should use defaults when environment variables are not set', async () => {
      delete process.env.SCHEDULER_ENABLED;
      delete process.env.CSV_IMPORT_INTERVAL;
      delete process.env.IMPORT_PROCESSING_INTERVAL;

      vi.resetModules();
      const { getSchedulerConfig: freshGetSchedulerConfig } = await import('../../lib/env');

      const config = freshGetSchedulerConfig();

      expect(config.enabled).toBe(false);
      expect(config.csvImport.interval).toBe('*/15 * * * *');
      expect(config.importProcessing.interval).toBe('*/5 * * * *');
      expect(config.importProcessing.batchSize).toBe(50);
    });
  });
});
