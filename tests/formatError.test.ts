import { test } from 'node:test';
import assert from 'node:assert';
import { formatError } from '../src/utils/error';

const originalEnv = process.env.NODE_ENV;

test('includes stack when not in production', () => {
  delete process.env.NODE_ENV;
  const err = new Error('boom');
  const payload = formatError(err);
  assert.ok('stack' in payload);
});

test('omits stack in production', () => {
  process.env.NODE_ENV = 'production';
  const err = new Error('boom');
  const payload = formatError(err);
  assert.ok(!('stack' in payload));
});

test.after(() => {
  if (originalEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalEnv;
});
