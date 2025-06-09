import { test } from 'node:test';
import assert from 'node:assert';
import { formatError } from '../src/utils/error';

const originalEnv = process.env.NODE_ENV;

test('includes stack when not in production', () => {
  const err = new Error('boom');
  const payload = formatError(err, { WORKER_ENV: 'development' });
  assert.ok('stack' in payload);
});

test('omits stack in production', () => {
  const err = new Error('boom');
  const payload = formatError(err, { WORKER_ENV: 'production' });
  assert.ok(!('stack' in payload));
});

test('includes message for all environments', () => {
  const err = new Error('boom');
  const devPayload = formatError(err, { WORKER_ENV: 'development' });
  const prodPayload = formatError(err, { WORKER_ENV: 'production' });
  
  assert.strictEqual(devPayload.message, 'boom');
  assert.strictEqual(prodPayload.message, 'boom');
});

test('handles non-Error objects', () => {
  const payload = formatError('string error', { WORKER_ENV: 'development' });
  assert.strictEqual(payload.message, 'Unknown error');
  assert.strictEqual(payload.error, 'Internal Server Error');
});

test.after(() => {
  if (originalEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalEnv;
});
